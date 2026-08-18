const { env } = require('./config/env');
const { database } = require('./config/database');
const { createApp } = require('./create-app');
const { createPostgresSessionStore } = require('./config/session');
const { initializeQuestionnaireModule } = require('./services/questionnaires.service');
const { loadConfiguredKeyProvider } = require('./services/key-provider-loader.service');

async function startServer() {
  await database.initialize();
  await loadConfiguredKeyProvider(env);
  await initializeQuestionnaireModule();

  const app = createApp({ sessionStore: createPostgresSessionStore(database.getPool()) });
  const server = app.listen(env.port, () => {
    console.log(`Proyecto Unicornio escuchando en http://localhost:${env.port}`);
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.on('clientError', (error, socket) => {
    if (!socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    if (env.nodeEnv !== 'test') console.warn(`Conexion HTTP rechazada: ${error.code || 'CLIENT_ERROR'}`);
  });

  return server;
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`No se pudo iniciar Proyecto Unicornio: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { startServer };
