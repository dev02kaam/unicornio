const API_BASE = '/api';
const TOKEN_KEY = 'unicornio_token';
const REMEMBER_SESSION_KEY_PREFIX = 'unicornio_remember_session:';

// El contenido del token solo se usa para adaptar la interfaz. La autenticación
// sigue dependiendo siempre de la validación del servidor.
function getTokenPayload(token) {
  try {
    const payload = token?.split('.')[1];
    if (!payload) {
      return null;
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='));
    return JSON.parse(decodedPayload);
  } catch (_error) {
    return null;
  }
}

function getTokenSubject(token) {
  return getTokenPayload(token)?.sub || null;
}

function getTokenRole(token = getToken()) {
  return getTokenPayload(token)?.role || null;
}

function getRememberSessionKey(token = getToken()) {
  const subject = getTokenSubject(token);
  return subject ? `${REMEMBER_SESSION_KEY_PREFIX}${encodeURIComponent(subject)}` : null;
}

function shouldRememberSession(token = getToken()) {
  const key = getRememberSessionKey(token);
  return !key || localStorage.getItem(key) !== 'false';
}

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
  const storage = shouldRememberSession(token) ? localStorage : sessionStorage;
  const otherStorage = storage === localStorage ? sessionStorage : localStorage;
  otherStorage.removeItem(TOKEN_KEY);
  storage.setItem(TOKEN_KEY, token);
}

function setRememberSession(remember) {
  const token = getToken();
  const key = getRememberSessionKey(token);
  if (key) {
    localStorage.setItem(key, String(remember));
  }

  if (!token) {
    return;
  }

  const storage = remember ? localStorage : sessionStorage;
  const otherStorage = remember ? sessionStorage : localStorage;
  otherStorage.removeItem(TOKEN_KEY);
  storage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function getApiErrorMessage(error) {
  const details = error?.payload?.details;
  if (Array.isArray(details) && details.length > 0) {
    return details.join(' ');
  }

  return error?.message || 'Error en la peticion.';
}

async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const method = String(options.method || 'GET').toUpperCase();
  const requestDetail = { path, method };
  document.dispatchEvent(new CustomEvent('unicornio:request-start', { detail: requestDetail }));

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload.message || 'Error en la peticion.');
      error.payload = payload;
      error.status = response.status;
      throw error;
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
