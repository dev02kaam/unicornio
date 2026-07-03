# Arquitectura inicial

Proyecto Unicornio se organiza en capas:

- `server/routes`: rutas HTTP.
- `server/controllers`: adaptacion de request y response.
- `server/services`: logica de negocio.
- `server/models`: forma de los datos.
- `server/middlewares`: seguridad, autenticacion y errores.
- `public`: frontend minimo.

La persistencia actual es una base tecnica en memoria, pensada para migrar despues a SQLite o PostgreSQL sin rehacer la estructura.

