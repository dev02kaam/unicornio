const test = require('node:test');
const assert = require('node:assert/strict');

const { updateUserController } = require('../server/controllers/users.controller');
const { findUserById } = require('../server/services/users.service');
const { database, createRuntimeState } = require('../server/config/database');
const { canViewConsent } = require('../server/utils/consents.helpers');
const { buildEnv } = require('../server/config/env');
const { validateCenterCreate } = require('../server/middlewares/validation.middleware');

test('una cuenta no administrativa no puede cambiar su propio centro', async () => {
  const teacher = findUserById('2');
  const originalSchoolId = teacher.schoolId;
  let nextError = null;
  let responseSent = false;

  const req = {
    user: { ...teacher },
    params: { id: teacher.id },
    body: { schoolId: 'center-2' },
  };
  const res = {
    status() { return this; },
    json() { responseSent = true; return this; },
  };

  try {
    await updateUserController(req, res, (error) => {
      nextError = error;
    });

    assert.equal(responseSent, false);
    assert.equal(nextError?.statusCode, 403);
    assert.equal(findUserById(teacher.id).schoolId, originalSchoolId);
  } finally {
    findUserById(teacher.id).schoolId = originalSchoolId;
  }
});

test('alterar schoolId no concede lectura de consentimientos de otro centro', () => {
  const teacher = findUserById('2');
  const foreignConsent = database.getCollection('consents')
    .find((consent) => consent.id === 'consent-4');
  const originalSchoolId = teacher.schoolId;

  try {
    teacher.schoolId = foreignConsent.centerId;
    assert.equal(canViewConsent(teacher, foreignConsent), false);
  } finally {
    teacher.schoolId = originalSchoolId;
  }
});

test('production falla cerrado si faltan sus controles obligatorios', () => {
  assert.equal(typeof buildEnv, 'function');
  assert.throws(
    () => buildEnv({ APP_PROFILE: 'production' }),
    /Configuracion de production invalida/,
  );
});

test('production solo acepta el perfil completo y bloquea datos reales sin aprobaciones', () => {
  const complete = {
    APP_PROFILE: 'production',
    DATABASE_URL: 'postgresql://app@example.test/unicornio',
    DATABASE_SSL_MODE: 'verify-full',
    DATABASE_CA: 'CA de prueba',
    SESSION_SECRET: 'session-secret-with-at-least-32-characters',
    APP_ORIGIN: 'https://unicornio.example.test',
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'unicornio',
    OIDC_AUDIENCE: 'unicornio-api',
    OIDC_REDIRECT_URI: 'https://unicornio.example.test/api/auth/oidc/callback',
    OIDC_MFA_ACR_VALUES: 'urn:example:mfa',
    DATA_KEY_PROVIDER: 'external-vault',
    DATA_KEY_CURRENT_VERSION: 'v2',
    DATA_KEY_PROVIDER_MODULE: 'C:\\deploy\\unicornio-key-adapter.js',
    EMERGENCY_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    RETENTION_RESPONSES_DAYS: '30',
    RETENTION_RESULTS_DAYS: '90',
    RETENTION_NOTIFICATIONS_DAYS: '30',
    RETENTION_SESSIONS_DAYS: '1',
    RETENTION_AUDIT_DAYS: '730',
  };
  assert.doesNotThrow(() => buildEnv(complete));
  assert.throws(
    () => buildEnv({ ...complete, REAL_DATA_PILOT_ENABLED: 'true' }),
    /DPIA_APPROVAL_REFERENCE/,
  );
});

test('production no materializa usuarios demo al cargar la capa de datos', () => {
  assert.equal(typeof createRuntimeState, 'function');
  const state = createRuntimeState();
  assert.deepEqual(state.users, []);
  assert.deepEqual(state.consents, []);
});

test('el alta de centro no completa una contrasena local por defecto', () => {
  let nextError = null;
  validateCenterCreate(
    {
      body: {
        name: 'Centro sin credencial implicita',
        userEmail: 'centro-seguro@example.test',
      },
    },
    {},
    (error) => { nextError = error || null; },
  );

  assert.equal(nextError?.statusCode, 400);
  assert.match(nextError?.details?.join(' ') || '', /contrasena/i);
});
