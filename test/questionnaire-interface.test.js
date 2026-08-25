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
  const companion = read('public/js/companion.js');
  const routes = read('server/routes/questionnaires.routes.js');
  assert.doesNotMatch(`${html}\n${runner}\n${routes}`, /questionnaire-preview|[?&]preview=/i);
  assert.match(html, /id="question-companion-video"/);
  assert.match(html, /id="question-companion-idle-video"/);
  assert.match(html, /id="question-companion-audio"/);
  assert.match(html, /id="question-companion-idle-video"[\s\S]*?loop/);
  assert.match(html, /Volver a escuchar la pregunta/);
  assert.match(companion, /querySelectorAll\('\[data-companion-image\]'\)/);
  assert.match(companion, /image\.setAttribute\('src', avatarAsset\)/);
  assert.match(html, /data-companion-avatar="static"/);
  assert.match(companion, /badge\.closest\('\[data-companion-avatar="static"\]'\)/);
  assert.match(companion, /image\.setAttribute\('src', getAvatarAsset\(character\)\)/);
  assert.match(html, /id="question-index"/);
  assert.match(html, /id="finish-questionnaire-button"/);
  assert.match(html, /id="finish-dialog"/);
  assert.match(runner, /data-question-index/);
  assert.match(runner, /state\.answers\.has\(question\.number\)/);
  assert.match(runner, /async function finishQuestionnaire\(\)/);
  assert.match(runner, /showCompletion\(response\.data\)/);
});

test('los cuatro compañeros tienen vídeos de pregunta, espera y sus pósteres preparados', () => {
  ['luna', 'nico', 'orion', 'sol'].forEach((character) => {
    const speakingVideo = path.join(
      workspace,
      'public',
      'assets',
      'companions',
      character,
      'question-speaking-transparent.webm',
    );
    const speakingPoster = path.join(path.dirname(speakingVideo), 'question-speaking-poster.webp');
    const idleVideo = path.join(path.dirname(speakingVideo), 'question-idle-transparent.webm');
    const idlePoster = path.join(path.dirname(speakingVideo), 'question-idle-poster.webp');
    // Test-only paths are assembled from the fixed character allowlist above.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(speakingVideo).size > 100_000, `${character} necesita un vídeo de lectura procesado`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(speakingPoster).size > 10_000, `${character} necesita un póster de lectura procesado`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(idleVideo).size > 100_000, `${character} necesita un vídeo de espera procesado`);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(idlePoster).size > 10_000, `${character} necesita un póster de espera procesado`);
  });
});

test('el vídeo de pregunta vuelve al idle al terminar de presentar', () => {
  const runner = read('public/js/questionnaire-runner.js');
  assert.match(runner, /question-idle-transparent\.webm/);
  assert.match(runner, /question-idle-poster\.webp/);
  assert.match(runner, /function showQuestionIdle\(/);
  assert.match(runner, /questionCompanionAudio\?\.addEventListener\('ended',[\s\S]*?showQuestionIdle/);
  assert.match(runner, /if \(!audioAsset\)[\s\S]*?showQuestionIdle\(\{ replay: false/);
  assert.match(runner, /if \(!reducedMotion\.matches\)[\s\S]*?questionCompanionVideo\.play\(\)/);
});

test('Orión y Sol leen las cuatro preguntas que tienen audio de prueba', () => {
  const runner = read('public/js/questionnaire-runner.js');
  const expectedAudio = [
    ['orion', 'question-depressive-mood.mp3'],
    ['orion', 'question-anger-regulation.mp3'],
    ['sol', 'question-depressive-mood.mp3'],
    ['sol', 'question-anger-regulation.mp3'],
  ];

  expectedAudio.forEach(([character, filename]) => {
    const audioPath = path.join(
      workspace,
      'public',
      'assets',
      'companions',
      character,
      filename,
    );
    // Test-only paths are assembled from the fixed character/filename allowlist above.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    assert.ok(fs.statSync(audioPath).size > 40_000, `${character} necesita ${filename}`);
  });

  assert.match(runner, /me cuesta disfrutar de las cosas que antes me gustaban/);
  assert.match(runner, /tardo mucho en volver a calmarme cuando me altero/);
  assert.match(runner, /me siento sola incluso rodeada de gente/);
  assert.match(runner, /siento una rabia que a veces no sé explicar/);
  assert.match(runner, /await questionCompanionAudio\.play\(\)/);
});

test('la creación profesional permite elegir cada franja de edad por separado', () => {
  const html = read('public/questionnaires.html');
  const client = read('public/js/questionnaires.js');
  assert.match(html, /id="questionnaire-catalog"/);
  assert.match(html, /Elige por separado las franjas de edad/);
  assert.match(client, /name="questionnaireVersionId"/);
  assert.match(client, /questionnaireVersionIds: \[\.\.\.state\.selectedDefinitionIds\]/);
  assert.match(client, /Selecciona al menos una franja de edad/);
});

test('la revision profesional distingue envios parciales sin mostrar una puntuacion falsa', () => {
  const client = read('public/js/questionnaires.js');
  assert.match(client, /completion\.status === 'PARTIAL'/);
  assert.match(client, /Envío parcial/);
  assert.match(client, /Sin puntuar/);
  assert.match(client, /Ver respuestas \(\$\{answers\.length\}\)/);
  assert.match(client, /No hay respuestas guardadas para revisar/);
});

test('los sondeos silenciosos no cambian continuamente el estado del compañero', () => {
  const api = read('public/js/api.js');
  const companion = read('public/js/companion.js');
  const questionnaires = read('public/js/questionnaires.js');
  const notifications = read('public/js/notifications.js');
  assert.match(api, /const \{ companionSilent = false, \.\.\.requestOptions \} = options/);
  assert.match(api, /companionSilent: Boolean\(companionSilent\)/);
  assert.match(companion, /if \(event\.detail\?\.companionSilent\) return/);
  assert.match(questionnaires, /companionSilent: silent/);
  assert.match(questionnaires, /pollNotifications\(\{ silent: true \}\)/);
  assert.match(notifications, /apiRequest\('\/notifications', \{ companionSilent: silent \}\)/);
});

test('la fase actual de la campaña queda resaltada y expuesta a lectores de pantalla', () => {
  const client = read('public/js/questionnaires.js');
  const css = read('public/css/questionnaires.css');
  assert.match(client, /classList\.toggle\('is-current', current\)/);
  assert.match(client, /setAttribute\('aria-current', 'step'\)/);
  assert.match(css, /\.campaign-timeline li\.is-current > span/);
  assert.match(css, /\.campaign-timeline li\.is-current strong/);
});

test('el historial de campañas se puede buscar y filtrar sin borrar su trazabilidad', () => {
  const html = read('public/questionnaires.html');
  const client = read('public/js/questionnaires.js');
  const css = read('public/css/questionnaires.css');
  assert.match(html, /id="campaign-search"/);
  assert.match(html, /id="campaign-status-filter"/);
  assert.match(html, /<option value="active" selected>Activas<\/option>/);
  assert.match(html, /<option value="finished">Finalizadas<\/option>/);
  assert.match(client, /function campaignMatchesStatus\(campaign, filter\)/);
  assert.match(client, /\['CLOSED', 'CANCELLED'\]\.includes\(campaign\.status\)/);
  assert.match(client, /function filteredCampaigns\(\)/);
  assert.match(client, /No hay campañas que coincidan/);
  assert.match(css, /\.campaign-list \{[\s\S]*?overflow-y: auto/);
});

test('una solicitud de ayuda permite revisar respuestas guardadas sin calcular puntuación', () => {
  const client = read('public/js/questionnaires.js');
  const service = read('server/services/questionnaires.service.js');
  assert.match(client, /\['SUBMITTED', 'HELP_REQUESTED'\]\.includes\(participant\.status\)/);
  assert.match(client, /Ayuda solicitada/);
  assert.match(client, /Respuestas guardadas/);
  assert.match(client, /Sin calcular/);
  assert.match(client, /<details\$\{isHelpRequested \? ' open' : ''\}>/);
  assert.match(service, /left join unicornio_questionnaire_results r on r\.attempt_id = a\.id/);
  assert.match(service, /\(r\.id is not null or a\.status = 'HELP_REQUESTED'\)/);
  assert.match(service, /status: row\.attempt_status === 'HELP_REQUESTED' \? 'HELP_REQUESTED' : 'COMPLETE'/);
});

test('la transferencia de alertas exige y envía un profesional de destino', () => {
  const html = read('public/questionnaires.html');
  const client = read('public/js/questionnaires.js');
  assert.match(html, /id="alert-transfer-target"/);
  assert.match(html, /id="alert-transfer-empty"/);
  assert.match(client, /apiRequest\(`\/groups\/\$\{encodeURIComponent\(groupId\)\}\/users`\)/);
  assert.match(client, /String\(entry\.user\?\.role \|\| ''\)\.toUpperCase\(\) === 'PROFESSIONAL'/);
  assert.match(client, /kind === 'transfer' \? \{ targetProfessionalId \} : \{\}/);
  assert.match(client, /recibirá una notificación y asumirá el seguimiento/);
});
