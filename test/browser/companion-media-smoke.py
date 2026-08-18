import os
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("COMPANION_E2E_BASE_URL", "http://127.0.0.1:3000")
OUTPUT_DIR = Path("test-results/companion-media")


def goto_media_page(page, url):
    page.goto(url, wait_until="domcontentloaded")
    try:
        page.wait_for_load_state("networkidle", timeout=5_000)
    except PlaywrightTimeoutError:
        # Un vídeo en reproducción puede mantener conexiones de rango abiertas.
        pass


def open_browser(playwright):
    try:
        return playwright.chromium.launch(headless=True)
    except Exception:
        chrome_path = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
        if not chrome_path.exists():
            raise
        return playwright.chromium.launch(headless=True, executable_path=str(chrome_path))


def install_harness(page):
    page.route(
        f"{BASE_URL}/companion-harness.html",
        lambda route: route.fulfill(
            status=200,
            content_type="text/html; charset=utf-8",
            body="""
              <!doctype html>
              <html lang="es">
                <head>
                  <meta charset="utf-8" />
                  <link rel="stylesheet" href="/css/styles.css" />
                  <link rel="stylesheet" href="/css/galaxy.css" />
                  <link rel="stylesheet" href="/css/cosmos.css" />
                </head>
                <body>
                  <main class="shell">
                    <section class="card dashboard-hero">
                      <h1>Prueba de compañero</h1>
                      <div class="dashboard-links"></div>
                      <button class="account-trigger" type="button" aria-label="Abrir perfil">
                        <span class="avatar-badge avatar-large" aria-hidden="true"></span>
                      </button>
                    </section>
                  </main>
                  <div id="profile-modal"><div class="preferences-card"></div></div>
                  <script>
                    window.sessionReady = Promise.resolve({
                      id: 'student-media-test',
                      role: 'STUDENT',
                      birthDate: '2015-05-10',
                      unicornGender: 'MASCULINE',
                    });
                    window.getToken = () => 'media-test-token';
                    window.apiRequest = async () => ({ data: { user: {} } });
                    window.renderRoleNavigation = () => undefined;
                    window.UnicornioAppLoading = { markShellReady() {} };
                  </script>
                  <script src="/js/companion.js"></script>
                </body>
              </html>
            """,
        ),
    )


def assert_login_presentations(browser, browser_errors):
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        bypass_csp=True,
    )
    page = context.new_page()
    page.on("pageerror", lambda error: browser_errors.append(f"login: {error}"))
    goto_media_page(page, f"{BASE_URL}/login.html")

    stage = page.locator(".login-character-stage")
    video = page.locator("[data-companion-presentation]")
    poster = page.locator("[data-companion-presentation-poster]")
    final_frame = page.locator("[data-companion-presentation-final]")
    loader = page.locator("[data-login-presentation-loader]")
    audio_button = page.locator("[data-login-presentation-audio]")
    stage.wait_for(state="visible")
    page.wait_for_function(
        "document.querySelector('.login-character-stage').classList.contains('is-presentation-ready')"
    )
    assert video.get_attribute("src").endswith("/luna/login-presentation-transparent.webm")
    assert video.evaluate("node => node.muted")
    assert not video.evaluate("node => node.loop")
    assert audio_button.is_visible()
    assert audio_button.get_attribute("aria-pressed") == "false"
    assert audio_button.locator("[data-login-audio-label]").inner_text() == "Escuchar presentación"

    audio_button.click()
    page.wait_for_function(
        """() => {
          const video = document.querySelector('[data-companion-presentation]');
          return !video.muted && video.currentTime > 0.05;
        }"""
    )
    assert audio_button.get_attribute("aria-pressed") == "true"
    assert audio_button.locator("[data-login-audio-label]").inner_text() == "Silenciar presentación"
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-luna-audio.png"), full_page=True)

    cdp_session = context.new_cdp_session(page)
    cdp_session.send("Network.enable")
    cdp_session.send("Network.setCacheDisabled", {"cacheDisabled": True})
    cdp_session.send(
        "Network.emulateNetworkConditions",
        {
            "offline": False,
            "latency": 900,
            "downloadThroughput": 80_000,
            "uploadThroughput": 40_000,
            "connectionType": "cellular3g",
        },
    )
    page.locator('[data-login-companion="sol"]').click()
    page.wait_for_timeout(250)

    assert "is-presentation-loading" in (stage.get_attribute("class") or "")
    assert stage.get_attribute("aria-busy") == "true"
    assert loader.get_attribute("aria-hidden") == "false"
    assert loader.locator("[data-login-presentation-loader-label]").inner_text() == "Preparando a Sol…"
    assert float(loader.evaluate("node => getComputedStyle(node).opacity")) > 0.9
    assert float(video.evaluate("node => getComputedStyle(node).opacity")) < 0.1
    assert float(poster.evaluate("node => getComputedStyle(node).opacity")) < 0.1
    assert video.evaluate("node => node.paused && node.currentTime < 0.05")
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-loader.png"), full_page=True)

    cdp_session.send(
        "Network.emulateNetworkConditions",
        {
            "offline": False,
            "latency": 0,
            "downloadThroughput": -1,
            "uploadThroughput": -1,
            "connectionType": "none",
        },
    )
    cdp_session.send("Network.setCacheDisabled", {"cacheDisabled": False})
    page.wait_for_function(
        """() => {
          const stage = document.querySelector('.login-character-stage');
          const video = document.querySelector('[data-companion-presentation]');
          return stage.classList.contains('is-presentation-ready')
            && !stage.classList.contains('is-presentation-loading')
            && video.getAttribute('src').endsWith('/sol/login-presentation-transparent.webm')
            && !video.muted
            && video.currentTime > 0.05;
        }"""
    )
    assert stage.get_attribute("aria-busy") is None
    assert loader.get_attribute("aria-hidden") == "true"
    assert poster.get_attribute("src").endswith("/sol/login-full-v3.png")
    assert final_frame.get_attribute("src").endswith("/sol/login-presentation-final.webp")
    assert not final_frame.is_hidden()

    page.evaluate(
        """() => {
          const video = document.querySelector('[data-companion-presentation]');
          video.currentTime = Math.max(0, video.duration - 0.18);
        }"""
    )
    page.wait_for_function(
        """() => {
          const stage = document.querySelector('.login-character-stage');
          const video = document.querySelector('[data-companion-presentation]');
          const finalFrame = document.querySelector('[data-companion-presentation-final]');
          return stage.classList.contains('is-presentation-complete')
            && Number.parseFloat(getComputedStyle(finalFrame).opacity) > 0.9
            && Number.parseFloat(getComputedStyle(video).opacity) < 0.1
            && getComputedStyle(video).visibility === 'hidden';
        }"""
    )
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-sol-final.png"), full_page=True)

    loader_started_at = time.monotonic()
    page.locator('[data-login-companion="orion"]').click()
    page.wait_for_function(
        "document.querySelector('.login-character-stage').classList.contains('is-presentation-loading')"
    )
    page.wait_for_timeout(150)
    assert "is-presentation-loading" in (stage.get_attribute("class") or "")
    page.wait_for_function(
        """() => {
          const stage = document.querySelector('.login-character-stage');
          const video = document.querySelector('[data-companion-presentation]');
          return stage.classList.contains('is-presentation-ready')
            && !stage.classList.contains('is-presentation-loading')
            && video.getAttribute('src').endsWith('/orion/login-presentation-transparent.webm')
            && !video.muted
            && video.currentTime > 0.05;
        }"""
    )
    assert time.monotonic() - loader_started_at >= 0.48
    assert poster.get_attribute("src").endswith("/orion/login-full-v3.png")
    assert final_frame.get_attribute("src").endswith("/orion/login-presentation-final.webp")
    assert not final_frame.is_hidden()

    page.evaluate(
        """() => {
          const video = document.querySelector('[data-companion-presentation]');
          video.currentTime = Math.max(0, video.duration - 0.18);
        }"""
    )
    page.wait_for_function(
        """() => {
          const stage = document.querySelector('.login-character-stage');
          const video = document.querySelector('[data-companion-presentation]');
          const finalFrame = document.querySelector('[data-companion-presentation-final]');
          return stage.classList.contains('is-presentation-complete')
            && Number.parseFloat(getComputedStyle(finalFrame).opacity) > 0.9
            && Number.parseFloat(getComputedStyle(video).opacity) < 0.1
            && getComputedStyle(video).visibility === 'hidden';
        }"""
    )
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-orion-final.png"), full_page=True)

    page.locator('[data-login-companion="nico"]').click()
    page.wait_for_function(
        """() => {
          const stage = document.querySelector('.login-character-stage');
          const video = document.querySelector('[data-companion-presentation]');
          return stage.classList.contains('is-presentation-ready')
            && video.getAttribute('src').endsWith('/nico/login-presentation-transparent.webm')
            && !video.muted
            && video.currentTime > 0.05;
        }"""
    )
    assert poster.get_attribute("src").endswith("/nico/login-full-v3.png")
    assert final_frame.is_hidden()

    page.evaluate(
        """() => {
          const video = document.querySelector('[data-companion-presentation]');
          video.currentTime = Math.max(0, video.duration - 0.03);
        }"""
    )
    page.wait_for_function(
        """() => {
          const stage = document.querySelector('.login-character-stage');
          const video = document.querySelector('[data-companion-presentation]');
          return stage.classList.contains('is-presentation-complete')
            && video.paused
            && video.currentTime < video.duration;
        }"""
    )
    assert float(video.evaluate("node => getComputedStyle(node).opacity")) > 0.9
    assert float(poster.evaluate("node => getComputedStyle(node).opacity")) < 0.1
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-final-frame.png"), full_page=True)

    audio_button.click()
    assert video.evaluate("node => node.muted")
    assert audio_button.get_attribute("aria-pressed") == "false"
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-desktop.png"), full_page=True)

    page.set_viewport_size({"width": 768, "height": 960})
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-tablet.png"), full_page=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    page.screenshot(path=str(OUTPUT_DIR / "login-presentation-mobile.png"), full_page=True)
    context.close()


def assert_loop_and_gesture_logic(browser, browser_errors):
    context = browser.new_context(
        viewport={"width": 1280, "height": 900},
        device_scale_factor=2,
        bypass_csp=True,
    )
    page = context.new_page()
    install_harness(page)
    page.on("pageerror", lambda error: browser_errors.append(f"harness: {error}"))
    goto_media_page(page, f"{BASE_URL}/companion-harness.html")
    page.wait_for_function("document.documentElement.classList.contains('companion-ready')")

    profile_loop = page.locator(".account-trigger [data-companion-loop]")
    widget_loop = page.locator(".companion-face [data-companion-loop]")
    gesture = page.locator("[data-companion-expression]")
    assert profile_loop.count() == 1
    assert widget_loop.count() == 1
    assert profile_loop.get_attribute("src").endswith("/nico/profile-loop-transparent.webm")
    assert profile_loop.get_attribute("poster").endswith("/nico/profile-loop-poster.webp")
    assert widget_loop.get_attribute("poster").endswith("/nico/profile-loop-poster.webp")
    assert profile_loop.evaluate("node => node.loop && node.muted")
    assert profile_loop.evaluate(
        "node => getComputedStyle(node.closest('.account-trigger')).getPropertyValue('--account-avatar-scale').trim() === '1.12'"
    )
    assert widget_loop.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-loop-scale').trim() === '1.1'"
    )
    assert page.locator(".companion-face").evaluate(
        "node => getComputedStyle(node).backgroundColor === 'rgb(252, 248, 244)'"
    )
    page.wait_for_function(
        "document.querySelector('.companion-face [data-companion-loop]').currentTime > 0.1"
    )
    page.locator(".account-trigger").screenshot(path=str(OUTPUT_DIR / "profile-loop-nico.png"))
    page.locator(".companion-orb").screenshot(path=str(OUTPUT_DIR / "widget-loop-nico.png"))
    before_state = widget_loop.evaluate("node => node.currentTime")

    page.evaluate("window.UnicornioCompanion.setState('thinking', { ttl: 0, force: true })")
    page.wait_for_function(
        "document.querySelector('[data-companion-expression]').getAttribute('src').endsWith('/nico/thinking.png')"
    )
    page.wait_for_function(
        "!document.querySelector('.companion-widget').classList.contains('is-expression-loading')"
    )
    page.wait_for_function(
        "Number.parseFloat(getComputedStyle(document.querySelector('[data-companion-expression]')).opacity) > 0.9"
    )
    assert gesture.get_attribute("data-companion-expression-state") == "thinking"
    assert gesture.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-expression-scale').trim() === '1.02'"
    )
    assert float(gesture.evaluate("node => getComputedStyle(node).opacity")) > 0.9
    page.locator(".companion-orb").screenshot(
        path=str(OUTPUT_DIR / "expression-nico-thinking.png")
    )
    assert float(widget_loop.evaluate("node => getComputedStyle(node).opacity")) < 0.1
    during_state = widget_loop.evaluate("node => node.currentTime")
    assert during_state > before_state

    page.evaluate("window.UnicornioCompanion.setState('idle', { ttl: 0, force: true })")
    page.wait_for_timeout(250)
    assert float(widget_loop.evaluate("node => getComputedStyle(node).opacity")) > 0.9
    assert float(gesture.evaluate("node => getComputedStyle(node).opacity")) < 0.1

    page.evaluate("window.UnicornioCompanion.setAgeContext({ birthDate: '2009-05-10' })")
    page.wait_for_function(
        "document.querySelector('.account-trigger [data-companion-loop]').getAttribute('src').endsWith('/orion/profile-loop-transparent.webm')"
    )
    assert profile_loop.get_attribute("poster").endswith("/orion/profile-loop-poster.webp")
    assert profile_loop.evaluate(
        "node => getComputedStyle(node.closest('.account-trigger')).getPropertyValue('--account-avatar-scale').trim() === '1.14'"
    )
    assert widget_loop.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-loop-scale').trim() === '1.1'"
    )
    assert gesture.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-expression-scale').trim() === '1.06'"
    )
    for expression_state in ("calm", "listening", "thinking", "success", "surprised"):
        page.evaluate(
            "state => window.UnicornioCompanion.setState(state, { ttl: 0, force: true })",
            expression_state,
        )
        page.wait_for_function(
            "state => document.querySelector('[data-companion-expression]').dataset.companionExpressionState === state && !document.querySelector('.companion-widget').classList.contains('is-expression-loading')",
            arg=("celebrating" if expression_state == "success" else expression_state),
        )
        page.wait_for_function(
            "Number.parseFloat(getComputedStyle(document.querySelector('[data-companion-expression]')).opacity) > 0.9"
        )
        page.locator(".companion-orb").screenshot(
            path=str(OUTPUT_DIR / f"expression-orion-{expression_state}.png")
        )
    page.evaluate("window.UnicornioCompanion.setState('idle', { ttl: 0, force: true })")
    page.wait_for_function(
        "Number.parseFloat(getComputedStyle(document.querySelector('.companion-face [data-companion-loop]')).opacity) > 0.9"
    )
    page.locator(".account-trigger").screenshot(path=str(OUTPUT_DIR / "profile-loop-orion.png"))
    page.locator(".companion-orb").screenshot(path=str(OUTPUT_DIR / "widget-loop-orion.png"))
    page.locator('[data-companion-choice="FEMININE"]').first.click()
    page.wait_for_function(
        "document.querySelector('.account-trigger [data-companion-loop]').getAttribute('src').endsWith('/sol/profile-loop-transparent.webm')"
    )
    assert profile_loop.get_attribute("poster").endswith("/sol/profile-loop-poster.webp")
    assert profile_loop.evaluate(
        "node => getComputedStyle(node.closest('.account-trigger')).getPropertyValue('--account-avatar-scale').trim() === '1.1'"
    )
    assert widget_loop.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-loop-scale').trim() === '1.08'"
    )
    assert gesture.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-expression-scale').trim() === '1.1'"
    )
    page.evaluate("window.UnicornioCompanion.setState('listening', { ttl: 0, force: true })")
    page.wait_for_function(
        "document.querySelector('[data-companion-expression]').dataset.companionExpressionState === 'listening' && !document.querySelector('.companion-widget').classList.contains('is-expression-loading')"
    )
    page.wait_for_function(
        "Number.parseFloat(getComputedStyle(document.querySelector('[data-companion-expression]')).opacity) > 0.9"
    )
    page.locator(".companion-orb").screenshot(
        path=str(OUTPUT_DIR / "expression-sol-listening.png")
    )
    page.evaluate("window.UnicornioCompanion.setState('idle', { ttl: 0, force: true })")
    page.wait_for_function(
        "Number.parseFloat(getComputedStyle(document.querySelector('.companion-face [data-companion-loop]')).opacity) > 0.9"
    )
    page.locator(".account-trigger").screenshot(path=str(OUTPUT_DIR / "profile-loop-sol.png"))
    page.locator(".companion-orb").screenshot(path=str(OUTPUT_DIR / "widget-loop-sol.png"))
    page.evaluate("window.UnicornioCompanion.setAgeContext({ birthDate: '2015-05-10' })")
    page.wait_for_function(
        "document.querySelector('.account-trigger [data-companion-loop]').getAttribute('src').endsWith('/luna/profile-loop-transparent.webm')"
    )
    assert profile_loop.get_attribute("poster").endswith("/luna/profile-loop-poster.webp")
    assert profile_loop.evaluate(
        "node => getComputedStyle(node.closest('.account-trigger')).getPropertyValue('--account-avatar-scale').trim() === '1.12'"
    )
    assert widget_loop.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-loop-scale').trim() === '1.09'"
    )
    assert gesture.evaluate(
        "node => getComputedStyle(node).getPropertyValue('--companion-expression-scale').trim() === '1.02'"
    )
    page.evaluate("window.UnicornioCompanion.setState('listening', { ttl: 0, force: true })")
    page.wait_for_function(
        "document.querySelector('[data-companion-expression]').dataset.companionExpressionState === 'listening' && !document.querySelector('.companion-widget').classList.contains('is-expression-loading')"
    )
    page.wait_for_function(
        "Number.parseFloat(getComputedStyle(document.querySelector('[data-companion-expression]')).opacity) > 0.9"
    )
    page.locator(".companion-orb").screenshot(
        path=str(OUTPUT_DIR / "expression-luna-listening.png")
    )
    page.evaluate("window.UnicornioCompanion.setState('idle', { ttl: 0, force: true })")
    page.wait_for_function(
        "Number.parseFloat(getComputedStyle(document.querySelector('.companion-face [data-companion-loop]')).opacity) > 0.9"
    )
    page.locator(".account-trigger").screenshot(path=str(OUTPUT_DIR / "profile-loop-luna.png"))
    page.locator(".companion-orb").screenshot(path=str(OUTPUT_DIR / "widget-loop-luna.png"))
    page.screenshot(path=str(OUTPUT_DIR / "profile-loop-and-widget.png"), full_page=True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    assert page.locator(".account-trigger [data-companion-loop]").bounding_box()["width"] > 35
    assert page.locator(".companion-face [data-companion-loop]").bounding_box()["width"] > 35
    page.screenshot(path=str(OUTPUT_DIR / "profile-loop-and-widget-mobile.png"), full_page=True)
    context.close()


def assert_reduced_motion(browser, browser_errors):
    context = browser.new_context(
        viewport={"width": 1024, "height": 800},
        reduced_motion="reduce",
        bypass_csp=True,
    )
    page = context.new_page()
    install_harness(page)
    page.on("pageerror", lambda error: browser_errors.append(f"reduced: {error}"))
    goto_media_page(page, f"{BASE_URL}/companion-harness.html")
    page.wait_for_function("document.documentElement.classList.contains('companion-ready')")
    assert page.locator(".account-trigger [data-companion-loop]").evaluate("node => node.paused")
    assert page.locator(".companion-face [data-companion-loop]").evaluate(
        "node => getComputedStyle(node).display === 'none'"
    )
    assert float(
        page.locator("[data-companion-expression]").evaluate("node => getComputedStyle(node).opacity")
    ) > 0.9
    assert page.locator("[data-companion-expression]").get_attribute(
        "data-companion-expression-state"
    ) == "smile"
    assert "is-expression-loading" not in (
        page.locator(".companion-widget").get_attribute("class") or ""
    )

    goto_media_page(page, f"{BASE_URL}/login.html")
    assert page.locator("[data-companion-presentation]").evaluate(
        "node => getComputedStyle(node).display === 'none'"
    )
    assert page.locator("[data-login-presentation-audio]").evaluate(
        "node => getComputedStyle(node).display === 'none'"
    )
    assert page.locator("[data-login-presentation-loader]").evaluate(
        "node => getComputedStyle(node).visibility === 'hidden'"
    )
    assert float(
        page.locator("[data-companion-presentation-poster]").evaluate(
            "node => getComputedStyle(node).opacity"
        )
    ) > 0.9
    context.close()


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    browser_errors = []
    with sync_playwright() as playwright:
        browser = open_browser(playwright)
        assert_login_presentations(browser, browser_errors)
        assert_loop_and_gesture_logic(browser, browser_errors)
        assert_reduced_motion(browser, browser_errors)
        browser.close()

    assert not browser_errors, browser_errors
    print(f"COMPANION_MEDIA_OK screenshots={OUTPUT_DIR}")


if __name__ == "__main__":
    main()
