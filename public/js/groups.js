const selectedCenterLabel = document.getElementById('selected-center-label');
const groupRoleNote = document.getElementById('group-role-note');
const groupGlobalSearch = document.getElementById('group-global-search');
const groupFiltersList = document.getElementById('group-filters-list');
const addGroupFilterButton = document.getElementById('add-group-filter');
const clearGroupFiltersButton = document.getElementById('clear-group-filters');
const groupForm = document.getElementById('group-form');
const groupFormError = document.getElementById('group-form-error');
const groupFormSuccess = document.getElementById('group-form-success');
const groupsHead = document.getElementById('groups-head');
const groupsBody = document.getElementById('groups-body');
const groupCount = document.getElementById('group-count');
const refreshGroupsButton = document.getElementById('refresh-groups');
const groupMembersNote = document.getElementById('group-members-note');
const selectedGroupName = document.getElementById('selected-group-name');
const selectedGroupMeta = document.getElementById('selected-group-meta');
const groupMembersList = document.getElementById('group-members-list');
const availableUserSelect = document.getElementById('available-user-select');
const availableUsersCount = document.getElementById('available-users-count');
const addUserToGroupButton = document.getElementById('add-user-to-group-button');

let groupsCurrentUser = null;
let availableCenters = [];
let currentCenterId = null;
let allGroups = [];
let visibleGroups = [];
let selectedGroupId = null;
let currentCenterUsers = [];
let currentGroupUsers = [];
let groupFilters = [];
let filterSeed = 0;

const stageLabels = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  BACHILLERATO: 'Bachillerato',
  OTRA: 'Otra',
};

const groupColumns = setupColumnManager({
  modalId: 'group-columns-modal',
  listId: 'group-columns-list',
  triggerSelector: '[data-open-modal="group-columns-modal"]',
  storageKey: 'unicornio-group-columns',
  defaultColumns: [
    { id: 'name', label: 'Grupo', visible: true },
    { id: 'code', label: 'Código', visible: true },
    { id: 'stage', label: 'Etapa', visible: true },
    { id: 'course', label: 'Curso', visible: true },
    { id: 'shift', label: 'Turno', visible: true },
    { id: 'users', label: 'Usuarios', visible: true },
    { id: 'actions', label: 'Acciones', visible: true },
  ],
  onChange: () => renderGroupsTable(),
});

const filterFields = {
  name: {
    label: 'Nombre',
    type: 'text',
    operators: ['contains', 'equals', 'startsWith'],
  },
  code: {
    label: 'Código',
    type: 'text',
    operators: ['contains', 'equals', 'startsWith'],
  },
  stage: {
    label: 'Etapa',
    type: 'select',
    operators: ['equals'],
    options: Object.entries(stageLabels).map(([value, label]) => ({ value, label })),
  },
  course: {
    label: 'Curso',
    type: 'text',
    operators: ['contains', 'equals', 'startsWith'],
  },
  shift: {
    label: 'Turno',
    type: 'text',
    operators: ['contains', 'equals', 'startsWith'],
  },
  usersCount: {
    label: 'Usuarios',
    type: 'number',
    operators: ['equals', 'greaterThan', 'lessThan'],
  },
};

const operatorLabels = {
  contains: 'Contiene',
  equals: 'Igual a',
  startsWith: 'Empieza por',
  greaterThan: 'Mayor que',
  lessThan: 'Menor que',
};

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

function getCenterById(centerId) {
  return availableCenters.find((center) => center.id === centerId) || null;
}

function getSelectedGroup() {
  return allGroups.find((group) => group.id === selectedGroupId) || null;
}

function getSearchableGroupText(group) {
  return [
    group.name,
    group.code,
    group.stage,
    group.course,
    group.shift,
    group.center?.name,
    String(group.usersCount ?? ''),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getFilterFieldValue(group, field) {
  if (field === 'usersCount') {
    return Number(group.usersCount || 0);
  }

  if (field === 'stage') {
    return String(group.stage || '').toUpperCase();
  }

  return String(group[field] || '').toLowerCase();
}

function matchesFilter(group, filter) {
  if (!filter.field || !filter.operator) {
    return true;
  }

  const config = filterFields[filter.field];
  if (!config) {
    return true;
  }

  const rawValue = filter.value ?? '';

  if (config.type === 'number') {
    const numberValue = Number(rawValue);
    if (Number.isNaN(numberValue)) {
      return true;
    }

    const groupValue = Number(group.usersCount || 0);
    if (filter.operator === 'greaterThan') {
      return groupValue > numberValue;
    }
    if (filter.operator === 'lessThan') {
      return groupValue < numberValue;
    }
    return groupValue === numberValue;
  }

  const groupValue = getFilterFieldValue(group, filter.field);
  const normalizedValue = String(rawValue).trim().toLowerCase();

  if (!normalizedValue) {
    return true;
  }

  if (filter.field === 'stage') {
    return groupValue === normalizedValue.toUpperCase();
  }

  if (filter.operator === 'startsWith') {
    return groupValue.startsWith(normalizedValue);
  }

  if (filter.operator === 'equals') {
    return groupValue === normalizedValue;
  }

  return groupValue.includes(normalizedValue);
}

function matchesSearch(group, query) {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return getSearchableGroupText(group).includes(normalized);
}

function renderFilterBuilder() {
  if (!groupFiltersList) {
    return;
  }

  if (groupFilters.length === 0) {
    groupFiltersList.innerHTML = `
      <article class="filter-empty">
        <strong>Sin filtros activos</strong>
        <p>Usa la búsqueda global o añade condiciones para afinar los resultados.</p>
      </article>
    `;
    return;
  }

  groupFiltersList.innerHTML = groupFilters
    .map((filter) => {
      const config = filterFields[filter.field] || filterFields.name;
      const operatorOptions = config.operators
        .map((operator) => `<option value="${operator}" ${filter.operator === operator ? 'selected' : ''}>${operatorLabels[operator]}</option>`)
        .join('');

      const fieldOptions = Object.entries(filterFields)
        .map(([key, fieldConfig]) => `<option value="${key}" ${filter.field === key ? 'selected' : ''}>${fieldConfig.label}</option>`)
        .join('');

      let valueControl = `
        <input
          type="text"
          data-filter-value
          value="${filter.value ?? ''}"
          placeholder="Escribe un valor"
        />
      `;

      if (config.type === 'number') {
        valueControl = `
          <input
            type="number"
            min="0"
            data-filter-value
            value="${filter.value ?? ''}"
            placeholder="0"
          />
        `;
      }

      if (config.type === 'select') {
        const options = config.options
          .map((option) => `<option value="${option.value}" ${String(filter.value || '').toUpperCase() === option.value ? 'selected' : ''}>${option.label}</option>`)
          .join('');

        valueControl = `
          <select data-filter-value>
            <option value="">Selecciona...</option>
            ${options}
          </select>
        `;
      }

      return `
        <article class="filter-row" data-filter-id="${filter.id}">
          <label class="filter-row__field">
            <span>Campo</span>
            <select data-filter-field>
              ${fieldOptions}
            </select>
          </label>
          <label class="filter-row__field">
            <span>Operador</span>
            <select data-filter-operator>
              ${operatorOptions}
            </select>
          </label>
          <label class="filter-row__field">
            <span>Valor</span>
            ${valueControl}
          </label>
          <div class="filter-row__actions">
            <button class="button ghost button-small" type="button" data-filter-remove="${filter.id}">Quitar</button>
          </div>
        </article>
      `;
    })
    .join('');
}

function createFilter(partial = {}) {
  const field = partial.field || 'name';
  const config = filterFields[field] || filterFields.name;
  const operator = partial.operator || config.operators[0];

  groupFilters.push({
    id: `group-filter-${++filterSeed}`,
    field,
    operator,
    value: partial.value ?? '',
  });

  renderFilterBuilder();
  applyGroupFilters();
}

function updateFilter(id, patch) {
  groupFilters = groupFilters.map((filter) => {
    if (filter.id !== id) {
      return filter;
    }

    const next = { ...filter, ...patch };
    const config = filterFields[next.field] || filterFields.name;

    if (!config.operators.includes(next.operator)) {
      next.operator = config.operators[0];
    }

    if (config.type === 'select' && !next.value) {
      next.value = '';
    }

    return next;
  });

  renderFilterBuilder();
  applyGroupFilters();
}

function removeFilter(id) {
  groupFilters = groupFilters.filter((filter) => filter.id !== id);
  renderFilterBuilder();
  applyGroupFilters();
}

function clearFilters() {
  groupFilters = [];
  if (groupGlobalSearch) {
    groupGlobalSearch.value = '';
  }
  renderFilterBuilder();
  applyGroupFilters();
}

function renderCenters(centers) {
  availableCenters = centers;

  const query = new URLSearchParams(window.location.search);
  const preferredCenterId = query.get('centerId');
  const fallbackCenterId = centers[0]?.id || null;
  currentCenterId = centers.some((center) => center.id === preferredCenterId) ? preferredCenterId : fallbackCenterId;

  const center = getCenterById(currentCenterId);
  selectedCenterLabel.textContent = center ? center.name : 'Sin seleccionar';
}

function renderGroupsTable() {
  if (!groupsHead || !groupsBody) {
    return;
  }

  const columns = groupColumns.getColumns().filter((column) => column.visible !== false).sort((a, b) => a.order - b.order);

  groupsHead.innerHTML = `
    <tr>
      ${columns.map((column) => `<th>${column.label}</th>`).join('')}
    </tr>
  `;

  groupsBody.innerHTML = visibleGroups
    .map((group, index) => {
      const cells = columns.map((column) => {
        if (column.id === 'name') {
          return `
            <td>
              <div class="table-cell-title">
                <strong>${group.name}</strong>
                <span>${group.center?.name || 'Sin centro'}</span>
              </div>
            </td>
          `;
        }

        if (column.id === 'code') {
          return `<td>${group.code || '-'}</td>`;
        }

        if (column.id === 'stage') {
          return `<td><span class="table-badge">${stageLabels[group.stage] || group.stage || '-'}</span></td>`;
        }

        if (column.id === 'course') {
          return `<td>${group.course || '-'}</td>`;
        }

        if (column.id === 'shift') {
          return `<td>${group.shift || '-'}</td>`;
        }

        if (column.id === 'users') {
          return `<td>${group.usersCount || 0}</td>`;
        }

        if (column.id === 'actions') {
          return `
            <td class="table-cell-actions">
              <button class="button ghost table-row-action" type="button" data-group-manage="${group.id}">
                Gestionar usuarios
              </button>
            </td>
          `;
        }

        return '<td>-</td>';
      });

      return `<tr class="${group.id === selectedGroupId ? 'org-card--active' : ''}" style="animation-delay:${index * 50}ms">${cells.join('')}</tr>`;
    })
    .join('');
}

function applyGroupFilters() {
  const query = groupGlobalSearch?.value || '';

  visibleGroups = allGroups.filter((group) => {
    if (!matchesSearch(group, query)) {
      return false;
    }

    return groupFilters.every((filter) => matchesFilter(group, filter));
  });

  groupCount.textContent = `${visibleGroups.length} ${visibleGroups.length === 1 ? 'grupo' : 'grupos'}`;

  if (!visibleGroups.length) {
    groupsBody.innerHTML = `
      <tr>
        <td colspan="99">
          <article class="empty-state">
            <strong>No hay grupos que coincidan</strong>
            <p>Prueba a quitar filtros o a buscar por otro campo.</p>
          </article>
        </td>
      </tr>
    `;
    return;
  }

  if (!selectedGroupId || !allGroups.some((group) => group.id === selectedGroupId)) {
    selectedGroupId = visibleGroups[0]?.id || null;
  }

  renderGroupsTable();
}

function renderGroups(groups) {
  allGroups = groups;

  if (!selectedGroupId || !allGroups.some((group) => group.id === selectedGroupId)) {
    selectedGroupId = allGroups[0]?.id || null;
  }

  applyGroupFilters();
}

function renderGroupMembers(groupUsers) {
  if (!groupMembersList) {
    return;
  }

  if (groupUsers.length === 0) {
    groupMembersList.innerHTML = `
      <article class="empty-state">
        <strong>Este grupo no tiene usuarios</strong>
        <p>Selecciona un usuario del centro para añadirlo.</p>
      </article>
    `;
    return;
  }

  groupMembersList.innerHTML = groupUsers
    .map(
      ({ user, assignment }, index) => `
        <article class="user-row user-row--compact" style="animation-delay:${index * 60}ms">
          <div>
            <strong>${user.name}</strong>
            <span>${user.email}</span>
          </div>
          <div class="user-meta">
            <span>${assignment.role}</span>
            <button class="button secondary button-small" type="button" data-group-remove="${user.id}">
              Quitar
            </button>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderAvailableUsers(centerUsers, groupUsers) {
  if (!availableUserSelect) {
    return;
  }

  const groupUserIds = new Set(groupUsers.map(({ user }) => user.id));
  const availableUsers = centerUsers.filter(({ user }) => user.isActive && !groupUserIds.has(user.id));

  availableUsersCount.textContent = String(availableUsers.length);

  if (availableUsers.length === 0) {
    availableUserSelect.innerHTML = '<option value="">No hay usuarios disponibles</option>';
    availableUserSelect.disabled = true;
    addUserToGroupButton.disabled = true;
    return;
  }

  availableUserSelect.disabled = false;
  addUserToGroupButton.disabled = false;
  availableUserSelect.innerHTML = availableUsers
    .map((entry) => `<option value="${entry.user.id}">${entry.user.name} (${entry.user.email})</option>`)
    .join('');
}

function renderGroupSelection(groupId) {
  const group = allGroups.find((item) => item.id === groupId) || null;
  selectedGroupId = group ? group.id : null;

  if (!group) {
    if (selectedGroupName) selectedGroupName.textContent = 'Sin grupo';
    if (selectedGroupMeta) selectedGroupMeta.textContent = '-';
    if (groupMembersNote) groupMembersNote.textContent = 'Selecciona un grupo para ver sus miembros.';
    renderGroupMembers([]);
    renderAvailableUsers([], []);
    return;
  }

  if (selectedGroupName) selectedGroupName.textContent = group.name;
  if (selectedGroupMeta) selectedGroupMeta.textContent = `${group.usersCount || 0} usuarios`;
  if (groupMembersNote) groupMembersNote.textContent = `Gestiona usuarios del grupo ${group.name}.`;

  if (currentCenterId) {
    Promise.all([
      loadGroupUsers(group.id),
      loadCenterUsers(currentCenterId),
    ]).then(([groupUsers, centerUsers]) => {
      currentGroupUsers = groupUsers;
      currentCenterUsers = centerUsers;
      renderGroupMembers(groupUsers);
      renderAvailableUsers(centerUsers, groupUsers);
    }).catch((error) => {
      setMessage(groupFormError, error.message, true);
    });
  }
}

async function openGroupManager(groupId) {
  renderGroupSelection(groupId);
  openModalById('group-members-modal');
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  groupsCurrentUser = response.data.user;

  if (groupRoleNote) {
    groupRoleNote.textContent = canCreateGroups()
      ? 'Tienes permisos para crear grupos.'
      : 'Solo puedes consultar los grupos asignados.';
  }
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
    return [];
  }

  try {
    const response = await apiRequest(`/centers/${centerId}/groups`);
    const groups = response.data.groups || [];
    renderGroups(groups);
    return groups;
  } catch (error) {
    if (error.status === 403) {
      setMessage(groupFormError, 'No tienes permiso para ver los grupos de ese centro.', true);
      renderGroups([]);
      return [];
    }

    throw error;
  }
}

async function loadCenterUsers(centerId) {
  if (!centerId) {
    return [];
  }

  try {
    const response = await apiRequest(`/centers/${centerId}/users`);
    return response.data.users || [];
  } catch (error) {
    if (error.status === 403) {
      return [];
    }

    throw error;
  }
}

async function loadGroupUsers(groupId) {
  if (!groupId) {
    return [];
  }

  try {
    const response = await apiRequest(`/groups/${groupId}/users`);
    return response.data.users || [];
  } catch (error) {
    if (error.status === 403) {
      return [];
    }

    throw error;
  }
}

async function refreshGroupManagement() {
  if (!currentCenterId) {
    renderGroupSelection(null);
    return;
  }

  await loadGroups(currentCenterId);
  if (selectedGroupId) {
    renderGroupSelection(selectedGroupId);
  }
}

addGroupFilterButton?.addEventListener('click', () => {
  createFilter();
});

clearGroupFiltersButton?.addEventListener('click', clearFilters);

groupGlobalSearch?.addEventListener('input', applyGroupFilters);

groupFiltersList?.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-filter-remove]');
  if (!removeButton) {
    return;
  }

  removeFilter(removeButton.getAttribute('data-filter-remove'));
});

groupFiltersList?.addEventListener('change', (event) => {
  const row = event.target.closest('[data-filter-id]');
  if (!row) {
    return;
  }

  const filterId = row.getAttribute('data-filter-id');
  const currentFilter = groupFilters.find((filter) => filter.id === filterId);
  if (!currentFilter) {
    return;
  }

  const field = row.querySelector('[data-filter-field]')?.value || 'name';
  const operator = row.querySelector('[data-filter-operator]')?.value || filterFields[field].operators[0];
  const value = row.querySelector('[data-filter-value]')?.value || '';

  updateFilter(filterId, { field, operator, value });
});

groupFiltersList?.addEventListener('input', (event) => {
  const row = event.target.closest('[data-filter-id]');
  if (!row) {
    return;
  }

  const filterId = row.getAttribute('data-filter-id');
  const field = row.querySelector('[data-filter-field]')?.value || 'name';
  const operator = row.querySelector('[data-filter-operator]')?.value || filterFields[field].operators[0];
  const value = row.querySelector('[data-filter-value]')?.value || '';

  updateFilter(filterId, { field, operator, value });
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
    const response = await apiRequest(`/centers/${currentCenterId}/groups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setMessage(groupFormSuccess, 'Grupo creado correctamente.');
    groupForm.reset();
    selectedGroupId = response.data.group.id;
    await loadGroups(currentCenterId);
    await openGroupManager(selectedGroupId);
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

refreshGroupsButton?.addEventListener('click', async () => {
  try {
    await refreshGroupManagement();
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

groupsBody?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-group-manage]');
  if (!button) {
    return;
  }

  await openGroupManager(button.getAttribute('data-group-manage'));
});

groupMembersList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-group-remove]');
  if (!button) {
    return;
  }

  const group = getSelectedGroup();
  if (!group) {
    return;
  }

  try {
    await apiRequest(`/groups/${group.id}/users/${button.getAttribute('data-group-remove')}`, {
      method: 'DELETE',
    });
    await openGroupManager(group.id);
    await refreshGroupManagement();
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

addUserToGroupButton?.addEventListener('click', async () => {
  const group = getSelectedGroup();
  const userId = availableUserSelect?.value;

  if (!group || !userId) {
    return;
  }

  try {
    await apiRequest(`/groups/${group.id}/users/${userId}`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    setMessage(groupFormSuccess, 'Usuario añadido al grupo.');
    await openGroupManager(group.id);
    await refreshGroupManagement();
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

async function init() {
  try {
    await loadProfile();
    await loadCentersAndGroups();
    renderFilterBuilder();

    const query = new URLSearchParams(window.location.search);
    const queryGroupId = query.get('groupId');
    if (queryGroupId) {
      selectedGroupId = queryGroupId;
      renderGroupSelection(selectedGroupId);
    } else if (visibleGroups.length > 0) {
      selectedGroupId = visibleGroups[0].id;
      renderGroupSelection(selectedGroupId);
    }
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = '/login.html';
      return;
    }

    setMessage(groupFormError, error.message || 'No se pudieron cargar los grupos.', true);
  }
}

init();
