/**
 * OpenClass Live: rutas HTTP.
 * - Archivos estáticos: lista blanca cargada en memoria al arrancar desde public/ (sin recorrido de rutas).
 * - /join/CODIGO: misma página del estudiante con el código precargado.
 * - /qr/CODIGO.svg: QR del enlace de unión (solo contiene la URL pública con el código, nunca secretos).
 * - /api/docente/*: inicio y cierre de sesión docente (cookie HttpOnly + CSRF por cabecera).
 * - /healthz: comprobación de salud sin datos de las salas.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import qrcode from 'qrcode-generator';
import { COOKIE_DOCENTE, cookieDocente, leerCookies, verificarPassword } from './auth.mjs';
import { ipCliente } from './limites.mjs';
import { codigoSala } from './validar.mjs';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

export const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self'", "img-src 'self' data:", "connect-src 'self'",
  "font-src 'self'", "manifest-src 'self'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'",
].join('; ');

const SEGURIDAD = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

/** Carga public/ en memoria. Solo se admiten tipos de la lista: nada de imágenes ni Markdown institucional. */
export function cargarEstaticos(raiz) {
  const archivos = new Map();
  (function recorrer(dir) {
    for (const nombre of readdirSync(dir)) {
      const ruta = path.join(dir, nombre);
      if (statSync(ruta).isDirectory()) { recorrer(ruta); continue; }
      const tipo = TIPOS[path.extname(nombre).toLowerCase()];
      if (!tipo) throw new Error(`Tipo de archivo no admitido en public/: ${nombre}`);
      const url = `/${path.relative(raiz, ruta).split(path.sep).join('/')}`;
      archivos.set(url, { cuerpo: readFileSync(ruta), tipo });
    }
  })(raiz);
  return archivos;
}

/** SVG del QR construido a mano a partir de la matriz: un solo <path>, sin scripts. */
export function svgQr(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const m = 4;
  let d = '';
  for (let f = 0; f < n; f++) for (let c = 0; c < n; c++) if (qr.isDark(f, c)) d += `M${c + m} ${f + m}h1v1h-1z`;
  const t = n + m * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="Código QR para unirse a la sala"><rect width="${t}" height="${t}" fill="#fff"/><path fill="#000" d="${d}"/></svg>`;
}

function enviar(res, estado, cuerpo, tipo = 'application/json; charset=utf-8', extra = {}) {
  const datos = typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo);
  res.writeHead(estado, { ...SEGURIDAD, 'Content-Type': tipo, 'Cache-Control': 'no-store', ...extra });
  res.end(datos);
}

async function leerJson(req, limite = 2048) {
  const tipo = String(req.headers['content-type'] ?? '');
  if (!tipo.startsWith('application/json')) throw Object.assign(new Error('tipo'), { estado: 415 });
  let total = 0;
  const partes = [];
  for await (const parte of req) {
    total += parte.length;
    if (total > limite) throw Object.assign(new Error('grande'), { estado: 413 });
    partes.push(parte);
  }
  try { return JSON.parse(Buffer.concat(partes).toString('utf8') || '{}'); } catch { throw Object.assign(new Error('json'), { estado: 400 }); }
}

/** Sesión docente desde la cookie firmada; null si no hay, es inválida, venció o se revocó. */
export function sesionDesdeCookie(cabeceraCookie, { firmador, sesiones }) {
  const token = leerCookies(cabeceraCookie)[COOKIE_DOCENTE];
  const datos = token && firmador.verificar(token, 'docente');
  return datos && sesiones.valida(datos.sid) ? datos : null;
}

/** Peticiones de cambio de estado: mismo origen exacto (Origin o Sec-Fetch-Site) además del token CSRF. */
function mismoOrigen(req, appUrl) {
  const origen = req.headers.origin;
  if (origen) return origen === appUrl;
  return req.headers['sec-fetch-site'] === 'same-origin';
}

export function crearManejadorHttp({ config, estaticos, firmador, sesiones, limitadorLogin, limitadorLoginGlobal, log }) {
  const segundosSesion = config.sesionDocenteHoras * 3600;
  const pagina = (ruta) => estaticos.get(ruta);

  return async function manejar(req, res) {
    const url = new URL(req.url, 'http://local');
    const ruta = url.pathname;
    if (config.cookieSegura) res.setHeader('Strict-Transport-Security', 'max-age=15552000');
    try {
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (ruta === '/healthz') return enviar(res, 200, { estado: 'ok' });
        if (ruta === '/docente') return enviar(res, 301, '', 'text/plain', { Location: '/docente/' });

        const qr = /^\/qr\/([A-Za-z0-9]{6})\.svg$/.exec(ruta);
        if (qr) {
          let codigo;
          try { codigo = codigoSala(qr[1]); } catch { return enviar(res, 404, { error: 'no_encontrado' }); }
          // El QR se usa también desde la presentación local (otro origen): recurso de origen cruzado.
          return enviar(res, 200, svgQr(`${config.appUrl}/join/${codigo}`), 'image/svg+xml',
            { 'Cache-Control': 'public, max-age=600', 'Cross-Origin-Resource-Policy': 'cross-origin' });
        }

        if (/^\/join\/[A-Za-z0-9]{6}\/?$/.test(ruta)) return servirArchivo(res, pagina('/index.html'));
        if (ruta === '/') return servirArchivo(res, pagina('/index.html'));
        if (ruta === '/docente/') return servirArchivo(res, pagina('/docente/index.html'));

        if (ruta === '/api/docente/sesion') {
          const s = sesionDesdeCookie(req.headers.cookie, { firmador, sesiones });
          return enviar(res, 200, s ? { autenticado: true, csrf: firmador.csrf(s.sid) } : { autenticado: false });
        }

        const archivo = estaticos.get(ruta);
        if (archivo && ruta !== '/index.html' && ruta !== '/docente/index.html') return servirArchivo(res, archivo, true);
        return enviar(res, 404, { error: 'no_encontrado' });
      }

      if (req.method === 'POST' && ruta === '/api/docente/login') {
        if (!mismoOrigen(req, config.appUrl)) return enviar(res, 403, { error: 'origen' });
        const ip = ipCliente(req.headers, req.socket.remoteAddress, config.confiarProxy);
        if (!limitadorLogin.permitir(ip) || !limitadorLoginGlobal.permitir('global')) {
          log('login_limitado');
          return enviar(res, 429, { error: 'demasiados_intentos' }, undefined, { 'Retry-After': '60' });
        }
        const cuerpo = await leerJson(req);
        if (!verificarPassword(cuerpo?.password, config.hashDocente)) {
          log('login_fallido');
          return enviar(res, 401, { error: 'credenciales' });
        }
        limitadorLogin.olvidar(ip);
        const sid = sesiones.crear(segundosSesion);
        const token = firmador.firmar({ t: 'docente', sid }, segundosSesion);
        log('login_ok');
        return enviar(res, 200, { autenticado: true, csrf: firmador.csrf(sid) }, undefined,
          { 'Set-Cookie': cookieDocente(token, { segura: config.cookieSegura, segundos: segundosSesion }) });
      }

      if (req.method === 'POST' && ruta === '/api/docente/logout') {
        if (!mismoOrigen(req, config.appUrl)) return enviar(res, 403, { error: 'origen' });
        const s = sesionDesdeCookie(req.headers.cookie, { firmador, sesiones });
        if (s) {
          if (req.headers['x-oc-csrf'] !== firmador.csrf(s.sid)) return enviar(res, 403, { error: 'csrf' });
          sesiones.revocar(s.sid);
        }
        return enviar(res, 200, { autenticado: false }, undefined,
          { 'Set-Cookie': cookieDocente('', { segura: config.cookieSegura, segundos: 0 }) });
      }

      return enviar(res, req.method === 'POST' ? 404 : 405, { error: 'no_admitido' });
    } catch (error) {
      if (error.estado) return enviar(res, error.estado, { error: 'solicitud_invalida' });
      log('error_http', { tipo: error.name });
      return enviar(res, 500, { error: 'interno' });
    }
  };

  function servirArchivo(res, archivo, cache = false) {
    if (!archivo) return enviar(res, 404, { error: 'no_encontrado' });
    return enviar(res, 200, archivo.cuerpo, archivo.tipo, { 'Cache-Control': cache ? 'public, max-age=300' : 'no-store' });
  }
}
