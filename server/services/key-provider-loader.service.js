const path = require('node:path');
const { env } = require('../config/env');
const {
  configureQuestionnaireKeyProvider,
  getQuestionnaireKeyProvider,
} = require('./questionnaire-crypto.service');

async function loadConfiguredKeyProvider(config = env) {
  const usesRenderSecretFile = config.dataKeyProvider === 'render-secret-file';
  const usesRenderEnvironment = config.dataKeyProvider === 'render-env-keyring';
  const usesBuiltInProvider = usesRenderSecretFile || usesRenderEnvironment;
  if (config.appProfile !== 'production' && !config.dataKeyProviderModule && !usesBuiltInProvider) {
    try {
      return getQuestionnaireKeyProvider();
    } catch (_error) {
      return null;
    }
  }

  let adapter;
  if (usesRenderSecretFile) {
    adapter = require('./render-secret-file-key-provider.service');
  } else if (usesRenderEnvironment) {
    adapter = require('./render-environment-key-provider.service');
  } else {
    if (!path.isAbsolute(config.dataKeyProviderModule || '')) {
      throw new Error('DATA_KEY_PROVIDER_MODULE debe ser una ruta absoluta a un adaptador confiable.');
    }
    // El path absoluto se valida arriba y lo controla exclusivamente el despliegue.
    // eslint-disable-next-line security/detect-non-literal-require
    adapter = require(config.dataKeyProviderModule);
  }
  if (typeof adapter.createKeyProvider !== 'function') {
    throw new Error('El adaptador de claves debe exportar createKeyProvider().');
  }
  const provider = await adapter.createKeyProvider({
    provider: config.dataKeyProvider,
    currentVersion: config.dataKeyCurrentVersion,
    keyringFile: config.dataKeyringFile,
    environmentKeys: config.dataKeyEnvironmentKeys,
  });
  configureQuestionnaireKeyProvider(provider);
  if (!provider.isReady?.() || provider.getCurrentVersion() !== config.dataKeyCurrentVersion) {
    throw new Error('El proveedor no ha cargado la version de clave esperada.');
  }
  return provider;
}

module.exports = { loadConfiguredKeyProvider };
