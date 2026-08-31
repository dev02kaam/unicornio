const dotenv = require('dotenv');
const { Pool } = require('pg');
const { buildEnv } = require('../server/config/env');
const { loadConfiguredKeyProvider } = require('../server/services/key-provider-loader.service');
const { rotateQuestionnaireData } = require('../server/services/data-key-rotation.service');

dotenv.config();

function assertKeyMaintenanceIsolation(maintenanceUrl, applicationUrl, allowSharedRole = false) {
  if (!maintenanceUrl) throw new Error('KEY_MAINTENANCE_DATABASE_URL es obligatoria.');
  if (!allowSharedRole && applicationUrl && maintenanceUrl === applicationUrl) {
    throw new Error('La rotacion requiere un rol de mantenimiento distinto del rol de aplicacion.');
  }
}

async function main() {
  const maintenanceUrl = process.env.KEY_MAINTENANCE_DATABASE_URL || '';
  const allowSharedRole = String(process.env.ALLOW_SHARED_DATABASE_ROLE || '').toLowerCase() === 'true';
  assertKeyMaintenanceIsolation(maintenanceUrl, process.env.DATABASE_URL || '', allowSharedRole);
  const config = buildEnv(process.env);
  const provider = await loadConfiguredKeyProvider(config);
  const pool = new Pool({
    connectionString: maintenanceUrl,
    ssl: config.databaseSslMode === 'verify-full'
      ? {
        rejectUnauthorized: true,
        ...(config.databaseCa ? { ca: config.databaseCa.replace(/\\n/g, '\n') } : {}),
      }
      : false,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    statement_timeout: 120_000,
    idle_in_transaction_session_timeout: 30_000,
  });
  const client = await pool.connect();
  try {
    const counts = await rotateQuestionnaireData(client, provider);
    console.log(JSON.stringify({ success: true, keyVersion: provider.getCurrentVersion(), rotatedRows: counts }));
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se pudo rotar la clave de datos: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, assertKeyMaintenanceIsolation };
