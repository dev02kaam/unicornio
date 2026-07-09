const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const usersFeedback = document.getElementById('users-feedback');
const usersBody = document.getElementById('users-body');
const refreshUsersButton = document.getElementById('refresh-users');
const userForm = document.getElementById('user-form');
const userFormTitle = document.getElementById('user-form-title');
const userFormSubmit = document.getElementById('user-form-submit');
const userRole = document.getElementById('user-role');
const userCenterField = document.getElementById('user-center-field');
const userStudentField = document.getElementById('user-student-field');
const userCenter = document.getElementById('user-center');
const userStudent = document.getElementById('user-student');
const userFormError = document.getElementById('user-form-error');
const userFormSuccess = document.getElementById('user-form-success');

let currentUser = null;
let users = [];
let centers = [];

const roleLabels = {
  ADMIN: 'Administrador',
  SCHOOL: 'Centro',
  TEACHER: 'Profesor',
  PROFESSIONAL: 'Profesional autorizado',
  STUDENT: 'Alumno',
  FAMILY: 'Familia',
};

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

function fieldModeForRole(role) {
  const normalizedRole = String(role || '').toUpperCase();
  if (normalizedRole === 'FAMILY') return 'student';
  if (['STUDENT', 'TEACHER', 'PROFESSIONAL'].includes(normalizedRole)) return 'center';
  return 'none';
}

function updateFieldVisibility() {
  const mode = fieldModeForRole(userRole?.value);
  if (userCenterField) {
    userCenterField.hidden = mode !== 'center';
    userCenterField.style.display = mode === 'center' ? '' : 'none';
  }
  if (userStudentField) {
    userStudentField.hidden = mode !== 'student';
    userStudentField.style.display = mode === 'student' ? '' : 'none';
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
  if (!usersBody) return;

  usersBody.innerHTML = users.map((user, index) => `
    <tr style="animation-delay:${index * 45}ms">
      <td>
        <div class="table-cell-title">
          <strong>${user.name}</strong>
          <span>${user.id}</span>
        </div>
      </td>
      <td>${user.email}</td>
      <td><span class="table-badge">${roleLabels[user.role] || user.role}</span></td>
      <td>${getCenterLabel(user.schoolId)}</td>
      <td>${user.linkedStudentId ? getStudentLabel(user.linkedStudentId) : 'Sin vincular'}</td>
      <td>${user.isActive ? 'Activo' : 'Inactivo'}</td>
      <td class="table-cell-actions">
        <button class="button ghost table-row-action" type="button" data-edit-user="${user.id}">Editar</button>
      </td>
    </tr>
  `).join('');
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
  renderUsers();
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
    setMessage(userFormError, error.message, true);
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
userRole?.addEventListener('change', updateFieldVisibility);
userForm?.addEventListener('submit', submitUserForm);
usersBody?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-user]');
  if (button) openEditForm(button.getAttribute('data-edit-user'));
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
