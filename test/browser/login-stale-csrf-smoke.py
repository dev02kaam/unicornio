import os
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("UNICORNIO_E2E_BASE_URL", "http://localhost:3100")


def open_browser(playwright):
    try:
        return playwright.chromium.launch(headless=True)
    except Exception:
        chrome_path = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        if not chrome_path.exists():
            raise
        return playwright.chromium.launch(headless=True, executable_path=str(chrome_path))


def main():
    browser_errors = []
    csrf_requests = []
    login_statuses = []

    with sync_playwright() as playwright:
        browser = open_browser(playwright)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            bypass_csp=True,
        )
        page = context.new_page()
        page.on("pageerror", lambda error: browser_errors.append(str(error)))
        page.on(
            "request",
            lambda request: csrf_requests.append(request.url)
            if request.url.endswith("/api/auth/csrf")
            else None,
        )
        page.on(
            "response",
            lambda response: login_statuses.append(response.status)
            if response.url.endswith("/api/auth/login")
            else None,
        )

        page.goto(f"{BASE_URL}/login.html", wait_until="domcontentloaded")
        try:
            page.wait_for_load_state("networkidle", timeout=5_000)
        except PlaywrightTimeoutError:
            # Los vídeos pueden mantener conexiones de rango abiertas.
            pass

        # Simula una pestaña abierta antes de reiniciar el servidor: el token
        # queda en memoria, pero la cookie de la sesión a la que pertenecía ya no existe.
        stale_token_length = page.evaluate("getCsrfToken().then(token => token.length)")
        assert stale_token_length > 32
        context.clear_cookies()

        page.locator('input[name="email"]').fill("admin@unicornio.local")
        page.locator('input[name="password"]').fill("Demo1234!")
        page.locator("#login-submit").click()
        page.wait_for_url(f"{BASE_URL}/dashboard.html", timeout=20_000)

        assert login_statuses == [200], login_statuses
        assert len(csrf_requests) >= 2, csrf_requests
        assert not browser_errors, browser_errors

        # No deja una sesión administrativa de prueba abierta.
        page.evaluate(
            """async () => {
              await apiRequest('/auth/logout', { method: 'POST', body: '{}' });
            }"""
        )
        context.close()
        browser.close()

    print(
        "LOGIN_STALE_CSRF_OK "
        f"csrf_requests={len(csrf_requests)} login_status={login_statuses[0]}"
    )


if __name__ == "__main__":
    main()
