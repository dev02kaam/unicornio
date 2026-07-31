const test = require('node:test');
const assert = require('node:assert/strict');
const {
  acceptConsent,
  rejectConsent,
  revokeConsent,
} = require('../server/services/consents.service');
const { findUserById } = require('../server/services/users.service');

test('aceptar dos veces conserva una sola transición', () => {
  const family = findUserById('5');
  const first = acceptConsent('consent-1', family);
  const second = acceptConsent('consent-1', family);
  assert.equal(first.status, 'ACCEPTED');
  assert.equal(second.status, 'ACCEPTED');
  assert.equal(second.acceptedAt, first.acceptedAt);
});

test('rechazar y revocar son idempotentes en su estado final', () => {
  const familyNorth = findUserById('13');
  const firstReject = rejectConsent('consent-4', familyNorth);
  const secondReject = rejectConsent('consent-4', familyNorth);
  assert.equal(firstReject.status, 'REJECTED');
  assert.equal(secondReject.rejectedAt, firstReject.rejectedAt);

  const family = findUserById('8');
  const firstRevoke = revokeConsent('consent-2', 'Decisión familiar', family);
  const secondRevoke = revokeConsent('consent-2', 'Decisión familiar', family);
  assert.equal(firstRevoke.status, 'REVOKED');
  assert.equal(secondRevoke.revokedAt, firstRevoke.revokedAt);
});

