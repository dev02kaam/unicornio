const profileButton = document.getElementById('profile-button');
const profileModal = document.getElementById('profile-modal');
const profileCloseButton = document.getElementById('profile-close-button');
const modalLogoutButton = document.getElementById('modal-logout-button');
const profileNameElement = document.getElementById('profile-name');
const profileEmailElement = document.getElementById('profile-email');
const introElement = document.getElementById('dashboard-intro');
const logoutButton = modalLogoutButton;
const adminPanel = document.getElementById('admin-panel');
const adminUsersPanel = document.getElementById('admin-users-panel');
const createUserForm = document.getElementById('create-user-form');
const createUserError = document.getElementById('create-user-error');
const createUserSuccess = document.getElementById('create-user-success');
const usersList = document.getElementById('users-list');
const refreshUsersButton = document.getElementById('refresh-users-button');

let currentUser = null;

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

function renderUsers(users) {
  if (!usersList) {
    return;
  }

  usersList.innerHTML = users
    .map(
      (user, index) => `
        <article class="user-row" style="animation-delay: ${index * 80}ms">
          <div>
            <strong>${user.name}</strong>
            <span>${user.email}</span>
          </div>
          <div class="user-meta">
            <span>${user.isActive ? 'Activo' : 'Inactivo'}</span>
          </div>
        </article>
      `,
    )
    .join('');
}

async function loadAdminUsers() {
  const response = await apiRequest('/users');
  renderUsers(response.data.users);
}

function openProfileModal() {
  if (!profileModal) {
    return;
  }

  profileModal.hidden = false;
  profileModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeProfileModal() {
  if (!profileModal) {
    return;
  }

  profileModal.hidden = true;
  profileModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
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

    const isAdmin = String(currentUser.role || '').toUpperCase() === 'ADMIN';

    if (isAdmin) {
      introElement.textContent = 'Tienes acceso de administración para crear usuarios y revisar el listado básico.';
      setPanelVisible(adminPanel, true, 'grid');
      setPanelVisible(adminUsersPanel, true, 'grid');
      await loadAdminUsers();
    } else {
      introElement.textContent = 'Acceso personal listo. Puedes revisar tu perfil cuando quieras.';
      setPanelVisible(adminPanel, false);
      setPanelVisible(adminUsersPanel, false);
    }
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

profileButton?.addEventListener('click', openProfileModal);
profileCloseButton?.addEventListener('click', closeProfileModal);
profileModal?.querySelector('[data-close-profile]')?.addEventListener('click', closeProfileModal);
modalLogoutButton?.addEventListener('click', doLogout);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !profileModal.hidden) {
    closeProfileModal();
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
    };

    try {
      await apiRequest('/users', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(createUserSuccess, 'Usuario creado correctamente.');
      createUserForm.reset();
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
