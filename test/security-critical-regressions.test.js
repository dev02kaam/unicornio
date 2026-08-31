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
    OIDC_ENABLED: 'true',
    OIDC_ISSUER: 'https://idp.example.test',
    OIDC_CLIENT_ID: 'unicornio',
    OIDC_CLIENT_SECRET: 'client-secret-only-for-tests',
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
  assert.throws(
    () => buildEnv({
      ...complete,
      REAL_DATA_PILOT_ENABLED: 'true',
      ALLOW_SHARED_DATABASE_ROLE: 'true',
    }),
    /ALLOW_SHARED_DATABASE_ROLE=false/,
  );
});

test('production sin piloto real puede bloquear OIDC y usar un keyring privado de Render', () => {
  const keyringJson = JSON.stringify({
    keys: { v1: Buffer.alloc(32, 7).toString('base64') },
  });
  const config = buildEnv({
    APP_PROFILE: 'production',
    RENDER_EXTERNAL_URL: 'https://unicornio.onrender.com',
    DATABASE_URL: 'postgresql://app@example.test/unicornio',
    DATABASE_SSL_MODE: 'verify-full',
    SESSION_SECRET: 'session-secret-with-at-least-32-characters',
    LOCAL_ADULT_AUTH_ENABLED: 'true',
    OIDC_ENABLED: 'false',
    DATA_KEY_PROVIDER: 'render-env-keyring',
    DATA_KEY_CURRENT_VERSION: 'v1',
    DATA_KEYRING_JSON: keyringJson,
    EMERGENCY_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
    RETENTION_RESPONSES_DAYS: '30',
    RETENTION_RESULTS_DAYS: '30',
    RETENTION_NOTIFICATIONS_DAYS: '30',
    RETENTION_SESSIONS_DAYS: '1',
    RETENTION_AUDIT_DAYS: '365',
  });

  assert.equal(config.appOrigin, 'https://unicornio.onrender.com');
  assert.equal(config.localAdultAuthEnabled, true);
  assert.equal(config.oidc.enabled, false);
  assert.equal(config.oidc.redirectUri, 'https://unicornio.onrender.com/api/auth/oidc/callback');
  assert.equal(config.databaseCa, '');
  assert.equal(config.dataKeyringJson, keyringJson);
  assert.throws(
    () => buildEnv({
      ...config,
      APP_PROFILE: 'production',
      DATABASE_URL: config.databaseUrl,
      DATABASE_SSL_MODE: config.databaseSslMode,
      SESSION_SECRET: config.sessionSecret,
      APP_ORIGIN: config.appOrigin,
      LOCAL_ADULT_AUTH_ENABLED: 'true',
      OIDC_ENABLED: 'false',
      DATA_KEY_PROVIDER: config.dataKeyProvider,
      DATA_KEY_CURRENT_VERSION: config.dataKeyCurrentVersion,
      DATA_KEYRING_JSON: config.dataKeyringJson,
      EMERGENCY_ADMIN_TOTP_SECRET: config.emergencyAdminTotpSecret,
      RETENTION_RESPONSES_DAYS: '30',
      RETENTION_RESULTS_DAYS: '30',
      RETENTION_NOTIFICATIONS_DAYS: '30',
      RETENTION_SESSIONS_DAYS: '1',
      RETENTION_AUDIT_DAYS: '365',
      REAL_DATA_PILOT_ENABLED: 'true',
    }),
    /OIDC_ENABLED=true.*LOCAL_ADULT_AUTH_ENABLED=false/,
  );
});

test('production no permite dos mecanismos adultos simultaneos', () => {
  assert.throws(
    () => buildEnv({
      APP_PROFILE: 'production',
      DATABASE_URL: 'postgresql://app@example.test/unicornio',
      DATABASE_SSL_MODE: 'verify-full',
      SESSION_SECRET: 'session-secret-with-at-least-32-characters',
      APP_ORIGIN: 'https://unicornio.example.test',
      LOCAL_ADULT_AUTH_ENABLED: 'true',
      OIDC_ENABLED: 'true',
      OIDC_ISSUER: 'https://idp.example.test',
      OIDC_CLIENT_ID: 'unicornio',
      OIDC_CLIENT_SECRET: 'client-secret-only-for-tests',
      OIDC_MFA_ACR_VALUES: 'urn:example:mfa',
      DATA_KEY_PROVIDER: 'render-secret-file',
      DATA_KEY_CURRENT_VERSION: 'v1',
      DATA_KEYRING_FILE: '/etc/secrets/unicornio-keyring.json',
      EMERGENCY_ADMIN_TOTP_SECRET: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      RETENTION_RESPONSES_DAYS: '30',
      RETENTION_RESULTS_DAYS: '30',
      RETENTION_NOTIFICATIONS_DAYS: '30',
      RETENTION_SESSIONS_DAYS: '1',
      RETENTION_AUDIT_DAYS: '365',
    }),
    /activa solo OIDC_ENABLED o LOCAL_ADULT_AUTH_ENABLED/,
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
