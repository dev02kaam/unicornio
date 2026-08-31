const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config();

const APP_PROFILES = new Set(['demo', 'production']);
const DATABASE_SSL_MODES = new Set(['disable', 'require', 'verify-full']);
function readBoolean(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function readPositiveNumber(value, fallback) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? number : Number.NaN;
}

function readVersionedDataKeys(source) {
  const keys = {};
  Object.entries(source).forEach(([name, value]) => {
    const match = /^DATA_KEY_(V[1-9][0-9]*)$/i.exec(name);
    if (match && value) keys[match[1].toLowerCase()] = String(value).trim();
  });
  return Object.freeze(keys);
}

function dataKeyVariableName(version) {
  return `DATA_KEY_${String(version || '').toUpperCase()}`;
}

function resolveDatabaseSslMode(source, appProfile) {
  if (source.DATABASE_SSL_MODE) return String(source.DATABASE_SSL_MODE).toLowerCase();
  if (source.DATABASE_SSL === 'false') return 'disable';
  if (source.DATABASE_SSL === 'true') return 'require';
  return appProfile === 'production' ? 'verify-full' : 'disable';
}

function assertProductionConfig(config) {
  if (config.appProfile !== 'production') return;

  const failures = [];
  if (!config.databaseUrl) failures.push('DATABASE_URL');
  if (config.databaseSslMode !== 'verify-full') failures.push('DATABASE_SSL_MODE=verify-full');
  if (!config.sessionSecret || config.sessionSecret.length < 32) failures.push('SESSION_SECRET (minimo 32 caracteres)');
  if (!config.appOrigin) failures.push('APP_ORIGIN');
  if (config.oidc.enabled) {
    if (!config.oidc.issuer) failures.push('OIDC_ISSUER');
    if (!config.oidc.clientId) failures.push('OIDC_CLIENT_ID');
    if (!config.oidc.clientSecret) failures.push('OIDC_CLIENT_SECRET');
    if (!config.oidc.audience) failures.push('OIDC_AUDIENCE');
    if (!config.oidc.redirectUri) failures.push('OIDC_REDIRECT_URI');
    if (config.oidc.mfaAcrValues.length === 0) failures.push('OIDC_MFA_ACR_VALUES');
  }
  if (!config.dataKeyProvider || ['env', 'environment', 'local'].includes(config.dataKeyProvider)) {
    failures.push('DATA_KEY_PROVIDER externo');
  }
  if (!config.dataKeyCurrentVersion) failures.push('DATA_KEY_CURRENT_VERSION');
  if (config.dataKeyProvider === 'render-secret-file') {
    if (!config.dataKeyringFile) failures.push('DATA_KEYRING_FILE');
  } else if (config.dataKeyProvider === 'render-env-keyring') {
    if (!config.dataKeyEnvironmentKeys[config.dataKeyCurrentVersion]) {
      failures.push(dataKeyVariableName(config.dataKeyCurrentVersion));
    }
  } else if (!config.dataKeyProviderModule) {
    failures.push('DATA_KEY_PROVIDER_MODULE');
  }
  if (!config.emergencyAdminTotpSecret || config.emergencyAdminTotpSecret.length < 32) {
    failures.push('EMERGENCY_ADMIN_TOTP_SECRET (base32, minimo 32 caracteres)');
  }
  Object.entries(config.retentionDays).forEach(([name, value]) => {
    if (!Number.isFinite(value)) failures.push(`RETENTION_${name.toUpperCase()}_DAYS`);
  });
  if (config.demoSeedEnabled) failures.push('DEMO_SEED_ENABLED debe estar desactivado');
  if (config.publicRegistrationEnabled) failures.push('PUBLIC_REGISTRATION_ENABLED debe estar desactivado');
  if (config.dataFile) failures.push('DATA_FILE no esta permitido');
  if (config.autoRunMigrations) failures.push('AUTO_RUN_MIGRATIONS debe estar desactivado');
  if (config.oidc.enabled && config.localAdultAuthEnabled) {
    failures.push('activa solo OIDC_ENABLED o LOCAL_ADULT_AUTH_ENABLED');
  }
  if (config.realDataPilotEnabled) {
    const approvals = config.pilotApprovals;
    if (!config.oidc.enabled) failures.push('OIDC_ENABLED=true');
    if (config.localAdultAuthEnabled) failures.push('LOCAL_ADULT_AUTH_ENABLED=false');
    if (config.dataKeyProvider === 'render-env-keyring') {
      failures.push('DATA_KEY_PROVIDER distinto de render-env-keyring para datos reales');
    }
    if (config.allowSharedDatabaseRole) failures.push('ALLOW_SHARED_DATABASE_ROLE=false');
    if (!approvals.dpia) failures.push('DPIA_APPROVAL_REFERENCE');
    if (!approvals.externalSecurityReview) failures.push('EXTERNAL_SECURITY_REVIEW_REFERENCE');
    if (!approvals.backupRestore) failures.push('BACKUP_RESTORE_EVIDENCE');
    if (!approvals.incidentProtocol) failures.push('INCIDENT_PROTOCOL_VERSION');
    if (!approvals.clinical) failures.push('CLINICAL_APPROVAL_REFERENCE');
  }

  if (failures.length > 0) {
    throw new Error(`Configuracion de production invalida: ${failures.join(', ')}.`);
  }
}

function buildEnv(source = process.env) {
  const appProfile = String(source.APP_PROFILE || 'demo').toLowerCase();
  if (!APP_PROFILES.has(appProfile)) {
    throw new Error('APP_PROFILE debe ser demo o production.');
  }

  const databaseSslMode = resolveDatabaseSslMode(source, appProfile);
  if (!DATABASE_SSL_MODES.has(databaseSslMode)) {
    throw new Error('DATABASE_SSL_MODE debe ser disable, require o verify-full.');
  }

  const nodeEnv = source.NODE_ENV || (appProfile === 'production' ? 'production' : 'development');
  const ephemeralSecret = crypto.randomBytes(32).toString('hex');
  const appOrigin = source.APP_ORIGIN
    || source.RENDER_EXTERNAL_URL
    || (appProfile === 'demo' ? 'http://localhost:3001' : '');
  const oidcRedirectUri = source.OIDC_REDIRECT_URI
    || (appOrigin ? `${appOrigin.replace(/\/$/, '')}/api/auth/oidc/callback` : '');
  const oidcClientId = source.OIDC_CLIENT_ID || '';
  const config = {
    appProfile,
    port: Number(source.PORT || 3001),
    nodeEnv,
    sessionSecret: source.SESSION_SECRET || (appProfile === 'demo' ? ephemeralSecret : ''),
    sessionIdleMinutes: readPositiveNumber(source.SESSION_IDLE_MINUTES, 30),
    sessionAbsoluteHours: readPositiveNumber(source.SESSION_ABSOLUTE_HOURS, 8),
    sessionCookieSecure: appProfile === 'production' || readBoolean(source.SESSION_COOKIE_SECURE),
    appOrigin: appOrigin || source.CORS_ORIGIN || '',
    corsOrigin: source.CORS_ORIGIN || appOrigin || 'http://localhost:3001',
    databaseUrl: source.DATABASE_URL || '',
    databaseSslMode,
    databaseSsl: databaseSslMode !== 'disable',
    databaseCa: source.DATABASE_CA || '',
    databasePoolMax: readPositiveNumber(source.DATABASE_POOL_MAX, 10),
    databaseConnectionTimeoutMs: readPositiveNumber(source.DATABASE_CONNECTION_TIMEOUT_MS, 5000),
    databaseIdleTimeoutMs: readPositiveNumber(source.DATABASE_IDLE_TIMEOUT_MS, 30000),
    databaseStatementTimeoutMs: readPositiveNumber(source.DATABASE_STATEMENT_TIMEOUT_MS, 15000),
    databaseIdleTransactionTimeoutMs: readPositiveNumber(source.DATABASE_IDLE_TRANSACTION_TIMEOUT_MS, 30000),
    dataFile: source.DATA_FILE || '',
    demoSeedEnabled: readBoolean(source.DEMO_SEED_ENABLED),
    publicRegistrationEnabled: readBoolean(source.PUBLIC_REGISTRATION_ENABLED, appProfile === 'demo'),
    autoRunMigrations: readBoolean(source.AUTO_RUN_MIGRATIONS),
    allowSharedDatabaseRole: readBoolean(source.ALLOW_SHARED_DATABASE_ROLE),
    localAdultAuthEnabled: readBoolean(source.LOCAL_ADULT_AUTH_ENABLED),
    questionnairePilotEnabled: readBoolean(source.QUESTIONNAIRE_PILOT_ENABLED),
    questionnaireDataKey: source.QUESTIONNAIRE_DATA_KEY || '',
    questionnaireDataKeyVersion: source.QUESTIONNAIRE_DATA_KEY_VERSION || 'v1',
    questionnaireSessionMaxMinutes: readPositiveNumber(source.QUESTIONNAIRE_SESSION_MAX_MINUTES, 120),
    dataKeyProvider: String(source.DATA_KEY_PROVIDER || '').toLowerCase(),
    dataKeyCurrentVersion: source.DATA_KEY_CURRENT_VERSION || '',
    dataKeyProviderModule: source.DATA_KEY_PROVIDER_MODULE || '',
    dataKeyringFile: source.DATA_KEYRING_FILE || '',
    dataKeyEnvironmentKeys: readVersionedDataKeys(source),
    emergencyAdminTotpSecret: source.EMERGENCY_ADMIN_TOTP_SECRET || '',
    realDataPilotEnabled: readBoolean(source.REAL_DATA_PILOT_ENABLED),
    pilotApprovals: {
      dpia: source.DPIA_APPROVAL_REFERENCE || '',
      externalSecurityReview: source.EXTERNAL_SECURITY_REVIEW_REFERENCE || '',
      backupRestore: source.BACKUP_RESTORE_EVIDENCE || '',
      incidentProtocol: source.INCIDENT_PROTOCOL_VERSION || '',
      clinical: source.CLINICAL_APPROVAL_REFERENCE || '',
    },
    trustProxy: source.TRUST_PROXY || '',
    oidc: {
      enabled: readBoolean(source.OIDC_ENABLED),
      issuer: source.OIDC_ISSUER || '',
      clientId: oidcClientId,
      clientSecret: source.OIDC_CLIENT_SECRET || '',
      audience: source.OIDC_AUDIENCE || oidcClientId,
      redirectUri: oidcRedirectUri,
      autoLinkVerifiedEmail: readBoolean(source.OIDC_AUTO_LINK_VERIFIED_EMAIL),
      mfaAcrValues: String(source.OIDC_MFA_ACR_VALUES || '')
        .split(',').map((value) => value.trim()).filter(Boolean),
    },
    retentionDays: {
      responses: readPositiveNumber(source.RETENTION_RESPONSES_DAYS, undefined),
      results: readPositiveNumber(source.RETENTION_RESULTS_DAYS, undefined),
      notifications: readPositiveNumber(source.RETENTION_NOTIFICATIONS_DAYS, undefined),
      sessions: readPositiveNumber(source.RETENTION_SESSIONS_DAYS, undefined),
      audit: readPositiveNumber(source.RETENTION_AUDIT_DAYS, undefined),
    },
  };

  assertProductionConfig(config);
  return Object.freeze(config);
}

const env = buildEnv();

module.exports = { env, buildEnv, assertProductionConfig };
