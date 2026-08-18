const test = require('node:test');
const assert = require('node:assert/strict');

const { beginOidcLogin, completeOidcLogin } = require('../server/services/oidc.service');

const config = {
  issuer: 'https://idp.example.test',
  clientId: 'unicornio-client',
  clientSecret: 'test-only',
  audience: 'unicornio-client',
  redirectUri: 'https://app.example.test/api/auth/oidc/callback',
  mfaAcrValues: ['urn:example:mfa'],
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

  assert.deepEqual(lookup, { issuer: config.issuer, subject: 'subject-123' });
  assert.equal(user.role, 'PROFESSIONAL');
  assert.equal(session.oidc, undefined);
});
