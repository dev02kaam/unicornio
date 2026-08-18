const API_BASE = '/api';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let currentSessionUser = null;
let currentCsrfToken = null;

const appLoadingState = {
  sessionReady: false,
  authenticated: false,
  shellReady: false,
  pageReady: false,
  revealQueued: false,
  fallbackTimer: null,
};

function getPendingBody() {
  return document.body?.classList.contains('auth-pending') ? document.body : null;
}

function installAppLoadingStatus() {
  const body = getPendingBody();
  if (!body) return;

  body.setAttribute('aria-busy', 'true');
  document.getElementById('main-content')?.setAttribute('aria-busy', 'true');
  if (!document.querySelector('.app-loading-status')) {
    const status = document.createElement('div');
    status.className = 'app-loading-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.innerHTML = `
      <div class="app-loading-status__panel">
        <img src="/assets/brand/logo_proyecto_unicornio_horizontal_limpio.png" alt="" />
        <span>Preparando tu espacio&hellip;</span>
      </div>
    `;
    body.append(status);
  }
}

function revealApp() {
  const body = document.body;
  if (!body) return;

  window.clearTimeout(appLoadingState.fallbackTimer);
  appLoadingState.fallbackTimer = null;
  body.classList.remove('auth-pending');
  body.removeAttribute('aria-busy');
  document.getElementById('main-content')?.removeAttribute('aria-busy');
  document.querySelector('.app-loading-status')?.remove();
}

function queueAppReveal({ immediate = false } = {}) {
  if (appLoadingState.revealQueued) return;
  appLoadingState.revealQueued = true;

  const reveal = () => {
    appLoadingState.revealQueued = false;
    revealApp();
  };
  if (immediate) {
    window.requestAnimationFrame(reveal);
    return;
  }
  window.requestAnimationFrame(() => window.requestAnimationFrame(reveal));
}

function maybeRevealApp() {
  if (
    appLoadingState.sessionReady
    && appLoadingState.authenticated
    && appLoadingState.shellReady
    && appLoadingState.pageReady
  ) {
    queueAppReveal();
  }
}

window.UnicornioAppLoading = {
  setSessionReady(authenticated) {
    appLoadingState.sessionReady = true;
    appLoadingState.authenticated = Boolean(authenticated);
    if (authenticated && getPendingBody() && !appLoadingState.fallbackTimer) {
      appLoadingState.fallbackTimer = window.setTimeout(() => queueAppReveal(), 12000);
    }
    maybeRevealApp();
  },
  markShellReady() {
    appLoadingState.shellReady = true;
    maybeRevealApp();
  },
  markPageReady() {
    appLoadingState.pageReady = true;
    maybeRevealApp();
  },
  revealImmediately() {
    queueAppReveal({ immediate: true });
  },
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installAppLoadingStatus, { once: true });
} else {
  installAppLoadingStatus();
}

function setSessionUser(user) {
  currentSessionUser = user || null;
  if (currentSessionUser?.role) {
    document.documentElement.dataset.userRole = String(currentSessionUser.role).toUpperCase();
  }
}

function getToken() {
  // Compatibilidad temporal con las vistas: es una marca en memoria, nunca una credencial.
  return currentSessionUser ? 'cookie-session' : null;
}

function getTokenSubject() {
  return currentSessionUser?.id || null;
}

function getTokenRole() {
  return currentSessionUser?.role || null;
}

function setRememberSession() {
  // La politica de expiracion se aplica en el servidor; el navegador no decide la persistencia.
}

function clearToken() {
  currentSessionUser = null;
  currentCsrfToken = null;
  delete document.documentElement.dataset.userRole;
}

function getApiErrorMessage(error) {
  const details = error?.payload?.error?.details || error?.payload?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details.join(' ');
  }

  return error?.message || 'Error en la peticion.';
}

async function parseApiResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || 'Error en la peticion.');
    error.payload = payload;
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function refreshSession() {
  try {
    const response = await fetch(`${API_BASE}/auth/session`, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const payload = await parseApiResponse(response);
    setSessionUser(payload.data?.user);
    return currentSessionUser;
  } catch (error) {
    if (error.status !== 401) throw error;
    clearToken();
    return null;
  }
}

const sessionReady = refreshSession().finally(() => {
  window.UnicornioAppLoading.setSessionReady(Boolean(currentSessionUser));
});

async function getCsrfToken({ force = false } = {}) {
  if (currentCsrfToken && !force) return currentCsrfToken;
  const response = await fetch(`${API_BASE}/auth/csrf`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const payload = await parseApiResponse(response);
  currentCsrfToken = payload.data?.csrfToken || null;
  if (!currentCsrfToken) throw new Error('No se pudo obtener la proteccion CSRF.');
  return currentCsrfToken;
}

async function apiRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = {
    Accept: 'application/json',
    ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (UNSAFE_METHODS.has(method)) {
    // El login puede permanecer abierto mientras el servidor local se reinicia.
    // En ese caso la pestaña conserva un token ligado a la sesión anterior.
    headers['X-CSRF-Token'] = await getCsrfToken({ force: path === '/auth/login' });
  }

  const requestDetail = { path, method };
  document.dispatchEvent(new CustomEvent('unicornio:request-start', { detail: requestDetail }));

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      method,
      headers,
      credentials: 'same-origin',
    });
    const payload = await parseApiResponse(response);

    if (path === '/auth/login') {
      setSessionUser(payload.data?.user);
      currentCsrfToken = payload.data?.csrfToken || null;
    } else if (path === '/auth/session' || path === '/auth/me') {
      setSessionUser(payload.data?.user);
    } else if (path === '/auth/logout') {
      clearToken();
    }

    document.dispatchEvent(new CustomEvent('unicornio:request-end', {
      detail: { ...requestDetail, ok: true },
    }));
    return payload;
  } catch (error) {
    document.dispatchEvent(new CustomEvent('unicornio:request-end', {
      detail: { ...requestDetail, ok: false, status: error.status || 0 },
    }));
    throw error;
  }
}
