const path = require('node:path');
const { env } = require('../config/env');
const {
  configureQuestionnaireKeyProvider,
  getQuestionnaireKeyProvider,
} = require('./questionnaire-crypto.service');

async function loadConfiguredKeyProvider(config = env) {
  if (config.appProfile !== 'production' && !config.dataKeyProviderModule) {
    try {
      return getQuestionnaireKeyProvider();
    } catch (_error) {
      return null;
    }
  }

  if (!path.isAbsolute(config.dataKeyProviderModule || '')) {
    throw new Error('DATA_KEY_PROVIDER_MODULE debe ser una ruta absoluta a un adaptador confiable.');
  }
  // El path absoluto se valida arriba y lo controla exclusivamente el despliegue.
  // eslint-disable-next-line security/detect-non-literal-require
  const adapter = require(config.dataKeyProviderModule);
  if (typeof adapter.createKeyProvider !== 'function') {
    throw new Error('El adaptador de claves debe exportar createKeyProvider().');
  }
  const provider = await adapter.createKeyProvider({
    provider: config.dataKeyProvider,
    currentVersion: config.dataKeyCurrentVersion,
  });
  configureQuestionnaireKeyProvider(provider);
  if (!provider.isReady?.() || provider.getCurrentVersion() !== config.dataKeyCurrentVersion) {
    throw new Error('El proveedor no ha cargado la version de clave esperada.');
  }
  return provider;
}

module.exports = { loadConfiguredKeyProvider };
