import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const appOrigin = 'http://localhost:3100';
const debugPort = 9334;
const phase = process.argv[2] || 'before';
const outputDir = join(process.env.TEMP, `unicornio-audit-${phase}`);
const profileDir = join(process.env.TEMP, `unicornio-cdp-${process.pid}`);

mkdirSync(outputDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  '--window-size=1280,900',
  'about:blank',
], {
  windowsHide: true,
  stdio: 'ignore',
});

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForTarget() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page?.webSocketDebuggerUrl) {
        return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error('Chrome DevTools endpoint did not become ready.');
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.waiters = new Map();
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      const eventWaiters = this.waiters.get(message.method) || [];
      this.waiters.delete(message.method);
      eventWaiters.forEach((resolve) => resolve(message.params));
    });
  }

  async ready() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(method, timeout = 5000) {
    return Promise.race([
      new Promise((resolve) => {
        const waiters = this.waiters.get(method) || [];
        waiters.push(resolve);
        this.waiters.set(method, waiters);
      }),
      delay(timeout).then(() => null),
    ]);
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'Browser evaluation failed.');
  }
  return result.result?.value;
}

async function navigate(client, url) {
  const loaded = client.once('Page.loadEventFired');
  await client.send('Page.navigate', { url });
  await loaded;
  await delay(900);
}

async function setViewport(client, width, height, mobile = false) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile,
    screenWidth: width,
    screenHeight: height,
  });
}

async function login(client, email) {
  await navigate(client, `${appOrigin}/login.html`);
  const result = await evaluate(client, `(async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ${JSON.stringify(email)}, password: 'Demo1234!' })
    });
    const payload = await response.json();
    if (!response.ok) return { ok: false, status: response.status };
    localStorage.setItem('unicornio_token', payload.data.token);
    return { ok: true, role: payload.data.user.role };
  })()`);
  if (!result?.ok) throw new Error(`Login failed for ${email}.`);
}

async function inspectPage(client) {
  return evaluate(client, `(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
    };
    const interactive = [...document.querySelectorAll('a, button, input, select, textarea, [tabindex]')].filter(visible);
    const smallTargets = interactive.map((element) => {
      const rect = element.getBoundingClientRect();
      return { tag: element.tagName, id: element.id || null, text: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 60), width: Math.round(rect.width), height: Math.round(rect.height) };
    }).filter((item) => item.width < 44 || item.height < 44);
    const unlabeled = [...document.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter((element) => {
      return !element.closest('label') && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby');
    }).map((element) => element.id || element.name || element.tagName);
    return {
      path: location.pathname,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      smallTargets,
      unlabeled,
      headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(visible).map((heading) => ({ level: heading.tagName, text: heading.textContent.trim().slice(0, 90) })),
      skipLink: Boolean(document.querySelector('a[href="#main-content"]')),
    };
  })()`);
}

async function capture(client, name) {
  const screenshot = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  });
  const path = join(outputDir, `${name}.png`);
  writeFileSync(path, Buffer.from(screenshot.data, 'base64'));
  return path;
}

async function run() {
  const client = new CdpClient(await waitForTarget());
  await client.ready();
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Accessibility.enable');

  const cases = [
    { name: 'admin-dashboard-tablet-landscape', email: 'admin@unicornio.local', path: '/dashboard.html', width: 1180, height: 820 },
    { name: 'admin-users-desktop', email: 'admin@unicornio.local', path: '/users.html', width: 1440, height: 900 },
    { name: 'admin-centers-tablet-landscape', email: 'admin@unicornio.local', path: '/centers.html', width: 1180, height: 820 },
    { name: 'admin-groups-tablet-landscape', email: 'admin@unicornio.local', path: '/groups.html', width: 1180, height: 820 },
    { name: 'admin-consents-desktop', email: 'admin@unicornio.local', path: '/consents.html', width: 1440, height: 900 },
    { name: 'admin-legal-desktop', email: 'admin@unicornio.local', path: '/legal.html', width: 1440, height: 900 },
    { name: 'family-dashboard-tablet-portrait', email: 'familia@unicornio.local', path: '/dashboard.html', width: 820, height: 1180 },
    { name: 'family-consents-tablet-portrait', email: 'familia@unicornio.local', path: '/consents.html', width: 820, height: 1180 },
    { name: 'student-profile-mobile', email: 'alumno@unicornio.local', path: '/child.html', width: 390, height: 844, mobile: true },
  ];

  const results = [];
  await setViewport(client, 820, 1180);
  await navigate(client, `${appOrigin}/login.html`);
  results.push({
    name: 'login-tablet-portrait',
    inspection: await inspectPage(client),
    screenshot: await capture(client, 'login-tablet-portrait'),
    formMetadata: await evaluate(client, `(() => ({
      emailAutocomplete: document.querySelector('input[name="email"]')?.autocomplete,
      passwordAutocomplete: document.querySelector('input[name="password"]')?.autocomplete,
      errorLive: document.getElementById('login-error')?.getAttribute('aria-live'),
    }))()`),
  });

  for (const testCase of cases) {
    await setViewport(client, testCase.width, testCase.height, Boolean(testCase.mobile));
    await login(client, testCase.email);
    await navigate(client, `${appOrigin}${testCase.path}`);
    const inspection = await inspectPage(client);
    const screenshot = await capture(client, testCase.name);
    const modalBefore = await evaluate(client, `(async () => {
      const trigger = document.getElementById('profile-button');
      trigger?.focus();
      trigger?.click();
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const modal = document.getElementById('profile-modal');
      return {
        hidden: modal?.hidden,
        activeId: document.activeElement?.id || null,
        activeText: document.activeElement?.textContent?.trim().slice(0, 50) || null,
        mainInert: Boolean(document.querySelector('main')?.inert),
      };
    })()`);
    results.push({ ...testCase, inspection, screenshot, modalBefore });
  }

  const accessibility = await client.send('Accessibility.getFullAXTree');
  console.log(JSON.stringify({ results, accessibilityNodeCount: accessibility.nodes?.length || 0 }, null, 2));
  client.close();
}

try {
  await run();
} finally {
  chrome.kill();
}
