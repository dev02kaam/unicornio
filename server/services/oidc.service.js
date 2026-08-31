const { AppError } = require('../utils/errors');
const oidcRepository = require('../repositories/oidc.repository');

const OIDC_ATTEMPT_TTL_MS = 10 * 60 * 1000;
let openIdModulePromise = null;
let configurationPromise = null;

async function getOpenIdModule() {
  if (!openIdModulePromise) openIdModulePromise = import('openid-client');
  return openIdModulePromise;
}

const defaultClient = {
  async getConfiguration(config) {
    if (!configurationPromise) {
      configurationPromise = getOpenIdModule().then((client) => client.discovery(
        new URL(config.issuer),
        config.clientId,
        config.clientSecret || undefined,
      ));
    }
    return configurationPromise;
  },
  async randomPKCECodeVerifier() {
    return (await getOpenIdModule()).randomPKCECodeVerifier();
  },
  async calculatePKCECodeChallenge(verifier) {
    return (await getOpenIdModule()).calculatePKCECodeChallenge(verifier);
  },
  async randomState() {
    return (await getOpenIdModule()).randomState();
  },
  async randomNonce() {
    return (await getOpenIdModule()).randomNonce();
  },
  async buildAuthorizationUrl(configuration, parameters) {
    return (await getOpenIdModule()).buildAuthorizationUrl(configuration, parameters);
  },
  async authorizationCodeGrant(configuration, currentUrl, checks) {
    return (await getOpenIdModule()).authorizationCodeGrant(configuration, currentUrl, checks);
  },
};

function assertOidcConfigured(config) {
  if (!config?.issuer || !config.clientId || !config.audience || !config.redirectUri) {
    throw new AppError('OIDC no esta configurado.', 503, null, 'SERVICE_UNAVAILABLE');
  }
}

async function beginOidcLogin(session, options = {}) {
  const config = options.config;
  const client = options.client || defaultClient;
  assertOidcConfigured(config);

  const configuration = await client.getConfiguration(config);
  const codeVerifier = await client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = await client.randomState();
  const nonce = await client.randomNonce();
  const startedAt = options.now ? options.now() : Date.now();

  session.oidc = { codeVerifier, state, nonce, startedAt };
  return client.buildAuthorizationUrl(configuration, {
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    acr_values: (config.mfaAcrValues || []).join(' '),
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
  });
}

function hasExactAudience(claims, expectedAudience) {
  if (typeof claims.aud === 'string') return claims.aud === expectedAudience;
  return Array.isArray(claims.aud)
    && claims.aud.length === 1
    && claims.aud[0] === expectedAudience;
}

function hasMfa(claims, allowedAcrValues) {
  const amr = Array.isArray(claims.amr) ? claims.amr.map((value) => String(value).toLowerCase()) : [];
  if (amr.some((value) => ['mfa', 'otp', 'hwk'].includes(value))) return true;
  return Boolean(claims.acr && allowedAcrValues.includes(String(claims.acr)));
}

async function completeOidcLogin(currentUrl, session, options = {}) {
  const config = options.config;
  const client = options.client || defaultClient;
  const repository = options.repository || oidcRepository;
  const now = options.now ? options.now() : Date.now();
  const attempt = session.oidc;
  delete session.oidc;

  assertOidcConfigured(config);
  if (!attempt || now - attempt.startedAt > OIDC_ATTEMPT_TTL_MS) {
    throw new AppError('El intento OIDC no es valido o ha caducado.', 401);
  }

  const configuration = await client.getConfiguration(config);
  const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
    pkceCodeVerifier: attempt.codeVerifier,
    expectedState: attempt.state,
    expectedNonce: attempt.nonce,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims || claims.iss !== config.issuer || !hasExactAudience(claims, config.audience)) {
    throw new AppError('La identidad OIDC no es valida.', 401);
  }
  if (!claims.sub || !hasMfa(claims, config.mfaAcrValues || [])) {
    throw new AppError('El proveedor no acredito MFA.', 403);
  }

  const user = await repository.findByOidcIdentity({
    issuer: claims.iss,
    subject: claims.sub,
    email: claims.email,
    emailVerified: claims.email_verified === true,
    allowAutoLink: config.autoLinkVerifiedEmail === true,
  });
  if (!user || !['SCHOOL', 'TEACHER', 'PROFESSIONAL'].includes(String(user.role).toUpperCase())) {
    throw new AppError('La identidad no esta provisionada.', 403);
  }
  return user;
}

module.exports = {
  OIDC_ATTEMPT_TTL_MS,
  beginOidcLogin,
  completeOidcLogin,
  hasExactAudience,
  hasMfa,
};
