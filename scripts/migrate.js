const dotenv = require('dotenv');
const { Pool } = require('pg');
const { runMigrations } = require('../server/migrations');

dotenv.config();

function assertMigrationDatabaseIsolation(migrationUrl, applicationUrl) {
  if (!migrationUrl) {
    throw new Error('MIGRATION_DATABASE_URL es obligatoria.');
  }
  let parsed;
  try {
    parsed = new URL(migrationUrl);
  } catch (_error) {
    throw new Error('MIGRATION_DATABASE_URL no es una URL PostgreSQL valida.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('MIGRATION_DATABASE_URL debe usar el protocolo postgresql://.');
  }
  const placeholderUsers = new Set(['usuario_ddl', 'user', 'usuario', '<usuario_ddl>']);
  const placeholderPasswords = new Set(['clave', 'password', 'contraseña', '<clave>']);
  if (
    placeholderUsers.has(decodeURIComponent(parsed.username).toLowerCase())
    || placeholderPasswords.has(decodeURIComponent(parsed.password).toLowerCase())
  ) {
    throw new Error(
      'MIGRATION_DATABASE_URL contiene credenciales de ejemplo. Sustituye usuario_ddl y clave por credenciales PostgreSQL reales.',
    );
  }
  if (applicationUrl && migrationUrl === applicationUrl) {
    throw new Error('MIGRATION_DATABASE_URL debe ser distinta de DATABASE_URL y usar un rol DDL separado.');
  }
}

function formatMigrationError(error) {
  const pending = [error];
  const details = [];
  const visited = new Set();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    if (current.code) details.push(String(current.code));
    if (current.message) details.push(String(current.message));
    if (Array.isArray(current.errors)) pending.push(...current.errors);
    if (current.cause) pending.push(current.cause);
  }

  const safeDetails = [...new Set(details)]
    .join(' | ')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[DATABASE_URL]')
    .replace(/password\s*[=:]\s*[^\s|]+/gi, 'password=[REDACTED]');
  return safeDetails || 'Error PostgreSQL sin detalle. Comprueba host, puerto, base, usuario y permisos del rol DDL.';
}

async function migrate() {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL || '';
  assertMigrationDatabaseIsolation(migrationUrl, process.env.DATABASE_URL || '');

  const sslMode = String(process.env.MIGRATION_DATABASE_SSL_MODE || 'verify-full').toLowerCase();
  const ca = process.env.MIGRATION_DATABASE_CA || '';
  if (!['disable', 'verify-full'].includes(sslMode)) {
    throw new Error('MIGRATION_DATABASE_SSL_MODE debe ser disable o verify-full.');
  }
  if (sslMode === 'verify-full' && !ca) {
    throw new Error('MIGRATION_DATABASE_CA es obligatoria con TLS verify-full.');
  }

  const pool = new Pool({
    connectionString: migrationUrl,
    ssl: sslMode === 'verify-full'
      ? { rejectUnauthorized: true, ca: ca.replace(/\\n/g, '\n') }
      : false,
    max: 2,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 5000,
    statement_timeout: 60_000,
    idle_in_transaction_session_timeout: 30_000,
  });

  try {
    await runMigrations(pool);
    console.log('Migraciones aplicadas correctamente con el rol DDL.');
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(`No se pudieron aplicar las migraciones: ${formatMigrationError(error)}`);
    process.exitCode = 1;
  });
}

module.exports = { migrate, assertMigrationDatabaseIsolation, formatMigrationError };
