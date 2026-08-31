# Operaciones de seguridad

## Claves

El repositorio no contiene claves. En Render, el proveedor `render-secret-file` lee el keyring desde el Secret File indicado por `DATA_KEYRING_FILE`; para otros gestores, el adaptador indicado por `DATA_KEY_PROVIDER_MODULE` debe obtenerlo. Mantiene disponible la version anterior durante el recifrado. Cambia `DATA_KEY_CURRENT_VERSION`, despliega el keyring y ejecuta `npm run rotate:data-key` con un rol de mantenimiento. Verifica los contadores y el evento `DATA_KEY_ROTATED` antes de retirar una clave historica.

## Retencion

Define todos los `RETENTION_*_DAYS` y ejecuta `npm run retention` de forma programada. El trabajo elimina respuestas, resultados, notificaciones, sesiones vencidas, auditoria fuera de plazo y contadores de abuso. El rol normal no puede borrar auditoria. Conserva evidencia de cada ejecucion sin incluir IDs, emails ni contenido clinico.

## Backup y restauracion

- Cifra backups con claves distintas de las claves de datos y limita el acceso al equipo autorizado.
- Prueba restauraciones en un entorno aislado al menos antes de cada piloto y tras cambios de esquema.
- Registra RPO/RTO, hash del backup, migracion esperada y resultado de verificacion; no copies datos reales a demo.

## Incidentes

1. Preserva logs y request IDs; no vuelques cuerpos o claves.
2. Conten el acceso: revoca sesiones, identidades, invitaciones y claves afectadas.
3. Determina datos, menores, centros y periodos afectados con auditoria append-only.
4. Activa responsables clinicos y de proteccion de datos. Documenta la brecha y evalua la notificacion a la AEPD dentro del plazo aplicable.
5. Restaura, rota secretos, valida RLS y publica acciones correctivas antes de reabrir.

## Readiness y edge

`/livez` solo confirma proceso. `/readyz` comprueba PostgreSQL, migracion y proveedor de claves sin revelar detalles. Configura `TRUST_PROXY` con saltos/IP exactos. HSTS se habilita exclusivamente en el edge despues de validar dominio, TLS y subdominios.
