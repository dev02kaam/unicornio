(async function redirectFromRoot() {
  const token = getToken();

  if (!token) {
    window.location.replace('/login.html');
    return;
  }

  try {
    await apiRequest('/auth/me');
    window.location.replace('/dashboard.html');
  } catch (_error) {
    clearToken();
    window.location.replace('/login.html');
  }
})();
