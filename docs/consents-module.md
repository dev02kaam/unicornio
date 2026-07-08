# Modulo de consentimientos familiares

Este modulo prepara la capa tecnica para que, en fases posteriores, un estudiante solo pueda participar en cuestionarios si existe un consentimiento familiar valido.

## Que incluye

- Modelo de consentimiento.
- Versiones de texto legal demo.
- Auditoria basica de acciones sensibles.
- Servicio para comprobar si un estudiante tiene consentimiento valido.
- API para familias, administracion, escuela, profesionales y estudiantes.
- Pantallas demo para revisar consentimiento y texto legal provisional.

## Que no incluye

- Cuestionarios.
- Respuestas.
- Scoring.
- Alertas clinicas.
- Estadisticas clinicas.
- Informes.
- Logica sanitaria o psicologica.
- Texto legal definitivo.

## Relacion familia-estudiante reutilizada

La relacion ya existente se reutiliza mediante `linkedStudentId` en el usuario con rol `FAMILY`.

No se ha creado una tabla nueva de vinculacion familiar.

La validacion de permisos familiares comprueba:

- que el usuario tenga rol `FAMILY`;
- que `linkedStudentId` apunte al estudiante correcto;
- que el consentimiento pertenezca a esa familia y a ese estudiante.

## Modelos añadidos

### Consent

- `id`
- `studentId`
- `familyUserId`
- `centerId`
- `legalTextVersionId`
- `status`
- `requestedByUserId`
- `acceptedAt`
- `rejectedAt`
- `revokedAt`
- `expiresAt`
- `revocationReason`
- `createdAt`
- `updatedAt`

### LegalTextVersion

- `id`
- `version`
- `title`
- `content`
- `isActive`
- `effectiveFrom`
- `effectiveTo`
- `createdAt`
- `updatedAt`

### ConsentAuditLog

- `id`
- `consentId`
- `action`
- `performedByUserId`
- `previousStatus`
- `newStatus`
- `metadata`
- `createdAt`

## Estados de consentimiento

- `PENDING`
- `ACCEPTED`
- `REJECTED`
- `REVOKED`
- `EXPIRED`

## Permisos

- `ADMIN`: puede listar, consultar, crear solicitudes, caducar, consultar auditoria y gestionar textos legales.
- `SCHOOL`: puede ver consentimientos de su centro y crear solicitudes para estudiantes de su centro.
- `PROFESSIONAL`: puede consultar estado basico y verificar si un estudiante tiene consentimiento valido.
- `FAMILY`: puede aceptar, rechazar y revocar consentimientos vinculados a sus estudiantes.
- `STUDENT`: puede consultar su estado de forma limitada, sin modificar nada.

## Endpoints

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

## Servicio clave

`hasValidConsent(studentId)` devuelve un objeto de estado tecnico para fases posteriores.

Las versiones legales se pueden activar y desactivar desde la API y desde la interfaz demo de administracion.

Ejemplo:

```json
{
  "hasValidConsent": true,
  "consentId": "consent-1",
  "status": "ACCEPTED",
  "legalTextVersionId": "legal-text-1",
  "acceptedAt": "2026-06-01T10:00:00.000Z"
}
```

Posibles motivos de ausencia de validez:

- `NO_CONSENT_FOUND`
- `NO_ACCEPTED_CONSENT`
- `CONSENT_REVOKED`
- `CONSENT_REJECTED`
- `CONSENT_EXPIRED`
- `STUDENT_NOT_FOUND`
- `STUDENT_INACTIVE`

## Datos demo

Se han incluido datos demo para probar:

- una version legal activa;
- un consentimiento pendiente;
- un consentimiento aceptado;
- un consentimiento revocado.

Usa usuarios demo existentes y dos nuevas cuentas demo:

- `alumno2@unicornio.local`
- `familia2@unicornio.local`
- `schoolnorte@unicornio.local`
- `profesor.norte@unicornio.local`
- `profesional.norte@unicornio.local`
- `alumno3@unicornio.local`
- `familia3@unicornio.local`
- `alumno4@unicornio.local`
- `familia4@unicornio.local`

## Consideraciones de proteccion de datos

- Los textos legales son provisionales.
- El contenido es de demo, no juridicamente definitivo.
- La trazabilidad basica se conserva mediante auditoria.
- Se minimiza la exposicion de datos al devolver solo el contexto necesario.
- No se deben usar datos reales de menores en este entorno.

## Como probarlo

1. Ejecuta `npm install`.
2. Ejecuta `npm run dev`.
3. Entra con una cuenta demo.
4. Abre `/consents.html` o `/legal.html`.
5. Consulta el estado de un estudiante con consentimiento demo.

## Proximos pasos

- Persistencia real.
- Renovacion por cambio de version legal.
- Flujo de solicitud de consentimiento mas guiado.
- Integracion futura con cuestionarios y autorizacion de participacion.
