const form = document.getElementById('login-form');
const errorBox = document.getElementById('login-error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

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

    setToken(response.data.token);
    window.location.href = '/dashboard.html';
  } catch (error) {
    const wait = error.payload?.data?.retryAfterMinutes;
    errorBox.textContent = wait
      ? `${error.message} Podrás volver a intentarlo en aproximadamente ${wait} minuto(s).`
      : error.message;
    errorBox.hidden = false;
  }
});
