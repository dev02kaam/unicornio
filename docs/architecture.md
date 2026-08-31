# Arquitectura de seguridad

## Perfiles y fronteras

`demo` y `production` son entornos independientes. Cada uno tiene base, roles PostgreSQL, cookies, secretos y dominio propios. `production` usa frontend y API same-origin; CORS permanece desactivado. Antes del piloto real, los adultos pueden usar contrasena local con `LOCAL_ADULT_AUTH_ENABLED=true` y OIDC apagado. El piloto real bloquea ese modo y exige OIDC con MFA.

El flujo de una peticion autenticada es: edge TLS/HSTS -> Helmet/CSP -> limite de cuerpo -> sesion opaca -> Origin/Fetch Metadata/CSRF -> autenticacion -> contexto transaccional RLS -> servicio -> PostgreSQL. El request ID acompaña logs y auditorias sin registrar cuerpos clinicos.

## Identidad

- SCHOOL, TEACHER y PROFESSIONAL: contrasena local Argon2id sin dependencias externas cuando no hay datos reales; OIDC, PKCE S256 y MFA obligatorio al activar el piloto real.
- STUDENT y FAMILY: invitacion de 256 bits, hash SHA-256, un uso, 24 horas, contraseña Argon2id.
- ADMIN: una cuenta local de emergencia, provisionada fuera de UI, TOTP y rotacion auditada.
- El vinculo OIDC persistido se identifica por `(issuer, subject)`. Opcionalmente, el primer acceso puede enlazar un unico adulto preprovisionado por correo verificado, solo tras MFA y si no existe ninguna identidad previa; despues el correo deja de intervenir.

## Persistencia

Las migraciones 004-009 crean usuarios, centros, grupos, asignaciones, vinculos familiares, consentimientos, sesiones, invitaciones, auditoria y controles de abuso relacionales. RLS se fuerza en consentimientos y datos clinicos. `SET LOCAL app.user_id` se establece por transaccion; `app.legacy_user_id` existe solo para compatibilidad demo mientras se retira la interfaz heredada.

Por defecto, el rol DDL, el rol de aplicacion y los roles de mantenimiento/retencion son distintos. El rol de aplicacion no debe tener `BYPASSRLS`, DDL ni permisos de update/delete sobre auditoria. `ALLOW_SHARED_DATABASE_ROLE=true` permite un unico usuario solo para el despliegue inicial sin datos reales y queda prohibido al activar el piloto real.

## Datos sensibles

Respuestas, puntuacion, banda, reglas, contexto de alertas y notas se cifran con AES-256-GCM. El AAD incluye tabla, registro, campo, campana y alumno. Los envelopes guardan version y hash del AAD. El adaptador de claves precarga la version actual e historicas desde el proveedor externo; la rotacion es gradual, transaccional y auditada.
