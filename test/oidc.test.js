const test = require('node:test');
const assert = require('node:assert/strict');

const { beginOidcLogin, completeOidcLogin } = require('../server/services/oidc.service');
const oidcRepository = require('../server/repositories/oidc.repository');
const { database } = require('../server/config/database');

const config = {
  issuer: 'https://idp.example.test',
  clientId: 'unicornio-client',
  clientSecret: 'test-only',
  audience: 'unicornio-client',
  redirectUri: 'https://app.example.test/api/auth/oidc/callback',
  mfaAcrValues: ['http://schemas.openid.net/pape/policies/2007/06/multi-factor'],
  autoLinkVerifiedEmail: true,
};

test('OIDC start genera PKCE S256, state y nonce ligados a la sesion', async () => {
  const client = {
    async getConfiguration() { return {}; },
    randomPKCECodeVerifier() { return 'verifier-43-characters-long-aaaaaaaaaaaaaa'; },
    async calculatePKCECodeChallenge() { return 'challenge'; },
    randomState() { return 'state-value'; },
    randomNonce() { return 'nonce-value'; },
    buildAuthorizationUrl(_configuration, parameters) {
      return new URL(`https://idp.example.test/authorize?${new URLSearchParams(parameters)}`);
    },
  };
  const session = {};

  const url = await beginOidcLogin(session, { config, client, now: () => 1000 });
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('state'), 'state-value');
  assert.equal(url.searchParams.get('nonce'), 'nonce-value');
  assert.equal(url.searchParams.get('audience'), null);
  assert.equal(
    url.searchParams.get('acr_values'),
    'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
  );
  assert.equal(session.oidc.codeVerifier, 'verifier-43-characters-long-aaaaaaaaaaaaaa');
});

test('OIDC callback exige claims exactos, MFA y vincula por issuer mas subject', async () => {
  let lookup = null;
  const client = {
    async getConfiguration() { return {}; },
    async authorizationCodeGrant(_configuration, _url, checks) {
      assert.deepEqual(checks, {
        pkceCodeVerifier: 'verifier',
        expectedState: 'state',
        expectedNonce: 'nonce',
        idTokenExpected: true,
      });
      return {
        claims() {
          return {
            iss: config.issuer,
            aud: config.audience,
            sub: 'subject-123',
            email: 'adulto@example.test',
            email_verified: true,
            amr: ['pwd', 'mfa'],
          };
        },
      };
    },
  };
  const repository = {
    async findByOidcIdentity(identity) {
      lookup = identity;
      return { internalId: '00000000-0000-4000-8000-000000000001', role: 'PROFESSIONAL' };
    },
  };
  const session = { oidc: { codeVerifier: 'verifier', state: 'state', nonce: 'nonce', startedAt: 1000 } };

  const user = await completeOidcLogin(
    new URL('https://app.example.test/api/auth/oidc/callback?code=abc&state=state'),
    session,
    { config, client, repository, now: () => 2000 },
  );

  assert.deepEqual(lookup, {
    issuer: config.issuer,
    subject: 'subject-123',
    email: 'adulto@example.test',
    emailVerified: true,
    allowAutoLink: true,
  });
  assert.equal(user.role, 'PROFESSIONAL');
  assert.equal(session.oidc, undefined);
});

test('el primer acceso Auth0 vincula un unico adulto activo por correo verificado', async () => {
  const originalTransaction = database.transaction;
  const calls = [];
  database.transaction = async (callback) => callback({
    async query(sql, params) {
      calls.push({ sql, params });
      if (calls.length === 1) return { rows: [] };
      if (calls.length === 2) {
        return {
          rows: [{
            internal_id: '00000000-0000-4000-8000-000000000001',
            public_id: '00000000-0000-4000-8000-000000000002',
            email: 'adulto@example.test',
            name: 'Adulto',
            role: 'PROFESSIONAL',
            status: 'ACTIVE',
            session_version: 1,
          }],
        };
      }
      if (calls.length === 3) {
        return { rows: [{ user_id: '00000000-0000-4000-8000-000000000001' }] };
      }
      return { rows: [] };
    },
  });

  try {
    const user = await oidcRepository.findByOidcIdentity({
      issuer: 'https://tenant.eu.auth0.com/',
      subject: 'auth0|subject-123',
      email: 'Adulto@Example.test',
      emailVerified: true,
      allowAutoLink: true,
    });
    assert.equal(user.role, 'PROFESSIONAL');
    assert.equal(calls.length, 4);
    assert.match(calls[2].sql, /insert into unicornio_oidc_identities/i);
    assert.equal(calls[2].params[3], 'adulto@example.test');
  } finally {
    database.transaction = originalTransaction;
  }
});
