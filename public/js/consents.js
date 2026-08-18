const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const consentsList = document.getElementById('consents-list');
const consentsSummaryTitle = document.getElementById('consents-summary-title');
const consentsSummaryText = document.getElementById('consents-summary-text');
const consentsCountPending = document.getElementById('consents-count-pending');
const consentsCountAccepted = document.getElementById('consents-count-accepted');
const consentsCountOther = document.getElementById('consents-count-other');
const consentsStatusBanner = document.getElementById('consents-status-banner');
const reloadConsentsButton = document.getElementById('reload-consents-button');
const consentsLegalLink = document.getElementById('consents-legal-link');
const revokeConsentForm = document.getElementById('revoke-consent-form');
const revokeConsentModal = document.getElementById('revoke-consent-modal');
const revokeConsentIdField = revokeConsentForm?.querySelector('[name="consentId"]');
const revokeReasonField = revokeConsentForm?.querySelector('[name="reason"]');
const revokeConsentSubmit = revokeConsentForm?.querySelector('[type="submit"]');
const consentDecisionModal = document.getElementById('consent-decision-modal');
const consentDecisionTitle = document.getElementById('consent-decision-title');
const consentDecisionText = document.getElementById('consent-decision-text');
const consentDecisionCancel = document.getElementById('consent-decision-cancel');
const consentDecisionConfirm = document.getElementById('consent-decision-confirm');
const escapeConsentMarkup = window.escapeHtml;
const getConsentDataWarning = window.getDataQualityWarning;

const consentStatusLabels = {
  PENDING: 'Pendiente',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
  REVOKED: 'Revocado',
  EXPIRED: 'Caducado',
};

const consentStatusClass = {
  PENDING: 'table-badge',
  ACCEPTED: 'table-badge consent-badge--success',
  REJECTED: 'table-badge consent-badge--danger',
  REVOKED: 'table-badge consent-badge--danger',
  EXPIRED: 'table-badge consent-badge--muted',
};

let currentUser = null;
let consentsBannerTimer = null;
let visibleConsentsById = new Map();
let pendingConsentDecision = null;
let consentDecisionInFlight = false;
let revokeConsentInFlight = false;

function setLegalLinkVisible(isVisible) {
  if (!consentsLegalLink) {
    return;
  }

  consentsLegalLink.hidden = !isVisible;
  consentsLegalLink.style.display = isVisible ? '' : 'none';
}

setLegalLinkVisible(false);

function ensureAuth() {
  if (!getToken()) {
    window.location.replace('/login.html');
    return false;
  }

  return true;
}

function formatDate(value) {
  if (!value) {
    return 'Sin fecha';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function showBanner(message, kind = 'success') {
  if (!consentsStatusBanner) {
    return;
  }

  if (consentsBannerTimer) {
    clearTimeout(consentsBannerTimer);
    consentsBannerTimer = null;
  }

  consentsStatusBanner.hidden = !message;
  consentsStatusBanner.textContent = message;
  consentsStatusBanner.className = `status-banner status-banner--${kind}`;

  if (kind !== 'error' && kind !== 'loading' && message) {
    consentsBannerTimer = window.setTimeout(() => {
      if (consentsStatusBanner) {
        consentsStatusBanner.hidden = true;
        consentsStatusBanner.textContent = '';
      }
      consentsBannerTimer = null;
    }, 3000);
  }
}

function getCurrentRole() {
  return String(currentUser?.role || '').toUpperCase();
}

function isFamilyRole() {
  return getCurrentRole() === 'FAMILY';
}

function isProfessionalRole() {
  return getCurrentRole() === 'PROFESSIONAL';
}

function renderSummary(consentList) {
  const pending = consentList.filter((consent) => consent.status === 'PENDING').length;
  const accepted = consentList.filter((consent) => consent.status === 'ACCEPTED').length;
  const other = consentList.length - pending - accepted;

  if (consentsCountPending) consentsCountPending.textContent = String(pending);
  if (consentsCountAccepted) consentsCountAccepted.textContent = String(accepted);
  if (consentsCountOther) consentsCountOther.textContent = String(other);
}

function consentCardActions(consent) {
  const canActAsFamily = isFamilyRole()
    && String(currentUser?.linkedStudentId || '') === String(consent.studentId || '');
  const consentId = escapeConsentMarkup(consent.id);

  if (!canActAsFamily) {
    return isProfessionalRole()
      ? '<span class="table-badge consent-badge--muted">Consulta profesional</span>'
      : '<span class="table-badge consent-badge--muted">Solo lectura</span>';
  }

  if (consent.status === 'PENDING') {
    return `
      <div class="consent-card__actions">
        <button class="button primary button-small" type="button" data-accept-consent="${consentId}">Aceptar</button>
        <button class="button secondary button-small" type="button" data-reject-consent="${consentId}">Rechazar</button>
      </div>
    `;
  }

  if (consent.status === 'ACCEPTED') {
    return `
      <div class="consent-card__actions">
        <button class="button secondary button-small" type="button" data-revoke-consent="${consentId}">Revocar</button>
      </div>
    `;
  }

  return '<span class="table-badge consent-badge--muted">Sin acciones disponibles</span>';
}

function renderConsent(consent) {
  const consentReferences = {
    users: [consent.student, consent.familyUser].filter(Boolean),
    centers: [consent.center].filter(Boolean),
  };
  return `
    <article class="consent-card org-card ${consent.status === 'ACCEPTED' ? 'consent-card--active' : ''}">
      <div class="org-card__top">
        <div>
          <span class="org-kicker">${escapeConsentMarkup(consent.familyUser?.name || 'Familia vinculada')}</span>
          <h3>${getConsentDataWarning('consent', consent, 'Este consentimiento', consentReferences)}${escapeConsentMarkup(consent.student?.name || 'Estudiante eliminado')}</h3>
          <p>${escapeConsentMarkup(consent.legalTextVersion?.title || 'Texto legal')}</p>
        </div>
        <span class="${consentStatusClass[consent.status] || 'table-badge'}">${escapeConsentMarkup(consentStatusLabels[consent.status] || consent.status || 'Sin estado')}</span>
      </div>

      <div class="consent-meta-grid">
        <div class="profile-chip">
          <span>Centro</span>
          <strong>${escapeConsentMarkup(consent.center?.name || consent.centerId || 'Sin centro')}</strong>
        </div>
        <div class="profile-chip">
          <span>Versión legal</span>
          <strong>${escapeConsentMarkup(consent.legalTextVersion?.version || '-')}</strong>
        </div>
        <div class="profile-chip">
          <span>Solicitado</span>
          <strong>${escapeConsentMarkup(formatDate(consent.createdAt))}</strong>
        </div>
        <div class="profile-chip">
          <span>Actualizado</span>
          <strong>${escapeConsentMarkup(formatDate(consent.updatedAt))}</strong>
        </div>
        ${consent.campaignId ? `
          <div class="profile-chip">
            <span>Alcance</span>
            <strong>Campaña específica</strong>
          </div>
        ` : ''}
      </div>

      <p class="field-note">
        ${consent.campaignId ? 'Esta autorización corresponde únicamente a la campaña de cuestionario indicada por el centro. ' : ''}
        ${consent.status === 'PENDING' ? 'Consentimiento pendiente de respuesta familiar.' : ''}
        ${consent.status === 'ACCEPTED' ? `Aceptado el ${escapeConsentMarkup(formatDate(consent.acceptedAt))}.` : ''}
        ${consent.status === 'REJECTED' ? `Rechazado el ${escapeConsentMarkup(formatDate(consent.rejectedAt))}.` : ''}
        ${consent.status === 'REVOKED' ? `Revocado el ${escapeConsentMarkup(formatDate(consent.revokedAt))}.` : ''}
        ${consent.status === 'EXPIRED' ? 'Marcado como caducado.' : ''}
      </p>

      <div class="action-row consent-card__footer">
        ${consentCardActions(consent)}
      </div>
    </article>
  `;
}

function renderConsents(consentList) {
  if (!consentsList) {
    return;
  }

  renderSummary(consentList);
  visibleConsentsById = new Map(
    consentList
      .filter((consent) => consent?.id !== undefined && consent?.id !== null)
      .map((consent) => [String(consent.id), consent]),
  );

  if (!consentList.length) {
    consentsList.innerHTML = `
      <article class="empty-state">
        <strong>${isProfessionalRole() ? 'Sin consentimientos visibles todavía' : 'Sin consentimientos disponibles'}</strong>
        <span>${isProfessionalRole()
          ? 'Cuando tu centro tenga solicitudes o estados disponibles, podrás consultarlos aquí en modo lectura.'
          : 'No hay solicitudes visibles para tu cuenta.'}</span>
      </article>
    `;
    return;
  }

  consentsList.innerHTML = consentList.map(renderConsent).join('');
}

async function loadActiveVersion() {
  try {
    const response = await apiRequest('/legal-text-versions/active');
    const version = response.data.version;
    if (consentsSummaryTitle) {
      consentsSummaryTitle.textContent = `${version.title}`;
    }
    if (consentsSummaryText) {
      consentsSummaryText.textContent = version.content;
    }
  } catch (_error) {
    if (consentsSummaryTitle) {
      consentsSummaryTitle.textContent = 'Sin versión activa';
    }
    if (consentsSummaryText) {
      consentsSummaryText.textContent = isProfessionalRole()
        ? 'No hay una versión legal activa en este momento.'
        : 'No hay un texto legal activo en este momento.';
    }
  }
}

async function loadConsents() {
  const response = await apiRequest('/consents');
  renderConsents(response.data.consents || []);
}

async function acceptConsent(consentId) {
  await apiRequest(`/consents/${encodeURIComponent(consentId)}/accept`, { method: 'POST' });
}

async function rejectConsent(consentId) {
  await apiRequest(`/consents/${encodeURIComponent(consentId)}/reject`, { method: 'POST' });
}

function setConsentDecisionBusy(isBusy) {
  consentDecisionInFlight = isBusy;
  consentDecisionModal?.setAttribute('aria-busy', String(isBusy));
  if (consentDecisionCancel) consentDecisionCancel.disabled = isBusy;
  if (consentDecisionConfirm) {
    consentDecisionConfirm.disabled = isBusy;
    consentDecisionConfirm.setAttribute('aria-busy', String(isBusy));
    consentDecisionConfirm.textContent = isBusy
      ? 'Guardando…'
      : pendingConsentDecision?.action === 'accept'
        ? 'Sí, aceptar'
        : 'Sí, rechazar';
  }
}

function closeConsentDecisionModal() {
  pendingConsentDecision = null;
  setConsentDecisionBusy(false);
  closeModalById('consent-decision-modal');
}

function openConsentDecisionModal(consentId, action) {
  const consent = visibleConsentsById.get(String(consentId));
  if (!consent || !['accept', 'reject'].includes(action)) {
    showBanner('No se ha podido preparar esta decisión. Actualiza la lista e inténtalo de nuevo.', 'error');
    return;
  }

  pendingConsentDecision = { consentId: String(consentId), action };
  const studentName = consent.student?.name || 'el estudiante';
  const legalTitle = consent.legalTextVersion?.title || 'el texto legal vigente';

  if (consentDecisionTitle) {
    consentDecisionTitle.textContent = action === 'accept'
      ? 'Aceptar consentimiento'
      : 'Rechazar consentimiento';
  }
  if (consentDecisionText) {
    consentDecisionText.textContent = action === 'accept'
      ? `Vas a aceptar el consentimiento de ${studentName} para “${legalTitle}”. Esta decisión quedará registrada.`
      : `Vas a rechazar el consentimiento de ${studentName} para “${legalTitle}”. Esta decisión quedará registrada.`;
  }

  setConsentDecisionBusy(false);
  openModalById('consent-decision-modal');
}

function openRevokeModal(consentId) {
  if (!revokeConsentForm || !revokeConsentModal || !revokeConsentIdField) {
    return;
  }

  revokeConsentIdField.value = consentId;
  if (revokeReasonField) {
    revokeReasonField.value = '';
  }
  openModalById('revoke-consent-modal');
}

async function revokeConsent(consentId, reason) {
  await apiRequest(`/consents/${encodeURIComponent(consentId)}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

consentsList?.addEventListener('click', async (event) => {
  const acceptButton = event.target.closest('[data-accept-consent]');
  const rejectButton = event.target.closest('[data-reject-consent]');
  const revokeButton = event.target.closest('[data-revoke-consent]');

  try {
    if (acceptButton) {
      openConsentDecisionModal(acceptButton.getAttribute('data-accept-consent'), 'accept');
    } else if (rejectButton) {
      openConsentDecisionModal(rejectButton.getAttribute('data-reject-consent'), 'reject');
    } else if (revokeButton) {
      openRevokeModal(revokeButton.getAttribute('data-revoke-consent'));
    }
  } catch (error) {
    showBanner(error.message || 'No ha sido posible completar la acción.', 'error');
  }
});

consentDecisionConfirm?.addEventListener('click', async () => {
  if (!pendingConsentDecision || consentDecisionInFlight) {
    return;
  }

  const decision = { ...pendingConsentDecision };
  let decisionSaved = false;
  setConsentDecisionBusy(true);
  try {
    if (decision.action === 'accept') {
      await acceptConsent(decision.consentId);
    } else {
      await rejectConsent(decision.consentId);
    }

    decisionSaved = true;
    closeConsentDecisionModal();
    await loadConsents();
    showBanner(
      decision.action === 'accept'
        ? 'Consentimiento aceptado correctamente.'
        : 'Consentimiento rechazado correctamente.',
      'success',
    );
  } catch (error) {
    showBanner(
      decisionSaved
        ? 'La decisión se guardó, pero no se pudo actualizar la lista. Pulsa “Actualizar” para reintentarlo.'
        : (error.message || 'No ha sido posible guardar la decisión.'),
      'error',
    );
  } finally {
    setConsentDecisionBusy(false);
  }
});

consentDecisionCancel?.addEventListener('click', () => {
  if (!consentDecisionInFlight) closeConsentDecisionModal();
});
consentDecisionModal?.addEventListener('unicornio:modal-closed', () => {
  if (!consentDecisionInFlight) {
    pendingConsentDecision = null;
    setConsentDecisionBusy(false);
  }
});

revokeConsentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (revokeConsentInFlight) {
    return;
  }

  revokeConsentInFlight = true;
  revokeConsentForm.setAttribute('aria-busy', 'true');
  if (revokeConsentSubmit) {
    revokeConsentSubmit.disabled = true;
    revokeConsentSubmit.setAttribute('aria-busy', 'true');
  }
  let revocationSaved = false;
  try {
    const formData = new FormData(revokeConsentForm);
    const consentId = formData.get('consentId');
    const reason = formData.get('reason');
    await revokeConsent(consentId, reason);
    revocationSaved = true;
    closeModalById('revoke-consent-modal');
    await loadConsents();
    showBanner('Consentimiento revocado correctamente.', 'success');
  } catch (error) {
    showBanner(
      revocationSaved
        ? 'La revocación se guardó, pero no se pudo actualizar la lista. Pulsa “Actualizar” para reintentarlo.'
        : (error.message || 'No ha sido posible revocar el consentimiento.'),
      'error',
    );
  } finally {
    revokeConsentInFlight = false;
    revokeConsentForm.removeAttribute('aria-busy');
    if (revokeConsentSubmit) {
      revokeConsentSubmit.disabled = false;
      revokeConsentSubmit.removeAttribute('aria-busy');
    }
  }
});

reloadConsentsButton?.addEventListener('click', async () => {
  try {
    await loadActiveVersion();
    await loadConsents();
  } catch (error) {
    showBanner(error.message || 'No se han podido actualizar los consentimientos.', 'error');
  }
});

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Logout demo.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
});

(async function init() {
  await sessionReady;
  if (!ensureAuth()) {
    return;
  }

  try {
    const meResponse = await apiRequest('/auth/me');
    currentUser = meResponse.data.user;
    if (profileNameElement) {
      profileNameElement.textContent = currentUser.name;
    }
    if (profileEmailElement) {
      profileEmailElement.textContent = currentUser.email;
    }
    setLegalLinkVisible(String(currentUser.role || '').toUpperCase() === 'ADMIN');

    await loadActiveVersion();
    await loadConsents();
  } catch (error) {
    showBanner(error.message || 'No se pudieron cargar los consentimientos.', 'error');
  } finally {
    if (getToken()) window.UnicornioAppLoading?.markPageReady();
  }
})();
