const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');
const submitButton = document.getElementById('login-submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitButton?.disabled) {
    return;
  }

  errorBox.hidden = true;
  errorBox.textContent = '';
  const previousLabel = submitButton?.textContent || 'Entrar';
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.setAttribute('aria-busy', 'true');
    submitButton.textContent = 'Entrando…';
  }
  form.setAttribute('aria-busy', 'true');

  const formData = new FormData(form);
  const payload = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  try {
    const response = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const userId = response.data?.user?.id;
    if (userId) {
      try {
        window.sessionStorage.removeItem(`unicornio-student-welcome-login:${userId}`);
      } catch (_error) {
        // El almacenamiento de sesión puede estar desactivado; el acceso continúa igualmente.
      }
    }

    window.location.href = '/dashboard.html';
  } catch (error) {
    const wait = error.payload?.data?.retryAfterMinutes;
    errorBox.textContent = wait
      ? `${error.message} Podrás volver a intentarlo en aproximadamente ${wait} minuto(s).`
      : error.message;
    errorBox.hidden = false;
    errorBox.focus();
  } finally {
    form.removeAttribute('aria-busy');
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.removeAttribute('aria-busy');
      submitButton.textContent = previousLabel;
    }
  }
});
