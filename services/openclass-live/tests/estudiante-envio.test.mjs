/** Estudiante: acuses con timeout y resolución de resultados inciertos (módulo puro `envio.mjs`, I5-A). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { enviar, resolverVoto, buscarPregunta } from '../public/assets/envio.mjs';

/** Socket falso: `modo` decide qué hace con el evento. */
function falso(modo, { conectado = true } = {}) {
  const emitidos = [];
  return {
    connected: conectado, emitidos,
    timeout(ms) {
      return { emit: (ev, datos, cb) => {
        emitidos.push({ ev, datos, ms });
        if (modo === 'ok') setImmediate(() => cb(null, { ok: true, respuesta: { seleccion: datos.seleccion } }));
        else if (modo === 'rechazo') setImmediate(() => cb(null, { ok: false, error: 'no_activa', mensaje: 'Esa encuesta no está activa' }));
        else if (modo === 'perdido') setTimeout(() => cb(new Error('timeout')), ms); // aceptado o no, el acuse no llega
        else if (modo === 'tardio') { setTimeout(() => cb(new Error('timeout')), ms); setTimeout(() => cb(null, { ok: true, respuesta: {} }), ms * 3); }
      } };
    },
  };
}

test('acuse recibido: confirmado, con el timeout explícito de 10 s por defecto', async () => {
  const s = falso('ok');
  const r = await enviar(s, 'encuesta:responder', { seleccion: [1] });
  assert.equal(r.resultado, 'confirmado');
  assert.equal(s.emitidos[0].ms, 10_000);
  assert.deepEqual(r.respuesta.respuesta.seleccion, [1]);
});

test('rechazo del servidor: se distingue del resultado desconocido', async () => {
  const r = await enviar(falso('rechazo'), 'encuesta:responder', {});
  assert.equal(r.resultado, 'rechazado');
  assert.equal(r.mensaje, 'Esa encuesta no está activa');
});

test('acuse perdido: termina en `desconocido` tras el timeout (no espera sin límite)', async () => {
  const t0 = Date.now();
  const r = await enviar(falso('perdido'), 'pregunta:enviar', { texto: 'x' }, 60);
  assert.equal(r.resultado, 'desconocido');
  assert.ok(Date.now() - t0 < 1000);
});

test('B: sin conexión el evento NO se emite (Socket.IO no lo guarda para reenviarlo solo)', async () => {
  const s = falso('ok', { conectado: false });
  const r = await enviar(s, 'pregunta:enviar', { texto: 'x' });
  assert.equal(r.resultado, 'no_enviado');
  assert.equal(s.emitidos.length, 0);
  assert.equal((await enviar(null, 'x', {})).resultado, 'no_enviado');
});

test('C: una respuesta posterior al timeout se ignora (resuelve una sola vez)', async () => {
  const r = await enviar(falso('tardio'), 'encuesta:responder', {}, 30);
  assert.equal(r.resultado, 'desconocido');
  await new Promise((x) => setTimeout(x, 150)); // el acuse tardío llega y no cambia nada ni lanza
});

test('A: voto aceptado con acuse perdido → el estado del servidor lo confirma (sin importar el orden de selección)', () => {
  const pend = { encuestaId: 'e1', ronda: 1, seleccion: [2, 0] };
  assert.equal(resolverVoto(pend, { id: 'e1', ronda: 1, estado: 'abierta', miSeleccion: [0, 2] }, true), 'confirmado');
});

test('B/A: voto no registrado: solo en una conexión nueva se afirma que no quedó; antes sigue pendiente', () => {
  const pend = { encuestaId: 'e1', ronda: 1, seleccion: [1] };
  const enc = { id: 'e1', ronda: 1, estado: 'abierta', miSeleccion: [] };
  assert.equal(resolverVoto(pend, enc, false), 'pendiente');
  assert.equal(resolverVoto(pend, enc, true), 'no_registrada');
});

test('D: cambió o terminó la ronda → la selección pendiente es obsoleta (no se conserva como válida)', () => {
  const pend = { encuestaId: 'e1', ronda: 1, seleccion: [1] };
  assert.equal(resolverVoto(pend, { id: 'e1', ronda: 2, estado: 'abierta', miSeleccion: [] }, true), 'obsoleta');
  assert.equal(resolverVoto(pend, { id: 'e2', ronda: 1, estado: 'abierta', miSeleccion: [] }, true), 'obsoleta');
  assert.equal(resolverVoto(pend, { id: 'e1', ronda: 1, estado: 'cerrada', miSeleccion: [] }, true), 'obsoleta');
  assert.equal(resolverVoto(pend, null, true), 'obsoleta');
  // Cerró pero el voto sí quedó: se confirma.
  assert.equal(resolverVoto(pend, { id: 'e1', ronda: 1, estado: 'cerrada', miSeleccion: [1] }, true), 'confirmado');
});

test('E: pregunta con acuse perdido: solo un indicio (propia, mismo texto, id nuevo), nunca una garantía', () => {
  const pend = { texto: '¿Qué es un socket?', idsAntes: ['q1'] };
  assert.equal(buscarPregunta(pend, [{ id: 'q1', propia: true, texto: '¿Qué es un socket?' }]), null, 'una anterior idéntica no cuenta');
  assert.equal(buscarPregunta(pend, [{ id: 'q2', propia: false, texto: '¿Qué es un socket?' }]), null, 'ajena no cuenta');
  assert.equal(buscarPregunta(pend, [{ id: 'q3', propia: true, texto: 'Otra' }]), null);
  assert.equal(buscarPregunta(pend, [{ id: 'q2', propia: true, texto: '¿Qué es un socket?' }]).id, 'q2');
});

test('pestañas: HTML coherente con el patrón ARIA (tablist, tab/panel asociados, tabindex móvil)', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div class="pestanas" role="tablist"/);
  assert.match(html, /id="tab-encuesta"[^>]*aria-selected="true"[^>]*aria-controls="panel-encuesta"[^>]*tabindex="0"/);
  assert.match(html, /id="tab-preguntas"[^>]*aria-selected="false"[^>]*aria-controls="panel-preguntas"[^>]*tabindex="-1"/);
  assert.match(html, /id="panel-encuesta" role="tabpanel" aria-labelledby="tab-encuesta"/);
  assert.match(html, /id="panel-preguntas" role="tabpanel" aria-labelledby="tab-preguntas"/);
});
