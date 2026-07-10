const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const usersFeedback = document.getElementById('users-feedback');
const usersHead = document.getElementById('users-head');
const usersBody = document.getElementById('users-body');
const usersCount = document.getElementById('users-count');
const userGlobalSearch = document.getElementById('user-global-search');
const userFiltersList = document.getElementById('user-filters-list');
const addUserFilterButton = document.getElementById('add-user-filter');
const clearUserFiltersButton = document.getElementById('clear-user-filters');
const refreshUsersButton = document.getElementById('refresh-users');
const userForm = document.getElementById('user-form');
const userFormTitle = document.getElementById('user-form-title');
const userFormSubmit = document.getElementById('user-form-submit');
const userRole = document.getElementById('user-role');
const userCenterField = document.getElementById('user-center-field');
const userStudentField = document.getElementById('user-student-field');
const userBirthDateField = document.getElementById('user-birth-date-field');
const userBirthDate = document.getElementById('user-birth-date');
const userCenter = document.getElementById('user-center');
const userStudent = document.getElementById('user-student');
const userFormError = document.getElementById('user-form-error');
const userFormSuccess = document.getElementById('user-form-success');

let currentUser = null;
let users = [];
let visibleUsers = [];
let centers = [];
let userFilters = [];
let filterSeed = 0;

const roleLabels = {
  ADMIN: 'Administrador',
  SCHOOL: 'Centro',
  TEACHER: 'Profesor',
  PROFESSIONAL: 'Profesional autorizado',
  STUDENT: 'Alumno',
  FAMILY: 'Familia',
};

const operatorLabels = {
  contains: 'Contiene',
  equals: 'Igual a',
  startsWith: 'Empieza por',
};

const userColumns = setupColumnManager({
  modalId: 'user-columns-modal',
  listId: 'user-columns-list',
  triggerSelector: '[data-open-modal="user-columns-modal"]',
  storageKey: 'unicornio-user-columns',
  defaultColumns: [
    { id: 'name', label: 'Nombre', visible: true },
    { id: 'email', label: 'Email', visible: true },
    { id: 'role', label: 'Rol', visible: true },
    { id: 'birthDate', label: 'Nacimiento', visible: true },
    { id: 'school', label: 'Centro', visible: true },
    { id: 'linkedStudent', label: 'Estudiante vinculado', visible: true },
    { id: 'status', label: 'Estado', visible: true },
    { id: 'actions', label: 'Acciones', visible: true },
  ],
  onChange: () => renderUsers(),
});

function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.hidden = !message;
  element.classList.toggle('error', isError);
  element.classList.toggle('success', !isError);
}

function showFeedback(message, isError = false) {
  if (!usersFeedback) return;
  usersFeedback.textContent = message;
  usersFeedback.hidden = !message;
  usersFeedback.className = `status-banner status-banner--${isError ? 'error' : 'success'}`;
  if (!isError && message) {
    window.setTimeout(() => {
      usersFeedback.hidden = true;
      usersFeedback.textContent = '';
    }, 3000);
  }
}

function getCenterLabel(centerId) {
  const center = centers.find((item) => item.id === centerId);
  return center?.name || 'Sin vincular';
}

function getStudentLabel(studentId) {
  const student = users.find((item) => item.id === studentId);
  return student?.name || 'Sin vincular';
}

function getUserFilterFields() {
  return {
    name: {
      label: 'Nombre',
      type: 'text',
      operators: ['contains', 'equals', 'startsWith'],
    },
    email: {
      label: 'Email',
      type: 'text',
      operators: ['contains', 'equals', 'startsWith'],
    },
    role: {
      label: 'Rol',
      type: 'select',
      operators: ['equals'],
      options: Object.entries(roleLabels).map(([value, label]) => ({ value, label })),
    },
    schoolId: {
      label: 'Centro',
      type: 'select',
      operators: ['equals'],
      options: centers.map((center) => ({ value: center.id, label: center.name })),
    },
    linkedStudentId: {
      label: 'Estudiante vinculado',
      type: 'select',
      operators: ['equals'],
      options: users
        .filter((user) => String(user.role || '').toUpperCase() === 'STUDENT')
        .map((student) => ({ value: student.id, label: student.name })),
    },
    status: {
      label: 'Estado',
      type: 'select',
      operators: ['equals'],
      options: [
        { value: 'ACTIVE', label: 'Activo' },
        { value: 'INACTIVE', label: 'Inactivo' },
      ],
    },
    birthDate: {
      label: 'Nacimiento',
      type: 'text',
      operators: ['contains', 'equals', 'startsWith'],
    },
  };
}

function isStudentRole(role) {
  return String(role || '').toUpperCase() === 'STUDENT';
}

function formatDateOnly(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(date);
}

function getSearchableUserText(user) {
  return [
    user.name,
    user.email,
    roleLabels[user.role] || user.role,
    formatDateOnly(user.birthDate),
    getCenterLabel(user.schoolId),
    user.linkedStudentId ? getStudentLabel(user.linkedStudentId) : 'Sin vincular',
    user.isActive ? 'Activo' : 'Inactivo',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getFilterFieldValue(user, field) {
  if (field === 'role') {
    return String(user.role || '').toUpperCase();
  }
  if (field === 'schoolId') {
    return String(user.schoolId || '');
  }
  if (field === 'linkedStudentId') {
    return String(user.linkedStudentId || '');
  }
  if (field === 'status') {
    return user.isActive ? 'ACTIVE' : 'INACTIVE';
  }
  if (field === 'birthDate') {
    return `${String(user.birthDate || '').toLowerCase()} ${formatDateOnly(user.birthDate).toLowerCase()}`;
  }

  return String(user[field] || '').toLowerCase();
}

function matchesUserFilter(user, filter) {
  const fields = getUserFilterFields();
  const config = fields[filter.field];
  if (!config || !filter.operator) {
    return true;
  }

  const userValue = getFilterFieldValue(user, filter.field);
  const filterValue = String(filter.value || '').trim();
  if (!filterValue) {
    return true;
  }

  if (config.type === 'select') {
    return userValue === filterValue;
  }

  const normalizedValue = filterValue.toLowerCase();
  if (filter.operator === 'startsWith') {
    return userValue.startsWith(normalizedValue);
  }
  if (filter.operator === 'equals') {
    return userValue === normalizedValue;
  }

  return userValue.includes(normalizedValue);
}

function matchesUserSearch(user, query) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return getSearchableUserText(user).includes(normalizedQuery);
}

function renderFilterBuilder() {
  if (!userFiltersList) {
    return;
  }

  if (userFilters.length === 0) {
    userFiltersList.innerHTML = `
      <article class="filter-empty">
        <strong>Sin filtros activos</strong>
        <p>Usa la búsqueda global o añade condiciones para afinar los resultados.</p>
      </article>
    `;
    return;
  }

  const fields = getUserFilterFields();
  userFiltersList.innerHTML = userFilters.map((filter) => {
    const config = fields[filter.field] || fields.name;
    const fieldOptions = Object.entries(fields)
      .map(([key, fieldConfig]) => `<option value="${key}" ${filter.field === key ? 'selected' : ''}>${fieldConfig.label}</option>`)
      .join('');
    const operatorOptions = config.operators
      .map((operator) => `<option value="${operator}" ${filter.operator === operator ? 'selected' : ''}>${operatorLabels[operator]}</option>`)
      .join('');

    let valueControl = `
      <input type="text" data-filter-value value="${filter.value || ''}" placeholder="Escribe un valor" />
    `;

    if (config.type === 'select') {
      const options = config.options
        .map((option) => `<option value="${option.value}" ${String(filter.value || '') === option.value ? 'selected' : ''}>${option.label}</option>`)
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
          <select data-filter-field>${fieldOptions}</select>
        </label>
        <label class="filter-row__field">
          <span>Operador</span>
          <select data-filter-operator>${operatorOptions}</select>
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
  }).join('');
}

function createFilter(partial = {}) {
  const fields = getUserFilterFields();
  const field = partial.field || 'name';
  const config = fields[field] || fields.name;

  userFilters.push({
    id: `user-filter-${++filterSeed}`,
    field,
    operator: partial.operator || config.operators[0],
    value: partial.value || '',
  });

  renderFilterBuilder();
  applyUserFilters();
}

function updateFilter(id, patch) {
  const fields = getUserFilterFields();
  userFilters = userFilters.map((filter) => {
    if (filter.id !== id) {
      return filter;
    }

    const next = { ...filter, ...patch };
    const config = fields[next.field] || fields.name;
    if (!config.operators.includes(next.operator)) {
      next.operator = config.operators[0];
    }

    return next;
  });

  renderFilterBuilder();
  applyUserFilters();
}

function removeFilter(id) {
  userFilters = userFilters.filter((filter) => filter.id !== id);
  renderFilterBuilder();
  applyUserFilters();
}

function clearFilters() {
  userFilters = [];
  if (userGlobalSearch) {
    userGlobalSearch.value = '';
  }
  renderFilterBuilder();
  applyUserFilters();
}

function fieldModeForRole(role) {
  const normalizedRole = String(role || '').toUpperCase();
  if (normalizedRole === 'FAMILY') return 'student';
  if (['STUDENT', 'TEACHER', 'PROFESSIONAL'].includes(normalizedRole)) return 'center';
  return 'none';
}

function updateFieldVisibility() {
  const mode = fieldModeForRole(userRole?.value);
  const needsBirthDate = isStudentRole(userRole?.value);
  if (userCenterField) {
    userCenterField.hidden = mode !== 'center';
    userCenterField.style.display = mode === 'center' ? '' : 'none';
  }
  if (userStudentField) {
    userStudentField.hidden = mode !== 'student';
    userStudentField.style.display = mode === 'student' ? '' : 'none';
  }
  if (userBirthDateField) {
    userBirthDateField.hidden = !needsBirthDate;
    userBirthDateField.style.display = needsBirthDate ? '' : 'none';
  }
  if (userBirthDate) {
    userBirthDate.required = needsBirthDate;
    if (!needsBirthDate) userBirthDate.value = '';
  }
}

function renderSelects() {
  if (userCenter) {
    userCenter.innerHTML = `
      <option value="">Selecciona un centro</option>
      ${centers.map((center) => `<option value="${center.id}">${center.name}</option>`).join('')}
    `;
  }

  if (userStudent) {
    const students = users.filter((user) => user.role === 'STUDENT' && user.isActive);
    userStudent.innerHTML = `
      <option value="">Selecciona un estudiante</option>
      ${students.map((student) => `<option value="${student.id}">${student.name} (${student.email})</option>`).join('')}
    `;
  }
}

function renderUsers() {
  if (!usersHead || !usersBody) return;

  const columns = userColumns.getColumns().filter((column) => column.visible !== false).sort((a, b) => a.order - b.order);
  usersHead.innerHTML = `<tr>${columns.map((column) => `<th>${column.label}</th>`).join('')}</tr>`;

  if (!visibleUsers.length) {
    usersBody.innerHTML = `
      <tr>
        <td colspan="99">
          <article class="empty-state">
            <strong>No hay usuarios que coincidan</strong>
            <p>Prueba a quitar filtros o a buscar por otro campo.</p>
          </article>
        </td>
      </tr>
    `;
    return;
  }

  usersBody.innerHTML = visibleUsers.map((user, index) => {
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
      if (column.id === 'birthDate') {
        return `<td>${isStudentRole(user.role) ? formatDateOnly(user.birthDate) : '-'}</td>`;
      }
      if (column.id === 'school') {
        return `<td>${getCenterLabel(user.schoolId)}</td>`;
      }
      if (column.id === 'linkedStudent') {
        return `<td>${user.linkedStudentId ? getStudentLabel(user.linkedStudentId) : 'Sin vincular'}</td>`;
      }
      if (column.id === 'status') {
        return `<td>${user.isActive ? 'Activo' : 'Inactivo'}</td>`;
      }
      if (column.id === 'actions') {
        return `
          <td class="table-cell-actions">
            <button class="button ghost table-row-action" type="button" data-edit-user="${user.id}">Editar</button>
          </td>
        `;
      }

      return '<td>-</td>';
    });

    return `<tr style="animation-delay:${index * 45}ms">${cells.join('')}</tr>`;
  }).join('');
}

function applyUserFilters() {
  const query = userGlobalSearch?.value || '';
  visibleUsers = users.filter((user) => {
    if (!matchesUserSearch(user, query)) {
      return false;
    }

    return userFilters.every((filter) => matchesUserFilter(user, filter));
  });

  if (usersCount) {
    usersCount.textContent = `${visibleUsers.length} ${visibleUsers.length === 1 ? 'usuario' : 'usuarios'}`;
  }

  renderUsers();
}

function resetForm() {
  if (!userForm) return;
  userForm.reset();
  userForm.elements.id.value = '';
  if (userFormTitle) userFormTitle.textContent = 'Crear usuario';
  if (userFormSubmit) userFormSubmit.textContent = 'Crear usuario';
  setMessage(userFormError, '', true);
  setMessage(userFormSuccess, '', false);
  updateFieldVisibility();
}

function openCreateForm() {
  resetForm();
  openModalById('user-form-modal');
}

function openEditForm(userId) {
  const user = users.find((item) => item.id === userId);
  if (!user || !userForm) return;

  resetForm();
  userForm.elements.id.value = user.id;
  userForm.elements.name.value = user.name || '';
  userForm.elements.email.value = user.email || '';
  userForm.elements.password.value = '';
  userRole.value = user.role || 'STUDENT';
  updateFieldVisibility();
  if (userCenter) userCenter.value = user.schoolId || '';
  if (userStudent) userStudent.value = user.linkedStudentId || '';
  if (userBirthDate) userBirthDate.value = user.birthDate || '';
  if (userFormTitle) userFormTitle.textContent = `Editar ${user.name}`;
  if (userFormSubmit) userFormSubmit.textContent = 'Guardar cambios';
  openModalById('user-form-modal');
}

async function loadData() {
  const [usersResponse, centersResponse] = await Promise.all([
    apiRequest('/users'),
    apiRequest('/centers'),
  ]);
  users = usersResponse.data.users || [];
  centers = centersResponse.data.centers || [];
  renderSelects();
  renderFilterBuilder();
  applyUserFilters();
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  currentUser = response.data.user;
  if (String(currentUser.role || '').toUpperCase() !== 'ADMIN') {
    window.location.replace('/dashboard.html');
    return;
  }
  if (profileNameElement) profileNameElement.textContent = currentUser.name || '-';
  if (profileEmailElement) profileEmailElement.textContent = currentUser.email || '-';
}

async function submitUserForm(event) {
  event.preventDefault();
  setMessage(userFormError, '', true);
  setMessage(userFormSuccess, '', false);

  const formData = new FormData(userForm);
  const userId = formData.get('id');
  const role = formData.get('role');
  const mode = fieldModeForRole(role);
  const isStudent = isStudentRole(role);
  const payload = {
    name: formData.get('name'),
    email: formData.get('email'),
    role,
  };

  if (mode === 'center') {
    payload.schoolId = formData.get('schoolId') || null;
  } else if (mode === 'none') {
    payload.schoolId = null;
  }

  if (mode === 'student') {
    payload.linkedStudentId = formData.get('linkedStudentId') || null;
  }

  if (isStudent) {
    payload.birthDate = formData.get('birthDate') || null;
  } else if (userId) {
    payload.birthDate = null;
  }

  const password = String(formData.get('password') || '').trim();
  if (!userId || password) payload.password = password;

  if (!userId && !password) {
    setMessage(userFormError, 'La contraseña es obligatoria al crear un usuario.', true);
    return;
  }
  if (mode === 'center' && !payload.schoolId) {
    setMessage(userFormError, 'Selecciona un centro para este usuario.', true);
    return;
  }
  if (isStudent && !payload.birthDate) {
    setMessage(userFormError, 'Indica la fecha de nacimiento del alumno.', true);
    return;
  }
  if (mode === 'student' && !payload.linkedStudentId) {
    setMessage(userFormError, 'Selecciona el estudiante vinculado a esta familia.', true);
    return;
  }

  try {
    await apiRequest(userId ? `/users/${userId}` : '/users', {
      method: userId ? 'PATCH' : 'POST',
      body: JSON.stringify(payload),
    });
    await loadData();
    closeModalById('user-form-modal');
    showFeedback(userId ? 'Usuario actualizado correctamente.' : 'Usuario creado correctamente.');
  } catch (error) {
    setMessage(userFormError, getApiErrorMessage(error), true);
  }
}

async function doLogout() {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Demo logout local.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
}

async function init() {
  if (!getToken()) {
    window.location.replace('/login.html');
    return;
  }

  try {
    await loadProfile();
    await loadData();
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

document.querySelector('[data-open-modal="user-form-modal"]')?.addEventListener('click', openCreateForm);
refreshUsersButton?.addEventListener('click', loadData);
addUserFilterButton?.addEventListener('click', () => createFilter());
clearUserFiltersButton?.addEventListener('click', clearFilters);
userGlobalSearch?.addEventListener('input', applyUserFilters);
userRole?.addEventListener('change', updateFieldVisibility);
userForm?.addEventListener('submit', submitUserForm);
usersBody?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-user]');
  if (button) openEditForm(button.getAttribute('data-edit-user'));
});

userFiltersList?.addEventListener('click', (event) => {
  const removeButton = event.target.closest('[data-filter-remove]');
  if (!removeButton) {
    return;
  }

  removeFilter(removeButton.getAttribute('data-filter-remove'));
});

userFiltersList?.addEventListener('change', (event) => {
  const row = event.target.closest('[data-filter-id]');
  if (!row) {
    return;
  }

  const fields = getUserFilterFields();
  const filterId = row.getAttribute('data-filter-id');
  const field = row.querySelector('[data-filter-field]')?.value || 'name';
  const operator = row.querySelector('[data-filter-operator]')?.value || fields[field].operators[0];
  const value = row.querySelector('[data-filter-value]')?.value || '';

  updateFilter(filterId, { field, operator, value });
});

userFiltersList?.addEventListener('input', (event) => {
  const row = event.target.closest('[data-filter-id]');
  if (!row) {
    return;
  }

  const fields = getUserFilterFields();
  const filterId = row.getAttribute('data-filter-id');
  const field = row.querySelector('[data-filter-field]')?.value || 'name';
  const operator = row.querySelector('[data-filter-operator]')?.value || fields[field].operators[0];
  const value = row.querySelector('[data-filter-value]')?.value || '';

  updateFilter(filterId, { field, operator, value });
});

profileButton?.addEventListener('click', () => openModalById('profile-modal'));
profileCloseButton?.addEventListener('click', () => closeModalById('profile-modal'));
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', () => closeModalById('profile-modal'));
modalLogoutButton?.addEventListener('click', doLogout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (profileModal && !profileModal.hidden) closeModalById('profile-modal');
  }
});

init();
