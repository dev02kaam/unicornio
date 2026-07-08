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
const centerFormError = document.getElementById('center-form-error');
const centerFormSuccess = document.getElementById('center-form-success');
const refreshCentersButton = document.getElementById('refresh-centers');
const centersHead = document.getElementById('centers-head');
const centersBody = document.getElementById('centers-body');
const centersToolbar = document.getElementById('centers-toolbar');
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
let currentCenterSummary = null;
let currentCenterRole = '';
let centerCityCombobox = null;
let centerAcademicYearPicker = null;
const formHelpers = window.UnicornioFormHelpers || {};

const centerTypeLabels = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PRIMARIA_SECUNDARIA: 'Primaria y secundaria',
  OTRO: 'Otro',
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
  schoolCenterNote.textContent = currentCenterRole === 'FAMILY'
    ? 'Solo ves el centro del estudiante vinculado a tu cuenta.'
    : 'Solo ves el centro enlazado a tu cuenta.';
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

function renderCentersTable() {
  if (!centersHead || !centersBody) {
    return;
  }

  const columns = centerColumns.getColumns().filter((column) => column.visible !== false).sort((a, b) => a.order - b.order);

  centersHead.innerHTML = `
    <tr>
      ${columns.map((column) => `<th>${column.label}</th>`).join('')}
    </tr>
  `;

  centersBody.innerHTML = centersData
    .map((center, index) => {
      const cells = columns.map((column) => {
        if (column.id === 'name') {
          return `
            <td>
              <div class="table-cell-title">
                <strong>${center.name}</strong>
                <span>${formatCenterLine(center)}</span>
              </div>
            </td>
          `;
        }

        if (column.id === 'code') {
          return `<td>${center.code || '-'}</td>`;
        }

        if (column.id === 'city') {
          return `<td>${center.city || '-'}</td>`;
        }

        if (column.id === 'type') {
          return `<td><span class="table-badge">${centerTypeLabels[center.type] || center.type || '-'}</span></td>`;
        }

        if (column.id === 'academicYear') {
          return `<td>${center.academicYear?.label || '-'}</td>`;
        }

        if (column.id === 'groups') {
          return `<td>${center.groupsCount || 0}</td>`;
        }

        if (column.id === 'users') {
          return `<td>${center.usersCount || 0}</td>`;
        }

        if (column.id === 'actions') {
          return `
            <td class="table-cell-actions">
              <a class="button ghost table-row-action" href="/groups.html?centerId=${encodeURIComponent(center.id)}">Ver grupos</a>
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
  centerCount.textContent = `${centers.length} ${centers.length === 1 ? 'centro' : 'centros'}`;

  if (getUserRole() === 'SCHOOL' || getUserRole() === 'TEACHER') {
    renderSchoolCenter(centers[0] || null);
    return;
  }

  renderCentersTable();
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
    centerRoleNote.textContent = 'Ves el centro del estudiante vinculado y la información relacionada.';
    centerHeroCopy.textContent = 'La familia consulta el centro derivado del alumno vinculado y su contexto básico.';
  } else {
    centerRoleNote.textContent = 'Solo verás el centro asignado a tu cuenta.';
    centerHeroCopy.textContent = 'Tu cuenta de centro solo muestra sus propios datos y accesos vinculados.';
  }
  setPanelVisible(centersListPanel, false);
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
  const payload = {
    name: formData.get('name'),
    code: formData.get('code'),
    type: formData.get('type') || undefined,
    academicYearId: formData.get('academicYearId') || undefined,
    city: formData.get('city') || undefined,
    userName: formData.get('userName') || undefined,
    userEmail: formData.get('userEmail') || undefined,
    userPassword: formData.get('userPassword') || undefined,
  };

  try {
    const response = await apiRequest('/centers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setMessage(centerFormSuccess, response.message || 'Centro y cuenta vinculada creados correctamente.');
    centerForm.reset();
    if (centerCityCombobox) {
      centerCityCombobox.setValue('');
    } else if (centerCityHidden) {
      centerCityHidden.value = '';
    }
    if (centerAcademicYearPicker) {
      centerAcademicYearPicker.setValue(new Date().getFullYear());
    }
    await loadCenters();
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

init();
