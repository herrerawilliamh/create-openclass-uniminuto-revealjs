/**
 * Build Tech: lógica pura sin navegador (puente local, marcadores de notas, tiempo de clase, YouTube).
 * El recorrido completo en Chrome real está en services/openclass-live/tests/e2e/build-tech-navegador.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PROTOCOLO, VERSION, mensajeDe, sobre, urlVista, validarOrden } from '../template/src/plugins/puente.mjs';
import { marcadorDe, notasSeguras } from '../template/src/plugins/notas.mjs';
import { esYoutube, urlYoutubeControlable } from '../template/src/plugins/multimedia.mjs';
import { firmaEncuesta } from '../template/src/plugins/encuesta.mjs';
import { configurar, fase, formatoReloj, iniciar, leerTiempo, nuevoTiempo, pausar, reiniciar, restante, transcurrido } from '../template/src/buildtech/tiempo.mjs';

test('puente: solo órdenes explícitas de la lista cerrada, con argumentos acotados', () => {
  assert.deepEqual(validarOrden({ ambito: 'navegar', accion: 'siguiente' }), { ambito: 'navegar', accion: 'siguiente' });
  assert.deepEqual(validarOrden({ ambito: 'medio', medio: 'm0', accion: 'buscar', valor: 12.5 }), { ambito: 'medio', accion: 'buscar', medio: 'm0', valor: 12.5 });
  assert.deepEqual(validarOrden({ ambito: 'live', accion: 'duracion', valor: 30 }), { ambito: 'live', accion: 'duracion', valor: 30 });
  assert.deepEqual(validarOrden({ ambito: 'live', accion: 'moderar', valor: { preguntaId: 'q1', accion: 'aprobar', extra: 1 } }),
    { ambito: 'live', accion: 'moderar', valor: { preguntaId: 'q1', accion: 'aprobar' } }, 'los campos extra se descartan');
  for (const mala of [
    null, 'siguiente', [], { ambito: 'navegar', accion: 'eval' }, { ambito: 'deck', accion: 'setState' },
    { ambito: 'medio', medio: '../x', accion: 'reproducir' }, { ambito: 'medio', medio: 'm0', accion: 'buscar', valor: -1 },
    { ambito: 'medio', medio: 'm0', accion: 'volumen', valor: 2 }, { ambito: 'medio', medio: 'm0', accion: 'silencio', valor: 'si' },
    { ambito: 'live', accion: 'conectar', valor: 'clave' }, { ambito: 'live', accion: 'duracion', valor: 45 },
    { ambito: 'live', accion: 'moderar', valor: { preguntaId: 'q1', accion: 'bloquearAutor' } }, { ambito: 'reloj', accion: 'publico', valor: 1 },
  ]) assert.equal(validarOrden(mala), null, `rechaza ${JSON.stringify(mala)}`);
});

test('puente: el mensaje debe venir del mismo origen, de la ventana esperada y con el protocolo', () => {
  const ventana = {};
  const ok = { origin: 'http://localhost:5173', source: ventana, data: sobre('hola') };
  assert.equal(mensajeDe(ok, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' })?.tipo, 'hola');
  assert.equal(mensajeDe({ ...ok, origin: 'https://otro.example' }, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' }), null, 'otro origen');
  assert.equal(mensajeDe({ ...ok, source: {} }, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' }), null, 'otra ventana');
  assert.equal(mensajeDe({ ...ok, data: { ...ok.data, protocolo: 'x' } }, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' }), null, 'otro protocolo');
  assert.equal(mensajeDe({ ...ok, data: { ...ok.data, version: VERSION + 1 } }, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' }), null, 'otra versión');
  assert.equal(mensajeDe({ ...ok, data: sobre('estado') }, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' }), null, 'Build Tech no envía estado');
  assert.equal(mensajeDe({ ...ok, data: sobre('orden') }, { origen: 'http://localhost:5173', esperada: ventana, de: 'presentacion' }), null, 'la presentación no envía órdenes');
  assert.equal(mensajeDe({ ...ok, data: JSON.stringify(sobre('hola')) }, { origen: 'http://localhost:5173', esperada: ventana, de: 'build-tech' }), null, 'solo objetos planos');
  assert.equal(mensajeDe(ok, { origen: 'http://localhost:5173', esperada: () => false, de: 'build-tech' }), null, 'función de autorización');
  assert.equal(sobre('hola').protocolo, PROTOCOLO);
});

test('puente: las URL de las vistas no llevan secretos ni el hash de la presentación', () => {
  const loc = { pathname: '/semanas/pds_semana1/', search: '?x=1', hash: '#/3' };
  assert.equal(urlVista(loc, 'build-tech'), '/semanas/pds_semana1/?oc-vista=build-tech');
  const previa = urlVista(loc, 'previa');
  assert.match(previa, /^\/semanas\/pds_semana1\/\?receiver&/);
  assert.match(previa, /keyboard=false/);
  assert.doesNotMatch(previa, /clave|#|x=1/);
});

test('notas: marcadores explícitos de lectura, ancla y acción', () => {
  assert.deepEqual(marcadorDe('[[2]] Comentar'), { paso: 2, largo: 6 });
  assert.deepEqual(marcadorDe('  [[ #red ]] Señalar'), { ancla: 'red', largo: 13 });
  assert.deepEqual(marcadorDe('[[#video:reproducir]] Ver'), { ancla: 'video', accion: 'reproducir', largo: 22 });
  for (const no of ['Texto [[2]] en medio', '[[#1x]]', '[[#red:borrar]]', '[[abc]]', '[2]', '']) assert.equal(marcadorDe(no), null, no);
  const bloques = notasSeguras('[[0]] Inicio\n\n[[#mapa]] Mapa <script>x</script>\n\nNormal', { esTexto: true });
  assert.deepEqual(bloques.map((b) => [b.paso, b.ancla, b.texto.map((s) => s.t).join('')]), [[0, undefined, 'Inicio'], [undefined, 'mapa', 'Mapa <script>x</script>'], [undefined, undefined, 'Normal']],
    'el texto queda como texto (se pinta con textContent)');
});

test('tiempo de clase: iniciar, pausar, reanudar, exceder y reiniciar sin perder la duración', () => {
  let t = nuevoTiempo(45);
  assert.equal(fase(t, 0), 'lista');
  t = iniciar(t, 1_000);
  assert.equal(transcurrido(t, 61_000), 60_000);
  t = pausar(t, 61_000);
  assert.equal(fase(t, 999_999), 'pausada');
  assert.equal(transcurrido(t, 999_999), 60_000, 'en pausa no avanza');
  t = iniciar(t, 100_000);
  assert.equal(restante(t, 100_000), 45 * 60_000 - 60_000);
  assert.equal(fase(t, 100_000 + 45 * 60_000), 'excedida', 'al pasar la duración solo cambia la fase (aviso)');
  t = configurar(t, 90);
  assert.equal(transcurrido(t, 100_000), 60_000, 'cambiar la duración no reinicia');
  assert.equal(configurar(t, 2).duracionMin, 90, 'duración fuera de rango ignorada');
  assert.deepEqual(reiniciar(t), nuevoTiempo(90));
  assert.deepEqual(leerTiempo({ duracionMin: 'x', acumulado: -5, desde: 'y' }), nuevoTiempo(60), 'almacenamiento dañado');
  assert.deepEqual(leerTiempo({ duracionMin: 60, acumulado: 5000, desde: 77 }), { duracionMin: 60, acumulado: 5000, desde: 77 });
  assert.equal(formatoReloj(75_000), '1:15');
  assert.equal(formatoReloj(3_723_000), '1:02:03');
  assert.equal(formatoReloj(-61_000), '+1:01');
});

test('YouTube: solo los iframes de YouTube se preparan para la API oficial', () => {
  assert.ok(esYoutube('https://www.youtube-nocookie.com/embed/abc'));
  assert.ok(esYoutube('https://www.youtube.com/embed/abc?start=10'));
  assert.ok(!esYoutube('https://player.vimeo.com/video/1'));
  assert.ok(!esYoutube('https://evil.example/www.youtube.com/embed/x'));
  const u = new URL(urlYoutubeControlable('https://www.youtube.com/embed/abc?start=10', 'http://localhost:5173'));
  assert.equal(u.searchParams.get('enablejsapi'), '1');
  assert.equal(u.searchParams.get('origin'), 'http://localhost:5173');
  assert.equal(u.searchParams.get('start'), '10', 'conserva los parámetros del docente');
  assert.equal(urlYoutubeControlable(u.toString(), 'http://localhost:5173'), u.toString(), 'idempotente');
});

test('encuestas: la identidad incluye el código; el espaciado no la cambia', () => {
  const base = { enunciado: '¿Qué imprime?', tipo: 'unica', opciones: ['1', '2', 'error'] };
  const a = firmaEncuesta({ ...base, codigo: 'console.log(1)' });
  assert.notEqual(a, firmaEncuesta({ ...base, codigo: 'console.log(2)' }), 'mismo enunciado y opciones, distinto código');
  assert.notEqual(a, firmaEncuesta(base), 'con y sin código');
  assert.equal(a, firmaEncuesta({ ...base, codigo: 'console.log(1)\n', correctas: [0] }), 'la guardada en el servidor (sin solución) coincide');
  assert.equal(firmaEncuesta(base), firmaEncuesta({ ...base, codigo: '' }), 'el servidor guarda «sin código» como cadena vacía');
});
