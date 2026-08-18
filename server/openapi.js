const { z } = require('zod');
const {
  loginBodySchema,
  registerBodySchema,
  changePasswordBodySchema,
  oidcCallbackSchema,
} = require('./schemas/auth.schemas');
const {
  invitationCreateBodySchema,
  invitationAcceptBodySchema,
} = require('./schemas/invitations.schemas');
const {
  campaignCreateBodySchema,
  answerBodySchema,
  alertResolutionBodySchema,
  alertTransferBodySchema,
} = require('./schemas/questionnaires.schemas');
const { ownProfileBodySchema } = require('./schemas/users.schemas');

function jsonSchema(schema) {
  const result = z.toJSONSchema(schema, {
    target: 'draft-7',
    io: 'input',
    unrepresentable: 'any',
  });
  delete result.$schema;
  return result;
}

function requestBody(schema) {
  return {
    required: true,
    content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } },
  };
}

const schemas = {
  Login: loginBodySchema,
  Register: registerBodySchema,
  ChangePassword: changePasswordBodySchema,
  OidcCallback: oidcCallbackSchema,
  InvitationCreate: invitationCreateBodySchema,
  InvitationAccept: invitationAcceptBodySchema,
  CampaignCreate: campaignCreateBodySchema,
  Answer: answerBodySchema,
  AlertResolution: alertResolutionBodySchema,
  AlertTransfer: alertTransferBodySchema,
  OwnProfile: ownProfileBodySchema,
};

const openApiDocument = Object.freeze({
  openapi: '3.1.0',
  info: { title: 'Proyecto Unicornio API', version: '0.2.0' },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      cookieSession: { type: 'apiKey', in: 'cookie', name: '__Host-unicornio_session' },
      csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
    },
    schemas: Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, jsonSchema(schema)])),
  },
  paths: {
    '/auth/login': { post: { requestBody: requestBody('Login'), responses: { 200: { description: 'Sesion creada' } } } },
    '/auth/register': { post: { requestBody: requestBody('Register'), responses: { 201: { description: 'Solo demo' }, 404: { description: 'Deshabilitado' } } } },
    '/auth/session': { get: { security: [{ cookieSession: [] }], responses: { 200: { description: 'Sesion activa' } } } },
    '/auth/csrf': { get: { responses: { 200: { description: 'Token CSRF sincronizado' } } } },
    '/auth/change-password': { post: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('ChangePassword'), responses: { 200: { description: 'Sesiones revocadas' } } } },
    '/invitations': { post: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('InvitationCreate'), responses: { 201: { description: 'Invitacion de un uso' } } } },
    '/invitations/{token}/accept': { post: { requestBody: requestBody('InvitationAccept'), responses: { 201: { description: 'Cuenta creada' }, 410: { description: 'Token no utilizable' } } } },
    '/users/me/profile': { patch: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('OwnProfile'), responses: { 200: { description: 'Perfil seguro actualizado' } } } },
    '/questionnaire-campaigns': { post: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('CampaignCreate'), responses: { 201: { description: 'Campana creada' } } } },
    '/questionnaire-attempts/{attemptId}/answers': { put: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('Answer'), responses: { 200: { description: 'Respuesta cifrada guardada' } } } },
    '/questionnaire-alerts/{alertId}/resolve': { post: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('AlertResolution'), responses: { 200: { description: 'Alerta resuelta' } } } },
    '/questionnaire-alerts/{alertId}/transfer': { post: { security: [{ cookieSession: [], csrfToken: [] }], requestBody: requestBody('AlertTransfer'), responses: { 200: { description: 'Propiedad transferida' } } } },
  },
});

module.exports = { openApiDocument, jsonSchema };
