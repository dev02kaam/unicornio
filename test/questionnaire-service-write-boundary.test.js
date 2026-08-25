const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workspace = path.resolve(__dirname, '..');

function read(relativePath) {
  // Test-only paths are assembled from constants in this file.
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.readFileSync(path.join(workspace, relativePath), 'utf8');
}

test('la escritura privilegiada solo se activa dentro de la transaccion de cuestionarios', () => {
  const database = read('server/config/database.js');
  assert.match(database, /questionnaireTransaction\(callback\)/);
  assert.match(
    database,
    /set_config\('app\.questionnaire_service_write', 'on', true\)/,
  );
  assert.match(
    database,
    /runTransaction\(callback, \{ questionnaireServiceWrite: true \}\)/,
  );
});

test('respuestas centinela, envio y ayuda usan la frontera interna', () => {
  const service = read('server/services/questionnaires.service.js');
  const privilegedCalls = service.match(/database\.questionnaireTransaction/g) || [];
  assert.equal(privilegedCalls.length, 5);
  assert.match(service, /async function saveAnswer[\s\S]*?database\.questionnaireTransaction/);
  assert.match(service, /async function submitAttempt[\s\S]*?database\.questionnaireTransaction/);
  assert.match(service, /async function requestHelp[\s\S]*?database\.questionnaireTransaction/);
  assert.match(service, /async function transferAlert[\s\S]*?database\.questionnaireTransaction/);
});
