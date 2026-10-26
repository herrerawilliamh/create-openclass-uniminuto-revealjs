/** OpenClass Live: pruebas de la lógica pura (almacén de salas, validación y autenticación). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearAlmacen, ErrorSala, LIMITES_SALA } from '../src/salas.mjs';
import * as V from '../src/validar.mjs';
import { hashPassword, verificarPassword, crearFirmador, crearSesiones } from '../src/auth.mjs';
import { leerConfig } from '../src/config.mjs';
import { crearLimitador } from '../src/limites.mjs';

const reloj = () => { let t = Date.parse('2026-10-24T08:00:00-05:00'); return { ahora: () => t, avanzar: (ms) => { t += ms; } }; };
const nuevo = (opciones = {}) => { const r = reloj(); return { r, a: crearAlmacen({ ttlMin: 60, maxParticipantes: 5, maxSalas: 3, ahora: r.ahora, ...opciones }) }; };
const encuesta = (extra = {}) => V.definicionEncuesta({ enunciado: '¿Qué imprime console.log(typeof null)?', tipo: 'unica', opciones: ['null', 'object', 'undefined'], ...extra });
// La solución nunca forma parte de la encuesta: la conserva quien la creó y solo viaja al revelar.
const SOLUCION = { correctas: [1], explicacion: 'Herencia histórica:\n```js\ntypeof null // "object"\n```' };
const solucion = (e, a, salaId, valor = SOLUCION) => V.solucion(valor, a.encuestaDocente(salaId, e.id));

test('flujo Freeman: ronda 1 → cerrar → resultados → ronda 2 → comparar → revelar', () => {
  const { a } = nuevo();
  const sala = a.crearSala({ titulo: 'Clase' });
  const [p1, p2, p3] = ['', '', ''].map(() => a.unir(sala.codigo, {}));
  const e = a.crearEncuesta(sala.id, encuesta());
  assert.equal(e.estado, 'lista');
  a.abrirEncuesta(sala.id, e.id);

  const vista = a.estadoParticipante(sala.id, p1.pid).encuesta;
  assert.equal(vista.correctas, undefined, 'la respuesta correcta no viaja antes de revelarla');
  assert.equal(vista.explicacion, undefined);
  assert.equal(vista.rondas, undefined, 'sin resultados para estudiantes mientras no se publiquen');
  assert.throws(() => a.revelarCorrecta(sala.id, e.id, solucion(e, a, sala.id)), ErrorSala, 'no se revela con la votación abierta');

  a.responder(sala.id, p1.pid, { encuestaId: e.id, ronda: 1, seleccion: [0] });
  a.responder(sala.id, p2.pid, { encuestaId: e.id, ronda: 1, seleccion: [0] });
  a.responder(sala.id, p2.pid, { encuestaId: e.id, ronda: 1, seleccion: [1] }); // cambia: reemplaza, no duplica
  a.responder(sala.id, p3.pid, { encuestaId: e.id, ronda: 1, seleccion: [2] });
  let r1 = a.encuestaDocente(sala.id, e.id).rondas[0];
  assert.deepEqual(r1.conteos, [1, 1, 1]);
  assert.equal(r1.respondientes, 3);
  assert.equal(r1.porcentajeCorrecto, undefined, 'el servidor no conoce la correcta: no hay acierto antes de revelar');
  assert.equal(a.encuestaDocente(sala.id, e.id).correctas, undefined, 'ni siquiera en la vista docente');

  a.cerrarEncuesta(sala.id, e.id);
  assert.throws(() => a.responder(sala.id, p1.pid, { encuestaId: e.id, ronda: 1, seleccion: [1] }), /cerrada/);
  a.publicarResultados(sala.id, e.id);
  assert.deepEqual(a.estadoParticipante(sala.id, p1.pid).encuesta.rondas[0].conteos, [1, 1, 1]);
  assert.equal(a.estadoParticipante(sala.id, p1.pid).encuesta.correctas, undefined, 'publicar resultados no revela la correcta');

  a.segundaRonda(sala.id, e.id);
  assert.equal(a.estadoParticipante(sala.id, p1.pid).encuesta.miSeleccion.length, 0, 'la ronda 2 empieza vacía');
  assert.throws(() => a.responder(sala.id, p1.pid, { encuestaId: e.id, ronda: 1, seleccion: [1] }), /ronda/);
  for (const p of [p1, p2, p3]) a.responder(sala.id, p.pid, { encuestaId: e.id, ronda: 2, seleccion: [1] });
  a.cerrarEncuesta(sala.id, e.id);
  const doc = a.encuestaDocente(sala.id, e.id);
  assert.equal(doc.rondas.length, 2);
  assert.equal(doc.rondas[1].porcentajeCorrecto, undefined);
  assert.throws(() => a.segundaRonda(sala.id, e.id), /dos rondas/);
  a.publicarResultados(sala.id, e.id);

  a.revelarCorrecta(sala.id, e.id, solucion(e, a, sala.id));
  const fin = a.estadoParticipante(sala.id, p1.pid).encuesta;
  assert.deepEqual(fin.correctas, [1]);
  assert.match(fin.explicacion, /typeof null/);
  assert.equal(fin.rondas.length, 2);
  assert.deepEqual(fin.rondas.map((x) => x.porcentajeCorrecto), [33.3, 100], 'el acierto aparece tras revelar');
  assert.equal(a.encuestaDocente(sala.id, e.id).rondas[1].porcentajeCorrecto, 100);
});

test('temporizador global: 30 s por omisión, cierre único sin publicar, preferencia para rondas futuras, +30 s y sin límite', () => {
  const { a, r } = nuevo();
  const sala = a.crearSala({});
  assert.equal(sala.duracionVotacion, 30, 'cada sala nace con 30 s');
  const p = a.unir(sala.codigo, {});
  const e = a.crearEncuesta(sala.id, encuesta());
  const t0 = r.ahora();
  a.abrirEncuesta(sala.id, e.id);
  assert.equal(a.encuestaDocente(sala.id, e.id).rondas[0].cierra, t0 + 30_000, 'vencimiento absoluto del servidor');
  assert.equal(a.estadoParticipante(sala.id, p.pid).encuesta.cierra, t0 + 30_000, 'el estudiante recibe el mismo vencimiento');
  assert.equal(a.estadoParticipante(sala.id, p.pid).servidor, t0, 'y la hora del servidor para sincronizar');

  // Cambiar la preferencia no altera la ronda en curso.
  a.ajustarSala(sala.id, { duracionVotacion: 60 });
  assert.equal(a.proximoCierre(sala.id), t0 + 30_000);
  r.avanzar(29_000);
  a.responder(sala.id, p.pid, { encuestaId: e.id, ronda: 1, seleccion: [1] });
  r.avanzar(1_000);
  assert.throws(() => a.responder(sala.id, p.pid, { encuestaId: e.id, ronda: 1, seleccion: [0] }), /cerrada/, 'ninguna respuesta tardía entra');
  const doc = a.encuestaDocente(sala.id, e.id);
  assert.equal(doc.estado, 'cerrada');
  assert.equal(doc.rondas[0].cierre, 'tiempo');
  assert.equal(doc.resultadosPublicados, false, 'el cierre automático no publica resultados');
  assert.equal(doc.correctaRevelada, false, 'ni revela la respuesta');
  const vista = a.estadoParticipante(sala.id, p.pid).encuesta;
  assert.equal(vista.rondas, undefined);
  assert.equal(vista.correctas, undefined);
  assert.deepEqual(a.vencerVotaciones(), [], 'cierre único: no hay segunda transición');
  assert.throws(() => a.cerrarEncuesta(sala.id, e.id), /ya está cerrada/);

  // La segunda ronda usa la preferencia vigente (60 s) y admite «+30 s».
  a.segundaRonda(sala.id, e.id);
  const t1 = r.ahora();
  assert.equal(a.proximoCierre(sala.id), t1 + 60_000);
  a.extenderVotacion(sala.id, e.id);
  assert.equal(a.proximoCierre(sala.id), t1 + 90_000);
  r.avanzar(90_000);
  assert.deepEqual(a.vencerVotaciones(), [sala.id], 'el barrido periódico detecta el vencimiento una vez');
  assert.deepEqual(a.vencerVotaciones(), []);

  // Sin límite: no vence ni se extiende.
  a.ajustarSala(sala.id, { duracionVotacion: 0 });
  const e2 = a.crearEncuesta(sala.id, encuesta({ enunciado: 'Otra pregunta sin límite' }));
  a.abrirEncuesta(sala.id, e2.id);
  assert.equal(a.proximoCierre(sala.id), null);
  assert.throws(() => a.extenderVotacion(sala.id, e2.id), /límite/);
  r.avanzar(30 * 60_000);
  assert.equal(a.encuestaDocente(sala.id, e2.id).estado, 'abierta');
  a.cerrarEncuesta(sala.id, e2.id);
  assert.equal(a.encuestaDocente(sala.id, e2.id).rondas[0].cierre, 'docente');

  assert.throws(() => V.ajustesSala({ duracionVotacion: 45 }), V.ErrorValidacion);
  assert.throws(() => V.ajustesSala({ duracionVotacion: '30' }), V.ErrorValidacion);
  assert.throws(() => V.ajustesSala({ duracionVotacion: 30, extra: 1 }), V.ErrorValidacion);
  assert.deepEqual(V.ajustesSala({ duracionVotacion: 90 }), { duracionVotacion: 90 });
});

test('solo una votación abierta a la vez y selección múltiple', () => {
  const { a } = nuevo();
  const s = a.crearSala();
  const p = a.unir(s.codigo, {});
  const e1 = a.crearEncuesta(s.id, encuesta());
  const e2 = a.crearEncuesta(s.id, V.definicionEncuesta({ enunciado: 'Elija lenguajes tipados', tipo: 'multiple', opciones: ['TS', 'JS', 'Rust'] }));
  a.abrirEncuesta(s.id, e1.id);
  assert.throws(() => a.abrirEncuesta(s.id, e2.id), /Cierre primero/);
  a.cerrarEncuesta(s.id, e1.id);
  a.abrirEncuesta(s.id, e2.id);
  assert.throws(() => a.responder(s.id, p.pid, { encuestaId: e1.id, ronda: 1, seleccion: [1] }), /no está activa/);
  const def = a.encuestaDocente(s.id, e2.id);
  assert.throws(() => V.respuesta({ encuestaId: e2.id, ronda: 1, seleccion: [0, 0] }, def), V.ErrorValidacion);
  assert.throws(() => V.respuesta({ encuestaId: e2.id, ronda: 1, seleccion: [9] }, def), V.ErrorValidacion);
  a.responder(s.id, p.pid, V.respuesta({ encuestaId: e2.id, ronda: 1, seleccion: [2, 0] }, def));
  a.cerrarEncuesta(s.id, e2.id);
  a.revelarCorrecta(s.id, e2.id, V.solucion({ correctas: [0, 2] }, def));
  assert.equal(a.encuestaDocente(s.id, e2.id).rondas[0].porcentajeCorrecto, 100, 'múltiple: acierto exacto tras revelar');
  assert.throws(() => V.respuesta({ encuestaId: e1.id, ronda: 1, seleccion: [0, 1] }, a.encuestaDocente(s.id, e1.id)), /exactamente una/);
});

test('segunda ronda: no reemplaza otra votación abierta (controles de otra pestaña)', () => {
  const { r, a } = nuevo();
  const s = a.crearSala();
  const p = a.unir(s.codigo, {});
  const e1 = a.crearEncuesta(s.id, encuesta());
  const e2 = a.crearEncuesta(s.id, encuesta({ enunciado: '¿Qué imprime console.log(typeof [])?' }));
  a.abrirEncuesta(s.id, e1.id);
  a.cerrarEncuesta(s.id, e1.id);
  a.abrirEncuesta(s.id, e2.id);
  assert.throws(() => a.segundaRonda(s.id, e1.id), /Cierre primero/);
  assert.equal(a.estadoParticipante(s.id, p.pid).encuesta.id, e2.id, 'la votación abierta sigue en pantalla');
  a.responder(s.id, p.pid, { encuestaId: e2.id, ronda: 1, seleccion: [1] });
  r.avanzar(31_000);
  assert.equal(a.encuestaDocente(s.id, e2.id).estado, 'cerrada', 'su temporizador la sigue cerrando');
  a.segundaRonda(s.id, e1.id);
  assert.equal(a.encuestaDocente(s.id, e1.id).ronda, 2, 'con la otra cerrada, la segunda ronda procede');
});

test('reconexión con token: mismo participante, misma respuesta; token ajeno no sirve', () => {
  const { a } = nuevo();
  const s = a.crearSala();
  const p = a.unir(s.codigo, { alias: 'Ana' });
  const e = a.crearEncuesta(s.id, encuesta());
  a.abrirEncuesta(s.id, e.id);
  a.responder(s.id, p.pid, { encuestaId: e.id, ronda: 1, seleccion: [2] });
  const otra = a.unir(s.codigo, { token: p.token });
  assert.equal(otra.pid, p.pid);
  assert.equal(otra.reconectado, true);
  assert.deepEqual(a.estadoParticipante(s.id, otra.pid).encuesta.miSeleccion, [2]);
  const s2 = a.crearSala();
  assert.notEqual(a.unir(s2.codigo, { token: p.token }).pid, p.pid, 'un token solo vale en su sala');
});

test('límites: participantes, salas, preguntas y frecuencia', () => {
  const { a, r } = nuevo();
  const s = a.crearSala();
  for (let i = 0; i < 5; i++) a.unir(s.codigo, {});
  assert.throws(() => a.unir(s.codigo, {}), (e) => e.codigo === 'sala_llena');
  a.crearSala(); a.crearSala();
  assert.throws(() => a.crearSala(), (e) => e.codigo === 'limite_salas');

  const [pid] = a.participantesDe(s.id);
  a.enviarPregunta(s.id, pid, { texto: 'Primera duda' });
  assert.throws(() => a.enviarPregunta(s.id, pid, { texto: 'Otra' }), (e) => e.codigo === 'frecuencia');
  for (let i = 1; i < LIMITES_SALA.preguntasPorParticipante; i++) { r.avanzar(LIMITES_SALA.intervaloPreguntaMs); a.enviarPregunta(s.id, pid, { texto: `Duda ${i}` }); }
  r.avanzar(LIMITES_SALA.intervaloPreguntaMs);
  assert.throws(() => a.enviarPregunta(s.id, pid, { texto: 'Una más' }), (e) => e.codigo === 'limite_propias');
});

test('preguntas: premoderación, votos, proyección, bloqueo y cierre de recepción', () => {
  const { a } = nuevo();
  const s = a.crearSala({ preModeracion: true });
  const autor = a.unir(s.codigo, {});
  const otro = a.unir(s.codigo, {});
  const q = a.enviarPregunta(s.id, autor.pid, { texto: '¿Por qué <script>alert(1)</script>?' });
  assert.equal(q.estado, 'pendiente');
  assert.equal(a.preguntasParticipante(s.id, otro.pid).length, 0, 'pendiente: invisible para los demás');
  assert.equal(a.preguntasParticipante(s.id, autor.pid)[0].estado, 'pendiente', 'el autor ve la suya en revisión');
  assert.equal(a.proyectada(s.id), null, 'nada llega a la pantalla compartida sin acción del docente');
  assert.throws(() => a.votarPregunta(s.id, otro.pid, q.id), /no está disponible/);

  a.moderar(s.id, { preguntaId: q.id, accion: 'aprobar' });
  assert.equal(a.votarPregunta(s.id, otro.pid, q.id).votos, 1);
  assert.equal(a.votarPregunta(s.id, otro.pid, q.id).votos, 0, 'votar de nuevo retira el voto (sin duplicados)');
  assert.throws(() => a.votarPregunta(s.id, autor.pid, q.id), /propia/);
  a.moderar(s.id, { preguntaId: q.id, accion: 'proyectar' });
  assert.equal(a.proyectada(s.id).texto, '¿Por qué <script>alert(1)</script>?', 'se guarda como texto plano; las vistas lo pintan con textContent');
  a.moderar(s.id, { preguntaId: q.id, accion: 'bloquearAutor' });
  assert.equal(a.proyectada(s.id), null, 'bloquear retira la proyección');
  assert.equal(a.preguntasDocente(s.id)[0].estado, 'oculta');
  assert.throws(() => a.enviarPregunta(s.id, autor.pid, { texto: 'Insisto' }), (e) => e.codigo === 'bloqueado');
  assert.throws(() => a.unir(s.codigo, { token: autor.token }), (e) => e.codigo === 'bloqueado');

  a.ajustarPreguntas(s.id, { abiertas: false });
  assert.throws(() => a.enviarPregunta(s.id, otro.pid, { texto: 'Cerrado' }), (e) => e.codigo === 'preguntas_cerradas');
});

test('vencimiento y finalización eliminan todos los datos de la sala', () => {
  const { a, r } = nuevo();
  const s = a.crearSala();
  const p = a.unir(s.codigo, {});
  a.enviarPregunta(s.id, p.pid, { texto: 'Duda' });
  r.avanzar(59 * 60_000);
  assert.equal(a.existe(s.id), true);
  r.avanzar(2 * 60_000);
  assert.equal(a.existe(s.id), false);
  assert.deepEqual(a.purgar(), [s.id]);
  assert.equal(a.tamano, 0);
  assert.throws(() => a.unir(s.codigo, {}), (e) => e.codigo === 'sala_inexistente', 'el código vencido deja de funcionar');

  const s2 = a.crearSala();
  a.finalizar(s2.id);
  assert.throws(() => a.estadoDocente(s2.id), (e) => e.codigo === 'sala_inexistente');
});

test('validación: campos desconocidos, tamaños y caracteres de control', () => {
  assert.throws(() => V.definicionEncuesta({ enunciado: 'Hola mundo', opciones: ['a', 'b'], markdown: '# Diapositivas' }), /no admitido «markdown»/);
  assert.throws(() => V.definicionEncuesta({ enunciado: 'Hola mundo', opciones: ['a'] }), /entre 2 y 8/);
  assert.throws(() => V.definicionEncuesta({ enunciado: 'x'.repeat(501), opciones: ['a', 'b'] }), /supera 500/);
  assert.throws(() => V.solucion({ correctas: [0, 1] }, { tipo: 'unica', opciones: ['a', 'b'] }), /una sola/);
  assert.equal(V.limpiarTexto('a\u0000b‮c  d', { max: 10, campo: 't' }), 'abc d');
  assert.equal(V.limpiarTexto('l1\r\nl2\n\n\n\nl3', { max: 50, campo: 't', multilinea: true }), 'l1\nl2\n\nl3');
  assert.throws(() => V.codigoSala('ABC0EF'), /inválido/, 'alfabeto sin 0/O/1/I/L');
  assert.equal(V.codigoSala('abcdef'), 'ABCDEF');
  assert.throws(() => V.union({ codigo: 'ABCDEF', rol: 'docente' }), /no admitido «rol»/);
  assert.throws(() => V.id('../../etc'), /inválido/);
});

test('soluciones privadas: la encuesta se crea sin solución y la revelación es explícita, validada, única y de la activa', () => {
  // La carga de creación con solución se rechaza entera (no se descarta en silencio).
  for (const privado of [{ correctas: [1] }, { explicacion: 'x' }, { correctas: [] }]) {
    assert.throws(() => V.definicionEncuesta({ enunciado: 'Hola mundo', opciones: ['a', 'b'], ...privado }), /se transmite solo al revelar/);
  }
  const def = { tipo: 'unica', opciones: ['a', 'b', 'c'] };
  assert.throws(() => V.solucion({ correctas: [3] }, def), /índice inválido/);
  assert.throws(() => V.solucion({}, def), /correcta o una explicación/);
  assert.throws(() => V.solucion({ correctas: [0], extra: 1 }, def), /no admitido «extra»/);
  assert.deepEqual(V.solucion({ explicacion: 'Solo explicación' }, def), { correctas: [], explicacion: 'Solo explicación' });

  const { a } = nuevo();
  const s = a.crearSala();
  const p = a.unir(s.codigo, {});
  const e = a.crearEncuesta(s.id, encuesta());
  const otra = a.crearEncuesta(s.id, encuesta({ enunciado: 'Otra pregunta' }));
  assert.equal('correctas' in e || 'explicacion' in e, false, 'el acuse de creación no trae solución');
  a.abrirEncuesta(s.id, e.id);
  a.responder(s.id, p.pid, { encuestaId: e.id, ronda: 1, seleccion: [1] });
  a.cerrarEncuesta(s.id, e.id);
  assert.throws(() => a.revelarCorrecta(s.id, otra.id, solucion(otra, a, s.id)), (x) => x.codigo === 'no_activa', 'no se revela otra encuesta');
  assert.throws(() => a.revelarCorrecta(s.id, e.id, { correctas: [], explicacion: '' }), (x) => x.codigo === 'sin_correcta');
  a.revelarCorrecta(s.id, e.id, solucion(e, a, s.id));
  assert.throws(() => a.revelarCorrecta(s.id, e.id, solucion(e, a, s.id, { correctas: [0] })), (x) => x.codigo === 'ya_revelada', 'sin duplicados ni reescrituras');
  assert.deepEqual(a.encuestaDocente(s.id, e.id).correctas, [1], 'la primera revelación prevalece');

  // Retirada de las pantallas: ya no es la activa, no se puede revelar.
  const e3 = a.crearEncuesta(s.id, encuesta({ enunciado: 'Tercera pregunta' }));
  a.abrirEncuesta(s.id, e3.id);
  a.cerrarEncuesta(s.id, e3.id);
  a.retirarEncuesta(s.id);
  assert.throws(() => a.revelarCorrecta(s.id, e3.id, solucion(e3, a, s.id)), (x) => x.codigo === 'no_activa', 'nada se revela tras retirarla');
  assert.equal(a.encuestaDocente(s.id, e3.id).correctaRevelada, false);
});

test('sonda Codex: respuesta B, resultados publicados, sin revelar → ningún campo identifica la correcta', () => {
  const { a } = nuevo();
  const s = a.crearSala();
  const p = a.unir(s.codigo, {});
  const p2 = a.unir(s.codigo, {});
  const e = a.crearEncuesta(s.id, encuesta());
  a.abrirEncuesta(s.id, e.id);
  a.responder(s.id, p.pid, { encuestaId: e.id, ronda: 1, seleccion: [1] }); // B
  a.responder(s.id, p2.pid, { encuestaId: e.id, ronda: 1, seleccion: [0] });
  a.cerrarEncuesta(s.id, e.id);
  a.publicarResultados(s.id, e.id);
  const prohibidos = /porcentajeCorrecto|correctas|explicacion|acierto/;
  for (const salida of [a.estadoParticipante(s.id, p.pid), a.estadoParticipante(s.id, p2.pid), a.estadoDocente(s.id), a.historial(s.id)]) {
    const json = JSON.stringify(salida);
    assert.doesNotMatch(json, prohibidos, `sin rastro de la solución: ${json.slice(0, 120)}`);
  }
  const v = a.estadoParticipante(s.id, p.pid).encuesta;
  assert.equal(v.correctaRevelada, false);
  assert.deepEqual(Object.keys(v.rondas[0]).sort(), ['cierre', 'conteos', 'estado', 'numero', 'porcentajes', 'respondientes'], 'lista blanca de la ronda publicada');
  // Segunda ronda: los resultados vuelven a ocultarse hasta publicarlos de nuevo.
  a.segundaRonda(s.id, e.id);
  assert.equal(a.estadoParticipante(s.id, p.pid).encuesta.rondas, undefined);
  a.cerrarEncuesta(s.id, e.id);
  assert.equal(a.estadoParticipante(s.id, p.pid).encuesta.rondas, undefined, 'cerrar no publica');
  // Revelar sin publicar: correcta y explicación sí, distribución no.
  a.revelarCorrecta(s.id, e.id, solucion(e, a, s.id));
  const rev = a.estadoParticipante(s.id, p.pid).encuesta;
  assert.deepEqual(rev.correctas, [1]);
  assert.equal(rev.rondas, undefined, 'la distribución exige publicación explícita');
});

test('auth: scrypt, tokens firmados con tipo y vencimiento, sesiones revocables', () => {
  const h = hashPassword('una-clave-larga-segura');
  assert.match(h, /^scrypt\$32768\$8\$1\$/);
  assert.ok(!h.includes('una-clave'), 'el hash no contiene la contraseña');
  assert.equal(verificarPassword('una-clave-larga-segura', h), true);
  assert.equal(verificarPassword('otra-clave-larga-segura', h), false);
  assert.throws(() => hashPassword('corta'), /12 caracteres/);

  const f = crearFirmador('s'.repeat(40));
  const t = f.firmar({ t: 'presentador', s: 'sala1234', v: 1 }, 60);
  assert.equal(f.verificar(t, 'presentador').s, 'sala1234');
  assert.equal(f.verificar(t, 'docente'), null, 'un token de presentador no sirve como sesión docente');
  const [cuerpo, firma] = t.split('.');
  const falso = Buffer.from(JSON.stringify({ t: 'presentador', s: 'otra', v: 1, exp: 9e9 })).toString('base64url');
  assert.equal(f.verificar(`${falso}.${firma}`, 'presentador'), null, 'cuerpo alterado');
  assert.equal(crearFirmador('x'.repeat(40)).verificar(t, 'presentador'), null, 'otro secreto');
  assert.equal(f.verificar(f.firmar({ t: 'docente', sid: 'a' }, -1), 'docente'), null, 'vencido');
  assert.ok(cuerpo);

  const sesiones = crearSesiones();
  const sid = sesiones.crear(60);
  assert.equal(sesiones.valida(sid), true);
  sesiones.revocar(sid);
  assert.equal(sesiones.valida(sid), false);
});

test('config: rechaza secretos ausentes, de ejemplo o débiles', () => {
  const base = { APP_URL: 'https://x.example', SESSION_SECRET: 'k'.repeat(48), ADMIN_PASSWORD_HASH: hashPassword('clave-docente-larga') };
  assert.equal(leerConfig(base).puerto, 3000);
  assert.throws(() => leerConfig({ ...base, SESSION_SECRET: 'CAMBIAR_SECRET' }), /SESSION_SECRET/);
  assert.throws(() => leerConfig({ ...base, SESSION_SECRET: 'corto' }), /SESSION_SECRET/);
  assert.throws(() => leerConfig({ ...base, ADMIN_PASSWORD_HASH: 'CAMBIAR_HASH' }), /ADMIN_PASSWORD_HASH/);
  assert.throws(() => leerConfig({ ...base, APP_URL: 'https://x.example/ruta' }), /APP_URL/);
  assert.throws(() => leerConfig({ ...base, MAX_ROOM_PARTICIPANTS: '99999' }), /fuera de rango/);
});

test('limitador: cubeta de fichas y consulta sin gasto', () => {
  const l = crearLimitador({ capacidad: 2, porSegundo: 0 });
  assert.equal(l.disponible('ip'), true);
  assert.equal(l.permitir('ip'), true);
  assert.equal(l.permitir('ip'), true);
  assert.equal(l.disponible('ip'), false);
  assert.equal(l.permitir('ip'), false);
});
