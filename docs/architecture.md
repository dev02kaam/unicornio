# Arquitectura de seguridad

## Perfiles y fronteras

`demo` y `production` son entornos independientes. Cada uno tiene base, roles PostgreSQL, cookies, secretos, dominio y proveedor OIDC propios. `production` usa frontend y API same-origin; CORS permanece desactivado.

El flujo de una peticion autenticada es: edge TLS/HSTS -> Helmet/CSP -> limite de cuerpo -> sesion opaca -> Origin/Fetch Metadata/CSRF -> autenticacion -> contexto transaccional RLS -> servicio -> PostgreSQL. El request ID acompaña logs y auditorias sin registrar cuerpos clinicos.

## Identidad

- SCHOOL, TEACHER y PROFESSIONAL: OIDC, PKCE S256, `state`, `nonce`, issuer/audience exactos y MFA confirmado por claims.
- STUDENT y FAMILY: invitacion de 256 bits, hash SHA-256, un uso, 24 horas, contraseña Argon2id.
- ADMIN: una cuenta local de emergencia, provisionada fuera de UI, TOTP y rotacion auditada.
- El vinculo OIDC se identifica por `(issuer, subject)`, nunca solo por email.

## Persistencia

Las migraciones 004-009 crean usuarios, centros, grupos, asignaciones, vinculos familiares, consentimientos, sesiones, invitaciones, auditoria y controles de abuso relacionales. RLS se fuerza en consentimientos y datos clinicos. `SET LOCAL app.user_id` se establece por transaccion; `app.legacy_user_id` existe solo para compatibilidad demo mientras se retira la interfaz heredada.

El rol DDL, el rol de aplicacion y los roles de mantenimiento/retencion son distintos. El rol de aplicacion no debe tener `BYPASSRLS`, DDL ni permisos de update/delete sobre auditoria.

## Datos sensibles

Respuestas, puntuacion, banda, reglas, contexto de alertas y notas se cifran con AES-256-GCM. El AAD incluye tabla, registro, campo, campana y alumno. Los envelopes guardan version y hash del AAD. El adaptador de claves precarga la version actual e historicas desde el proveedor externo; la rotacion es gradual, transaccional y auditada.
