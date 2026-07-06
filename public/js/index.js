(function redirectFromRoot() {
  const token = getToken();
  window.location.replace(token ? '/dashboard.html' : '/login.html');
})();
