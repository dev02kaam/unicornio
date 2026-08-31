const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const { login } = require('../server/services/auth.service');

function createIdentity(role = 'PROFESSIONAL') {
  return {
    internalId: '00000000-0000-4000-8000-000000000001',
    id: 'professional-1',
    email: 'profesional@unicornio.local',
    name: 'Profesional local',
    role,
    isActive: true,
    passwordHash: bcrypt.hashSync('UnaFraseSegura-2026', 4),
    sessionVersion: 1,
  };
}

function createRepository(identity) {
  return {
    async findLocalUserByEmail() { return identity; },
    async replacePasswordHash() { return true; },
  };
}

test('production sin datos reales permite acceso adulto local', async () => {
  const identity = createIdentity();
  const result = await login(
    { email: identity.email, password: 'UnaFraseSegura-2026' },
    {
      config: {
        appProfile: 'production',
        realDataPilotEnabled: false,
        localAdultAuthEnabled: false,
      },
      repository: createRepository(identity),
    },
  );

  assert.equal(result.user.role, 'PROFESSIONAL');
  assert.equal(result.user.passwordHash, undefined);
  assert.equal(result.auth.internalId, identity.internalId);
});

test('el piloto con datos reales bloquea acceso adulto local', async () => {
  const identity = createIdentity('TEACHER');

  await assert.rejects(
    login(
      { email: identity.email, password: 'UnaFraseSegura-2026' },
      {
        config: {
          appProfile: 'production',
          realDataPilotEnabled: true,
          localAdultAuthEnabled: false,
        },
        repository: createRepository(identity),
      },
    ),
    (error) => error.statusCode === 401,
  );
});

test('production sin datos reales permite ADMIN sin codigo TOTP', async () => {
  const identity = createIdentity('ADMIN');
  const result = await login(
    { email: identity.email, password: 'UnaFraseSegura-2026' },
    {
      config: {
        appProfile: 'production',
        realDataPilotEnabled: false,
        localAdultAuthEnabled: false,
      },
      repository: createRepository(identity),
    },
  );

  assert.equal(result.user.role, 'ADMIN');
});

test('el piloto con datos reales mantiene TOTP para ADMIN', async () => {
  const identity = createIdentity('ADMIN');
  await assert.rejects(
    login(
      { email: identity.email, password: 'UnaFraseSegura-2026' },
      {
        config: {
          appProfile: 'production',
          realDataPilotEnabled: true,
          localAdultAuthEnabled: false,
          emergencyAdminTotpSecret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
        },
        repository: createRepository(identity),
      },
    ),
    (error) => error.statusCode === 401,
  );
});
