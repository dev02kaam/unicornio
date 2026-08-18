# Informe de seguridad de Proyecto Unicornio

Fecha: 2026-08-05  
Alcance: servidor Express, frontend, persistencia PostgreSQL, identidad, cuestionarios, scripts operativos, pruebas y CI.  
Metodo: revision estatica, pruebas HTTP/unitarias, analisis de dependencias y contraste con las skills locales de seguridad y PostgreSQL.

## Resumen ejecutivo

Los dos hallazgos criticos originales estan corregidos: production no crea cuentas demo ni contraseñas predeterminadas, y el ambito ya no se deriva de `user.schoolId`. JWT/Web Storage se sustituyo por sesiones opacas, CSRF y revocacion; se añadieron OIDC, invitaciones, Argon2id, TOTP de emergencia, RLS, cifrado con AAD, rotacion, retencion, logs seguros y CI.

Resultado local: 47 pruebas aprobadas, una prueba PostgreSQL omitida por no haberse proporcionado una base aislada, y `npm audit` con 0 vulnerabilidades. El piloto con datos reales sigue bloqueado. Permanecen tres hallazgos altos de evolucion/validacion y dos medios; por tanto no se cumple aun el criterio de cero altos para activar datos reales.

| ID | Severidad | Estado | Hallazgo |
|---|---|---|---|
| SEC-001 | Critica | Corregido | Semillas y credenciales demo automaticas |
| SEC-002 | Critica | Corregido | Cambio propio de centro y cruce de consentimientos |
| SEC-003 | Alta | Corregido | JWT conocido, Web Storage y falta de revocacion |
| SEC-004 | Alta | Corregido | TLS PostgreSQL sin validacion |
| SEC-005 | Alta | Corregido | Datos clinicos en claro y cifrado sin AAD/rotacion |
| SEC-006 | Alta | Abierto | Transferencia production aun usa identidad heredada |
| SEC-007 | Alta | Abierto | Organizacion/consentimientos no han terminado su corte relacional |
| SEC-008 | Alta | Verificacion pendiente | RLS PostgreSQL no se ejecuto en esta maquina |
| SEC-009 | Media | Abierto | Sinks `innerHTML` impiden habilitar Trusted Types |
| SEC-010 | Media | Riesgo de despliegue | Privilegios, HSTS, backups e IdP dependen de infraestructura |

## Hallazgos criticos corregidos

### SEC-001 — Semillas y contraseñas demo automaticas

- Evidencia anterior: las fixtures incluyen una contraseña conocida, pero ahora solo se materializan mediante el comando explicito de demo.
- Correccion: `scripts/seed-demo.js:6-17` exige localhost y un nombre de base con `demo` o `test`; `scripts/seed-demo.js:21-27` exige `APP_PROFILE=demo` y `DEMO_DATABASE_URL`. El arranque verifica migraciones y solo carga colecciones demo en `server/config/database.js:577-583`; production no las carga.
- Impacto residual: la contraseña conocida es aceptable solo en la base local aislada. Nunca copiar esa base ni sus cookies a production.
- Prueba: `test/security-critical-regressions.test.js:64-71` verifica estado inicial vacio.

### SEC-002 — Escalada de ambito mediante `schoolId`

- Correccion: `PATCH /api/users/:id` requiere ADMIN en `server/routes/users.routes.js:31`; el perfil propio tiene un DTO estricto en `server/schemas/users.schemas.js:3-5` y solo admite `name`.
- Autorizacion: consentimientos consultan asignaciones activas de centro/grupo en `server/utils/consents.helpers.js:36-57`, no `schoolId`.
- Impacto: elimina el cruce de centro reproducido originalmente.
- Pruebas: `test/security-critical-regressions.test.js:10-52` y `test/http-security.test.js:144-155`.

## Hallazgos altos corregidos

### SEC-003 — Sesiones y credenciales en navegador

- Correccion: cookie `__Host-unicornio_session` en production (`server/config/session.js:4-8`), `HttpOnly`, `SameSite=Lax` y TTL inactivo (`server/config/session.js:35-39`), con MemoryStore prohibido en production (`server/config/session.js:21-24`).
- CSRF/CSWSH: limite global de 64 KiB y CSRF en `server/create-app.js:77-81`; Origin exacto y Fetch Metadata en `server/middlewares/request-security.middleware.js:13-21`.
- Frontend: `public/js/api.js:60-107` usa cookies same-origin y cabecera CSRF; no hay JWT ni credenciales persistidas en Web Storage.
- Revocacion: la version de sesion se comprueba por peticion y cambia con la contraseña.
- Pruebas: fijacion/regeneracion, logout, CSRF y revocacion en `test/http-security.test.js`.

### SEC-004 — Transporte y consistencia PostgreSQL

- Correccion: production exige `DATABASE_SSL_MODE=verify-full` y CA en `server/config/env.js:28-31`; el pool usa `rejectUnauthorized` y timeouts/pool limitado en `server/config/database.js:561-573`.
- Migraciones: el arranque no ejecuta DDL; comprueba todas las versiones en `server/config/database.js:577` y `/readyz` repite la comprobacion (`server/routes/health.routes.js:6-12`).
- Roles: migracion, aplicacion, retencion y rotacion usan URLs distintas; se documenta `NOBYPASSRLS`.

### SEC-005 — Proteccion de datos clinicos

- Correccion: AES-256-GCM aplica AAD antes de cifrar (`server/services/questionnaire-crypto.service.js:42-57`) y verifica el hash con comparacion constante (`server/services/questionnaire-crypto.service.js:67-77`). La version selecciona una clave historica (`server/services/questionnaire-crypto.service.js:81-87`).
- Cobertura: resultado guarda puntuacion/banda dentro del payload cifrado; las notas de resolucion/transferencia y contexto de alertas tambien se cifran.
- Rotacion: `server/services/data-key-rotation.service.js:17-101` recifra todos los campos en una transaccion y registra `DATA_KEY_ROTATED`.
- Proveedor: production exige un adaptador absoluto y confiable en `server/services/key-provider-loader.service.js:16-31`; no admite claves env/local.
- Retencion: `server/services/retention.service.js:10-43` elimina datos por plazos explicitos con un rol privilegiado separado.
- Pruebas: alteracion, intercambio de fila/AAD y claves historicas en `test/questionnaire-crypto.test.js`.

## Hallazgos altos abiertos

### SEC-006 — Transferencia production aun usa identidad heredada

- Evidencia: `server/services/questionnaires.service.js:1380` resuelve el destino con `findUserById` sobre la coleccion demo; `server/services/questionnaires.service.js:1417-1425` cambia `owner_professional_legacy_id` y crea la notificacion con IDs heredados.
- Impacto: la transferencia es transaccional y segura en demo, pero el camino OIDC/UUID de production no puede completar de forma fiable el cambio de propietario. No se ha demostrado que el origen pierda escritura usando exclusivamente UUID y RLS.
- Correccion requerida: resolver destino, grupo y propietario en la misma transaccion relacional; escribir `owner_professional_id`, `target_professional_id` y `recipient_user_uuid`; probar dos profesionales OIDC y el rechazo posterior del origen.
- Mitigacion actual: `REAL_DATA_PILOT_ENABLED=false`; no activar datos reales.

### SEC-007 — Corte relacional incompleto en organizacion y consentimientos

- Evidencia: `server/services/organization.service.js:78-98` y `server/services/organization.service.js:253-303` siguen leyendo colecciones; `server/services/consents.service.js:32-41` mantiene consentimientos/auditoria en memoria y persiste espejos completos.
- Contencion: production ya no carga esas colecciones (`server/config/database.js:578-584`) y no existe fallback a archivo, por lo que falla cerrado en vez de mezclar instancias.
- Impacto: los endpoints de estructura/consentimiento de production no estan listos para el piloto; reactivar los espejos para sortearlo reintroduciria inconsistencias multiinstancia.
- Correccion requerida: repositorios relacionales/DTO por rol para todos esos endpoints, transacciones consentimiento-participante y retirada de `unicornio_collections`, `unicornio_sequences` y los modelos heredados.
- Mitigacion actual: demo aislada y bloqueo de datos reales.

### SEC-008 — RLS no validado localmente contra PostgreSQL

- Evidencia de implementacion: RLS se fuerza en consentimientos, respuestas, resultados, alertas y notificaciones (`server/migrations/004-relational-security-foundation.js:224-312`); cada peticion establece `SET LOCAL app.user_id` en `server/config/database.js:77-82` y usa el contexto desde `server/middlewares/auth.middleware.js:22,39`.
- Evidencia pendiente: la prueba `test/postgres-migrations.test.js` se omitio porque `QUESTIONNAIRE_TEST_DATABASE_URL` no estaba definida.
- Impacto: hasta ejecutar la matriz rol × recurso × accion sobre el rol real `NOBYPASSRLS`, no se puede descartar una politica demasiado amplia o una escritura bloqueada.
- Correccion/aceptacion: ejecutar el job PostgreSQL de `.github/workflows/security-ci.yml`, ampliar la prueba a SELECT/INSERT/UPDATE por cada rol y conservar el resultado como evidencia de release.

## Hallazgos medios

### SEC-009 — `innerHTML` y Trusted Types

- Evidencia: continúan sinks en `public/js/centers.js:251-339`, `public/js/groups.js:277-607` y otras vistas. Varias rutas escapan texto, pero el patron sigue siendo fragil ante un campo nuevo sin escape.
- Impacto: un error de codificacion futuro puede convertirse en DOM XSS; aun no puede activarse `require-trusted-types-for 'script'` sin romper vistas.
- Mitigacion: CSP estricta sin scripts inline en `server/create-app.js:47-61` y Zod limita entradas.
- Correccion: migrar renderizadores a `textContent`, `createElement`, atributos seguros y plantillas estaticas; despues habilitar Trusted Types y añadir payloads XSS a Playwright.

### SEC-010 — Controles dependientes de despliegue

- Evidencia: HSTS esta desactivado deliberadamente en la app (`server/create-app.js:46`) y debe vivir en el edge; `TRUST_PROXY`, CA, proveedor de claves, IdP, backups y privilegios se reciben por configuracion.
- Impacto: una configuracion incorrecta del proxy o grants excesivos puede anular IP/rate-limit o defensa en profundidad.
- Correccion: aplicar IaC revisada, grants minimos, rol `NOBYPASSRLS`, HSTS en dominio validado, restauracion documentada y runbook de incidentes. Ver `docs/security-operations.md`.

## Calidad y observabilidad

- Zod estricto y limites: `server/middlewares/validation.middleware.js:19-134`; OpenAPI derivado en `server/openapi.js`.
- Logs estructurados/redactados y request IDs UUID: `server/config/logger.js:7-48`; auth y lecturas clinicas se auditan.
- Health: `/livez` y `/readyz` en `server/routes/health.routes.js:18-35` sin filtrar detalles.
- Abuso persistente: tabla e indice en `server/migrations/008-persistent-abuse-controls.js`; login/invitaciones usan IP+cuenta hasheada.
- CI: `.github/workflows/security-ci.yml` fija Node 24, PostgreSQL, lint, pruebas HTTP/PG/E2E, audit, SBOM, CodeQL y Gitleaks.

## Falsos positivos y decisiones conscientes

- `QUESTIONNAIRE_DATA_KEY` solo existe para demo local. Production la rechaza al exigir proveedor externo.
- Las credenciales demo siguen en fixtures, pero no se cargan al arrancar y el comando de semilla exige una base local denominada demo/test.
- `localStorage` restante conserva preferencias visuales, no tokens ni identificadores de sesion.
- HSTS no se habilita en Express para evitar fijarlo por error en localhost; es obligatorio en el edge de production.
- Las advertencias ESLint sobre `require()` no literal corresponden al adaptador absoluto de claves, validado como configuracion de despliegue; debe apuntar a codigo firmado/revisado.

## Criterio de salida

No activar datos reales mientras SEC-006, SEC-007 o SEC-008 sigan abiertos. Ademas se requiere revision externa, EIPD aprobada, restauracion de backup demostrada, aprobacion clinica y protocolo de incidentes probado. `REAL_DATA_PILOT_ENABLED` es un ultimo seguro de configuracion, no una sustitucion de esas evidencias.
