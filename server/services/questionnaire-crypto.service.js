const crypto = require('node:crypto');
const { env } = require('../config/env');
const { StaticKeyProvider } = require('./key-provider.service');

let keyProvider = null;
const initialKey = Buffer.from(env.questionnaireDataKey || '', 'base64');
if (env.appProfile !== 'production' && initialKey.length === 32) {
  keyProvider = new StaticKeyProvider({
    currentVersion: env.questionnaireDataKeyVersion,
    keys: { [env.questionnaireDataKeyVersion]: initialKey },
  });
}

function configureQuestionnaireKeyProvider(provider) {
  if (!provider || typeof provider.getKey !== 'function' || typeof provider.getCurrentVersion !== 'function') {
    throw new Error('KeyProvider no valido.');
  }
  keyProvider = provider;
}

function getQuestionnaireKeyProvider() {
  if (!keyProvider || !keyProvider.isReady?.()) {
    throw new Error('El proveedor de claves clinicas no esta disponible.');
  }
  return keyProvider;
}

function serializeAad(aad) {
  if (!aad || !aad.table || !aad.recordId || !aad.field) {
    throw new Error('El AAD requiere tabla, registro y campo.');
  }
  return Buffer.from(JSON.stringify({
    table: String(aad.table),
    recordId: String(aad.recordId),
    field: String(aad.field),
    campaignId: aad.campaignId == null ? '' : String(aad.campaignId),
    studentId: aad.studentId == null ? '' : String(aad.studentId),
  }), 'utf8');
}

function encryptQuestionnairePayload(value, aad) {
  const provider = getQuestionnaireKeyProvider();
  const keyVersion = provider.getCurrentVersion();
  const iv = crypto.randomBytes(12);
  const aadBytes = serializeAad(aad);
  const cipher = crypto.createCipheriv('aes-256-gcm', provider.getKey(keyVersion), iv);
  cipher.setAAD(aadBytes);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    algorithm: 'aes-256-gcm',
    keyVersion,
    aadHash: crypto.createHash('sha256').update(aadBytes).digest('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
  });
}

function decryptQuestionnairePayload(payload, aad) {
  const envelope = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!envelope || envelope.algorithm !== 'aes-256-gcm' || typeof envelope.keyVersion !== 'string') {
    throw new Error('El contenido cifrado no tiene un formato compatible.');
  }

  const aadBytes = serializeAad(aad);
  const expectedAadHash = crypto.createHash('sha256').update(aadBytes).digest();
  const storedAadHash = Buffer.from(envelope.aadHash || '', 'base64');
  if (
    storedAadHash.length !== expectedAadHash.length
    || !crypto.timingSafeEqual(storedAadHash, expectedAadHash)
  ) {
    throw new Error('El contexto criptografico no coincide con el registro.');
  }

  const iv = Buffer.from(envelope.iv || '', 'base64');
  const tag = Buffer.from(envelope.tag || '', 'base64');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Envelope criptografico no valido.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getQuestionnaireKeyProvider().getKey(envelope.keyVersion),
    iv,
  );
  decipher.setAAD(aadBytes);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext || '', 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = {
  encryptQuestionnairePayload,
  decryptQuestionnairePayload,
  configureQuestionnaireKeyProvider,
  getQuestionnaireKeyProvider,
  serializeAad,
};
