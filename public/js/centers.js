const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const centerAcademicYearPickerRoot = document.getElementById('center-academic-year-picker');
const centerAcademicYearTrigger = document.getElementById('center-academic-year-trigger');
const centerAcademicYearPanel = document.getElementById('center-academic-year-panel');
const centerAcademicYearGrid = document.getElementById('center-academic-year-grid');
const centerAcademicYearRange = document.getElementById('center-academic-year-range');
const centerAcademicYearPrev = document.getElementById('center-academic-year-prev');
const centerAcademicYearNext = document.getElementById('center-academic-year-next');
const centerAcademicYearDisplay = document.getElementById('center-academic-year-display');
const centerAcademicYearSummary = document.getElementById('center-academic-year-summary');
const centerAcademicYearHidden = document.getElementById('center-academic-year-hidden');
const centerCityPickerRoot = document.getElementById('center-city-picker');
const centerCityTrigger = document.getElementById('center-city-trigger');
const centerCityPanel = document.getElementById('center-city-panel');
const centerCitySearch = document.getElementById('center-city-search');
const centerCityMenu = document.getElementById('center-city-menu');
const centerCityHidden = document.getElementById('center-city-hidden');
const centerCityDisplay = document.getElementById('center-city-display');
const centerCitySummary = document.getElementById('center-city-summary');
const centerCityClear = document.getElementById('center-city-clear');
const centerCount = document.getElementById('center-count');
const centerRoleNote = document.getElementById('center-role-note');
const centerHeroCopy = document.getElementById('center-hero-copy');
const centerForm = document.getElementById('center-form');
const centerFormTitle = document.getElementById('create-center-title');
const centerFormSubmit = document.getElementById('center-form-submit');
const centerLinkedAccountFields = document.getElementById('center-linked-account-fields');
const createCenterButton = document.getElementById('create-center-button');
const centerFormError = document.getElementById('center-form-error');
const centerFormSuccess = document.getElementById('center-form-success');
const refreshCentersButton = document.getElementById('refresh-centers');
const centerGlobalSearch = document.getElementById('center-global-search');
const centerFiltersList = document.getElementById('center-filters-list');
const addCenterFilterButton = document.getElementById('add-center-filter');
const clearCenterFiltersButton = document.getElementById('clear-center-filters');
const centersHead = document.getElementById('centers-head');
const centersBody = document.getElementById('centers-body');
const centersToolbar = document.getElementById('centers-toolbar');
const centersFiltersPanel = document.getElementById('centers-filters-panel');
const centersListPanel = document.getElementById('centers-list-panel');
const schoolCenterPanel = document.getElementById('school-center-panel');
const schoolCenterNote = document.getElementById('school-center-note');
const schoolCenterCity = document.getElementById('school-center-city');
const schoolCenterName = document.getElementById('school-center-name');
const schoolCenterLine = document.getElementById('school-center-line');
const schoolCenterStatus = document.getElementById('school-center-status');
const schoolCenterCode = document.getElementById('school-center-code');
const schoolCenterYear = document.getElementById('school-center-year');
const schoolCenterGroups = document.getElementById('school-center-groups');
const schoolCenterUsers = document.getElementById('school-center-users');
const schoolCenterGroupsLink = document.getElementById('school-center-groups-link');

let centersCurrentUser = null;
let centersData = [];
let visibleCenters = [];
let centerFilters = [];
let centerFilterSeed = 0;
let currentCenterSummary = null;
let currentCenterRole = '';
let centerCityCombobox = null;
let centerAcademicYearPicker = null;
const formHelpers = window.UnicornioFormHelpers || {};
const escapeDynamicHtml = window.escapeHtml;
const getCenterDataWarning = window.getDataQualityWarning;
const showDestructiveActionConfirm = window.confirmDestructiveAction;

const centerTypeLabels = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PRIMARIA_SECUNDARIA: 'Primaria y secundaria',
  OTRO: 'Otro',
};

const centerFilterFields = {
  name: { label: 'Nombre', type: 'text', operators: ['contains', 'equals', 'startsWith'] },
  code: { label: 'Código', type: 'text', operators: ['contains', 'equals', 'startsWith'] },
  city: { label: 'Ciudad', type: 'text', operators: ['contains', 'equals', 'startsWith'] },
  type: {
    label: 'Tipo',
    type: 'select',
    operators: ['equals'],
    options: Object.entries(centerTypeLabels).map(([value, label]) => ({ value, label })),
  },
  academicYear: { label: 'Curso escolar', type: 'text', operators: ['contains', 'equals', 'startsWith'] },
  groupsCount: { label: 'Grupos', type: 'number', operators: ['equals', 'greaterThan', 'lessThan'] },
  usersCount: { label: 'Usuarios', type: 'number', operators: ['equals', 'greaterThan', 'lessThan'] },
  status: {
    label: 'Estado',
    type: 'select',
    operators: ['equals'],
    options: [{ value: 'ACTIVE', label: 'Activo' }, { value: 'INACTIVE', label: 'Inactivo' }],
  },
};

const centerOperatorLabels = {
  contains: 'Contiene',
  equals: 'Es exactamente',
  startsWith: 'Empieza por',
  greaterThan: 'Mayor que',
  lessThan: 'Menor que',
};

const centerColumns = setupColumnManager({
  modalId: 'center-columns-modal',
  listId: 'center-columns-list',
  triggerSelector: '[data-open-modal="center-columns-modal"]',
  storageKey: 'unicornio-center-columns',
  defaultColumns: [
    { id: 'name', label: 'Centro', visible: true },
    { id: 'code', label: 'Código', visible: true },
    { id: 'city', label: 'Ciudad', visible: true },
    { id: 'type', label: 'Tipo', visible: true },
    { id: 'academicYear', label: 'Curso escolar', visible: true },
    { id: 'groups', label: 'Grupos', visible: true },
    { id: 'users', label: 'Usuarios', visible: true },
    { id: 'actions', label: 'Acciones', visible: true },
  ],
  onChange: () => renderCentersTable(),
});

function setMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

function setPanelVisible(panel, visible, displayValue = 'block') {
  if (!panel) {
    return;
  }

  panel.hidden = !visible;
  panel.style.display = visible ? displayValue : 'none';
}

function getUserRole() {
  return String(centersCurrentUser?.role || '').toUpperCase();
}

function formatCenterLine(center) {
  const pieces = [];
  if (center.code) pieces.push(center.code);
  if (center.type) pieces.push(centerTypeLabels[center.type] || center.type);
  if (center.academicYear?.label) pieces.push(center.academicYear.label);
  return pieces.join(' · ') || 'Centro base';
}

function renderSchoolCenter(center) {
  currentCenterSummary = center || null;

  if (!schoolCenterPanel) {
    return;
  }

  if (!center) {
    setPanelVisible(schoolCenterPanel, true, 'grid');
    schoolCenterNote.textContent = 'No hay un centro vinculado a esta cuenta.';
    schoolCenterCity.textContent = '-';
    schoolCenterName.textContent = 'Sin centro';
    schoolCenterLine.textContent = 'Pide a un administrador que vincule tu cuenta.';
    schoolCenterStatus.textContent = 'Activo: -';
    schoolCenterCode.textContent = 'Código: -';
    schoolCenterYear.textContent = 'Curso: -';
    schoolCenterGroups.textContent = 'Grupos: 0';
    schoolCenterUsers.textContent = 'Usuarios: 0';
    if (schoolCenterGroupsLink) {
      schoolCenterGroupsLink.href = '/groups.html';
    }
    return;
  }

  setPanelVisible(schoolCenterPanel, true, 'grid');
  if (currentCenterRole === 'FAMILY') {
    schoolCenterNote.textContent = 'Solo ves el centro del alumno asociado a tu cuenta.';
  } else if (currentCenterRole === 'STUDENT') {
    schoolCenterNote.textContent = 'Solo ves tu centro académico asociado a esta cuenta.';
  } else {
    schoolCenterNote.textContent = 'Solo ves el centro enlazado a tu cuenta.';
  }
  schoolCenterCity.textContent = center.city || 'Sin ciudad';
  schoolCenterName.textContent = center.name;
  schoolCenterLine.textContent = formatCenterLine(center);
  schoolCenterStatus.textContent = `Activo: ${center.isActive ? 'Sí' : 'No'}`;
  schoolCenterCode.textContent = `Código: ${center.code || '-'}`;
  schoolCenterYear.textContent = `Curso: ${center.academicYear?.label || '-'}`;
  schoolCenterGroups.textContent = `Grupos: ${center.groupsCount || 0}`;
  schoolCenterUsers.textContent = `Usuarios: ${center.usersCount || 0}`;

  if (schoolCenterGroupsLink) {
    schoolCenterGroupsLink.href = `/groups.html?centerId=${encodeURIComponent(center.id)}`;
  }
}

function getSearchableCenterText(center) {
  return [
    center.name,
    center.code,
    center.city,
    centerTypeLabels[center.type] || center.type,
    center.academicYear?.label,
    String(center.groupsCount ?? ''),
    String(center.usersCount ?? ''),
    center.isActive ? 'Activo' : 'Inactivo',
  ].filter(Boolean).join(' ').toLowerCase();
}

function getCenterFilterValue(center, field) {
  if (field === 'type') return String(center.type || '').toUpperCase();
  if (field === 'status') return center.isActive ? 'ACTIVE' : 'INACTIVE';
  if (field === 'groupsCount' || field === 'usersCount') return Number(center[field] || 0);
  if (field === 'academicYear') return String(center.academicYear?.label || '').toLowerCase();
  return String(center[field] || '').toLowerCase();
}

function matchesCenterFilter(center, filter) {
  const config = centerFilterFields[filter.field];
  if (!config || !filter.operator) return true;

  const rawValue = String(filter.value ?? '').trim();
  if (!rawValue) return true;

  const centerValue = getCenterFilterValue(center, filter.field);
  if (config.type === 'number') {
    const numberValue = Number(rawValue);
    if (Number.isNaN(numberValue)) return true;
    if (filter.operator === 'greaterThan') return centerValue > numberValue;
    if (filter.operator === 'lessThan') return centerValue < numberValue;
    return centerValue === numberValue;
  }

  if (config.type === 'select') return centerValue === rawValue.toUpperCase();
  const normalizedValue = rawValue.toLowerCase();
  if (filter.operator === 'startsWith') return centerValue.startsWith(normalizedValue);
  if (filter.operator === 'equals') return centerValue === normalizedValue;
  return centerValue.includes(normalizedValue);
}

function renderCenterFilterBuilder() {
  if (!centerFiltersList) return;
  if (centerFilters.length === 0) {
    centerFiltersList.innerHTML = '<article class="filter-empty"><strong>Sin filtros activos</strong><p>Usa la búsqueda global o añade condiciones para afinar los resultados.</p></article>';
    return;
  }

  centerFiltersList.innerHTML = centerFilters.map((filter) => {
    const config = centerFilterFields[filter.field] || centerFilterFields.name;
    const fieldOptions = Object.entries(centerFilterFields)
      .map(([key, fieldConfig]) => `<option value="${escapeDynamicHtml(key)}" ${filter.field === key ? 'selected' : ''}>${escapeDynamicHtml(fieldConfig.label)}</option>`).join('');
    const operatorOptions = config.operators
      .map((operator) => `<option value="${escapeDynamicHtml(operator)}" ${filter.operator === operator ? 'selected' : ''}>${escapeDynamicHtml(centerOperatorLabels[operator])}</option>`).join('');
    let valueControl = `<input type="text" data-filter-value value="${escapeDynamicHtml(filter.value ?? '')}" placeholder="Escribe un valor" />`;

    if (config.type === 'number') {
      valueControl = `<input type="number" min="0" step="1" inputmode="numeric" data-filter-value value="${escapeDynamicHtml(filter.value ?? '')}" placeholder="0" />`;
    } else if (config.type === 'select') {
      const options = config.options.map((option) => `<option value="${escapeDynamicHtml(option.value)}" ${String(filter.value || '').toUpperCase() === option.value ? 'selected' : ''}>${escapeDynamicHtml(option.label)}</option>`).join('');
      valueControl = `<select data-filter-value><option value="">Selecciona...</option>${options}</select>`;
    }

    return `<article class="filter-row" data-filter-id="${escapeDynamicHtml(filter.id)}" data-filter-type="${escapeDynamicHtml(config.type)}">
      <label class="filter-row__field"><span>Campo</span><select data-filter-field>${fieldOptions}</select></label>
      <label class="filter-row__field"><span>Operador</span><select data-filter-operator>${operatorOptions}</select></label>
      <label class="filter-row__field"><span>Valor</span>${valueControl}</label>
      <div class="filter-row__actions"><button class="button ghost button-small" type="button" data-filter-remove="${escapeDynamicHtml(filter.id)}">Quitar</button></div>
    </article>`;
  }).join('');
}

function createCenterFilter(partial = {}) {
  const field = partial.field || 'name';
  const config = centerFilterFields[field] || centerFilterFields.name;
  centerFilters.push({ id: `center-filter-${++centerFilterSeed}`, field, operator: partial.operator || config.operators[0], value: partial.value ?? '' });
  renderCenterFilterBuilder();
  applyCenterFilters();
}

function updateCenterFilter(id, patch, { render = true } = {}) {
  centerFilters = centerFilters.map((filter) => {
    if (filter.id !== id) return filter;
    const next = { ...filter, ...patch };
    const config = centerFilterFields[next.field] || centerFilterFields.name;
    if (!config.operators.includes(next.operator)) next.operator = config.operators[0];
    return next;
  });
  if (render) renderCenterFilterBuilder();
  applyCenterFilters();
}

function removeCenterFilter(id) {
  centerFilters = centerFilters.filter((filter) => filter.id !== id);
  renderCenterFilterBuilder();
  applyCenterFilters();
}

function clearCenterFilters() {
  centerFilters = [];
  if (centerGlobalSearch) centerGlobalSearch.value = '';
  renderCenterFilterBuilder();
  applyCenterFilters();
}

function applyCenterFilters() {
  const query = String(centerGlobalSearch?.value || '').trim().toLowerCase();
  visibleCenters = centersData.filter((center) => (!query || getSearchableCenterText(center).includes(query)) && centerFilters.every((filter) => matchesCenterFilter(center, filter)));
  if (getUserRole() === 'ADMIN' && centerCount) {
    centerCount.textContent = `${visibleCenters.length} ${visibleCenters.length === 1 ? 'centro' : 'centros'}`;
  }
  renderCentersTable();
}

function renderCentersTable() {
  if (!centersHead || !centersBody) {
    return;
  }

  const columns = centerColumns.getColumns().filter((column) => column.visible !== false).sort((a, b) => a.order - b.order);

  centersHead.innerHTML = `
    <tr>
      ${columns.map((column) => `<th scope="col">${escapeDynamicHtml(column.label)}</th>`).join('')}
    </tr>
  `;

  if (!visibleCenters.length) {
    centersBody.innerHTML = '<tr><td colspan="99"><article class="empty-state"><strong>No hay centros que coincidan</strong><p>Prueba a quitar filtros o a buscar por otro campo.</p></article></td></tr>';
    return;
  }

  centersBody.innerHTML = visibleCenters
    .map((center, index) => {
      const cells = columns.map((column) => {
        if (column.id === 'name') {
          return `
            <td>
              <div class="table-cell-title">
                <strong>${getCenterDataWarning('center', center, center.name || 'Este centro')}${escapeDynamicHtml(center.name)}</strong>
                <span>${escapeDynamicHtml(formatCenterLine(center))}</span>
              </div>
            </td>
          `;
        }

        if (column.id === 'code') {
          return `<td>${escapeDynamicHtml(center.code || '-')}</td>`;
        }

        if (column.id === 'city') {
          return `<td>${escapeDynamicHtml(center.city || '-')}</td>`;
        }

        if (column.id === 'type') {
          return `<td><span class="table-badge">${escapeDynamicHtml(centerTypeLabels[center.type] || center.type || '-')}</span></td>`;
        }

        if (column.id === 'academicYear') {
          return `<td>${escapeDynamicHtml(center.academicYear?.label || '-')}</td>`;
        }

        if (column.id === 'groups') {
          return `<td>${escapeDynamicHtml(center.groupsCount || 0)}</td>`;
        }

        if (column.id === 'users') {
          return `<td>${escapeDynamicHtml(center.usersCount || 0)}</td>`;
        }

        if (column.id === 'actions') {
          return `
            <td class="table-cell-actions">
              <a class="button ghost table-row-action" href="/groups.html?centerId=${escapeDynamicHtml(encodeURIComponent(center.id))}">Ver grupos</a>
              <button class="button ghost table-row-action" type="button" data-edit-center="${escapeDynamicHtml(center.id)}">Editar</button>
              <button class="button ghost table-row-action" type="button" data-delete-center="${escapeDynamicHtml(center.id)}">Eliminar</button>
            </td>
          `;
        }

        return '<td>-</td>';
      });

      return `<tr style="animation-delay:${index * 50}ms">${cells.join('')}</tr>`;
    })
    .join('');
}

function renderCenters(centers) {
  centersData = centers;
  visibleCenters = centers;
  centerCount.textContent = `${centers.length} ${centers.length === 1 ? 'centro' : 'centros'}`;

  if (getUserRole() !== 'ADMIN') {
    renderSchoolCenter(centers[0] || null);
    return;
  }

  applyCenterFilters();
}

async function loadCenters() {
  const response = await apiRequest('/centers');
  renderCenters(response.data.centers || []);
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  centersCurrentUser = response.data.user;
  currentCenterRole = getUserRole();
  const role = currentCenterRole;

  if (role === 'ADMIN') {
    centerRoleNote.textContent = 'Puedes crear, editar y revisar todos los centros.';
    centerHeroCopy.textContent = 'Consulta los centros disponibles, crea el centro y su cuenta vinculada en un único paso y entra a sus grupos con un clic.';
    setPanelVisible(centersFiltersPanel, true, 'block');
    setPanelVisible(centersListPanel, true, 'grid');
    setPanelVisible(schoolCenterPanel, false);
    if (centersToolbar) {
      centersToolbar.hidden = false;
    }
    if (centerForm) {
      centerForm.closest('.modal')?.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  if (role === 'TEACHER') {
    centerRoleNote.textContent = 'Ves el centro al que perteneces y los accesos de tu grupo.';
    centerHeroCopy.textContent = 'El profesor consulta su centro, sus grupos y la actividad asociada.';
  } else if (role === 'FAMILY') {
    centerRoleNote.textContent = 'Ves el centro del alumno asociado a tu cuenta.';
    centerHeroCopy.textContent = 'La familia consulta un resumen del centro del alumno, con sus datos básicos y accesos disponibles.';
  } else if (role === 'STUDENT') {
    centerRoleNote.textContent = 'Ves tu centro académico asociado a tu cuenta.';
    centerHeroCopy.textContent = 'El alumno consulta un resumen de su centro, con los datos básicos y los accesos que necesita.';
  } else {
    centerRoleNote.textContent = 'Solo verás el centro asignado a tu cuenta.';
    centerHeroCopy.textContent = 'Tu cuenta de centro solo muestra sus propios datos y accesos vinculados.';
  }
  setPanelVisible(centersListPanel, false);
  setPanelVisible(centersFiltersPanel, false);
  setPanelVisible(schoolCenterPanel, true, 'grid');
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

function initializeFormHelpers() {
  if (typeof formHelpers.setupAcademicYearPicker === 'function') {
    centerAcademicYearPicker = formHelpers.setupAcademicYearPicker({
      rootId: centerAcademicYearPickerRoot,
      triggerId: centerAcademicYearTrigger,
      panelId: centerAcademicYearPanel,
      gridId: centerAcademicYearGrid,
      rangeId: centerAcademicYearRange,
      prevId: centerAcademicYearPrev,
      nextId: centerAcademicYearNext,
      hiddenId: centerAcademicYearHidden,
      displayId: centerAcademicYearDisplay,
      summaryId: centerAcademicYearSummary,
      initialYear: new Date().getFullYear(),
    });
  }

  if (typeof formHelpers.setupCityCombobox === 'function') {
    centerCityCombobox = formHelpers.setupCityCombobox({
      rootId: centerCityPickerRoot,
      triggerId: centerCityTrigger,
      panelId: centerCityPanel,
      searchId: centerCitySearch,
      menuId: centerCityMenu,
      hiddenId: centerCityHidden,
      displayId: centerCityDisplay,
      summaryId: centerCitySummary,
      clearId: centerCityClear,
    });
  }
}

function resetCenterForm() {
  if (!centerForm) return;
  centerForm.reset();
  centerForm.elements.id.value = '';
  if (centerFormTitle) centerFormTitle.textContent = 'Crear centro';
  if (centerFormSubmit) centerFormSubmit.textContent = 'Crear centro';
  if (centerLinkedAccountFields) centerLinkedAccountFields.hidden = false;
  setMessage(centerFormError, '', true);
  setMessage(centerFormSuccess, '', false);
  centerCityCombobox?.setValue('');
  centerAcademicYearPicker?.setValue(new Date().getFullYear());
}

function openEditCenter(centerId) {
  const center = centersData.find((item) => item.id === centerId);
  if (!center || getUserRole() !== 'ADMIN' || !centerForm) return;

  resetCenterForm();
  centerForm.elements.id.value = center.id;
  centerForm.elements.name.value = center.name || '';
  centerForm.elements.code.value = center.code || '';
  centerForm.elements.type.value = center.type || '';
  centerForm.elements.questionnaireSupportContact.value = center.questionnaireSupportContact || '';
  const startYear = String(center.academicYear?.label || '').match(/^\d{4}/)?.[0];
  if (startYear) centerAcademicYearPicker?.setValue(startYear);
  centerCityCombobox?.setValue(center.city || '');
  if (centerFormTitle) centerFormTitle.textContent = `Editar ${center.name}`;
  if (centerFormSubmit) centerFormSubmit.textContent = 'Guardar cambios';
  if (centerLinkedAccountFields) centerLinkedAccountFields.hidden = true;
  openModalById('create-center-modal');
}

async function deleteCenter(centerId) {
  const center = centersData.find((item) => item.id === centerId);
  if (!center) return;

  try {
    const response = await apiRequest(`/deletion-impact/centers/${encodeURIComponent(centerId)}`);
    const confirmed = await showDestructiveActionConfirm({
      title: `Eliminar ${center.name}`,
      description: 'El centro se eliminará definitivamente. Los grupos, usuarios y consentimientos vinculados que permanezcan mostrarán un aviso de centro eliminado.',
      effects: response.data.impact.effects || [],
      confirmLabel: 'Sí, eliminar centro',
    });
    if (!confirmed) return;

    await apiRequest(`/centers/${encodeURIComponent(centerId)}`, { method: 'DELETE' });
    await loadCenters();
    setMessage(centerFormSuccess, `${center.name} se ha eliminado correctamente.`);
  } catch (error) {
    setMessage(centerFormError, error.message || 'No se pudo eliminar el centro.', true);
  }
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

async function init() {
  try {
    initializeFormHelpers();
    await loadProfile();
    await loadAccountSheet();
    await loadCenters();
    renderCenterFilterBuilder();
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

centerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage(centerFormError, '', true);
  setMessage(centerFormSuccess, '', false);

  const formData = new FormData(centerForm);
  const centerId = formData.get('id');
  const payload = {
    name: formData.get('name'),
    code: formData.get('code'),
    type: formData.get('type') || undefined,
    academicYearId: formData.get('academicYearId') || undefined,
    city: formData.get('city') || undefined,
    questionnaireSupportContact: formData.get('questionnaireSupportContact') || undefined,
  };

  if (!centerId) {
    payload.userName = formData.get('userName') || undefined;
    payload.userEmail = formData.get('userEmail') || undefined;
    payload.userPassword = formData.get('userPassword') || undefined;
  }

  try {
    const response = await apiRequest(centerId ? `/centers/${encodeURIComponent(centerId)}` : '/centers', {
      method: centerId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });

    setMessage(centerFormSuccess, response.message || (centerId ? 'Centro actualizado correctamente.' : 'Centro y cuenta vinculada creados correctamente.'));
    await loadCenters();
    closeModalById('create-center-modal');
    resetCenterForm();
  } catch (error) {
    setMessage(centerFormError, error.message, true);
  }
});

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
    closeModalById('profile-modal');
  }
});

refreshCentersButton?.addEventListener('click', async () => {
  try {
    await loadCenters();
  } catch (error) {
    setMessage(centerFormError, error.message, true);
  }
});

addCenterFilterButton?.addEventListener('click', () => createCenterFilter());
clearCenterFiltersButton?.addEventListener('click', clearCenterFilters);
centerGlobalSearch?.addEventListener('input', applyCenterFilters);

centerFiltersList?.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-filter-remove]');
  if (removeButton) removeCenterFilter(removeButton.getAttribute('data-filter-remove'));
});

centerFiltersList?.addEventListener('change', (event) => {
  const row = event.target.closest('[data-filter-id]');
  if (!row) return;
  const filterId = row.getAttribute('data-filter-id');
  const field = row.querySelector('[data-filter-field]')?.value || 'name';
  const config = centerFilterFields[field] || centerFilterFields.name;
  const operator = row.querySelector('[data-filter-operator]')?.value || config.operators[0];
  const isFieldChange = event.target.matches('[data-filter-field]');
  const value = isFieldChange ? '' : (row.querySelector('[data-filter-value]')?.value || '');
  updateCenterFilter(filterId, { field, operator, value });
});

centerFiltersList?.addEventListener('input', (event) => {
  const row = event.target.closest('[data-filter-id]');
  if (!row) return;
  const filterId = row.getAttribute('data-filter-id');
  const field = row.querySelector('[data-filter-field]')?.value || 'name';
  const config = centerFilterFields[field] || centerFilterFields.name;
  const operator = row.querySelector('[data-filter-operator]')?.value || config.operators[0];
  const value = row.querySelector('[data-filter-value]')?.value || '';
  updateCenterFilter(filterId, { field, operator, value }, { render: false });
});

createCenterButton?.addEventListener('click', resetCenterForm);
centersBody?.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-center]');
  if (editButton) {
    openEditCenter(editButton.getAttribute('data-edit-center'));
    return;
  }

  const deleteButton = event.target.closest('[data-delete-center]');
  if (deleteButton) deleteCenter(deleteButton.getAttribute('data-delete-center'));
});

init();
