const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { runMigrations, expectedMigrationIds } = require('../server/migrations');
const { getMissingMigrationIds } = require('../server/config/database');
const questionnaireCatalogMigration = require('../server/migrations/010-questionnaire-catalog-and-multi-assignment');
const questionnaireVersionTargetingMigration = require('../server/migrations/011-questionnaire-version-targeting');
const questionnaireServiceWriteBoundaryMigration = require('../server/migrations/012-questionnaire-service-write-boundary');
const questionnaireResultUpsertPolicyMigration = require('../server/migrations/013-questionnaire-result-upsert-policy');
const questionnaireAnswerProfessionalReadMigration = require('../server/migrations/014-questionnaire-answer-professional-read');

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

test('la selección por edad persiste cada versión permitida y conserva campañas anteriores', () => {
  assert.match(
    questionnaireVersionTargetingMigration.sql,
    /create table if not exists unicornio_questionnaire_campaign_versions/i,
  );
  assert.match(
    questionnaireVersionTargetingMigration.sql,
    /join unicornio_questionnaire_versions v on v\.family_key = cf\.family_key/i,
  );
  assert.match(
    questionnaireVersionTargetingMigration.sql,
    /primary key \(campaign_id, questionnaire_version_id\)/i,
  );
  assert.ok(expectedMigrationIds.includes(questionnaireVersionTargetingMigration.id));
});

test('las escrituras internas del cuestionario conservan RLS para alumnos y profesionales', () => {
  assert.match(
    questionnaireServiceWriteBoundaryMigration.sql,
    /on unicornio_questionnaire_results for insert/i,
  );
  assert.match(
    questionnaireServiceWriteBoundaryMigration.sql,
    /on unicornio_questionnaire_alerts for all/i,
  );
  assert.match(
    questionnaireServiceWriteBoundaryMigration.sql,
    /on unicornio_notifications for all/i,
  );
  assert.match(
    questionnaireServiceWriteBoundaryMigration.sql,
    /current_setting\('app\.questionnaire_service_write', true\) = 'on'/i,
  );
  assert.ok(expectedMigrationIds.includes(questionnaireServiceWriteBoundaryMigration.id));
});

test('el resultado permite resolver el conflicto solo dentro de la transaccion interna', () => {
  assert.match(
    questionnaireResultUpsertPolicyMigration.sql,
    /on unicornio_questionnaire_results for all/i,
  );
  assert.match(
    questionnaireResultUpsertPolicyMigration.sql,
    /using\s*\(\s*current_setting\('app\.questionnaire_service_write', true\) = 'on'/i,
  );
  assert.match(
    questionnaireResultUpsertPolicyMigration.sql,
    /with check\s*\(\s*current_setting\('app\.questionnaire_service_write', true\) = 'on'/i,
  );
  assert.ok(expectedMigrationIds.includes(questionnaireResultUpsertPolicyMigration.id));
});

test('el profesional asignado puede leer respuestas sin obtener permisos de escritura', () => {
  assert.match(
    questionnaireAnswerProfessionalReadMigration.sql,
    /on unicornio_questionnaire_answers for select/i,
  );
  assert.match(
    questionnaireAnswerProfessionalReadMigration.sql,
    /ga\.role = 'PROFESSIONAL'/i,
  );
  assert.match(
    questionnaireAnswerProfessionalReadMigration.sql,
    /ga\.active_until is null/i,
  );
  assert.doesNotMatch(
    questionnaireAnswerProfessionalReadMigration.sql,
    /for all|for insert|for update|for delete/i,
  );
  assert.ok(expectedMigrationIds.includes(questionnaireAnswerProfessionalReadMigration.id));
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
