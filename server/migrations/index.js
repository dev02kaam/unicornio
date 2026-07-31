const questionnairePilot = require('./001-questionnaire-pilot');
const questionnaireAlertTransfer = require('./002-questionnaire-alert-transfer');
const questionnaireIdempotencyIndexes = require('./003-questionnaire-idempotency-indexes');

const migrations = [
  questionnairePilot,
  questionnaireAlertTransfer,
  questionnaireIdempotencyIndexes,
];

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

module.exports = { runMigrations };
