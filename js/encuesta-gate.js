// ============================================
// ENCUESTA OBLIGATORIA (bloqueo antes de usar el catálogo)
// ============================================
// admin-local publica data/encuesta.json (plano, sin cifrar — no es
// información sensible) con la encuesta activa, o no publica ninguna
// ("encuesta.json" ausente o con "null") cuando no hay ninguna corriendo.
// Se guarda en localStorage qué encuesta (por id) ya respondió cada
// usuario (por session.nombre, ya que la sesión nunca guarda el código
// crudo — ver auth.js); si el admin publica una encuesta con id distinto,
// se vuelve a pedir. Las respuestas se envían directo a un correo vía
// formsubmit.co (AJAX, sin salir de la página) — no hay backend propio.
//
// Funciones puras (fáciles de probar sin DOM real) primero; el render del
// overlay y la recolección de respuestas del formulario van al final.

const ENCUESTA_COMPLETADAS_KEY = 'vastec_encuesta_completadas';

function leerEncuestasCompletadas() {
  try {
    return JSON.parse(localStorage.getItem(ENCUESTA_COMPLETADAS_KEY) || '{}');
  } catch (e) {
    return {};
  }
}

function debeMostrarEncuesta(encuesta, session) {
  if (!encuesta || !encuesta.id || !Array.isArray(encuesta.preguntas) || encuesta.preguntas.length === 0) return false;
  if (!session || !session.nombre) return false;
  const completadas = leerEncuestasCompletadas();
  return completadas[session.nombre] !== encuesta.id;
}

function marcarEncuestaCompletada(encuesta, session) {
  const completadas = leerEncuestasCompletadas();
  completadas[session.nombre] = encuesta.id;
  localStorage.setItem(ENCUESTA_COMPLETADAS_KEY, JSON.stringify(completadas));
}

// Todas las preguntas son obligatorias (ver admin-local/js/encuestas.js).
function validarRespuestasCompletas(encuesta, respuestas) {
  return encuesta.preguntas.every(p => {
    const val = respuestas[p.id];
    if (p.tipo === 'opcion_multiple') return Array.isArray(val) && val.length > 0;
    return val !== undefined && val !== null && String(val).trim() !== '';
  });
}

// Arma el cuerpo que espera formsubmit.co: campos de configuración con "_"
// (asunto, formato de tabla en el correo, desactivar el captcha para que
// el envío por AJAX no quede colgado esperando una verificación, y un
// honeypot vacío contra bots) + los datos propios de la encuesta. Cada
// pregunta se manda con su número y texto como clave, para que el correo
// se lea igual que la encuesta sin tener que cruzar ids a mano.
function construirPayloadFormsubmit(encuesta, respuestas, session) {
  const payload = {
    _subject: `Encuesta VASTEC: ${encuesta.titulo} — ${session.nombre}`,
    _template: 'table',
    _captcha: 'false',
    _honey: '',
    usuario: session.nombre,
    rol: session.rol || 'user',
    encuesta_id: encuesta.id,
    encuesta_titulo: encuesta.titulo,
    fecha: new Date().toISOString()
  };
  encuesta.preguntas.forEach((p, idx) => {
    const val = respuestas[p.id];
    payload[`P${idx + 1}. ${p.texto}`] = Array.isArray(val) ? val.join(', ') : (val || '');
  });
  return payload;
}

async function enviarEncuesta(encuesta, respuestas, session) {
  const payload = construirPayloadFormsubmit(encuesta, respuestas, session);
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(encuesta.emailDestino)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) return { ok: false, error: `El servidor respondió con un error (${res.status}). Intenta de nuevo.` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.' };
  }
}

// ============================================
// ORQUESTACIÓN + DOM
// ============================================
async function checkEncuestaGate(session) {
  let encuesta;
  try {
    const res = await fetch('data/encuesta.json');
    if (!res.ok) return;
    encuesta = await res.json();
  } catch (e) {
    return; // sin encuesta.json publicado (o error de red): no bloquear el catálogo por esto
  }

  if (!debeMostrarEncuesta(encuesta, session)) return;
  renderEncuestaOverlay(encuesta, session);
}

function recolectarRespuestasDelForm(encuesta, overlay) {
  const respuestas = {};
  encuesta.preguntas.forEach(p => {
    const inputs = Array.from(overlay.querySelectorAll(`[data-pregunta-id="${p.id}"]`));
    if (p.tipo === 'texto') {
      respuestas[p.id] = (inputs[0]?.value || '').trim();
    } else if (p.tipo === 'opcion_unica' || p.tipo === 'escala') {
      const checked = inputs.find(i => i.checked);
      respuestas[p.id] = checked ? checked.value : '';
    } else if (p.tipo === 'opcion_multiple') {
      respuestas[p.id] = inputs.filter(i => i.checked).map(i => i.value);
    }
  });
  return respuestas;
}

function crearBloquePregunta(p, idx) {
  const bloque = document.createElement('div');
  bloque.className = 'encuesta-pregunta';

  const label = document.createElement('p');
  label.className = 'encuesta-pregunta-texto';
  label.textContent = `${idx + 1}. ${p.texto}`;
  bloque.appendChild(label);

  if (p.tipo === 'texto') {
    const textarea = document.createElement('textarea');
    textarea.className = 'encuesta-input-texto';
    textarea.rows = 2;
    textarea.dataset.preguntaId = p.id;
    bloque.appendChild(textarea);
  } else if (p.tipo === 'opcion_unica' || p.tipo === 'opcion_multiple') {
    const lista = document.createElement('div');
    lista.className = 'encuesta-opciones';
    (p.opciones || []).forEach((opcion, i) => {
      const item = document.createElement('label');
      item.className = 'encuesta-opcion-item';
      const input = document.createElement('input');
      input.type = p.tipo === 'opcion_unica' ? 'radio' : 'checkbox';
      input.name = `pregunta_${p.id}`;
      input.value = opcion;
      input.dataset.preguntaId = p.id;
      const span = document.createElement('span');
      span.textContent = opcion;
      item.appendChild(input);
      item.appendChild(span);
      lista.appendChild(item);
    });
    bloque.appendChild(lista);
  } else if (p.tipo === 'escala') {
    const escala = document.createElement('div');
    escala.className = 'encuesta-escala';
    for (let n = 1; n <= 5; n++) {
      const item = document.createElement('label');
      item.className = 'encuesta-escala-item';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `pregunta_${p.id}`;
      input.value = String(n);
      input.dataset.preguntaId = p.id;
      const span = document.createElement('span');
      span.textContent = String(n);
      item.appendChild(input);
      item.appendChild(span);
      escala.appendChild(item);
    }
    bloque.appendChild(escala);
  }

  return bloque;
}

function renderEncuestaOverlay(encuesta, session) {
  const overlay = document.getElementById('encuesta-gate-overlay');
  if (!overlay) return;
  overlay.innerHTML = '';

  const modal = document.createElement('div');
  modal.className = 'encuesta-gate-modal';

  const titulo = document.createElement('h2');
  titulo.textContent = encuesta.titulo;
  modal.appendChild(titulo);

  if (encuesta.descripcion) {
    const desc = document.createElement('p');
    desc.className = 'encuesta-gate-descripcion';
    desc.textContent = encuesta.descripcion;
    modal.appendChild(desc);
  }

  const hint = document.createElement('p');
  hint.className = 'encuesta-gate-hint';
  hint.textContent = 'Encuesta obligatoria — respóndela para poder ver el catálogo. Solo te la pediremos de nuevo si publicamos una nueva.';
  modal.appendChild(hint);

  const form = document.createElement('form');
  encuesta.preguntas.forEach((p, idx) => form.appendChild(crearBloquePregunta(p, idx)));

  const errorEl = document.createElement('div');
  errorEl.className = 'encuesta-gate-error';
  errorEl.style.display = 'none';
  form.appendChild(errorEl);

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary encuesta-gate-submit';
  submitBtn.textContent = 'Enviar y continuar';
  form.appendChild(submitBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const respuestas = recolectarRespuestasDelForm(encuesta, overlay);

    if (!validarRespuestasCompletas(encuesta, respuestas)) {
      errorEl.textContent = 'Por favor responde todas las preguntas antes de enviar.';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    const resultado = await enviarEncuesta(encuesta, respuestas, session);
    if (resultado.ok) {
      marcarEncuestaCompletada(encuesta, session);
      overlay.classList.remove('show');
      overlay.innerHTML = '';
      document.body.style.overflow = '';
    } else {
      errorEl.textContent = resultado.error;
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar y continuar';
    }
  });

  modal.appendChild(form);
  overlay.appendChild(modal);
  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';
}
