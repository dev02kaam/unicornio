const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const introElement = document.getElementById('dashboard-intro');
const adminPanel = document.getElementById('admin-panel');
const createUserForm = document.getElementById('create-user-form');
const createUserError = document.getElementById('create-user-error');
const createUserSuccess = document.getElementById('create-user-success');
const refreshUsersButton = document.getElementById('refresh-users-button');
const adminSchoolSelect = document.getElementById('admin-school-select');
const adminUsersHead = document.getElementById('admin-users-head');
const adminUsersBody = document.getElementById('admin-users-body');
const schoolPanel = document.getElementById('school-panel');
const schoolPanelNote = document.getElementById('school-panel-note');
const schoolCenterCity = document.getElementById('school-center-city');
const schoolCenterName = document.getElementById('school-center-name');
const schoolCenterLine = document.getElementById('school-center-line');
const schoolCenterGroups = document.getElementById('school-center-groups');
const schoolCenterUsers = document.getElementById('school-center-users');
const schoolCenterStatus = document.getElementById('school-center-status');
const schoolGroupsLink = document.getElementById('school-groups-link');
const schoolGroupsCount = document.getElementById('school-groups-count');

let currentUser = null;
let availableCenters = [];
let adminUsers = [];

const centerTypeLabels = {
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PRIMARIA_SECUNDARIA: 'Primaria y secundaria',
  OTRO: 'Otro',
};

const roleLabels = {
  ADMIN: 'Administrador',
  SCHOOL: 'Centro',
  PROFESSIONAL: 'Profesional',
  STUDENT: 'Alumno',
  FAMILY: 'Familia',
};

const adminUserColumns = setupColumnManager({
  modalId: 'admin-users-columns-modal',
  listId: 'admin-users-columns-list',
  triggerSelector: '[data-open-modal="admin-users-columns-modal"]',
  storageKey: 'unicornio-admin-users-columns',
  defaultColumns: [
    { id: 'name', label: 'Nombre', visible: true },
    { id: 'email', label: 'Email', visible: true },
    { id: 'role', label: 'Rol', visible: true },
    { id: 'school', label: 'Centro', visible: true },
    { id: 'status', label: 'Estado', visible: true },
    { id: 'actions', label: 'Acciones', visible: true },
  ],
  onChange: () => renderAdminUsersTable(),
});

function setPanelVisible(panel, visible, displayValue = 'block') {
  if (!panel) {
    return;
  }

  panel.hidden = !visible;
  panel.style.display = visible ? displayValue : 'none';
}

function setMessage(element, message, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

function formatCenterLine(center) {
  const parts = [];
  if (center.code) {
    parts.push(center.code);
  }
  if (center.type) {
    parts.push(centerTypeLabels[center.type] || center.type);
  }
  if (center.academicYear?.label) {
    parts.push(center.academicYear.label);
  }
  return parts.join(' · ') || 'Centro vinculado';
}

function getCenterLabel(centerId) {
  const center = availableCenters.find((item) => item.id === centerId);
  return center ? center.name : 'Sin vincular';
}

function renderAdminUsersTable() {
  if (!adminUsersHead || !adminUsersBody) {
    return;
  }

  const columns = adminUserColumns
    .getColumns()
    .filter((column) => column.visible !== false)
    .sort((a, b) => a.order - b.order);

  adminUsersHead.innerHTML = `
    <tr>
      ${columns.map((column) => `<th>${column.label}</th>`).join('')}
    </tr>
  `;

  adminUsersBody.innerHTML = adminUsers
    .map((user, index) => {
      const cells = columns.map((column) => {
        if (column.id === 'name') {
          return `
            <td>
              <div class="table-cell-title">
                <strong>${user.name}</strong>
                <span>${user.id}</span>
              </div>
            </td>
          `;
        }

        if (column.id === 'email') {
          return `<td>${user.email}</td>`;
        }

        if (column.id === 'role') {
          return `<td><span class="table-badge">${roleLabels[user.role] || user.role}</span></td>`;
        }

        if (column.id === 'school') {
          return `<td>${getCenterLabel(user.schoolId)}</td>`;
        }

        if (column.id === 'status') {
          return `<td>${user.isActive ? 'Activo' : 'Inactivo'}</td>`;
        }

        if (column.id === 'actions') {
          return `
            <td class="table-cell-actions">
              <button class="button ghost table-row-action" type="button" data-row-user="${user.id}">Ver</button>
            </td>
          `;
        }

        return `<td>-</td>`;
      });

      return `<tr style="animation-delay: ${index * 60}ms">${cells.join('')}</tr>`;
    })
    .join('');
}

function renderAdminUsers(users) {
  adminUsers = users;
  renderAdminUsersTable();
}

async function loadAdminUsers() {
  const response = await apiRequest('/users');
  renderAdminUsers(response.data.users || []);
}

async function loadCentersForAdmin() {
  if (!adminSchoolSelect) {
    return;
  }

  const response = await apiRequest('/centers');
  availableCenters = response.data.centers || [];

  adminSchoolSelect.innerHTML = `
    <option value="">Sin vincular</option>
    ${availableCenters
      .map((center) => `<option value="${center.id}">${center.name}</option>`)
      .join('')}
  `;

  renderAdminUsersTable();
}

function renderSchoolPanel(assignments) {
  if (!schoolPanel) {
    return;
  }

  const centers = assignments?.centers || [];
  const groups = assignments?.groups || [];
  const center = centers[0]?.center || null;
  const centerAssignments = centers[0] || null;
  const groupCount = groups.filter((item) => item.isActive).length;

  if (!center) {
    setPanelVisible(schoolPanel, true, 'grid');
    schoolPanelNote.textContent = 'Todavía no hay un centro enlazado a esta cuenta.';
    schoolCenterCity.textContent = '-';
    schoolCenterName.textContent = 'Sin centro';
    schoolCenterLine.textContent = 'Vincula la cuenta a un centro para ver aquí su espacio.';
    schoolCenterGroups.textContent = '0 grupos';
    schoolCenterUsers.textContent = 'Usuarios: 0';
    schoolCenterStatus.textContent = 'Activo: -';
    schoolGroupsCount.textContent = '0';
    if (schoolGroupsLink) {
      schoolGroupsLink.href = '/groups.html';
    }
    return;
  }

  setPanelVisible(schoolPanel, true, 'grid');
  schoolPanelNote.textContent = 'Esta cuenta ya está enlazada con su centro principal.';
  schoolCenterCity.textContent = center.city || 'Sin ciudad';
  schoolCenterName.textContent = center.name;
  schoolCenterLine.textContent = formatCenterLine(center);
  schoolCenterGroups.textContent = `${center.groupsCount || groupCount} grupos`;
  schoolCenterUsers.textContent = `Usuarios: ${center.usersCount || 0}`;
  schoolCenterStatus.textContent = `Activo: ${center.isActive ? 'Sí' : 'No'}`;
  schoolGroupsCount.textContent = String(groupCount);
  if (schoolGroupsLink) {
    schoolGroupsLink.href = `/groups.html?centerId=${encodeURIComponent(center.id)}`;
  }

  if (centerAssignments?.role) {
    schoolPanelNote.textContent = `Rol vinculado: ${centerAssignments.role}`;
  }
}

async function doLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Logout demo: limpiar la sesion local aunque el token sea stateless.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
}

async function loadProfile() {
  try {
    const response = await apiRequest('/auth/me');
    currentUser = response.data.user;
    profileNameElement.textContent = currentUser.name;
    profileEmailElement.textContent = currentUser.email;

    const role = String(currentUser.role || '').toUpperCase();
    const assignmentsResponse = await apiRequest(`/users/${currentUser.id}/assignments`);
    const assignments = assignmentsResponse.data;

    if (role === 'ADMIN') {
      introElement.textContent = 'Tienes acceso de administración para crear usuarios y revisar el listado básico.';
      setPanelVisible(adminPanel, true, 'grid');
      setPanelVisible(schoolPanel, false);
      await loadCentersForAdmin();
      await loadAdminUsers();
      return;
    }

    setPanelVisible(adminPanel, false);

    if (role === 'SCHOOL') {
      introElement.textContent = 'Tu centro está listo. Desde aquí puedes revisar grupos y gestionar la base organizativa.';
      renderSchoolPanel(assignments);
      return;
    }

    introElement.textContent = 'Acceso personal listo. Puedes revisar tu perfil cuando quieras.';
    setPanelVisible(schoolPanel, false);
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
    closeModalById('profile-modal');
  }
});

if (createUserForm) {
  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(createUserError, '', true);
    setMessage(createUserSuccess, '', false);

    const formData = new FormData(createUserForm);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role'),
      schoolId: formData.get('schoolId') || null,
    };

    if (payload.role === 'SCHOOL' && !payload.schoolId) {
      setMessage(createUserError, 'Selecciona un centro para vincular el usuario de escuela.', true);
      return;
    }

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(createUserSuccess, 'Usuario creado correctamente.');
      createUserForm.reset();
      await loadCentersForAdmin();
      await loadAdminUsers();
    } catch (error) {
      const wait = error.payload?.data?.retryAfterMinutes;
      const extra = wait ? ` Prueba de nuevo en ${wait} min.` : '';
      setMessage(createUserError, `${error.message}${extra}`, true);
    }
  });
}

if (refreshUsersButton) {
  refreshUsersButton.addEventListener('click', async () => {
    try {
      await loadAdminUsers();
    } catch (error) {
      setMessage(createUserError, error.message, true);
    }
  });
}

loadProfile();
