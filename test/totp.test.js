const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTotp, verifyTotp } = require('../server/services/totp.service');

test('el administrador de emergencia exige un TOTP valido y tolera un paso de reloj', () => {
  const secret = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
  const now = Date.UTC(2026, 7, 5, 10, 0, 0);
  const code = generateTotp(secret, now);
  assert.match(code, /^\d{6}$/);
  assert.equal(verifyTotp(code, secret, now), true);
  assert.equal(verifyTotp(code, secret, now + 30_000), true);
  assert.equal(verifyTotp('000000', secret, now), false);
});
