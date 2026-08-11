function getQty(p) {
  return selectedQuantities.get(p.id) || 1;
}

function getCardTitle(p) {
  // Algunos productos (monitores) no traen modelo en el Excel origen;
  // sin esto el título quedaría solo con la marca ("VASTEC").
  return p.modelo ? `${p.marca} ${p.modelo}` : `${p.marca} — ${p.nroParte}`;
}

function truncateText(text, max) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}

// Categorías sin procesador/RAM/SO (no aplican): en su lugar se usa un
// resumen tomado de la descripción original del Excel.
const CATEGORIAS_SIN_SPECS = ['MONITOR', 'PANTALLA INTERACTIVA'];

function getDescriptionSummary(p, maxLen) {
  if (!p.descripcion) return 'Sin descripción disponible.';
  // Quita el prefijo "CATEGORIA : " (ya se muestra aparte como título/badge)
  const sinPrefijo = p.descripcion.replace(/^[^:]+:\s*/, '');
  return truncateText(sinPrefijo, maxLen);
}

// Tarjeta de video "real" (dedicada) vs el caso más común de gráficos
// integrados, que no aporta información útil para mostrar/compartir.
function isDedicatedVideo(video) {
  return !!video && !video.toUpperCase().includes('INTEGRAD');
}

// Bloque de specs de un producto para el mensaje de WhatsApp (con viñetas).
// Evita mostrar "Procesador: N/A" etc. en categorías que no tienen esos
// datos (monitores, pantallas interactivas) — se usa la descripción en su lugar.
function buildItemSpecsWhatsApp(p) {
  if (CATEGORIAS_SIN_SPECS.includes(p.categoria)) {
    return `${getDescriptionSummary(p, 220)}\n`;
  }

  let block = '';
  block += `• Procesador: ${formatProcessor(p.specs.procesador)}\n`;
  block += `• RAM: ${formatRAM(p.specs.ram)}\n`;
  block += `• Almacenamiento: ${formatStorage(p.specs.almacenamiento)}\n`;
  if (p.specs.pantalla) block += `• Pantalla: ${formatScreen(p.specs.pantalla)}\n`;
  block += `• Sistema operativo: ${formatOS(p.specs.sistemaOperativo)}\n`;
  if (p.specs.software && p.specs.software !== 'NO') block += `• Office: ${formatSoftware(p.specs.software)}\n`;
  if (isDedicatedVideo(p.specs.tarjetaVideo)) {
    block += `• Tarjeta de video: ${p.specs.tarjetaVideo}\n`;
  }
  if (p.specs.case) block += `• Gabinete: ${p.specs.case}\n`;
  if (p.specs.fuente) block += `• Fuente de poder: ${p.specs.fuente}\n`;
  if (p.specs.chipset) block += `• Chipset: ${p.specs.chipset}\n`;
  block += `• Garantía: ${p.specs.garantia}\n`;
  return block;
}

function buildWhatsAppFullText(products, fecha, ref) {
  let text = `Hola, te comparto la cotización VASTEC del ${fecha}:\n\n`;

  products.forEach((p, i) => {
    const qty = getQty(p);
    const subtotal = p.precio * qty;

    // Título + código en una sola línea (menos líneas, más fácil de escanear)
    text += `*${i + 1}. ${getCardTitle(p)}* (Código: ${p.nroParte})\n`;
    text += buildItemSpecsWhatsApp(p);
    // Siempre precio unitario (c/u) + total del item, sin importar la
    // cantidad, para un formato consistente en toda la selección.
    text += `Cantidad: ${qty}\n`;
    text += `Precio de lista (referencial): $${p.precio.toLocaleString('en-US')} USD (c/u)\n`;
    text += `Total item: *$${subtotal.toLocaleString('en-US')} USD*\n`;

    // Separador liviano entre productos
    text += i < products.length - 1 ? '─────────────────────\n\n' : '\n';
  });

  // Con un solo producto, el total coincide con su propio precio: se
  // muestra igual por claridad. Con varios, cada item ya trae su propio
  // total y no se suma un gran total al final (a pedido).
  if (products.length === 1) {
    const total = products[0].precio * getQty(products[0]);
    text += `*Total: $${total.toLocaleString('en-US')} USD*\n\n`;
  }

  text += `_Precios de lista referenciales, sujetos a disponibilidad._\n`;
  text += `Cotizado por: ${ref}\n`;
  text += `VASTEC - Soluciones Tecnológicas`;

  return text;
}

// Versión mínima (modelo, código, cantidad, precio de lista) para cuando
// la selección es demasiado grande para el mensaje completo.
function buildWhatsAppCompactText(products, fecha, ref) {
  let text = `Cotización VASTEC (resumen) - ${fecha}\n`;
  text += `Precios de lista referenciales\n\n`;

  products.forEach((p, i) => {
    const qty = getQty(p);
    const subtotal = p.precio * qty;
    text += `${i + 1}. ${getCardTitle(p)} | ${p.nroParte} | x${qty} | Total item: $${subtotal.toLocaleString('en-US')}\n`;
  });

  // Sin gran total al final cuando hay más de un producto (a pedido);
  // con uno solo, coincide con su propio total y se muestra igual.
  if (products.length === 1) {
    const total = products[0].precio * getQty(products[0]);
    text += `\n*Total: $${total.toLocaleString('en-US')} USD*\n`;
  }

  text += `\nCotizado por: ${ref}\n`;
  text += `VASTEC - Soluciones Tecnológicas`;

  return text;
}

// Igual que buildItemSpecsWhatsApp pero en texto plano (sin viñetas ni
// negritas), para "Copiar resumen" — pensado para pegar en Word/Excel.
function buildItemSpecsSummary(p) {
  let block;
  if (CATEGORIAS_SIN_SPECS.includes(p.categoria)) {
    block = `   ${getDescriptionSummary(p, 220)}\n`;
  } else {
    block = '';
    block += `   CPU: ${formatProcessor(p.specs.procesador)}\n`;
    block += `   RAM: ${formatRAM(p.specs.ram)}\n`;
    block += `   Disco: ${formatStorage(p.specs.almacenamiento)}\n`;
    if (p.specs.pantalla) block += `   Pantalla: ${formatScreen(p.specs.pantalla)}\n`;
    block += `   SO: ${formatOS(p.specs.sistemaOperativo)}\n`;
    if (p.specs.software && p.specs.software !== 'NO') block += `   Office: ${formatSoftware(p.specs.software)}\n`;
    if (isDedicatedVideo(p.specs.tarjetaVideo)) {
      block += `   GPU: ${p.specs.tarjetaVideo}\n`;
    }
    if (p.specs.case) block += `   Gabinete: ${p.specs.case}\n`;
    if (p.specs.fuente) block += `   Fuente de poder: ${p.specs.fuente}\n`;
    if (p.specs.chipset) block += `   Chipset: ${p.specs.chipset}\n`;
    block += `   Garantia: ${p.specs.garantia}\n`;
  }
  // Se agrega SIEMPRE, sin importar la categoría (antes quedaba solo para
  // las categorías con specs completas, porque CATEGORIAS_SIN_SPECS
  // cortaba la función con un "return" antes de llegar a esta línea).
  if (p.fichaUrl) block += `   Ficha tecnica: ${p.fichaUrl}\n`;
  return block;
}

function shareWhatsApp() {
  const products = allProducts.filter(p => selectedProducts.has(p.id));
  if (products.length === 0) {
    showToast('⚠️ No hay productos seleccionados');
    return;
  }

  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  const ref = getSession()?.nombre || 'Equipo Ventas';

  // Límite práctico aproximado: mensajes muy largos pueden no abrirse
  // completos (o fallar) al pasarlos como parámetro de la URL de WhatsApp.
  // No es un límite oficial exacto, pero por encima de esto conviene reducir.
  const WHATSAPP_SAFE_LIMIT = 3000;

  let text = buildWhatsAppFullText(products, fecha, ref);
  let usedCompact = false;

  if (text.length > WHATSAPP_SAFE_LIMIT) {
    const compactText = buildWhatsAppCompactText(products, fecha, ref);
    if (compactText.length > WHATSAPP_SAFE_LIMIT) {
      alert(
        `La selección es demasiado grande incluso en versión resumida ` +
        `(${compactText.length.toLocaleString('es-PE')} caracteres para ${products.length} producto(s)).\n\n` +
        `Reduce la cantidad de productos seleccionados para poder compartirlos por WhatsApp.`
      );
      return;
    }
    text = compactText;
    usedCompact = true;
  }

  // Se usa siempre el enlace directo de WhatsApp (wa.me) en vez de navigator.share():
  // el share nativo del sistema pasa el texto por el panel "Compartir" de Windows,
  // que corrompe los emojis antes de que lleguen a la app de destino.
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');

  if (usedCompact) {
    showToast('⚠️ Selección muy grande: se envió una versión resumida (modelo, código, cantidad y precio)');
  }
}

async function copySummary() {
  const products = allProducts.filter(p => selectedProducts.has(p.id));
  if (products.length === 0) {
    showToast('⚠️ No hay productos seleccionados');
    return;
  }

  const totalUnidades = products.reduce((sum, p) => sum + getQty(p), 0);

  let text = 'COTIZACION VASTEC\n';
  text += `Fecha: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}\n`;
  text += `Ref: ${getSession()?.nombre || 'Equipo Ventas'}\n`;
  text += `Items: ${products.length} (${totalUnidades} unidad(es))\n`;
  text += 'Precios de lista referenciales\n';
  text += '----------------------------------------\n\n';

  products.forEach((p, i) => {
    const qty = getQty(p);
    const subtotal = p.precio * qty;

    text += `${i + 1}. ${getCardTitle(p)} (Codigo: ${p.nroParte})\n`;
    text += buildItemSpecsSummary(p);
    // Siempre precio unitario (c/u) + total del item, sin importar la
    // cantidad, para un formato consistente en toda la selección.
    text += `   Cantidad: ${qty}\n`;
    text += `   Precio de lista (referencial): $${p.precio.toLocaleString('en-US')} USD (c/u)\n`;
    text += `   Total item: $${subtotal.toLocaleString('en-US')} USD\n`;

    text += i < products.length - 1 ? '   ....................................\n\n' : '\n';
  });

  text += '----------------------------------------\n';
  // Con un solo producto, el total coincide con su propio precio: se
  // muestra igual por claridad. Con varios, cada item ya trae su propio
  // total y no se suma un gran total al final (a pedido).
  if (products.length === 1) {
    const total = products[0].precio * getQty(products[0]);
    text += `TOTAL: $${total.toLocaleString('en-US')} USD\n`;
    text += '----------------------------------------\n';
  }
  text += 'Precios de lista referenciales. Consultar disponibilidad.\n';
  text += 'VASTEC - Soluciones Tecnologicas';

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      copyTextFallback(text);
    }
    showToast('📋 Resumen copiado al portapapeles');
  } catch (e) {
    copyTextFallback(text);
    showToast('📋 Resumen copiado al portapapeles');
  }
}

function copyTextFallback(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

// === FORMATTERS ===
function formatProcessor(proc) {
  if (!proc) return 'N/A';
  return proc.replace(/INTEL CORE /g, 'Core ').replace(/INTEL XEON /g, 'Xeon ').replace(/AMD RYZEN /g, 'Ryzen ');
}

function formatRAM(ram) {
  if (!ram) return 'N/A';
  return ram.replace('DDR5 4800 2400 MHz', 'DDR5-4800').replace('DDR4 3200 400 MHz', 'DDR4-3200').replace('DDR5 5600 MHz', 'DDR5-5600');
}

function formatStorage(storage) {
  if (!storage) return 'N/A';
  return storage;
}

// Nombres comerciales SOLO para resoluciones exactas conocidas. Si no
// coincide con ninguna, se muestra el ancho x alto real en vez de adivinar
// (antes se asumía "FHD" para cualquier pantalla, aunque fuera 2K/4K).
const KNOWN_RESOLUTIONS = [
  { w: 1280, h: 720, label: 'HD' },
  { w: 1366, h: 768, label: 'HD' },
  { w: 1920, h: 1080, label: 'FHD' },
  { w: 1920, h: 1200, label: 'WUXGA' },
  { w: 2560, h: 1080, label: 'FHD Ultrawide' },
  { w: 2560, h: 1440, label: 'QHD' },
  { w: 2560, h: 1600, label: 'WQXGA' },
  { w: 3440, h: 1440, label: 'UWQHD' },
  { w: 3840, h: 1600, label: '4K Ultrawide' },
  { w: 3840, h: 2160, label: '4K UHD' }
];

function formatScreen(screen) {
  if (!screen) return '';

  const sizeMatch = screen.match(/(\d+\.?\d*)\s*["']/) || screen.match(/(\d+\.?\d*)/);
  const size = sizeMatch ? sizeMatch[1] : null;

  const resMatch = screen.match(/(\d{3,4})\s*[xX]\s*(\d{3,4})/);
  let resLabel = '';
  if (resMatch) {
    const w = parseInt(resMatch[1], 10);
    const h = parseInt(resMatch[2], 10);
    const known = KNOWN_RESOLUTIONS.find(r => r.w === w && r.h === h);
    resLabel = known ? known.label : `${w}x${h}`;
  }

  if (size && resLabel) return `${size}" ${resLabel}`;
  if (size) return `${size}"`;
  return screen;
}

function formatOS(os) {
  if (!os) return 'N/A';
  if (os.includes('WINDOWS 11 PRO DE 64 BITS PARA WORKSTATION')) return 'Win 11 Pro Workstation';
  if (os.includes('WINDOWS 11 PRO')) return 'Win 11 Pro';
  if (os.includes('UBUNTU')) return 'Ubuntu Linux';
  return os;
}

function formatSoftware(sw) {
  if (!sw || sw === 'NO') return '';
  if (sw.includes('HOME & BUSINESS 2024')) return 'Office H&B 2024';
  if (sw.includes('HOME & BUSINESS 2021')) return 'Office H&B 2021';
  if (sw.includes('PROFESSIONAL 2021')) return 'Office Pro 2021';
  return sw;
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}