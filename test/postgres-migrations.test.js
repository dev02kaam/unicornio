const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { runMigrations, expectedMigrationIds } = require('../server/migrations');
const { getMissingMigrationIds } = require('../server/config/database');
const questionnaireCatalogMigration = require('../server/migrations/010-questionnaire-catalog-and-multi-assignment');

const testDatabaseUrl = process.env.QUESTIONNAIRE_TEST_DATABASE_URL;

test('el diagnostico de esquema enumera las migraciones pendientes sin consultar secretos', () => {
  assert.deepEqual(
    getMissingMigrationIds(
      ['001-first', '002-second', '003-third'],
      [{ id: '001-first' }, { id: '003-third' }],
    ),
    ['002-second'],
  );
});

test('la migración multicuestionario conserva datos y separa cada asignación por área', () => {
  assert.match(questionnaireCatalogMigration.sql, /insert into unicornio_questionnaire_campaign_families/i);
  assert.match(questionnaireCatalogMigration.sql, /set family_key = coalesce/i);
  assert.match(
    questionnaireCatalogMigration.sql,
    /on unicornio_questionnaire_participants \(campaign_id, student_id, family_key\)/i,
  );
  assert.ok(expectedMigrationIds.includes(questionnaireCatalogMigration.id));
});

test('las migraciones son repetibles en una base PostgreSQL exclusiva de pruebas', {
  skip: !testDatabaseUrl && 'Define QUESTIONNAIRE_TEST_DATABASE_URL para ejecutar esta prueba.',
}, async () => {
  assert.notEqual(
    testDatabaseUrl,
    process.env.DATABASE_URL,
    'La base de pruebas debe ser distinta de DATABASE_URL.',
  );
  const pool = new Pool({ connectionString: testDatabaseUrl });
  try {
    await runMigrations(pool);
    await runMigrations(pool);
    const result = await pool.query('select id from unicornio_migrations order by id');
    assert.deepEqual(
      result.rows.map((row) => row.id),
      [...expectedMigrationIds].sort(),
    );
  } finally {
    await pool.end();
  }
});
