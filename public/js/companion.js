(() => {
  const ASSET_ROOT = '/assets/companions';
  const PENDING_PREFERENCE_KEY = 'unicornio_companion_preference';
  const COMPANION_SAVE_TIMEOUT_MS = 8000;
  const LOGIN_PRESENTATION_LOADER_MIN_MS = 520;
  const LOGIN_PRESENTATION_FINAL_ASSETS = {
    sol: `${ASSET_ROOT}/sol/login-presentation-final.webp`,
    orion: `${ASSET_ROOT}/orion/login-presentation-final.webp`,
  };
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

  const loginPreviewCharacters = [
    characters.junior.FEMININE,
    characters.junior.MASCULINE,
    characters.senior.FEMININE,
    characters.senior.MASCULINE,
  ];

  const loginPreviewIdentity = {
    luna: {
      descriptor: 'calma lunar',
      icon: `
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <circle cx="24" cy="24" r="20" fill="#30265f" />
          <path d="M30.6 10.5a14.8 14.8 0 1 0 7.1 24.2 13 13 0 1 1-7.1-24.2Z" fill="#fff2bd" />
          <circle cx="35.2" cy="14.4" r="1.7" fill="#9fe3d5" />
          <circle cx="39.1" cy="22.2" r="1.1" fill="#ff9bc7" />
        </svg>
      `,
    },
    nico: {
      descriptor: 'estrella viajera',
      icon: `
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <path d="m29.4 8.2 2.5 7.1 7.4 1-5.8 4.7 1.7 7.3-6.3-4-6.4 3.9 1.8-7.2-5.8-4.8 7.5-1Z" fill="#fff1a8" />
          <path d="M20.5 26.5 8.8 38.2M25.1 30 17 38.1M17 22.6l-7.8 7.8" fill="none" stroke="#d9f7ff" stroke-linecap="round" stroke-width="3" />
          <circle cx="37.5" cy="34.5" r="2" fill="#ff9bc7" />
        </svg>
      `,
    },
    sol: {
      descriptor: 'luz valiente',
      icon: `
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <g fill="none" stroke="#9b581e" stroke-linecap="round" stroke-width="2.6">
            <path d="M24 3.5v6M24 38.5v6M3.5 24h6M38.5 24h6M9.5 9.5l4.2 4.2M34.3 34.3l4.2 4.2M38.5 9.5l-4.2 4.2M13.7 34.3l-4.2 4.2" />
          </g>
          <circle cx="24" cy="24" r="11.5" fill="#ffc95d" />
          <circle cx="20" cy="20" r="3.2" fill="#ffe8a9" opacity=".82" />
        </svg>
      `,
    },
    orion: {
      descriptor: 'mapa del cielo',
      icon: `
        <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
          <g fill="none" stroke="#a9d7ff" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6">
            <path d="m12 10 8.5 8.5 10-4 5.5 9-9 6.5-7-3.5-8 11.5" />
            <path d="m20.5 18.5-.5 8 7-2 3.5-10.5" />
          </g>
          <g fill="#fff2bd">
            <circle cx="12" cy="10" r="2.5" />
            <circle cx="20.5" cy="18.5" r="2.1" />
            <circle cx="30.5" cy="14" r="2.7" />
            <circle cx="36" cy="23" r="2" />
            <circle cx="27" cy="30" r="2.5" />
            <circle cx="20" cy="26.5" r="2" />
            <circle cx="12" cy="38" r="2.3" />
          </g>
        </svg>
      `,
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

  function getAvatarAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/avatar-v2.png`;
  }

  function getProfileLoopAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/profile-loop-transparent.webm`;
  }

  function getProfileLoopPosterAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/profile-loop-poster.webp`;
  }

  function getExpressionAsset(character = getCharacter(), state = runtime.state) {
    const expression = (stateMeta[state] || stateMeta.idle).expression;
    return `${ASSET_ROOT}/${character.id}/${expression}.png`;
  }

  function getFullAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/full.png`;
  }

  function getLoginFullAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/login-full-v3.png`;
  }

  function getLoginPresentationAsset(character = getCharacter()) {
    return `${ASSET_ROOT}/${character.id}/login-presentation-transparent.webm`;
  }

  function getLoginPresentationFinalAsset(character = getCharacter()) {
    return LOGIN_PRESENTATION_FINAL_ASSETS[character.id] || '';
  }

  function createLoginPresentationAudioMarkup() {
    return `
      <button
        class="login-presentation-audio"
        type="button"
        data-login-presentation-audio
        aria-label="Escuchar la presentación de Luna"
        aria-pressed="false"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path class="login-presentation-audio__speaker" d="M4 10v4h3.2l4.1 3.2V6.8L7.2 10H4Z" />
          <path class="login-presentation-audio__waves" d="M14.3 9.1a4 4 0 0 1 0 5.8M16.8 6.8a7.2 7.2 0 0 1 0 10.4" />
          <path class="login-presentation-audio__muted" d="m15.2 9.2 4.6 4.6m0-4.6-4.6 4.6" />
        </svg>
        <span data-login-audio-label>Escuchar presentación</span>
      </button>
    `;
  }

  function createLoginPresentationLoaderMarkup(character = loginPreviewCharacters[0]) {
    return `
      <div
        class="login-presentation-loader"
        data-login-presentation-loader
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-hidden="true"
      >
        <span class="login-presentation-loader__orbit" aria-hidden="true">
          <i></i><i></i><i></i>
        </span>
        <span data-login-presentation-loader-label>Preparando a ${character.name}&hellip;</span>
      </div>
    `;
  }

  function createLoginPresentationMarkup(character = getCharacter()) {
    return `
      <img
        class="login-character-poster"
        data-companion-presentation-poster
        src="${getLoginFullAsset(character)}"
        alt=""
      />
      <video
        class="login-character-presentation"
        data-companion-presentation
        src="${getLoginPresentationAsset(character)}"
        poster="${getLoginFullAsset(character)}"
        autoplay
        muted
        playsinline
        preload="metadata"
        aria-hidden="true"
      ></video>
      <img
        class="login-character-presentation-final"
        data-companion-presentation-final
        alt=""
        hidden
      />
      ${createLoginPresentationLoaderMarkup(character)}
      ${createLoginPresentationAudioMarkup()}
    `;
  }

  function createLoginPreviewPickerMarkup(selectedId = 'luna') {
    const choices = loginPreviewCharacters.map((character) => {
      const identity = loginPreviewIdentity[character.id];
      return `
        <button
          class="login-character-choice"
          type="button"
          data-login-companion="${character.id}"
          aria-label="Ver a ${character.name}, ${identity.descriptor}"
          aria-pressed="${character.id === selectedId}"
        >
          <span class="login-character-choice__symbol" aria-hidden="true">${identity.icon}</span>
          <span class="login-character-choice__label">
            <strong class="login-character-choice__name">${character.name}</strong>
            <small class="login-character-choice__trait">${identity.descriptor}</small>
          </span>
        </button>
      `;
    }).join('');

    return `
      <div class="login-character-picker" role="group" aria-label="Previsualiza los cuatro compañeros">
        <span class="login-character-picker__prompt">¿Quién te acompaña hoy?</span>
        <div class="login-character-picker__sky">
          <svg class="login-character-picker__orbit" viewBox="0 0 420 76" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M42 43 C 83 16, 128 15, 167 37 S 252 66, 292 38 S 357 16, 396 34" />
          </svg>
          ${choices}
        </div>
      </div>
      <p class="sr-only" data-login-preview-live aria-live="polite">Luna seleccionada para previsualización.</p>
    `;
  }

  const loginPresentationCache = new Map();

  function preloadLoginPresentationAsset(character) {
    const src = getLoginPresentationAsset(character);
    if (loginPresentationCache.has(src)) return loginPresentationCache.get(src);

    const preload = document.createElement('video');
    preload.preload = 'metadata';
    preload.muted = true;
    preload.playsInline = true;
    const ready = new Promise((resolve) => {
      preload.addEventListener('loadedmetadata', () => resolve(src), { once: true });
      preload.addEventListener('error', () => resolve(null), { once: true });
    });
    loginPresentationCache.set(src, ready);
    preload.src = src;
    preload.load();
    return ready;
  }

  function playVideo(video) {
    if (!video || reducedMotion.matches) {
      video?.pause();
      return;
    }
    const playback = video.play();
    if (playback && typeof playback.catch === 'function') playback.catch(() => undefined);
  }

  function syncLoopVideo(video, character) {
    if (!video) return;
    const src = getProfileLoopAsset(character);
    const poster = getProfileLoopPosterAsset(character);
    video.poster = poster;
    video.defaultMuted = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    if (video.getAttribute('src') !== src) {
      video.setAttribute('src', src);
      video.load();
    }
    playVideo(video);
  }

  function createLoopVideo(character = getCharacter()) {
    const video = document.createElement('video');
    video.dataset.companionLoop = '';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('preload', 'auto');
    video.setAttribute('disablepictureinpicture', '');
    video.autoplay = true;
    video.defaultMuted = true;
    syncLoopVideo(video, character);
    return video;
  }

  function syncMotionPreference() {
    document.querySelectorAll('[data-companion-loop]').forEach((video) => {
      if (reducedMotion.matches) {
        video.pause();
        try {
          video.currentTime = 0;
        } catch (_error) {
          // El primer fotograma puede no estar disponible todavía.
        }
      } else {
        playVideo(video);
      }
    });

    document.querySelectorAll('[data-companion-presentation]').forEach((video) => {
      if (reducedMotion.matches) {
        video.pause();
      } else if (
        !video.ended
        && !video.closest('.login-character-stage')?.classList.contains('is-presentation-complete')
      ) {
        playVideo(video);
      }
    });
  }

  function createLoginPreviewSparkBurst(button) {
    if (reducedMotion.matches) return;

    const offsets = [
      [-34, -28],
      [-12, -38],
      [18, -36],
      [36, -15],
      [33, 18],
      [12, 34],
      [-20, 32],
      [-38, 10],
    ];
    const burst = document.createElement('span');
    burst.className = 'login-preview-spark-burst';
    burst.setAttribute('aria-hidden', 'true');
    burst.innerHTML = offsets.map(([x, y], index) => `
      <i style="--spark-x:${x}px;--spark-y:${y}px;--spark-delay:${index * 24}ms">✦</i>
    `).join('');
    button.append(burst);
    window.setTimeout(() => burst.remove(), 680);
  }

  function bindLoginPreviewPicker(stage) {
    if (stage.dataset.loginPreviewBound === 'true') return;
    stage.dataset.loginPreviewBound = 'true';

    const previewVideo = stage.querySelector('[data-companion-presentation]');
    const previewPoster = stage.querySelector('[data-companion-presentation-poster]');
    const previewFinal = stage.querySelector('[data-companion-presentation-final]');
    const audioButton = stage.querySelector('[data-login-presentation-audio]');
    const audioLabel = audioButton?.querySelector('[data-login-audio-label]');
    const presentationLoader = stage.querySelector('[data-login-presentation-loader]');
    const presentationLoaderLabel = presentationLoader?.querySelector('[data-login-presentation-loader-label]');
    const liveRegion = stage.querySelector('[data-login-preview-live]');
    let previewRequestId = 0;
    let previewReadyTimer = 0;

    if (!previewVideo || !previewPoster) return;

    const selectedCharacter = () => loginPreviewCharacters.find(
      ({ id }) => stage.querySelector(`[data-login-companion="${id}"]`)?.getAttribute('aria-pressed') === 'true',
    ) || loginPreviewCharacters[0];

    const setPresentationAudioEnabled = (enabled, character = selectedCharacter()) => {
      previewVideo.defaultMuted = true;
      previewVideo.muted = !enabled;
      stage.dataset.presentationAudio = enabled ? 'on' : 'off';
      if (!audioButton) return;
      audioButton.setAttribute('aria-pressed', String(enabled));
      audioButton.setAttribute(
        'aria-label',
        enabled
          ? `Silenciar la presentación de ${character.name}`
          : `Escuchar la presentación de ${character.name}`,
      );
      if (audioLabel) {
        audioLabel.textContent = enabled ? 'Silenciar presentación' : 'Escuchar presentación';
      }
    };

    const setPresentationLoading = (loading, character = selectedCharacter()) => {
      stage.classList.toggle('is-presentation-loading', loading && !reducedMotion.matches);
      if (loading && !reducedMotion.matches) stage.setAttribute('aria-busy', 'true');
      else stage.removeAttribute('aria-busy');
      if (audioButton) audioButton.disabled = loading && !reducedMotion.matches;
      if (!presentationLoader) return;
      presentationLoader.setAttribute('aria-hidden', String(!loading || reducedMotion.matches));
      if (loading && presentationLoaderLabel) {
        presentationLoaderLabel.textContent = `Preparando a ${character.name}…`;
      }
    };

    const resetPresentationPlaybackState = () => {
      stage.classList.remove('is-presentation-settling', 'is-presentation-complete');
    };

    const syncPresentationFinal = (character = selectedCharacter()) => {
      if (!previewFinal) return '';
      const src = getLoginPresentationFinalAsset(character);
      stage.classList.toggle('has-presentation-final', Boolean(src));
      previewFinal.hidden = !src;
      if (src && previewFinal.getAttribute('src') !== src) previewFinal.setAttribute('src', src);
      return src;
    };

    const holdFinalPresentationFrame = () => {
      if (
        reducedMotion.matches
        || stage.classList.contains('is-presentation-complete')
        || !Number.isFinite(previewVideo.duration)
      ) return;

      stage.classList.add('is-presentation-complete');
      previewVideo.pause();
      if (getLoginPresentationFinalAsset(selectedCharacter())) {
        stage.classList.add('is-presentation-settling');
        return;
      }
      try {
        previewVideo.currentTime = Math.max(0, previewVideo.duration - 0.06);
      } catch (_error) {
        // El último fotograma ya visible permanece como respaldo.
      }
    };

    setPresentationAudioEnabled(false);

    audioButton?.addEventListener('click', () => {
      const enableAudio = audioButton.getAttribute('aria-pressed') !== 'true';
      setPresentationAudioEnabled(enableAudio);
      if (enableAudio) {
        resetPresentationPlaybackState();
        try {
          previewVideo.currentTime = 0;
        } catch (_error) {
          // El vídeo arrancará desde el principio en cuanto termine de cargar.
        }
      }
      playVideo(previewVideo);
    });

    const markPresentationReady = () => {
      setPresentationLoading(false);
      if (!reducedMotion.matches) stage.classList.add('is-presentation-ready');
    };

    previewVideo.addEventListener('timeupdate', () => {
      const remaining = previewVideo.duration - previewVideo.currentTime;
      if (
        remaining > 0
        && remaining <= 0.24
        && getLoginPresentationFinalAsset(selectedCharacter())
      ) {
        stage.classList.add('is-presentation-settling');
        return;
      }
      if (remaining > 0 && remaining <= 0.06) holdFinalPresentationFrame();
    });
    previewVideo.addEventListener('ended', holdFinalPresentationFrame);
    if (previewVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      markPresentationReady();
      playVideo(previewVideo);
    } else {
      previewVideo.addEventListener('loadeddata', markPresentationReady, { once: true });
    }

    stage.querySelectorAll('[data-login-companion]').forEach((button) => {
      const character = loginPreviewCharacters.find(({ id }) => id === button.dataset.loginCompanion);
      if (!character) return;

      const warmAsset = () => preloadLoginPresentationAsset(character);
      button.addEventListener('pointerenter', warmAsset, { once: true });
      button.addEventListener('focus', warmAsset, { once: true });
      button.addEventListener('click', () => {
        const alreadySelected = button.getAttribute('aria-pressed') === 'true';

        stage.querySelectorAll('[data-login-companion]').forEach((choice) => {
          choice.setAttribute('aria-pressed', String(choice === button));
        });
        stage.dataset.loginTheme = character.id;
        const audioEnabled = audioButton?.getAttribute('aria-pressed') === 'true';
        setPresentationAudioEnabled(audioEnabled, character);

        const nextPoster = getLoginFullAsset(character);
        const nextPresentation = getLoginPresentationAsset(character);
        resetPresentationPlaybackState();
        syncPresentationFinal(character);

        if (alreadySelected && previewVideo.getAttribute('src') === nextPresentation) {
          previewPoster.setAttribute('src', nextPoster);
          previewVideo.setAttribute('poster', nextPoster);
          try {
            previewVideo.currentTime = 0;
          } catch (_error) {
            // El vídeo todavía puede estar cargando; play() continuará cuando esté listo.
          }
          playVideo(previewVideo);
        } else {
          const requestId = ++previewRequestId;
          const loadingStartedAt = performance.now();
          window.clearTimeout(previewReadyTimer);
          previewVideo.autoplay = false;
          previewVideo.pause();
          setPresentationLoading(true, character);
          stage.classList.remove('is-presentation-ready');
          previewPoster.setAttribute('src', nextPoster);
          previewVideo.setAttribute('poster', nextPoster);
          const handleReady = () => {
            if (requestId !== previewRequestId) return;
            const remainingLoaderTime = Math.max(
              0,
              (reducedMotion.matches ? 0 : LOGIN_PRESENTATION_LOADER_MIN_MS)
                - (performance.now() - loadingStartedAt),
            );
            previewReadyTimer = window.setTimeout(() => {
              if (requestId !== previewRequestId) return;
              try {
                previewVideo.currentTime = 0;
              } catch (_error) {
                // El vÃ­deo comenzarÃ¡ en cero cuando el navegador complete el seek inicial.
              }
              previewVideo.autoplay = true;
              markPresentationReady();
              playVideo(previewVideo);
            }, remainingLoaderTime);
          };
          const handleError = () => {
            if (requestId !== previewRequestId) return;
            window.clearTimeout(previewReadyTimer);
            previewVideo.autoplay = true;
            setPresentationLoading(false, character);
            stage.classList.remove('is-presentation-ready');
            if (liveRegion) liveRegion.textContent = `No se pudo cargar la presentación de ${character.name}.`;
          };
          previewVideo.addEventListener('loadeddata', handleReady, { once: true });
          previewVideo.addEventListener('error', handleError, { once: true });
          previewVideo.setAttribute('src', nextPresentation);
          previewVideo.load();
        }

        createLoginPreviewSparkBurst(button);
        if (liveRegion) {
          liveRegion.textContent = `${character.name} seleccionado para previsualización.`;
        }
      });
    });
  }

  function createPickerMarkup(context = 'panel') {
    const masculine = characters[runtime.ageBand].MASCULINE;
    const feminine = characters[runtime.ageBand].FEMININE;
    return `
      <div class="companion-picker" data-companion-picker="${context}" role="group" aria-label="Elige tu unicornio">
        <button class="companion-choice" type="button" data-companion-choice="MASCULINE" data-companion-id="${masculine.id}" aria-pressed="false">
          <img src="${getAvatarAsset(masculine)}" alt="" />
          <span><strong>${masculine.name}</strong><small>Unicornio</small></span>
        </button>
        <button class="companion-choice" type="button" data-companion-choice="FEMININE" data-companion-id="${feminine.id}" aria-pressed="false">
          <img src="${getAvatarAsset(feminine)}" alt="" />
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
          <video
            data-companion-loop
            src="${getProfileLoopAsset()}"
            poster="${getProfileLoopPosterAsset()}"
            autoplay
            muted
            loop
            playsinline
            preload="auto"
            disablepictureinpicture
            aria-hidden="true"
          ></video>
          <img data-companion-expression src="${getExpressionAsset()}" alt="" />
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
    link.innerHTML = '<img src="/assets/brand/logo_proyecto_unicornio_horizontal_limpio.png" alt="Proyecto Unicornio — Escuchar antes. Cuidar mejor." />';
    hero.prepend(link);
  }

  function installLoginScene() {
    if (window.location.pathname !== '/login.html') return;
    const card = document.querySelector('.form-card');
    if (!card) return;

    let visual = card.querySelector('.login-character-stage');
    if (!card.classList.contains('login-experience')) {
      card.classList.add('login-experience');
      const brand = card.querySelector('.app-brand-lockup');
      const formColumn = document.createElement('div');
      formColumn.className = 'login-form-column';
      Array.from(card.children)
        .filter((child) => child !== brand)
        .forEach((child) => formColumn.append(child));

      visual = document.createElement('div');
      visual.className = 'login-character-stage';
      card.append(formColumn, visual);
    }

    if (!visual) return;
    if (!visual.querySelector('.login-character-picker')) {
      visual.insertAdjacentHTML('afterbegin', createLoginPreviewPickerMarkup());
    }
    if (!visual.querySelector('[data-companion-presentation]')) {
      visual.querySelector('[data-companion-full]')?.remove();
      visual.insertAdjacentHTML(
        'beforeend',
        createLoginPresentationMarkup(),
      );
    }
    if (!visual.querySelector('[data-login-presentation-audio]')) {
      visual.insertAdjacentHTML('beforeend', createLoginPresentationAudioMarkup());
    }
    if (!visual.querySelector('[data-login-presentation-loader]')) {
      visual.insertAdjacentHTML('beforeend', createLoginPresentationLoaderMarkup());
    }
    bindLoginPreviewPicker(visual);
  }

  function installProfilePicker() {
    if (!runtime.user) return;
    document.querySelectorAll('#profile-modal .preferences-card').forEach((card) => {
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
        <p class="companion-save-note" data-companion-save-note role="status" aria-live="polite"></p>
      `;
      card.append(section);
    });
  }

  function filterRoleNavigation(role) {
    const permissions = {
      '/dashboard.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'FAMILY', 'STUDENT'],
      '/users.html': ['ADMIN'],
      '/centers.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL'],
      '/groups.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'STUDENT'],
      '/questionnaires.html': ['ADMIN', 'SCHOOL', 'PROFESSIONAL'],
      '/questionnaire.html': ['STUDENT'],
      '/consents.html': ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'FAMILY', 'STUDENT'],
      '/notifications.html': ['PROFESSIONAL', 'FAMILY'],
      '/child.html': ['FAMILY', 'STUDENT'],
      '/legal.html': ['ADMIN'],
    };
    const normalizedRole = String(role || '').toUpperCase();
    if (typeof window.renderRoleNavigation === 'function') {
      document.querySelectorAll('.dashboard-links').forEach((container) => {
        window.renderRoleNavigation(container, normalizedRole);
      });
    }
    document.querySelectorAll('[data-module-link]').forEach((link) => {
      const allowedRoles = permissions[link.dataset.moduleLink] || [];
      if (!allowedRoles.includes(normalizedRole)) link.remove();
    });
  }

  function preloadCurrentCharacter() {
    const character = getCharacter();
    const expressionAssets = Object.keys(stateMeta).map((state) => getExpressionAsset(character, state));
    [
      getAvatarAsset(character),
      getProfileLoopPosterAsset(character),
      ...new Set(expressionAssets),
    ].forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }

  async function waitForShellImages() {
    const media = Array.from(document.querySelectorAll(
      '.app-brand-lockup img, .account-trigger .avatar-badge img, .account-trigger .avatar-badge video',
    ));
    const settled = Promise.all(media.map((item) => {
      if (item instanceof HTMLVideoElement) {
        if (item.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
        return new Promise((resolve) => {
          item.addEventListener('loadeddata', resolve, { once: true });
          item.addEventListener('error', resolve, { once: true });
        });
      }
      if (item.complete) {
        return typeof item.decode === 'function'
          ? item.decode().catch(() => undefined)
          : Promise.resolve();
      }
      return new Promise((resolve) => {
        item.addEventListener('load', resolve, { once: true });
        item.addEventListener('error', resolve, { once: true });
      });
    }));

    await Promise.race([
      settled,
      new Promise((resolve) => window.setTimeout(resolve, 2000)),
    ]);
  }

  function syncCharacter() {
    runtime.ageBand = resolveAgeBand();
    const character = getCharacter();
    const expression = (stateMeta[runtime.state] || stateMeta.idle).expression;
    const expressionAsset = getExpressionAsset(character);

    document.documentElement.dataset.companion = character.id;
    document.documentElement.dataset.companionAge = runtime.ageBand;
    runtime.widget?.setAttribute('data-state', runtime.state);

    document.querySelectorAll('[data-companion-loop]').forEach((video) => {
      syncLoopVideo(video, character);
    });
    document.querySelectorAll('[data-companion-expression]').forEach((image) => {
      image.dataset.companionExpressionState = expression;
      const widget = image.closest('.companion-widget');
      if (image.getAttribute('src') === expressionAsset) {
        if (image.complete && image.naturalWidth > 0) {
          widget?.classList.remove('is-expression-loading');
        }
        return;
      }

      widget?.classList.add('is-expression-loading');
      const revealExpression = () => {
        if (image.getAttribute('src') === expressionAsset) {
          widget?.classList.remove('is-expression-loading');
        }
      };
      image.addEventListener('load', revealExpression, { once: true });
      image.addEventListener('error', revealExpression, { once: true });
      image.setAttribute('src', expressionAsset);
      if (typeof image.decode === 'function') {
        image.decode().then(revealExpression, revealExpression);
      } else if (image.complete) {
        revealExpression();
      }
    });
    document.querySelectorAll('[data-companion-full]').forEach((image) => {
      image.setAttribute(
        'src',
        window.location.pathname === '/login.html'
          ? getLoginFullAsset(character)
          : getFullAsset(character),
      );
    });
    document.querySelectorAll('[data-companion-name]').forEach((node) => {
      node.textContent = character.name;
    });
    document.querySelectorAll('[data-companion-panel-title]').forEach((node) => {
      node.textContent = `${character.name} te acompaña`;
    });

    document.querySelectorAll('.account-trigger .avatar-badge').forEach((badge) => {
      badge.classList.add('has-companion-avatar');
      let video = badge.querySelector('[data-companion-loop]');
      if (!video) {
        video = createLoopVideo(character);
        badge.replaceChildren(video);
        playVideo(video);
      } else {
        syncLoopVideo(video, character);
      }
      video.setAttribute('poster', getProfileLoopPosterAsset(character));
    });

    syncPickers();
    preloadCurrentCharacter();
  }

  function syncPickers() {
    document.querySelectorAll('[data-companion-picker]').forEach((picker) => {
      picker.setAttribute('aria-busy', String(runtime.saveBusy));
    });

    document.querySelectorAll('[data-companion-choice]').forEach((button) => {
      const gender = button.dataset.companionChoice;
      const character = characters[runtime.ageBand][gender];
      button.dataset.companionId = character.id;
      const image = button.querySelector('img');
      const name = button.querySelector('strong');
      if (image) image.src = getAvatarAsset(character);
      if (name) name.textContent = character.name;
      button.setAttribute('aria-pressed', String(gender === runtime.gender));
      button.classList.toggle('is-selected', gender === runtime.gender);
      button.classList.toggle('is-saving', runtime.saveBusy && gender === runtime.gender);
      button.disabled = runtime.saveBusy;
    });
  }

  function setSaveMessage(message, state = '') {
    document.querySelectorAll('[data-companion-save-note]').forEach((note) => {
      note.textContent = message;
      if (state) note.dataset.state = state;
      else delete note.dataset.state;
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
    if (gender === runtime.gender) {
      setSaveMessage(`${getCharacter().name} ya está seleccionado.`, 'success');
      return;
    }

    const previous = runtime.gender;
    runtime.gender = gender;
    runtime.saveBusy = true;
    syncCharacter();
    syncPickers();
    setSaveMessage('Guardando tu elección…', 'saving');

    if (typeof getToken !== 'function' || !getToken()) {
      localStorage.setItem(PENDING_PREFERENCE_KEY, gender);
      runtime.saveBusy = false;
      syncPickers();
      setSaveMessage('Lo recordaré cuando inicies sesión.', 'success');
      if (!silent) setState('success', { message: `¡Genial! ${getCharacter().name} te esperará aquí.`, announce: true });
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), COMPANION_SAVE_TIMEOUT_MS);
    try {
      const response = await apiRequest('/users/me/companion', {
        method: 'PATCH',
        body: JSON.stringify({ unicornGender: gender }),
        signal: controller.signal,
      });
      runtime.user = { ...runtime.user, ...response.data.user };
      localStorage.removeItem(PENDING_PREFERENCE_KEY);
      setSaveMessage('Elección guardada.', 'success');
      if (!silent) setState('success', { message: `¡Hecho! ${getCharacter().name} se queda contigo.`, announce: true });
    } catch (error) {
      runtime.gender = previous;
      setSaveMessage(
        error?.name === 'AbortError'
          ? 'El guardado está tardando demasiado. Inténtalo de nuevo.'
          : 'No se pudo guardar. Inténtalo de nuevo.',
        'error',
      );
      setState('reassuring', { message: 'No he podido guardar el cambio. Podemos probar otra vez.', announce: true });
    } finally {
      window.clearTimeout(timeoutId);
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

    if (window.location.pathname === '/login.html') {
      return;
    }

    runtime.user = await sessionReady;
    if (!runtime.user || typeof getToken !== 'function' || !getToken()) return;

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

    buildWidget();
    bindGlobalReactions();
    syncCharacter();
    setState('idle', { ttl: 0, force: true });
    await waitForShellImages();
    document.documentElement.classList.add('companion-ready');
    window.UnicornioAppLoading?.markShellReady();
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

  if (typeof reducedMotion.addEventListener === 'function') {
    reducedMotion.addEventListener('change', syncMotionPreference);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
