const campaignList = document.getElementById('campaign-list');
const campaignListEmpty = document.getElementById('campaign-list-empty');
const campaignSearch = document.getElementById('campaign-search');
const campaignStatusFilter = document.getElementById('campaign-status-filter');
const campaignFilterSummary = document.getElementById('campaign-filter-summary');
const professionalSurface = document.getElementById('professional-surface');
const operationsSurface = document.getElementById('operations-surface');
const operationsList = document.getElementById('operations-list');
const pilotDisabled = document.getElementById('pilot-disabled');
const pilotDisabledMessage = document.getElementById('pilot-disabled-message');
const sessionEmpty = document.getElementById('session-empty');
const sessionMonitor = document.getElementById('session-monitor');
const campaignTitle = document.getElementById('campaign-title');
const campaignStatus = document.getElementById('campaign-status');
const campaignMeta = document.getElementById('campaign-meta');
const campaignActions = document.getElementById('campaign-actions');
const campaignTimeline = document.getElementById('campaign-timeline');
const orbitTotal = document.getElementById('orbit-total');
const sessionCounts = document.getElementById('session-counts');
const participantList = document.getElementById('participant-list');
const alertList = document.getElementById('alert-list');
const alertListEmpty = document.getElementById('alert-list-empty');
const alertAnnouncer = document.getElementById('alert-announcer');
const alertCount = document.getElementById('alert-count');
const lastRefresh = document.getElementById('last-refresh');
const notificationCount = document.getElementById('notification-count');
const newCampaignButton = document.getElementById('new-campaign-button');
const campaignDialog = document.getElementById('campaign-dialog');
const campaignForm = document.getElementById('campaign-form');
const campaignCenterSelect = document.getElementById('campaign-center-select');
const campaignGroupSelect = document.getElementById('campaign-group-select');
const campaignDateInput = document.getElementById('campaign-date-input');
const campaignFormStatus = document.getElementById('campaign-form-status');
const questionnaireAgeFilter = document.getElementById('questionnaire-age-filter');
const questionnaireCatalog = document.getElementById('questionnaire-catalog');
const campaignSummaryGroup = document.getElementById('campaign-summary-group');
const campaignSummaryCount = document.getElementById('campaign-summary-count');
const resultDialog = document.getElementById('result-dialog');
const resultDialogTitle = document.getElementById('result-dialog-title');
const resultContent = document.getElementById('result-content');
const alertActionDialog = document.getElementById('alert-action-dialog');
const alertActionForm = document.getElementById('alert-action-form');
const alertActionTitle = document.getElementById('alert-action-title');
const alertActionId = document.getElementById('alert-action-id');
const alertActionKind = document.getElementById('alert-action-kind');
const alertTransferTargetField = document.getElementById('alert-transfer-target-field');
const alertTransferTarget = document.getElementById('alert-transfer-target');
const alertTransferEmpty = document.getElementById('alert-transfer-empty');
const alertActionNoteLabel = document.getElementById('alert-action-note-label');
const alertActionNote = document.getElementById('alert-action-note');
const alertActionHelp = document.getElementById('alert-action-help');
const alertActionStatus = document.getElementById('alert-action-status');
const alertActionSubmit = document.getElementById('alert-action-submit');
const accountName = document.getElementById('account-name');

const campaignStatusMeta = {
  DRAFT: { label: 'Borrador', tone: 'neutral', stage: 0 },
  CONSENT_PENDING: { label: 'Consentimientos pendientes', tone: 'warning', stage: 0 },
  READY: { label: 'Preparada', tone: 'success', stage: 1 },
  LIVE: { label: 'En directo', tone: 'success', stage: 2 },
  CLOSED: { label: 'Cerrada', tone: 'neutral', stage: 3 },
  CANCELLED: { label: 'Cancelada', tone: 'danger', stage: 3 },
};

const participantStatusMeta = {
  AWAITING_CONSENT: { label: 'Esperando consentimiento', tone: 'warning' },
  AVAILABLE: { label: 'Disponible', tone: 'success' },
  IN_PROGRESS: { label: 'Respondiendo', tone: 'success' },
  SUBMITTED: { label: 'Enviado', tone: 'success' },
  HELP_REQUESTED: { label: 'Ha pedido ayuda', tone: 'danger' },
  INELIGIBLE: { label: 'No elegible', tone: 'neutral' },
  CANCELLED: { label: 'Bloqueado', tone: 'neutral' },
};

const state = {
  role: String(getTokenRole() || '').toUpperCase(),
  userId: getTokenSubject(),
  campaigns: [],
  groups: [],
  families: [],
  definitions: [],
  selectedDefinitionIds: new Set(),
  selectedCampaignId: null,
  monitor: null,
  alerts: [],
  alertSnapshot: null,
  pollingTimer: null,
  loadingMonitor: false,
  campaignSearch: '',
  campaignStatusFilter: 'active',
};

function escapeMarkup(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value, options = {}) {
  if (!value) {
    return 'Sin fecha';
  }
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: options.withTime ? 'medium' : 'long',
    ...(options.withTime ? { timeStyle: 'short' } : {}),
  }).format(new Date(value));
}

function initials(name) {
  return String(name || 'A')
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function showPilotDisabled(error) {
  clearInterval(state.pollingTimer);
  professionalSurface.hidden = true;
  operationsSurface.hidden = true;
  pilotDisabled.hidden = false;
  pilotDisabledMessage.textContent = getApiErrorMessage(error);
}

function handleApiError(error) {
  if (error?.status === 401) {
    clearToken();
    window.location.href = '/login.html';
    return true;
  }
  if (error?.status === 503) {
    showPilotDisabled(error);
    return true;
  }
  return false;
}

function setBodyReady() {
  window.UnicornioAppLoading?.markPageReady();
}

function closeDialog(dialog) {
  if (dialog?.open) {
    dialog.close();
  }
}

function campaignIsActive(campaign) {
  return !['CLOSED', 'CANCELLED'].includes(campaign.status);
}

function campaignMatchesStatus(campaign, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return campaignIsActive(campaign);
  if (filter === 'preparation') {
    return ['DRAFT', 'CONSENT_PENDING', 'READY'].includes(campaign.status);
  }
  if (filter === 'live') return campaign.status === 'LIVE';
  if (filter === 'finished') return ['CLOSED', 'CANCELLED'].includes(campaign.status);
  return true;
}

function normalizeCampaignSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
}

function filteredCampaigns() {
  const query = normalizeCampaignSearch(state.campaignSearch.trim());
  return state.campaigns.filter((campaign) => {
    if (!campaignMatchesStatus(campaign, state.campaignStatusFilter)) return false;
    if (!query) return true;
    const searchable = normalizeCampaignSearch([
      campaign.title,
      campaign.group?.name,
      campaignStatusMeta[campaign.status]?.label,
    ].filter(Boolean).join(' '));
    return searchable.includes(query);
  });
}

function renderCampaigns() {
  const visibleCampaigns = filteredCampaigns();
  campaignList.innerHTML = visibleCampaigns.map((campaign) => {
    const meta = campaignStatusMeta[campaign.status] || campaignStatusMeta.DRAFT;
    const current = campaign.id === state.selectedCampaignId;
    return `
      <button class="campaign-item" type="button" data-campaign-id="${escapeMarkup(campaign.id)}" aria-current="${current}">
        <span class="campaign-item__top">
          <strong>${escapeMarkup(campaign.title)}</strong>
          <span class="state-badge" data-tone="${meta.tone}">${escapeMarkup(meta.label)}</span>
        </span>
        <p>${escapeMarkup(campaign.group?.name || 'Grupo no disponible')} · ${escapeMarkup(formatDate(campaign.plannedFor))}</p>
      </button>
    `;
  }).join('');
  const total = state.campaigns.length;
  const visible = visibleCampaigns.length;
  campaignFilterSummary.textContent = total === 0
    ? ''
    : `${visible} de ${total} ${total === 1 ? 'campaña' : 'campañas'}`;
  campaignListEmpty.hidden = visible > 0;
  if (visible === 0) {
    campaignListEmpty.textContent = total === 0
      ? 'Aún no hay campañas. Crea la primera para un grupo asignado.'
      : 'No hay campañas que coincidan. Cambia el filtro o la búsqueda.';
  }
}

function renderOperations() {
  operationsList.innerHTML = state.campaigns.map((campaign) => {
    const meta = campaignStatusMeta[campaign.status] || campaignStatusMeta.DRAFT;
    return `
      <article class="operation-row">
        <div>
          <span class="eyebrow">${escapeMarkup(campaign.group?.name || 'Grupo')}</span>
          <h2>${escapeMarkup(campaign.title)}</h2>
        </div>
        <div>
          <span class="state-badge" data-tone="${meta.tone}">${escapeMarkup(meta.label)}</span>
          <p class="muted-line">${escapeMarkup(formatDate(campaign.plannedFor))}</p>
        </div>
        <span class="muted-line">Sin acceso a respuestas</span>
      </article>
    `;
  }).join('');
  if (state.campaigns.length === 0) {
    operationsList.innerHTML = '<p class="empty-copy">No hay campañas registradas en tu ámbito.</p>';
  }
}

function renderTimeline(status) {
  const currentStage = campaignStatusMeta[status]?.stage ?? 0;
  [...campaignTimeline.children].forEach((item, index) => {
    const complete = index < currentStage;
    const current = index === currentStage;
    item.classList.toggle('is-complete', complete);
    item.classList.toggle('is-current', current);
    item.dataset.stepState = current ? 'current' : complete ? 'complete' : 'pending';
    if (current) {
      item.setAttribute('aria-current', 'step');
    } else {
      item.removeAttribute('aria-current');
    }
  });
}

function renderCampaignActions(campaign) {
  if (String(campaign.createdByUserId) !== String(state.userId)) {
    campaignActions.innerHTML = '<span class="muted-line">Seguimiento recibido mediante transferencia profesional.</span>';
    return;
  }
  const actions = [];
  if (['CONSENT_PENDING', 'READY'].includes(campaign.status)) {
    actions.push('<button class="button secondary" type="button" data-campaign-action="consents">Actualizar consentimientos</button>');
  }
  if (['READY', 'CONSENT_PENDING'].includes(campaign.status)) {
    actions.push('<button class="button primary" type="button" data-campaign-action="open">Abrir sesión</button>');
  }
  if (['LIVE', 'READY', 'CONSENT_PENDING'].includes(campaign.status)) {
    actions.push('<button class="button secondary" type="button" data-campaign-action="close">Cerrar sesión</button>');
  }
  if (['DRAFT', 'CONSENT_PENDING', 'READY'].includes(campaign.status)) {
    actions.push('<button class="button secondary" type="button" data-campaign-action="cancel">Cancelar campaña</button>');
  }
  campaignActions.innerHTML = actions.join('');
}

function renderCounts(counts, total) {
  const ordered = [
    ['AWAITING_CONSENT', 'Sin consentimiento'],
    ['AVAILABLE', 'Disponibles'],
    ['IN_PROGRESS', 'Respondiendo'],
    ['SUBMITTED', 'Enviados'],
    ['HELP_REQUESTED', 'Piden ayuda'],
    ['INELIGIBLE', 'No elegibles'],
  ];
  orbitTotal.textContent = String(total);
  sessionCounts.innerHTML = ordered.map(([key, label]) => `
    <div><dt>${label}</dt><dd>${Number(counts[key] || 0)}</dd></div>
  `).join('');
}

function renderParticipants(participants) {
  if (participants.length === 0) {
    participantList.innerHTML = '<p class="empty-copy">Solicita los consentimientos para preparar a los participantes.</p>';
    return;
  }
  participantList.innerHTML = participants.map((participant) => {
    const meta = participantStatusMeta[participant.status] || { label: participant.status, tone: 'neutral' };
    const canReviewAnswers = ['SUBMITTED', 'HELP_REQUESTED'].includes(participant.status);
    const resultAction = canReviewAnswers
      ? `<button class="text-action" type="button" data-result-student="${escapeMarkup(participant.student.id)}">${participant.status === 'HELP_REQUESTED' ? 'Ver respuestas' : 'Revisar resultado'}</button>`
      : '<span class="muted-line">—</span>';
    const consent = participant.consentStatus
      ? `Consentimiento: ${participant.consentStatus === 'ACCEPTED' ? 'aceptado' : participant.consentStatus.toLowerCase()}`
      : (participant.ineligibleReason ? `Motivo: ${participant.ineligibleReason}` : 'Sin consentimiento');
    return `
      <article class="participant-row">
        <div class="participant-person">
          <span class="participant-avatar" aria-hidden="true">${escapeMarkup(initials(participant.student.name))}</span>
          <span>
            <strong>${escapeMarkup(participant.student.name)}</strong>
            <small>${escapeMarkup(participant.questionnaire?.title || 'Cuestionario')}${participant.questionnaire?.ageRange ? ` · ${escapeMarkup(participant.questionnaire.ageRange)} años` : ''}</small>
            <small>${escapeMarkup(consent)}</small>
          </span>
        </div>
        <span class="participant-state" data-tone="${meta.tone}">${escapeMarkup(meta.label)}</span>
        ${resultAction}
      </article>
    `;
  }).join('');
}

function alertTypeLabel(type) {
  return {
    MANUAL_HELP: 'Solicitud manual de ayuda',
    AUTOMATED_SENTINEL: 'Ítem centinela',
    AUTOMATED_RESULT: 'Resultado para revisión',
  }[type] || 'Alerta';
}

function alertSeverityLabel(severity) {
  return {
    RED: 'Prioridad crítica',
    ORANGE: 'Prioridad alta',
    YELLOW: 'Prioridad moderada',
  }[severity] || 'Prioridad pendiente de revisión';
}

function alertStatusLabel(status) {
  return {
    OPEN: 'Abierta',
    ACKNOWLEDGED: 'Recepción confirmada',
    RESOLVED: 'Resuelta',
    TRANSFERRED: 'Transferida',
  }[status] || status;
}

function renderAlerts() {
  alertCount.textContent = String(state.alerts.filter((alert) => alert.status !== 'RESOLVED').length);
  alertListEmpty.hidden = state.alerts.length > 0;
  const nextSnapshot = new Map(
    state.alerts.map((alert) => [alert.id, `${alert.status}:${alert.severity}`]),
  );
  if (state.alertSnapshot) {
    const newAlerts = state.alerts.filter((alert) => !state.alertSnapshot.has(alert.id));
    const updatedAlerts = state.alerts.filter(
      (alert) => state.alertSnapshot.has(alert.id)
        && state.alertSnapshot.get(alert.id) !== nextSnapshot.get(alert.id),
    );
    if (newAlerts.length > 0) {
      alertAnnouncer.textContent = newAlerts.length === 1
        ? `Nueva alerta de ${newAlerts[0].student.name}: ${alertSeverityLabel(newAlerts[0].severity)}.`
        : `${newAlerts.length} alertas nuevas en la campaña.`;
    } else if (updatedAlerts.length > 0) {
      alertAnnouncer.textContent = updatedAlerts.length === 1
        ? `Se ha actualizado la alerta de ${updatedAlerts[0].student.name}.`
        : `Se han actualizado ${updatedAlerts.length} alertas.`;
    }
  }
  state.alertSnapshot = nextSnapshot;
  alertList.innerHTML = state.alerts.map((alert) => {
    const canAct = alert.status !== 'RESOLVED';
    const severityLabel = alertSeverityLabel(alert.severity);
    const statusLabel = alertStatusLabel(alert.status);
    return `
      <article class="alert-item" data-severity="${escapeMarkup(alert.severity)}">
        <div class="alert-item__heading">
          <h3>${escapeMarkup(alert.student.name)}</h3>
          <span class="state-badge" data-tone="${alert.severity === 'RED' ? 'danger' : 'warning'}" aria-label="Estado: ${escapeMarkup(statusLabel)}">${escapeMarkup(statusLabel)}</span>
        </div>
        <p>${escapeMarkup(alertTypeLabel(alert.type))}. <strong>${escapeMarkup(severityLabel)}.</strong> Requiere valoración humana.</p>
        <time datetime="${escapeMarkup(alert.createdAt)}">${escapeMarkup(formatDate(alert.createdAt, { withTime: true }))}</time>
        ${canAct ? `
          <div class="alert-item__actions">
            ${['OPEN', 'TRANSFERRED'].includes(alert.status) ? `<button class="text-action" type="button" data-alert-ack="${escapeMarkup(alert.id)}">Confirmar recepción</button>` : ''}
            <button class="text-action" type="button" data-alert-action="resolve" data-alert-id="${escapeMarkup(alert.id)}">Resolver</button>
            <button class="text-action" type="button" data-alert-action="transfer" data-alert-id="${escapeMarkup(alert.id)}">Transferir</button>
          </div>
        ` : ''}
      </article>
    `;
  }).join('');
}

function renderMonitor() {
  const { campaign, participants, counts } = state.monitor;
  const meta = campaignStatusMeta[campaign.status] || campaignStatusMeta.DRAFT;
  sessionEmpty.hidden = true;
  sessionMonitor.hidden = false;
  campaignTitle.textContent = campaign.title;
  campaignStatus.textContent = meta.label;
  campaignStatus.dataset.tone = meta.tone;
  const questionnaireSummary = (campaign.questionnaires || []).map((item) => item.shortLabel).join(', ');
  campaignMeta.textContent = `${campaign.group?.name || 'Grupo'} · ${formatDate(campaign.plannedFor)}${questionnaireSummary ? ` · ${questionnaireSummary}` : ''}${campaign.liveExpiresAt ? ` · finaliza ${formatDate(campaign.liveExpiresAt, { withTime: true })}` : ''}`;
  renderTimeline(campaign.status);
  renderCampaignActions(campaign);
  renderCounts(counts, participants.length);
  renderParticipants(participants);
  renderAlerts();
  lastRefresh.textContent = `Actualizado a las ${new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(new Date())}`;
}

async function loadMonitor({ silent = false } = {}) {
  if (!state.selectedCampaignId || state.loadingMonitor) {
    return;
  }
  state.loadingMonitor = true;
  try {
    const [monitorResponse, alertsResponse] = await Promise.all([
      apiRequest(`/questionnaire-campaigns/${encodeURIComponent(state.selectedCampaignId)}/monitor`, {
        companionSilent: silent,
      }),
      apiRequest(`/questionnaire-campaigns/${encodeURIComponent(state.selectedCampaignId)}/alerts`, {
        companionSilent: silent,
      }),
    ]);
    state.monitor = monitorResponse.data;
    state.alerts = alertsResponse.data.alerts || [];
    renderMonitor();
  } catch (error) {
    if (!handleApiError(error) && !silent) {
      sessionEmpty.hidden = false;
      sessionMonitor.hidden = true;
      sessionEmpty.querySelector('p').textContent = getApiErrorMessage(error);
    }
  } finally {
    state.loadingMonitor = false;
  }
}

async function selectCampaign(campaignId) {
  if (state.selectedCampaignId !== campaignId) {
    state.alertSnapshot = null;
  }
  state.selectedCampaignId = campaignId;
  const url = new URL(window.location.href);
  url.searchParams.set('campaignId', campaignId);
  history.replaceState(null, '', url);
  renderCampaigns();
  await loadMonitor();
}

async function refreshCampaigns() {
  const response = await apiRequest('/questionnaire-campaigns');
  state.campaigns = response.data.campaigns || [];
  if (state.role === 'PROFESSIONAL') {
    renderCampaigns();
  } else {
    renderOperations();
  }
}

async function pollNotifications({ silent = false } = {}) {
  try {
    const response = await apiRequest('/notifications', { companionSilent: silent });
    const unread = (response.data.notifications || []).filter((item) => !item.isRead).length;
    notificationCount.textContent = String(unread);
    notificationCount.hidden = unread === 0;
  } catch (error) {
    if (error?.status === 401) {
      handleApiError(error);
    }
  }
}

function startPolling() {
  clearInterval(state.pollingTimer);
  state.pollingTimer = setInterval(() => {
    loadMonitor({ silent: true });
    pollNotifications({ silent: true });
  }, 5000);
}

function defaultLocalDateTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function assignmentCenter(assignment) {
  return assignment.center || {
    id: assignment.centerId || assignment.group?.centerId,
    name: assignment.centerName || 'Centro',
  };
}

function availableCenters() {
  const centers = new Map();
  state.groups.forEach((assignment) => {
    const center = assignmentCenter(assignment);
    if (center?.id) centers.set(center.id, center);
  });
  return [...centers.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function renderGroupOptions() {
  const centerId = campaignCenterSelect.value;
  const previousGroupId = campaignGroupSelect.value;
  const assignments = state.groups.filter((assignment) => (
    String(assignmentCenter(assignment)?.id || '') === String(centerId)
  ));
  campaignGroupSelect.innerHTML = assignments.map((assignment) => `
    <option value="${escapeMarkup(assignment.group?.id || assignment.groupId)}">
      ${escapeMarkup(assignment.group?.name || 'Grupo')}
    </option>
  `).join('');
  if (assignments.some((assignment) => (
    String(assignment.group?.id || assignment.groupId) === String(previousGroupId)
  ))) {
    campaignGroupSelect.value = previousGroupId;
  }
  updateCampaignGroupSummary();
}

function updateCampaignGroupSummary() {
  const selected = state.groups.find((assignment) => (
    String(assignment.group?.id || assignment.groupId) === String(campaignGroupSelect.value)
  ));
  campaignSummaryGroup.textContent = selected
    ? `${assignmentCenter(selected)?.name || 'Centro'} · ${selected.group?.name || 'Grupo'}`
    : 'Selecciona un grupo';
}

function definitionMatchesAgeFilter(definition, filter) {
  if (filter === 'all') return true;
  const [minimum, maximum] = filter.split('-').map(Number);
  return definition.ageMin <= maximum && definition.ageMax >= minimum;
}

function definitionsForFamily(familyKey, filter = 'all') {
  return state.definitions.filter((definition) => (
    definition.familyKey === familyKey
    && definitionMatchesAgeFilter(definition, filter)
  ));
}

function updateCatalogSummary() {
  const selectedDefinitions = state.definitions.filter(
    (definition) => state.selectedDefinitionIds.has(definition.id),
  );
  const areaCount = new Set(selectedDefinitions.map((definition) => definition.familyKey)).size;
  const bandCount = selectedDefinitions.length;
  const areaLabel = areaCount === 1 ? 'área' : 'áreas';
  const bandLabel = bandCount === 1 ? 'franja' : 'franjas';
  campaignSummaryCount.textContent = `${areaCount} ${areaLabel} · ${bandCount} ${bandLabel}`;
}

function renderQuestionnaireCatalog() {
  const filter = questionnaireAgeFilter.value || 'all';
  const families = state.families.filter(
    (family) => definitionsForFamily(family.key, filter).length > 0,
  );
  questionnaireCatalog.innerHTML = families.map((family) => {
    const definitions = definitionsForFamily(family.key, filter);
    const hasSelectedDefinition = definitions.some(
      (definition) => state.selectedDefinitionIds.has(definition.id),
    );
    const familyTitleId = `questionnaire-family-${family.key}`;
    return `
      <article class="questionnaire-catalog-item${hasSelectedDefinition ? ' is-selected' : ''}">
        <span class="questionnaire-catalog-item__copy">
          <strong id="${escapeMarkup(familyTitleId)}">${escapeMarkup(family.label)}</strong>
          <small>${escapeMarkup(family.description)}</small>
        </span>
        <div class="questionnaire-catalog-item__target">
          <span class="questionnaire-catalog-item__target-label">Seleccionar para</span>
          <div class="questionnaire-age-options" role="group" aria-labelledby="${escapeMarkup(familyTitleId)}">
            ${definitions.map((definition) => {
              const checked = state.selectedDefinitionIds.has(definition.id);
              return `
                <label class="questionnaire-age-option${checked ? ' is-selected' : ''}">
                  <input type="checkbox" name="questionnaireVersionId" value="${escapeMarkup(definition.id)}" ${checked ? 'checked' : ''} />
                  <span class="questionnaire-age-option__check" aria-hidden="true"></span>
                  <span>${escapeMarkup(`${definition.ageMin}–${definition.ageMax} años`)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      </article>
    `;
  }).join('');
  if (families.length === 0) {
    questionnaireCatalog.innerHTML = '<p class="empty-copy">No hay cuestionarios para ese intervalo de edad.</p>';
  }
  updateCatalogSummary();
}

function openCampaignDialog() {
  campaignFormStatus.textContent = '';
  campaignDateInput.value = defaultLocalDateTime();
  state.selectedDefinitionIds.clear();
  questionnaireAgeFilter.value = 'all';
  campaignCenterSelect.innerHTML = availableCenters().map((center) => `
    <option value="${escapeMarkup(center.id)}">${escapeMarkup(center.name)}</option>
  `).join('');
  renderGroupOptions();
  renderQuestionnaireCatalog();
  if (state.groups.length === 0) {
    campaignFormStatus.textContent = 'Necesitas estar asignado a un grupo antes de crear una campaña.';
  }
  campaignDialog.showModal();
}

async function submitCampaign(event) {
  event.preventDefault();
  if (state.groups.length === 0) {
    return;
  }
  if (state.selectedDefinitionIds.size === 0) {
    campaignFormStatus.textContent = 'Selecciona al menos una franja de edad.';
    questionnaireCatalog.focus({ preventScroll: false });
    return;
  }
  const submitButton = campaignForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  campaignFormStatus.textContent = 'Creando campaña…';
  try {
    const formData = new FormData(campaignForm);
    const response = await apiRequest('/questionnaire-campaigns', {
      method: 'POST',
      body: JSON.stringify({
        title: formData.get('title'),
        groupId: formData.get('groupId'),
        questionnaireVersionIds: [...state.selectedDefinitionIds],
        plannedFor: new Date(formData.get('plannedFor')).toISOString(),
      }),
    });
    closeDialog(campaignDialog);
    state.campaignSearch = '';
    state.campaignStatusFilter = 'active';
    campaignSearch.value = '';
    campaignStatusFilter.value = 'active';
    await refreshCampaigns();
    await selectCampaign(response.data.campaign.id);
  } catch (error) {
    if (!handleApiError(error)) {
      campaignFormStatus.textContent = getApiErrorMessage(error);
    }
  } finally {
    submitButton.disabled = false;
  }
}

async function runCampaignAction(action) {
  if (!state.selectedCampaignId) {
    return;
  }
  const paths = {
    consents: 'consents',
    open: 'open',
    close: 'close',
    cancel: 'cancel',
  };
  if (
    action === 'cancel'
    && !window.confirm('¿Cancelar esta campaña? Los alumnos que no hayan terminado quedarán bloqueados.')
  ) {
    return;
  }
  try {
    campaignActions.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
    await apiRequest(`/questionnaire-campaigns/${encodeURIComponent(state.selectedCampaignId)}/${paths[action]}`, {
      method: 'POST',
      body: '{}',
    });
    await refreshCampaigns();
    await loadMonitor();
  } catch (error) {
    if (!handleApiError(error)) {
      window.alert(getApiErrorMessage(error));
    }
  } finally {
    campaignActions.querySelectorAll('button').forEach((button) => {
      button.disabled = false;
    });
  }
}

async function showResult(studentId) {
  resultContent.innerHTML = '<p class="muted-line">Descifrando el resultado para revisión…</p>';
  resultDialog.showModal();
  try {
    const response = await apiRequest(
      `/questionnaire-campaigns/${encodeURIComponent(state.selectedCampaignId)}/results/${encodeURIComponent(studentId)}`,
    );
    const result = response.data.result;
    resultDialogTitle.textContent = result.student.name;
    resultContent.innerHTML = `
      <p>${escapeMarkup(result.disclaimer)}</p>
      <div class="student-result-list">
        ${(result.results || []).map((questionnaireResult) => {
          const completion = questionnaireResult.completion || {};
          const isHelpRequested = completion.status === 'HELP_REQUESTED'
            || questionnaireResult.attemptStatus === 'HELP_REQUESTED';
          const isPartial = completion.status === 'PARTIAL';
          const isUnscored = isHelpRequested || isPartial;
          const answers = questionnaireResult.answers || [];
          const answeredCount = Number(completion.answeredCount ?? answers.length);
          const totalQuestions = Number(completion.totalQuestions ?? answers.length);
          let completionStatus = 'complete';
          if (isHelpRequested) completionStatus = 'help-requested';
          else if (isPartial) completionStatus = 'partial';
          return `
          <section class="student-result-section" data-completion-status="${completionStatus}">
            <div class="student-result-section__heading">
              <div><span class="eyebrow">${escapeMarkup(questionnaireResult.ageRange)} años</span><h3>${escapeMarkup(questionnaireResult.questionnaireTitle)}</h3></div>
              ${isHelpRequested ? '<span class="state-badge" data-tone="danger">Ayuda solicitada</span>' : ''}
              ${!isHelpRequested && isPartial ? '<span class="state-badge" data-tone="neutral">Envío parcial</span>' : ''}
            </div>
            ${isHelpRequested ? `
              <p class="result-context-note">El alumno pidió ayuda antes de enviar. Se muestran las respuestas que quedaron guardadas hasta ese momento.</p>
            ` : ''}
            <div class="result-summary">
              ${isUnscored ? `
                <div><span class="eyebrow">${isHelpRequested ? 'Respuestas guardadas' : 'Respuestas'}</span><strong>${answeredCount} de ${totalQuestions}</strong></div>
                <div><span class="eyebrow">${isHelpRequested ? 'Puntuación' : 'Resultado'}</span><strong>${isHelpRequested ? 'Sin calcular' : 'Sin puntuar'}</strong></div>
              ` : `
                <div><span class="eyebrow">Puntuación</span><strong>${Number(questionnaireResult.totalScore)}</strong></div>
                <div><span class="eyebrow">Banda orientativa</span><strong>${escapeMarkup(questionnaireResult.band?.label || questionnaireResult.band?.key || 'Sin banda')}</strong></div>
              `}
            </div>
            ${(questionnaireResult.subscales || []).length ? `
              <div class="result-subscales" aria-label="Subescalas">
                ${questionnaireResult.subscales.map((subscale) => `<span><strong>${escapeMarkup(subscale.label || subscale.key)}</strong> ${Number(subscale.score)}</span>`).join('')}
              </div>
            ` : ''}
            <details${isHelpRequested ? ' open' : ''}>
              <summary>Ver respuestas (${answers.length})</summary>
              <div class="result-answer-list">
                ${answers.length ? answers.map((answer) => `
                    <div class="result-answer">
                      <strong>${Number(answer.questionNumber)}</strong>
                      <span>${escapeMarkup(answer.question)}</span>
                      <span>${escapeMarkup(answer.label)} (${Number(answer.points)})</span>
                    </div>
                  `).join('') : '<p class="result-answer-empty">No hay respuestas guardadas para revisar.</p>'}
              </div>
            </details>
          </section>
        `;
        }).join('')}
      </div>
    `;
  } catch (error) {
    resultContent.innerHTML = `<p class="inline-status">${escapeMarkup(getApiErrorMessage(error))}</p>`;
  }
}

function transferCandidateEntries(groupUsers) {
  return (groupUsers || [])
    .filter((entry) => (
      entry.user?.isActive !== false
      && String(entry.user?.role || '').toUpperCase() === 'PROFESSIONAL'
      && entry.assignment?.isActive !== false
      && String(entry.user?.id) !== String(state.userId)
    ))
    .sort((a, b) => a.user.name.localeCompare(b.user.name, 'es'));
}

async function loadAlertTransferTargets(alertId) {
  const groupId = state.monitor?.campaign?.group?.id;
  if (!groupId) {
    alertActionStatus.textContent = 'No se pudo identificar el grupo de la alerta.';
    return;
  }

  try {
    const response = await apiRequest(`/groups/${encodeURIComponent(groupId)}/users`);
    if (alertActionKind.value !== 'transfer' || alertActionId.value !== alertId) return;
    const candidates = transferCandidateEntries(response.data.users);
    alertTransferTarget.innerHTML = `
      <option value="">Selecciona un profesional</option>
      ${candidates.map((entry) => `
        <option value="${escapeMarkup(entry.user.id)}">${escapeMarkup(entry.user.name)}</option>
      `).join('')}
    `;
    const hasCandidates = candidates.length > 0;
    alertTransferTarget.disabled = !hasCandidates;
    alertActionSubmit.disabled = !hasCandidates;
    alertTransferEmpty.hidden = hasCandidates;
    alertTransferEmpty.textContent = hasCandidates
      ? ''
      : 'No hay otro profesional activo asignado a este grupo. El centro debe asignarlo antes de transferir la alerta.';
    if (hasCandidates) alertTransferTarget.focus();
  } catch (error) {
    if (alertActionKind.value !== 'transfer' || alertActionId.value !== alertId) return;
    alertTransferTarget.disabled = true;
    alertActionSubmit.disabled = true;
    alertActionStatus.textContent = getApiErrorMessage(error);
  }
}

function openAlertAction(kind, alertId) {
  alertActionId.value = alertId;
  alertActionKind.value = kind;
  alertActionNote.value = '';
  alertActionStatus.textContent = '';
  const isTransfer = kind === 'transfer';
  alertTransferTargetField.hidden = !isTransfer;
  alertTransferEmpty.hidden = true;
  alertTransferTarget.required = isTransfer;
  alertTransferTarget.disabled = isTransfer;
  alertTransferTarget.innerHTML = isTransfer
    ? '<option value="">Cargando profesionales…</option>'
    : '<option value="">Selecciona un profesional</option>';
  alertActionSubmit.disabled = isTransfer;
  alertActionTitle.textContent = isTransfer ? 'Transferir alerta' : 'Registrar actuación y resolver';
  alertActionNoteLabel.textContent = isTransfer ? 'Motivo y siguiente paso acordado' : 'Actuación y siguiente paso';
  alertActionHelp.textContent = isTransfer
    ? 'La persona seleccionada recibirá una notificación y asumirá el seguimiento de esta alerta.'
    : 'Describe la actuación realizada antes de cerrar la alerta.';
  alertActionSubmit.textContent = isTransfer ? 'Transferir alerta' : 'Resolver alerta';
  alertActionDialog.showModal();
  if (isTransfer) {
    loadAlertTransferTargets(alertId);
  } else {
    alertActionNote.focus();
  }
}

async function acknowledgeAlert(alertId) {
  try {
    await apiRequest(`/questionnaire-alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      body: '{}',
    });
    await loadMonitor();
  } catch (error) {
    window.alert(getApiErrorMessage(error));
  }
}

async function submitAlertAction(event) {
  event.preventDefault();
  const kind = alertActionKind.value;
  const id = alertActionId.value;
  const targetProfessionalId = alertTransferTarget.value;
  if (kind === 'transfer' && !targetProfessionalId) {
    alertActionStatus.textContent = 'Selecciona el profesional que continuará el seguimiento.';
    alertTransferTarget.focus();
    return;
  }
  alertActionSubmit.disabled = true;
  alertActionStatus.textContent = 'Guardando…';
  try {
    await apiRequest(`/questionnaire-alerts/${encodeURIComponent(id)}/${kind}`, {
      method: 'POST',
      body: JSON.stringify({
        ...(kind === 'transfer' ? { targetProfessionalId } : {}),
        note: alertActionNote.value,
      }),
    });
    closeDialog(alertActionDialog);
    await loadMonitor();
  } catch (error) {
    alertActionStatus.textContent = getApiErrorMessage(error);
  } finally {
    alertActionSubmit.disabled = false;
  }
}

async function initialize() {
  await sessionReady;
  state.role = String(getTokenRole() || '').toUpperCase();
  state.userId = getTokenSubject();
  if (!getToken() || !state.userId) {
    window.location.href = '/login.html';
    return;
  }
  if (!['PROFESSIONAL', 'ADMIN', 'SCHOOL'].includes(state.role)) {
    window.location.href = state.role === 'STUDENT' ? '/questionnaire.html' : '/dashboard.html';
    return;
  }

  try {
    const requests = [
      apiRequest(`/users/${encodeURIComponent(state.userId)}`),
      apiRequest('/questionnaire-campaigns'),
    ];
    if (state.role === 'PROFESSIONAL') {
      requests.push(apiRequest(`/users/${encodeURIComponent(state.userId)}/assignments`));
      requests.push(apiRequest('/questionnaire-definitions'));
    }
    const [userResponse, campaignResponse, assignmentsResponse, definitionsResponse] = await Promise.all(requests);
    accountName.textContent = userResponse.data.user.name;
    state.campaigns = campaignResponse.data.campaigns || [];

    if (state.role === 'PROFESSIONAL') {
      state.groups = assignmentsResponse?.data?.groups || [];
      state.families = definitionsResponse?.data?.families || [];
      state.definitions = definitionsResponse?.data?.definitions || [];
      professionalSurface.hidden = false;
      const requestedCampaign = new URLSearchParams(window.location.search).get('campaignId');
      const requested = state.campaigns.find((item) => item.id === requestedCampaign);
      if (requested && !campaignMatchesStatus(requested, state.campaignStatusFilter)) {
        state.campaignStatusFilter = 'all';
      } else if (state.campaigns.length > 0 && !state.campaigns.some(campaignIsActive)) {
        state.campaignStatusFilter = 'all';
      }
      campaignStatusFilter.value = state.campaignStatusFilter;
      renderCampaigns();
      const selected = requested || filteredCampaigns()[0] || state.campaigns[0];
      if (selected) {
        await selectCampaign(selected.id);
      }
      await pollNotifications({ silent: true });
      startPolling();
    } else {
      operationsSurface.hidden = false;
      renderOperations();
    }
  } catch (error) {
    if (!handleApiError(error)) {
      pilotDisabled.hidden = false;
      pilotDisabledMessage.textContent = getApiErrorMessage(error);
    }
  } finally {
    if (getToken()) setBodyReady();
  }
}

campaignList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-campaign-id]');
  if (button) {
    selectCampaign(button.dataset.campaignId);
  }
});

campaignActions?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-campaign-action]');
  if (button) {
    runCampaignAction(button.dataset.campaignAction);
  }
});

participantList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-result-student]');
  if (button) {
    showResult(button.dataset.resultStudent);
  }
});

alertList?.addEventListener('click', (event) => {
  const acknowledgeButton = event.target.closest('[data-alert-ack]');
  if (acknowledgeButton) {
    acknowledgeAlert(acknowledgeButton.dataset.alertAck);
    return;
  }
  const actionButton = event.target.closest('[data-alert-action]');
  if (actionButton) {
    openAlertAction(actionButton.dataset.alertAction, actionButton.dataset.alertId);
  }
});

newCampaignButton?.addEventListener('click', openCampaignDialog);
campaignSearch?.addEventListener('input', () => {
  state.campaignSearch = campaignSearch.value;
  renderCampaigns();
});
campaignStatusFilter?.addEventListener('change', async () => {
  state.campaignStatusFilter = campaignStatusFilter.value;
  const visibleCampaigns = filteredCampaigns();
  renderCampaigns();
  if (
    visibleCampaigns.length > 0
    && !visibleCampaigns.some((campaign) => campaign.id === state.selectedCampaignId)
  ) {
    await selectCampaign(visibleCampaigns[0].id);
  }
});
campaignForm?.addEventListener('submit', submitCampaign);
alertActionForm?.addEventListener('submit', submitAlertAction);
campaignCenterSelect?.addEventListener('change', renderGroupOptions);
campaignGroupSelect?.addEventListener('change', updateCampaignGroupSummary);
questionnaireAgeFilter?.addEventListener('change', renderQuestionnaireCatalog);
questionnaireCatalog?.addEventListener('change', (event) => {
  const input = event.target.closest('input[name="questionnaireVersionId"]');
  if (!input) return;
  if (input.checked) {
    state.selectedDefinitionIds.add(input.value);
  } else {
    state.selectedDefinitionIds.delete(input.value);
  }
  input.closest('.questionnaire-age-option')?.classList.toggle('is-selected', input.checked);
  const catalogItem = input.closest('.questionnaire-catalog-item');
  catalogItem?.classList.toggle(
    'is-selected',
    Boolean(catalogItem.querySelector('input[name="questionnaireVersionId"]:checked')),
  );
  updateCatalogSummary();
});

document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => closeDialog(button.closest('dialog')));
});

document.getElementById('logout-button')?.addEventListener('click', async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
});

window.addEventListener('beforeunload', () => clearInterval(state.pollingTimer));
initialize();
