const nameElement = document.getElementById('user-name');
const emailElement = document.getElementById('user-email');
const roleElement = document.getElementById('user-role');
const introElement = document.getElementById('dashboard-intro');
const logoutButton = document.getElementById('logout-button');
const adminPanel = document.getElementById('admin-panel');
const adminUsersPanel = document.getElementById('admin-users-panel');
const userPanel = document.getElementById('user-panel');
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
            <span>${user.role}</span>
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

async function loadProfile() {
  try {
    const response = await apiRequest('/auth/me');
    currentUser = response.data.user;
    nameElement.textContent = currentUser.name;
    emailElement.textContent = currentUser.email;
    roleElement.textContent = currentUser.role;

    const isAdmin = String(currentUser.role || '').toUpperCase() === 'ADMIN';

    if (isAdmin) {
      introElement.textContent = 'Tienes acceso de administración para crear usuarios y revisar el listado básico.';
      setPanelVisible(adminPanel, true, 'grid');
      setPanelVisible(adminUsersPanel, true, 'grid');
      setPanelVisible(userPanel, false);
      await loadAdminUsers();
    } else {
      introElement.textContent = 'Acceso personal listo. Puedes revisar tu perfil y cerrar sesión cuando quieras.';
      setPanelVisible(userPanel, true, 'grid');
      setPanelVisible(adminPanel, false);
      setPanelVisible(adminUsersPanel, false);
    }
  } catch (_error) {
    clearToken();
    window.location.href = '/login.html';
  }
}

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

logoutButton.addEventListener('click', async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } catch (_error) {
    // Logout demo: limpiar la sesion local aunque el token sea stateless.
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
});

loadProfile();
