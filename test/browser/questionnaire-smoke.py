import os
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("QUESTIONNAIRE_E2E_BASE_URL", "http://127.0.0.1:3100")
OUTPUT_DIR = Path("test-results/questionnaires")
CAMPAIGN_TITLE = f"Prueba supervisada {int(time.time())}"


def login(page, email):
    csrf_response = page.request.get(f"{BASE_URL}/api/auth/csrf")
    assert csrf_response.ok, csrf_response.text()
    csrf_token = csrf_response.json()["data"]["csrfToken"]
    response = page.request.post(
        f"{BASE_URL}/api/auth/login",
        data={"email": email, "password": "Demo1234!"},
        headers={
            "Origin": BASE_URL,
            "Sec-Fetch-Site": "same-origin",
            "X-CSRF-Token": csrf_token,
        },
    )
    assert response.ok, response.text()


def open_browser(playwright):
    try:
        return playwright.chromium.launch(headless=True)
    except Exception:
        chrome_path = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        if not chrome_path.exists():
            raise
        return playwright.chromium.launch(headless=True, executable_path=str(chrome_path))


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    browser_errors = []

    with sync_playwright() as playwright:
        browser = open_browser(playwright)

        school_context = browser.new_context(viewport={"width": 1280, "height": 900})
        school_page = school_context.new_page()
        login(school_page, "school@unicornio.local")
        school_page.goto(f"{BASE_URL}/dashboard.html", wait_until="domcontentloaded")
        assignment_result = school_page.evaluate(
            """async () => {
              try {
                await apiRequest('/groups/group-1/users/6', {
                  method: 'POST',
                  body: JSON.stringify({ role: 'PROFESSIONAL', isPrimary: true }),
                });
                return 200;
              } catch (error) {
                return error.status || 0;
              }
            }"""
        )
        assert assignment_result in (200, 409), assignment_result
        school_context.close()

        professional_context = browser.new_context(viewport={"width": 1440, "height": 1000})
        professional_page = professional_context.new_page()
        professional_navigations = []
        professional_page.on(
            "framenavigated",
            lambda frame: professional_navigations.append(frame.url) if frame == professional_page.main_frame else None,
        )
        professional_page.on("pageerror", lambda error: browser_errors.append(f"professional: {error}"))
        login(professional_page, "profesional@unicornio.local")
        professional_page.goto(f"{BASE_URL}/questionnaires.html", wait_until="networkidle")
        try:
            professional_page.locator("#professional-surface").wait_for(
                state="visible", timeout=10_000
            )
        except PlaywrightTimeoutError:
            page_state = professional_page.evaluate(
                """async () => {
                  const gate = document.querySelector('#pilot-disabled');
                  const paths = [
                    '/questionnaire-campaigns',
                    '/questionnaire-definitions',
                    '/users/6/assignments',
                    '/users/6',
                  ];
                  const result = {};
                  for (const path of paths) {
                    try {
                      const response = await apiRequest(path);
                      result[path] = { ok: true, data: response.data };
                    } catch (error) {
                      result[path] = {
                        ok: false,
                        status: error.status,
                        message: error.message,
                      };
                    }
                  }
                  return {
                    href: location.href,
                    title: document.title,
                    tokenRole: typeof getTokenRole === 'function' ? getTokenRole() : null,
                    tokenSubject: typeof getTokenSubject === 'function' ? getTokenSubject() : null,
                    gate: gate ? { hidden: gate.hidden, text: gate.innerText } : null,
                    bodyText: document.body.innerText.slice(0, 800),
                    api: result,
                  };
                }"""
            )
            raise AssertionError(
                f"Superficie profesional oculta; page={page_state}; "
                f"navigations={professional_navigations}; page_errors={browser_errors}"
            )

        professional_page.locator("#new-campaign-button").click()
        professional_page.locator("#campaign-name-input").fill(CAMPAIGN_TITLE)
        professional_page.locator("#campaign-group-select").select_option("group-1")
        professional_page.locator(
            '#questionnaire-catalog input[value="depressive-mood"]'
        ).check()
        professional_page.locator('#campaign-form button[type="submit"]').click()
        professional_page.locator("#campaign-title").filter(has_text=CAMPAIGN_TITLE).wait_for()

        professional_page.locator(".participant-row").filter(
            has_text="Alumno Unicornio"
        ).wait_for(timeout=15_000)

        family_context = browser.new_context(viewport={"width": 1024, "height": 900})
        family_page = family_context.new_page()
        family_page.on("pageerror", lambda error: browser_errors.append(f"family: {error}"))
        login(family_page, "familia@unicornio.local")
        family_page.goto(f"{BASE_URL}/consents.html", wait_until="networkidle")
        campaign_consent = family_page.locator(".consent-card").filter(
            has_text="Campaña específica"
        ).first
        campaign_consent.wait_for(timeout=15_000)
        campaign_consent.locator("[data-accept-consent]").click()
        family_page.locator("#consent-decision-confirm").click()
        family_page.locator(".status-banner--success").wait_for(timeout=15_000)

        professional_page.reload(wait_until="networkidle")
        professional_page.locator("#campaign-title").filter(has_text=CAMPAIGN_TITLE).wait_for()
        professional_page.locator('[data-campaign-action="open"]').wait_for(timeout=15_000)
        professional_page.locator('[data-campaign-action="open"]').click()
        professional_page.locator("#campaign-status").filter(has_text="En directo").wait_for(
            timeout=15_000
        )

        family_page.goto(f"{BASE_URL}/notifications.html", wait_until="networkidle")
        family_page.locator("#notification-feed").wait_for(state="visible")

        student_context = browser.new_context(viewport={"width": 1024, "height": 768})
        student_page = student_context.new_page()
        student_page.on("pageerror", lambda error: browser_errors.append(f"student: {error}"))
        login(student_page, "alumno@unicornio.local")
        student_page.goto(f"{BASE_URL}/questionnaire.html", wait_until="networkidle")
        assignment = student_page.locator(".assignment-item").filter(has_text=CAMPAIGN_TITLE)
        assignment.wait_for(timeout=15_000)
        assignment.locator("[data-start-participant]").click()
        student_page.locator("#runner-view").wait_for(state="visible")
        student_page.locator("#question-companion-video").wait_for(state="visible")
        assert student_page.locator(".question-workspace").evaluate(
            "element => getComputedStyle(element).gridTemplateColumns.split(' ').length >= 2"
        )
        student_page.locator('.answer-choice input[value="SOMETIMES"]').check()
        student_page.locator("#runner-save-status").filter(has_text="Respuesta guardada").wait_for(
            timeout=15_000
        )

        started = time.monotonic()
        student_page.locator("#help-button").click()
        student_page.locator("#confirm-help-button").click()
        student_page.locator("#help-view").wait_for(state="visible", timeout=15_000)

        professional_page.locator(".alert-item").filter(
            has_text="Alumno Unicornio"
        ).wait_for(timeout=8_000)
        family_notice = family_page.locator(".notification-item").filter(
            has_text="Solicitud de ayuda recibida"
        ).first
        family_notice.wait_for(timeout=8_000)
        delivery_seconds = time.monotonic() - started
        assert delivery_seconds < 8, delivery_seconds
        assert "24" not in family_notice.locator(".notification-copy h2").inner_text()

        professional_page.screenshot(
            path=str(OUTPUT_DIR / "professional-live-alert.png"), full_page=True
        )
        student_page.screenshot(
            path=str(OUTPUT_DIR / "student-help-mobile.png"), full_page=True
        )
        family_page.screenshot(
            path=str(OUTPUT_DIR / "family-notification.png"), full_page=True
        )

        assert professional_page.locator("#alert-count").inner_text() != "0"
        assert student_page.locator('a[href="tel:024"]').is_visible()
        assert not browser_errors, browser_errors

        print(
            f"E2E_OK campaign={CAMPAIGN_TITLE!r} delivery_seconds={delivery_seconds:.2f} "
            f"screenshots={OUTPUT_DIR}"
        )

        student_context.close()
        family_context.close()
        professional_context.close()
        browser.close()


if __name__ == "__main__":
    try:
        main()
    except PlaywrightTimeoutError as error:
        raise AssertionError(f"Tiempo de espera agotado durante el flujo E2E: {error}") from error
