const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const userDetailModal = document.getElementById('user-detail-modal');
const userDetailModalTitle = document.getElementById('user-detail-modal-title');
const userDetailNameElement = document.getElementById('user-detail-name');
const userDetailEmailElement = document.getElementById('user-detail-email');
const userDetailRoleElement = document.getElementById('user-detail-role');
const userDetailSchoolElement = document.getElementById('user-detail-school');
const userDetailLinkedStudentElement = document.getElementById('user-detail-linked-student');
const userDetailAssignmentsElement = document.getElementById('user-detail-assignments');
const userDetailEditForm = document.getElementById('user-detail-edit-form');
const userEditTitleElement = document.getElementById('user-edit-title');
const userEditHintElement = document.getElementById('user-edit-hint');
const userEditErrorElement = document.getElementById('user-edit-error');
const userEditSuccessElement = document.getElementById('user-edit-success');
const introElement = document.getElementById('dashboard-intro');
const adminPanel = document.getElementById('admin-panel');
const createUserForm = document.getElementById('create-user-form');
const createUserError = document.getElementById('create-user-error');
const createUserSuccess = document.getElementById('create-user-success');
const refreshUsersButton = document.getElementById('refresh-users-button');
const createUserRoleSelect = document.getElementById('create-user-role');
const createUserCenterField = document.getElementById('create-user-center-field');
const createUserStudentField = document.getElementById('create-user-student-field');
const adminSchoolSelect = document.getElementById('admin-school-select');
const adminStudentSelect = document.getElementById('admin-student-select');
const createUserHint = document.getElementById('create-user-hint');
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
const professionalPanel = document.getElementById('professional-panel');
const professionalPanelNote = document.getElementById('professional-panel-note');
const professionalCenterCity = document.getElementById('professional-center-city');
const professionalCenterName = document.getElementById('professional-center-name');
const professionalCenterLine = document.getElementById('professional-center-line');
const professionalConsentsCount = document.getElementById('professional-consents-count');
const professionalCenterStatus = document.getElementById('professional-center-status');
const professionalCenterSummary = document.getElementById('professional-center-summary');
const professionalValidCount = document.getElementById('professional-valid-count');
const professionalPendingCount = document.getElementById('professional-pending-count');
const professionalOtherCount = document.getElementById('professional-other-count');
const professionalLegalLink = document.getElementById('professional-legal-link');

let currentUser = null;
let currentEditingUserId = null;
let availableCenters = [];
let availableCenterStudents = [];
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
  TEACHER: 'Profesor',
  PROFESSIONAL: 'Profesional autorizado',
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
    { id: 'linkedStudent', label: 'Estudiante vinculado', visible: true },
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

function getUserLabel(userId) {
  const user = adminUsers.find((item) => item.id === userId) || availableCenterStudents.find((item) => item.id === userId);
  return user ? user.name : 'Sin vincular';
}

function getActiveStudents() {
  return adminUsers.filter((user) => String(user.role || '').toUpperCase() === 'STUDENT' && user.isActive);
}

function isRoleRequiringCenter(role) {
  return ['TEACHER', 'PROFESSIONAL', 'STUDENT'].includes(String(role || '').toUpperCase());
}

function isFamilyRole(role) {
  return String(role || '').toUpperCase() === 'FAMILY';
}

function getCreateUserFieldMode(role) {
  const normalizedRole = String(role || '').toUpperCase();

  if (normalizedRole === 'FAMILY') {
    return 'student';
  }

  if (['STUDENT', 'TEACHER', 'PROFESSIONAL'].includes(normalizedRole)) {
    return 'center';
  }

  return 'none';
}

function updateCreateUserHint() {
  if (!createUserHint || !createUserRoleSelect) {
    return;
  }

  const role = createUserRoleSelect.value;
  const fieldMode = getCreateUserFieldMode(role);

  if (fieldMode === 'student') {
    createUserHint.textContent = 'Las familias solo necesitan un estudiante vinculado.';
    return;
  }

  if (fieldMode === 'center') {
    createUserHint.textContent = role === 'TEACHER'
      ? 'El profesor se asigna a un centro y a sus grupos.'
      : 'Este tipo de usuario necesita un centro asignado.';
    return;
  }

  if (role === 'ADMIN') {
    createUserHint.textContent = 'Las cuentas de administración no necesitan centro ni estudiante vinculado.';
    return;
  }

  createUserHint.textContent = 'El tipo de cuenta determina qué relaciones se deben completar.';
}

function updateCreateUserFieldVisibility() {
  if (!createUserRoleSelect) {
    return;
  }

  const role = createUserRoleSelect.value;
  const fieldMode = getCreateUserFieldMode(role);

  if (createUserCenterField) {
    createUserCenterField.hidden = fieldMode !== 'center';
    createUserCenterField.style.display = fieldMode === 'center' ? '' : 'none';
  }

  if (createUserStudentField) {
    createUserStudentField.hidden = fieldMode !== 'student';
    createUserStudentField.style.display = fieldMode === 'student' ? '' : 'none';
  }

  if (fieldMode === 'student') {
    renderFamilyStudentOptions(adminStudentSelect?.value || '');
  }

  updateCreateUserHint();
}

function renderStudentOptions(students, selectedId = '') {
  if (!adminStudentSelect) {
    return;
  }

  availableCenterStudents = students;

  if (!students.length) {
    adminStudentSelect.innerHTML = '<option value="">No hay estudiantes en este centro</option>';
    adminStudentSelect.disabled = true;
    return;
  }

  adminStudentSelect.disabled = false;
  adminStudentSelect.innerHTML = `
    <option value="">Selecciona un estudiante</option>
    ${students.map((student) => `<option value="${student.id}" ${student.id === selectedId ? 'selected' : ''}>${student.name} (${student.email})</option>`).join('')}
  `;
}

function renderFamilyStudentOptions(selectedId = '') {
  const students = adminUsers.filter((user) => String(user.role || '').toUpperCase() === 'STUDENT' && user.isActive);
  renderStudentOptions(students, selectedId);
}

async function loadStudentsForCenter(centerId) {
  if (!adminStudentSelect) {
    return;
  }

  if (!centerId) {
    adminStudentSelect.innerHTML = '<option value="">Selecciona un centro primero</option>';
    adminStudentSelect.disabled = true;
    availableCenterStudents = [];
    return;
  }

  const response = await apiRequest(`/centers/${centerId}/users`);
  const students = (response.data.users || []).filter((user) => String(user.role || '').toUpperCase() === 'STUDENT' && user.isActive);
  renderStudentOptions(students);
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

        if (column.id === 'linkedStudent') {
          return `<td>${user.linkedStudentId ? getUserLabel(user.linkedStudentId) : 'Sin vincular'}</td>`;
        }

        if (column.id === 'status') {
          return `<td>${user.isActive ? 'Activo' : 'Inactivo'}</td>`;
        }

        if (column.id === 'actions') {
          return `
            <td class="table-cell-actions">
              <button class="button ghost table-row-action" type="button" data-row-user="${user.id}">Editar</button>
            </td>
          `;
        }

        return `<td>-</td>`;
      });

      return `<tr style="animation-delay: ${index * 60}ms">${cells.join('')}</tr>`;
    })
    .join('');
}

adminUsersBody?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-row-user]');
  if (!button) {
    return;
  }

  openUserDetail(button.getAttribute('data-row-user'));
});

function renderAdminUsers(users) {
  adminUsers = users;
  renderAdminUsersTable();
}

function renderUserAssignments(assignments) {
  if (!userDetailAssignmentsElement) {
    return;
  }

  const centerAssignments = assignments?.centers || [];
  const groupAssignments = assignments?.groups || [];
  const items = [];

  items.push(`<div class="toggle-row"><span>Centros: ${centerAssignments.length}</span></div>`);
  centerAssignments.forEach((assignment) => {
    items.push(`<div class="toggle-row"><span>${assignment.center?.name || 'Centro sin nombre'}</span></div>`);
  });

  items.push(`<div class="toggle-row"><span>Grupos: ${groupAssignments.length}</span></div>`);
  groupAssignments.forEach((assignment) => {
    items.push(`<div class="toggle-row"><span>${assignment.group?.name || 'Grupo sin nombre'}</span></div>`);
  });

  userDetailAssignmentsElement.innerHTML = items.join('');
}

async function openUserDetail(userId) {
  try {
    const [userResponse, assignmentsResponse] = await Promise.all([
      apiRequest(`/users/${userId}`),
      apiRequest(`/users/${userId}/assignments`),
    ]);

    const user = userResponse.data.user;
    const assignments = assignmentsResponse.data;

    if (userDetailNameElement) {
      userDetailNameElement.textContent = user.name || '-';
    }
    if (userDetailEmailElement) {
      userDetailEmailElement.textContent = user.email || '-';
    }
    if (userDetailRoleElement) {
      userDetailRoleElement.textContent = roleLabels[user.role] || user.role || '-';
    }
    if (userDetailSchoolElement) {
      userDetailSchoolElement.textContent = getCenterLabel(user.schoolId);
    }
    if (userDetailLinkedStudentElement) {
      userDetailLinkedStudentElement.textContent = user.linkedStudentId ? getUserLabel(user.linkedStudentId) : 'Sin vincular';
    }

    currentEditingUserId = user.id;
    if (userDetailModalTitle) {
      userDetailModalTitle.textContent = String(currentUser?.role || '').toUpperCase() === 'ADMIN'
        ? 'Editar usuario'
        : 'Detalle de usuario';
    }
    if (userDetailEditForm) {
      userDetailEditForm.hidden = String(currentUser?.role || '').toUpperCase() !== 'ADMIN';
      if (userDetailEditForm.hidden) {
        setMessage(userEditErrorElement, '', true);
        setMessage(userEditSuccessElement, '', false);
      } else {
        const nameInput = userDetailEditForm.querySelector('[name="name"]');
        const emailInput = userDetailEditForm.querySelector('[name="email"]');
        const passwordInput = userDetailEditForm.querySelector('[name="password"]');
        if (nameInput) nameInput.value = user.name || '';
        if (emailInput) emailInput.value = user.email || '';
        if (passwordInput) passwordInput.value = '';
        if (userEditTitleElement) {
          userEditTitleElement.textContent = `Editar ${user.name || 'usuario'}`;
        }
        if (userEditHintElement) {
          userEditHintElement.textContent = 'Puedes corregir nombre, email y regenerar la contraseña si hace falta.';
        }
      }
    }

    renderUserAssignments(assignments);
    openModalById('user-detail-modal');
  } catch (error) {
    if (userEditErrorElement) {
      setMessage(userEditErrorElement, error.message, true);
    } else {
      setMessage(createUserError, error.message, true);
    }
  }
}

async function loadAdminUsers() {
  const response = await apiRequest('/users');
  renderAdminUsers(response.data.users || []);
  if (isFamilyRole(createUserRoleSelect?.value)) {
    renderFamilyStudentOptions(adminStudentSelect?.value || '');
  }
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
  updateCreateUserFieldVisibility();
  if (isFamilyRole(createUserRoleSelect?.value)) {
    renderFamilyStudentOptions();
  } else if (isRoleRequiringCenter(createUserRoleSelect?.value) && adminSchoolSelect.value) {
    await loadStudentsForCenter(adminSchoolSelect.value);
  }
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

async function renderProfessionalPanel(assignments) {
  if (!professionalPanel) {
    return;
  }

  const centers = assignments?.centers || [];
  const center = centers[0]?.center || null;

  setPanelVisible(professionalPanel, true, 'grid');

  if (!center) {
    if (professionalPanelNote) {
      professionalPanelNote.textContent = 'Todavía no hay un centro enlazado a esta cuenta.';
    }
    if (professionalCenterCity) professionalCenterCity.textContent = '-';
    if (professionalCenterName) professionalCenterName.textContent = 'Sin centro';
    if (professionalCenterLine) professionalCenterLine.textContent = 'Vincula la cuenta a un centro para revisar consentimientos.';
    if (professionalConsentsCount) professionalConsentsCount.textContent = '0 consentimientos';
    if (professionalCenterStatus) professionalCenterStatus.textContent = 'Texto legal: -';
    if (professionalCenterSummary) professionalCenterSummary.textContent = 'Vista de consulta';
    if (professionalValidCount) professionalValidCount.textContent = '0';
    if (professionalPendingCount) professionalPendingCount.textContent = '0';
    if (professionalOtherCount) professionalOtherCount.textContent = '0';
    if (professionalLegalLink) {
      professionalLegalLink.href = '/legal.html';
    }
    return;
  }

  const [consentsResponse, legalResponse] = await Promise.allSettled([
    apiRequest(`/consents?centerId=${encodeURIComponent(center.id)}`),
    apiRequest('/legal-text-versions/active'),
  ]);

  const consents = consentsResponse.status === 'fulfilled' ? (consentsResponse.value.data.consents || []) : [];
  const legalVersion = legalResponse.status === 'fulfilled' ? legalResponse.value.data.version : null;
  const pending = consents.filter((consent) => consent.status === 'PENDING').length;
  const accepted = consents.filter((consent) => consent.status === 'ACCEPTED').length;
  const other = consents.length - pending - accepted;

  if (professionalPanelNote) {
    professionalPanelNote.textContent = 'Esta vista es de consulta: estado de consentimientos y texto legal activo del centro.';
  }
  if (professionalCenterCity) professionalCenterCity.textContent = center.city || 'Sin ciudad';
  if (professionalCenterName) professionalCenterName.textContent = center.name;
  if (professionalCenterLine) professionalCenterLine.textContent = formatCenterLine(center);
  if (professionalConsentsCount) professionalConsentsCount.textContent = `${consents.length} consentimientos`;
  if (professionalCenterStatus) {
    professionalCenterStatus.textContent = legalVersion
      ? `Texto legal: ${legalVersion.version}`
      : 'Texto legal: sin versión activa';
  }
  if (professionalCenterSummary) {
    professionalCenterSummary.textContent = legalVersion
      ? legalVersion.title
      : 'Revisión consultiva';
  }
  if (professionalValidCount) professionalValidCount.textContent = String(accepted);
  if (professionalPendingCount) professionalPendingCount.textContent = String(pending);
  if (professionalOtherCount) professionalOtherCount.textContent = String(other);
  if (professionalLegalLink) {
    professionalLegalLink.href = '/legal.html';
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

    if (role === 'SCHOOL' || role === 'TEACHER') {
      introElement.textContent = role === 'TEACHER'
        ? 'Tu grupo y tu centro están listos. Desde aquí puedes revisar cuestionarios y actividad del alumnado.'
        : 'Tu centro está listo. Desde aquí puedes revisar grupos y gestionar la base organizativa.';
      renderSchoolPanel(assignments);
      return;
    }

    if (role === 'PROFESSIONAL') {
      introElement.textContent = 'Tu espacio es de consulta. Aquí puedes revisar el estado de consentimientos y el texto legal activo de tu centro.';
      setPanelVisible(schoolPanel, false);
      await renderProfessionalPanel(assignments);
      return;
    }

    introElement.textContent = 'Acceso personal listo. Puedes revisar tu perfil cuando quieras.';
    setPanelVisible(schoolPanel, false);
    setPanelVisible(professionalPanel, false);
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);
userDetailModal?.querySelector('[data-close-modal="user-detail-modal"]')?.addEventListener('click', () => closeModalById('user-detail-modal'));

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (userDetailModal && !userDetailModal.hidden) {
      closeModalById('user-detail-modal');
      return;
    }

    if (profileModal && !profileModal.hidden) {
      closeModalById('profile-modal');
    }
  }
});

function resetUserEditMessages() {
  setMessage(userEditErrorElement, '', true);
  setMessage(userEditSuccessElement, '', false);
}

if (userDetailEditForm) {
  userDetailEditForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    resetUserEditMessages();

    if (!currentEditingUserId) {
      setMessage(userEditErrorElement, 'No se ha podido identificar el usuario a editar.', true);
      return;
    }

    const formData = new FormData(userDetailEditForm);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
    };

    const password = String(formData.get('password') || '').trim();
    if (password) {
      payload.password = password;
    }

    try {
      await apiRequest(`/users/${currentEditingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      await loadAdminUsers();
      setMessage(userEditSuccessElement, 'Usuario actualizado correctamente.');
      setMessage(createUserSuccess, '', false);
      if (currentEditingUserId) {
        await openUserDetail(currentEditingUserId);
      }
    } catch (error) {
      setMessage(userEditErrorElement, error.message, true);
    }
  });
}

if (createUserForm) {
  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    setMessage(createUserError, '', true);
    setMessage(createUserSuccess, '', false);

    const formData = new FormData(createUserForm);
    const role = formData.get('role');
    const fieldMode = getCreateUserFieldMode(role);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      password: formData.get('password'),
      role,
      schoolId: fieldMode === 'center' ? (formData.get('schoolId') || null) : null,
      linkedStudentId: fieldMode === 'student' ? (formData.get('linkedStudentId') || null) : null,
    };

    if (fieldMode === 'center' && !payload.schoolId) {
      setMessage(createUserError, 'Selecciona un centro para este usuario.', true);
      return;
    }

    if (fieldMode === 'student' && !payload.linkedStudentId) {
      setMessage(createUserError, 'Selecciona un estudiante vinculado para la familia.', true);
      return;
    }

    if (fieldMode === 'student' && payload.linkedStudentId && adminStudentSelect && !availableCenterStudents.some((student) => student.id === payload.linkedStudentId)) {
      setMessage(createUserError, 'El estudiante vinculado no existe o no está disponible.', true);
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
      updateCreateUserFieldVisibility();
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

createUserRoleSelect?.addEventListener('change', async () => {
  updateCreateUserFieldVisibility();
  const fieldMode = getCreateUserFieldMode(createUserRoleSelect.value);

  if (fieldMode !== 'student') {
    if (fieldMode === 'center' && adminSchoolSelect?.value) {
      try {
        await loadStudentsForCenter(adminSchoolSelect.value);
      } catch (error) {
        setMessage(createUserError, error.message, true);
      }
    }
    return;
  }

  renderFamilyStudentOptions(adminStudentSelect?.value || '');
});

adminSchoolSelect?.addEventListener('change', async () => {
  const role = createUserRoleSelect?.value || 'STUDENT';
  const fieldMode = getCreateUserFieldMode(role);

  if (fieldMode !== 'center') {
    return;
  }

  try {
    await loadStudentsForCenter(adminSchoolSelect.value);
  } catch (error) {
    setMessage(createUserError, error.message, true);
  }
});

updateCreateUserFieldVisibility();

loadProfile();
