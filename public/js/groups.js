const centerSelect = document.getElementById('center-select');
const selectedCenterLabel = document.getElementById('selected-center-label');
const groupRoleNote = document.getElementById('group-role-note');
const groupFormCard = document.getElementById('group-form-card');
const groupForm = document.getElementById('group-form');
const groupFormError = document.getElementById('group-form-error');
const groupFormSuccess = document.getElementById('group-form-success');
const groupsList = document.getElementById('groups-list');
const groupCount = document.getElementById('group-count');
const refreshGroupsButton = document.getElementById('refresh-groups');

let groupsCurrentUser = null;
let availableCenters = [];
let currentCenterId = null;

function setMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

function canCreateGroups() {
  const role = String(groupsCurrentUser?.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'SCHOOL';
}

function renderCenters(centers) {
  centerSelect.innerHTML = centers
    .map((center) => `<option value="${center.id}">${center.name}</option>`)
    .join('');

  availableCenters = centers;

  const query = new URLSearchParams(window.location.search);
  const preferredCenterId = query.get('centerId');
  const fallbackCenterId = centers[0]?.id || null;
  currentCenterId = centers.some((center) => center.id === preferredCenterId) ? preferredCenterId : fallbackCenterId;

  if (currentCenterId) {
    centerSelect.value = currentCenterId;
  }

  updateSelectedCenterLabel();
}

function updateSelectedCenterLabel() {
  const center = availableCenters.find((item) => item.id === currentCenterId);
  selectedCenterLabel.textContent = center ? center.name : 'Sin seleccionar';
}

function renderGroups(groups) {
  groupCount.textContent = `${groups.length} ${groups.length === 1 ? 'grupo' : 'grupos'}`;

  if (!groupsList) {
    return;
  }

  if (groups.length === 0) {
    groupsList.innerHTML = `
      <article class="empty-state">
        <strong>No hay grupos en este centro</strong>
        <p>Crea el primero si tienes permisos de gestión.</p>
      </article>
    `;
    return;
  }

  groupsList.innerHTML = groups
    .map(
      (group, index) => `
        <article class="org-card" style="animation-delay:${index * 70}ms">
          <div class="org-card__top">
            <div>
              <span class="org-kicker">${group.stage || 'Sin etapa'}</span>
              <h3>${group.name}</h3>
              <p>${[group.code, group.course, group.shift].filter(Boolean).join(' · ') || 'Grupo base'}</p>
            </div>
            <span class="org-pill">${group.usersCount || 0} usuarios</span>
          </div>
          <div class="org-card__meta">
            <span>Centro: ${group.center?.name || 'Sin centro'}</span>
            <span>Activo: ${group.isActive ? 'Sí' : 'No'}</span>
          </div>
        </article>
      `,
    )
    .join('');
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  groupsCurrentUser = response.data.user;
  const role = String(groupsCurrentUser.role || '').toUpperCase();

  groupRoleNote.textContent = canCreateGroups()
    ? 'Tienes permisos para crear grupos.'
    : 'Solo puedes consultar los grupos asignados.';

  if (groupFormCard) {
    groupFormCard.hidden = !canCreateGroups();
  }

  return role;
}

async function loadCentersAndGroups() {
  const response = await apiRequest('/centers');
  renderCenters(response.data.centers || []);

  if (currentCenterId) {
    await loadGroups(currentCenterId);
    return;
  }

  renderGroups([]);
}

async function loadGroups(centerId) {
  if (!centerId) {
    renderGroups([]);
    return;
  }

  const response = await apiRequest(`/centers/${centerId}/groups`);
  renderGroups(response.data.groups || []);
}

centerSelect?.addEventListener('change', async () => {
  currentCenterId = centerSelect.value;
  const center = availableCenters.find((item) => item.id === currentCenterId);
  selectedCenterLabel.textContent = center ? center.name : 'Sin seleccionar';
  const url = new URL(window.location.href);
  url.searchParams.set('centerId', currentCenterId);
  window.history.replaceState({}, '', url);
  await loadGroups(currentCenterId);
});

groupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(groupFormError, '', true);
  setMessage(groupFormSuccess, '', false);

  if (!currentCenterId) {
    setMessage(groupFormError, 'Selecciona un centro antes de crear el grupo.', true);
    return;
  }

  const formData = new FormData(groupForm);
  const payload = {
    name: formData.get('name'),
    code: formData.get('code'),
    stage: formData.get('stage') || undefined,
    academicYearId: formData.get('academicYearId') || undefined,
    course: formData.get('course') || undefined,
    shift: formData.get('shift') || undefined,
  };

  try {
    await apiRequest(`/centers/${currentCenterId}/groups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setMessage(groupFormSuccess, 'Grupo creado correctamente.');
    groupForm.reset();
    await loadGroups(currentCenterId);
    await loadCentersAndGroups();
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

refreshGroupsButton?.addEventListener('click', async () => {
  try {
    await loadCentersAndGroups();
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

async function init() {
  try {
    await loadProfile();
    await loadCentersAndGroups();
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

init();
