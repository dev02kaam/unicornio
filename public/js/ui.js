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
