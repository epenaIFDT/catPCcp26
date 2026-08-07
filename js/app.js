document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  const session = requireAuth();
  if (!session) return;

  const userEl = document.getElementById('user-name');
  if (userEl) userEl.textContent = session.nombre;

  // Botón de gestión: solo para admins, y solo en local (admin-local/ no existe
  // en el sitio publicado, ya que está excluido del repo con .gitignore).
  const isLocalHost = ['localhost', '127.0.0.1'].includes(location.hostname);
  const adminLink = document.getElementById('admin-link');
  if (adminLink && session.rol === 'admin' && isLocalHost) {
    adminLink.style.display = 'inline-flex';
  }

  await loadProducts();
  populateFilters();
  refreshFilterCounts();

  const range = getPriceRange();
  const minEl = document.getElementById('price-min');
  const maxEl = document.getElementById('price-max');
  if (minEl) minEl.placeholder = `$${range.min}`;
  if (maxEl) maxEl.placeholder = `$${range.max}`;

  renderProducts(true);
  updateSelectAllUI();
  setupEventListeners();
  setupInfiniteScroll();
}

function populateFilters() {
  MULTI_FILTER_KEYS.forEach(mf => {
    const field = mf.field === null ? 'categoria' : mf.field;
    renderFilterPanel(mf.key, mf.label, getUniqueValues(field));
  });
}

// Panel de checkboxes de un filtro (selección múltiple)
function renderFilterPanel(key, label, options) {
  const panel = document.getElementById('panel-' + key);
  if (!panel) return;

  const valid = options.filter(opt => opt && opt !== 'NO');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'filter-panel-header';
  const title = document.createElement('span');
  title.textContent = label;
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'filter-panel-close';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeAllFilterPanels);
  header.appendChild(title);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  if (valid.length === 0) {
    const p = document.createElement('p');
    p.className = 'filter-empty';
    p.textContent = 'Sin opciones disponibles';
    panel.appendChild(p);
    return;
  }

  const list = document.createElement('div');
  list.className = 'filter-panel-list';

  valid.forEach(opt => {
    const item = document.createElement('label');
    item.className = 'filter-checkbox-item';
    item.title = opt;

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = opt;
    input.checked = activeFilters[key].has(opt);
    input.addEventListener('change', () => toggleFilterValue(key, opt, input.checked));

    const span = document.createElement('span');
    span.className = 'filter-option-label';
    span.textContent = shortText(opt, 40);

    const countSpan = document.createElement('span');
    countSpan.className = 'filter-option-count';

    item.appendChild(input);
    item.appendChild(span);
    item.appendChild(countSpan);
    list.appendChild(item);
  });

  const footer = document.createElement('div');
  footer.className = 'filter-panel-footer';
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'filter-panel-clear';
  clearBtn.textContent = 'Limpiar esta selección';
  clearBtn.addEventListener('click', () => clearFilterCategory(key));
  footer.appendChild(clearBtn);

  panel.appendChild(list);
  panel.appendChild(footer);
}

// ============================================
// DROPDOWNS DE FILTRO (abrir/cerrar)
// ============================================
function toggleFilterPanel(key) {
  const panel = document.getElementById('panel-' + key);
  const btn = document.getElementById('btn-' + key);
  if (!panel) return;
  const isOpen = panel.classList.contains('show');
  closeAllFilterPanels();
  if (!isOpen) {
    panel.classList.add('show');
    btn?.classList.add('open');
  }
}

function closeAllFilterPanels() {
  document.querySelectorAll('.filter-dropdown-panel.show').forEach(p => p.classList.remove('show'));
  document.querySelectorAll('.filter-dropdown-btn.open').forEach(b => b.classList.remove('open'));
}

function updateFilterButtonBadge(key) {
  const count = activeFilters[key].size;
  const badge = document.getElementById('count-' + key);
  const btn = document.getElementById('btn-' + key);
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  btn?.classList.toggle('active', count > 0);
}

function syncPillUI(key) {
  document.querySelectorAll(`.pill-filter[data-filter="${key}"] .pill-btn`).forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === activeFilters[key]);
  });
}

// ============================================
// CHIPS DE FILTROS ACTIVOS
// ============================================
const BOOL_FILTER_LABELS = { lan: 'LAN', wlan: 'WLAN', hdmi: 'HDMI', vga: 'VGA', optica: 'U. Óptica' };

function renderActiveFilterChips() {
  const container = document.getElementById('active-filters-bar');
  const clearBtn = document.getElementById('btn-clear-filters');
  if (!container) return;

  const chips = [];
  MULTI_FILTER_KEYS.forEach(f => {
    activeFilters[f.key].forEach(value => {
      chips.push({ type: 'multi', key: f.key, value, label: `${f.label}: ${shortText(value, 25)}` });
    });
  });
  Object.keys(BOOL_FILTER_LABELS).forEach(key => {
    if (activeFilters[key]) {
      chips.push({ type: 'bool', key, label: `${BOOL_FILTER_LABELS[key]}: ${activeFilters[key] === 'si' ? 'Con' : 'Sin'}` });
    }
  });

  container.innerHTML = '';

  if (chips.length === 0) {
    container.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  if (clearBtn) clearBtn.style.display = 'inline-flex';

  chips.forEach(chip => {
    const span = document.createElement('span');
    span.className = 'filter-chip';
    span.append(chip.label + ' ');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '✕';
    btn.addEventListener('click', () => {
      if (chip.type === 'multi') removeFilterValue(chip.key, chip.value);
      else clearBoolFilter(chip.key);
    });

    span.appendChild(btn);
    container.appendChild(span);
  });
}

function setupEventListeners() {
  // Filtros de selección múltiple (abrir/cerrar panel)
  document.querySelectorAll('.filter-dropdown-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = btn.closest('.filter-dropdown').dataset.filter;
      toggleFilterPanel(key);
    });
  });

  // Cerrar paneles al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown')) closeAllFilterPanels();
  });

  // Filtros avanzados (pills Todos/Con/Sin)
  document.querySelectorAll('.pill-filter').forEach(group => {
    const key = group.dataset.filter;
    group.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', () => setBoolFilter(key, btn.dataset.value));
    });
  });

  // Limpiar todos los filtros
  document.getElementById('btn-clear-filters')?.addEventListener('click', clearAllFilters);

  // Búsqueda con debounce mejorado (400ms)
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(applyFilters, 400));
  }

  // Precio
  ['price-min', 'price-max'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  // Ordenar
  const sortEl = document.getElementById('sort-by');
  if (sortEl) {
    sortEl.addEventListener('change', () => {
      applySort();
      renderProducts(true);
    });
  }

  // Filtros avanzados (mostrar/ocultar sección)
  const toggleBtn = document.getElementById('filters-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      document.getElementById('filters-advanced').classList.toggle('show');
    });
  }

  // Cargar más
  const loadMoreBtn = document.getElementById('btn-load-more');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', renderNextPage);
  }

  // Selección
  document.getElementById('btn-whatsapp')?.addEventListener('click', shareWhatsApp);
  document.getElementById('btn-copy-summary')?.addEventListener('click', copySummary);
  document.getElementById('btn-clear-selection')?.addEventListener('click', clearSelection);

  const selectAllCb = document.getElementById('select-all-filtered');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => toggleSelectAllFiltered(selectAllCb.checked));
  }
}

// ============================================
// INFINITE SCROLL
// ============================================
function setupInfiniteScroll() {
  const sentinel = document.getElementById('scroll-sentinel');
  if (!sentinel) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && displayedCount < filteredProducts.length) {
        renderNextPage();
      }
    });
  }, { rootMargin: '200px' });

  observer.observe(sentinel);
}

// ============================================
// RENDER OPTIMIZADO
// ============================================
function renderProducts(reset = false) {
  const container = document.getElementById('products-grid');
  if (!container) return;

  if (reset) {
    resetPagination();
    container.innerHTML = '';

    if (filteredProducts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1/-1;">
          <div class="icon">🔍</div>
          <h3>Sin resultados</h3>
          <p>Intenta ajustar los filtros de búsqueda</p>
        </div>`;
      updateResultsCount();
      updateLoadMoreButton();
      return;
    }

    renderNextPage();
  }
}

// Categorías sin procesador/RAM/SO (no aplican): se muestra un resumen de
// texto en su lugar, tomado de la descripción original del Excel.
const CATEGORIAS_SIN_SPECS = ['MONITOR', 'PANTALLA INTERACTIVA'];

function getShortDescription(p) {
  if (!p.descripcion) return 'Sin descripción disponible.';
  // Quita el prefijo "CATEGORIA : " (ya se muestra aparte como badge)
  const sinPrefijo = p.descripcion.replace(/^[^:]+:\s*/, '');
  return shortText(sinPrefijo, 160);
}

// Generar HTML de una card (función pura, rápida)
function generateCardHTML(p) {
  const isSelected = selectedProducts.has(p.id);
  const qty = selectedQuantities.get(p.id) || 1;
  const sinSpecs = CATEGORIAS_SIN_SPECS.includes(p.categoria);

  const specsHTML = sinSpecs
    ? `<div class="card-description">${getShortDescription(p)}</div>`
    : `<div class="card-specs">
        <div class="spec-item">
          <span class="spec-icon">⚡</span>
          <span class="spec-value">${shortText(p.specs.procesador, 25)}</span>
        </div>
        <div class="spec-item">
          <span class="spec-icon">💾</span>
          <span class="spec-value">${shortText(p.specs.ram, 20)}</span>
        </div>
        <div class="spec-item">
          <span class="spec-icon">📀</span>
          <span class="spec-value">${shortText(p.specs.almacenamiento, 20)}</span>
        </div>
        <div class="spec-item">
          <span class="spec-icon">🖥️</span>
          <span class="spec-value">${getOSShort(p.specs.sistemaOperativo)}</span>
        </div>
        ${p.specs.pantalla ? `
        <div class="spec-item">
          <span class="spec-icon">🖵</span>
          <span class="spec-value">${shortText(p.specs.pantalla, 25)}</span>
        </div>` : ''}
      </div>`;

  return `
    <div class="product-card ${isSelected ? 'selected' : ''}" data-id="${p.id}">
      <div class="card-header">
        <span class="card-category">${getCategoryShort(p.categoria)}</span>
        <div class="card-header-actions">
          <input type="number" class="card-qty" min="1" value="${qty}"
            title="Cantidad" onchange="updateQuantity('${p.id}', this)">
          <input type="checkbox" class="card-select"
            ${isSelected ? 'checked' : ''}
            onchange="toggleSelect('${p.id}')">
        </div>
      </div>
      <div class="card-title">${getCardTitle(p)}</div>
      <div class="card-model">${p.nroParte}</div>
      ${specsHTML}
      <div class="card-footer">
        <span class="card-price">$${p.precio.toLocaleString()}</span>
        <div class="card-actions">
          <button onclick="viewDetail('${p.id}')" title="Ver detalle">👁️</button>
          ${p.fichaUrl ? `<button onclick="window.open('${p.fichaUrl}','_blank')" title="Ficha técnica">📄</button>` : ''}
        </div>
      </div>
    </div>`;
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function getCategoryShort(cat) {
  if (!cat) return 'N/A';
  const map = {
    'COMPUTADORA DE ESCRITORIO': 'Desktop',
    'ESTACIÓN DE TRABAJO': 'Workstation',
    'ESTACIÓN DE TRABAJO PORTÁTIL': 'Workstation Portátil',
    'COMPUTADORA TODO EN UNO': 'Todo en Uno',
    'MONITOR': 'Monitor',
    'PANTALLA INTERACTIVA': 'Pantalla Interactiva'
  };
  return map[cat] || cat;
}

function getOSShort(os) {
  if (!os) return 'N/A';
  if (os.includes('WINDOWS 11')) return 'Win 11 Pro';
  if (os.includes('WINDOWS 10')) return 'Win 10';
  if (os.includes('UBUNTU')) return 'Ubuntu';
  return shortText(os, 15);
}

function shortText(text, max) {
  if (!text) return 'N/A';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

// ============================================
// MODAL DE DETALLE
// ============================================
function viewDetail(id) {
  const p = allProducts.find(x => x.id === id);
  if (!p) return;

  const modal = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');

  // Las specs vacías (procesador/RAM/SO en un monitor, por ejemplo) se
  // omiten de la tabla en vez de mostrar "N/A" en cada fila.
  const specRows = Object.entries(p.specs).filter(([, val]) => val === true || val === false || (val !== '' && val != null));

  content.innerHTML = `
    <div class="modal-header">
      <h2>${getCardTitle(p)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="color:var(--text-light);margin-bottom:16px;">${p.nroParte} | ${p.categoria}</p>
    ${p.descripcion ? `<p style="font-size:0.9rem;line-height:1.5;margin-bottom:16px;padding:10px;background:var(--bg);border-radius:8px;">${p.descripcion}</p>` : ''}
    <table style="width:100%;font-size:0.9rem;border-collapse:collapse;">
      ${specRows.map(([key, val]) => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:8px;font-weight:600;text-transform:capitalize;">${formatKey(key)}</td>
          <td style="padding:8px;">${val === true ? '✅ Sí' : val === false ? '❌ No' : val}</td>
        </tr>
      `).join('')}
    </table>
    <div style="margin-top:20px;display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:1.5rem;font-weight:800;color:var(--success);">$${p.precio.toLocaleString()} USD</span>
      ${p.fichaUrl ? `<a href="${p.fichaUrl}" target="_blank" class="btn btn-primary btn-sm">📄 Ver Ficha Técnica</a>` : ''}
    </div>
  `;

  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function formatKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}