const dotenv = require('dotenv');
const { Pool } = require('pg');
const { buildEnv } = require('../server/config/env');
const { runRetention } = require('../server/services/retention.service');

dotenv.config();

function assertRetentionDatabaseIsolation(retentionUrl, applicationUrl) {
  if (!retentionUrl) throw new Error('RETENTION_DATABASE_URL es obligatoria.');
  if (applicationUrl && retentionUrl === applicationUrl) {
    throw new Error('RETENTION_DATABASE_URL debe usar un rol de mantenimiento distinto del rol de aplicacion.');
  }
}

async function main() {
  const retentionUrl = process.env.RETENTION_DATABASE_URL || '';
  assertRetentionDatabaseIsolation(retentionUrl, process.env.DATABASE_URL || '');
  const config = buildEnv(process.env);
  const sslMode = String(process.env.RETENTION_DATABASE_SSL_MODE || config.databaseSslMode).toLowerCase();
  const ca = process.env.RETENTION_DATABASE_CA || config.databaseCa;
  if (!['disable', 'verify-full'].includes(sslMode)) {
    throw new Error('RETENTION_DATABASE_SSL_MODE debe ser disable o verify-full.');
  }
  if (sslMode === 'verify-full' && !ca) throw new Error('RETENTION_DATABASE_CA es obligatoria.');

  const pool = new Pool({
    connectionString: retentionUrl,
    ssl: sslMode === 'verify-full' ? { rejectUnauthorized: true, ca: ca.replace(/\\n/g, '\n') } : false,
    max: 1,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    statement_timeout: 60_000,
    idle_in_transaction_session_timeout: 30_000,
  });
  const client = await pool.connect();
  try {
    const counts = await runRetention(client, config.retentionDays);
    console.log(JSON.stringify({ success: true, deletedRows: counts }));
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`No se pudo ejecutar la retencion: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { main, assertRetentionDatabaseIsolation };
