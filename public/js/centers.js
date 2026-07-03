const centersList = document.getElementById('centers-list');
const centerCount = document.getElementById('center-count');
const centerRoleNote = document.getElementById('center-role-note');
const centerFormCard = document.getElementById('center-form-card');
const centerForm = document.getElementById('center-form');
const centerFormError = document.getElementById('center-form-error');
const centerFormSuccess = document.getElementById('center-form-success');
const refreshCentersButton = document.getElementById('refresh-centers');

let centersCurrentUser = null;

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
  const pieces = [];
  if (center.code) pieces.push(center.code);
  if (center.type) pieces.push(center.type);
  if (center.academicYear?.label) pieces.push(center.academicYear.label);
  return pieces.join(' · ') || 'Centro base';
}

function renderCenters(centers) {
  centerCount.textContent = `${centers.length} ${centers.length === 1 ? 'centro' : 'centros'}`;

  if (!centersList) {
    return;
  }

  if (centers.length === 0) {
    centersList.innerHTML = `
      <article class="empty-state">
        <strong>No hay centros visibles</strong>
        <p>Cuando se creen o asignen, aparecerán aquí.</p>
      </article>
    `;
    return;
  }

  centersList.innerHTML = centers
    .map(
      (center, index) => `
        <article class="org-card" style="animation-delay:${index * 70}ms">
          <div class="org-card__top">
            <div>
              <span class="org-kicker">${center.city || 'Sin ciudad'}</span>
              <h3>${center.name}</h3>
              <p>${formatCenterLine(center)}</p>
            </div>
            <span class="org-pill">${center.groupsCount || 0} grupos</span>
          </div>
          <div class="org-card__meta">
            <span>Usuarios: ${center.usersCount || 0}</span>
            <span>Activo: ${center.isActive ? 'Sí' : 'No'}</span>
          </div>
          <div class="action-row">
            <a class="button secondary" href="/groups.html?centerId=${encodeURIComponent(center.id)}">Ver grupos</a>
          </div>
        </article>
      `,
    )
    .join('');
}

async function loadCenters() {
  const response = await apiRequest('/centers');
  renderCenters(response.data.centers || []);
}

async function loadProfile() {
  const response = await apiRequest('/auth/me');
  centersCurrentUser = response.data.user;
  const role = String(centersCurrentUser.role || '').toUpperCase();

  centerRoleNote.textContent = role === 'ADMIN'
    ? 'Puedes crear y editar centros.'
    : 'Solo verás los centros asignados a tu cuenta.';

  if (centerFormCard) {
    centerFormCard.hidden = role !== 'ADMIN';
  }
}

async function init() {
  try {
    await loadProfile();
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
  };

  try {
    await apiRequest('/centers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setMessage(centerFormSuccess, 'Centro creado correctamente.');
    centerForm.reset();
    await loadCenters();
  } catch (error) {
    setMessage(centerFormError, error.message, true);
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
