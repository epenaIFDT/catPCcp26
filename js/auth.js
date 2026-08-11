// Requiere crypto.js cargado antes que este archivo
const AUTH_KEY = 'vastec_session';
const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 días

// Códigos temporales de uso limitado (usosMaximos en keys.enc.json, ver
// admin-local/js/codes.js): el contador vive en localStorage de ESTE
// navegador, no en un servidor — no existe forma de contar usos de verdad
// entre distintos dispositivos sin backend propio. Suficiente para el caso
// de uso real (un código de demo que se agota en el mismo navegador), pero
// alguien con herramientas de desarrollador podría resetear su propio
// contador borrando el almacenamiento local.
const CODE_USAGE_KEY = 'vastec_uso_codigos';

function leerUsosCodigos() {
  try { return JSON.parse(localStorage.getItem(CODE_USAGE_KEY) || '{}'); }
  catch (e) { return {}; }
}

function registrarUsoCodigo(lookupHash) {
  const usos = leerUsosCodigos();
  usos[lookupHash] = (usos[lookupHash] || 0) + 1;
  localStorage.setItem(CODE_USAGE_KEY, JSON.stringify(usos));
}

async function validateCode(code) {
  const keysRes = await fetch('data/keys.enc.json');
  if (!keysRes.ok) throw new Error('No se pudo cargar la lista de accesos.');
  const keysMap = await keysRes.json();

  const lookupHash = await deriveLookupHash(code);
  const entry = keysMap[lookupHash];
  if (!entry) return null;

  let dataKey;
  try {
    const kek = await deriveKekFromCode(code, entry.salt);
    dataKey = await unwrapDataKey(entry.iv, entry.wrappedKey, kek);
  } catch (e) {
    // Tag de autenticación inválido: el código no coincide con esta entrada
    return null;
  }

  // Verificación adicional: confirmar que la DataKey realmente abre el catálogo
  try {
    const prodRes = await fetch('data/productos.enc.json');
    const prodPackage = await prodRes.json();
    await decryptJSON(prodPackage.iv, prodPackage.data, dataKey);
  } catch (e) {
    return null;
  }

  // El código es válido — recién ahora, si tiene límite de usos, se
  // comprueba/descuenta (nunca antes de confirmar que el código es
  // genuino, para no gastar usos con intentos fallidos).
  if (entry.usosMaximos) {
    const usos = leerUsosCodigos();
    const usados = usos[lookupHash] || 0;
    if (usados >= entry.usosMaximos) {
      throw Object.assign(
        new Error('Este código alcanzó su límite de usos en este dispositivo. Contacta al administrador.'),
        { code: 'USAGE_LIMIT_REACHED' }
      );
    }
    registrarUsoCodigo(lookupHash);
  }

  const session = {
    nombre: entry.nombre,
    rol: entry.rol || 'user',
    dkBase64: await exportKeyBase64(dataKey),
    expires: Date.now() + SESSION_DURATION
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
  return session;
}

function getSession() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    if (!session || !session.expires || Date.now() > session.expires) {
      localStorage.removeItem(AUTH_KEY);
      return null;
    }
    return session;
  } catch (e) {
    localStorage.removeItem(AUTH_KEY);
    return null;
  }
}

// Clave AES lista para desencriptar productos.enc.json, o null si no hay sesión
async function getSessionDataKey() {
  const session = getSession();
  if (!session) return null;
  return importKeyBase64(session.dkBase64);
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.href = 'index.html';
}

function requireAuth() {
  const session = getSession();
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  return session;
}
