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

  const range = getPriceRange();
  const minEl = document.getElementById('price-min');
  const maxEl = document.getElementById('price-max');
  if (minEl) minEl.placeholder = `$${range.min}`;
  if (maxEl) maxEl.placeholder = `$${range.max}`;

  renderProducts(true);
  setupEventListeners();
  setupInfiniteScroll();
}

function populateFilters() {
  populateSelect('filter-categoria', getUniqueValues('categoria'), 'Categoría');
  populateSelect('filter-procesador', getUniqueValues('procesador'), 'Procesador');
  populateSelect('filter-ram', getUniqueValues('ram'), 'RAM');
  populateSelect('filter-almacenamiento', getUniqueValues('almacenamiento'), 'Almacenamiento');
  populateSelect('filter-so', getUniqueValues('sistemaOperativo'), 'Sistema Op.');
  populateSelect('filter-software', getUniqueValues('software'), 'Software');
}

function populateSelect(id, options, placeholder) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = `<option value="">${placeholder} (todos)</option>`;
  const fragment = document.createDocumentFragment();

  options.forEach(opt => {
    if (opt && opt !== 'NO') {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt.length > 35 ? opt.substring(0, 35) + '...' : opt;
      fragment.appendChild(option);
    }
  });

  el.appendChild(fragment);
}

function setupEventListeners() {
  // Filtros
  document.querySelectorAll('.filter-select').forEach(sel => {
    sel.addEventListener('change', applyFilters);
  });

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

  // Filtros avanzados
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

// Generar HTML de una card (función pura, rápida)
function generateCardHTML(p) {
  const isSelected = selectedProducts.has(p.id);
  return `
    <div class="product-card ${isSelected ? 'selected' : ''}" data-id="${p.id}">
      <div class="card-header">
        <span class="card-category">${getCategoryShort(p.categoria)}</span>
        <input type="checkbox" class="card-select"
          ${isSelected ? 'checked' : ''}
          onchange="toggleSelect('${p.id}')">
      </div>
      <div class="card-title">${p.marca} ${p.modelo}</div>
      <div class="card-model">${p.nroParte}</div>
      <div class="card-specs">
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
      </div>
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
    'ESTACION DE TRABAJO': 'Workstation',
    'COMPUTADORA TODO EN UNO': 'Todo en Uno'
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

  content.innerHTML = `
    <div class="modal-header">
      <h2>${p.marca} ${p.modelo}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <p style="color:var(--text-light);margin-bottom:16px;">${p.nroParte} | ${p.categoria}</p>
    <table style="width:100%;font-size:0.9rem;border-collapse:collapse;">
      ${Object.entries(p.specs).map(([key, val]) => `
        <tr style="border-bottom:1px solid var(--border);">
          <td style="padding:8px;font-weight:600;text-transform:capitalize;">${formatKey(key)}</td>
          <td style="padding:8px;">${val === true ? '✅ Sí' : val === false ? '❌ No' : val || 'N/A'}</td>
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