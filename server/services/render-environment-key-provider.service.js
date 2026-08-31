const {
  parseKeyring,
} = require('./render-secret-file-key-provider.service');

async function createKeyProvider({ currentVersion, environmentKeys }) {
  if (!environmentKeys || typeof environmentKeys !== 'object' || Array.isArray(environmentKeys)) {
    throw new Error('Faltan las variables DATA_KEY_VN del keyring.');
  }
  return parseKeyring(JSON.stringify({ keys: environmentKeys }), currentVersion);
}

module.exports = { createKeyProvider };
