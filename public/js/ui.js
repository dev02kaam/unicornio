const modalState = new WeakMap();
const modalBackgroundState = new WeakMap();
const modalSelector = '.modal:not([hidden]), .profile-modal:not([hidden])';
const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getOpenModals() {
  return Array.from(document.querySelectorAll(modalSelector));
}

function isModalBusy(modal) {
  return Boolean(
    modal?.matches?.('[aria-busy="true"]')
      || modal?.querySelector?.('[aria-busy="true"]'),
  );
}

function syncModalPageState() {
  const openModals = getOpenModals();
  const activeModal = openModals.at(-1) || null;
  const hasOpenModal = Boolean(activeModal);
  document.body.classList.toggle('modal-open', hasOpenModal);

  Array.from(document.body.children).forEach((element) => {
    if (!(element instanceof HTMLElement) || element.matches('script, style')) {
      return;
    }

    const belongsToActiveModal = activeModal
      && (element === activeModal || element.contains(activeModal));
    const shouldBeInert = hasOpenModal && !belongsToActiveModal;

    if (shouldBeInert) {
      if (!modalBackgroundState.has(element)) {
        modalBackgroundState.set(element, element.inert);
      }
      element.inert = true;
      return;
    }

    if (modalBackgroundState.has(element)) {
      element.inert = modalBackgroundState.get(element);
      modalBackgroundState.delete(element);
    }
  });
}

function openModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modalState.set(modal, { opener: document.activeElement });
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  syncModalPageState();

  queueMicrotask(() => {
    const firstFocusable = modal.querySelector(focusableSelector);
    const panel = modal.querySelector('[role="dialog"]');
    if (firstFocusable) {
      firstFocusable.focus();
      return;
    }
    if (panel) {
      panel.setAttribute('tabindex', '-1');
      panel.focus();
    }
  });
}

function closeModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  syncModalPageState();

  const opener = modalState.get(modal)?.opener;
  modalState.delete(modal);
  modal.dispatchEvent(new CustomEvent('unicornio:modal-closed'));
  if (opener instanceof HTMLElement && opener.isConnected) {
    opener.focus();
  }
}

document.addEventListener('keydown', (event) => {
  const openModals = getOpenModals();
  const activeModal = openModals.at(-1);
  if (!activeModal) {
    return;
  }

  if (event.key === 'Escape') {
    if (activeModal.querySelector('.select-control.is-open')) {
      return;
    }
    if (isModalBusy(activeModal)) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    closeModalById(activeModal.id);
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusable = Array.from(activeModal.querySelectorAll(focusableSelector))
    .filter((element) => element.getClientRects().length > 0);
  if (focusable.length === 0) {
    event.preventDefault();
    activeModal.querySelector('[role="dialog"]')?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character]);
}

window.escapeHtml = escapeHtml;

// Iconos compartidos: mantienen la interfaz reconocible sin depender de una librería externa.
const appIconPaths = {
  users: '<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  school: '<path d="m3 10 9-6 9 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-6h6v6M7 11h.01M12 11h.01M17 11h.01"/>',
  groups: '<circle cx="12" cy="7" r="3"/><circle cx="5" cy="10" r="2"/><circle cx="19" cy="10" r="2"/><path d="M6 21v-1a6 6 0 0 1 12 0v1M2 21v-1a4 4 0 0 1 3-3.87M22 21v-1a4 4 0 0 0-3-3.87"/>',
  consent: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/>',
  legal: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/>',
  child: '<circle cx="12" cy="8" r="4"/><path d="M5 21a7 7 0 0 1 14 0M3 4.5 5.5 3M21 4.5 18.5 3"/>',
  profile: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="9" r="3"/><path d="M6.7 19a6 6 0 0 1 10.6 0"/>',
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  columns: '<path d="M4 5h16M4 12h16M4 19h16"/><circle cx="7" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="10" cy="19" r="1"/>',
  refresh: '<path d="M20 11a8 8 0 1 0 2 5.5" stroke-width="2.6"/><path d="M16 5v12l7-6Z" fill="currentColor" stroke="none"/>',
  filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
  clear: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  back: '<path d="m15 18-6-6 6-6M9 12h12"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  logout: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><path d="M12 2v10"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  family: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/>',
  sparkle: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  warning: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 17h.01" stroke-width="2.8"/>',
};

function getAppIcon(name, extraClass = '') {
  const iconName = appIconPaths[name] ? name : 'sparkle';
  const viewBox = iconName === 'refresh' ? '0 0 26 26' : '0 0 24 24';
  return `<span class="app-icon app-icon--${iconName} ${extraClass}" aria-hidden="true"><svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" focusable="false">${appIconPaths[iconName]}</svg></span>`;
}

function getAppIconName(value = '') {
  const label = String(value).toLocaleLowerCase('es');
  if (label.includes('usuario') || label.includes('contacto') || label.includes('profesor')) return 'users';
  if (label.includes('centro') || label.includes('escuela') || label.includes('instituto')) return 'school';
  if (label.includes('grupo')) return 'groups';
  if (label.includes('consent') || label.includes('autoriz')) return 'consent';
  if (label.includes('legal') || label.includes('versi')) return 'legal';
  if (label.includes('hijo') || label.includes('alumno') || label.includes('estudiante')) return 'child';
  if (label.includes('familia')) return 'family';
  if (label.includes('perfil') || label.includes('cuenta')) return 'profile';
  if (label.includes('dashboard') || label.includes('inicio')) return 'dashboard';
  if (label.includes('crear') || label.includes('añadir') || label.includes('nuevo')) return 'plus';
  if (label.includes('columna')) return 'columns';
  if (label.includes('actualizar') || label.includes('recargar')) return 'refresh';
  if (label.includes('filtro')) return 'filter';
  if (label.includes('limpiar') || label.includes('eliminar')) return 'clear';
  if (label.includes('volver') || label.includes('atrás')) return 'back';
  if (label.includes('cerrar') && label.includes('sesi')) return 'logout';
  if (label.includes('cerrar')) return 'close';
  if (label.includes('sesión')) return 'logout';
  if (label.includes('buscar')) return 'search';
  if (label.includes('guardar') || label.includes('aceptar')) return 'check';
  return null;
}

function applyAppIcon(target) {
  if (!target || target.querySelector('.app-icon') || target.matches('.quickcard-label') && target.parentElement?.classList.contains('module-card__header')) {
    return;
  }

  const name = target.dataset.appIcon || getAppIconName(target.getAttribute('aria-label') || target.textContent);
  if (!name) {
    return;
  }
  const wrapper = document.createElement('span');
  wrapper.innerHTML = getAppIcon(name, target.matches('h1, h2, h3') ? 'app-icon--heading' : '');
  target.prepend(wrapper.firstElementChild);

  if (target.matches('.button, .back-link')) {
    target.classList.add('button--with-icon');
  }
  if (target.matches('h1, h2, h3')) {
    target.classList.add('heading-with-icon');
  }
}

function refreshAppIcons(root = document) {
  if (!root) {
    return;
  }

  const targets = [];
  const iconTargets = '.button, .back-link, [data-app-icon]';
  if (root.matches?.(iconTargets)) {
    targets.push(root);
  }
  targets.push(...root.querySelectorAll?.(iconTargets) || []);
  targets.forEach(applyAppIcon);
}

window.getAppIcon = getAppIcon;
window.getAppIconName = getAppIconName;
window.refreshAppIcons = refreshAppIcons;

refreshAppIcons();

function ensureModuleNavigation() {
  const navigationRows = Array.from(document.querySelectorAll('.dashboard-links'))
    .filter((row) => row.id !== 'dashboard-links');
  if (!navigationRows.length) {
    return;
  }

  const modules = [
    { label: 'Usuarios', href: '/users.html', icon: 'users', roles: ['ADMIN'] },
    { label: 'Centros', href: '/centers.html', icon: 'school', roles: ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL'] },
    { label: 'Grupos', href: '/groups.html', icon: 'groups', roles: ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'STUDENT'] },
    { label: 'Consentimientos', href: '/consents.html', icon: 'consent', roles: ['ADMIN', 'SCHOOL', 'TEACHER', 'PROFESSIONAL', 'FAMILY', 'STUDENT'] },
    { label: 'Texto legal', href: '/legal.html', icon: 'legal', roles: ['ADMIN'] },
  ];
  const currentPath = window.location.pathname;
  const currentRole = typeof getTokenRole === 'function' ? String(getTokenRole() || '').toUpperCase() : '';

  navigationRows.forEach((existingLinks) => {
    const existingHrefs = new Set(Array.from(existingLinks.querySelectorAll('a[href]')).map((link) => link.getAttribute('href')));
    modules
      .filter((module) => (
        module.href !== currentPath
        && !existingHrefs.has(module.href)
        && (!currentRole || module.roles.includes(currentRole))
      ))
      .forEach((module) => {
        const link = document.createElement('a');
        link.className = 'button secondary';
        link.href = module.href;
        link.dataset.moduleLink = module.href;
        link.setAttribute('aria-label', module.label);
        link.innerHTML = `${getAppIcon(module.icon)}<span>${escapeHtml(module.label)}</span>`;
        existingLinks.append(link);
      });
  });
}

ensureModuleNavigation();

const rememberSessionControl = document.querySelector('[data-remember-session]');
if (rememberSessionControl && typeof shouldRememberSession === 'function') {
  rememberSessionControl.checked = shouldRememberSession();
  rememberSessionControl.addEventListener('change', () => {
    setRememberSession(rememberSessionControl.checked);
  });
}

function hasMissingReference(id, collection) {
  return Boolean(id && Array.isArray(collection) && !collection.some((item) => String(item.id) === String(id)));
}

function getRequiredDataIssues(entityType, entity = {}, references = {}) {
  const issues = [];
  const role = String(entity.role || '').toUpperCase();

  if (entityType === 'user') {
    if (!String(entity.name || '').trim()) issues.push('nombre');
    if (!String(entity.email || '').trim()) issues.push('email');
    if (role === 'STUDENT' && !entity.birthDate) issues.push('fecha de nacimiento');
    if (role === 'FAMILY' && !entity.linkedStudentId) issues.push('estudiante vinculado');
    if (role === 'FAMILY' && hasMissingReference(entity.linkedStudentId, references.users)) issues.push('estudiante eliminado');
    if (['STUDENT', 'TEACHER', 'PROFESSIONAL', 'SCHOOL'].includes(role) && !entity.schoolId) issues.push('centro asignado');
    if (hasMissingReference(entity.schoolId, references.centers)) issues.push('centro eliminado');
    if (hasMissingReference(entity.groupId, references.groups)) issues.push('grupo eliminado');
  }

  if (entityType === 'center' && !String(entity.name || '').trim()) issues.push('nombre');
  if (entityType === 'group') {
    if (!String(entity.name || '').trim()) issues.push('nombre');
    if (!entity.centerId && !entity.center?.id) issues.push('centro asignado');
    if (hasMissingReference(entity.centerId || entity.center?.id, references.centers)) issues.push('centro eliminado');
  }

  if (entityType === 'consent') {
    if (hasMissingReference(entity.studentId, references.users)) issues.push('alumno eliminado');
    if (hasMissingReference(entity.familyUserId, references.users)) issues.push('familia eliminada');
    if (hasMissingReference(entity.centerId, references.centers)) issues.push('centro eliminado');
  }

  return issues;
}

function getDataQualityWarning(entityType, entity, label = 'Este registro', references = {}) {
  const issues = getRequiredDataIssues(entityType, entity, references);
  if (!issues.length) return '';

  const message = `${label}: falta ${issues.join(', ')}.`;
  return `<span class="data-quality-warning" role="img" aria-label="${escapeHtml(message)}" title="${escapeHtml(message)}">!</span>`;
}

function ensureDestructiveActionModal() {
  let modal = document.getElementById('destructive-action-modal');
  if (modal) return modal;

  modal = document.createElement('section');
  modal.id = 'destructive-action-modal';
  modal.className = 'modal destructive-action-modal';
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  modal.innerHTML = `
    <div class="modal__backdrop" data-close-modal="destructive-action-modal"></div>
    <div class="modal__panel modal__panel--small" role="dialog" aria-modal="true" aria-labelledby="destructive-action-title" aria-describedby="destructive-action-description">
      <div class="destructive-action-modal__lead">
        <span class="destructive-action-modal__icon" aria-hidden="true">!</span>
        <div>
          <span class="badge">Eliminación definitiva</span>
          <h2 id="destructive-action-title">Confirmar acción</h2>
        </div>
      </div>
      <p id="destructive-action-description"></p>
      <div id="destructive-action-effects" class="destructive-action-effects" hidden></div>
      <p class="field-note">La eliminación no se puede deshacer. Los registros vinculados que se conserven señalarán la referencia eliminada.</p>
      <div class="modal__footer">
        <button class="button secondary" type="button" data-destructive-cancel>Cancelar</button>
        <button class="button destructive-action-modal__confirm" type="button" data-destructive-confirm>Eliminar</button>
      </div>
    </div>
  `;
  document.body.append(modal);
  return modal;
}

function confirmDestructiveAction({ title, description, effects = [], confirmLabel = 'Eliminar' }) {
  const modal = ensureDestructiveActionModal();
  const titleElement = modal.querySelector('#destructive-action-title');
  const descriptionElement = modal.querySelector('#destructive-action-description');
  const effectsElement = modal.querySelector('#destructive-action-effects');
  const confirmButton = modal.querySelector('[data-destructive-confirm]');
  const cancelButton = modal.querySelector('[data-destructive-cancel]');

  titleElement.textContent = title;
  descriptionElement.textContent = description;
  confirmButton.textContent = confirmLabel;
  effectsElement.replaceChildren();
  effectsElement.hidden = effects.length === 0;

  effects.forEach((item) => {
    const entry = document.createElement('div');
    entry.className = 'destructive-action-effects__item';
    const count = document.createElement('strong');
    count.textContent = String(item.count);
    const copy = document.createElement('span');
    copy.innerHTML = `<b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail)}</small>`;
    entry.append(count, copy);
    effectsElement.append(entry);
  });

  return new Promise((resolve) => {
    let settled = false;
    const finish = (accepted) => {
      if (settled) return;
      settled = true;
      confirmButton.removeEventListener('click', onConfirm);
      cancelButton.removeEventListener('click', onCancel);
      modal.removeEventListener('unicornio:modal-closed', onClosed);
      if (!modal.hidden) closeModalById('destructive-action-modal');
      resolve(accepted);
    };
    const onConfirm = () => finish(true);
    const onCancel = () => finish(false);
    const onClosed = () => finish(false);

    confirmButton.addEventListener('click', onConfirm);
    cancelButton.addEventListener('click', onCancel);
    modal.addEventListener('unicornio:modal-closed', onClosed);
    openModalById('destructive-action-modal');
  });
}

window.getRequiredDataIssues = getRequiredDataIssues;
window.getDataQualityWarning = getDataQualityWarning;
window.confirmDestructiveAction = confirmDestructiveAction;

// Los desplegables nativos usan el menú y el color de selección del sistema
// operativo. Conservamos el <select> para formularios y scripts existentes, pero
// exponemos una versión visual coherente que también se actualiza al cambiar sus
// opciones de forma dinámica.
const customSelectInstances = new WeakMap();
const activeCustomSelects = new Set();
let customSelectSeed = 0;

function getCustomSelectLabel(select) {
  const explicitLabel = select.getAttribute('aria-label');
  if (explicitLabel) {
    return explicitLabel;
  }

  const label = select.closest('label') || select.labels?.[0];
  const labelText = label?.querySelector(':scope > span')?.textContent || label?.textContent;
  return String(labelText || 'Seleccionar opción').trim();
}

function closeCustomSelect(instance) {
  if (!instance || !instance.wrapper.isConnected) {
    return;
  }

  instance.wrapper.classList.remove('is-open', 'select-control--opens-upward');
  instance.trigger.setAttribute('aria-expanded', 'false');
  instance.menu.hidden = true;
}

function closeAllCustomSelects(exceptInstance = null) {
  activeCustomSelects.forEach((instance) => {
    if (instance !== exceptInstance) {
      closeCustomSelect(instance);
    }
  });
}

function refreshCustomSelect(select) {
  const instance = customSelectInstances.get(select);
  if (!instance || !select.isConnected) {
    return;
  }

  const options = Array.from(select.options);
  const selectedOption = options.find((option) => option.selected) || options[0];
  const selectedText = selectedOption?.textContent?.trim() || 'Selecciona una opción';
  const hasSelection = Boolean(selectedOption?.value);
  const isDisabled = select.disabled || options.length === 0;

  instance.value.textContent = selectedText;
  instance.trigger.classList.toggle('is-placeholder', !hasSelection);
  instance.trigger.disabled = isDisabled;
  instance.trigger.setAttribute('aria-disabled', String(isDisabled));
  instance.menu.setAttribute('aria-label', getCustomSelectLabel(select));

  const optionButtons = document.createDocumentFragment();
  options.forEach((option, index) => {
    const optionButton = document.createElement('button');
    optionButton.type = 'button';
    optionButton.className = 'select-control__option';
    optionButton.setAttribute('role', 'option');
    optionButton.setAttribute('aria-selected', String(option.selected));
    optionButton.dataset.selectIndex = String(index);
    optionButton.disabled = option.disabled;
    optionButton.textContent = option.textContent.trim();
    optionButton.classList.toggle('is-selected', option.selected);

    optionButton.addEventListener('click', () => {
      if (option.disabled) {
        return;
      }

      closeCustomSelect(instance);
      select.value = option.value;
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      refreshCustomSelect(select);
      instance.trigger.focus({ preventScroll: true });
    });
    optionButtons.append(optionButton);
  });

  instance.menu.replaceChildren(optionButtons);
  if (isDisabled) {
    closeCustomSelect(instance);
  }
}

function setCustomSelectOpen(instance, shouldOpen, { focusOption = false } = {}) {
  if (!instance || instance.select.disabled || instance.select.options.length === 0) {
    return;
  }

  if (!shouldOpen) {
    closeCustomSelect(instance);
    return;
  }

  closeAllCustomSelects(instance);
  instance.wrapper.classList.add('is-open');
  instance.trigger.setAttribute('aria-expanded', 'true');
  instance.menu.hidden = false;

  requestAnimationFrame(() => {
    if (!instance.wrapper.isConnected || instance.menu.hidden) {
      return;
    }

    const menuBounds = instance.menu.getBoundingClientRect();
    instance.wrapper.classList.toggle('select-control--opens-upward', menuBounds.bottom > window.innerHeight - 12);
    if (focusOption) {
      const selectedOption = instance.menu.querySelector('.is-selected:not(:disabled)')
        || instance.menu.querySelector(':not(:disabled)');
      selectedOption?.focus();
    }
  });
}

function enhanceSelect(select) {
  if (!(select instanceof HTMLSelectElement) || select.multiple || customSelectInstances.has(select)) {
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'select-control';
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-control__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', getCustomSelectLabel(select));

  const value = document.createElement('span');
  value.className = 'select-control__value';
  const chevron = document.createElement('span');
  chevron.className = 'select-control__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  trigger.append(value, chevron);

  const menu = document.createElement('div');
  menu.className = 'select-control__menu';
  menu.id = `select-options-${++customSelectSeed}`;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  trigger.setAttribute('aria-controls', menu.id);

  select.parentNode.insertBefore(wrapper, select);
  wrapper.append(select, trigger, menu);
  select.classList.add('select-control__native');
  select.tabIndex = -1;
  select.setAttribute('aria-hidden', 'true');

  const instance = { select, wrapper, trigger, value, menu };
  customSelectInstances.set(select, instance);
  activeCustomSelects.add(instance);

  trigger.addEventListener('click', () => {
    setCustomSelectOpen(instance, !wrapper.classList.contains('is-open'));
  });

  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setCustomSelectOpen(instance, true, { focusOption: true });
    }
  });

  menu.addEventListener('keydown', (event) => {
    const enabledOptions = Array.from(menu.querySelectorAll('.select-control__option:not(:disabled)'));
    const currentIndex = enabledOptions.indexOf(document.activeElement);

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = currentIndex < 0
        ? 0
        : (currentIndex + direction + enabledOptions.length) % enabledOptions.length;
      enabledOptions[nextIndex]?.focus();
      return;
    }

    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      enabledOptions[event.key === 'Home' ? 0 : enabledOptions.length - 1]?.focus();
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && document.activeElement?.matches('.select-control__option')) {
      event.preventDefault();
      document.activeElement.click();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeCustomSelect(instance);
      trigger.focus();
    } else if (event.key === 'Tab') {
      closeCustomSelect(instance);
    }
  });

  select.addEventListener('input', () => refreshCustomSelect(select));
  select.addEventListener('change', () => refreshCustomSelect(select));
  select.addEventListener('focus', () => trigger.focus({ preventScroll: true }));
  select.addEventListener('invalid', () => {
    setCustomSelectOpen(instance, true);
    trigger.focus();
  });

  // Mantiene visible el texto correcto cuando otro script asigna select.value.
  const valueDescriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
  if (valueDescriptor?.get && valueDescriptor?.set) {
    Object.defineProperty(select, 'value', {
      configurable: true,
      get() {
        return valueDescriptor.get.call(this);
      },
      set(nextValue) {
        valueDescriptor.set.call(this, nextValue);
        queueMicrotask(() => refreshCustomSelect(this));
      },
    });
  }

  refreshCustomSelect(select);
}

function refreshCustomSelects(root = document) {
  const selects = [];
  if (root instanceof HTMLSelectElement) {
    selects.push(root);
  }
  selects.push(...root.querySelectorAll?.('select') || []);
  selects.forEach(enhanceSelect);
  selects.forEach(refreshCustomSelect);
}

window.refreshCustomSelects = refreshCustomSelects;

refreshCustomSelects();

function setupColumnManager({ modalId, listId, triggerSelector, storageKey, defaultColumns, onChange }) {
  const modal = document.getElementById(modalId);
  const list = document.getElementById(listId);
  const triggers = document.querySelectorAll(triggerSelector);
  let columns = readColumnPrefs(storageKey, defaultColumns);
  let pointerDrag = null;

  function emitChange() {
    persistColumnPrefs(storageKey, columns);
    if (typeof onChange === 'function') {
      onChange(columns);
    }
  }

  function normalizeColumns() {
    columns = columns.map((column, index) => ({ ...column, order: index }));
  }

  function getItem(columnId) {
    return Array.from(list?.querySelectorAll('.column-manager-item') || [])
      .find((item) => item.dataset.columnId === columnId) || null;
  }

  function updateSummary(message) {
    const summary = list?.querySelector('.column-manager-summary');
    if (!summary) return;
    const visibleCount = columns.filter((column) => column.visible !== false).length;
    summary.textContent = message || `${visibleCount} de ${columns.length} columnas visibles`;
  }

  function announce(message) {
    const announcement = list?.querySelector('.column-manager-announcement');
    if (announcement) announcement.textContent = message;
  }

  function commit(message) {
    normalizeColumns();
    emitChange();
    updateSummary(message);
  }

  function render() {
    if (!list) return;
    const visibleCount = columns.filter((column) => column.visible !== false).length;
    list.innerHTML = `
      <div class="column-manager-guide" id="${listId}-guide">
        <span class="column-manager-guide__icon" aria-hidden="true">&harr;</span>
        <p><strong>Hazla tuya.</strong> Arrastra el asa para ordenar y activa solo lo que quieras ver. La tabla cambia al momento.</p>
      </div>
      <div class="column-manager-items" role="list" aria-describedby="${listId}-guide">
        ${columns.map((column, index) => `
          <article class="column-manager-item ${column.visible !== false ? '' : 'is-hidden'}" role="listitem" data-column-id="${column.id}">
            <div class="column-manager-item__main">
              <button class="column-manager-handle" type="button" data-column-move-handle aria-label="Mover ${column.label}. Posicion ${index + 1} de ${columns.length}" aria-describedby="${listId}-guide" title="Arrastra para mover ${column.label}"><span aria-hidden="true">&#x2807;</span></button>
              <span class="column-manager-item__label">${column.label}</span>
            </div>
            <label class="column-manager-visibility">
              <input type="checkbox" ${column.visible !== false ? 'checked' : ''} aria-label="Mostrar ${column.label}" />
              <span>${column.visible !== false ? 'Visible' : 'Oculta'}</span>
            </label>
          </article>
        `).join('')}
      </div>
      <p class="column-manager-summary">${visibleCount} de ${columns.length} columnas visibles</p>
      <p class="sr-only column-manager-announcement" aria-live="polite" aria-atomic="true"></p>
    `;
  }

  function sync() {
    normalizeColumns();
    render();
    emitChange();
  }

  function animateReorder(beforeRects) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    list?.querySelectorAll('.column-manager-item').forEach((item) => {
      if (item.classList.contains('dragging')) return;
      const before = beforeRects.get(item);
      const offsetY = before ? before.top - item.getBoundingClientRect().top : 0;
      if (Math.abs(offsetY) < 1) return;
      item.animate(
        [{ transform: `translateY(${offsetY}px)` }, { transform: 'translateY(0)' }],
        { duration: 190, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      );
    });
  }

  function moveColumn(sourceId, targetId, placeAfter = false) {
    const sourceIndex = columns.findIndex((column) => column.id === sourceId);
    const targetIndex = columns.findIndex((column) => column.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;

    const beforeRects = new Map(
      Array.from(list?.querySelectorAll('.column-manager-item') || []).map((item) => [item, item.getBoundingClientRect()]),
    );
    const [moved] = columns.splice(sourceIndex, 1);
    const nextTargetIndex = columns.findIndex((column) => column.id === targetId);
    columns.splice(nextTargetIndex + (placeAfter ? 1 : 0), 0, moved);

    const sourceItem = getItem(sourceId);
    const targetItem = getItem(targetId);
    if (sourceItem && targetItem) {
      targetItem[placeAfter ? 'after' : 'before'](sourceItem);
      animateReorder(beforeRects);
    }
    commit();
    return true;
  }

  render();

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openModalById(modalId));
  });

  modal?.addEventListener('click', (event) => {
    if (event.target?.matches?.('[data-close-modal]')) closeModalById(modalId);
  });

  list?.addEventListener('change', (event) => {
    const input = event.target.closest('.column-manager-visibility input');
    const item = input?.closest('.column-manager-item');
    const column = columns.find((entry) => entry.id === item?.dataset.columnId);
    if (!input || !item || !column) return;

    column.visible = input.checked;
    item.classList.toggle('is-hidden', !column.visible);
    item.querySelector('.column-manager-visibility span').textContent = column.visible ? 'Visible' : 'Oculta';
    commit();
    announce(`${column.label} ${column.visible ? 'se muestra' : 'se ha ocultado'} en la tabla.`);
  });

  list?.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('[data-column-move-handle]');
    if (!handle || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const item = handle.closest('.column-manager-item');
    const columnId = item?.dataset.columnId;
    if (!item || !columnId) return;

    event.preventDefault();
    handle.focus();
    handle.setPointerCapture?.(event.pointerId);
    pointerDrag = { pointerId: event.pointerId, columnId, item };
    item.classList.add('dragging');
    list.classList.add('is-reordering');
    announce(`Moviendo ${columns.find((column) => column.id === columnId)?.label}.`);
  });

  list?.addEventListener('pointermove', (event) => {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.column-manager-item');
    if (!target || target === pointerDrag.item) return;

    const rect = target.getBoundingClientRect();
    const moved = moveColumn(pointerDrag.columnId, target.dataset.columnId, event.clientY > rect.top + rect.height / 2);
    if (moved) pointerDrag.item = getItem(pointerDrag.columnId) || pointerDrag.item;
  });

  function endPointerDrag(event) {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    pointerDrag.item.classList.remove('dragging');
    list?.classList.remove('is-reordering');
    const column = columns.find((entry) => entry.id === pointerDrag.columnId);
    announce(`${column?.label || 'Columna'} colocada. La tabla ya esta actualizada.`);
    pointerDrag = null;
  }

  list?.addEventListener('pointerup', endPointerDrag);
  list?.addEventListener('pointercancel', endPointerDrag);

  list?.addEventListener('keydown', (event) => {
    const handle = event.target.closest('[data-column-move-handle]');
    if (!handle || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const sourceId = handle.closest('.column-manager-item')?.dataset.columnId;
    const sourceIndex = columns.findIndex((column) => column.id === sourceId);
    if (!sourceId || sourceIndex < 0) return;

    let targetIndex = sourceIndex;
    if (event.key === 'ArrowUp') targetIndex = Math.max(0, sourceIndex - 1);
    if (event.key === 'ArrowDown') targetIndex = Math.min(columns.length - 1, sourceIndex + 1);
    if (event.key === 'Home') targetIndex = 0;
    if (event.key === 'End') targetIndex = columns.length - 1;
    if (targetIndex === sourceIndex) return;

    event.preventDefault();
    if (moveColumn(sourceId, columns[targetIndex].id)) {
      getItem(sourceId)?.querySelector('[data-column-move-handle]')?.focus();
      const position = columns.findIndex((entry) => entry.id === sourceId) + 1;
      announce(`${columns.find((entry) => entry.id === sourceId)?.label || 'Columna'} en la posicion ${position}.`);
    }
  });

  return {
    getColumns: () => columns.slice(),
    setColumns(nextColumns) {
      columns = nextColumns.map((column, index) => ({ ...column, order: index, visible: column.visible !== false }));
      sync();
    },
    sync,
    render,
  };
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.select-control')) {
    closeAllCustomSelects();
  }
});

document.querySelectorAll('[data-profile-password-form]').forEach((form) => {
  const errorElement = form.querySelector('[data-profile-password-error]');
  const successElement = form.querySelector('[data-profile-password-success]');
  const submitButton = form.querySelector('button[type="submit"]');
  const openButton = form.parentElement?.querySelector('[data-open-password-modal]');
  const closeButton = form.querySelector('[data-close-password-modal]');

  const closePasswordForm = () => {
    form.classList.remove('is-open');
    form.setAttribute('aria-hidden', 'true');
    openButton?.focus();
  };

  openButton?.addEventListener('click', () => {
    form.classList.add('is-open');
    form.setAttribute('aria-hidden', 'false');
    form.setAttribute('role', 'dialog');
    form.setAttribute('aria-modal', 'true');
    form.querySelector('input')?.focus();
  });
  closeButton?.addEventListener('click', closePasswordForm);
  form.closest('.profile-modal')?.addEventListener('unicornio:modal-closed', closePasswordForm);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorElement.hidden = true;
    successElement.hidden = true;
    submitButton.disabled = true;

    const formData = new FormData(form);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: formData.get('currentPassword'),
          newPassword: formData.get('newPassword'),
        }),
      });
      form.reset();
      successElement.textContent = 'Contraseña actualizada correctamente.';
      successElement.hidden = false;
    } catch (error) {
      errorElement.textContent = getApiErrorMessage(error);
      errorElement.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAllCustomSelects();
  }
});

document.addEventListener('reset', (event) => {
  queueMicrotask(() => refreshCustomSelects(event.target));
});

const customSelectObserver = new MutationObserver((records) => {
  const affectedSelects = new Set();

  records.forEach((record) => {
    if (record.target instanceof HTMLSelectElement) {
      affectedSelects.add(record.target);
    }

    record.addedNodes.forEach((node) => {
      if (!(node instanceof Element)) {
        return;
      }
      if (node instanceof HTMLSelectElement) {
        affectedSelects.add(node);
      }
      node.querySelectorAll?.('select').forEach((select) => affectedSelects.add(select));
    });
  });

  affectedSelects.forEach((select) => {
    if (!select.isConnected) {
      return;
    }
    enhanceSelect(select);
    refreshCustomSelect(select);
  });
});

customSelectObserver.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['disabled'],
});

function readColumnPrefs(storageKey, defaultColumns) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      return defaultColumns.map((column, index) => ({ ...column, order: index, visible: column.visible !== false }));
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return defaultColumns.map((column, index) => ({ ...column, order: index, visible: column.visible !== false }));
    }

    const byId = new Map(defaultColumns.map((column, index) => [column.id, { ...column, order: index, visible: column.visible !== false }]));
    parsed.forEach((item, index) => {
      const column = byId.get(item.id);
      if (column) {
        column.order = typeof item.order === 'number' ? item.order : index;
        column.visible = item.visible !== false;
      }
    });

    return Array.from(byId.values()).sort((a, b) => a.order - b.order);
  } catch (_error) {
    return defaultColumns.map((column, index) => ({ ...column, order: index, visible: column.visible !== false }));
  }
}

function persistColumnPrefs(storageKey, columns) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(columns.map((column, index) => ({
      id: column.id,
      order: index,
      visible: column.visible !== false,
    }))),
  );
}

function setupLegacyColumnManager({ modalId, listId, triggerSelector, storageKey, defaultColumns, onChange }) {
  const modal = document.getElementById(modalId);
  const list = document.getElementById(listId);
  const triggers = document.querySelectorAll(triggerSelector);
  let columns = readColumnPrefs(storageKey, defaultColumns);
  let draggingId = null;

  function emitChange() {
    persistColumnPrefs(storageKey, columns);
    if (typeof onChange === 'function') {
      onChange(columns);
    }
  }

  function render() {
    if (!list) {
      return;
    }

    list.innerHTML = columns
      .map(
        (column) => `
          <article class="column-manager-item" draggable="true" data-column-id="${column.id}">
            <label>
              <span class="table-badge">⋮⋮</span>
              <span>${column.label}</span>
            </label>
            <input type="checkbox" ${column.visible !== false ? 'checked' : ''} aria-label="Mostrar ${column.label}" />
          </article>
        `,
      )
      .join('');
  }

  function sync() {
    columns = columns.map((column, index) => ({ ...column, order: index }));
    render();
    emitChange();
  }

  function moveColumn(sourceId, targetId) {
    const sourceIndex = columns.findIndex((column) => column.id === sourceId);
    const targetIndex = columns.findIndex((column) => column.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
      return;
    }

    const [moved] = columns.splice(sourceIndex, 1);
    columns.splice(targetIndex, 0, moved);
    sync();
  }

  render();

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openModalById(modalId));
  });

  modal?.addEventListener('click', (event) => {
    if (event.target?.matches?.('[data-close-modal]')) {
      closeModalById(modalId);
    }
  });

  list?.addEventListener('change', (event) => {
    const item = event.target.closest('.column-manager-item');
    if (!item) {
      return;
    }

    const columnId = item.getAttribute('data-column-id');
    const column = columns.find((itemColumn) => itemColumn.id === columnId);
    if (!column) {
      return;
    }

    column.visible = Boolean(event.target.checked);
    sync();
  });

  list?.addEventListener('dragstart', (event) => {
    const item = event.target.closest('.column-manager-item');
    if (!item) {
      return;
    }

    draggingId = item.getAttribute('data-column-id');
    item.classList.add('dragging');
  });

  list?.addEventListener('dragend', (event) => {
    const item = event.target.closest('.column-manager-item');
    item?.classList.remove('dragging');
    draggingId = null;
  });

  list?.addEventListener('dragover', (event) => {
    event.preventDefault();
  });

  list?.addEventListener('drop', (event) => {
    event.preventDefault();
    const target = event.target.closest('.column-manager-item');
    if (!draggingId || !target) {
      return;
    }

    moveColumn(draggingId, target.getAttribute('data-column-id'));
  });

  return {
    getColumns: () => columns.slice(),
    setColumns(nextColumns) {
      columns = nextColumns.map((column, index) => ({
        ...column,
        order: index,
        visible: column.visible !== false,
      }));
      sync();
    },
    sync,
    render,
  };
}

document.addEventListener('click', (event) => {
  const openButton = event.target.closest('[data-open-modal]');
  if (openButton) {
    openModalById(openButton.getAttribute('data-open-modal'));
    return;
  }

  const closeButton = event.target.closest('[data-close-modal]');
  if (closeButton) {
    const modalId = closeButton.getAttribute('data-close-modal');
    const modal = document.getElementById(modalId);
    if (!isModalBusy(modal)) {
      closeModalById(modalId);
    }
  }
});
