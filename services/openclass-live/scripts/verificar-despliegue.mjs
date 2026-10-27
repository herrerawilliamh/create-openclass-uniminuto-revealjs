/**
 * OpenClass Live: pruebas HTTP y WebSocket contra un despliegue (local tras Traefik o producción).
 *   node scripts/verificar-despliegue.mjs https://openclass-live.apps.willedtech.io
 *   OCLIVE_INSEGURO=1 node scripts/verificar-despliegue.mjs https://openclass-live.localhost:8443   (certificado de prueba)
 * No necesita credenciales y no crea salas: comprueba salud, cabeceras, rutas que NO deben existir,
 * handshake Socket.IO por polling y por WebSocket (WSS) y los rechazos de autorización.
 * Con OCLIVE_PASSWORD (variable de entorno, nunca argumento) además inicia sesión, crea una sala,
 * une un estudiante por WSS, vota y finaliza la sala.
 */
import { io } from 'socket.io-client';

const base = (process.argv[2] ?? '').replace(/\/+$/, '');
if (!/^https?:\/\/[^/]+$/.test(base)) { console.error('Uso: node scripts/verificar-despliegue.mjs <APP_URL>'); process.exit(2); }
if (process.env.OCLIVE_INSEGURO === '1') process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

let fallos = 0;
const ok = (nombre, condicion, detalle = '') => {
  console.log(`${condicion ? 'PASS' : 'FAIL'}  ${nombre}${detalle ? ` — ${detalle}` : ''}`);
  if (!condicion) fallos++;
};
const pedir = (ruta, opciones = {}) => fetch(`${base}${ruta}`, { redirect: 'manual', signal: AbortSignal.timeout(15000), ...opciones });

function conectar(ns, opciones) {
  return new Promise((resolve) => {
    // engine.io-client fija rejectUnauthorized: true; solo se relaja con OCLIVE_INSEGURO (certificado de prueba).
    const s = io(`${base}${ns}`, { forceNew: true, reconnection: false, timeout: 10000, extraHeaders: { origin: base },
      rejectUnauthorized: process.env.OCLIVE_INSEGURO !== '1', ...opciones });
    const fin = (r) => { s.disconnect(); resolve(r); };
    s.on('connect', () => resolve({ s, transporte: s.io.engine.transport.name }));
    s.on('connect_error', (e) => fin({ error: e.message }));
  });
}

// ---------- HTTP ----------
const salud = await pedir('/healthz');
ok('GET /healthz 200', salud.status === 200);
ok('healthz sin datos de salas', JSON.stringify(await salud.json()) === '{"estado":"ok"}');
const inicio = await pedir('/');
const csp = inicio.headers.get('content-security-policy') ?? '';
ok('GET / 200 (vista estudiante)', inicio.status === 200);
ok('CSP estricta', csp.includes("script-src 'self'") && csp.includes("frame-ancestors 'none'"));
ok('nosniff y no-referrer', inicio.headers.get('x-content-type-options') === 'nosniff' && inicio.headers.get('referrer-policy') === 'no-referrer');
if (base.startsWith('https://')) ok('HSTS', /max-age=\d+/.test(inicio.headers.get('strict-transport-security') ?? ''));
ok('GET /docente/ 200', (await pedir('/docente/')).status === 200);
ok('GET /join/ABCDEF 200', (await pedir('/join/ABCDEF')).status === 200);
const qr = await pedir('/qr/ABCDEF.svg');
ok('QR SVG', qr.status === 200 && /image\/svg\+xml/.test(qr.headers.get('content-type') ?? ''));
ok('cliente Socket.IO servido', (await pedir('/socket.io/socket.io.min.js')).status === 200);
for (const ruta of ['/fondos/', '/imagenes/', '/slides.md', '/semanas/', '/vendor/', '/.env', '/package.json', '/src/server.mjs', '/index.html', '/docente/index.html']) {
  const r = await pedir(ruta);
  ok(`sin contenido en ${ruta}`, r.status === 404, String(r.status));
}
ok('sesión docente sin cookie: no autenticado', (await (await pedir('/api/docente/sesion')).json()).autenticado === false);
const origenAjeno = await pedir('/api/docente/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' }, body: '{"password":"x"}' });
ok('login desde otro origen: 403', origenAjeno.status === 403);

// ---------- Socket.IO: polling y WebSocket ----------
const poll = await conectar('/participante', { transports: ['polling'], auth: { codigo: 'ZZZZZZ' } });
ok('polling: handshake alcanzado y código inexistente rechazado', poll.error === 'sala_inexistente', poll.error);
const ws = await conectar('/participante', { transports: ['websocket'], auth: { codigo: 'ZZZZZZ' } });
ok(`${base.startsWith('https') ? 'WSS' : 'WS'}: handshake alcanzado y código inexistente rechazado`, ws.error === 'sala_inexistente', ws.error);
const doc = await conectar('/docente', { transports: ['websocket'] });
ok('docente sin credencial: rechazado', doc.error === 'no_autenticado', doc.error);
const ajeno = await conectar('/participante', { transports: ['websocket'], auth: { codigo: 'ZZZZZZ' }, extraHeaders: { origin: 'https://evil.example' } });
ok('WebSocket desde otro origen: rechazado', Boolean(ajeno.error) && ajeno.error !== 'sala_inexistente', ajeno.error);

// ---------- Flujo completo opcional (requiere la contraseña docente en OCLIVE_PASSWORD) ----------
if (process.env.OCLIVE_PASSWORD) {
  const login = await pedir('/api/docente/login', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ password: process.env.OCLIVE_PASSWORD }) });
  ok('login docente', login.status === 200);
  const galleta = (login.headers.get('set-cookie') ?? '').split(';')[0];
  ok('cookie HttpOnly; Secure; SameSite=Strict', /HttpOnly/.test(login.headers.get('set-cookie')) && /SameSite=Strict/.test(login.headers.get('set-cookie')) && (!base.startsWith('https') || /Secure/.test(login.headers.get('set-cookie'))));
  const d = await conectar('/docente', { transports: ['websocket'], extraHeaders: { origin: base, cookie: galleta } });
  ok('docente por WSS', Boolean(d.s), d.error);
  if (d.s) {
    const sala = await d.s.timeout(8000).emitWithAck('sala:crear', { titulo: 'Verificación de despliegue' });
    ok('sala creada', sala.ok);
    const e = await conectar('/participante', { transports: ['websocket'], auth: { codigo: sala.sala.codigo } });
    ok('estudiante por WSS', Boolean(e.s), e.error);
    const enc = await d.s.timeout(8000).emitWithAck('encuesta:crear', { salaId: sala.sala.id, abrir: true, encuesta: { enunciado: 'Prueba de despliegue', opciones: ['Sí', 'No'], correctas: [0] } });
    const voto = e.s ? await e.s.timeout(8000).emitWithAck('encuesta:responder', { encuestaId: enc.encuesta.id, ronda: 1, seleccion: [0] }) : { ok: false };
    ok('voto registrado', voto.ok);
    const est = await d.s.timeout(8000).emitWithAck('sala:seguir', { salaId: sala.sala.id });
    ok('resultado agregado en el servidor', est.estado.activa.rondas[0].respondientes === 1);
    ok('sala finalizada y datos eliminados', (await d.s.timeout(8000).emitWithAck('sala:finalizar', { salaId: sala.sala.id })).ok);
    e.s?.disconnect(); d.s.disconnect();
  }
}

console.log(fallos ? `\n${fallos} comprobación(es) fallida(s)` : '\nTodas las comprobaciones pasaron');
process.exit(fallos ? 1 : 0);
