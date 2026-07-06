const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('unicornio_token');
}

function setToken(token) {
  localStorage.setItem('unicornio_token', token);
}

function clearToken() {
  localStorage.removeItem('unicornio_token');
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

  return payload;
}
