/**
 * OpenClass Live: integración con servidor real y clientes Socket.IO (WebSocket y polling).
 * Cubre: sesión, multicliente simultáneo, segunda ronda, preguntas y moderación, reconexión,
 * vencimiento, sala cerrada, operaciones no autorizadas, orígenes, límites y privacidad de registros.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { iniciar, evento, rechazo, pedir, esperar, PRESENTADOR } from './ayuda.mjs';

const ENCUESTA = {
  enunciado: '¿Qué estructura usa un servidor Socket.IO para agrupar sockets?',
  codigo: 'io.to("sala").emit("evento", datos);',
  tipo: 'unica', opciones: ['Namespace', 'Room', 'Adapter', 'Engine'],
};
// La solución la conserva quien creó la encuesta y solo viaja con «encuesta:revelar».
const SOLUCION = { correctas: [1], explicacion: 'Las rooms agrupan sockets dentro de un namespace.\n```js\nsocket.join("sala");\n```' };
const MARCA = 'Las rooms agrupan sockets';

async function preparar(t, opciones) {
  const srv = await iniciar(opciones);
  t.after(() => srv.cerrar());
  const { cookie, csrf } = await srv.login();
  const { s: doc } = await srv.docente(cookie);
  const r = await pedir(doc, 'sala:crear', { titulo: 'Plataformas de desarrollo', preModeracion: true });
  assert.equal(r.ok, true, r.mensaje);
  return { srv, doc, cookie, csrf, sala: r.sala, clave: r.clave, enlace: r.enlace, qr: r.qr };
}

const ultimoEstado = (socket, filtro) => evento(socket, 'estado', { filtro });
// Un origen ajeno se rechaza ya en el handshake del motor (allowRequest → HTTP 403) o en el middleware.
const RECHAZO_ORIGEN = ['origen', 'websocket error', 'xhr poll error'];
const rechazadoPorOrigen = async (socket) => assert.ok(RECHAZO_ORIGEN.includes(await rechazo(socket)));

test('sesión: crear sala devuelve código, enlace /join, QR y clave de presentador sin secretos en el QR', async (t) => {
  const { srv, sala, enlace, qr, clave } = await preparar(t);
  assert.match(sala.codigo, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.equal(enlace, `${srv.config.appUrl}/join/${sala.codigo}`);
  const svg = await srv.peticion(new URL(qr).pathname);
  assert.equal(svg.estado, 200);
  assert.match(svg.cabeceras['content-type'], /image\/svg\+xml/);
  assert.doesNotMatch(svg.texto, /<script|on\w+=/i);
  assert.ok(!svg.texto.includes(clave.slice(0, 20)), 'el QR no contiene la clave de presentador');
  const pagina = await srv.peticion(`/join/${sala.codigo}`);
  assert.equal(pagina.estado, 200);
  assert.match(pagina.texto, /Unirse a la clase/);
});

test('multicliente: 40 estudiantes responden a la vez; servidor agrega; segunda ronda y comparación', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const alumnos = await Promise.all(Array.from({ length: 40 }, (_, i) => srv.estudiante(sala.codigo, { alias: i % 2 ? `A${i}` : '' })));
  assert.equal(new Set(alumnos.map((a) => a.sesion.token)).size, 40, 'un token distinto por participante');

  const abiertas = alumnos.map(({ s }) => ultimoEstado(s, (e) => e.encuesta?.estado === 'abierta'));
  const c = await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  assert.equal(c.ok, true, c.mensaje);
  const eid = c.encuesta.id;
  const vistas = await Promise.all(abiertas);
  for (const v of vistas) {
    assert.equal(v.encuesta.correctas, undefined, 'la correcta no se envía a estudiantes antes de revelar');
    assert.equal(v.encuesta.explicacion, undefined);
  }

  // Ronda 1: 10 por opción, enviadas simultáneamente.
  const r1 = await Promise.all(alumnos.map(({ s }, i) => pedir(s, 'encuesta:responder', { encuestaId: eid, ronda: 1, seleccion: [i % 4] })));
  assert.ok(r1.every((r) => r.ok), JSON.stringify(r1.find((r) => !r.ok)));
  // Reenvío accidental: no duplica.
  await pedir(alumnos[0].s, 'encuesta:responder', { encuestaId: eid, ronda: 1, seleccion: [0] });
  await pedir(doc, 'encuesta:cerrar', { salaId: sala.id, encuestaId: eid });
  const tarde = await pedir(alumnos[1].s, 'encuesta:responder', { encuestaId: eid, ronda: 1, seleccion: [1] });
  assert.equal(tarde.error, 'cerrada');

  const seguir = await pedir(doc, 'sala:seguir', { salaId: sala.id });
  const ronda1 = seguir.estado.activa.rondas[0];
  assert.deepEqual(ronda1.conteos, [10, 10, 10, 10]);
  assert.equal(ronda1.respondientes, 40);
  assert.deepEqual(ronda1.porcentajes, [25, 25, 25, 25]);
  assert.equal(ronda1.porcentajeCorrecto, undefined, 'sin solución en el servidor no hay acierto');
  assert.equal(seguir.estado.sala.conectados, 40);

  const publicados = ultimoEstado(alumnos[5].s, (e) => e.encuesta?.resultadosPublicados);
  await pedir(doc, 'encuesta:publicar', { salaId: sala.id, encuestaId: eid });
  const pub = await publicados;
  assert.deepEqual(pub.encuesta.rondas[0].conteos, [10, 10, 10, 10]);
  assert.equal(pub.encuesta.correctas, undefined, 'publicar resultados no revela la respuesta');

  // Ronda 2 tras la discusión: 30 eligen la correcta.
  const r2abierta = ultimoEstado(alumnos[7].s, (e) => e.encuesta?.ronda === 2 && e.encuesta.estado === 'abierta');
  assert.equal((await pedir(doc, 'encuesta:segundaRonda', { salaId: sala.id, encuestaId: eid })).ok, true);
  assert.deepEqual((await r2abierta).encuesta.miSeleccion, []);
  await Promise.all(alumnos.map(({ s }, i) => pedir(s, 'encuesta:responder', { encuestaId: eid, ronda: 2, seleccion: [i < 30 ? 1 : 3] })));
  await pedir(doc, 'encuesta:cerrar', { salaId: sala.id, encuestaId: eid });

  const revelada = ultimoEstado(alumnos[0].s, (e) => e.encuesta?.correctaRevelada);
  await pedir(doc, 'encuesta:publicar', { salaId: sala.id, encuestaId: eid });
  const rev = await pedir(doc, 'encuesta:revelar', { salaId: sala.id, encuestaId: eid, solucion: SOLUCION });
  assert.equal(rev.ok, true, rev.mensaje);
  assert.equal(rev.encuesta.rondas[0].porcentajeCorrecto, 25);
  assert.equal(rev.encuesta.rondas[1].porcentajeCorrecto, 75);
  const fin = await revelada;
  assert.deepEqual(fin.encuesta.correctas, [1]);
  assert.match(fin.encuesta.explicacion, /socket\.join/);
  assert.equal(fin.encuesta.rondas.length, 2, 'el estudiante ve la comparación de rondas');
});

test('revelación: ninguna ruta (difusión, acuses, historial, reconexión, registros) expone la solución antes de revelar', async (t) => {
  const { srv, doc, sala, clave } = await preparar(t);
  const recibido = [];
  const espiar = (s, quien) => s.onAny((nombre, datos) => recibido.push({ quien, nombre, json: JSON.stringify(datos) }));
  espiar(doc, 'panel');
  const a = await srv.estudiante(sala.codigo);
  const b = await srv.estudiante(sala.codigo);
  espiar(a.s, 'a'); espiar(b.s, 'b');
  const { s: pres } = await srv.presentador(clave);
  espiar(pres, 'presentador');
  const acuses = [];
  const pedirEspiado = async (s, ev, datos) => { const r = await pedir(s, ev, datos); acuses.push({ ev, json: JSON.stringify(r) }); return r; };

  // Crear con la solución adjunta se rechaza entero: no se crea nada.
  const conSolucion = await pedirEspiado(pres, 'encuesta:crear', { salaId: sala.id, encuesta: { ...ENCUESTA, ...SOLUCION }, abrir: true });
  assert.equal(conSolucion.error, 'validacion');
  assert.match(conSolucion.mensaje, /se transmite solo al revelar/);
  assert.equal((await pedir(doc, 'sala:seguir', { salaId: sala.id })).estado.historial.length, 0);

  const { encuesta } = await pedirEspiado(pres, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  const eid = encuesta.id;
  await pedirEspiado(a.s, 'encuesta:responder', { encuestaId: eid, ronda: 1, seleccion: [1] }); // B, la correcta
  await pedirEspiado(b.s, 'encuesta:responder', { encuestaId: eid, ronda: 1, seleccion: [0] });
  assert.equal((await pedirEspiado(pres, 'encuesta:revelar', { salaId: sala.id, encuestaId: eid, solucion: SOLUCION })).error, 'no_cerrada', 'no se revela con la votación abierta');
  await pedirEspiado(pres, 'encuesta:cerrar', { salaId: sala.id, encuestaId: eid });
  const publicados = ultimoEstado(a.s, (e) => e.encuesta?.resultadosPublicados);
  await pedirEspiado(pres, 'encuesta:publicar', { salaId: sala.id, encuestaId: eid });
  await publicados;
  // Reconexión e historial antes de revelar.
  a.s.disconnect();
  const a2 = await srv.estudiante(sala.codigo, { token: a.sesion.token });
  espiar(a2.s, 'a2');
  recibido.push({ quien: 'a2', nombre: 'sesion', json: JSON.stringify(a2.sesion) });
  acuses.push({ ev: 'sala:seguir', json: JSON.stringify(await pedir(doc, 'sala:seguir', { salaId: sala.id })) });
  acuses.push({ ev: 'estado:solicitar', json: JSON.stringify(await pedir(a2.s, 'estado:solicitar', {})) });
  await esperar(250);

  const prohibido = new RegExp(`porcentajeCorrecto|"correctas"|"explicacion"|${MARCA}`);
  for (const m of [...recibido, ...acuses]) assert.doesNotMatch(m.json, prohibido, `${m.quien ?? 'acuse'} ${m.nombre ?? m.ev}`);
  assert.ok(recibido.some((m) => m.quien === 'a2' && /"rondas"/.test(m.json)), 'la sonda sí recibió la distribución publicada');

  // Validación de la solución contra ESTA encuesta y del mensaje completo.
  for (const [datos, error] of [
    [{ solucion: { correctas: [7] } }, 'validacion'],
    [{ solucion: { correctas: [0, 1] } }, 'validacion'],
    [{ solucion: {} }, 'validacion'],
    [{ solucion: SOLUCION, extra: true }, 'validacion'],
    [{ solucion: { ...SOLUCION, enunciado: 'x' } }, 'validacion'],
  ]) assert.equal((await pedir(pres, 'encuesta:revelar', { salaId: sala.id, encuestaId: eid, ...datos })).error, error, JSON.stringify(datos));
  const otra = (await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: { ...ENCUESTA, enunciado: 'Otra pregunta' } })).encuesta;
  assert.equal((await pedir(pres, 'encuesta:revelar', { salaId: sala.id, encuestaId: otra.id, solucion: SOLUCION })).error, 'no_activa', 'no se revela otra encuesta');

  // Carrera panel ↔ presentador: exactamente una revelación.
  const revelada = ultimoEstado(a2.s, (e) => e.encuesta?.correctaRevelada);
  const [r1, r2] = await Promise.all([
    pedir(pres, 'encuesta:revelar', { salaId: sala.id, encuestaId: eid, solucion: SOLUCION }),
    pedir(doc, 'encuesta:revelar', { salaId: sala.id, encuestaId: eid, solucion: { correctas: [0] } }),
  ]);
  assert.deepEqual([r1.ok, r2.ok].sort(), [false, true]);
  assert.equal((r1.ok ? r2 : r1).error, 'ya_revelada');
  const fin = await revelada;
  assert.deepEqual(fin.encuesta.correctas, r1.ok ? [1] : [0]);
  assert.equal(fin.encuesta.rondas[0].porcentajeCorrecto, 50, 'una de dos respuestas coincide con la solución revelada');
  // Reconexión después: recibe la solución revelada.
  const a3 = await srv.estudiante(sala.codigo, { token: a.sesion.token });
  assert.equal(a3.sesion.estado.encuesta.correctaRevelada, true);
  assert.ok(srv.lineas.some((l) => l.includes('encuesta_revelada')));
  assert.ok(!srv.lineas.join('\n').includes(MARCA), 'los registros nunca contienen la explicación');

  // Revocación: la clave anterior ya no revela nada.
  const e3 = (await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: { ...ENCUESTA, enunciado: 'Tercera pregunta' }, abrir: true })).encuesta;
  await pedir(doc, 'encuesta:cerrar', { salaId: sala.id, encuestaId: e3.id });
  const fuera = evento(pres, 'disconnect');
  await pedir(doc, 'sala:revocarClaves', { salaId: sala.id });
  await fuera;
  assert.equal(await rechazo(srv.conectar('/docente', { origen: PRESENTADOR, auth: { clave } })), 'clave');
  assert.equal(srv.app.almacen.encuestaDocente(sala.id, e3.id).correctaRevelada, false);
});

test('transporte de respaldo: un estudiante solo con HTTP long-polling participa', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const { s } = await srv.estudiante(sala.codigo, { transports: ['polling'] });
  assert.equal(s.io.engine.transport.name, 'polling');
  const abierta = ultimoEstado(s, (e) => e.encuesta?.estado === 'abierta');
  const { encuesta } = await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  await abierta;
  assert.equal((await pedir(s, 'encuesta:responder', { encuestaId: encuesta.id, ronda: 1, seleccion: [1] })).ok, true);
  const { estado } = await pedir(doc, 'sala:seguir', { salaId: sala.id });
  assert.equal(estado.activa.rondas[0].respondientes, 1);
});

test('reconexión: el mismo token recupera participante y respuesta sin duplicar', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const a = await srv.estudiante(sala.codigo, { alias: 'Móvil' });
  const { encuesta } = await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  await pedir(a.s, 'encuesta:responder', { encuestaId: encuesta.id, ronda: 1, seleccion: [2] });
  a.s.disconnect(); // p. ej. el teléfono bloquea la pantalla
  await esperar(200);
  const b = await srv.estudiante(sala.codigo, { token: a.sesion.token });
  assert.equal(b.sesion.reconectado, true);
  assert.equal(b.sesion.token, a.sesion.token);
  assert.deepEqual(b.sesion.estado.encuesta.miSeleccion, [2]);
  await pedir(b.s, 'encuesta:responder', { encuestaId: encuesta.id, ronda: 1, seleccion: [1] });
  const { estado } = await pedir(doc, 'sala:seguir', { salaId: sala.id });
  assert.equal(estado.sala.participantes, 1);
  assert.equal(estado.activa.rondas[0].respondientes, 1);
  assert.deepEqual(estado.activa.rondas[0].conteos, [0, 1, 0, 0]);
});

test('preguntas abiertas: premoderación, votos, proyección, respondida, bloqueo y cierre', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const autor = await srv.estudiante(sala.codigo, { alias: 'Curioso' });
  const otro = await srv.estudiante(sala.codigo);
  const enviada = await pedir(autor.s, 'pregunta:enviar', { texto: '<img src=x onerror=alert(1)> ¿Cómo escala?' });
  assert.equal(enviada.ok, true);
  assert.equal(enviada.pregunta.estado, 'pendiente');
  assert.equal((await pedir(otro.s, 'estado:solicitar')).estado.preguntas.length, 0, 'sin moderar no la ven los demás');
  let est = (await pedir(doc, 'sala:seguir', { salaId: sala.id })).estado;
  assert.equal(est.proyectada, null);
  assert.equal(est.preguntas[0].alias, 'Curioso');
  const qid = est.preguntas[0].id;

  const visible = ultimoEstado(otro.s, (e) => e.preguntas.length === 1);
  await pedir(doc, 'pregunta:moderar', { salaId: sala.id, preguntaId: qid, accion: 'aprobar' });
  const vista = await visible;
  assert.equal(vista.preguntas[0].texto, '<img src=x onerror=alert(1)> ¿Cómo escala?', 'texto plano, sin interpretar');
  assert.equal(vista.preguntas[0].alias, undefined, 'el alias no se difunde a otros estudiantes');
  assert.equal((await pedir(otro.s, 'pregunta:votar', { preguntaId: qid })).voto.votos, 1);
  assert.equal((await pedir(autor.s, 'pregunta:votar', { preguntaId: qid })).error, 'propia');

  await pedir(doc, 'pregunta:moderar', { salaId: sala.id, preguntaId: qid, accion: 'proyectar' });
  est = (await pedir(doc, 'sala:seguir', { salaId: sala.id })).estado;
  assert.equal(est.proyectada.id, qid);
  await pedir(doc, 'pregunta:moderar', { salaId: sala.id, preguntaId: qid, accion: 'respondida' });

  const expulsado = evento(autor.s, 'bloqueado');
  await pedir(doc, 'pregunta:moderar', { salaId: sala.id, preguntaId: qid, accion: 'bloquearAutor' });
  await expulsado;
  await esperar(100);
  assert.equal(autor.s.connected, false, 'el autor bloqueado queda desconectado');
  await assert.rejects(srv.estudiante(sala.codigo, { token: autor.sesion.token }), (e) => e.codigo === 'bloqueado');

  await pedir(doc, 'preguntas:ajustar', { salaId: sala.id, abiertas: false });
  assert.equal((await pedir(otro.s, 'pregunta:enviar', { texto: 'Otra duda' })).error, 'preguntas_cerradas');
  assert.equal((await pedir(otro.s, 'pregunta:enviar', { texto: 'x'.repeat(281) })).error, 'validacion');
});

test('sala finalizada: estudiantes avisados y desconectados; el código deja de funcionar; datos eliminados', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const a = await srv.estudiante(sala.codigo);
  await pedir(a.s, 'pregunta:enviar', { texto: 'Duda antes del cierre' });
  const aviso = evento(a.s, 'sala:cerrada');
  assert.equal((await pedir(doc, 'sala:finalizar', { salaId: sala.id })).ok, true);
  assert.equal((await aviso).motivo, 'finalizada');
  await assert.rejects(srv.estudiante(sala.codigo), (e) => e.codigo === 'sala_inexistente');
  assert.equal(srv.app.almacen.tamano, 0);
  assert.equal((await pedir(doc, 'sala:seguir', { salaId: sala.id })).error, 'sala_inexistente');
});

test('temporizador: el servidor cierra la votación con el docente desconectado, sin publicar; reconexión y +30 s', async (t) => {
  let ahora = Date.now();
  const { srv, doc, sala, clave } = await preparar(t, { ahora: () => ahora });
  const pres = await srv.presentador(clave);
  const a = await srv.estudiante(sala.codigo);
  const r = await pedir(pres.s, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  assert.equal(r.ok, true, r.mensaje);
  const t0 = ahora;
  const abierta = await ultimoEstado(a.s, (e) => e.encuesta?.estado === 'abierta');
  assert.equal(abierta.encuesta.cierra, t0 + 30_000, 'el teléfono recibe el vencimiento absoluto');
  assert.equal(typeof abierta.servidor, 'number', 'y la hora del servidor');
  assert.equal((await pedir(pres.s, 'encuesta:extender', { salaId: sala.id, encuestaId: r.encuesta.id })).encuesta.rondas[0].cierra, t0 + 60_000);
  // Una preferencia nueva no altera la ronda en curso.
  assert.equal((await pedir(pres.s, 'sala:ajustar', { salaId: sala.id, duracionVotacion: 15 })).ajustes.duracionVotacion, 15);
  assert.equal(srv.app.almacen.proximoCierre(sala.id), t0 + 60_000);
  assert.equal((await pedir(pres.s, 'sala:ajustar', { salaId: sala.id, duracionVotacion: 45 })).error, 'validacion');

  // El docente se va: el cierre no depende de su navegador.
  pres.s.disconnect();
  await pedir(doc, 'sala:seguir', { salaId: sala.id });
  ahora = t0 + 59_900;
  await pedir(doc, 'preguntas:ajustar', { salaId: sala.id, abiertas: true }); // reprograma el temporizador real (≥ 50 ms)
  const cerrada = ultimoEstado(a.s, (e) => e.encuesta?.estado === 'cerrada');
  await esperar(150);
  ahora = t0 + 60_000;
  const fin = await cerrada;
  assert.equal(fin.encuesta.rondas, undefined, 'sin resultados para estudiantes');
  assert.equal(fin.encuesta.correctas, undefined, 'sin respuesta correcta');
  assert.equal(srv.app.almacen.encuestaDocente(sala.id, r.encuesta.id).rondas[0].cierre, 'tiempo');
  assert.ok(srv.lineas.some((l) => l.includes('votacion_vencida')));

  // Reconexión del docente: recibe el estado cerrado y puede continuar (segunda ronda con 15 s).
  const pres2 = await srv.presentador(clave);
  assert.equal(pres2.sesion.estado.activa.estado, 'cerrada');
  const r2 = await pedir(pres2.s, 'encuesta:segundaRonda', { salaId: sala.id, encuestaId: r.encuesta.id });
  assert.equal(r2.encuesta.rondas[1].cierra, ahora + 15_000);
  assert.equal((await pedir(pres2.s, 'encuesta:cerrar', { salaId: sala.id, encuestaId: r.encuesta.id })).ok, true);
  assert.equal((await pedir(pres2.s, 'encuesta:cerrar', { salaId: sala.id, encuestaId: r.encuesta.id })).error, 'no_abierta', 'cierre único');
});

test('vencimiento automático por TTL: aviso, desconexión y borrado', async (t) => {
  let ahora = Date.now();
  const { srv, doc, sala, clave } = await preparar(t, { ahora: () => ahora, env: { ROOM_TTL_MINUTES: '5' } });
  const a = await srv.estudiante(sala.codigo);
  const aviso = evento(a.s, 'sala:cerrada');
  ahora += 6 * 60_000;
  srv.app.sockets.purgarAhora();
  assert.equal((await aviso).motivo, 'vencida');
  assert.equal(srv.app.almacen.tamano, 0);
  await assert.rejects(srv.estudiante(sala.codigo), (e) => e.codigo === 'sala_inexistente');
  await assert.rejects(srv.presentador(clave), (e) => e.codigo === 'clave', 'la clave de una sala vencida no sirve');
  assert.ok(doc.connected);
});

test('autorización: un estudiante no ejecuta eventos docentes ni entra al espacio docente', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const a = await srv.estudiante(sala.codigo);
  const { encuesta } = await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  for (const ev of ['encuesta:cerrar', 'encuesta:revelar', 'sala:finalizar', 'pregunta:moderar', 'encuesta:crear']) {
    await assert.rejects(pedir(a.s, ev, { salaId: sala.id, encuestaId: encuesta.id }, 400), /timed out|operation has timed out/i, `${ev} sin manejador en /participante`);
  }
  const { estado } = await pedir(doc, 'sala:seguir', { salaId: sala.id });
  assert.equal(estado.activa.estado, 'abierta', 'el estado no cambió');
  assert.equal((await pedir(a.s, 'encuesta:responder', { encuestaId: encuesta.id, ronda: 1, seleccion: [0], resultado: 999 })).error, 'validacion');

  // Sin cookie, con token de estudiante o con cookie inventada: rechazado.
  assert.equal(await rechazo(srv.conectar('/docente')), 'no_autenticado');
  assert.equal(await rechazo(srv.conectar('/docente', { auth: { clave: a.sesion.token } })), 'clave');
  assert.equal(await rechazo(srv.conectar('/docente', { cabeceras: { cookie: 'oclive_docente=abc.def' } })), 'no_autenticado');
});

test('clave de presentador: limitada a su sala, sin operaciones de panel, revocable y con origen controlado', async (t) => {
  const { srv, doc, sala, clave, cookie } = await preparar(t);
  const otra = (await pedir(doc, 'sala:crear', {})).sala;
  const { s: pres, sesion } = await srv.presentador(clave);
  assert.equal(sesion.rol, 'presentador');
  assert.equal(sesion.salaId, sala.id);
  assert.equal((await pedir(pres, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true })).ok, true);
  assert.equal((await pedir(pres, 'encuesta:crear', { salaId: otra.id, encuesta: ENCUESTA })).error, 'prohibido');
  for (const ev of ['sala:crear', 'sala:listar', 'sala:clave', 'sala:revocarClaves', 'sala:finalizar']) {
    assert.equal((await pedir(pres, ev, { salaId: sala.id })).error, 'prohibido', ev);
  }
  await rechazadoPorOrigen(srv.conectar('/docente', { origen: 'https://evil.example', auth: { clave } }));
  // La cookie del panel no vale desde el origen del presentador (ni desde otro origen).
  assert.equal(await rechazo(srv.conectar('/docente', { origen: PRESENTADOR, cabeceras: { cookie } })), 'origen');

  const desconexion = evento(pres, 'disconnect');
  await pedir(doc, 'sala:revocarClaves', { salaId: sala.id });
  await desconexion;
  assert.equal(await rechazo(srv.conectar('/docente', { origen: PRESENTADOR, auth: { clave } })), 'clave');
  const [cuerpo, firma] = clave.split('.');
  assert.equal(await rechazo(srv.conectar('/docente', { origen: PRESENTADOR, auth: { clave: `${cuerpo}x.${firma}` } })), 'clave');
});

test('cierre de sesión docente: revoca la cookie para HTTP y Socket.IO; CSRF obligatorio', async (t) => {
  const { srv, doc, sala, cookie, csrf } = await preparar(t);
  const sinCsrf = await srv.peticion('/api/docente/logout', { metodo: 'POST', cuerpo: {}, cabeceras: { cookie } });
  assert.equal(sinCsrf.estado, 403);
  const ok = await srv.peticion('/api/docente/logout', { metodo: 'POST', cuerpo: {}, cabeceras: { cookie, 'x-oc-csrf': csrf } });
  assert.equal(ok.estado, 200);
  assert.equal((await pedir(doc, 'sala:seguir', { salaId: sala.id })).error, 'no_autenticado');
  assert.equal(await rechazo(srv.conectar('/docente', { cabeceras: { cookie } })), 'no_autenticado');
  assert.equal((await srv.peticion('/api/docente/sesion', { cabeceras: { cookie } })).json.autenticado, false);
});

test('orígenes y CSWSH: estudiante y panel solo desde APP_URL', async (t) => {
  const { srv, sala, cookie } = await preparar(t);
  await rechazadoPorOrigen(srv.conectar('/participante', { origen: 'https://evil.example', auth: { codigo: sala.codigo } }));
  await rechazadoPorOrigen(srv.conectar('/docente', { origen: 'https://evil.example', cabeceras: { cookie } }));
  const login = await srv.peticion('/api/docente/login', { metodo: 'POST', origen: 'https://evil.example', cuerpo: { password: 'x' } });
  assert.equal(login.estado, 403);
  const tipo = await srv.peticion('/api/docente/login', { metodo: 'POST', cuerpo: 'password=x', tipo: 'application/x-www-form-urlencoded' });
  assert.equal(tipo.estado, 415, 'solo JSON: un formulario de otro sitio no inicia sesión');
});

test('límites: intentos de unión fallidos, inicio de sesión, ráfagas de eventos y tamaño de mensaje', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const ip = { 'x-real-ip': '203.0.113.9' };
  for (let i = 0; i < 10; i++) assert.equal(await rechazo(srv.conectar('/participante', { cabeceras: ip, auth: { codigo: 'ZZZZZZ' } })), 'sala_inexistente');
  assert.equal(await rechazo(srv.conectar('/participante', { cabeceras: ip, auth: { codigo: sala.codigo } })), 'frecuencia', 'tras 10 fallos la IP espera');
  // Una clase detrás de la misma IP (wifi del campus) entra sin problema.
  const campus = { 'x-real-ip': '198.51.100.20' };
  const clase = await Promise.all(Array.from({ length: 60 }, () => srv.estudiante(sala.codigo, { cabeceras: campus })));
  assert.equal(clase.length, 60);

  const malas = [];
  for (let i = 0; i < 6; i++) malas.push((await srv.peticion('/api/docente/login', { metodo: 'POST', cuerpo: { password: 'incorrecta' }, cabeceras: { 'x-real-ip': '203.0.113.50' } })).estado);
  assert.deepEqual(malas, [401, 401, 401, 401, 401, 429]);

  const a = clase[0].s;
  const rafaga = await Promise.all(Array.from({ length: 40 }, () => pedir(a, 'estado:solicitar')));
  assert.ok(rafaga.some((r) => r.error === 'frecuencia'), 'una ráfaga de eventos se limita');

  const desconexion = evento(clase[1].s, 'disconnect');
  clase[1].s.emit('pregunta:enviar', { texto: 'x'.repeat(20_000) });
  assert.equal(await desconexion, 'transport close', 'un mensaje > 16 KB cierra la conexión');
  assert.ok(doc.connected);
});

test('privacidad: registros sin alias, textos, respuestas ni IP; rutas sin contenido institucional', async (t) => {
  const { srv, doc, sala } = await preparar(t);
  const a = await srv.estudiante(sala.codigo, { alias: 'AliasSecreto', cabeceras: { 'x-real-ip': '192.0.2.77' } });
  const { encuesta } = await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: ENCUESTA, abrir: true });
  await pedir(a.s, 'encuesta:responder', { encuestaId: encuesta.id, ronda: 1, seleccion: [3] });
  await pedir(a.s, 'pregunta:enviar', { texto: 'TextoPrivadoDeLaPregunta' });
  await srv.peticion('/api/docente/login', { metodo: 'POST', cuerpo: { password: 'incorrecta' } });
  const registro = srv.lineas.join('\n');
  for (const prohibido of ['AliasSecreto', 'TextoPrivadoDeLaPregunta', '192.0.2.77', ENCUESTA.enunciado, sala.codigo, 'incorrecta', a.sesion.token]) {
    assert.ok(!registro.includes(prohibido), `el registro no contiene «${prohibido}»`);
  }
  for (const ruta of ['/fondos/portada.webp', '/imagenes/logo.png', '/semanas/semana1.md', '/slides.md', '/src/config.mjs', '/.env', '/package.json', '/index.html']) {
    assert.equal((await srv.peticion(ruta)).estado, 404, ruta);
  }
  const salud = await srv.peticion('/healthz');
  assert.deepEqual(salud.json, { estado: 'ok' }, 'healthz no expone datos de salas');
});
