const { Buffer } = require('node:buffer');

const {
  parseKeyring,
  MAX_KEYRING_BYTES,
} = require('./render-secret-file-key-provider.service');

async function createKeyProvider({ currentVersion, keyringJson }) {
  const contents = String(keyringJson || '').trim();
  const size = Buffer.byteLength(contents, 'utf8');
  if (size <= 0 || size > MAX_KEYRING_BYTES) {
    throw new Error('DATA_KEYRING_JSON es obligatorio y no puede superar 64 KiB.');
  }
  return parseKeyring(contents, currentVersion);
}

module.exports = { createKeyProvider };
