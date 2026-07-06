const SPANISH_CITIES = [
  'Madrid',
  'Barcelona',
  'Valencia',
  'Sevilla',
  'Zaragoza',
  'Malaga',
  'Murcia',
  'Palma',
  'Las Palmas de Gran Canaria',
  'Bilbao',
  'Alicante',
  'Cordoba',
  'Valladolid',
  'Vigo',
  'Gijon',
  'LHospitalet de Llobregat',
  'Coruna',
  'Vitoria-Gasteiz',
  'Granada',
  'Elche',
  'Oviedo',
  'Badalona',
  'Cartagena',
  'Terrassa',
  'Jerez de la Frontera',
  'Sabadell',
  'Mostoles',
  'Alcala de Henares',
  'Pamplona',
  'Almeria',
  'Fuenlabrada',
  'Leganes',
  'Donostia-San Sebastian',
  'Santander',
  'Burgos',
  'Albacete',
  'Castellon de la Plana',
  'Getafe',
  'Alcorcon',
  'Algeciras',
  'Marbella',
  'Jaen',
  'Logrono',
  'Ourense',
  'Lleida',
  'Tarragona',
  'Cadiz',
  'Salamanca',
  'Huelva',
  'Badajoz',
  'Telde',
  'Reus',
  'Parla',
  'Santa Cruz de Tenerife',
  'Torrejon de Ardoz',
  'Pozuelo de Alarcon',
  'Mataro',
  'Aviles',
  'Soria',
  'Caceres',
  'Cuenca',
  'Toledo',
  'Segovia',
  'Lugo',
  'Ponferrada',
  'Ferrol',
];

const SORTED_SPANISH_CITIES = [...SPANISH_CITIES].sort((a, b) =>
  normalizeSearchText(a).localeCompare(normalizeSearchText(b), 'es', { sensitivity: 'base' }),
);

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildAcademicYearLabel(startYear) {
  const firstYear = Number(startYear);
  if (Number.isNaN(firstYear)) {
    return '';
  }

  return `${firstYear}-${firstYear + 1}`;
}

function populateAcademicYearStartSelect(select, { selectedStartYear = '', yearsBack = 5, yearsForward = 1 } = {}) {
  const element = typeof select === 'string' ? document.getElementById(select) : select;
  if (!element) {
    return;
  }

  const currentYear = new Date().getFullYear();
  const minYear = currentYear - yearsBack;
  const maxYear = currentYear + yearsForward;
  const options = [];

  for (let year = maxYear; year >= minYear; year -= 1) {
    options.push(`<option value="${year}" ${String(year) === String(selectedStartYear) ? 'selected' : ''}>${year}</option>`);
  }

  element.innerHTML = options.join('');
}

function populateCityMenu(menu, { selectedValue = '', query = '' } = {}) {
  const element = typeof menu === 'string' ? document.getElementById(menu) : menu;
  if (!element) {
    return;
  }

  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const filtered = SORTED_SPANISH_CITIES.filter((city) => {
    if (tokens.length === 0) {
      return true;
    }

    const normalizedCity = normalizeSearchText(city);
    return tokens.every((token) => normalizedCity.includes(token));
  });

  element.innerHTML = filtered
    .map((city) => `
      <button type="button" class="picker-list__option ${city === selectedValue ? 'is-selected' : ''}" data-city-option="${city}">
        <span>${city}</span>
        ${city === selectedValue ? '<small>Seleccionada</small>' : '<small>Ciudad española</small>'}
      </button>
    `)
    .join('');
}

function setupAcademicYearPicker({
  rootId,
  triggerId,
  panelId,
  gridId,
  rangeId,
  prevId,
  nextId,
  hiddenId,
  displayId,
  summaryId,
  initialYear = new Date().getFullYear(),
  minYear = new Date().getFullYear() - 8,
  maxYear = new Date().getFullYear() + 4,
} = {}) {
  const root = typeof rootId === 'string' ? document.getElementById(rootId) : rootId;
  const trigger = typeof triggerId === 'string' ? document.getElementById(triggerId) : triggerId;
  const panel = typeof panelId === 'string' ? document.getElementById(panelId) : panelId;
  const grid = typeof gridId === 'string' ? document.getElementById(gridId) : gridId;
  const range = typeof rangeId === 'string' ? document.getElementById(rangeId) : rangeId;
  const prev = prevId ? (typeof prevId === 'string' ? document.getElementById(prevId) : prevId) : null;
  const next = nextId ? (typeof nextId === 'string' ? document.getElementById(nextId) : nextId) : null;
  const hidden = hiddenId ? (typeof hiddenId === 'string' ? document.getElementById(hiddenId) : hiddenId) : null;
  const display = displayId ? (typeof displayId === 'string' ? document.getElementById(displayId) : displayId) : null;
  const summary = summaryId ? (typeof summaryId === 'string' ? document.getElementById(summaryId) : summaryId) : null;

  if (!root || !trigger || !panel || !grid) {
    return null;
  }

  let activeYear = Number(initialYear) || new Date().getFullYear();
  let decadeStart = Math.floor(activeYear / 10) * 10;
  let isOpen = false;

  function clampYear(year) {
    return Math.min(Math.max(year, minYear), maxYear);
  }

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    root.classList.toggle('is-open', nextOpen);
    trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    panel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    if (!nextOpen) {
      root.classList.remove('is-flip');
    }
  }

  function updateTrigger() {
    const label = buildAcademicYearLabel(activeYear);
    if (display) {
      display.textContent = String(activeYear);
    }
    if (summary) {
      summary.textContent = label ? `Curso ${label}` : 'Selecciona un año';
    }
    if (hidden) {
      hidden.value = String(activeYear);
    }
    if (range) {
      range.textContent = `${decadeStart} - ${decadeStart + 9}`;
    }
  }

  function renderGrid() {
    const years = [];
    for (let year = decadeStart; year < decadeStart + 10; year += 1) {
      if (year < minYear || year > maxYear) {
        continue;
      }

      years.push(`
        <button type="button" class="year-cell ${year === activeYear ? 'is-selected' : ''}" data-year-cell="${year}">
          <span>${year}</span>
          <small>${year === activeYear ? 'Elegido' : 'Año'}</small>
        </button>
      `);
    }

    grid.innerHTML = years.join('');
    updateTrigger();
  }

  function setYear(year) {
    activeYear = clampYear(Number(year) || activeYear);
    decadeStart = Math.floor(activeYear / 10) * 10;
    renderGrid();
  }

  prev?.addEventListener('click', () => {
    decadeStart = Math.max(decadeStart - 10, Math.floor(minYear / 10) * 10);
    renderGrid();
  });

  next?.addEventListener('click', () => {
    decadeStart = Math.min(decadeStart + 10, Math.floor(maxYear / 10) * 10);
    renderGrid();
  });

  trigger.addEventListener('click', () => {
    if (!isOpen) {
      renderGrid();
    }
    setOpen(!isOpen);
  });

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-year-cell]');
    if (!button) {
      return;
    }

    setYear(button.getAttribute('data-year-cell'));
    setOpen(false);
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      setOpen(false);
    }
  });

  if (hidden) {
    hidden.value = String(activeYear);
  }
  renderGrid();
  setOpen(false);

  return {
    getValue: () => String(activeYear),
    setValue(value) {
      setYear(value);
    },
    open() {
      setOpen(true);
      renderGrid();
    },
    close() {
      setOpen(false);
    },
  };
}

function setupCityCombobox({
  rootId,
  triggerId,
  displayId,
  summaryId,
  panelId,
  searchId,
  menuId,
  hiddenId = null,
  clearId = null,
  initialValue = '',
} = {}) {
  const root = typeof rootId === 'string' ? document.getElementById(rootId) : rootId;
  const trigger = typeof triggerId === 'string' ? document.getElementById(triggerId) : triggerId;
  const display = displayId ? (typeof displayId === 'string' ? document.getElementById(displayId) : displayId) : null;
  const summary = summaryId ? (typeof summaryId === 'string' ? document.getElementById(summaryId) : summaryId) : null;
  const panel = typeof panelId === 'string' ? document.getElementById(panelId) : panelId;
  const search = typeof searchId === 'string' ? document.getElementById(searchId) : searchId;
  const menu = typeof menuId === 'string' ? document.getElementById(menuId) : menuId;
  const hidden = hiddenId ? (typeof hiddenId === 'string' ? document.getElementById(hiddenId) : hiddenId) : null;
  const clear = clearId ? (typeof clearId === 'string' ? document.getElementById(clearId) : clearId) : null;

  if (!root || !trigger || !panel || !search || !menu) {
    return null;
  }

  let state = String(initialValue || hidden?.value || '').trim();
  let isOpen = false;

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    root.classList.toggle('is-open', nextOpen);
    trigger.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    panel.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    if (nextOpen) {
      search.focus();
    } else {
      root.classList.remove('is-flip');
    }
  }

  function updateDisplay() {
    if (display) {
      display.textContent = state || 'Selecciona una ciudad';
    }
    if (summary) {
      summary.textContent = state ? 'Ciudad seleccionada' : 'Busca una ciudad de España';
    }
    if (hidden) {
      hidden.value = state;
    }
    populateCityMenu(menu, { selectedValue: state, query: search.value });
  }

  function applyValue(value) {
    state = String(value || '').trim();
    search.value = state;
    updateDisplay();
    setOpen(false);
  }

  search.addEventListener('input', () => {
    populateCityMenu(menu, { selectedValue: state, query: search.value });
  });

  search.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
    }
  });

  trigger.addEventListener('click', () => {
    setOpen(!isOpen);
    if (!isOpen) {
      search.value = state;
      populateCityMenu(menu, { selectedValue: state, query: search.value });
    }
  });

  clear?.addEventListener('click', () => {
    applyValue('');
    search.focus();
    setOpen(true);
  });

  menu.addEventListener('click', (event) => {
    const button = event.target.closest('[data-city-option]');
    if (!button) {
      return;
    }

    applyValue(button.getAttribute('data-city-option'));
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target)) {
      setOpen(false);
    }
  });

  updateDisplay();
  setOpen(false);

  return {
    getValue: () => state,
    setValue(value) {
      applyValue(value);
    },
    open() {
      setOpen(true);
    },
    close() {
      setOpen(false);
    },
    refresh() {
      updateDisplay();
    },
  };
}

window.UnicornioFormHelpers = {
  buildAcademicYearLabel,
  populateAcademicYearStartSelect,
  populateCityMenu,
  setupAcademicYearPicker,
  setupCityCombobox,
  normalizeSearchText,
  spanishCities: SORTED_SPANISH_CITIES,
};
