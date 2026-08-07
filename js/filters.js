// ============================================
// ESTADO GLOBAL
// ============================================
let allProducts = [];
let filteredProducts = [];
let selectedProducts = new Set();

// Paginación
const PAGE_SIZE = 24;
let currentPage = 0;
let displayedCount = 0;

// ============================================
// CARGA DE DATOS (productos.enc.json cifrado con la DataKey de la sesión)
// ============================================
async function loadProducts() {
  const dataKey = await getSessionDataKey();
  if (!dataKey) {
    // Sin sesión válida: requireAuth() ya redirigió a index.html
    allProducts = [];
    filteredProducts = [];
    return [];
  }

  const res = await fetch('data/productos.enc.json');
  const pkg = await res.json();
  const data = await decryptJSON(pkg.iv, pkg.data, dataKey);

  allProducts = data;
  filteredProducts = [...data];
  return data;
}

// ============================================
// HELPERS PARA FILTROS
// ============================================
function getUniqueValues(field) {
  const values = new Set();
  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    if (field === 'categoria') {
      if (p.categoria) values.add(p.categoria);
    } else if (p.specs) {
      const val = p.specs[field];
      if (val && val !== 'NO' && val !== 'SI' && val !== true && val !== false) {
        values.add(val);
      }
    }
  }
  return [...values].sort();
}

function getPriceRange() {
  if (allProducts.length === 0) return { min: 0, max: 0 };
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i].precio;
    if (!isNaN(p)) {
      if (p < min) min = p;
      if (p > max) max = p;
    }
  }
  return { min, max };
}

// ============================================
// FILTRADO OPTIMIZADO
// ============================================
function applyFilters() {
  const categoria = document.getElementById('filter-categoria')?.value || '';
  const procesador = document.getElementById('filter-procesador')?.value || '';
  const ram = document.getElementById('filter-ram')?.value || '';
  const almacenamiento = document.getElementById('filter-almacenamiento')?.value || '';
  const so = document.getElementById('filter-so')?.value || '';
  const software = document.getElementById('filter-software')?.value || '';
  const precioMin = parseFloat(document.getElementById('price-min')?.value) || 0;
  const precioMax = parseFloat(document.getElementById('price-max')?.value) || Infinity;
  const searchText = (document.getElementById('search-input')?.value || '').toLowerCase().trim();

  // Filtros avanzados
  const lan = document.getElementById('filter-lan')?.value || '';
  const wlan = document.getElementById('filter-wlan')?.value || '';
  const hdmi = document.getElementById('filter-hdmi')?.value || '';
  const vga = document.getElementById('filter-vga')?.value || '';
  const optica = document.getElementById('filter-optica')?.value || '';

  // Mostrar indicador de carga
  showLoading(true);

  // Usar setTimeout para no bloquear la UI
  setTimeout(() => {
    filteredProducts = [];

    for (let i = 0; i < allProducts.length; i++) {
      const p = allProducts[i];
      if (!p.specs) continue;

      // Filtros principales (cortocircuito rápido)
      if (categoria && p.categoria !== categoria) continue;
      if (procesador && p.specs.procesador !== procesador) continue;
      if (ram && p.specs.ram !== ram) continue;
      if (almacenamiento && p.specs.almacenamiento !== almacenamiento) continue;
      if (so && p.specs.sistemaOperativo !== so) continue;
      if (software && p.specs.software !== software) continue;
      if (p.precio < precioMin || p.precio > precioMax) continue;

      // Filtros avanzados
      if (lan === 'si' && !p.specs.lan) continue;
      if (lan === 'no' && p.specs.lan) continue;
      if (wlan === 'si' && !p.specs.wlan) continue;
      if (wlan === 'no' && p.specs.wlan) continue;
      if (hdmi === 'si' && !p.specs.hdmi) continue;
      if (hdmi === 'no' && p.specs.hdmi) continue;
      if (vga === 'si' && !p.specs.vga) continue;
      if (vga === 'no' && p.specs.vga) continue;
      if (optica === 'si' && !p.specs.unidadOptica) continue;
      if (optica === 'no' && p.specs.unidadOptica) continue;

      // Búsqueda de texto
      if (searchText) {
        const searchStr = `${p.nroParte} ${p.modelo} ${p.marca} ${p.specs.procesador} ${p.categoria} ${p.specs.ram} ${p.specs.almacenamiento}`.toLowerCase();
        if (!searchStr.includes(searchText)) continue;
      }

      filteredProducts.push(p);
    }

    applySort();
    resetPagination();
    renderProducts(true);
    showLoading(false);
  }, 50);
}

function applySort() {
  const sortBy = document.getElementById('sort-by')?.value || 'precio-asc';

  filteredProducts.sort((a, b) => {
    switch (sortBy) {
      case 'precio-asc': return a.precio - b.precio;
      case 'precio-desc': return b.precio - a.precio;
      case 'ram-asc': return extractGB(a.specs.ram) - extractGB(b.specs.ram);
      case 'ram-desc': return extractGB(b.specs.ram) - extractGB(a.specs.ram);
      case 'nombre': return a.modelo.localeCompare(b.modelo);
      default: return 0;
    }
  });
}

function extractGB(ramStr) {
  if (!ramStr) return 0;
  const match = ramStr.match(/(\d+)\s*GB/);
  return match ? parseInt(match[1]) : 0;
}

// ============================================
// PAGINACIÓN
// ============================================
function resetPagination() {
  currentPage = 0;
  displayedCount = 0;
}

function renderNextPage() {
  const start = displayedCount;
  const end = Math.min(start + PAGE_SIZE, filteredProducts.length);

  if (start >= filteredProducts.length) {
    updateLoadMoreButton();
    return;
  }

  const container = document.getElementById('products-grid');
  const fragment = document.createDocumentFragment();
  const tempDiv = document.createElement('div');

  // Generar HTML de la página actual
  let html = '';
  for (let i = start; i < end; i++) {
    html += generateCardHTML(filteredProducts[i]);
  }

  tempDiv.innerHTML = html;

  // Mover nodos al fragment
  while (tempDiv.firstChild) {
    fragment.appendChild(tempDiv.firstChild);
  }

  container.appendChild(fragment);
  displayedCount = end;

  updateLoadMoreButton();
  updateResultsCount();
}

function updateLoadMoreButton() {
  const btn = document.getElementById('btn-load-more');
  const remaining = filteredProducts.length - displayedCount;

  if (!btn) return;

  if (remaining > 0) {
    btn.style.display = 'block';
    btn.innerHTML = `📦 Cargar más (${remaining} restantes)`;
  } else {
    btn.style.display = 'none';
  }
}

function updateResultsCount() {
  const countEl = document.getElementById('results-count');
  if (countEl) {
    countEl.innerHTML = `<strong>${filteredProducts.length}</strong> producto(s) encontrados`;
  }
}

function showLoading(show) {
  const loader = document.getElementById('loading-indicator');
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}

// ============================================
// SELECCIÓN OPTIMIZADA (sin re-render completo)
// ============================================
function toggleSelect(id) {
  if (selectedProducts.has(id)) {
    selectedProducts.delete(id);
  } else {
    selectedProducts.add(id);
  }

  // Actualizar SOLO la card específica (sin re-render)
  updateCardSelection(id);
  updateSelectionBar();
}

function updateCardSelection(id) {
  const card = document.querySelector(`.product-card[data-id="${id}"]`);
  if (!card) return;

  const isSelected = selectedProducts.has(id);
  const checkbox = card.querySelector('.card-select');

  if (isSelected) {
    card.classList.add('selected');
    if (checkbox) checkbox.checked = true;
  } else {
    card.classList.remove('selected');
    if (checkbox) checkbox.checked = false;
  }
}

function clearSelection() {
  const previousSelection = [...selectedProducts];
  selectedProducts.clear();

  // Actualizar solo las cards que estaban seleccionadas
  previousSelection.forEach(id => updateCardSelection(id));
  updateSelectionBar();
}

function updateSelectionBar() {
  const bar = document.getElementById('selection-bar');
  const count = document.getElementById('selection-count');
  if (selectedProducts.size > 0) {
    bar.classList.add('show');
    count.textContent = selectedProducts.size;
  } else {
    bar.classList.remove('show');
  }
}