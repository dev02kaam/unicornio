# Arquitectura inicial

Proyecto Unicornio se organiza en capas:

- `server/routes`: rutas HTTP.
- `server/controllers`: adaptacion de request y response.
- `server/services`: logica de negocio.
- `server/models`: forma de los datos.
- `server/middlewares`: seguridad, autenticacion y errores.
- `public`: frontend minimo.

## Persistencia

La app puede arrancar en dos modos:

- Sin `DATABASE_URL`: usa memoria con datos demo.
- Con `DATABASE_URL`: usa PostgreSQL y persiste las colecciones actuales en tablas tecnicas `jsonb`.

Tablas creadas automaticamente:

- `unicornio_collections`: guarda colecciones de la app como `users`, `centers`, `groups`, `consents` y asignaciones.
- `unicornio_sequences`: guarda contadores de IDs demo.

Esta integracion permite probar la app con una BBDD real sin reescribir todos los servicios sincronos actuales. El siguiente paso recomendado es migrar modulo a modulo a tablas relacionales normales, empezando por usuarios, centros, grupos y asignaciones.
