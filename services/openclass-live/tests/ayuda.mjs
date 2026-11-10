/**
 * OpenClass Live: utilidades de prueba (servidor real en un puerto libre + clientes Socket.IO + PostgreSQL REAL).
 * Cada `iniciar()` usa un esquema propio (t_<pid>_<azar>) en el servidor de INTERACT_TEST_DATABASE_URL y lo borra
 * al cerrar: las pruebas no comparten datos ni dependen del orden. No hay base simulada ni en memoria.
 */
import { randomBytes } from 'node:crypto';
import http from 'node:http';
import pg from 'pg';
import { io as cliente } from 'socket.io-client';
import { crearApp } from '../src/app.mjs';
import { hashPassword } from '../src/auth.mjs';
import { leerConfig } from '../src/config.mjs';
import { PROTOCOLO } from '../src/protocolo.mjs';

export const PASSWORD = 'clave-de-prueba-docente-2026';
export const ORIGEN = 'http://oclive.test';
export const PRESENTADOR = 'http://localhost:8613';
/** Lo que declara un adaptador v0.2 en el handshake (template/src/plugins/live.mjs). */
export const V2 = { protocolo: PROTOCOLO.version, capacidades: [...PROTOCOLO.capacidades] };
const HASH = hashPassword(PASSWORD);

/** URL del PostgreSQL de pruebas (servicio aislado: Compose de pruebas o servicio de CI). */
export function urlPrueba() {
  const url = process.env.INTERACT_TEST_DATABASE_URL;
  if (!url) throw new Error('Las pruebas usan PostgreSQL real: defina INTERACT_TEST_DATABASE_URL (ver docs/POSTGRESQL.md, «Pruebas»).');
  return url;
}
export const nuevoEsquema = () => `t_${process.pid}_${randomBytes(5).toString('hex')}`;
/** Cliente directo (fuera de la aplicación) para inspeccionar o preparar un esquema de prueba. */
export async function conCliente(esquema, fn) {
  const c = new pg.Client({ connectionString: urlPrueba(), options: esquema ? `-c search_path=${esquema}` : undefined });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}
export const borrarEsquema = (esquema) => conCliente(null, (c) => c.query(`DROP SCHEMA IF EXISTS ${esquema} CASCADE`));

/** Variables de entorno de base para pruebas que montan su propia configuración (e2e): un esquema nuevo cada vez. */
export const entornoPg = () => ({ DATABASE_URL: urlPrueba(), DB_SCHEMA: nuevoEsquema(), DB_POOL_MAX: '5' });
/** crearApp + borrado de su esquema al cerrar. */
export async function crearAppPrueba(config, opciones) {
  const app = await crearApp(config, opciones);
  const cerrar = app.cerrar;
  app.cerrar = async () => { await cerrar(); if (config.db.esquema) await borrarEsquema(config.db.esquema); };
  return app;
}

export async function iniciar({ env = {}, ahora, barridoMs, esquema = nuevoEsquema(), conservarEsquema = false } = {}) {
  const lineas = [];
  const config = leerConfig({
    APP_URL: ORIGEN, SESSION_SECRET: 'p'.repeat(24) + Math.random().toString(36).repeat(3), ADMIN_PASSWORD_HASH: HASH,
    PRESENTER_ORIGINS: PRESENTADOR, TRUST_PROXY: 'true', MAX_ROOM_PARTICIPANTS: '200',
    DATABASE_URL: urlPrueba(), DB_SCHEMA: esquema, DB_POOL_MAX: '5', ...env,
  });
  let app;
  try {
    app = await crearApp(config, { log: (evento, datos = {}) => lineas.push(JSON.stringify({ evento, ...datos })), ahora, intervaloSesionesMs: barridoMs });
  } catch (error) {
    if (!conservarEsquema) await borrarEsquema(esquema).catch(() => {});
    throw error;
  }
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
    app, base, config, lineas, esquema,
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
      const s = conectar('/docente', { origen: PRESENTADOR, auth: { clave, ...V2 }, ...opciones });
      const sesion = await evento(s, 'sesion');
      return { s, sesion };
    },
    async estudiante(codigo, { alias = '', token = null, ...opciones } = {}) {
      const s = conectar('/participante', { auth: { codigo, alias, token }, ...opciones });
      const sesion = await evento(s, 'sesion');
      return { s, sesion };
    },
    conectar,
    async cerrar() {
      for (const s of abiertos) s.disconnect();
      await app.cerrar();
      if (!conservarEsquema) await borrarEsquema(esquema);
    },
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
