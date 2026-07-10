function openModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    return;
  }

  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

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
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m20 20-4-4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  family: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/>',
  sparkle: '<path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
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
  if (label.includes('cerrar')) return 'close';
  if (label.includes('sesión')) return 'logout';
  if (label.includes('buscar')) return 'search';
  if (label.includes('guardar') || label.includes('aceptar')) return 'check';
  return 'sparkle';
}

function applyAppIcon(target) {
  if (!target || target.querySelector('.app-icon') || target.matches('.quickcard-label') && target.parentElement?.classList.contains('module-card__header')) {
    return;
  }

  const name = target.dataset.appIcon || getAppIconName(target.getAttribute('aria-label') || target.textContent);
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
  const iconTargets = '.button, .back-link, h1, h2, h3, .quickcard-label, [data-app-icon]';
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

document.addEventListener('click', (event) => {
  if (!event.target.closest('.select-control')) {
    closeAllCustomSelects();
  }
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

function setupColumnManager({ modalId, listId, triggerSelector, storageKey, defaultColumns, onChange }) {
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
    closeModalById(closeButton.getAttribute('data-close-modal'));
  }
});
