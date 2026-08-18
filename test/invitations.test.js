const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  issueInvitation,
  acceptInvitation,
  hashInvitationToken,
} = require('../server/services/invitations.service');

test('una invitacion expone 256 bits y persiste solo su hash durante 24 horas', async () => {
  let persisted = null;
  const repository = {
    async createInvitation(data) { persisted = data; return { id: 'invite-1' }; },
  };
  const now = new Date('2026-08-05T10:00:00.000Z');
  const random = Buffer.alloc(32, 9);

  const result = await issueInvitation({
    email: 'familia@example.test',
    role: 'FAMILY',
    studentUserId: '00000000-0000-4000-8000-000000000003',
  }, { id: '00000000-0000-4000-8000-000000000001' }, {
    repository,
    now: () => now,
    randomBytes: () => random,
  });

  assert.equal(Buffer.from(result.token, 'base64url').length, 32);
  assert.equal(persisted.token, undefined);
  assert.deepEqual(persisted.tokenHash, hashInvitationToken(result.token));
  assert.equal(persisted.expiresAt.toISOString(), '2026-08-06T10:00:00.000Z');
});

test('aceptar una invitacion delega un consumo atomico de uso unico', async () => {
  const consumedHashes = new Set();
  const repository = {
    async consumeInvitation(data) {
      const digest = data.tokenHash.toString('hex');
      if (consumedHashes.has(digest)) return null;
      consumedHashes.add(digest);
      return { id: crypto.randomUUID(), email: 'alumno@example.test', role: 'STUDENT' };
    },
  };
  const token = crypto.randomBytes(32).toString('base64url');
  const payload = { name: 'Alumno Seguro', password: 'UnaFraseSegura-2026' };

  const user = await acceptInvitation(token, payload, { repository });
  assert.equal(user.role, 'STUDENT');
  await assert.rejects(
    acceptInvitation(token, payload, { repository }),
    (error) => error.statusCode === 410,
  );
});
