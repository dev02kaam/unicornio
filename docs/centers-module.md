# Modulo de centros y grupos

Este modulo cubre la base organizativa de Proyecto Unicornio en memoria.

## Incluye

- Centros educativos.
- Cursos academicos.
- Grupos por centro.
- Asignaciones de usuarios a centros.
- Asignaciones de usuarios a grupos.
- Pantallas basicas para consultar y crear centros y grupos.

## Reglas principales

- `ADMIN` puede crear, editar y desactivar centros y grupos.
- `SCHOOL` puede consultar los centros asignados y crear grupos dentro de su centro.
- `PROFESSIONAL` puede consultar sus asignaciones.
- `STUDENT` y `FAMILY` solo consultan sus datos y asignaciones.
- La desactivacion de un centro desactiva sus grupos y asignaciones relacionadas.

## Endpoints nuevos

- `GET /api/centers`
- `POST /api/centers`
- `GET /api/centers/:centerId`
- `PATCH /api/centers/:centerId`
- `DELETE /api/centers/:centerId`
- `GET /api/centers/:centerId/groups`
- `POST /api/centers/:centerId/groups`
- `GET /api/centers/:centerId/users`
- `GET /api/groups/:groupId`
- `PATCH /api/groups/:groupId`
- `DELETE /api/groups/:groupId`
- `GET /api/groups/:groupId/users`
- `POST /api/centers/:centerId/users/:userId`
- `DELETE /api/centers/:centerId/users/:userId`
- `POST /api/groups/:groupId/users/:userId`
- `DELETE /api/groups/:groupId/users/:userId`
- `GET /api/users/:userId/assignments`

## Pantallas nuevas

- `public/centers.html`
- `public/groups.html`

## Datos demo

- `admin@unicornio.local`
- `profesional@unicornio.local`
- `alumno@unicornio.local`
- `school@unicornio.local`
- `familia@unicornio.local`

Contrasenha demo: `Demo1234!`
