// ============================================
// ESTADO GLOBAL
// ============================================
let allProducts = [];
let filteredProducts = [];
let selectedProducts = new Set();
// Cantidad por producto seleccionado (id -> cantidad). Se conserva aunque
// se deseleccione, por si vuelve a marcarse el mismo producto después.
let selectedQuantities = new Map();

// Filtros activos: sets = selección múltiple (OR dentro de la categoría,
// AND entre categorías); los booleanos de conectividad son de 3 estados
// ('' = todos, 'si', 'no').
let activeFilters = {
  categoria: new Set(),
  procesador: new Set(),
  ram: new Set(),
  almacenamiento: new Set(),
  so: new Set(),
  software: new Set(),
  case: new Set(),
  fuente: new Set(),
  video: new Set(),
  chipset: new Set(),
  lan: '',
  wlan: '',
  hdmi: '',
  vga: '',
  optica: ''
};

// key = id usado en el DOM/activeFilters, field = propiedad en specs
// (null => usa p.categoria directamente en vez de p.specs.field)
const MULTI_FILTER_KEYS = [
  { key: 'categoria', label: 'Categoría', field: null },
  { key: 'procesador', label: 'Procesador', field: 'procesador' },
  { key: 'ram', label: 'RAM', field: 'ram' },
  { key: 'almacenamiento', label: 'Almacenamiento', field: 'almacenamiento' },
  { key: 'so', label: 'Sistema Operativo', field: 'sistemaOperativo' },
  { key: 'software', label: 'Software', field: 'software' },
  { key: 'case', label: 'Gabinete', field: 'case' },
  { key: 'fuente', label: 'Fuente de Poder', field: 'fuente' },
  { key: 'video', label: 'Tarjeta de Video', field: 'tarjetaVideo' },
  { key: 'chipset', label: 'Chipset', field: 'chipset' }
];

const BOOL_FILTER_KEYS = ['lan', 'wlan', 'hdmi', 'vga', 'optica'];

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

  let pkg;
  try {
    const res = await fetch('data/productos.enc.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    pkg = await res.json();
  } catch (e) {
    console.error('No se pudo descargar/leer el catálogo (data/productos.enc.json).', e);
    allProducts = [];
    filteredProducts = [];
    throw new Error('No se pudo cargar el catálogo. Verifica tu conexión e intenta de nuevo.');
  }

  let data;
  try {
    data = await decryptJSON(pkg.iv, pkg.data, dataKey);
  } catch (e) {
    // La clave guardada en la sesión ya no coincide con el catálogo
    // publicado (por ejemplo, se volvió a publicar con datos nuevos
    // mientras esta sesión seguía activa). Se limpia la sesión vieja y se
    // manda a pedir el código de nuevo, en vez de romper la página entera.
    console.warn('La sesión guardada no pudo desencriptar el catálogo actual. Se pide iniciar sesión de nuevo.', e);
    logout();
    return [];
  }

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
      // Si el Glosario de Simplificaciones (admin-local) definió una versión
      // corta para este campo, la opción del filtro se arma con ESA versión
      // en vez del valor crudo del Excel (getResumenValue cae de vuelta al
      // valor real si no hay ninguna regla) — así el filtro agrupa variantes
      // técnicas equivalentes bajo una sola opción legible, igual que ya
      // hace el resumen de la card.
      const val = getResumenValue(p, field);
      if (val && val !== 'NO' && val !== 'SI' && val !== true && val !== false) {
        values.add(val);
      }
    }
  }
  return sortFilterOptions(field, [...values]);
}

// Orden automático: numérico para RAM/almacenamiento, alfabético (es) para el resto
function sortFilterOptions(field, arr) {
  if (field === 'ram') {
    return arr.sort((a, b) => extractGB(a) - extractGB(b));
  }
  if (field === 'almacenamiento') {
    return arr.sort((a, b) => extractStorageGB(a) - extractStorageGB(b));
  }
  return arr.sort((a, b) => a.localeCompare(b, 'es'));
}

function extractStorageGB(str) {
  if (!str) return 0;
  const match = str.match(/(\d+(?:\.\d+)?)\s*(GB|TB)/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  return match[2].toUpperCase() === 'TB' ? num * 1024 : num;
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
function getFilterContext() {
  return {
    precioMin: parseFloat(document.getElementById('price-min')?.value) || 0,
    precioMax: parseFloat(document.getElementById('price-max')?.value) || Infinity,
    searchText: (document.getElementById('search-input')?.value || '').toLowerCase().trim()
  };
}

// skip: key de un filtro a ignorar (usado para calcular cuántos resultados
// tendría CADA opción de ese mismo filtro si se le sumara una selección más)
function productMatchesFilters(p, ctx, skip) {
  if (!p.specs) return false;
  const f = activeFilters;

  for (let i = 0; i < MULTI_FILTER_KEYS.length; i++) {
    const mf = MULTI_FILTER_KEYS[i];
    if (mf.key === skip) continue;
    const set = f[mf.key];
    if (!set.size) continue;
    // Las opciones seleccionadas vienen de getUniqueValues(), que ya usa el
    // valor simplificado — hay que comparar contra ESE mismo valor, no el
    // crudo, o un producto con regla de glosario nunca haría match.
    const val = mf.field === null ? p.categoria : getResumenValue(p, mf.field);
    if (!set.has(val)) return false;
  }

  if (p.precio < ctx.precioMin || p.precio > ctx.precioMax) return false;

  if (skip !== 'lan') {
    if (f.lan === 'si' && !p.specs.lan) return false;
    if (f.lan === 'no' && p.specs.lan) return false;
  }
  if (skip !== 'wlan') {
    if (f.wlan === 'si' && !p.specs.wlan) return false;
    if (f.wlan === 'no' && p.specs.wlan) return false;
  }
  if (skip !== 'hdmi') {
    if (f.hdmi === 'si' && !p.specs.hdmi) return false;
    if (f.hdmi === 'no' && p.specs.hdmi) return false;
  }
  if (skip !== 'vga') {
    if (f.vga === 'si' && !p.specs.vga) return false;
    if (f.vga === 'no' && p.specs.vga) return false;
  }
  if (skip !== 'optica') {
    if (f.optica === 'si' && !p.specs.unidadOptica) return false;
    if (f.optica === 'no' && p.specs.unidadOptica) return false;
  }

  if (ctx.searchText) {
    const searchStr = `${p.nroParte} ${p.modelo} ${p.marca} ${p.specs.procesador} ${p.categoria} ${p.specs.ram} ${p.specs.almacenamiento}`.toLowerCase();
    if (!searchStr.includes(ctx.searchText)) return false;
  }

  return true;
}

function applyFilters() {
  const ctx = getFilterContext();

  // Mostrar indicador de carga
  showLoading(true);

  // Usar setTimeout para no bloquear la UI
  setTimeout(() => {
    filteredProducts = allProducts.filter(p => productMatchesFilters(p, ctx, null));

    applySort();
    resetPagination();
    renderProducts(true);
    renderActiveFilterChips();
    refreshFilterCounts(ctx);
    updateSelectAllUI();
    showLoading(false);
  }, 50);
}

// Filtros dinámicos: recalcula cuántos productos quedarían por cada opción
// de cada filtro, considerando el resto de filtros activos (pero no el suyo
// propio), para que las listas se actualicen según lo ya seleccionado.
function computeFacetCounts(mf, ctx) {
  const counts = new Map();
  for (let i = 0; i < allProducts.length; i++) {
    const p = allProducts[i];
    if (!productMatchesFilters(p, ctx, mf.key)) continue;
    const val = mf.field === null ? p.categoria : (p.specs ? getResumenValue(p, mf.field) : undefined);
    if (!val || val === 'NO') continue;
    counts.set(val, (counts.get(val) || 0) + 1);
  }
  return counts;
}

function refreshFilterCounts(ctx) {
  ctx = ctx || getFilterContext();
  MULTI_FILTER_KEYS.forEach(mf => {
    const panel = document.getElementById('panel-' + mf.key);
    if (!panel) return;
    const list = panel.querySelector('.filter-panel-list');
    if (!list) return;
    const counts = computeFacetCounts(mf, ctx);

    // Actualiza conteo/estado y separa en dos grupos, conservando el orden
    // (numérico/alfabético) ya establecido dentro de cada grupo.
    const available = [];
    const unavailable = [];

    list.querySelectorAll('.filter-checkbox-item').forEach(item => {
      const input = item.querySelector('input[type="checkbox"]');
      if (!input) return;
      const n = counts.get(input.value) || 0;
      const countEl = item.querySelector('.filter-option-count');
      if (countEl) countEl.textContent = `(${n})`;

      const disable = n === 0 && !input.checked;
      input.disabled = disable;
      item.classList.toggle('disabled', disable);

      (disable ? unavailable : available).push(item);
    });

    // Reordenar en el DOM: opciones disponibles primero (arriba, sin scroll),
    // las agotadas por la combinación de filtros al final.
    available.forEach(item => list.appendChild(item));
    unavailable.forEach(item => list.appendChild(item));
  });
}

// ============================================
// ESTADO DE FILTROS (multi-selección + limpiar)
// ============================================
function toggleFilterValue(key, value, checked) {
  if (checked) activeFilters[key].add(value);
  else activeFilters[key].delete(value);
  updateFilterButtonBadge(key);
  applyFilters();
}

function removeFilterValue(key, value) {
  activeFilters[key].delete(value);
  document.querySelectorAll(`#panel-${key} input[type="checkbox"]`).forEach(cb => {
    if (cb.value === value) cb.checked = false;
  });
  updateFilterButtonBadge(key);
  applyFilters();
}

function clearFilterCategory(key) {
  activeFilters[key].clear();
  document.querySelectorAll(`#panel-${key} input[type="checkbox"]`).forEach(cb => { cb.checked = false; });
  updateFilterButtonBadge(key);
  applyFilters();
}

function setBoolFilter(key, value) {
  activeFilters[key] = value;
  syncPillUI(key);
  applyFilters();
}

function clearBoolFilter(key) {
  activeFilters[key] = '';
  syncPillUI(key);
  applyFilters();
}

function clearAllFilters() {
  MULTI_FILTER_KEYS.forEach(f => {
    activeFilters[f.key].clear();
    document.querySelectorAll(`#panel-${f.key} input[type="checkbox"]`).forEach(cb => { cb.checked = false; });
    updateFilterButtonBadge(f.key);
  });
  BOOL_FILTER_KEYS.forEach(key => {
    activeFilters[key] = '';
    syncPillUI(key);
  });

  const searchEl = document.getElementById('search-input');
  const minEl = document.getElementById('price-min');
  const maxEl = document.getElementById('price-max');
  if (searchEl) searchEl.value = '';
  if (minEl) minEl.value = '';
  if (maxEl) maxEl.value = '';

  applyFilters();
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
    if (!selectedQuantities.has(id)) selectedQuantities.set(id, 1);
  }

  // Actualizar SOLO la card específica (sin re-render)
  updateCardSelection(id);
  updateSelectionBar();
}

// Cambia la cantidad de un producto ya seleccionado (campo numérico en la card)
function updateQuantity(id, inputEl) {
  let qty = parseInt(inputEl.value, 10);
  if (!qty || qty < 1) qty = 1;
  inputEl.value = qty;
  selectedQuantities.set(id, qty);
}

// Aplica una misma cantidad a TODOS los productos actualmente seleccionados
// (control junto a "Seleccionar todos los resultados"), sobreescribiendo
// cualquier cantidad individual que se haya puesto antes.
function applyBulkQuantity() {
  const input = document.getElementById('bulk-qty-input');
  if (!input) return;

  let qty = parseInt(input.value, 10);
  if (!qty || qty < 1) qty = 1;
  input.value = qty;

  if (selectedProducts.size === 0) {
    showToast('⚠️ No hay productos seleccionados para aplicar la cantidad');
    return;
  }

  selectedProducts.forEach(id => selectedQuantities.set(id, qty));

  document.querySelectorAll('.product-card.selected .card-qty').forEach(qtyInput => {
    qtyInput.value = qty;
  });

  showToast(`✅ Cantidad ${qty} aplicada a ${selectedProducts.size} producto(s) seleccionado(s)`);
}

function updateCardSelection(id) {
  const card = document.querySelector(`.product-card[data-id="${id}"]`);
  if (!card) return;

  const isSelected = selectedProducts.has(id);
  const checkbox = card.querySelector('.card-select');
  const qtyInput = card.querySelector('.card-qty');

  if (isSelected) {
    card.classList.add('selected');
    if (checkbox) checkbox.checked = true;
    if (qtyInput) qtyInput.value = selectedQuantities.get(id) || 1;
  } else {
    card.classList.remove('selected');
    if (checkbox) checkbox.checked = false;
  }
}

function clearSelection() {
  const previousSelection = [...selectedProducts];
  selectedProducts.clear();
  selectedQuantities.clear();

  // Actualizar solo las cards que estaban seleccionadas
  previousSelection.forEach(id => updateCardSelection(id));
  updateSelectionBar();

  const selectAllCb = document.getElementById('select-all-filtered');
  if (selectAllCb) selectAllCb.checked = false;
}

// Selecciona/deselecciona TODOS los productos que cumplen los filtros
// actuales (no solo los ya renderizados por la paginación), para poder
// enviarlos completos por WhatsApp o copiar el resumen.
function toggleSelectAllFiltered(checked) {
  if (checked) {
    filteredProducts.forEach(p => {
      selectedProducts.add(p.id);
      if (!selectedQuantities.has(p.id)) selectedQuantities.set(p.id, 1);
    });
  } else {
    selectedProducts.clear();
    selectedQuantities.clear();
  }

  // Actualizar solo las cards ya renderizadas en pantalla, sin resetear
  // la paginación ni recargar todo el grid.
  document.querySelectorAll('.product-card').forEach(card => {
    const id = card.dataset.id;
    const isSelected = selectedProducts.has(id);
    card.classList.toggle('selected', isSelected);
    const cb = card.querySelector('.card-select');
    if (cb) cb.checked = isSelected;
    const qtyInput = card.querySelector('.card-qty');
    if (qtyInput) qtyInput.value = selectedQuantities.get(id) || 1;
  });

  updateSelectionBar();
}

function updateSelectAllUI() {
  const countEl = document.getElementById('select-all-count');
  if (countEl) countEl.textContent = filteredProducts.length;

  const cb = document.getElementById('select-all-filtered');
  if (cb) cb.checked = false; // acción puntual, no un estado persistente
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