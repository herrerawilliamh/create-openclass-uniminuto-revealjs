/** OpenClass Live: utilidades de prueba (servidor real en un puerto libre + clientes Socket.IO). */
import http from 'node:http';
import { io as cliente } from 'socket.io-client';
import { crearApp } from '../src/app.mjs';
import { hashPassword } from '../src/auth.mjs';
import { leerConfig } from '../src/config.mjs';

export const PASSWORD = 'clave-de-prueba-docente-2026';
export const ORIGEN = 'http://oclive.test';
export const PRESENTADOR = 'http://localhost:8613';
const HASH = hashPassword(PASSWORD);

export async function iniciar({ env = {}, ahora } = {}) {
  const lineas = [];
  const config = leerConfig({
    APP_URL: ORIGEN, SESSION_SECRET: 'p'.repeat(24) + Math.random().toString(36).repeat(3), ADMIN_PASSWORD_HASH: HASH,
    PRESENTER_ORIGINS: PRESENTADOR, TRUST_PROXY: 'true', MAX_ROOM_PARTICIPANTS: '200', ...env,
  });
  const app = crearApp(config, { log: (evento, datos = {}) => lineas.push(JSON.stringify({ evento, ...datos })), ahora });
  const { port } = await app.escuchar(0, '127.0.0.1');
  const base = `http://127.0.0.1:${port}`;
  const abiertos = new Set();

  const conectar = (ns, opciones = {}) => {
    const { origen = ORIGEN, cabeceras = {}, ...resto } = opciones;
    const s = cliente(`${base}${ns}`, {
      forceNew: true, reconnection: false, transports: ['websocket'],
      extraHeaders: { ...(origen ? { origin: origen } : {}), ...cabeceras }, ...resto,
    });
    abiertos.add(s);
    return s;
  };

  return {
    app, base, config, lineas,
    peticion: (ruta, o) => peticion(`${base}${ruta}`, o),
    async login() {
      const r = await peticion(`${base}/api/docente/login`, { metodo: 'POST', cuerpo: { password: PASSWORD } });
      if (r.estado !== 200) throw new Error(`login ${r.estado}`);
      return { cookie: r.cabeceras['set-cookie'][0].split(';')[0], csrf: r.json.csrf };
    },
    async docente(cookie, opciones = {}) {
      const s = conectar('/docente', { ...opciones, cabeceras: { cookie, ...(opciones.cabeceras ?? {}) } });
      const sesion = await evento(s, 'sesion');
      return { s, sesion };
    },
    async presentador(clave, opciones = {}) {
      const s = conectar('/docente', { origen: PRESENTADOR, auth: { clave }, ...opciones });
      const sesion = await evento(s, 'sesion');
      return { s, sesion };
    },
    async estudiante(codigo, { alias = '', token = null, ...opciones } = {}) {
      const s = conectar('/participante', { auth: { codigo, alias, token }, ...opciones });
      const sesion = await evento(s, 'sesion');
      return { s, sesion };
    },
    conectar,
    async cerrar() { for (const s of abiertos) s.disconnect(); await app.cerrar(); },
  };
}

export function evento(socket, nombre, { timeout = 4000, filtro = () => true } = {}) {
  return new Promise((resolve, reject) => {
    const reloj = setTimeout(() => { limpiar(); reject(new Error(`Sin evento ${nombre}`)); }, timeout);
    const ok = (datos) => { if (!filtro(datos)) return; limpiar(); resolve(datos); };
    const error = (e) => { limpiar(); reject(Object.assign(new Error(`connect_error: ${e.message}`), { codigo: e.message })); };
    const limpiar = () => { clearTimeout(reloj); socket.off(nombre, ok); socket.off('connect_error', error); };
    socket.on(nombre, ok);
    if (nombre !== 'connect_error') socket.on('connect_error', error);
  });
}

export const rechazo = (socket) => evento(socket, 'connect_error').then((e) => e.message);

export const pedir = (socket, nombre, datos = {}, timeout = 4000) => socket.timeout(timeout).emitWithAck(nombre, datos);

export const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function peticion(url, { metodo = 'GET', cuerpo, origen = ORIGEN, cabeceras = {}, tipo = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const datos = cuerpo === undefined ? null : (typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo));
    const req = http.request(url, {
      method: metodo,
      headers: { ...(origen ? { origin: origen } : {}), ...(datos ? { 'content-type': tipo, 'content-length': Buffer.byteLength(datos) } : {}), ...cabeceras },
    }, (res) => {
      const partes = [];
      res.on('data', (p) => partes.push(p));
      res.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let json = null;
        try { json = JSON.parse(texto); } catch { /* no JSON */ }
        resolve({ estado: res.statusCode, cabeceras: res.headers, texto, json });
      });
    });
    req.on('error', reject);
    if (datos) req.write(datos);
    req.end();
  });
}
