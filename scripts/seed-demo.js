const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

function assertSafeDemoDatabaseUrl(value) {
  if (!value) {
    throw new Error('Define DEMO_DATABASE_URL para una base PostgreSQL local y separada.');
  }

  const url = new URL(value);
  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  const databaseName = url.pathname.replace(/^\//, '');
  if (!localHosts.has(url.hostname) || !/(demo|test)/i.test(databaseName)) {
    throw new Error('DEMO_DATABASE_URL debe apuntar a localhost y a una base cuyo nombre incluya demo o test.');
  }

  return url.toString();
}

async function seedDemo() {
  if (String(process.env.APP_PROFILE || 'demo').toLowerCase() !== 'demo') {
    throw new Error('La semilla demo solo se permite con APP_PROFILE=demo.');
  }

  const connectionString = assertSafeDemoDatabaseUrl(process.env.DEMO_DATABASE_URL);
  const { ensureSchema, seedDemoCollections, seedDemoRelational } = require('../server/config/database');
  const pool = new Pool({
    connectionString,
    ssl: false,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
  });
  const client = await pool.connect();

  try {
    await client.query('begin');
    await ensureSchema(client);
    await seedDemoCollections(client);
    await seedDemoRelational(client);
    await client.query('commit');
    console.log('Semilla demo cargada en la base PostgreSQL local dedicada.');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemo().catch((error) => {
    console.error(`No se pudo cargar la semilla demo: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { assertSafeDemoDatabaseUrl, seedDemo };
