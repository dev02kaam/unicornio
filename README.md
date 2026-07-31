# Proyecto Unicornio

Aplicación web cliente-servidor orientada al ámbito educativo e infanto-juvenil.

## Que incluye esta fase

- Estructura general del proyecto.
- Servidor Node.js con Express.
- Frontend minimo en HTML, CSS y JavaScript puro.
- Autenticacion con JWT.
- Modulo de usuarios.
- Modulo organizativo de centros, grupos y asignaciones.
- Módulo de consentimientos familiares versionados.
- Piloto supervisado de cuestionarios experimentales de estado de ánimo para 9–12 y 13–16 años.
- Campañas, sesiones, guardado por respuesta, resultados profesionales, alertas y notificaciones internas.
- Cifrado AES-256-GCM de respuestas y resultados sensibles.
- Migraciones relacionales PostgreSQL para el piloto.
- Seguridad basica.
- Area privada demo.
- Alta de usuarios desde el panel de administracion.
- Identidad visual de Proyecto Unicornio con logo, favicon y paleta propia.
- Companero reactivo con Nico, Luna, Orion y Sol, expresiones ligadas a la actividad y preferencia persistente.

## Límites del piloto

- No diagnostica ni publica instrumentos BYI-2.
- No se activa para datos reales por defecto.
- No incluye ideación autolítica, acoso, editor de cuestionarios, estadísticas grupales, correo ni SMS.
- Requiere revisión clínica, de propiedad intelectual y de impacto en protección de datos antes de un uso real.

## Requisitos

- Node.js 18 o superior.
- npm.
- PostgreSQL obligatorio para el piloto de cuestionarios.

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

Si el puerto 3000 está ocupado, en PowerShell:

```powershell
$env:PORT=3100
npm run dev
```

La aplicación quedará en `http://localhost:3100`.

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar:

- `PORT`
- `NODE_ENV`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CORS_ORIGIN`
- `DATABASE_URL`
- `DATABASE_SSL`
- `DATA_FILE`
- `QUESTIONNAIRE_PILOT_ENABLED`
- `QUESTIONNAIRE_DATA_KEY`
- `QUESTIONNAIRE_DATA_KEY_VERSION`
- `QUESTIONNAIRE_SESSION_MAX_MINUTES`

Si `DATABASE_URL` está vacía, la aplicación mantiene los módulos heredados en `server/data/runtime-state.json`; el piloto seguirá bloqueado. Al usar PostgreSQL, el arranque ejecuta migraciones idempotentes y sincroniza el módulo de consentimientos con tablas relacionales.

El piloto permanece apagado con:

```dotenv
QUESTIONNAIRE_PILOT_ENABLED=false
```

Para una prueba local supervisada, genera una clave de 32 bytes:

```powershell
$env:QUESTIONNAIRE_DATA_KEY = node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))"
$env:QUESTIONNAIRE_PILOT_ENABLED = 'true'
$env:PORT = '3100'
npm run dev
```

No reutilices una clave efímera con datos que necesites recuperar. La versión de clave se configura con `QUESTIONNAIRE_DATA_KEY_VERSION`.

## Usuarios demo

- `admin@unicornio.local`
- `profesional@unicornio.local`
- `alumno@unicornio.local`
- `alumno2@unicornio.local`
- `school@unicornio.local`
- `familia@unicornio.local`
- `familia2@unicornio.local`

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
- `PATCH /api/users/me/companion`
- `GET /api/users/:id`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/deactivate`

## Companero Unicornio

- De 6 a 11 anos se muestran Nico o Luna.
- Desde los 12 anos se muestran Orion o Sol.
- La variante masculina o femenina es una preferencia del unicornio y no representa el genero del usuario.
- La edad se deriva de `birthDate`; en cuentas familiares se usa la del alumno vinculado.
- El personaje reacciona a escritura, peticiones, exitos y errores mediante estados visuales de escucha, pensamiento, celebracion y apoyo.
- Las laminas suministradas se presentan como una escena 2.5D con profundidad y parallax. Para sustituirla por 3D riggeado real hacen falta modelos GLB/GLTF con esqueleto, clips y morph targets.

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

### Consentimientos familiares

- `GET /api/consents`
- `POST /api/consents`
- `GET /api/consents/:id`
- `POST /api/consents/:id/accept`
- `POST /api/consents/:id/reject`
- `POST /api/consents/:id/revoke`
- `POST /api/consents/:id/expire`
- `GET /api/consents/:id/audit`
- `GET /api/students/:studentId/consent-status`
- `GET /api/legal-text-versions`
- `POST /api/legal-text-versions`
- `GET /api/legal-text-versions/active`
- `POST /api/legal-text-versions/:id/activate`
- `POST /api/legal-text-versions/:id/deactivate`

### Piloto de cuestionarios

- `GET /api/questionnaire-definitions`
- `GET|POST /api/questionnaire-campaigns`
- `GET /api/questionnaire-campaigns/:campaignId/monitor`
- `POST /api/questionnaire-campaigns/:campaignId/consents`
- `POST /api/questionnaire-campaigns/:campaignId/open`
- `POST /api/questionnaire-campaigns/:campaignId/close`
- `POST /api/questionnaire-campaigns/:campaignId/cancel`
- `GET /api/questionnaire-campaigns/:campaignId/alerts`
- `GET /api/questionnaire-campaigns/:campaignId/results/:studentId`
- `GET /api/me/questionnaire-assignments`
- `POST /api/questionnaire-participants/:participantId/attempts`
- `PUT /api/questionnaire-attempts/:attemptId/answers`
- `POST /api/questionnaire-attempts/:attemptId/submit`
- `POST /api/questionnaire-attempts/:attemptId/help`
- `POST /api/questionnaire-alerts/:alertId/acknowledge`
- `POST /api/questionnaire-alerts/:alertId/resolve`
- `POST /api/questionnaire-alerts/:alertId/transfer`
- `GET /api/notifications`
- `POST /api/notifications/:notificationId/read`

Superficies:

- Profesional: `/questionnaires.html`
- Alumno: `/questionnaire.html`
- Familia y profesional: `/notifications.html`
- Familia: `/consents.html`

Prueba funcional local:

- `/questionnaire.html?preview=9-12`
- `/questionnaire.html?preview=13-16`
- No necesita sesión, campaña, consentimiento, PostgreSQL ni clave de cifrado.
- Las respuestas permanecen únicamente en la pestaña: no se guardan, puntúan ni generan alertas.
- Está habilitada por defecto solo fuera de producción y puede desactivarse con `QUESTIONNAIRE_PREVIEW_ENABLED=false`.

Reglas operativas del piloto:

- La edad se calcula el día de apertura de la sesión: 9–12 usa la versión infantil, 13–16 la adolescente y cualquier otra edad queda no elegible.
- «Pedir ayuda» conserva las respuestas confirmadas, bloquea el intento y crea una alerta idempotente. Si la aplicación no confirma la entrega, el alumno recibe un mensaje tranquilo, puede volver a pedir ayuda y se le orienta para acercarse al profesional presente.
- Las alertas automáticas se notifican solo al profesional. La familia recibe únicamente el aviso mínimo de una petición manual, sin respuestas, puntuación ni interpretación.
- El profesional confirma recepción, registra la actuación y resuelve o transfiere la alerta. Cada lectura de resultados y actuación queda auditada.
- Las notificaciones se consultan cada cinco segundos con la aplicación abierta y persisten para el siguiente acceso; no constituyen un canal urgente fuera de la aplicación.
- Centro y administrador ven estado operativo, pero no tienen acceso ordinario a respuestas ni resultados clínicos.

## Notas de seguridad

- Las contrasenas se guardan con hash.
- El acceso a usuarios esta protegido por token y roles.
- Los alumnos y familias no pueden enumerar perfiles ajenos de su centro o grupo.
- El registro publico no permite autoasignarse a un centro o grupo.
- El login usa limitacion de peticiones.
- El limitador de login solo se omite con `NODE_ENV=test`.
- Si se supera el limite de login, la respuesta incluye el tiempo estimado para reintentar.
- El piloto está desactivado por defecto y no debe usar datos reales de menores.
- Alumno y familia no reciben puntuaciones ni interpretaciones.
- Cada lectura profesional de resultados y cada actuación sobre alertas queda auditada.

## Pruebas

```bash
npm test
```

La prueba de migraciones PostgreSQL se ejecuta únicamente con una base exclusiva:

```powershell
$env:QUESTIONNAIRE_TEST_DATABASE_URL = 'postgresql://.../unicornio_test'
npm test
```

`QUESTIONNAIRE_TEST_DATABASE_URL` debe ser distinta de `DATABASE_URL`.

## Estructura de carpetas

```text
proyecto-unicornio/
  server/
  public/
  docs/
```

## Condiciones previas a uso real

- Aprobación clínica y de propiedad intelectual de las versiones transcritas.
- Protocolo de actuación del centro y responsables formados.
- Evaluación de impacto, minimización y transparencia conforme al RGPD.
- Claves persistentes gestionadas fuera del repositorio y copias de seguridad verificadas.
