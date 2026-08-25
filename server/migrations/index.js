const questionnairePilot = require('./001-questionnaire-pilot');
const questionnaireAlertTransfer = require('./002-questionnaire-alert-transfer');
const questionnaireIdempotencyIndexes = require('./003-questionnaire-idempotency-indexes');
const relationalSecurityFoundation = require('./004-relational-security-foundation');
const alertOwnership = require('./005-alert-ownership');
const sensitiveDataAndImmutability = require('./006-sensitive-data-and-immutability');
const rlsRequestContext = require('./007-rls-request-context');
const persistentAbuseControls = require('./008-persistent-abuse-controls');
const emergencyAdmin = require('./009-emergency-admin');
const questionnaireCatalogAndMultiAssignment = require('./010-questionnaire-catalog-and-multi-assignment');
const questionnaireVersionTargeting = require('./011-questionnaire-version-targeting');
const questionnaireServiceWriteBoundary = require('./012-questionnaire-service-write-boundary');
const questionnaireResultUpsertPolicy = require('./013-questionnaire-result-upsert-policy');
const questionnaireAnswerProfessionalRead = require('./014-questionnaire-answer-professional-read');

const migrations = [
  questionnairePilot,
  questionnaireAlertTransfer,
  questionnaireIdempotencyIndexes,
  relationalSecurityFoundation,
  alertOwnership,
  sensitiveDataAndImmutability,
  rlsRequestContext,
  persistentAbuseControls,
  emergencyAdmin,
  questionnaireCatalogAndMultiAssignment,
  questionnaireVersionTargeting,
  questionnaireServiceWriteBoundary,
  questionnaireResultUpsertPolicy,
  questionnaireAnswerProfessionalRead,
];

const expectedMigrationIds = Object.freeze(migrations.map((migration) => migration.id));

async function runMigrations(pool) {
  await pool.query(`
    create table if not exists unicornio_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  for (const migration of migrations) {
    const existing = await pool.query(
      'select id from unicornio_migrations where id = $1',
      [migration.id],
    );
    if (existing.rowCount > 0) {
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(migration.sql);
      await client.query(
        'insert into unicornio_migrations (id) values ($1)',
        [migration.id],
      );
      await client.query('commit');
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { runMigrations, migrations, expectedMigrationIds };
