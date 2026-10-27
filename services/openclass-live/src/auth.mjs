/**
 * OpenClass Live: autenticación docente.
 * - Contraseña: hash scrypt (`scrypt$N$r$p$sal$hash`), nunca texto plano.
 * - Tokens firmados con HMAC-SHA256 y expiración: `docente` (cookie del panel, revocable por sid)
 *   y `presentador` (ligado a una sala y a su versión de clave; lo usa el adaptador Reveal.js local).
 * - CSRF: token derivado del sid de la sesión, exigido en la cabecera X-OC-CSRF de cada POST.
 */
import { scryptSync, randomBytes, timingSafeEqual, createHmac, hkdfSync } from 'node:crypto';

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const SCRYPT = { N: 32768, r: 8, p: 1 };
const memoria = (N, r) => 256 * N * r;

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
  const sal = randomBytes(16);
  const { N, r, p } = SCRYPT;
  const hash = scryptSync(password.normalize('NFKC'), sal, 32, { N, r, p, maxmem: memoria(N, r) });
  return `scrypt$${N}$${r}$${p}$${b64(sal)}$${b64(hash)}`;
}

export function verificarPassword(password, almacenado) {
  if (typeof password !== 'string' || password.length === 0 || password.length > 256) return false;
  const [tipo, n, r, p, sal, hash] = String(almacenado).split('$');
  if (tipo !== 'scrypt') return false;
  const N = Number(n), R = Number(r), P = Number(p);
  const esperado = Buffer.from(hash, 'base64url');
  const calculado = scryptSync(password.normalize('NFKC'), Buffer.from(sal, 'base64url'), esperado.length,
    { N, r: R, p: P, maxmem: memoria(N, R) });
  return timingSafeEqual(esperado, calculado);
}

export function crearFirmador(secreto) {
  const clave = Buffer.from(hkdfSync('sha256', secreto, 'openclass-live', 'tokens-v1', 32));
  const mac = (texto) => createHmac('sha256', clave).update(texto).digest('base64url');

  return {
    firmar(datos, segundos) {
      const cuerpo = b64(JSON.stringify({ ...datos, exp: Math.floor(Date.now() / 1000) + segundos }));
      return `${cuerpo}.${mac(cuerpo)}`;
    },
    /** Devuelve los datos si la firma es válida, el tipo coincide y no ha vencido; si no, null. */
    verificar(token, tipo) {
      if (typeof token !== 'string' || token.length > 1024) return null;
      const [cuerpo, firma, extra] = token.split('.');
      if (!cuerpo || !firma || extra !== undefined) return null;
      const a = Buffer.from(firma), b = Buffer.from(mac(cuerpo));
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
      let datos;
      try { datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')); } catch { return null; }
      if (datos?.t !== tipo || !Number.isFinite(datos.exp) || datos.exp * 1000 <= Date.now()) return null;
      return datos;
    },
    csrf: (sid) => mac(`csrf:${sid}`),
  };
}

/** Sesiones docentes vivas: permite cerrar sesión (revocar) antes del vencimiento del token. */
export function crearSesiones() {
  const vivas = new Map();
  return {
    crear(segundos) {
      const sid = b64(randomBytes(18));
      vivas.set(sid, Date.now() + segundos * 1000);
      return sid;
    },
    valida(sid) {
      const vence = vivas.get(sid);
      if (!vence) return false;
      if (vence <= Date.now()) { vivas.delete(sid); return false; }
      return true;
    },
    revocar: (sid) => vivas.delete(sid),
    purgar() { for (const [sid, vence] of vivas) if (vence <= Date.now()) vivas.delete(sid); },
  };
}

export const COOKIE_DOCENTE = 'oclive_docente';

export function leerCookies(cabecera) {
  const salida = {};
  for (const parte of String(cabecera ?? '').split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) salida[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  return salida;
}

export function cookieDocente(valor, { segura, segundos }) {
  return [`${COOKIE_DOCENTE}=${valor}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${segundos}`,
    ...(segura ? ['Secure'] : [])].join('; ');
}
