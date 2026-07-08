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
const revokeConsentForm = document.getElementById('revoke-consent-form');
const revokeConsentModal = document.getElementById('revoke-consent-modal');
const revokeConsentIdField = revokeConsentForm?.querySelector('[name="consentId"]');
const revokeReasonField = revokeConsentForm?.querySelector('[name="reason"]');

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
  const canActAsFamily = isFamilyRole() && currentUser?.linkedStudentId === consent.studentId;

  if (!canActAsFamily) {
    return isProfessionalRole()
      ? '<span class="table-badge consent-badge--muted">Consulta profesional</span>'
      : '<span class="table-badge consent-badge--muted">Solo lectura</span>';
  }

  if (consent.status === 'PENDING') {
    return `
      <div class="consent-card__actions">
        <button class="button primary button-small" type="button" data-accept-consent="${consent.id}">Aceptar</button>
        <button class="button secondary button-small" type="button" data-reject-consent="${consent.id}">Rechazar</button>
      </div>
    `;
  }

  if (consent.status === 'ACCEPTED') {
    return `
      <div class="consent-card__actions">
        <button class="button secondary button-small" type="button" data-revoke-consent="${consent.id}">Revocar</button>
      </div>
    `;
  }

  return '<span class="table-badge consent-badge--muted">Sin acciones disponibles</span>';
}

function renderConsent(consent) {
  return `
    <article class="consent-card org-card ${consent.status === 'ACCEPTED' ? 'consent-card--active' : ''}">
      <div class="org-card__top">
        <div>
          <span class="org-kicker">${consent.familyUser?.name || 'Familia vinculada'}</span>
          <h3>${consent.student?.name || 'Estudiante'}</h3>
          <p>${consent.legalTextVersion?.title || 'Texto legal provisional'}</p>
        </div>
        <span class="${consentStatusClass[consent.status] || 'table-badge'}">${consentStatusLabels[consent.status] || consent.status}</span>
      </div>

      <div class="consent-meta-grid">
        <div class="profile-chip">
          <span>Centro</span>
          <strong>${consent.center?.name || consent.centerId}</strong>
        </div>
        <div class="profile-chip">
          <span>Versión legal</span>
          <strong>${consent.legalTextVersion?.version || '-'}</strong>
        </div>
        <div class="profile-chip">
          <span>Solicitado</span>
          <strong>${formatDate(consent.createdAt)}</strong>
        </div>
        <div class="profile-chip">
          <span>Actualizado</span>
          <strong>${formatDate(consent.updatedAt)}</strong>
        </div>
      </div>

      <p class="field-note">
        ${consent.status === 'PENDING' ? 'Consentimiento pendiente de respuesta familiar.' : ''}
        ${consent.status === 'ACCEPTED' ? `Aceptado el ${formatDate(consent.acceptedAt)}.` : ''}
        ${consent.status === 'REJECTED' ? `Rechazado el ${formatDate(consent.rejectedAt)}.` : ''}
        ${consent.status === 'REVOKED' ? `Revocado el ${formatDate(consent.revokedAt)}.` : ''}
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

  if (!consentList.length) {
    consentsList.innerHTML = `
      <article class="empty-state">
        <strong>${isProfessionalRole() ? 'Sin consentimientos visibles todavía' : 'Sin consentimientos disponibles'}</strong>
        <span>${isProfessionalRole()
          ? 'Cuando tu centro tenga solicitudes o estados disponibles, podrás consultarlos aquí en modo lectura.'
          : 'No hay solicitudes visibles para tu cuenta demo.'}</span>
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
  await apiRequest(`/consents/${consentId}/accept`, { method: 'POST' });
  showBanner('Consentimiento aceptado correctamente.', 'success');
  await loadConsents();
}

async function rejectConsent(consentId) {
  await apiRequest(`/consents/${consentId}/reject`, { method: 'POST' });
  showBanner('Consentimiento rechazado correctamente.', 'success');
  await loadConsents();
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
  await apiRequest(`/consents/${consentId}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  showBanner('Consentimiento revocado correctamente.', 'success');
  await loadConsents();
}

consentsList?.addEventListener('click', async (event) => {
  const acceptButton = event.target.closest('[data-accept-consent]');
  const rejectButton = event.target.closest('[data-reject-consent]');
  const revokeButton = event.target.closest('[data-revoke-consent]');

  try {
    if (acceptButton) {
      await acceptConsent(acceptButton.getAttribute('data-accept-consent'));
    } else if (rejectButton) {
      await rejectConsent(rejectButton.getAttribute('data-reject-consent'));
    } else if (revokeButton) {
      openRevokeModal(revokeButton.getAttribute('data-revoke-consent'));
    }
  } catch (error) {
    showBanner(error.message || 'No ha sido posible completar la acción.', 'error');
  }
});

revokeConsentForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const formData = new FormData(revokeConsentForm);
    const consentId = formData.get('consentId');
    const reason = formData.get('reason');
    await revokeConsent(consentId, reason);
    closeModalById('revoke-consent-modal');
  } catch (error) {
    showBanner(error.message || 'No ha sido posible revocar el consentimiento.', 'error');
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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && revokeConsentModal && !revokeConsentModal.hidden) {
    closeModalById('revoke-consent-modal');
    return;
  }

  if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
    closeModalById('profile-modal');
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

    await loadActiveVersion();
    await loadConsents();
  } catch (error) {
    showBanner(error.message || 'No se pudieron cargar los consentimientos.', 'error');
  }
})();
