const notificationGate = document.getElementById('notification-gate');
const notificationGateMessage = document.getElementById('notification-gate-message');
const notificationFeed = document.getElementById('notification-feed');
const notificationList = document.getElementById('notification-list');
const notificationEmpty = document.getElementById('notification-empty');
const notificationPollStatus = document.getElementById('notification-poll-status');
const notificationAnnouncer = document.getElementById('notification-announcer');
const notificationScopeCopy = document.getElementById('notification-scope-copy');
const notificationConsentsLink = document.getElementById('notification-consents-link');

let pollingTimer = null;
let loading = false;
let previousNotificationIds = null;

function escapeMarkup(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function showGate(message) {
  notificationFeed.hidden = true;
  notificationGate.hidden = false;
  notificationGateMessage.textContent = message;
}

function hasUsefulDestination(href) {
  if (!href) {
    return false;
  }
  try {
    const destination = new URL(href, window.location.origin);
    const current = new URL(window.location.href);
    return destination.origin === current.origin
      && `${destination.pathname}${destination.search}` !== `${current.pathname}${current.search}`;
  } catch (_error) {
    return false;
  }
}

function renderNotifications(notifications) {
  notificationGate.hidden = true;
  notificationFeed.hidden = false;
  notificationEmpty.hidden = notifications.length > 0;
  const nextIds = new Set(notifications.map((notification) => notification.id));
  if (previousNotificationIds) {
    const newNotifications = notifications.filter(
      (notification) => !previousNotificationIds.has(notification.id),
    );
    if (newNotifications.length > 0) {
      notificationAnnouncer.textContent = newNotifications.length === 1
        ? `Nueva notificación: ${newNotifications[0].title}.`
        : `${newNotifications.length} notificaciones nuevas.`;
    }
  }
  previousNotificationIds = nextIds;
  notificationList.innerHTML = notifications.map((notification) => `
    <article class="notification-item" data-unread="${!notification.isRead}">
      <span class="notification-dot" aria-hidden="true"></span>
      <div class="notification-copy">
        <h2>${escapeMarkup(notification.title)}</h2>
        <p>${escapeMarkup(notification.body)}</p>
        <time datetime="${escapeMarkup(notification.createdAt)}">${escapeMarkup(formatDate(notification.createdAt))}</time>
      </div>
      <div class="action-row">
        ${hasUsefulDestination(notification.href) ? `<a class="button secondary compact-button" href="${escapeMarkup(notification.href)}">Abrir</a>` : ''}
        ${!notification.isRead ? `<button class="text-action" type="button" data-notification-read="${escapeMarkup(notification.id)}">Marcar como leída</button>` : '<span class="muted-line">Leída</span>'}
      </div>
    </article>
  `).join('');
  notificationPollStatus.textContent = `Actualizado a las ${new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(new Date())}`;
}

async function loadNotifications({ silent = false } = {}) {
  if (loading) {
    return;
  }
  loading = true;
  try {
    const response = await apiRequest('/notifications', { companionSilent: silent });
    renderNotifications(response.data.notifications || []);
  } catch (error) {
    if (error?.status === 401) {
      clearToken();
      window.location.href = '/login.html';
    } else if (!silent || error?.status === 503) {
      showGate(getApiErrorMessage(error));
    }
  } finally {
    loading = false;
  }
}

async function markRead(notificationId) {
  try {
    await apiRequest(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST',
      body: '{}',
    });
    await loadNotifications();
  } catch (error) {
    showGate(getApiErrorMessage(error));
  }
}

async function initialize() {
  await sessionReady;
  const role = String(getTokenRole() || '').toUpperCase();
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  if (role === 'FAMILY') {
    notificationScopeCopy.textContent = 'Los avisos familiares son mínimos: no muestran respuestas, puntuaciones ni interpretaciones.';
  } else if (role === 'PROFESSIONAL') {
    notificationScopeCopy.textContent = 'Las alertas de alumnos quedan disponibles para su confirmación y seguimiento profesional.';
  } else {
    notificationConsentsLink.hidden = true;
  }
  await loadNotifications();
  if (getToken()) window.UnicornioAppLoading?.markPageReady();
  pollingTimer = setInterval(() => loadNotifications({ silent: true }), 5000);
}

notificationList?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-notification-read]');
  if (button) {
    markRead(button.dataset.notificationRead);
  }
});

document.getElementById('notifications-logout-button')?.addEventListener('click', async () => {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    clearToken();
    window.location.href = '/login.html';
  }
});
window.addEventListener('beforeunload', () => clearInterval(pollingTimer));

initialize();
