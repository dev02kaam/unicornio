const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const groupAcademicYearPickerRoot = document.getElementById('group-academic-year-picker');
const groupAcademicYearTrigger = document.getElementById('group-academic-year-trigger');
const groupAcademicYearPanel = document.getElementById('group-academic-year-panel');
const groupAcademicYearGrid = document.getElementById('group-academic-year-grid');
const groupAcademicYearRange = document.getElementById('group-academic-year-range');
const groupAcademicYearPrev = document.getElementById('group-academic-year-prev');
const groupAcademicYearNext = document.getElementById('group-academic-year-next');
const groupAcademicYearDisplay = document.getElementById('group-academic-year-display');
const groupAcademicYearSummary = document.getElementById('group-academic-year-summary');
const groupAcademicYearHidden = document.getElementById('group-academic-year-hidden');
const selectedCenterLabel = document.getElementById('selected-center-label');
const groupRoleNote = document.getElementById('group-role-note');
const groupGlobalSearch = document.getElementById('group-global-search');
const groupFiltersList = document.getElementById('group-filters-list');
const addGroupFilterButton = document.getElementById('add-group-filter');
const clearGroupFiltersButton = document.getElementById('clear-group-filters');
const createGroupTrigger = document.querySelector('[data-open-modal="create-group-modal"]');
const groupForm = document.getElementById('group-form');
const groupFormTitle = document.getElementById('create-group-title');
const groupFormError = document.getElementById('group-form-error');
const groupFormSuccess = document.getElementById('group-form-success');
const groupFeedback = document.getElementById('group-feedback');
const studentGroupPanel = document.getElementById('student-group-panel');
const studentGroupName = document.getElementById('student-group-name');
const studentGroupDescription = document.getElementById('student-group-description');
const groupToolsPanel = document.getElementById('group-tools-panel');
const groupsListPanel = document.getElementById('groups-list-panel');
const groupFormSubmitButton = groupForm?.querySelector('button[type="submit"]');
const groupsHead = document.getElementById('groups-head');
const groupsBody = document.getElementById('groups-body');
const groupCount = document.getElementById('group-count');
const refreshGroupsButton = document.getElementById('refresh-groups');
const groupMembersNote = document.getElementById('group-members-note');
const selectedGroupName = document.getElementById('selected-group-name');
const selectedGroupMeta = document.getElementById('selected-group-meta');
const selectedGroupDetail = document.getElementById('selected-group-detail');
const selectedGroupKicker = document.getElementById('selected-group-kicker');
const selectedGroupSummary = document.getElementById('selected-group-summary');
const selectedGroupCenter = document.getElementById('selected-group-center');
const groupMembersList = document.getElementById('group-members-list');
const groupMembersCard = document.getElementById('group-members-card');
const groupAvailableUsersCard = document.getElementById('group-available-users-card');
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
let currentGroupsRole = '';
let groupAcademicYearPicker = null;
const formHelpers = window.UnicornioFormHelpers || {};
const escapeDynamicHtml = window.escapeHtml;
const getGroupDataWarning = window.getDataQualityWarning;
const showDestructiveActionConfirm = window.confirmDestructiveAction;

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
  equals: 'Es exactamente',
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

function setBanner(message, variant = 'success') {
  if (!groupFeedback) {
    return;
  }

  groupFeedback.textContent = message;
  groupFeedback.hidden = !message;
  groupFeedback.classList.remove('status-banner--success', 'status-banner--error', 'status-banner--loading');
  groupFeedback.classList.add(`status-banner--${variant}`);
}

function setGroupFormLoading(isLoading) {
  if (!groupFormSubmitButton) {
    return;
  }

  groupFormSubmitButton.disabled = isLoading;
  const isEditing = Boolean(groupForm?.elements.id?.value);
  groupFormSubmitButton.textContent = isLoading ? (isEditing ? 'Guardando...' : 'Creando...') : (isEditing ? 'Guardar cambios' : 'Crear grupo');
}

function canCreateGroups() {
  const role = String(groupsCurrentUser?.role || '').toUpperCase();
  return role === 'ADMIN' || role === 'SCHOOL' || role === 'TEACHER';
}

function canManageGroupRecords() {
  return canCreateGroups();
}

function canManageGroupMembers() {
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
        .map((operator) => `<option value="${escapeDynamicHtml(operator)}" ${filter.operator === operator ? 'selected' : ''}>${escapeDynamicHtml(operatorLabels[operator])}</option>`)
        .join('');

      const fieldOptions = Object.entries(filterFields)
        .map(([key, fieldConfig]) => `<option value="${escapeDynamicHtml(key)}" ${filter.field === key ? 'selected' : ''}>${escapeDynamicHtml(fieldConfig.label)}</option>`)
        .join('');

      let valueControl = `
        <input
          type="text"
          data-filter-value
          value="${escapeDynamicHtml(filter.value ?? '')}"
          placeholder="Escribe un valor"
        />
      `;

      if (config.type === 'number') {
        valueControl = `
          <input
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            aria-label="Número de usuarios"
            data-filter-value
            value="${escapeDynamicHtml(filter.value ?? '')}"
            placeholder="0"
          />
        `;
      }

      if (config.type === 'select') {
        const options = config.options
          .map((option) => `<option value="${escapeDynamicHtml(option.value)}" ${String(filter.value || '').toUpperCase() === option.value ? 'selected' : ''}>${escapeDynamicHtml(option.label)}</option>`)
          .join('');

        valueControl = `
          <select data-filter-value>
            <option value="">Selecciona...</option>
            ${options}
          </select>
        `;
      }

      return `
        <article class="filter-row" data-filter-id="${escapeDynamicHtml(filter.id)}" data-filter-type="${escapeDynamicHtml(config.type)}">
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
            <button class="button ghost button-small" type="button" data-filter-remove="${escapeDynamicHtml(filter.id)}">Quitar</button>
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

function updateFilter(id, patch, { render = true } = {}) {
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

  if (render) {
    renderFilterBuilder();
  }
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
      ${columns.map((column) => `<th scope="col">${escapeDynamicHtml(column.label)}</th>`).join('')}
    </tr>
  `;

  groupsBody.innerHTML = visibleGroups
    .map((group, index) => {
      const cells = columns.map((column) => {
        if (column.id === 'name') {
          return `
            <td>
              <div class="table-cell-title">
                <strong>${getGroupDataWarning('group', group, group.name || 'Este grupo', { centers: availableCenters })}${escapeDynamicHtml(group.name)}</strong>
                <span>${escapeDynamicHtml(group.center?.name || 'Sin centro')}</span>
              </div>
            </td>
          `;
        }

        if (column.id === 'code') {
          return `<td>${escapeDynamicHtml(group.code || '-')}</td>`;
        }

        if (column.id === 'stage') {
          return `<td><span class="table-badge">${escapeDynamicHtml(stageLabels[group.stage] || group.stage || '-')}</span></td>`;
        }

        if (column.id === 'course') {
          return `<td>${escapeDynamicHtml(group.course || '-')}</td>`;
        }

        if (column.id === 'shift') {
          return `<td>${escapeDynamicHtml(group.shift || '-')}</td>`;
        }

        if (column.id === 'users') {
          return `<td>${escapeDynamicHtml(group.usersCount || 0)}</td>`;
        }

        if (column.id === 'actions') {
          const openAction = canManageGroupMembers()
            ? `<button class="button ghost table-row-action" type="button" data-group-manage="${escapeDynamicHtml(group.id)}">Gestionar usuarios</button>`
            : `<button class="button ghost table-row-action" type="button" data-group-view="${escapeDynamicHtml(group.id)}">Ver</button>`;
          const recordActions = canManageGroupRecords()
            ? `<button class="button ghost table-row-action" type="button" data-edit-group="${escapeDynamicHtml(group.id)}">Editar</button><button class="button ghost table-row-action" type="button" data-delete-group="${escapeDynamicHtml(group.id)}">Eliminar</button>`
            : '';
          return `<td class="table-cell-actions">${openAction}${recordActions}</td>`;
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

  if (currentGroupsRole === 'STUDENT') {
    visibleGroups = groups;
    selectedGroupId = groups[0]?.id || null;
    const group = groups[0] || null;
    if (studentGroupName) {
      studentGroupName.textContent = group?.name || 'Sin grupo asignado';
    }
    if (studentGroupDescription) {
      studentGroupDescription.textContent = group
        ? 'Esta es tu clase. Desde tu cuenta solo puedes consultar este grupo.'
        : 'Todavía no tienes un grupo asignado. Tu centro podrá vincularlo cuando esté preparado.';
    }
    return;
  }

  if (!selectedGroupId || !allGroups.some((group) => group.id === selectedGroupId)) {
    selectedGroupId = allGroups[0]?.id || null;
  }

  applyGroupFilters();
}

function renderGroupMembers(groupUsers) {
  if (!groupMembersList) {
    return;
  }

  const editable = canManageGroupMembers();
  if (groupUsers.length === 0) {
    groupMembersList.innerHTML = `
      <article class="empty-state">
        <strong>Este grupo no tiene usuarios</strong>
        <p>${editable ? 'Selecciona un usuario del centro para añadirlo.' : 'La gestión de usuarios la realiza el centro.'}</p>
      </article>
    `;
    return;
  }

  groupMembersList.innerHTML = groupUsers
    .map(
      ({ user, assignment }, index) => `
        <article class="user-row user-row--compact" style="animation-delay:${index * 60}ms">
          <div>
            <strong>${escapeDynamicHtml(user.name)}</strong>
            <span>${escapeDynamicHtml(user.email)}</span>
          </div>
          <div class="user-meta">
            <span>${escapeDynamicHtml(assignment.role)}</span>
            ${editable ? `<button class="button secondary button-small" type="button" data-group-remove="${escapeDynamicHtml(user.id)}">Quitar</button>` : ''}
          </div>
        </article>
      `,
    )
    .join('');
}

function renderAvailableUsers(centerUsers, groupUsers) {
  if (!availableUserSelect || !groupAvailableUsersCard) {
    return;
  }

  if (!canManageGroupMembers()) {
    groupAvailableUsersCard.hidden = true;
    availableUserSelect.innerHTML = '';
    availableUsersCount.textContent = '0';
    return;
  }

  groupAvailableUsersCard.hidden = false;
  const groupUserIds = new Set(groupUsers.map(({ user }) => user.id));
  const assignableRoles = new Set(['STUDENT', 'TEACHER', 'PROFESSIONAL']);
  const availableUsers = centerUsers.filter(({ user }) => {
    const role = String(user.role || '').toUpperCase();
    return user.isActive
      && assignableRoles.has(role)
      && user.id !== groupsCurrentUser?.id
      && !groupUserIds.has(user.id);
  });

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
    .map((entry) => {
      const roleLabels = {
        STUDENT: 'Alumno',
        TEACHER: 'Profesor',
        PROFESSIONAL: 'Profesional',
      };
      const role = String(entry.user.role || '').toUpperCase();
      return `<option value="${escapeDynamicHtml(entry.user.id)}">${escapeDynamicHtml(entry.user.name)} · ${escapeDynamicHtml(roleLabels[role] || role)} (${escapeDynamicHtml(entry.user.email)})</option>`;
    })
    .join('');
}

function renderGroupSelection(groupId) {
  const group = allGroups.find((item) => item.id === groupId) || null;
  selectedGroupId = group ? group.id : null;

  if (!group) {
    if (selectedGroupName) selectedGroupName.textContent = 'Sin grupo';
    if (selectedGroupMeta) selectedGroupMeta.textContent = '-';
    if (selectedGroupKicker) selectedGroupKicker.textContent = 'Detalle';
    if (selectedGroupSummary) selectedGroupSummary.textContent = 'Selecciona un grupo para ver sus datos.';
    if (selectedGroupCenter) selectedGroupCenter.textContent = '-';
    if (groupMembersNote) groupMembersNote.textContent = 'Selecciona un grupo para ver sus miembros.';
    renderGroupMembers([]);
    renderAvailableUsers([], []);
    return;
  }

  if (selectedGroupName) selectedGroupName.textContent = group.name;
  if (selectedGroupMeta) selectedGroupMeta.textContent = `${group.usersCount || 0} usuarios`;
  if (selectedGroupKicker) {
    selectedGroupKicker.textContent = canManageGroupMembers() ? 'Gestión' : 'Detalle del grupo';
  }
  if (selectedGroupSummary) {
    selectedGroupSummary.textContent = canManageGroupMembers()
      ? 'Gestiona miembros y revisa quién está dentro del grupo.'
      : 'Consulta la composición del grupo y sus miembros asignados.';
  }
  if (selectedGroupCenter) selectedGroupCenter.textContent = group.center?.name || 'Sin centro';
  if (groupMembersNote) {
    groupMembersNote.textContent = canManageGroupMembers()
      ? `Gestiona usuarios del grupo ${group.name}.`
      : 'La gestión de usuarios la realiza el centro.';
  }

  const groupCenterId = group.centerId || currentCenterId;
  const hasAvailableCenter = availableCenters.some((center) => center.id === groupCenterId);
  if (groupCenterId) {
    Promise.all([
      loadGroupUsers(group.id),
      hasAvailableCenter ? loadCenterUsers(groupCenterId) : Promise.resolve([]),
    ]).then(([groupUsers, centerUsers]) => {
      currentGroupUsers = groupUsers;
      currentCenterUsers = centerUsers;
      renderGroupMembers(groupUsers);
      renderAvailableUsers(centerUsers, groupUsers);
    }).catch((error) => {
      setMessage(groupFormError, error.message, true);
    });
  }

  if (groupMembersCard) {
    groupMembersCard.classList.toggle('group-management-card--readonly', !canManageGroupMembers());
  }

  if (selectedGroupDetail) {
    selectedGroupDetail.classList.toggle('group-detail-card--readonly', !canManageGroupMembers());
  }
}

async function openGroupManager(groupId) {
  if (!canManageGroupMembers()) {
    selectedGroupId = groupId;
  }
  renderGroupSelection(groupId);
  const title = document.getElementById('group-members-title');
  if (title) {
    title.textContent = canManageGroupMembers() ? 'Gestionar grupo' : 'Ver grupo';
  }
  openModalById('group-members-modal');
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  groupsCurrentUser = response.data.user;
  currentGroupsRole = String(groupsCurrentUser?.role || '').toUpperCase();
  const isStudent = currentGroupsRole === 'STUDENT';
  if (studentGroupPanel) studentGroupPanel.hidden = !isStudent;
  if (groupToolsPanel) groupToolsPanel.hidden = isStudent;
  if (groupsListPanel) groupsListPanel.hidden = isStudent;
  if (createGroupTrigger) {
    createGroupTrigger.hidden = !canCreateGroups();
  }

  if (groupRoleNote) {
    groupRoleNote.textContent = canCreateGroups()
      ? (canManageGroupMembers() ? 'Tienes permisos para crear, editar y gestionar grupos.' : 'Puedes crear y editar grupos, pero la gestión de usuarios la realiza el centro.')
      : 'Solo puedes consultar los grupos asignados.';
  }
}

async function loadAccountSheet() {
  if (!profileNameElement || !profileEmailElement) {
    return;
  }

  const response = await apiRequest('/auth/me');
  const user = response.data.user;
  profileNameElement.textContent = user.name || '-';
  profileEmailElement.textContent = user.email || '-';
}

async function doLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Demo logout: limpiar la sesión local aunque el token sea stateless.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
}

function initializeFormHelpers() {
  if (typeof formHelpers.setupAcademicYearPicker === 'function') {
    groupAcademicYearPicker = formHelpers.setupAcademicYearPicker({
      rootId: groupAcademicYearPickerRoot,
      triggerId: groupAcademicYearTrigger,
      panelId: groupAcademicYearPanel,
      gridId: groupAcademicYearGrid,
      rangeId: groupAcademicYearRange,
      prevId: groupAcademicYearPrev,
      nextId: groupAcademicYearNext,
      hiddenId: groupAcademicYearHidden,
      displayId: groupAcademicYearDisplay,
      summaryId: groupAcademicYearSummary,
      initialYear: new Date().getFullYear(),
    });
  }
}

function resetGroupForm() {
  if (!groupForm) return;
  groupForm.reset();
  groupForm.elements.id.value = '';
  if (groupFormTitle) groupFormTitle.textContent = 'Crear grupo';
  setMessage(groupFormError, '', true);
  setMessage(groupFormSuccess, '', false);
  groupAcademicYearPicker?.setValue(new Date().getFullYear());
  setGroupFormLoading(false);
}

function openEditGroup(groupId) {
  const group = allGroups.find((item) => item.id === groupId);
  if (!group || !canManageGroupRecords() || !groupForm) return;

  resetGroupForm();
  groupForm.elements.id.value = group.id;
  groupForm.elements.name.value = group.name || '';
  groupForm.elements.code.value = group.code || '';
  groupForm.elements.stage.value = group.stage || '';
  groupForm.elements.course.value = group.course || '';
  const shift = groupForm.querySelector(`[name="shift"][value="${group.shift}"]`);
  if (shift) shift.checked = true;
  const startYear = String(group.academicYear?.label || '').match(/^\d{4}/)?.[0];
  if (startYear) groupAcademicYearPicker?.setValue(startYear);
  if (groupFormTitle) groupFormTitle.textContent = `Editar ${group.name}`;
  setGroupFormLoading(false);
  openModalById('create-group-modal');
}

async function deleteGroup(groupId) {
  const group = allGroups.find((item) => item.id === groupId);
  if (!group || !canManageGroupRecords()) return;

  try {
    const response = await apiRequest(`/deletion-impact/groups/${encodeURIComponent(groupId)}`);
    const confirmed = await showDestructiveActionConfirm({
      title: `Eliminar ${group.name}`,
      description: 'El grupo se eliminará definitivamente. Los usuarios vinculados que permanezcan mostrarán un aviso de grupo eliminado.',
      effects: response.data.impact.effects || [],
      confirmLabel: 'Sí, eliminar grupo',
    });
    if (!confirmed) return;

    await apiRequest(`/groups/${encodeURIComponent(groupId)}`, { method: 'DELETE' });
    if (selectedGroupId === groupId) selectedGroupId = null;
    await refreshGroupManagement();
    setBanner(`${group.name} se ha eliminado correctamente.`, 'success');
  } catch (error) {
    setBanner(error.message || 'No se pudo eliminar el grupo.', 'error');
  }
}

async function loadCentersAndGroups() {
  if (currentGroupsRole === 'STUDENT') {
    await loadAllGroups();
    return;
  }

  const response = await apiRequest('/centers');
  renderCenters(response.data.centers || []);

  if (currentGroupsRole === 'ADMIN') {
    await loadAllGroups();
    return;
  }

  if (currentCenterId) {
    await loadGroups(currentCenterId);
    return;
  }

  renderGroups([]);
}

async function loadAllGroups() {
  const response = await apiRequest('/groups');
  const groups = response.data.groups || [];
  renderGroups(groups);
  return groups;
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
  if (currentGroupsRole === 'STUDENT') {
    await loadAllGroups();
    return;
  }

  if (currentGroupsRole === 'ADMIN') {
    await loadAllGroups();
    if (selectedGroupId) renderGroupSelection(selectedGroupId);
    return;
  }

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
  const isFieldChange = event.target.matches('[data-filter-field]');
  const value = isFieldChange ? '' : (row.querySelector('[data-filter-value]')?.value || '');

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

  updateFilter(filterId, { field, operator, value }, { render: false });
});

groupForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(groupFormError, '', true);
  setMessage(groupFormSuccess, '', false);
  setBanner('', 'success');

  if (!currentCenterId) {
    setMessage(groupFormError, 'Selecciona un centro antes de crear el grupo.', true);
    setBanner('Selecciona un centro antes de crear el grupo.', 'error');
    return;
  }

  const formData = new FormData(groupForm);
  const groupId = formData.get('id');
  const payload = {
    name: formData.get('name'),
    code: formData.get('code'),
    stage: formData.get('stage') || undefined,
    academicYearId: formData.get('academicYearId') || undefined,
    course: formData.get('course') || undefined,
    shift: formData.get('shift') || undefined,
  };

  try {
    setGroupFormLoading(true);
    setBanner(groupId ? 'Guardando cambios...' : 'Creando grupo...', 'loading');
    const response = await apiRequest(groupId ? `/groups/${encodeURIComponent(groupId)}` : `/centers/${currentCenterId}/groups`, {
      method: groupId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });

    setBanner(groupId ? 'Grupo actualizado correctamente.' : 'Grupo creado correctamente.', 'success');
    setMessage(groupFormSuccess, groupId ? 'Grupo actualizado correctamente.' : 'Grupo creado correctamente.');
    selectedGroupId = response.data.group.id;
    await loadGroups(currentCenterId);
    closeModalById('create-group-modal');
    resetGroupForm();
  } catch (error) {
    setBanner(error.message || 'No se pudo crear el grupo.', 'error');
    setMessage(groupFormError, error.message, true);
  } finally {
    setGroupFormLoading(false);
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
  const viewButton = event.target.closest('[data-group-view]');
  if (viewButton) {
    await openGroupManager(viewButton.getAttribute('data-group-view'));
    return;
  }

  const button = event.target.closest('[data-group-manage]');
  const editButton = event.target.closest('[data-edit-group]');
  const deleteButton = event.target.closest('[data-delete-group]');
  if (editButton) {
    openEditGroup(editButton.getAttribute('data-edit-group'));
    return;
  }
  if (deleteButton) {
    await deleteGroup(deleteButton.getAttribute('data-delete-group'));
    return;
  }
  if (!button) return;

  if (!canManageGroupMembers()) {
    await openGroupManager(button.getAttribute('data-group-manage'));
    return;
  }

  await openGroupManager(button.getAttribute('data-group-manage'));
});

groupMembersList?.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-group-remove]');
  if (!button) {
    return;
  }

  if (!canManageGroupMembers()) {
    return;
  }

  const group = getSelectedGroup();
  if (!group) {
    return;
  }

  try {
    const userId = button.getAttribute('data-group-remove');
    const member = currentGroupUsers.find((entry) => entry.user.id === userId)?.user;
    const response = await apiRequest(`/deletion-impact/group-users/${encodeURIComponent(group.id)}?relatedId=${encodeURIComponent(userId)}`);
    const confirmed = await showDestructiveActionConfirm({
      title: `Quitar a ${member?.name || 'este usuario'}`,
      description: `Dejará de pertenecer al grupo ${group.name}.`,
      effects: response.data.impact.effects || [],
      confirmLabel: 'Sí, quitar del grupo',
    });
    if (!confirmed) return;

    await apiRequest(`/groups/${group.id}/users/${userId}`, {
      method: 'DELETE',
    });
    await openGroupManager(group.id);
    await refreshGroupManagement();
  } catch (error) {
    setMessage(groupFormError, error.message, true);
  }
});

createGroupTrigger?.addEventListener('click', resetGroupForm);

addUserToGroupButton?.addEventListener('click', async () => {
  if (!canManageGroupMembers()) {
    return;
  }

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
    await sessionReady;
    initializeFormHelpers();
    await loadProfile();
    await loadAccountSheet();
    await loadCentersAndGroups();

    if (currentGroupsRole === 'STUDENT') {
      window.UnicornioAppLoading?.markPageReady();
      return;
    }

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
    window.UnicornioAppLoading?.markPageReady();
  } catch (error) {
    if (error.status === 401) {
      clearToken();
      window.location.href = '/login.html';
      return;
    }

    setMessage(groupFormError, error.message || 'No se pudieron cargar los grupos.', true);
    window.UnicornioAppLoading?.markPageReady();
  }
}

init();

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
    closeModalById('profile-modal');
  }
});
