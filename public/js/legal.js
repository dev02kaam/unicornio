const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const legalActiveCard = document.getElementById('legal-active-card');
const legalActiveTitle = document.getElementById('legal-active-title');
const legalHistorySection = document.getElementById('legal-history-section');
const legalVersionsList = document.getElementById('legal-versions-list');
const legalStatusBanner = document.getElementById('legal-status-banner');
const reloadLegalButton = document.getElementById('reload-legal-button');
const openCreateVersionButton = document.getElementById('open-create-version-button');
const createLegalVersionForm = document.getElementById('create-legal-version-form');
const legalActivationModal = document.getElementById('legal-activation-modal');
const legalActivationTitle = document.getElementById('legal-activation-title');
const legalActivationText = document.getElementById('legal-activation-text');
const legalActivationCancelButton = document.getElementById('legal-activation-cancel-button');
const legalActivationConfirmButton = document.getElementById('legal-activation-confirm-button');
const escapeLegalMarkup = window.escapeHtml;

let currentUser = null;
let legalBannerTimer = null;
let pendingLegalChange = null;

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
  }).format(date);
}

function showBanner(message, kind = 'success') {
  if (!legalStatusBanner) {
    return;
  }

  if (legalBannerTimer) {
    clearTimeout(legalBannerTimer);
    legalBannerTimer = null;
  }

  legalStatusBanner.hidden = !message;
  legalStatusBanner.textContent = message;
  legalStatusBanner.className = `status-banner status-banner--${kind}`;

  if (kind !== 'error' && kind !== 'loading' && message) {
    legalBannerTimer = window.setTimeout(() => {
      if (legalStatusBanner) {
        legalStatusBanner.hidden = true;
        legalStatusBanner.textContent = '';
      }
      legalBannerTimer = null;
    }, 3000);
  }
}

function isAdminUser() {
  return String(currentUser?.role || '').toUpperCase() === 'ADMIN';
}

function closeLegalActivationModal() {
  pendingLegalChange = null;
  closeModalById('legal-activation-modal');
}

function openLegalActivationModal({ type, versionId = null, versionTitle = null, payload = null }) {
  pendingLegalChange = {
    type,
    versionId,
    versionTitle,
    payload,
  };

  if (legalActivationTitle) {
    legalActivationTitle.textContent = type === 'create'
      ? 'Crear versión legal activa'
      : (versionTitle || 'Activar versión legal');
  }

  if (legalActivationText) {
    const displayTitle = versionTitle || payload?.title || 'sin título';
    legalActivationText.textContent = type === 'create'
      ? `¿Estás seguro de crear esta versión legal como activa? Cambiarás la que está ahora activa por esta nueva referencia: ${displayTitle}.`
      : `¿Estás seguro de activar esta versión legal? Cambiarás la que está ahora activa por esta: ${displayTitle}.`;
  }

  openModalById('legal-activation-modal');
}

function renderVersionCard(version) {
  if (!version) {
    return `
      <article class="empty-state">
        <strong>No hay versiones disponibles</strong>
        <span>El módulo todavía no tiene texto legal cargado.</span>
      </article>
    `;
  }

  return `
    <article class="org-card ${version.isActive ? 'org-card--active' : ''} legal-version-card">
      <div class="org-card__top">
        <div>
          <span class="org-kicker">Versión ${escapeLegalMarkup(version.version)}</span>
          <h3>${escapeLegalMarkup(version.title)}</h3>
          <p>${escapeLegalMarkup(version.content)}</p>
        </div>
        <span class="table-badge ${version.isActive ? 'consent-badge--success' : 'consent-badge--muted'}">${version.isActive ? 'Activa' : 'Inactiva'}</span>
      </div>

      <div class="consent-meta-grid">
        <div class="profile-chip">
          <span>Desde</span>
          <strong>${escapeLegalMarkup(formatDate(version.effectiveFrom))}</strong>
        </div>
        <div class="profile-chip">
          <span>Hasta</span>
          <strong>${escapeLegalMarkup(formatDate(version.effectiveTo))}</strong>
        </div>
      </div>

      ${isAdminUser() ? `
        <div class="legal-version-card__actions">
          <button
            class="button secondary"
            type="button"
            data-legal-version-action="${version.isActive ? 'deactivate' : 'activate'}"
            data-version-id="${escapeLegalMarkup(version.id)}"
            data-version-title="${escapeLegalMarkup(version.title)}"
          >
            ${version.isActive ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      ` : ''}
    </article>
  `;
}

async function loadLegalVersions() {
  const response = await apiRequest('/legal-text-versions');
  const versions = response.data.versions || [];

  const activeVersion = versions.find((version) => version.isActive) || null;
  if (legalActiveTitle) {
    legalActiveTitle.textContent = activeVersion?.title || 'Sin versión legal activa';
  }
  if (legalActiveCard) {
    legalActiveCard.innerHTML = renderVersionCard(activeVersion);
  }

  if (legalHistorySection) {
    legalHistorySection.hidden = String(currentUser?.role || '').toUpperCase() !== 'ADMIN';
  }

  if (legalVersionsList) {
    const sortedVersions = versions.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    legalVersionsList.innerHTML = sortedVersions.length
      ? sortedVersions.map((version) => renderVersionCard(version)).join('')
      : renderVersionCard(null);
  }
}

async function createLegalVersion(payload) {
  const response = await apiRequest('/legal-text-versions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const createdVersion = response.data.version;
  showBanner(
    createdVersion?.isActive
      ? 'Versión legal creada y activada correctamente.'
      : 'Versión legal creada correctamente.',
    'success',
  );
  closeModalById('create-legal-version-modal');
  await loadLegalVersions();
}

async function updateLegalVersionState(versionId, action) {
  const safeVersionId = encodeURIComponent(versionId);
  const endpoint = action === 'activate'
    ? `/legal-text-versions/${safeVersionId}/activate`
    : `/legal-text-versions/${safeVersionId}/deactivate`;

  showBanner(action === 'activate' ? 'Activando versión legal...' : 'Desactivando versión legal...', 'loading');

  const response = await apiRequest(endpoint, {
    method: 'POST',
  });

  const updatedVersion = response.data.version;
  showBanner(
    response.message
      || (updatedVersion?.isActive ? 'Versión legal activada correctamente.' : 'Versión legal desactivada correctamente.'),
    'success',
  );
  await loadLegalVersions();
}

reloadLegalButton?.addEventListener('click', async () => {
  try {
    await loadLegalVersions();
  } catch (error) {
    showBanner(error.message || 'No se pudieron actualizar las versiones legales.', 'error');
  }
});

createLegalVersionForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const formData = new FormData(createLegalVersionForm);
    const payload = {
      version: formData.get('version'),
      title: formData.get('title'),
      content: formData.get('content'),
      effectiveFrom: formData.get('effectiveFrom') || null,
      effectiveTo: formData.get('effectiveTo') || null,
      isActive: formData.get('isActive') === 'on',
    };

    if (payload.isActive) {
      openLegalActivationModal({
        type: 'create',
        versionTitle: payload.title,
        payload,
      });
      return;
    }

    await createLegalVersion(payload);
    createLegalVersionForm.reset();
  } catch (error) {
    showBanner(error.message || 'No se pudo crear la versión legal.', 'error');
  }
});

document.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-legal-version-action]');
  if (!actionButton) {
    return;
  }

  const { legalVersionAction, versionId } = actionButton.dataset;
  if (!legalVersionAction || !versionId) {
    return;
  }

  try {
    if (legalVersionAction === 'activate') {
      openLegalActivationModal({
        type: 'activate',
        versionId,
        versionTitle: actionButton.dataset.versionTitle,
      });
      return;
    }

    actionButton.disabled = true;
    await updateLegalVersionState(versionId, legalVersionAction);
  } catch (error) {
    showBanner(error.message || 'No se pudo actualizar la versión legal.', 'error');
  } finally {
    actionButton.disabled = false;
  }
});

legalActivationCancelButton?.addEventListener('click', () => {
  closeLegalActivationModal();
});

legalActivationConfirmButton?.addEventListener('click', async () => {
  if (!pendingLegalChange) {
    closeLegalActivationModal();
    return;
  }

  try {
    legalActivationConfirmButton.disabled = true;

    if (pendingLegalChange.type === 'create') {
      await createLegalVersion(pendingLegalChange.payload);
      createLegalVersionForm?.reset();
    } else {
      await updateLegalVersionState(pendingLegalChange.versionId, 'activate');
    }

    closeLegalActivationModal();
  } catch (error) {
    showBanner(error.message || 'No se pudo completar la operación.', 'error');
  } finally {
    legalActivationConfirmButton.disabled = false;
  }
});

legalActivationModal?.addEventListener('click', (event) => {
  if (event.target?.matches?.('[data-close-modal="legal-activation-modal"]')) {
    closeLegalActivationModal();
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

    if (String(currentUser.role || '').toUpperCase() !== 'ADMIN') {
      window.location.replace('/dashboard.html');
      return;
    }

    if (openCreateVersionButton) {
      openCreateVersionButton.hidden = false;
    }

    await loadLegalVersions();
  } catch (error) {
    showBanner(error.message || 'No se pudieron cargar las versiones legales.', 'error');
  }
})();

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

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && legalActivationModal && !legalActivationModal.hidden) {
    closeLegalActivationModal();
    return;
  }

  if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
    closeModalById('profile-modal');
  }
});
