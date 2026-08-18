const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
  hashPassword,
  verifyPasswordHash,
} = require('../server/services/password.service');

test('las contrasenas nuevas usan los parametros Argon2id acordados', async () => {
  const passwordHash = await hashPassword('UnaFraseSegura-2026');

  assert.match(passwordHash, /^\$argon2id\$v=19\$/);
  assert.match(passwordHash, /\$m=19456,p=1,t=2\$/);
  assert.deepEqual(
    await verifyPasswordHash('UnaFraseSegura-2026', passwordHash),
    { valid: true, needsUpgrade: false },
  );
});

test('un hash bcrypt valido se marca para migracion transparente', async () => {
  const legacyHash = bcrypt.hashSync('Legacy-Password-2026', 10);
  assert.deepEqual(
    await verifyPasswordHash('Legacy-Password-2026', legacyHash),
    { valid: true, needsUpgrade: true },
  );
});
