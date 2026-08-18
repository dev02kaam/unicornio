const test = require('node:test');
const assert = require('node:assert/strict');

const {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
  configureQuestionnaireKeyProvider,
} = require('../server/services/questionnaire-crypto.service');
const { StaticKeyProvider } = require('../server/services/key-provider.service');
const { needsRotation } = require('../server/services/data-key-rotation.service');
const { assertKeyMaintenanceIsolation } = require('../scripts/rotate-data-key');

const aad = {
  table: 'unicornio_questionnaire_answers',
  recordId: 'attempt-1:question-3',
  field: 'encrypted_payload',
  campaignId: 'campaign-1',
  studentId: 'student-1',
};

test('AES-256-GCM liga el contenido a fila, campo, campana y alumno mediante AAD', () => {
  configureQuestionnaireKeyProvider(new StaticKeyProvider({
    currentVersion: 'v1',
    keys: { v1: Buffer.alloc(32, 7) },
  }));
  const input = { questionNumber: 3, value: 'OFTEN', points: 2 };
  const encrypted = encryptQuestionnairePayload(input, aad);

  assert.doesNotMatch(encrypted, /OFTEN/);
  assert.deepEqual(decryptQuestionnairePayload(encrypted, aad), input);
  assert.throws(() => decryptQuestionnairePayload(encrypted, { ...aad, recordId: 'attempt-2:question-3' }));
});

test('el proveedor conserva claves historicas durante la rotacion', () => {
  const provider = new StaticKeyProvider({
    currentVersion: 'v1',
    keys: {
      v1: Buffer.alloc(32, 7),
      v2: Buffer.alloc(32, 8),
    },
  });
  configureQuestionnaireKeyProvider(provider);
  const encryptedV1 = encryptQuestionnairePayload({ totalScore: 24 }, aad);
  provider.setCurrentVersion('v2');
  const encryptedV2 = encryptQuestionnairePayload({ totalScore: 25 }, { ...aad, recordId: 'result-2' });

  assert.equal(JSON.parse(encryptedV1).keyVersion, 'v1');
  assert.equal(JSON.parse(encryptedV2).keyVersion, 'v2');
  assert.deepEqual(decryptQuestionnairePayload(encryptedV1, aad), { totalScore: 24 });
});

test('AES-256-GCM detecta una alteracion del ciphertext', () => {
  configureQuestionnaireKeyProvider(new StaticKeyProvider({
    currentVersion: 'v1',
    keys: { v1: Buffer.alloc(32, 7) },
  }));
  const envelope = JSON.parse(encryptQuestionnairePayload({ totalScore: 24 }, aad));
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  ciphertext[0] ^= 1;
  envelope.ciphertext = ciphertext.toString('base64');
  assert.throws(() => decryptQuestionnairePayload(envelope, aad));
});

test('la rotacion detecta envelopes historicos y exige un rol de mantenimiento', () => {
  assert.equal(needsRotation({ keyVersion: 'v1' }, 'v2'), true);
  assert.equal(needsRotation({ keyVersion: 'v2' }, 'v2'), false);
  assert.throws(
    () => assertKeyMaintenanceIsolation('postgres://app@localhost/db', 'postgres://app@localhost/db'),
    /mantenimiento distinto/i,
  );
});
