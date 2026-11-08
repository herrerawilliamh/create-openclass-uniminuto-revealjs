/**
 * H02 (auditoría I6): un panel docente con la sesión cerrada o vencida no debe seguir recibiendo
 * estado por Socket.IO. La protección es del servidor: la conexión se corta y sale de sus salas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, evento, rechazo, pedir, esperar, V2, PRESENTADOR } from './ayuda.mjs';

const ENCUESTA = { enunciado: '¿Qué agrupa sockets?', tipo: 'unica', opciones: ['Namespace', 'Room', 'Adapter'] };

async function preparar(t) {
  const srv = await iniciar();
  t.after(() => srv.cerrar());
  const { cookie, csrf } = await srv.login();
  const { s: doc } = await srv.docente(cookie);
  const r = await pedir(doc, 'sala:crear', { titulo: 'H02', preModeracion: false });
  assert.equal(r.ok, true, r.mensaje);
  return { srv, doc, cookie, csrf, sala: r.sala, clave: r.clave };
}

const logout = (srv, cookie, csrf) =>
  srv.peticion('/api/docente/logout', { metodo: 'POST', cuerpo: {}, cabeceras: { cookie, 'x-oc-csrf': csrf } });

/** Cuenta los `estado` que llegan a un socket durante `ms`. */
function contarEstados(socket, ms) {
  let n = 0;
  const f = () => { n++; };
  socket.on('estado', f);
  return esperar(ms).then(() => { socket.off('estado', f); return n; });
}

test('H02 logout en la misma pestaña: el socket se corta y no recibe más estado', async (t) => {
  const { srv, doc, sala, cookie, csrf } = await preparar(t);
  await pedir(doc, 'sala:seguir', { salaId: sala.id });
  const cerrado = evento(doc, 'disconnect');
  assert.equal((await logout(srv, cookie, csrf)).estado, 200);
  await cerrado;
  assert.equal(doc.connected, false);
});

test('H02 logout desde otra pestaña de la misma sesión: la pestaña pasiva deja de recibir difusiones', async (t) => {
  const { srv, doc, sala, cookie, csrf } = await preparar(t);
  const { s: pestanaB } = await srv.docente(cookie);
  await pedir(pestanaB, 'sala:seguir', { salaId: sala.id });
  await pedir(doc, 'sala:seguir', { salaId: sala.id });
  const cerradoB = evento(pestanaB, 'disconnect');
  await logout(srv, cookie, csrf);
  await cerradoB;
  assert.equal(pestanaB.connected, false);
  assert.equal(doc.connected, false);
});

test('H02 difusión posterior a la invalidación: ningún estado (preguntas, soluciones) llega al socket revocado', async (t) => {
  const { srv, doc, sala, cookie, csrf } = await preparar(t);
  const { s: pestanaB } = await srv.docente(cookie);
  await pedir(pestanaB, 'sala:seguir', { salaId: sala.id });
  const recibidos = [];
  pestanaB.onAny((nombre, ...a) => { if (nombre !== 'disconnect') recibidos.push(nombre); });
  const cerrado = evento(pestanaB, 'disconnect');
  await logout(srv, cookie, csrf);
  await cerrado;
  recibidos.length = 0;
  // Actividad posterior: un estudiante entra y pregunta, y se difunde estado a la sala.
  const { s: est } = await srv.estudiante(sala.codigo, { alias: 'Ana' });
  est.emit('pregunta:enviar', { texto: 'Pregunta posterior al logout' }, () => {});
  assert.equal(await contarEstados(pestanaB, 600), 0);
  assert.deepEqual(recibidos, []);
});

test('H02 expiración con socket conectado pero inactivo: el servidor lo corta sin acción del cliente', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  await pedir(doc, 'sala:seguir', { salaId: sala.id });
  const real = Date.now;
  const desfase = 61 * 60 * 1000 * 8; // sesión de 8 h vencida
  t.after(() => { Date.now = real; });
  const cerrado = evento(doc, 'disconnect', { timeout: 12_000 });
  Date.now = () => real() + desfase;
  await cerrado;
  assert.equal(doc.connected, false);
});

test('H02 reconexión: exige autenticación válida tras revocar; una sesión nueva sí entra', async (t) => {
  const { srv, cookie, csrf } = await preparar(t);
  await logout(srv, cookie, csrf);
  assert.equal(await rechazo(srv.conectar('/docente', { cabeceras: { cookie } })), 'no_autenticado');
  const nueva = await srv.login();
  const { sesion } = await srv.docente(nueva.cookie);
  assert.equal(sesion.rol, 'docente');
});

test('H02 alcance: cerrar una sesión no revoca otra sesión docente válida', async (t) => {
  const { srv, doc, sala, cookie, csrf } = await preparar(t);
  const otra = await srv.login();
  const { s: otro } = await srv.docente(otra.cookie);
  await pedir(otro, 'sala:seguir', { salaId: sala.id });
  const cerrado = evento(doc, 'disconnect');
  await logout(srv, cookie, csrf);
  await cerrado;
  await esperar(300);
  assert.equal(otro.connected, true);
  const estado = evento(otro, 'estado');
  const { s: est } = await srv.estudiante(sala.codigo, { alias: 'Luis' });
  assert.ok(await estado, 'la sesión válida sigue recibiendo estado');
  assert.equal(est.connected, true);
});

test('H02 presentador: su clave es independiente de la sesión del panel y sigue funcionando tras el logout', async (t) => {
  const { srv, doc, sala, clave, cookie, csrf } = await preparar(t);
  const { s: pres, sesion } = await srv.presentador(clave);
  assert.equal(sesion.rol, 'presentador');
  const cerrado = evento(doc, 'disconnect');
  await logout(srv, cookie, csrf);
  await cerrado;
  await esperar(300);
  assert.equal(pres.connected, true, 'el presentador no se corta con el logout del panel');
  const r = await pedir(pres, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  assert.equal(r.ok, true, r.mensaje);
  const rech = await pedir(pres, 'sala:listar', {});
  assert.equal(rech.error, 'prohibido');
});

test('H02 privacidad: tras revocar, la solución revelada y las preguntas no llegan al panel antiguo', async (t) => {
  const { srv, sala, cookie, csrf, clave } = await preparar(t);
  const { s: viejo } = await srv.docente(cookie);
  await pedir(viejo, 'sala:seguir', { salaId: sala.id });
  const { s: pres } = await srv.presentador(clave);
  const r = await pedir(pres, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  const cerrado = evento(viejo, 'disconnect');
  await logout(srv, cookie, csrf);
  await cerrado;
  const vistos = [];
  viejo.onAny((n, d) => vistos.push(JSON.stringify(d)));
  await pedir(pres, 'encuesta:cerrar', { salaId: sala.id, encuestaId: r.encuesta.id });
  const rev = await pedir(pres, 'encuesta:revelar', { salaId: sala.id, encuestaId: r.encuesta.id, solucion: { correctas: [1], explicacion: 'SECRETO-H02' } });
  assert.equal(rev.ok, true, rev.mensaje);
  const { s: est } = await srv.estudiante(sala.codigo, { alias: 'Eva' });
  est.emit('pregunta:enviar', { texto: 'PREGUNTA-H02' }, () => {});
  await esperar(500);
  assert.equal(vistos.filter((v) => /SECRETO-H02|PREGUNTA-H02/.test(v)).length, 0);
});

// ---------- Ventana anterior al barrido (hallazgo P1 de Codex) ----------
/**
 * Barrido de 1 h (inoperante en la prueba) y sesión docente de 1 s con vencimiento REAL (sin simular el reloj):
 * solo la autorización por destinatario protege la ventana entre el vencimiento y el siguiente barrido.
 */
async function prepararVentana(t) {
  const srv = await iniciar({ barridoMs: 3_600_000 });
  t.after(() => srv.cerrar());
  const { cookie: cookieLarga } = await srv.login();
  const { s: admin } = await srv.docente(cookieLarga);
  const r = await pedir(admin, 'sala:crear', { titulo: 'Ventana', preModeracion: false });
  const sid = srv.app.sesiones.crear(1);
  const cookie = `oclive_docente=${srv.app.firmador.firmar({ t: 'docente', sid }, 3600)}`;
  const { s: breve } = await srv.docente(cookie);
  await pedir(breve, 'sala:seguir', { salaId: r.sala.id });
  const { s: pres } = await srv.presentador(r.clave);
  return { srv, admin, breve, pres, sala: r.sala, cookie, cookieLarga };
}

test('H02 ventana pre-barrido: sesión vencida de verdad no recibe estado, preguntas ni solución', async (t) => {
  const { srv, breve, pres, sala, cookie } = await prepararVentana(t);
  const cr = await pedir(pres, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  await esperar(1300); // la sesión de 1 s venció; el barrido (1 h) no ha corrido
  const vistos = [];
  breve.onAny((n, d) => { if (n !== 'disconnect') vistos.push(`${n}:${JSON.stringify(d)}`); });
  const cerrado = evento(breve, 'disconnect', { timeout: 6000 });
  // Solicitud HTTP no autenticada con la cookie vencida (reproducción de Codex) y actividad privada posterior.
  const http = await srv.peticion('/api/docente/sesion', { cabeceras: { cookie } });
  assert.equal(http.json.autenticado, false);
  const c1 = await pedir(pres, 'encuesta:cerrar', { salaId: sala.id, encuestaId: cr.encuesta.id });
  const c2 = await pedir(pres, 'encuesta:revelar', { salaId: sala.id, encuestaId: cr.encuesta.id, solucion: { correctas: [1], explicacion: 'SECRETO-VENTANA' } });
  assert.equal(c1.ok && c2.ok, true);
  const { s: est } = await srv.estudiante(sala.codigo, { alias: 'Ana' });
  est.emit('pregunta:enviar', { texto: 'PREGUNTA-VENTANA' }, () => {});
  await cerrado;
  await esperar(400);
  assert.equal(breve.connected, false);
  assert.equal(vistos.filter((v) => /SECRETO-VENTANA|PREGUNTA-VENTANA|^estado:/.test(v)).length, 0, vistos.join(' | '));
  assert.equal(pres.connected, true, 'el presentador conserva su autenticación independiente');
});

test('H02 ventana pre-barrido: logout con cookie vencida no corta otra sesión válida; la vencida no recibe difusión', async (t) => {
  const { srv, admin, breve, sala, cookie } = await prepararVentana(t);
  await pedir(admin, 'sala:seguir', { salaId: sala.id });
  await esperar(1300);
  const lo = await srv.peticion('/api/docente/logout', { metodo: 'POST', cuerpo: {}, cabeceras: { cookie, 'x-oc-csrf': 'x' } });
  assert.equal(lo.json.autenticado, false);
  const vistos = [];
  breve.onAny((n) => { if (n !== 'disconnect') vistos.push(n); });
  const estadoAdmin = evento(admin, 'estado');
  const { s: est } = await srv.estudiante(sala.codigo, { alias: 'Eva' });
  est.emit('pregunta:enviar', { texto: 'P' }, () => {});
  assert.ok(await estadoAdmin, 'la sesión válida sigue recibiendo estado');
  await esperar(400);
  assert.equal(breve.connected, false);
  assert.deepEqual(vistos.filter((n) => n === 'estado'), []);
  assert.equal(admin.connected, true);
  assert.equal(await rechazo(srv.conectar('/docente', { cabeceras: { cookie } })), 'no_autenticado');
});
