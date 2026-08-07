// ============================================
// CRYPTO.JS - Envelope encryption con Web Crypto API
// Usado tanto por el catálogo público (js/auth.js) como
// por admin-local/js/publish.js. Mantener sincronizados.
// ============================================

// Salt fijo de la app SOLO para el paso de "lookup" (encontrar la entrada
// del código en keys.enc.json en O(1) sin probar contra todas).
// La clave real de cada código (KEK) usa un salt aleatorio propio (ver abajo),
// así que este valor fijo no debilita el cifrado, solo indexa.
const LOOKUP_SALT = 'vastec-lookup-v1';
const LOOKUP_ITERATIONS = 100000;
const KEK_ITERATIONS = 210000;
const PBKDF2_HASH = 'SHA-256';

function strToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToStr(bytes) {
  return new TextDecoder().decode(bytes);
}

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomSaltBase64(len = 16) {
  return bufToBase64(crypto.getRandomValues(new Uint8Array(len)));
}

async function importCodeKeyMaterial(code) {
  return crypto.subtle.importKey('raw', strToBytes(code), 'PBKDF2', false, ['deriveBits']);
}

async function pbkdf2Bits(code, saltBytes, iterations, bitsLength = 256) {
  const keyMaterial = await importCodeKeyMaterial(code);
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations, hash: PBKDF2_HASH },
    keyMaterial,
    bitsLength
  );
}

// Índice O(1) para ubicar la entrada de un código en keys.enc.json
async function deriveLookupHash(code) {
  const bits = await pbkdf2Bits(code, strToBytes(LOOKUP_SALT), LOOKUP_ITERATIONS, 256);
  return bufToHex(bits);
}

// Clave que envuelve/desenvuelve la DataKey para un código específico.
// saltB64 es el salt aleatorio propio de esa entrada (guardado en keys.enc.json).
async function deriveKekFromCode(code, saltB64) {
  const saltBytes = new Uint8Array(base64ToBuf(saltB64));
  const bits = await pbkdf2Bits(code, saltBytes, KEK_ITERATIONS, 256);
  return crypto.subtle.importKey('raw', bits, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function generateDataKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportKeyBase64(key) {
  return bufToBase64(await crypto.subtle.exportKey('raw', key));
}

async function importKeyBase64(b64) {
  return crypto.subtle.importKey('raw', base64ToBuf(b64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function aesEncryptBytes(key, plainBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plainBytes);
  return { iv: bufToBase64(iv), data: bufToBase64(ciphertext) };
}

async function aesDecryptBytes(key, ivB64, dataB64) {
  const iv = new Uint8Array(base64ToBuf(ivB64));
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBuf(dataB64));
  return new Uint8Array(plainBuf);
}

async function encryptJSON(obj, key) {
  return aesEncryptBytes(key, strToBytes(JSON.stringify(obj)));
}

async function decryptJSON(ivB64, dataB64, key) {
  const bytes = await aesDecryptBytes(key, ivB64, dataB64);
  return JSON.parse(bytesToStr(bytes));
}

// Envuelve la DataKey (AES) usando la KEK derivada de un código
async function wrapDataKey(dataKey, kekKey) {
  const raw = await crypto.subtle.exportKey('raw', dataKey);
  return aesEncryptBytes(kekKey, new Uint8Array(raw));
}

// Desenvuelve: si el código no coincide, el tag GCM falla y esto lanza excepción.
// extractable=true porque auth.js necesita exportarla (exportKeyBase64) para
// guardarla en la sesión y evitar repetir PBKDF2 en cada carga de página.
async function unwrapDataKey(ivB64, wrappedB64, kekKey) {
  const raw = await aesDecryptBytes(kekKey, ivB64, wrappedB64);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}
