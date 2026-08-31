const test = require('node:test');
const assert = require('node:assert/strict');

const migration = require('../server/migrations/004-relational-security-foundation');
const {
  assertMigrationDatabaseIsolation,
  formatMigrationError,
} = require('../scripts/migrate');

test('la migracion relacional incluye identidad, sesiones, invitaciones y auditoria', () => {
  const sql = migration.sql.toLowerCase();
  for (const table of [
    'unicornio_users',
    'unicornio_oidc_identities',
    'unicornio_centers',
    'unicornio_groups',
    'unicornio_center_assignments',
    'unicornio_group_assignments',
    'unicornio_family_links',
    'unicornio_invitations',
    'unicornio_consents',
    'unicornio_sessions',
    'unicornio_audit_events',
  ]) {
    assert.ok(sql.includes(`create table if not exists ${table}`));
  }
  assert.match(sql, /unique \(issuer, subject\)/);
  assert.match(sql, /token_hash bytea not null unique/);
  assert.match(sql, /check \(role in \(/);
  assert.match(sql, /alter table unicornio_consents force row level security/);
  assert.match(sql, /revoke update, delete on unicornio_audit_events/);
});

test('el ejecutor de migraciones exige una URL distinta de la aplicacion', () => {
  assert.throws(
    () => assertMigrationDatabaseIsolation('', 'postgresql://app/db'),
    /MIGRATION_DATABASE_URL/,
  );
  assert.throws(
    () => assertMigrationDatabaseIsolation('postgresql://app/db', 'postgresql://app/db'),
    /distinta de DATABASE_URL/,
  );
  assert.doesNotThrow(() => assertMigrationDatabaseIsolation(
    'postgresql://migration/db',
    'postgresql://app/db',
  ));
  assert.doesNotThrow(() => assertMigrationDatabaseIsolation(
    'postgresql://app/db',
    'postgresql://app/db',
    true,
  ));
});

test('el ejecutor rechaza marcadores de ejemplo y conserva errores utiles sin URLs', () => {
  assert.throws(
    () => assertMigrationDatabaseIsolation(
      'postgresql://usuario_ddl:clave@localhost/unicornio_demo',
      'postgresql://app:real@localhost/unicornio_demo',
    ),
    /credenciales de ejemplo/i,
  );

  const nested = new AggregateError([
    Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' }),
    new Error('fallo en postgresql://usuario:secreto@localhost/base'),
  ]);
  const formatted = formatMigrationError(nested);
  assert.match(formatted, /ECONNREFUSED/);
  assert.doesNotMatch(formatted, /usuario:secreto/);
});
