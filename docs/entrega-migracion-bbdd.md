# Entrega al responsable de BBDD

## Mensaje para reenviar

Te envio el paquete `entrega-migracion-bbdd.zip` de Proyecto Unicornio. Contiene el ejecutor oficial y las migraciones PostgreSQL `001` a `009`. El ejecutor consulta `unicornio_migrations`, omite las versiones ya aplicadas y ejecuta cada nueva migracion en su propia transaccion.

Antes de ejecutarlo en produccion:

1. Ejecuta `docs/preflight-migracion-bbdd.sql` y conserva la salida sin datos personales ni credenciales.
2. Confirma PostgreSQL 17 o una version compatible, una copia restaurable y una ventana sin escrituras de la aplicacion.
3. Usa un rol DDL separado del rol de aplicacion, propietario de los objetos existentes o miembro de sus roles propietarios, con `CREATE` en el esquema y permiso para instalar `pgcrypto` si aun no existe.
4. Confirma por separado los grants del rol de aplicacion. El paquete no crea roles, contrasenas ni secretos.
5. Ejecuta primero contra una restauracion o staging y valida el resultado con `docs/postcheck-migracion-bbdd.sql`.

No ejecutes la semilla demo en produccion. Si la base actual guarda datos de negocio en `unicornio_collections`, o el postcheck informa filas con `needs_sensitive_reencryption = true`, detened la activacion y comunicad los contadores al equipo de aplicacion: esta entrega crea y actualiza el esquema, pero no transforma automaticamente esas filas heredadas en envelopes cifrados.

## Contenido y alcance

- `server/migrations/001-questionnaire-pilot.js` a `009-emergency-admin.js`: DDL y backfills versionados.
- `server/migrations/index.js`: orden, transacciones y registro en `unicornio_migrations`.
- `scripts/migrate.js`: conexion exclusiva mediante `MIGRATION_DATABASE_URL`, TLS y limites de tiempo.
- `docs/preflight-migracion-bbdd.sql`: inventario de solo lectura antes del cambio.
- `docs/postcheck-migracion-bbdd.sql`: comprobaciones posteriores.
- `package.json`, `package-lock.json` y `.node-version`: entorno reproducible con Node.js 24.

Las migraciones hacen lo siguiente:

- `001`-`003`: esquema del piloto de cuestionarios, transferencia de alertas e indices de idempotencia.
- `004`: `pgcrypto`, identidad relacional, centros, grupos, asignaciones, vinculos familiares, invitaciones, consentimientos, sesiones, auditoria, UUID y RLS forzado.
- `005`: propietario heredado de alertas y campos cifrados para notas.
- `006`: marca datos sensibles heredados, calcula hashes legales y crea triggers de inmutabilidad.
- `007`: ajusta el contexto de peticion y las politicas RLS.
- `008`: contadores persistentes contra abuso.
- `009`: limita a uno el administrador de emergencia activo.

Esta entrega no incluye:

- Creacion de la base, roles, contrasenas, grants o secretos.
- Semillas o datos personales.
- Conversión completa de datos heredados desde `unicornio_collections`.
- Migraciones de bajada (`down`). La recuperacion es mediante backup/restauracion o una migracion correctiva revisada.

## Riesgos que debe revisar BBDD

- Las migraciones contienen `ALTER TABLE`, backfills, indices y cambios de RLS; pueden tomar bloqueos. Detener las escrituras durante la ventana.
- La `003` puede fallar si ya hay duplicados en las claves que pasan a ser unicas.
- La `006` recorre textos legales y filas sensibles existentes.
- La `009` falla si ya hay mas de un usuario `ADMIN` activo.
- El rol de aplicacion debe ser `NOBYPASSRLS`, no debe tener DDL y no debe poder actualizar o borrar auditoria.
- El runner tiene `statement_timeout` de 60 segundos. Si el volumen real requiere mas, no se debe modificar o ejecutar SQL manualmente sin estimar primero el cambio y revisar una version controlada del runner.

Cada migracion se confirma por separado. Si falla una version, esa version se revierte automaticamente, pero las anteriores que ya finalizaron permanecen registradas. Corregido el problema, volver a ejecutar el mismo comando reanuda desde la primera version pendiente.

## Ejecucion

Descomprime el ZIP, abre una terminal en su raiz e instala dependencias exactas:

```powershell
npm ci --omit=dev
```

Inyecta las credenciales desde el gestor de secretos o el sistema de despliegue; no las envies por correo o chat. Ejemplo de nombres de variables en PowerShell:

```powershell
$env:MIGRATION_DATABASE_URL = 'postgresql://ROL_DDL:SECRETO@HOST:5432/BASE'
$env:DATABASE_URL = 'postgresql://ROL_APP:SECRETO@HOST:5432/BASE'
$env:MIGRATION_DATABASE_SSL_MODE = 'verify-full'
$env:MIGRATION_DATABASE_CA = '-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----'
npm run migrate
```

Para una base local aislada que no use TLS, establece exclusivamente en ese entorno:

```powershell
$env:MIGRATION_DATABASE_SSL_MODE = 'disable'
```

`MIGRATION_DATABASE_URL` y `DATABASE_URL` deben ser distintas y pertenecer a roles diferentes. La aplicacion no aplica DDL al arrancar.

## Criterio de exito

La ejecucion debe terminar con:

```text
Migraciones aplicadas correctamente con el rol DDL.
```

El postcheck debe mostrar las nueve versiones, ninguna migracion esperada ausente, RLS habilitado y forzado en las tablas listadas, y el indice `unicornio_one_active_emergency_admin` presente. Cualquier fila marcada para recifrado o cualquier dato de negocio heredado requiere una actuacion posterior del equipo de aplicacion antes de activar datos reales.
