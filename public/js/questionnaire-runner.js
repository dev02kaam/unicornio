const studentGate = document.getElementById('student-gate');
const studentGateMessage = document.getElementById('student-gate-message');
const assignmentView = document.getElementById('assignment-view');
const assignmentList = document.getElementById('assignment-list');
const assignmentEmpty = document.getElementById('assignment-empty');
const runnerView = document.getElementById('runner-view');
const completionView = document.getElementById('completion-view');
const completionMessage = document.getElementById('completion-message');
const helpView = document.getElementById('help-view');
const helpViewMessage = document.getElementById('help-view-message');
const questionForm = document.getElementById('question-form');
const questionText = document.getElementById('question-text');
const answerOptions = document.getElementById('answer-options');
const runnerQuestionCount = document.getElementById('runner-question-count');
const runnerSaveStatus = document.getElementById('runner-save-status');
const runnerProgressbar = document.getElementById('runner-progressbar');
const runnerProgressFill = document.getElementById('runner-progress-fill');
const questionIndex = document.getElementById('question-index');
const finishQuestionnaireButton = document.getElementById('finish-questionnaire-button');
const finishDialog = document.getElementById('finish-dialog');
const finishDialogSummary = document.getElementById('finish-dialog-summary');
const finishDialogNote = document.getElementById('finish-dialog-note');
const finishDialogStatus = document.getElementById('finish-dialog-status');
const confirmFinishButton = document.getElementById('confirm-finish-button');
const previousQuestionButton = document.getElementById('previous-question-button');
const nextQuestionButton = document.getElementById('next-question-button');
const questionCompanionIdleVideo = document.getElementById('question-companion-idle-video');
const questionCompanionVideo = document.getElementById('question-companion-video');
const questionCompanionAudio = document.getElementById('question-companion-audio');
const questionVideoLoader = document.getElementById('question-video-loader');
const replayQuestionButton = document.getElementById('replay-question-button');
const helpButton = document.getElementById('help-button');
const helpDialog = document.getElementById('help-dialog');
const helpDialogStatus = document.getElementById('help-dialog-status');
const confirmHelpButton = document.getElementById('confirm-help-button');
const helpDeliveryWarning = document.getElementById('help-delivery-warning');
const retryHelpButton = document.getElementById('retry-help-button');
const helpViewMark = document.getElementById('help-view-mark');
const helpViewEyebrow = document.getElementById('help-view-eyebrow');
const completionEyebrow = document.getElementById('completion-eyebrow');
const completionTitle = document.getElementById('completion-title');
const studentLogoutButton = document.getElementById('student-logout-button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const QUESTION_AUDIO_ASSETS = Object.freeze({
  orion: Object.freeze({
    'me cuesta disfrutar de las cosas que antes me gustaban': '/assets/companions/orion/question-depressive-mood.mp3',
    'tardo mucho en volver a calmarme cuando me altero': '/assets/companions/orion/question-anger-regulation.mp3',
  }),
  sol: Object.freeze({
    'me siento sola incluso rodeada de gente': '/assets/companions/sol/question-depressive-mood.mp3',
    'me siento solo/a incluso rodeado/a de gente': '/assets/companions/sol/question-depressive-mood.mp3',
    'siento una rabia que a veces no sé explicar': '/assets/companions/sol/question-anger-regulation.mp3',
  }),
});

const state = {
  assignments: [],
  attempt: null,
  definition: null,
  answers: new Map(),
  pendingAnswers: new Map(),
  pendingSaves: new Map(),
  currentIndex: 0,
  savePromise: Promise.resolve(),
  savingQuestion: null,
  questionVideoCharacterId: null,
  questionVideoMode: null,
  questionAudioAsset: '',
  questionPresentationId: 0,
};

function escapeMarkup(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeQuestionPrompt(value) {
  return String(value || '')
    .normalize('NFC')
    .trim()
    .toLocaleLowerCase('es-ES')
    .replace(/[.!?¡¿]+$/gu, '')
    .replace(/\s+/gu, ' ');
}

function questionAudioAsset(characterId, question) {
  const characterAssets = QUESTION_AUDIO_ASSETS[String(characterId || '').toLowerCase()];
  return characterAssets?.[normalizeQuestionPrompt(question?.text)] || '';
}

function setBodyReady({ immediate = false } = {}) {
  if (immediate) {
    window.UnicornioAppLoading?.revealImmediately();
    return;
  }
  window.UnicornioAppLoading?.markPageReady();
}

function showOnly(element) {
  [studentGate, assignmentView, runnerView, completionView, helpView].forEach((view) => {
    view.hidden = view !== element;
  });
  if (element !== runnerView) {
    state.questionPresentationId += 1;
    questionCompanionIdleVideo?.pause();
    questionCompanionVideo?.pause();
    questionCompanionAudio?.pause();
  }
  document.body.classList.toggle('questionnaire-running', element === runnerView);
}

function showGate(message) {
  studentGateMessage.textContent = message;
  showOnly(studentGate);
}

function setCompanionSupport(
  message = 'Estoy aquí contigo. Vamos paso a paso.',
  stateName = 'calm',
  announce = false,
) {
  window.UnicornioCompanion?.setState(stateName, {
    message,
    ttl: 0,
    announce,
    force: true,
  });
}

function handleError(error) {
  if (error?.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    return true;
  }
  if (error?.status === 503) {
    showGate(getApiErrorMessage(error));
    return true;
  }
  return false;
}

function assignmentStatusLabel(assignment) {
  if (assignment.status === 'SUBMITTED') {
    return 'Completado';
  }
  if (assignment.status === 'HELP_REQUESTED') {
    return 'Ayuda solicitada';
  }
  if (assignment.status === 'AWAITING_CONSENT') {
    return 'Esperando consentimiento familiar';
  }
  if (assignment.status === 'AVAILABLE' && assignment.campaignStatus !== 'LIVE') {
    return 'Preparado; espera a que se abra la sesión';
  }
  if (assignment.status === 'AVAILABLE') {
    return 'Disponible ahora';
  }
  if (assignment.status === 'IN_PROGRESS') {
    return 'Continuar';
  }
  if (assignment.status === 'INELIGIBLE') {
    return 'No disponible para tu edad';
  }
  return 'No disponible';
}

function renderAssignments() {
  showOnly(assignmentView);
  assignmentEmpty.hidden = state.assignments.length > 0;
  assignmentList.innerHTML = state.assignments.map((assignment) => {
    const actionable = assignment.campaignStatus === 'LIVE'
      && ['AVAILABLE', 'IN_PROGRESS'].includes(assignment.status);
    const requestedHelp = assignment.status === 'HELP_REQUESTED';
    return `
      <article class="assignment-item">
        <div>
          <span class="state-badge" data-tone="${actionable ? 'success' : (requestedHelp ? 'danger' : 'neutral')}">${escapeMarkup(assignmentStatusLabel(assignment))}</span>
          <h2>${escapeMarkup(assignment.title)}</h2>
          <p>${escapeMarkup(assignment.questionnaireTitle || 'Cuestionario experimental')} · ${escapeMarkup(assignment.ageRange || 'Edad no disponible')}</p>
        </div>
        ${actionable
          ? `<button class="button primary" type="button" data-start-participant="${escapeMarkup(assignment.id)}">${assignment.status === 'IN_PROGRESS' ? 'Continuar' : 'Empezar'}</button>`
          : (requestedHelp ? `<button class="button secondary" type="button" data-show-help>Ver aviso de ayuda</button>` : '')}
      </article>
    `;
  }).join('');
}

function setQuestionVideoLoading(isLoading) {
  questionVideoLoader.hidden = !isLoading;
  questionCompanionVideo.classList.toggle('is-loading', isLoading);
}

function setQuestionVideoMode(mode) {
  state.questionVideoMode = mode;
  questionCompanionIdleVideo.classList.toggle('is-active', mode === 'idle');
  questionCompanionVideo.classList.toggle('is-active', mode === 'speaking');
}

function resetMediaPlayback(media) {
  if (!media) return;
  media.pause();
  try {
    media.currentTime = 0;
  } catch (_error) {
    // El recurso puede seguir cargando; load() lo dejará preparado desde el inicio.
  }
}

function playQuestionIdle() {
  if (reducedMotion.matches) {
    questionCompanionIdleVideo.pause();
    if (questionCompanionIdleVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
      questionCompanionIdleVideo.currentTime = 0;
    }
    return;
  }
  questionCompanionIdleVideo.play().catch(() => {
    // El póster mantiene al compañero visible si el navegador bloquea la reproducción automática.
  });
}

function showQuestionIdle({ replay = Boolean(state.questionAudioAsset), invalidate = true } = {}) {
  if (invalidate) state.questionPresentationId += 1;
  setQuestionVideoLoading(false);
  resetMediaPlayback(questionCompanionVideo);
  resetMediaPlayback(questionCompanionAudio);
  setQuestionVideoMode('idle');
  replayQuestionButton.hidden = !replay;
  playQuestionIdle();
}

function syncQuestionMedia(question) {
  const character = window.UnicornioCompanion?.getCharacter?.() || { id: 'luna', name: 'Luna' };
  if (state.questionVideoCharacterId !== character.id) {
    state.questionVideoCharacterId = character.id;
    const characterAssetRoot = `/assets/companions/${encodeURIComponent(character.id)}`;
    questionCompanionIdleVideo.src = `${characterAssetRoot}/question-idle-transparent.webm`;
    questionCompanionIdleVideo.poster = `${characterAssetRoot}/question-idle-poster.webp`;
    questionCompanionVideo.src = `${characterAssetRoot}/question-speaking-transparent.webm`;
    questionCompanionVideo.poster = `${characterAssetRoot}/question-speaking-poster.webp`;
    questionCompanionVideo.setAttribute('aria-label', `${character.name} presenta la pregunta`);
    questionCompanionIdleVideo.load();
    questionCompanionVideo.load();
  }

  const audioAsset = questionAudioAsset(character.id, question);
  state.questionAudioAsset = audioAsset;
  if (questionCompanionAudio.getAttribute('src') !== audioAsset) {
    if (audioAsset) {
      questionCompanionAudio.src = audioAsset;
    } else {
      questionCompanionAudio.removeAttribute('src');
    }
    questionCompanionAudio.load();
  }
  replayQuestionButton.setAttribute(
    'aria-label',
    audioAsset ? `${character.name} vuelve a leer la pregunta` : 'Volver a escuchar la pregunta',
  );
  return audioAsset;
}

async function presentQuestion({ autoplay = true } = {}) {
  const question = state.definition?.questions?.[state.currentIndex];
  const audioAsset = syncQuestionMedia(question);
  const presentationId = state.questionPresentationId + 1;
  state.questionPresentationId = presentationId;
  resetMediaPlayback(questionCompanionVideo);
  resetMediaPlayback(questionCompanionAudio);

  if (!audioAsset) {
    showQuestionIdle({ replay: false, invalidate: false });
    return;
  }
  if (!autoplay) {
    showQuestionIdle({ replay: true, invalidate: false });
    return;
  }

  questionCompanionIdleVideo.pause();
  setQuestionVideoMode('speaking');
  replayQuestionButton.hidden = true;
  setQuestionVideoLoading(questionCompanionAudio.readyState < HTMLMediaElement.HAVE_FUTURE_DATA);
  try {
    await questionCompanionAudio.play();
    if (presentationId !== state.questionPresentationId) return;
    setQuestionVideoLoading(false);
    if (!reducedMotion.matches) {
      questionCompanionVideo.play().catch(() => {
        // El póster de lectura permanece visible si el vídeo no puede reproducirse.
      });
    }
  } catch (_error) {
    if (presentationId === state.questionPresentationId) {
      showQuestionIdle({ replay: true });
    }
  }
}

function renderQuestionIndex() {
  if (!state.definition) {
    questionIndex.innerHTML = '';
    return;
  }

  questionIndex.innerHTML = state.definition.questions.map((question, index) => {
    const answered = state.answers.has(question.number);
    const pending = state.pendingAnswers.has(question.number);
    const current = index === state.currentIndex;
    const states = [answered ? 'respondida' : 'sin responder'];
    if (pending) states.push('guardándose');
    if (current) states.push('actual');
    return `
      <button
        class="question-index__button${answered ? ' is-answered' : ''}${pending ? ' is-pending' : ''}${current ? ' is-current' : ''}"
        type="button"
        data-question-index="${index}"
        aria-label="Pregunta ${question.number}, ${states.join(', ')}"
        ${current ? 'aria-current="step"' : ''}
      >${question.number}</button>
    `;
  }).join('');
}

function renderQuestion({ autoplay = true } = {}) {
  const question = state.definition.questions[state.currentIndex];
  const total = state.definition.questions.length;
  const savedValue = state.pendingAnswers.get(question.number) ?? state.answers.get(question.number);
  questionText.textContent = question.text;
  runnerQuestionCount.textContent = `Pregunta ${state.currentIndex + 1} de ${total}`;
  runnerProgressbar.setAttribute('aria-valuemax', String(total));
  runnerProgressbar.setAttribute('aria-valuenow', String(state.answers.size));
  runnerProgressFill.style.transform = `scaleX(${state.answers.size / total})`;
  previousQuestionButton.disabled = state.currentIndex === 0;
  nextQuestionButton.textContent = state.currentIndex === total - 1 ? 'Enviar cuestionario' : 'Guardar y continuar';
  answerOptions.innerHTML = state.definition.responseScale.map((option) => `
    <label class="answer-choice">
      <input type="radio" name="answer" value="${escapeMarkup(option.value)}" ${savedValue === option.value ? 'checked' : ''} />
      <span>${escapeMarkup(option.label)}</span>
    </label>
  `).join('');
  renderQuestionIndex();
  questionText.focus?.();
  presentQuestion({ autoplay });
}

async function startAttempt(participantId) {
  try {
    const response = await apiRequest(`/questionnaire-participants/${encodeURIComponent(participantId)}/attempts`, {
      method: 'POST',
      body: '{}',
    });
    const data = response.data;
    state.attempt = data.attempt;
    state.definition = data.definition;
    state.answers = new Map((data.answers || []).map((answer) => [answer.questionNumber, answer.value]));
    state.pendingAnswers = new Map();
    state.pendingSaves = new Map();
    state.savePromise = Promise.resolve();
    const unansweredIndex = state.definition.questions.findIndex(
      (question) => !state.answers.has(question.number),
    );
    state.currentIndex = unansweredIndex >= 0 ? unansweredIndex : 0;
    showOnly(runnerView);
    renderQuestion({ autoplay: true });
    setCompanionSupport();
  } catch (error) {
    if (!handleError(error)) {
      showGate(getApiErrorMessage(error));
    }
  }
}

function selectedValue() {
  return questionForm.querySelector('input[name="answer"]:checked')?.value || null;
}

function updateProgress() {
  const total = state.definition.questions.length;
  runnerProgressbar.setAttribute('aria-valuenow', String(state.answers.size));
  runnerProgressFill.style.transform = `scaleX(${state.answers.size / total})`;
  renderQuestionIndex();
}

function queueSave(questionNumber, value) {
  if (!value) {
    return state.savePromise;
  }
  if (state.pendingAnswers.get(questionNumber) === value) {
    return state.pendingSaves.get(questionNumber) || state.savePromise;
  }
  if (state.answers.get(questionNumber) === value && !state.pendingAnswers.has(questionNumber)) {
    return state.savePromise;
  }

  state.pendingAnswers.set(questionNumber, value);
  renderQuestionIndex();
  runnerSaveStatus.textContent = 'Guardando…';
  state.savingQuestion = questionNumber;
  const operation = state.savePromise
    .then(() => apiRequest(`/questionnaire-attempts/${encodeURIComponent(state.attempt.id)}/answers`, {
      method: 'PUT',
      body: JSON.stringify({ questionNumber, value }),
    }))
    .then(() => {
      state.answers.set(questionNumber, value);
      if (state.pendingAnswers.get(questionNumber) === value) {
        state.pendingAnswers.delete(questionNumber);
      }
      updateProgress();
      runnerSaveStatus.textContent = 'Respuesta guardada';
    })
    .catch((error) => {
      if (state.pendingAnswers.get(questionNumber) === value) {
        state.pendingAnswers.delete(questionNumber);
      }
      runnerSaveStatus.textContent = 'No se pudo guardar';
      throw error;
    })
    .finally(() => {
      if (state.pendingSaves.get(questionNumber) === operation) {
        state.pendingSaves.delete(questionNumber);
      }
      state.savingQuestion = null;
      renderQuestionIndex();
    });
  state.pendingSaves.set(questionNumber, operation);
  state.savePromise = operation.catch(() => undefined);
  return operation;
}

async function saveCurrentAnswer() {
  const question = state.definition.questions[state.currentIndex];
  const value = selectedValue();
  if (!value) {
    runnerSaveStatus.textContent = 'Elige una respuesta para continuar';
    questionForm.querySelector('input[name="answer"]')?.focus();
    return false;
  }
  try {
    await queueSave(question.number, value);
    return true;
  } catch (error) {
    if (!handleError(error)) {
      runnerSaveStatus.textContent = getApiErrorMessage(error);
    }
    return false;
  }
}

function showCompletion(data) {
  const isComplete = data.isComplete !== false;
  completionEyebrow.textContent = isComplete ? 'Respuestas guardadas' : 'Respuestas enviadas';
  completionTitle.textContent = isComplete ? 'Has terminado' : 'Has terminado por ahora';
  completionMessage.textContent = data.message;
  questionCompanionIdleVideo.pause();
  questionCompanionVideo.pause();
  questionCompanionAudio.pause();
  showOnly(completionView);
  completionView.focus({ preventScroll: true });
  setCompanionSupport(
    isComplete
      ? '¡Lo has conseguido! Me alegra haber estado contigo.'
      : 'Lo que habías respondido ya está enviado. Has hecho bien en decidir terminar.',
    'success',
    true,
  );
}

async function sendAttempt() {
  return apiRequest(`/questionnaire-attempts/${encodeURIComponent(state.attempt.id)}/submit`, {
    method: 'POST',
    body: '{}',
  });
}

async function submitCurrentQuestion(event) {
  event.preventDefault();
  nextQuestionButton.disabled = true;
  const saved = await saveCurrentAnswer();
  if (!saved) {
    nextQuestionButton.disabled = false;
    return;
  }

  if (state.currentIndex < state.definition.questions.length - 1) {
    state.currentIndex += 1;
    renderQuestion({ autoplay: true });
    nextQuestionButton.disabled = false;
    return;
  }

  const firstMissing = state.definition.questions.findIndex(
    (question) => !state.answers.has(question.number),
  );
  if (firstMissing >= 0) {
    state.currentIndex = firstMissing;
    runnerSaveStatus.textContent = 'Completa las preguntas que faltan antes de enviar';
    renderQuestion({ autoplay: true });
    nextQuestionButton.disabled = false;
    return;
  }

  try {
    runnerSaveStatus.textContent = 'Enviando…';
    const response = await sendAttempt();
    showCompletion(response.data);
  } catch (error) {
    if (!handleError(error)) {
      runnerSaveStatus.textContent = getApiErrorMessage(error);
    }
  } finally {
    nextQuestionButton.disabled = false;
  }
}

async function openFinishDialog() {
  finishQuestionnaireButton.disabled = true;
  finishDialogStatus.textContent = '';
  try {
    await state.savePromise;
    const answeredCount = state.answers.size;
    const totalQuestions = state.definition.questions.length;
    const missingCount = Math.max(0, totalQuestions - answeredCount);
    finishDialogSummary.textContent = missingCount === 0
      ? `Has respondido las ${totalQuestions} preguntas.`
      : `Has respondido ${answeredCount} de ${totalQuestions} preguntas. Faltan ${missingCount}.`;
    finishDialogNote.hidden = missingCount === 0;
    confirmFinishButton.textContent = missingCount === 0
      ? 'Enviar cuestionario'
      : 'Enviar respuestas y terminar';
    finishDialog.showModal();
  } finally {
    finishQuestionnaireButton.disabled = false;
  }
}

async function finishQuestionnaire() {
  confirmFinishButton.disabled = true;
  finishDialogStatus.textContent = 'Enviando tus respuestas…';
  try {
    await state.savePromise;
    const response = await sendAttempt();
    finishDialog.close();
    showCompletion(response.data);
  } catch (error) {
    if (!handleError(error)) {
      finishDialogStatus.textContent = getApiErrorMessage(error);
    }
  } finally {
    confirmFinishButton.disabled = false;
  }
}

async function goPrevious() {
  if (state.currentIndex === 0) {
    return;
  }
  const value = selectedValue();
  if (value) {
    const question = state.definition.questions[state.currentIndex];
    try {
      await queueSave(question.number, value);
    } catch (_error) {
      return;
    }
  }
  state.currentIndex -= 1;
  renderQuestion({ autoplay: false });
}

async function requestHelp() {
  confirmHelpButton.disabled = true;
  retryHelpButton.disabled = true;

  helpDialogStatus.textContent = 'Guardando tus respuestas y avisando al profesional…';
  let saveError = null;
  try {
    const question = state.definition.questions[state.currentIndex];
    const value = selectedValue();
    if (value) {
      await queueSave(question.number, value);
    } else {
      await state.savePromise;
    }
  } catch (error) {
    saveError = error;
  }

  try {
    await apiRequest(`/questionnaire-attempts/${encodeURIComponent(state.attempt.id)}/help`, {
      method: 'POST',
      body: '{}',
    });
    helpViewMark.textContent = '✓';
    helpViewEyebrow.textContent = 'Has pedido ayuda';
    helpViewMessage.textContent = 'No pasa nada. Has hecho bien en contarlo. Ahora el profesional se hará cargo de escucharte y acompañarte.';
    helpDeliveryWarning.hidden = !saveError;
    helpDeliveryWarning.textContent = saveError
      ? 'El aviso se ha enviado, pero la última respuesta no pudo guardarse. El profesional podrá ayudarte igualmente.'
      : '';
    retryHelpButton.hidden = true;
    helpDialog.close();
    showOnly(helpView);
    setCompanionSupport(
      'Has sido muy valiente. Me quedo aquí contigo.',
      'reassuring',
      true,
    );
  } catch (_error) {
    helpViewMark.textContent = 'i';
    helpViewEyebrow.textContent = 'Seguimos contigo';
    helpViewMessage.textContent = 'No has hecho nada mal. Acércate al profesional que está contigo para que pueda escucharte.';
    helpDeliveryWarning.textContent = 'El aviso no ha podido salir. Puedes volver a pedir ayuda.';
    helpDeliveryWarning.hidden = false;
    retryHelpButton.hidden = false;
    helpDialog.close();
    showOnly(helpView);
    setCompanionSupport(
      'Me quedo contigo. Busca ahora a la persona que está cerca de ti.',
      'reassuring',
      true,
    );
  } finally {
    confirmHelpButton.disabled = false;
    retryHelpButton.disabled = false;
  }
}

async function initialize() {
  await sessionReady;

  const role = String(getTokenRole() || '').toUpperCase();
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  if (role !== 'STUDENT') {
    window.location.href = role === 'PROFESSIONAL' ? '/questionnaires.html' : '/dashboard.html';
    return;
  }
  try {
    const response = await apiRequest('/me/questionnaire-assignments');
    state.assignments = response.data.assignments || [];
    const participantId = new URLSearchParams(window.location.search).get('participantId');
    const requested = state.assignments.find((assignment) => assignment.id === participantId);
    if (requested && ['AVAILABLE', 'IN_PROGRESS'].includes(requested.status) && requested.campaignStatus === 'LIVE') {
      await startAttempt(requested.id);
    } else if (requested?.status === 'HELP_REQUESTED') {
      showOnly(helpView);
    } else {
      renderAssignments();
    }
  } catch (error) {
    if (!handleError(error)) {
      showGate(getApiErrorMessage(error));
    }
  } finally {
    if (getToken()) setBodyReady();
  }
}

assignmentList?.addEventListener('click', (event) => {
  const startButton = event.target.closest('[data-start-participant]');
  if (startButton) {
    startAttempt(startButton.dataset.startParticipant);
    return;
  }
  if (event.target.closest('[data-show-help]')) {
    showOnly(helpView);
  }
});

answerOptions?.addEventListener('change', () => {
  const question = state.definition.questions[state.currentIndex];
  queueSave(question.number, selectedValue()).catch((error) => {
    if (!handleError(error)) {
      runnerSaveStatus.textContent = getApiErrorMessage(error);
    }
  });
});

questionIndex?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-question-index]');
  if (!target) return;
  const nextIndex = Number(target.dataset.questionIndex);
  if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= state.definition.questions.length) {
    return;
  }
  state.currentIndex = nextIndex;
  renderQuestion({ autoplay: false });
});

questionCompanionVideo?.addEventListener('loadeddata', () => setQuestionVideoLoading(false));
questionCompanionVideo?.addEventListener('canplay', () => setQuestionVideoLoading(false));
questionCompanionVideo?.addEventListener('playing', () => {
  setQuestionVideoLoading(false);
  replayQuestionButton.hidden = true;
});
questionCompanionVideo?.addEventListener('waiting', () => {
  if (!questionCompanionVideo.paused) setQuestionVideoLoading(true);
});
questionCompanionVideo?.addEventListener('error', () => {
  setQuestionVideoLoading(false);
});
questionCompanionIdleVideo?.addEventListener('loadeddata', () => {
  if (state.questionVideoMode === 'idle') playQuestionIdle();
});
questionCompanionAudio?.addEventListener('playing', () => setQuestionVideoLoading(false));
questionCompanionAudio?.addEventListener('waiting', () => {
  if (!questionCompanionAudio.paused) setQuestionVideoLoading(true);
});
questionCompanionAudio?.addEventListener('ended', () => showQuestionIdle({ replay: true }));
questionCompanionAudio?.addEventListener('error', () => showQuestionIdle({ replay: false }));
replayQuestionButton?.addEventListener('click', () => presentQuestion({ autoplay: true }));

questionForm?.addEventListener('submit', submitCurrentQuestion);
previousQuestionButton?.addEventListener('click', goPrevious);
finishQuestionnaireButton?.addEventListener('click', openFinishDialog);
confirmFinishButton?.addEventListener('click', finishQuestionnaire);
helpButton?.addEventListener('click', () => {
  helpDialogStatus.textContent = '';
  setCompanionSupport(
    'Estoy contigo. Si quieres, pedimos ayuda juntos.',
    'listening',
    true,
  );
  helpDialog.showModal();
});
confirmHelpButton?.addEventListener('click', requestHelp);
retryHelpButton?.addEventListener('click', requestHelp);
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => {
    const dialog = button.closest('dialog');
    dialog?.close();
    if (dialog === helpDialog) {
      setCompanionSupport();
    }
  });
});
studentLogoutButton?.addEventListener('click', async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
});

initialize();
