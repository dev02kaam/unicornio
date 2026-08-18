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

test('el recorrido del alumno no conserva accesos de previsualización sin consentimiento', () => {
  const html = read('public/questionnaire.html');
  const runner = read('public/js/questionnaire-runner.js');
  const routes = read('server/routes/questionnaires.routes.js');
  assert.doesNotMatch(`${html}\n${runner}\n${routes}`, /questionnaire-preview|[?&]preview=/i);
  assert.match(html, /id="question-companion-video"/);
  assert.match(html, /Volver a escuchar la pregunta/);
});

test('los cuatro compañeros tienen vídeo de pregunta y póster preparados', () => {
  ['luna', 'nico', 'orion', 'sol'].forEach((character) => {
    const video = path.join(
      workspace,
      'public',
      'assets',
      'companions',
      character,
      'question-speaking-transparent.webm',
    );
    const poster = path.join(path.dirname(video), 'question-speaking-poster.webp');
    // Test-only paths are assembled from the fixed character allowlist above.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(video).size > 100_000, `${character} necesita un vídeo procesado`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(poster).size > 10_000, `${character} necesita un póster procesado`);
  });
});

test('la creación profesional exige uno o varios cuestionarios', () => {
  const html = read('public/questionnaires.html');
  const client = read('public/js/questionnaires.js');
  assert.match(html, /id="questionnaire-catalog"/);
  assert.match(client, /familyKeys: \[\.\.\.state\.selectedFamilyKeys\]/);
  assert.match(client, /Selecciona al menos un cuestionario/);
});
