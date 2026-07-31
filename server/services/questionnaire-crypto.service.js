const crypto = require('crypto');
const { env } = require('../config/env');

function getEncryptionKey() {
  const key = Buffer.from(env.questionnaireDataKey || '', 'base64');
  if (key.length !== 32) {
    throw new Error('QUESTIONNAIRE_DATA_KEY debe contener exactamente 32 bytes codificados en base64.');
  }
  return key;
}

function encryptQuestionnairePayload(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    algorithm: 'aes-256-gcm',
    keyVersion: env.questionnaireDataKeyVersion,
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  });
}

function decryptQuestionnairePayload(payload) {
  const envelope = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!envelope || envelope.algorithm !== 'aes-256-gcm') {
    throw new Error('El contenido cifrado no tiene un formato compatible.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(envelope.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
};
