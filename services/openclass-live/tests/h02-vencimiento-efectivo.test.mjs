/**
 * H02 (P1 de la auditoría Codex): vencimiento efectivo del panel docente.
 *
 * La cookie firmada expresa su `exp` en SEGUNDOS y el registro de sesiones (SID) en MILISEGUNDOS. La cookie
 * puede vencer antes que el SID: entonces HTTP ya no autentica, pero un socket abierto seguía recibiendo
 * estado privado porque solo se comprobaba el SID.
 *
 * Prueba con tiempo real y ambos vencimientos de UN segundo (no con cookie de 3600 s):
 * - Se elige un instante cercano al final de un segundo real: la cookie vence ~300 ms después y el SID ~650 ms
 *   después de esa cookie. Así el SID sigue vivo cuando la cookie ya ha vencido.
 * - El barrido periódico queda en 1 h: solo la autorización por destinatario puede proteger la ventana.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, evento, pedir, esperar } from './ayuda.mjs';

const ENCUESTA = { enunciado: '¿Qué agrupa sockets?', tipo: 'unica', opciones: ['Namespace', 'Room', 'Adapter'] };

/** Espera hasta que el reloj real esté entre `inicio` y `fin` ms del segundo actual. */
async function esperarVentanaDeSegundo(inicio = 650, fin = 680) {
  for (;;) {
    const f = Date.now() % 1000;
    if (f >= inicio && f < fin) return;
    await esperar(5);
  }
}

/** `exp` (en segundos) que el firmador escribió en el token, leído del propio token para no suponer nada. */
const expDelToken = (token) => JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).exp;

test('H02 vencimiento efectivo: cookie de 1 s que vence antes que el SID; ningún socket vencido recibe datos', async (t) => {
  const srv = await iniciar({ barridoMs: 3_600_000 });
  t.after(() => srv.cerrar());

  // Sesión de administración de larga duración: la usa el panel válido y crea la sala.
  const { cookie: cookieLarga } = await srv.login();
  const { s: admin } = await srv.docente(cookieLarga);
  const creada = await pedir(admin, 'sala:crear', { titulo: 'Vencimiento efectivo', preModeracion: true });
  assert.equal(creada.ok, true, creada.mensaje);
  const sala = creada.sala;
  const { s: pres } = await srv.presentador(creada.clave);

  // Sesión docente de un segundo: SID de 1 s y cookie firmada de 1 s, creados cerca del final de un segundo real.
  await esperarVentanaDeSegundo();
  const sid = srv.app.sesiones.crear(1);
  const token = srv.app.firmador.firmar({ t: 'docente', sid }, 1);
  const cookie = `oclive_docente=${token}`;
  const expiraCookie = expDelToken(token) * 1000;

  // Dos pestañas del mismo panel conectadas antes de que venza la cookie.
  const { s: pestanaA } = await srv.docente(cookie);
  const { s: pestanaB } = await srv.docente(cookie);
  assert.equal(pestanaA.connected, true, 'la pestaña A debe conectarse con la cookie vigente');
  assert.equal(pestanaB.connected, true, 'la pestaña B debe conectarse con la cookie vigente');
  assert.equal((await pedir(pestanaA, 'sala:seguir', { salaId: sala.id })).ok, true);
  assert.equal((await pedir(pestanaB, 'sala:seguir', { salaId: sala.id })).ok, true);

  const recibidos = [];
  const vistos = [];
  for (const s of [pestanaA, pestanaB]) {
    s.onAny((nombre, datos) => {
      if (nombre === 'disconnect') return;
      recibidos.push(nombre);
      vistos.push(JSON.stringify(datos));
    });
  }

  // 1. Esperar el vencimiento firmado de la cookie mientras el SID todavía es válido.
  await esperar(Math.max(0, expiraCookie - Date.now()) + 30);
  assert.equal(srv.app.sesiones.valida(sid), true, 'precondición: el SID debe seguir vivo tras vencer la cookie');

  // 2. HTTP ya no autentica con la cookie vencida.
  const http = await srv.peticion('/api/docente/sesion', { cabeceras: { cookie } });
  assert.equal(http.json.autenticado, false);

  // 3. Logout con la cookie vencida: no debe revocar nada ni tocar la sesión válida.
  const lo = await srv.peticion('/api/docente/logout', { metodo: 'POST', cuerpo: {}, cabeceras: { cookie, 'x-oc-csrf': 'x' } });
  assert.equal(lo.json.autenticado, false);

  // 4. Una pregunta pendiente y una solución llegan desde otra sesión válida (presentador autorizado).
  const estadoAdmin = evento(admin, 'estado');
  const pendientes = await pedir(pres, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  assert.equal(pendientes.ok, true, pendientes.mensaje);
  const { s: estudiante } = await srv.estudiante(sala.codigo, { alias: 'Ana' });
  estudiante.emit('pregunta:enviar', { texto: 'PREGUNTA-PENDIENTE-H02' }, () => {});
  assert.equal((await pedir(pres, 'encuesta:cerrar', { salaId: sala.id, encuestaId: pendientes.encuesta.id })).ok, true);
  const revelada = await pedir(pres, 'encuesta:revelar', {
    salaId: sala.id, encuestaId: pendientes.encuesta.id, solucion: { correctas: [1], explicacion: 'SOLUCION-H02' },
  });
  assert.equal(revelada.ok, true, revelada.mensaje);

  // 5. La sesión válida y el presentador siguen funcionando.
  assert.ok(await estadoAdmin, 'la sesión docente válida sigue recibiendo estado');
  assert.equal(admin.connected, true);
  assert.equal(pres.connected, true, 'el presentador conserva su autenticación independiente');

  // 6. Ninguno de los dos sockets vencidos recibe datos y ambos se desconectan.
  await esperar(300);
  assert.equal(pestanaA.connected, false, 'la pestaña A vencida debe cortarse');
  assert.equal(pestanaB.connected, false, 'la pestaña B vencida debe cortarse');
  assert.deepEqual(recibidos, [], `no deben llegar eventos a sockets vencidos: ${recibidos.join(', ')}`);
  assert.equal(vistos.filter((v) => /SOLUCION-H02|PREGUNTA-PENDIENTE-H02/.test(v)).length, 0);
});
