const fs = require('node:fs/promises');
const path = require('node:path');

const { StaticKeyProvider } = require('./key-provider.service');

const MAX_KEYRING_BYTES = 64 * 1024;

function decodeKey(version, encoded) {
  const value = String(encoded || '').trim();
  const key = Buffer.from(value, 'base64');
  if (!value || key.length !== 32 || key.toString('base64') !== value) {
    throw new Error(`La clave ${version} del keyring no es base64 canonico de 32 bytes.`);
  }
  return key;
}

function parseKeyring(contents, currentVersion) {
  let document;
  try {
    document = JSON.parse(contents);
  } catch (_error) {
    throw new Error('El keyring no contiene JSON valido.');
  }

  if (!document || Array.isArray(document) || typeof document.keys !== 'object' || !document.keys) {
    throw new Error('El keyring debe contener un objeto keys con claves versionadas.');
  }

  const keys = Object.fromEntries(
    Object.entries(document.keys).map(([version, encoded]) => [version, decodeKey(version, encoded)]),
  );
  return new StaticKeyProvider({ currentVersion, keys });
}

async function createKeyProvider({ currentVersion, keyringFile }) {
  if (!path.isAbsolute(keyringFile || '')) {
    throw new Error('DATA_KEYRING_FILE debe ser una ruta absoluta a un archivo secreto.');
  }

  // Ruta absoluta controlada por la configuracion privada del despliegue, no por una peticion.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const stat = await fs.stat(keyringFile);
  if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_KEYRING_BYTES) {
    throw new Error('El archivo secreto del keyring no es valido o supera 64 KiB.');
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const contents = await fs.readFile(keyringFile, 'utf8');
  return parseKeyring(contents, currentVersion);
}

module.exports = { createKeyProvider, parseKeyring, MAX_KEYRING_BYTES };
