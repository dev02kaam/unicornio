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
const previousQuestionButton = document.getElementById('previous-question-button');
const nextQuestionButton = document.getElementById('next-question-button');
const helpButton = document.getElementById('help-button');
const helpDialog = document.getElementById('help-dialog');
const helpDialogStatus = document.getElementById('help-dialog-status');
const confirmHelpButton = document.getElementById('confirm-help-button');
const helpDeliveryWarning = document.getElementById('help-delivery-warning');
const retryHelpButton = document.getElementById('retry-help-button');
const helpViewMark = document.getElementById('help-view-mark');
const helpViewEyebrow = document.getElementById('help-view-eyebrow');
const studentSessionLabel = document.getElementById('student-session-label');
const studentPageSubtitle = document.getElementById('student-page-subtitle');
const previewNotice = document.getElementById('preview-notice');
const completionEyebrow = document.getElementById('completion-eyebrow');
const completionPrimaryAction = document.getElementById('completion-primary-action');
const completionSecondaryAction = document.getElementById('completion-secondary-action');
const helpDialogTitle = document.getElementById('help-dialog-title');
const helpDialogDescription = document.getElementById('help-dialog-description');
const studentLogoutButton = document.getElementById('student-logout-button');

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
  isPreview: false,
  previewAgeRange: null,
};

function escapeMarkup(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setBodyReady() {
  document.body.classList.remove('auth-pending');
}

function showOnly(element) {
  [studentGate, assignmentView, runnerView, completionView, helpView].forEach((view) => {
    view.hidden = view !== element;
  });
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

function renderQuestion() {
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
  questionText.focus?.();
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
    renderQuestion();
    setCompanionSupport();
  } catch (error) {
    if (!handleError(error)) {
      showGate(getApiErrorMessage(error));
    }
  }
}

async function startPreview(ageRange) {
  state.isPreview = true;
  state.previewAgeRange = ageRange;
  setBodyReady();
  document.body.classList.add('questionnaire-preview');
  studentSessionLabel.textContent = 'Modo de prueba';
  studentPageSubtitle.textContent = 'Recorre el cuestionario sin preparar una campaña. Nada de lo que marques saldrá de esta pestaña.';
  previewNotice.hidden = false;
  const companionAge = ageRange === '9-12' ? 10 : 14;
  window.UnicornioCompanion?.setAgeContext({
    birthDate: `${new Date().getFullYear() - companionAge}-01-01`,
  });
  setCompanionSupport();
  if (studentLogoutButton) {
    studentLogoutButton.hidden = !getToken();
  }

  try {
    const response = await apiRequest(`/questionnaire-preview/${encodeURIComponent(ageRange)}`);
    state.definition = response.data.definition;
    state.attempt = { id: `preview-${ageRange}` };
    state.answers = new Map();
    state.pendingAnswers = new Map();
    state.pendingSaves = new Map();
    state.currentIndex = 0;
    state.savePromise = Promise.resolve();

    helpDialogTitle.textContent = '¿Quieres pedir ayuda?';
    helpDialogDescription.textContent = 'En una sesión real, guardaríamos tus respuestas y avisaríamos al profesional para que pudiera escucharte. Esta prueba no enviará ningún aviso.';
    confirmHelpButton.textContent = 'Pedir ayuda';

    completionEyebrow.textContent = 'Prueba completada';
    completionPrimaryAction.textContent = 'Volver a empezar';
    completionPrimaryAction.href = `/questionnaire.html?preview=${encodeURIComponent(ageRange)}`;
    const otherRange = ageRange === '9-12' ? '13-16' : '9-12';
    completionSecondaryAction.textContent = `Probar ${otherRange} años`;
    completionSecondaryAction.href = `/questionnaire.html?preview=${encodeURIComponent(otherRange)}`;
    completionSecondaryAction.hidden = false;

    showOnly(runnerView);
    renderQuestion();
    setCompanionSupport();
  } catch (error) {
    previewNotice.hidden = true;
    showGate(getApiErrorMessage(error));
  }
}

function selectedValue() {
  return questionForm.querySelector('input[name="answer"]:checked')?.value || null;
}

function updateProgress() {
  const total = state.definition.questions.length;
  runnerProgressbar.setAttribute('aria-valuenow', String(state.answers.size));
  runnerProgressFill.style.transform = `scaleX(${state.answers.size / total})`;
}

function queueSave(questionNumber, value) {
  if (!value) {
    return state.savePromise;
  }
  if (state.isPreview) {
    state.answers.set(questionNumber, value);
    state.pendingAnswers.delete(questionNumber);
    updateProgress();
    runnerSaveStatus.textContent = 'Guardado solo en esta prueba';
    return Promise.resolve();
  }
  if (state.pendingAnswers.get(questionNumber) === value) {
    return state.pendingSaves.get(questionNumber) || state.savePromise;
  }
  if (state.answers.get(questionNumber) === value && !state.pendingAnswers.has(questionNumber)) {
    return state.savePromise;
  }

  state.pendingAnswers.set(questionNumber, value);
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
    renderQuestion();
    nextQuestionButton.disabled = false;
    return;
  }

  const firstMissing = state.definition.questions.findIndex(
    (question) => !state.answers.has(question.number),
  );
  if (firstMissing >= 0) {
    state.currentIndex = firstMissing;
    runnerSaveStatus.textContent = 'Completa las preguntas que faltan antes de enviar';
    renderQuestion();
    nextQuestionButton.disabled = false;
    return;
  }

  if (state.isPreview) {
    completionMessage.textContent = 'Has recorrido el cuestionario completo. Las respuestas de esta prueba no se han guardado, puntuado ni enviado.';
    showOnly(completionView);
    completionView.focus({ preventScroll: true });
    setCompanionSupport('¡Lo has conseguido! Me alegra haber estado contigo.', 'success', true);
    nextQuestionButton.disabled = false;
    return;
  }

  try {
    runnerSaveStatus.textContent = 'Enviando…';
    const response = await apiRequest(`/questionnaire-attempts/${encodeURIComponent(state.attempt.id)}/submit`, {
      method: 'POST',
      body: '{}',
    });
    completionMessage.textContent = response.data.message;
    showOnly(completionView);
    completionView.focus({ preventScroll: true });
    setCompanionSupport('¡Lo has conseguido! Me alegra haber estado contigo.', 'success', true);
  } catch (error) {
    if (!handleError(error)) {
      runnerSaveStatus.textContent = getApiErrorMessage(error);
    }
  } finally {
    nextQuestionButton.disabled = false;
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
  renderQuestion();
}

async function requestHelp() {
  confirmHelpButton.disabled = true;
  retryHelpButton.disabled = true;

  if (state.isPreview) {
    const question = state.definition.questions[state.currentIndex];
    const value = selectedValue();
    if (value) {
      await queueSave(question.number, value);
    }
    helpViewMark.textContent = '✓';
    helpViewEyebrow.textContent = 'Has pedido ayuda';
    helpViewMessage.textContent = 'No pasa nada. Pedir ayuda es muy valiente. En una sesión real, el profesional se haría cargo de escucharte y acompañarte.';
    helpDeliveryWarning.hidden = true;
    retryHelpButton.hidden = true;
    helpDialog.close();
    showOnly(helpView);
    setCompanionSupport(
      'Has sido muy valiente. Me quedo aquí contigo.',
      'reassuring',
      true,
    );
    confirmHelpButton.disabled = false;
    retryHelpButton.disabled = false;
    return;
  }
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
  const previewAgeRange = new URLSearchParams(window.location.search).get('preview');
  if (previewAgeRange) {
    await startPreview(previewAgeRange);
    return;
  }

  const role = String(getTokenRole() || '').toUpperCase();
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  if (role !== 'STUDENT') {
    window.location.href = role === 'PROFESSIONAL' ? '/questionnaires.html' : '/dashboard.html';
    return;
  }
  setBodyReady();
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

questionForm?.addEventListener('submit', submitCurrentQuestion);
previousQuestionButton?.addEventListener('click', goPrevious);
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
studentLogoutButton?.addEventListener('click', () => {
  clearToken();
  window.location.href = '/login.html';
});

initialize();
