// Requiere crypto.js cargado antes que este archivo
const AUTH_KEY = 'vastec_session';
const SESSION_DURATION = 90 * 24 * 60 * 60 * 1000; // 90 días

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
