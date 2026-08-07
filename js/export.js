function shareWhatsApp() {
  const products = allProducts.filter(p => selectedProducts.has(p.id));
  if (products.length === 0) {
    showToast('⚠️ No hay productos seleccionados');
    return;
  }

  const fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
  const ref = getSession()?.nombre || 'Equipo Ventas';

  let text = `Hola, te comparto la cotización VASTEC del ${fecha}:\n\n`;

  products.forEach((p, i) => {
    text += `*${i + 1}. ${p.marca} ${p.modelo}*\n`;
    text += `Código: ${p.nroParte}\n`;
    text += `• Procesador: ${formatProcessor(p.specs.procesador)}\n`;
    text += `• RAM: ${formatRAM(p.specs.ram)}\n`;
    text += `• Almacenamiento: ${formatStorage(p.specs.almacenamiento)}\n`;

    if (p.specs.pantalla) {
      text += `• Pantalla: ${formatScreen(p.specs.pantalla)}\n`;
    }

    text += `• Sistema operativo: ${formatOS(p.specs.sistemaOperativo)}\n`;

    if (p.specs.software && p.specs.software !== 'NO') {
      text += `• Office: ${formatSoftware(p.specs.software)}\n`;
    }

    if (p.specs.tarjetaVideo && p.specs.tarjetaVideo !== 'Gráficos Integrados' && p.specs.tarjetaVideo !== 'INTEGRADO') {
      text += `• Tarjeta de video: ${p.specs.tarjetaVideo}\n`;
    }

    if (p.specs.case) {
      text += `• Gabinete: ${p.specs.case}\n`;
    }

    if (p.specs.fuente) {
      text += `• Fuente de poder: ${p.specs.fuente}\n`;
    }

    if (p.specs.chipset) {
      text += `• Chipset: ${p.specs.chipset}\n`;
    }

    text += `• Garantía: ${p.specs.garantia}\n`;
    text += `Precio: *$${p.precio.toLocaleString('en-US')} USD*\n\n`;
  });

  const total = products.reduce((sum, p) => sum + p.precio, 0);
  const plural = products.length === 1 ? 'equipo' : 'equipos';
  text += `*Total: $${total.toLocaleString('en-US')} USD* (${products.length} ${plural})\n\n`;
  text += `_Precios de referencia, sujetos a disponibilidad._\n`;
  text += `Cotizado por: ${ref}\n`;
  text += `VASTEC - Soluciones Tecnológicas`;

  // Se usa siempre el enlace directo de WhatsApp (wa.me) en vez de navigator.share():
  // el share nativo del sistema pasa el texto por el panel "Compartir" de Windows,
  // que corrompe los emojis antes de que lleguen a la app de destino.
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, '_blank');
}

async function copySummary() {
  const products = allProducts.filter(p => selectedProducts.has(p.id));
  if (products.length === 0) {
    showToast('⚠️ No hay productos seleccionados');
    return;
  }

  let text = 'COTIZACION VASTEC\n';
  text += `Fecha: ${new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })}\n`;
  text += `Ref: ${getSession()?.nombre || 'Equipo Ventas'}\n`;
  text += `Items: ${products.length}\n`;
  text += '----------------------------------------\n\n';

  products.forEach((p, i) => {
    text += `${i + 1}. ${p.marca} ${p.modelo}\n`;
    text += `   Codigo: ${p.nroParte}\n`;
    text += `   CPU: ${formatProcessor(p.specs.procesador)}\n`;
    text += `   RAM: ${formatRAM(p.specs.ram)}\n`;
    text += `   Disco: ${formatStorage(p.specs.almacenamiento)}\n`;

    if (p.specs.pantalla) {
      text += `   Pantalla: ${formatScreen(p.specs.pantalla)}\n`;
    }

    text += `   SO: ${formatOS(p.specs.sistemaOperativo)}\n`;

    if (p.specs.software && p.specs.software !== 'NO') {
      text += `   Office: ${formatSoftware(p.specs.software)}\n`;
    }

    if (p.specs.tarjetaVideo && p.specs.tarjetaVideo !== 'Gráficos Integrados' && p.specs.tarjetaVideo !== 'INTEGRADO') {
      text += `   GPU: ${p.specs.tarjetaVideo}\n`;
    }

    if (p.specs.case) {
      text += `   Gabinete: ${p.specs.case}\n`;
    }

    if (p.specs.fuente) {
      text += `   Fuente de poder: ${p.specs.fuente}\n`;
    }

    if (p.specs.chipset) {
      text += `   Chipset: ${p.specs.chipset}\n`;
    }

    text += `   Garantia: ${p.specs.garantia}\n`;
    text += `   Precio: $${p.precio.toLocaleString('en-US')} USD\n\n`;
  });

  const total = products.reduce((sum, p) => sum + p.precio, 0);
  text += '----------------------------------------\n';
  text += `TOTAL: $${total.toLocaleString('en-US')} USD\n`;
  text += `${products.length} equipo(s)\n`;
  text += '----------------------------------------\n';
  text += 'Precios de referencia. Consultar disponibilidad.\n';
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

function formatScreen(screen) {
  if (!screen) return '';
  const match = screen.match(/(\d+\.?\d*)/);
  if (match) return `${match[1]}" FHD`;
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