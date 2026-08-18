# Proyecto Unicornio

Aplicacion educativa e infanto-juvenil con demo local aislada y base tecnica para un piloto controlado. El software no diagnostica y los datos reales permanecen bloqueados hasta completar las aprobaciones clinicas, de seguridad y proteccion de datos.

## Estado de seguridad

- Sesiones opacas PostgreSQL en cookies `HttpOnly`; no se guardan credenciales en Web Storage.
- CSRF sincronizado, `Origin` exacto, Fetch Metadata, CSP/Helmet y cuerpos JSON de 64 KiB.
- Adultos mediante OIDC con PKCE, `state`, `nonce`, issuer/audience exactos y MFA del IdP.
- Familias y alumnado mediante invitaciones aleatorias de un uso y 24 horas; hashes Argon2id y migracion transparente desde bcrypt.
- Administrador local de emergencia unico, con TOTP obligatorio en production.
- PostgreSQL con migraciones explicitas, contexto RLS por peticion, auditoria append-only y roles separados.
- AES-256-GCM con AAD por tabla, registro, campo, campana y alumno; proveedor versionado y trabajo de rotacion.
- Logs Pino con request ID y redaccion; `/livez`, `/readyz`, retencion y CI de seguridad.

Consulta [arquitectura](docs/architecture.md), [matriz de permisos](docs/permissions.md), [operaciones de seguridad](docs/security-operations.md) e [informe de revision](security_best_practices_report.md).

## Requisitos

- Node.js 24 LTS (`.node-version` y `.nvmrc`).
- PostgreSQL 17 o compatible.
- npm.

## Demo local aislada

La demo no comparte base, secretos, cookies, dominio ni OIDC con production. Ya no existen semillas de arranque ni persistencia JSON.

1. Copia `.env.example` a `.env` y mantén `APP_PROFILE=demo`, puerto `3001` y una `DATABASE_URL` dedicada.
2. Ejecuta las migraciones con un rol DDL diferente:

```powershell
$env:MIGRATION_DATABASE_URL = 'postgresql://migration:...@localhost/unicornio_demo'
$env:DATABASE_URL = 'postgresql://app:...@localhost/unicornio_demo'
$env:MIGRATION_DATABASE_SSL_MODE = 'disable'
npm run migrate
```

3. Carga la demo de forma explicita; el nombre de la base debe contener `demo` o `test`:

```powershell
$env:DEMO_DATABASE_URL = 'postgresql://migration:...@localhost/unicornio_demo'
npm run seed:demo
npm run dev
```

Abre `http://localhost:3001`. Si el puerto esta ocupado:

```powershell
$env:PORT = '3002'
$env:APP_ORIGIN = 'http://localhost:3002'
npm run dev
```

Las cuentas demo usan exclusivamente la contraseña `Demo1234!`. Nunca ejecutes la semilla contra production.

## Production

`APP_PROFILE=production` falla al arrancar si faltan PostgreSQL, TLS `verify-full` con CA, secretos de sesion, OIDC/MFA, TOTP de emergencia, proveedor externo de claves o plazos de retencion; tambien rechaza semillas, registro publico, preview, migraciones automaticas y `DATA_FILE`.

Las migraciones se ejecutan con `npm run migrate` y `MIGRATION_DATABASE_URL`; la aplicacion no aplica DDL al arrancar. `DATA_KEY_PROVIDER_MODULE` es una ruta absoluta a un adaptador de despliegue confiable que exporta `createKeyProvider()` y obtiene claves actuales e historicas desde el gestor de secretos elegido.

`REAL_DATA_PILOT_ENABLED=true` exige referencias de EIPD, revision externa, restauracion de backup, protocolo de incidentes y aprobacion clinica. Este control tecnico no sustituye la revision humana.

## Identidad y API

El login local no devuelve token. Endpoints principales:

- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `GET /api/auth/csrf`.
- `GET|POST /api/auth/oidc/start|callback`.
- `POST /api/invitations`, `POST /api/invitations/:token/accept`.
- `PATCH /api/users/me/profile`, `POST /api/auth/change-password`.
- `POST /api/questionnaire-alerts/:alertId/transfer` con `{ targetProfessionalId, note }`.
- `GET /api/openapi.json`, `GET /livez`, `GET /readyz`.

Todos los contratos de escritura son Zod estrictos. El OpenAPI se genera desde esos mismos esquemas.

## Operaciones

```bash
npm run lint
npm test
npm run test:e2e
npm run verify
npm run retention
npm run rotate:data-key
```

- `npm run retention` exige `RETENTION_DATABASE_URL`, diferente del rol de aplicacion.
- `npm run rotate:data-key` exige `KEY_MAINTENANCE_DATABASE_URL` y registra el recifrado.
- La prueba PostgreSQL solo se activa con `QUESTIONNAIRE_TEST_DATABASE_URL`, distinta de `DATABASE_URL`.
- E2E usa Playwright y comprueba acceso, foco y teclado para los seis roles.

GitHub Actions ejecuta Node 24, PostgreSQL aislado, lint, pruebas, Playwright, `npm audit`, CodeQL, Gitleaks y genera un SBOM CycloneDX.

## Limites y activacion real

Antes de usar datos reales: cero hallazgos criticos/altos abiertos, backup restaurado, revision externa, EIPD aprobada, protocolo de incidentes probado y validacion clinica. La activacion debe mantener un profesional presente y canales urgentes independientes; las notificaciones internas no son un servicio de emergencia.
