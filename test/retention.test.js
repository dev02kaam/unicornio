const test = require('node:test');
const assert = require('node:assert/strict');
const { assertRetentionConfiguration } = require('../server/services/retention.service');
const { assertRetentionDatabaseIsolation } = require('../scripts/run-retention');

test('retencion exige todos los plazos y un rol de mantenimiento separado', () => {
  assert.throws(() => assertRetentionConfiguration({ responses: 30 }), /retencion/i);
  assert.doesNotThrow(() => assertRetentionConfiguration({
    responses: 30, results: 90, notifications: 30, sessions: 1, audit: 730,
  }));
  assert.throws(
    () => assertRetentionDatabaseIsolation('postgres://app@localhost/db', 'postgres://app@localhost/db'),
    /distinto/i,
  );
  assert.doesNotThrow(
    () => assertRetentionDatabaseIsolation(
      'postgres://app@localhost/db',
      'postgres://app@localhost/db',
      true,
    ),
  );
});
