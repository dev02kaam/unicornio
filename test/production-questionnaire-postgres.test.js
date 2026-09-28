const test = require('node:test');
const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');

test('production permite crear, consentir, responder y revisar con UUID publicos y RLS', {
  skip: !process.env.QUESTIONNAIRE_TEST_DATABASE_URL && 'Requiere PostgreSQL local exclusivo de pruebas.',
  timeout: 90_000,
}, async () => {
  assert.notEqual(process.env.QUESTIONNAIRE_TEST_DATABASE_URL, process.env.DATABASE_URL);
  const result = await promisify(execFile)(process.execPath, [
    path.join(__dirname, '..', 'scripts', 'check-production-questionnaires.js'),
  ], { windowsHide: true, timeout: 80_000 });
  assert.match(result.stdout, /Production questionnaire flow passed/);
});
