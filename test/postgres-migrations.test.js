const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { runMigrations } = require('../server/migrations');

const testDatabaseUrl = process.env.QUESTIONNAIRE_TEST_DATABASE_URL;

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
    const result = await pool.query(
      `select id from unicornio_migrations
       where id in (
         '001-questionnaire-pilot',
         '002-questionnaire-alert-transfer',
         '003-questionnaire-idempotency-indexes'
       )
       order by id`,
    );
    assert.deepEqual(
      result.rows.map((row) => row.id),
      [
        '001-questionnaire-pilot',
        '002-questionnaire-alert-transfer',
        '003-questionnaire-idempotency-indexes',
      ],
    );
  } finally {
    await pool.end();
  }
});
