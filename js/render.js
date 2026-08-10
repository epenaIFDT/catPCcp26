// ============================================
// RENDER.JS - Renderizado de cards y modal de detalle
// ============================================
// Extraído de app.js para que sea reutilizable sin efectos de carga
// (no registra listeners ni llama a nada al importarse): tanto el
// catálogo público (catalogo.html) como la Vista Previa del panel
// admin-local usan EXACTAMENTE estas mismas funciones, así lo que se
// prueba en admin-local es idéntico a lo que verá el usuario final.
// Requiere que ya estén cargados js/export.js (CATEGORIAS_SIN_SPECS,
// getDescriptionSummary, isDedicatedVideo, formatScreen, getCardTitle)
// y las variables globales allProducts/selectedProducts/selectedQuantities.

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

function formatKey(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

// Devuelve la versión simplificada de un campo si el glosario (admin-local)
// definió una para este producto, o el valor real si no hay ninguna. Solo
// para el resumen de la card — "Ver detalle" siempre usa p.specs tal cual.
function getResumenValue(p, field) {
  return (p.specsResumen && p.specsResumen[field] !== undefined) ? p.specsResumen[field] : p.specs[field];
}

// Generar HTML de una card (función pura, rápida)
function generateCardHTML(p) {
  const isSelected = selectedProducts.has(p.id);
  const qty = selectedQuantities.get(p.id) || 1;
  const sinSpecs = CATEGORIAS_SIN_SPECS.includes(p.categoria);

  let specsHTML;
  if (sinSpecs) {
    specsHTML = `<div class="card-description">${getDescriptionSummary(p, 160)}</div>`;
  } else {
    // Solo se listan specs con dato real; nada de "N/A" ocupando espacio.
    // Si el glosario simplificó un campo, se usa esa versión tal cual (sin
    // reformatear encima); si no, se aplica el formateo automático normal.
    const items = [];
    const resumenCpu = getResumenValue(p, 'procesador');
    if (resumenCpu) items.push({ label: 'CPU', value: shortText(resumenCpu, 25) });

    const resumenRam = getResumenValue(p, 'ram');
    if (resumenRam) items.push({ label: 'RAM', value: shortText(resumenRam, 20) });

    const resumenDisco = getResumenValue(p, 'almacenamiento');
    if (resumenDisco) items.push({ label: 'Disco', value: shortText(resumenDisco, 20) });

    if (p.specs.sistemaOperativo) {
      const soSimplificado = p.specsResumen && p.specsResumen.sistemaOperativo;
      items.push({ label: 'SO', value: soSimplificado ? shortText(soSimplificado, 20) : getOSShort(p.specs.sistemaOperativo) });
    }

    if (p.specs.pantalla) {
      const pantallaSimplificada = p.specsResumen && p.specsResumen.pantalla;
      items.push({ label: 'Pant.', value: pantallaSimplificada ? shortText(pantallaSimplificada, 25) : formatScreen(p.specs.pantalla) });
    }

    if (isDedicatedVideo(p.specs.tarjetaVideo)) {
      const videoSimplificado = p.specsResumen && p.specsResumen.tarjetaVideo;
      items.push({ label: 'GPU', value: shortText(videoSimplificado || p.specs.tarjetaVideo, 25) });
    }

    const resumenGabinete = getResumenValue(p, 'case');
    if (resumenGabinete) items.push({ label: 'Gab.', value: shortText(resumenGabinete, 20) });

    const resumenFuente = getResumenValue(p, 'fuente');
    if (resumenFuente) items.push({ label: 'Fte.', value: shortText(resumenFuente, 25) });

    specsHTML = items.length
      ? `<div class="card-specs">${items.map(it => `
        <div class="spec-item">
          <span class="spec-label">${it.label}:</span>
          <span class="spec-value">${it.value}</span>
        </div>`).join('')}</div>`
      : '';
  }

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
        <div class="card-price-block">
          <span class="card-price-label">Precio de lista (referencial)</span>
          <span class="card-price">$${p.precio.toLocaleString()}</span>
        </div>
        <div class="card-actions">
          <button onclick="viewDetail('${p.id}')" title="Ver detalle">ℹ️</button>
          ${p.fichaUrl ? `<button onclick="window.open('${p.fichaUrl}','_blank')" title="Ficha técnica">📄</button>` : ''}
        </div>
      </div>
    </div>`;
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
    <div style="margin-top:20px;">
      <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:2px;">Precio de lista (referencial)</div>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:1.5rem;font-weight:800;color:var(--success);">$${p.precio.toLocaleString()} USD</span>
        ${p.fichaUrl ? `<a href="${p.fichaUrl}" target="_blank" class="btn btn-primary btn-sm">📄 Ver Ficha Técnica</a>` : ''}
      </div>
    </div>
  `;

  modal.classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}
