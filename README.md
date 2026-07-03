# Proyecto Unicornio

Base tecnica inicial de Proyecto Unicornio: una aplicacion web cliente-servidor orientada al ambito educativo e infanto-juvenil.

## Que incluye esta fase

- Estructura general del proyecto.
- Servidor Node.js con Express.
- Frontend minimo en HTML, CSS y JavaScript puro.
- Autenticacion con JWT.
- Modulo de usuarios.
- Modulo organizativo de centros, grupos y asignaciones.
- Seguridad basica.
- Area privada demo.
- Alta de usuarios desde el panel de administracion.

## Que no incluye esta fase

- Cuestionarios.
- Respuestas.
- Scoring.
- Alertas.
- Estadisticas.
- Consentimientos.
- Informes.
- Logica clinica o psicologica.

## Requisitos

- Node.js 18 o superior.
- npm.

## Instalacion

```bash
npm install
```

## Ejecucion

```bash
npm run dev
```

Abrir:

```text
http://localhost:3000
```

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`

## Usuarios demo

- `admin@unicornio.local`
- `profesional@unicornio.local`
- `alumno@unicornio.local`
- `school@unicornio.local`
- `familia@unicornio.local`

Contrasenha demo:

- `Demo1234!`

## Endpoints

### Health

- `GET /api/health`

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Users

- `GET /api/users`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/deactivate`

### Centers

- `GET /api/centers`
- `POST /api/centers`
- `GET /api/centers/:centerId`
- `PATCH /api/centers/:centerId`
- `DELETE /api/centers/:centerId`
- `GET /api/centers/:centerId/groups`
- `POST /api/centers/:centerId/groups`
- `GET /api/centers/:centerId/users`

### Groups

- `GET /api/groups/:groupId`
- `PATCH /api/groups/:groupId`
- `DELETE /api/groups/:groupId`
- `GET /api/groups/:groupId/users`

### Assignments

- `POST /api/centers/:centerId/users/:userId`
- `DELETE /api/centers/:centerId/users/:userId`
- `POST /api/groups/:groupId/users/:userId`
- `DELETE /api/groups/:groupId/users/:userId`
- `GET /api/users/:userId/assignments`

## Notas de seguridad

- Las contrasenas se guardan con hash.
- El acceso a usuarios esta protegido por token y roles.
- El login usa limitacion de peticiones.
- Si se supera el limite de login, la respuesta incluye el tiempo estimado para reintentar.
- Este prototipo no usa datos reales de menores.

## Estructura de carpetas

```text
proyecto-unicornio/
  server/
  public/
  docs/
```

## Proximos pasos

- Anadir persistencia real.
- Crear cuestionarios.
- Anadir consentimientos, resultados y alertas.
- Endurecer privacidad y auditoria.
