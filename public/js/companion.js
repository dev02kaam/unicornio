(() => {
  const ASSET_ROOT = '/assets/companions';
  const PENDING_PREFERENCE_KEY = 'unicornio_companion_preference';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const characters = {
    junior: {
      MASCULINE: { id: 'nico', name: 'Nico' },
      FEMININE: { id: 'luna', name: 'Luna' },
    },
    senior: {
      MASCULINE: { id: 'orion', name: 'Orion' },
      FEMININE: { id: 'sol', name: 'Sol' },
    },
  };

  const stateMeta = {
    idle: { expression: 'smile', message: 'Estoy aquí contigo.', priority: 0 },
    calm: { expression: 'calm', message: 'Sin prisa. Vamos paso a paso.', priority: 1 },
    listening: { expression: 'listening', message: 'Te escucho. Tómate tu tiempo.', priority: 2 },
    thinking: { expression: 'thinking', message: 'Estoy pensando contigo…', priority: 3 },
    success: { expression: 'celebrating', message: '¡Lo hemos conseguido!', priority: 4 },
    reassuring: { expression: 'listening', message: 'No pasa nada. Lo intentamos juntos.', priority: 4 },
    surprised: { expression: 'surprised', message: '¡Oh! Vamos a verlo juntos.', priority: 3 },
  };

  const runtime = {
    user: null,
    ageContext: null,
    ageBand: 'junior',
    gender: 'FEMININE',
    state: 'idle',
    stateTimer: null,
    holdUntil: 0,
    requestCount: 0,
    lastFeedback: '',
    saveBusy: false,
    widget: null,
  };

  function calculateAge(birthDate, today = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || ''));
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

    let age = today.getFullYear() - year;
    const birthdayPending = today.getMonth() + 1 < month
      || (today.getMonth() + 1 === month && today.getDate() < day);
    if (birthdayPending) age -= 1;
    return age >= 0 && age < 120 ? age : null;
  }

  function resolveAgeSource(user = runtime.user) {
    if (runtime.ageContext?.birthDate) return runtime.ageContext;
    if (user?.role === 'FAMILY' && user.context?.linkedStudent?.birthDate) {
      return user.context.linkedStudent;
    }
    return user;
  }

  function resolveAgeBand(user = runtime.user) {
    const source = resolveAgeSource(user);
    const age = calculateAge(source?.birthDate);
    if (age !== null) return age <= 11 ? 'junior' : 'senior';

    const rangeStart = Number.parseInt(String(source?.ageRange || '').match(/\d+/)?.[0], 10);
    if (Number.isFinite(rangeStart)) return rangeStart <= 11 ? 'junior' : 'senior';

    return user?.role && user.role !== 'STUDENT' ? 'senior' : 'junior';
  }

  function getCharacter() {
    return characters[runtime.ageBand][runtime.gender];
  }

  function getExpressionAsset(expression = stateMeta[runtime.state]?.expression || 'smile', character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/${expression}.png`;
  }

  function getFullAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/full.png`;
  }

  function createPickerMarkup(context = 'panel') {
    const masculine = characters[runtime.ageBand].MASCULINE;
    const feminine = characters[runtime.ageBand].FEMININE;
    return `
      <div class="companion-picker" data-companion-picker="${context}" role="group" aria-label="Elige tu unicornio">
        <button class="companion-choice" type="button" data-companion-choice="MASCULINE" aria-pressed="false">
          <img src="${getExpressionAsset('smile', masculine)}" alt="" />
          <span><strong>${masculine.name}</strong><small>Unicornio</small></span>
        </button>
        <button class="companion-choice" type="button" data-companion-choice="FEMININE" aria-pressed="false">
          <img src="${getExpressionAsset('smile', feminine)}" alt="" />
          <span><strong>${feminine.name}</strong><small>Unicornia</small></span>
        </button>
      </div>
    `;
  }

  function buildWidget() {
    if (document.querySelector('[data-companion-widget]')) return;

    const host = document.createElement('aside');
    host.className = 'companion-widget';
    host.dataset.companionWidget = '';
    host.dataset.state = runtime.state;
    host.innerHTML = `
      <div class="companion-speech" data-companion-speech>
        <strong data-companion-name>Luna</strong>
        <span data-companion-message>Estoy aquí contigo.</span>
      </div>
      <button class="companion-orb" type="button" aria-expanded="false" aria-controls="companion-panel" aria-label="Abrir a tu compañero">
        <span class="companion-orbit companion-orbit--one" aria-hidden="true"></span>
        <span class="companion-orbit companion-orbit--two" aria-hidden="true"></span>
        <span class="companion-face">
          <img data-companion-image src="${getExpressionAsset()}" alt="" />
        </span>
        <span class="companion-state-dot" aria-hidden="true"></span>
      </button>
      <section id="companion-panel" class="companion-panel" role="dialog" aria-label="Tu compañero Unicornio" hidden>
        <div class="companion-panel__header">
          <div>
            <span class="companion-panel__caption">Tu compañero</span>
            <h2 data-companion-panel-title>Luna te acompaña</h2>
          </div>
          <button class="companion-panel__close" type="button" data-close-companion aria-label="Cerrar compañero">×</button>
        </div>
        <p class="companion-panel__copy">Cambiará de edad contigo. Elige la versión que más te guste.</p>
        ${createPickerMarkup('panel')}
        <p class="companion-privacy-note">Esta elección solo cambia el personaje; no describe a la persona que usa la app.</p>
        <p class="companion-save-note" data-companion-save-note role="status" aria-live="polite"></p>
      </section>
      <p class="sr-only" data-companion-live role="status" aria-live="polite"></p>
    `;

    document.body.append(host);
    runtime.widget = host;
    bindWidget(host);
  }

  function bindWidget(host) {
    const orb = host.querySelector('.companion-orb');
    const panel = host.querySelector('.companion-panel');
    const closeButton = host.querySelector('[data-close-companion]');

    function setPanelOpen(open) {
      panel.hidden = !open;
      orb.setAttribute('aria-expanded', String(open));
      host.classList.toggle('is-open', open);
      if (open) {
        setState('listening', { message: '¿Con quién quieres compartir esta aventura?', ttl: 5000 });
        closeButton.focus({ preventScroll: true });
      } else {
        orb.focus({ preventScroll: true });
      }
    }

    orb.addEventListener('click', () => setPanelOpen(panel.hidden));
    closeButton.addEventListener('click', () => setPanelOpen(false));
    document.addEventListener('pointerdown', (event) => {
      if (!panel.hidden && !host.contains(event.target)) setPanelOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !panel.hidden) setPanelOpen(false);
    });

    if (!reducedMotion.matches) {
      orb.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        const rect = orb.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 10;
        const y = ((event.clientY - rect.top) / rect.height - 0.5) * -10;
        orb.style.setProperty('--tilt-x', `${y.toFixed(2)}deg`);
        orb.style.setProperty('--tilt-y', `${x.toFixed(2)}deg`);
      });
      orb.addEventListener('pointerleave', () => {
        orb.style.removeProperty('--tilt-x');
        orb.style.removeProperty('--tilt-y');
      });
    }
  }

  function installBrandLockup() {
    const hero = document.querySelector('.dashboard-hero, .org-hero, .form-card');
    if (!hero || hero.querySelector('.app-brand-lockup')) return;

    const link = document.createElement('a');
    link.className = 'app-brand-lockup';
    const isLoginPage = window.location.pathname === '/login.html';
    link.href = !isLoginPage && typeof getToken === 'function' && getToken()
      ? '/dashboard.html'
      : '/login.html';
    link.setAttribute('aria-label', 'Proyecto Unicornio, ir al inicio');
    link.innerHTML = '<img src="/assets/companions/brand-lockup.png" alt="Proyecto Unicornio" />';
    hero.prepend(link);
  }

  function installLoginScene() {
    if (window.location.pathname !== '/login.html') return;
    const card = document.querySelector('.form-card');
    if (!card || card.classList.contains('login-experience')) return;

    card.classList.add('login-experience');
    const brand = card.querySelector('.app-brand-lockup');
    const formColumn = document.createElement('div');
    formColumn.className = 'login-form-column';
    Array.from(card.children)
      .filter((child) => child !== brand)
      .forEach((child) => formColumn.append(child));

    const visual = document.createElement('div');
    visual.className = 'login-character-stage';
    visual.setAttribute('aria-hidden', 'true');
    visual.innerHTML = `
      <span class="login-constellation login-constellation--one"></span>
      <span class="login-constellation login-constellation--two"></span>
      <img data-companion-full src="${getFullAsset()}" alt="" />
      <div class="login-stage-message"><span>Escuchar antes.</span><strong>Cuidar mejor.</strong></div>
    `;
    card.append(formColumn, visual);
  }

  function installProfilePicker() {
    if (!runtime.user) return;
    document.querySelectorAll('.preferences-card').forEach((card) => {
      if (card.querySelector('[data-profile-companion-picker]')) return;
      const section = document.createElement('section');
      section.className = 'profile-companion-picker';
      section.dataset.profileCompanionPicker = '';
      section.innerHTML = `
        <div class="profile-companion-picker__heading">
          <span class="profile-caption">Compañero Unicornio</span>
          <small>La edad se adapta automáticamente.</small>
        </div>
        ${createPickerMarkup('profile')}
      `;
      card.append(section);
    });
  }

  function filterRoleNavigation(role) {
    const permissions = {
      '/users.html': ['ADMIN'],
      '/centers.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL'],
      '/groups.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'STUDENT'],
      '/consents.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'FAMILY', 'STUDENT'],
      '/legal.html': ['ADMIN'],
    };
    const normalizedRole = String(role || '').toUpperCase();
    document.querySelectorAll('[data-module-link]').forEach((link) => {
      const allowedRoles = permissions[link.dataset.moduleLink] || [];
      if (!allowedRoles.includes(normalizedRole)) link.remove();
    });
  }

  function preloadCurrentCharacter() {
    const character = getCharacter();
    ['smile', 'listening', 'thinking', 'calm', 'celebrating', 'surprised'].forEach((expression) => {
      const image = new Image();
      image.src = getExpressionAsset(expression, character);
    });
  }

  function syncCharacter() {
    runtime.ageBand = resolveAgeBand();
    const character = getCharacter();
    const meta = stateMeta[runtime.state] || stateMeta.idle;
    const asset = getExpressionAsset(meta.expression, character);

    document.documentElement.dataset.companion = character.id;
    document.documentElement.dataset.companionAge = runtime.ageBand;
    runtime.widget?.setAttribute('data-state', runtime.state);

    document.querySelectorAll('[data-companion-image]').forEach((image) => {
      if (image.getAttribute('src') !== asset) image.setAttribute('src', asset);
    });
    document.querySelectorAll('[data-companion-full]').forEach((image) => {
      image.setAttribute('src', getFullAsset(character));
    });
    document.querySelectorAll('[data-companion-name]').forEach((node) => {
      node.textContent = character.name;
    });
    document.querySelectorAll('[data-companion-panel-title]').forEach((node) => {
      node.textContent = `${character.name} te acompaña`;
    });

    document.querySelectorAll('.account-trigger .avatar-badge').forEach((badge) => {
      badge.classList.add('has-companion-avatar');
      badge.innerHTML = `<img src="${asset}" alt="" />`;
    });

    syncPickers();
    preloadCurrentCharacter();
  }

  function syncPickers() {
    document.querySelectorAll('[data-companion-choice]').forEach((button) => {
      const gender = button.dataset.companionChoice;
      const character = characters[runtime.ageBand][gender];
      const image = button.querySelector('img');
      const name = button.querySelector('strong');
      if (image) image.src = getExpressionAsset('smile', character);
      if (name) name.textContent = character.name;
      button.setAttribute('aria-pressed', String(gender === runtime.gender));
      button.classList.toggle('is-selected', gender === runtime.gender);
      button.disabled = runtime.saveBusy;
    });
  }

  function setState(nextState, { message, ttl = 2600, announce = false, force = false } = {}) {
    const nextMeta = stateMeta[nextState] || stateMeta.idle;
    const currentMeta = stateMeta[runtime.state] || stateMeta.idle;
    const now = Date.now();
    if (!force && now < runtime.holdUntil && nextMeta.priority < currentMeta.priority) return;

    window.clearTimeout(runtime.stateTimer);
    runtime.state = nextState in stateMeta ? nextState : 'idle';
    runtime.holdUntil = now + Math.min(ttl, 2200);
    const copy = message || nextMeta.message;
    runtime.widget?.setAttribute('data-state', runtime.state);
    document.querySelectorAll('[data-companion-message]').forEach((node) => {
      node.textContent = copy;
    });
    const orb = runtime.widget?.querySelector('.companion-orb');
    if (orb) orb.setAttribute('aria-label', `${getCharacter().name}: ${copy}`);
    if (announce) {
      const live = runtime.widget?.querySelector('[data-companion-live]');
      if (live) live.textContent = copy;
    }
    syncCharacter();

    if (ttl > 0 && runtime.state !== 'idle') {
      runtime.stateTimer = window.setTimeout(() => {
        if (runtime.requestCount === 0) setState('idle', { ttl: 0, force: true });
      }, ttl);
    }
  }

  async function saveGender(gender, { silent = false } = {}) {
    if (!['MASCULINE', 'FEMININE'].includes(gender) || runtime.saveBusy) return;
    const previous = runtime.gender;
    runtime.gender = gender;
    runtime.saveBusy = true;
    syncCharacter();
    syncPickers();

    const saveNote = document.querySelector('[data-companion-save-note]');
    if (saveNote) saveNote.textContent = 'Guardando tu elección…';

    if (typeof getToken !== 'function' || !getToken()) {
      localStorage.setItem(PENDING_PREFERENCE_KEY, gender);
      runtime.saveBusy = false;
      syncPickers();
      if (saveNote) saveNote.textContent = 'Lo recordaré cuando inicies sesión.';
      if (!silent) setState('success', { message: `¡Genial! ${getCharacter().name} te esperará aquí.`, announce: true });
      return;
    }

    try {
      const response = await apiRequest('/users/me/companion', {
        method: 'PATCH',
        body: JSON.stringify({ unicornGender: gender }),
      });
      runtime.user = { ...runtime.user, ...response.data.user };
      localStorage.removeItem(PENDING_PREFERENCE_KEY);
      if (saveNote) saveNote.textContent = 'Elección guardada.';
      if (!silent) setState('success', { message: `¡Hecho! ${getCharacter().name} se queda contigo.`, announce: true });
    } catch (_error) {
      runtime.gender = previous;
      if (saveNote) saveNote.textContent = 'No se pudo guardar. Inténtalo de nuevo.';
      setState('reassuring', { message: 'No he podido guardar el cambio. Podemos probar otra vez.', announce: true });
    } finally {
      runtime.saveBusy = false;
      syncCharacter();
      syncPickers();
    }
  }

  function createSparkBurst(event) {
    if (reducedMotion.matches || !event.isTrusted) return;
    const burst = document.createElement('span');
    burst.className = 'companion-spark-burst';
    burst.style.left = `${event.clientX}px`;
    burst.style.top = `${event.clientY}px`;
    for (let index = 0; index < 7; index += 1) {
      const spark = document.createElement('i');
      spark.style.setProperty('--spark-angle', `${index * (360 / 7)}deg`);
      spark.style.setProperty('--spark-distance', `${22 + (index % 3) * 7}px`);
      burst.append(spark);
    }
    document.body.append(burst);
    window.setTimeout(() => burst.remove(), 700);
  }

  function inspectFeedback() {
    const candidates = Array.from(document.querySelectorAll('.error:not([hidden]), .success:not([hidden]), .status-banner:not([hidden])'));
    const feedback = candidates.reverse().find((node) => node.textContent.trim() && node.getClientRects().length > 0);
    if (!feedback) return;
    const text = feedback.textContent.trim().replace(/\s+/g, ' ');
    if (!text || text === runtime.lastFeedback) return;
    runtime.lastFeedback = text;

    const isError = feedback.classList.contains('error')
      || feedback.classList.contains('is-error')
      || feedback.dataset.variant === 'error';
    setState(isError ? 'reassuring' : 'success', {
      message: isError ? 'Algo no ha salido como esperábamos. Lo revisamos juntos.' : '¡Listo! Buen trabajo.',
      announce: true,
      ttl: 3200,
    });
  }

  function bindGlobalReactions() {
    let inputTimer = null;
    let feedbackTimer = null;

    document.addEventListener('click', (event) => {
      const choice = event.target.closest('[data-companion-choice]');
      if (choice) {
        saveGender(choice.dataset.companionChoice);
        return;
      }

      const action = event.target.closest('.button, button, a');
      if (!action) return;
      if (action.matches('.button.primary, [data-open-modal]')) createSparkBurst(event);
      const label = String(action.textContent || action.getAttribute('aria-label') || '').toLowerCase();
      if (/crear|añadir|editar|guardar|actualizar|entrar|aceptar/.test(label)) {
        setState('thinking', { message: 'Dame un momento, estoy pensando contigo…', ttl: 2200 });
      } else if (action.hasAttribute('data-open-modal')) {
        setState('listening', { message: 'Cuéntame, estoy prestando atención.', ttl: 2200 });
      }
    });

    document.addEventListener('focusin', (event) => {
      if (event.target.matches('input, select, textarea, [contenteditable="true"]')) {
        setState('listening', { ttl: 1800 });
      }
    });

    document.addEventListener('input', (event) => {
      if (!event.target.matches('input, select, textarea, [contenteditable="true"]')) return;
      window.clearTimeout(inputTimer);
      inputTimer = window.setTimeout(() => {
        setState('thinking', { message: 'Estoy pensando en lo que escribes…', ttl: 1500 });
      }, 260);
    });

    document.addEventListener('submit', () => {
      setState('thinking', { message: 'Estoy revisándolo contigo…', ttl: 5000, force: true });
    }, true);

    document.addEventListener('unicornio:request-start', (event) => {
      runtime.requestCount += 1;
      const mutating = event.detail?.method && event.detail.method !== 'GET';
      setState(mutating ? 'thinking' : 'listening', {
        message: mutating ? 'Estoy preparando todo…' : 'Estoy buscando la información…',
        ttl: 5000,
      });
    });

    document.addEventListener('unicornio:request-end', (event) => {
      runtime.requestCount = Math.max(0, runtime.requestCount - 1);
      if (runtime.requestCount > 0) return;
      if (!event.detail?.ok) {
        setState('reassuring', { announce: true, ttl: 3200, force: true });
      } else if (event.detail?.method && event.detail.method !== 'GET') {
        setState('success', { ttl: 2800, force: true });
      } else {
        setState('idle', { ttl: 0, force: true });
      }
    });

    document.addEventListener('unicornio:companion-state', (event) => {
      setState(event.detail?.state || 'idle', event.detail || {});
    });

    const observer = new MutationObserver(() => {
      window.clearTimeout(feedbackTimer);
      feedbackTimer = window.setTimeout(inspectFeedback, 120);
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'data-variant'],
    });
  }

  async function bootstrap() {
    installBrandLockup();
    installLoginScene();

    const pendingGender = localStorage.getItem(PENDING_PREFERENCE_KEY);
    if (['MASCULINE', 'FEMININE'].includes(pendingGender)) runtime.gender = pendingGender;

    if (window.location.pathname === '/login.html' || typeof getToken !== 'function' || !getToken()) {
      return;
    }

    // El login no necesita resolver el perfil. Evitar esta petición elimina
    // una carrera con una sesión antigua al recargar la pantalla de acceso.
    if (window.location.pathname !== '/login.html' && typeof getToken === 'function' && getToken()) {
      try {
        const response = await apiRequest('/auth/me');
        runtime.user = response.data.user;
        document.documentElement.dataset.userRole = String(runtime.user.role || '').toUpperCase();
        runtime.ageBand = resolveAgeBand(runtime.user);
        if (['MASCULINE', 'FEMININE'].includes(runtime.user.unicornGender)) {
          runtime.gender = runtime.user.unicornGender;
          localStorage.removeItem(PENDING_PREFERENCE_KEY);
        }
        filterRoleNavigation(runtime.user.role);
        installProfilePicker();
        if (!runtime.user.unicornGender && ['MASCULINE', 'FEMININE'].includes(pendingGender)) {
          saveGender(pendingGender, { silent: true });
        }
      } catch (_error) {
        return;
      }
    }

    buildWidget();
    bindGlobalReactions();
    syncCharacter();
    setState('idle', { ttl: 0, force: true });
    document.documentElement.classList.add('companion-ready');
  }

  window.UnicornioCompanion = {
    setState,
    setAgeContext(subject) {
      runtime.ageContext = subject || null;
      runtime.ageBand = resolveAgeBand();
      syncCharacter();
    },
    getCharacter,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
