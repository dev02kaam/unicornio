const test = require('node:test');
const assert = require('node:assert/strict');
const { env } = require('../server/config/env');
const {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
} = require('../server/services/questionnaire-crypto.service');

env.questionnaireDataKey = Buffer.alloc(32, 7).toString('base64');
env.questionnaireDataKeyVersion = 'test-v1';

test('AES-256-GCM cifra y recupera el contenido sensible', () => {
  const input = { questionNumber: 3, value: 'OFTEN', points: 2 };
  const encrypted = encryptQuestionnairePayload(input);
  assert.doesNotMatch(encrypted, /OFTEN/);
  assert.deepEqual(decryptQuestionnairePayload(encrypted), input);
});

test('AES-256-GCM detecta una alteración del ciphertext', () => {
  const envelope = JSON.parse(encryptQuestionnairePayload({ totalScore: 24 }));
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
  ciphertext[0] ^= 1;
  envelope.ciphertext = ciphertext.toString('base64');
  assert.throws(() => decryptQuestionnairePayload(envelope));
});
