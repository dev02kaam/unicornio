(() => {
  const ASSET_ROOT = '/assets/companions';
  const SEEN_KEY_PREFIX = 'unicornio_student_instructions_seen:';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pairs = {
    junior: [
      { id: 'nico', name: 'Nico', duration: 11.8 },
      { id: 'luna', name: 'Luna', duration: 15 },
    ],
    senior: [
      { id: 'orion', name: 'Orión', duration: 12.2 },
      { id: 'sol', name: 'Sol', duration: 9.1 },
    ],
  };

  let overlay = null;
  let pair = null;
  let currentStep = -1;
  let activeMedia = null;
  let forceStatic = false;
  let advanceLocked = false;
  let safetyTimer = 0;
  let finishing = false;

  function getSeenKey(user) {
    return `${SEEN_KEY_PREFIX}${String(user?.id || '')}`;
  }

  function hasSeenInstructions(user) {
    if (!user?.id) return true;
    try {
      return sessionStorage.getItem(getSeenKey(user)) === 'true';
    } catch (_error) {
      return false;
    }
  }

  function markInstructionsSeen(user) {
    if (!user?.id) return;
    try {
      sessionStorage.setItem(getSeenKey(user), 'true');
    } catch (_error) {
      // La navegación no debe quedar bloqueada por una preferencia no persistida.
    }
  }

  function calculateAge(birthDate, today = new Date()) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDate || ''));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;

    let age = today.getFullYear() - year;
    if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) {
      age -= 1;
    }
    return age >= 0 && age < 120 ? age : null;
  }

  function resolveAgeBand(user) {
    const companionBand = window.UnicornioCompanion?.getAgeBand?.(user);
    if (companionBand === 'junior' || companionBand === 'senior') return companionBand;

    const age = calculateAge(user?.birthDate);
    if (age !== null) return age <= 11 ? 'junior' : 'senior';
    const rangeStart = Number.parseInt(String(user?.ageRange || '').match(/\d+/)?.[0], 10);
    return Number.isFinite(rangeStart) && rangeStart > 11 ? 'senior' : 'junior';
  }

  function characterMarkup(character, index) {
    const root = `${ASSET_ROOT}/${character.id}`;
    return `
      <div class="student-instructions__character" data-instructions-character data-character-id="${character.id}" data-character-index="${index}" data-state="idle">
        <span class="student-instructions__grounding" aria-hidden="true"></span>
        <img
          class="student-instructions__media student-instructions__media--idle student-instructions__poster"
          src="${root}/question-idle-poster.webp"
          alt=""
          aria-hidden="true"
        />
        <video
          class="student-instructions__media student-instructions__media--idle student-instructions__video"
          src="${root}/question-idle-transparent.webm"
          poster="${root}/question-idle-poster.webp"
          autoplay
          loop
          muted
          playsinline
          preload="auto"
          disablepictureinpicture
          aria-hidden="true"
          data-instructions-idle-video
        ></video>
        <img
          class="student-instructions__media student-instructions__media--speaking student-instructions__poster"
          src="${root}/instructions-speaking-poster.webp"
          alt=""
          aria-hidden="true"
        />
        <video
          class="student-instructions__media student-instructions__media--speaking student-instructions__video"
          src="${root}/instructions-speaking-transparent.webm"
          poster="${root}/instructions-speaking-poster.webp"
          playsinline
          preload="auto"
          disablepictureinpicture
          aria-hidden="true"
          data-instructions-speaking-video
        ></video>
        <audio
          src="${root}/instructions-speaking.mp3"
          preload="auto"
          data-instructions-audio
        ></audio>
      </div>
    `;
  }

  function createOverlay(selectedPair) {
    const element = document.createElement('section');
    element.className = 'student-instructions';
    element.hidden = true;
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', 'true');
    element.setAttribute('aria-label', 'Instrucciones de bienvenida');
    element.innerHTML = `
      <div class="student-instructions__set" aria-hidden="true"></div>
      <div class="student-instructions__pair">
        ${selectedPair.map(characterMarkup).join('')}
      </div>
      <p class="sr-only" aria-live="polite" data-instructions-live></p>
      <button class="student-instructions__start" type="button" hidden data-instructions-start>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 9v6h4l5 4V5L9 9H5Z" fill="currentColor" />
          <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        </svg>
        <span>Escuchar instrucciones</span>
      </button>
    `;
    document.body.append(element);
    return element;
  }

  function pauseMedia(media, reset = false) {
    if (!media) return;
    media.pause();
    if (!reset) return;
    try {
      media.currentTime = 0;
    } catch (_error) {
      // Algunos navegadores esperan a cargar los metadatos para aceptar currentTime.
    }
  }

  function playIdleVideos() {
    overlay?.querySelectorAll('[data-instructions-idle-video]').forEach((video) => {
      if (forceStatic || reducedMotion.matches) {
        pauseMedia(video, true);
        return;
      }
      video.muted = true;
      const playback = video.play();
      if (playback && typeof playback.catch === 'function') playback.catch(() => undefined);
    });
  }

  function setUnderlyingContentBlocked(blocked) {
    const main = document.getElementById('main-content');
    if (!main) return;
    if (blocked) {
      main.setAttribute('inert', '');
      main.setAttribute('aria-hidden', 'true');
      return;
    }
    main.removeAttribute('inert');
    main.removeAttribute('aria-hidden');
  }

  function showManualStart() {
    const button = overlay?.querySelector('[data-instructions-start]');
    if (!button) return;
    button.hidden = false;
    overlay.classList.add('needs-manual-start');
    button.focus({ preventScroll: true });
  }

  function hideManualStart() {
    const button = overlay?.querySelector('[data-instructions-start]');
    if (!button) return;
    button.hidden = true;
    overlay.classList.remove('needs-manual-start');
  }

  function finishInstructions(user) {
    if (finishing) return;
    finishing = true;
    window.clearTimeout(safetyTimer);
    markInstructionsSeen(user);
    overlay?.querySelectorAll('video, audio').forEach((media) => pauseMedia(media));
    overlay?.classList.add('is-leaving');

    const removeDelay = reducedMotion.matches ? 0 : 360;
    window.setTimeout(() => {
      overlay?.remove();
      overlay = null;
      document.body.classList.remove('student-instructions-active');
      setUnderlyingContentBlocked(false);
      document.dispatchEvent(new CustomEvent('unicornio:student-instructions-complete'));
    }, removeDelay);
  }

  function advanceStep(user) {
    if (advanceLocked || finishing) return;
    advanceLocked = true;
    window.clearTimeout(safetyTimer);
    if (currentStep === 0) {
      window.requestAnimationFrame(() => {
        advanceLocked = false;
        startStep(1, user);
      });
      return;
    }
    finishInstructions(user);
  }

  async function startActiveMedia(user, { manual = false } = {}) {
    if (!activeMedia || finishing) return;
    try {
      const playback = activeMedia.play();
      if (playback && typeof playback.then === 'function') await playback;
      hideManualStart();
      const duration = pair[currentStep]?.duration || 15;
      window.clearTimeout(safetyTimer);
      safetyTimer = window.setTimeout(() => advanceStep(user), (duration + 4) * 1000);
    } catch (_error) {
      if (manual && !forceStatic) {
        forceStatic = true;
        overlay?.classList.add('uses-static-media');
        startStep(currentStep, user, { manual: true });
        return;
      }
      showManualStart();
    }
  }

  function startStep(index, user, options = {}) {
    if (!overlay || !pair?.[index] || finishing) return;
    currentStep = index;
    advanceLocked = false;
    window.clearTimeout(safetyTimer);
    hideManualStart();

    const characters = [...overlay.querySelectorAll('[data-instructions-character]')];
    characters.forEach((character, characterIndex) => {
      const speaking = characterIndex === index;
      character.dataset.state = speaking ? 'speaking' : 'idle';
      character.setAttribute('aria-hidden', speaking ? 'false' : 'true');
      pauseMedia(character.querySelector('[data-instructions-speaking-video]'), true);
      pauseMedia(character.querySelector('[data-instructions-audio]'), true);
    });

    const speaker = characters[index];
    activeMedia = forceStatic || reducedMotion.matches
      ? speaker.querySelector('[data-instructions-audio]')
      : speaker.querySelector('[data-instructions-speaking-video]');
    if (activeMedia instanceof HTMLVideoElement) {
      activeMedia.muted = false;
      activeMedia.volume = 1;
    }

    const liveRegion = overlay.querySelector('[data-instructions-live]');
    if (liveRegion) liveRegion.textContent = `${pair[index].name} está explicando las instrucciones.`;
    playIdleVideos();
    startActiveMedia(user, options);
  }

  function bindMedia(user) {
    const characters = [...overlay.querySelectorAll('[data-instructions-character]')];
    characters.forEach((character, index) => {
      const idleVideo = character.querySelector('[data-instructions-idle-video]');
      const speakingVideo = character.querySelector('[data-instructions-speaking-video]');
      const audio = character.querySelector('[data-instructions-audio]');

      idleVideo?.addEventListener('loadeddata', () => character.classList.add('is-idle-ready'));
      speakingVideo?.addEventListener('loadeddata', () => character.classList.add('is-speaking-ready'));
      speakingVideo?.addEventListener('playing', () => character.classList.add('is-speaking-ready'));
      speakingVideo?.addEventListener('ended', () => {
        if (!forceStatic && !reducedMotion.matches && currentStep === index) advanceStep(user);
      });
      audio?.addEventListener('ended', () => {
        if ((forceStatic || reducedMotion.matches) && currentStep === index) advanceStep(user);
      });
      speakingVideo?.addEventListener('error', () => {
        if (currentStep !== index || forceStatic) return;
        forceStatic = true;
        overlay.classList.add('uses-static-media');
        startStep(index, user);
      });
      audio?.addEventListener('error', () => {
        if (currentStep === index) advanceStep(user);
      });
    });

    overlay.querySelector('[data-instructions-start]')?.addEventListener('click', () => {
      startActiveMedia(user, { manual: true });
    });
  }

  async function bootstrap() {
    const user = await sessionReady;
    if (!user || String(user.role || '').toUpperCase() !== 'STUDENT' || hasSeenInstructions(user)) return;

    pair = pairs[resolveAgeBand(user)];
    overlay = createOverlay(pair);
    bindMedia(user);
    document.body.classList.add('student-instructions-active');
    setUnderlyingContentBlocked(true);
    overlay.hidden = false;
    window.requestAnimationFrame(() => {
      overlay?.classList.add('is-visible');
      startStep(0, user);
    });
  }

  bootstrap().catch(() => {
    overlay?.remove();
    overlay = null;
    document.body.classList.remove('student-instructions-active');
    setUnderlyingContentBlocked(false);
  });
})();
