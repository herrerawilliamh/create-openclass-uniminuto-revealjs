/**
 * Foco, navegación y accesibilidad en Chrome real (Node >= 22) — I3.
 *  - mapa de foco de la pregunta activa: cerrar → publicar → repetir → cerrar → revelar → retirar;
 *  - el foco fuera de la tarjeta no se mueve; votos y apoyos no destruyen los nodos enfocados;
 *  - el orden por apoyos no se reaplica mientras se interactúa con la lista (y sí al salir);
 *  - la encuesta del estudiante no se rehace cuando solo cambian las preguntas;
 *  - etiquetas diferenciadas de las opciones improvisadas.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearAppPrueba, entornoPg } from '../ayuda.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';

const PASSWORD = 'clave-e2e-panel-foco';

async function montar(t) {
  const env = { SESSION_SECRET: 'foc'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), TRUST_PROXY: 'false' };
  const sondeo = await crearAppPrueba(leerConfig({ ...entornoPg(),  ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {} });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = await crearAppPrueba(leerConfig({ ...entornoPg(),  ...env, APP_URL: APP }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());
  const navegador = await abrirNavegador({ ancho: 1366, alto: 900 });
  t.after(() => navegador.cerrar());
  const panel = await navegador.pagina({ ancho: 1366, alto: 900 });

  const visible = (id) => `!document.getElementById('${id}').classList.contains('oculto')`;
  const abiertos = [];
  t.after(() => abiertos.forEach((s) => s.disconnect()));
  const p = {
    APP, panel, navegador, visible,
    activo: () => panel.evaluar(`document.activeElement.id || document.activeElement.tagName`),
    async entrar() {
      await panel.ir(`${APP}/docente/`);
      await panel.esperarA(visible('vista-login'));
      await panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(PASSWORD)}; document.getElementById('form-login').requestSubmit();`);
      await panel.esperarA(visible('vista-salas'));
      await panel.evaluar(`window.confirm = () => true; window.alert = () => {};`);
    },
    async crearSala(titulo) {
      await panel.evaluar(`document.getElementById('premoderacion').checked = false; document.getElementById('titulo-sala').value = ${JSON.stringify(titulo)}; document.getElementById('form-sala').requestSubmit();`);
      await panel.esperarA(`${visible('vista-sala')} && document.getElementById('titulo-panel').textContent === ${JSON.stringify(titulo)}`);
      return panel.evaluar(`document.getElementById('codigo-sala').textContent`);
    },
    /** Estudiante simulado por Socket.IO (no abre página). */
    async estudiante(codigo) {
      const s = io(`${APP}/participante`, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: { origin: APP }, auth: { codigo, alias: '', token: null } });
      abiertos.push(s);
      await new Promise((ok, mal) => { s.once('sesion', ok); s.once('connect_error', mal); });
      return s;
    },
    /** Pregunta con solución local; queda con la votación abierta. */
    async abrirPregunta(enunciado) {
      await panel.evaluar(`(() => { document.getElementById('composer').open = true;
        document.getElementById('enunciado').value = ${JSON.stringify(enunciado)};
        const filas = document.getElementById('opciones').children;
        filas[0].querySelector('input[type=text]').value = 'Primera'; filas[1].querySelector('input[type=text]').value = 'Segunda';
        filas[1].querySelector('input[type=checkbox]').checked = true;
        document.getElementById('explicacion').value = 'Explicación'; })()`);
      await panel.evaluar(`document.getElementById('form-encuesta').requestSubmit()`);
      await panel.esperarA(`document.getElementById('btn-cerrar')`);
    },
    /** Enfoca `id` y lo pulsa por código (no mueve el foco por sí mismo). */
    async pulsar(id) {
      await panel.evaluar(`document.getElementById('${id}').focus()`);
      assert.equal(await p.activo(), id, `foco inicial en ${id}`);
      await panel.evaluar(`document.getElementById('${id}').click()`);
    },
  };
  return p;
}

test('mapa de foco: cerrar → publicar → repetir → cerrar → publicar → revelar → retirar', { timeout: 180_000 }, async (t) => {
  const { panel, entrar, crearSala, abrirPregunta, pulsar, activo } = await montar(t);
  await entrar();
  await crearSala('Sala foco');
  await abrirPregunta('¿Mapa de foco?');
  const pasos = [
    ['btn-cerrar', 'btn-publicar'],
    ['btn-publicar', 'btn-ronda2'],     // ronda 1: la acción principal es repetir; «Revelar» queda como alternativa
    ['btn-ronda2', 'btn-cerrar'],
    ['btn-cerrar', 'btn-publicar'],
    ['btn-publicar', 'btn-revelar'],    // ronda 2: ya no hay «repetir»
    ['btn-revelar', 'btn-retirar'],
    ['btn-retirar', 'titulo-activa'],   // sin pregunta activa: el foco queda en el encabezado de la tarjeta
  ];
  for (const [desde, hasta] of pasos) {
    await pulsar(desde);
    await panel.esperarA(`document.activeElement.id === '${hasta}'`, { timeout: 15000 });
    assert.equal(await activo(), hasta, `${desde} → ${hasta}`);
  }
  assert.match(await panel.evaluar(`document.getElementById('titulo-activa').textContent`), /Sin votación en curso/);
});

test('un foco fuera de la tarjeta no se mueve cuando la tarjeta cambia', { timeout: 120_000 }, async (t) => {
  const { panel, entrar, crearSala, abrirPregunta, activo } = await montar(t);
  await entrar();
  await crearSala('Sala foco fuera');
  await abrirPregunta('¿Foco fuera?');
  await panel.evaluar(`document.getElementById('composer').open = true; document.getElementById('enunciado').focus()`);
  await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
  await panel.esperarA(`document.getElementById('btn-publicar')`);
  assert.equal(await activo(), 'enunciado', 'el foco sigue en el formulario');
  await panel.evaluar(`document.getElementById('btn-publicar').click()`);
  await panel.esperarA(`document.getElementById('btn-ronda2')`);
  assert.equal(await activo(), 'enunciado');
  await panel.evaluar(`document.getElementById('btn-retirar').click()`);
  await panel.esperarA(`document.getElementById('titulo-activa') && /Sin votación/.test(document.getElementById('titulo-activa').textContent)`);
  assert.equal(await activo(), 'enunciado');
});

test('votos y apoyos no destruyen los nodos enfocados; el orden por apoyos espera a que se salga de la lista', { timeout: 180_000 }, async (t) => {
  const { panel, entrar, crearSala, abrirPregunta, estudiante, activo } = await montar(t);
  await entrar();
  const codigo = await crearSala('Sala estable');
  await abrirPregunta('¿Se mantiene el foco?');
  const [e1, e2, e3, e4] = await Promise.all([1, 2, 3, 4].map(() => estudiante(codigo)));
  const estado = (await e1.emitWithAck('estado:solicitar', {})).estado;
  const encuestaId = estado.encuesta.id;

  // ---------- Votos con el foco en «Cerrar ahora»: el nodo es el mismo y el foco sigue ----------
  await panel.evaluar(`(() => { const b = document.getElementById('btn-cerrar'); b.focus(); b.__marca = 1;
    document.querySelector('#panel-activa .resultados').__marca = 1; document.getElementById('panel-activa').firstElementChild.__marca = 1; })()`);
  for (const [i, e] of [e1, e2, e3].entries()) {
    const r = await e.emitWithAck('encuesta:responder', { encuestaId, ronda: 1, seleccion: [i % 2] });
    assert.equal(r.ok, true);
  }
  await panel.esperarA(`document.getElementById('m-respuestas').textContent === '3'`);
  assert.equal(await panel.evaluar(`document.getElementById('btn-cerrar').__marca`), 1, 'el botón es el mismo nodo');
  assert.equal(await panel.evaluar(`document.querySelector('#panel-activa .resultados').__marca`), 1, 'las barras se actualizan en el sitio');
  assert.equal(await panel.evaluar(`document.getElementById('panel-activa').firstElementChild.__marca`), 1, 'la tarjeta no se rehizo');
  assert.equal(await activo(), 'btn-cerrar');

  // ---------- Lista de preguntas: apoyos y preguntas nuevas con el foco dentro ----------
  const q1 = (await e1.emitWithAck('pregunta:enviar', { texto: 'Pregunta uno' })).pregunta.id;
  const q2 = (await e2.emitWithAck('pregunta:enviar', { texto: 'Pregunta dos' })).pregunta.id;
  await panel.esperarA(`document.querySelectorAll('#lista-preguntas > li[data-clave]').length === 2`);
  const ordenIds = () => panel.evaluar(`[...document.querySelectorAll('#lista-preguntas > li[data-clave]')].map((li) => li.dataset.clave)`);
  assert.deepEqual(await ordenIds(), [q1, q2]);
  await panel.evaluar(`(() => { const li = document.querySelector('#lista-preguntas > li[data-clave="${q1}"]');
    const b = li.querySelector('[data-slot=proyeccion]'); b.focus(); b.__marca = 1; li.__marca = 1; })()`);
  await e3.emitWithAck('pregunta:votar', { preguntaId: q2 });
  await e4.emitWithAck('pregunta:votar', { preguntaId: q2 });
  await e1.emitWithAck('pregunta:votar', { preguntaId: q2 });
  const q3 = (await e3.emitWithAck('pregunta:enviar', { texto: 'Pregunta tres' })).pregunta.id;
  await panel.esperarA(`document.querySelectorAll('#lista-preguntas > li[data-clave]').length === 3`);
  await panel.esperarA(`document.querySelector('#lista-preguntas > li[data-clave="${q2}"] .votos b').textContent === '▲ 3'`);
  assert.deepEqual(await ordenIds(), [q1, q2, q3], 'con el foco dentro no se reordena; lo nuevo va al final');
  assert.equal(await panel.evaluar(`document.querySelector('#lista-preguntas > li[data-clave="${q1}"]').__marca`), 1, 'la pregunta enfocada conserva su nodo');
  assert.equal(await panel.evaluar(`document.activeElement.__marca`), 1, 'el foco sigue en el mismo botón');
  // Al salir de la lista se aplica el orden del servidor (más apoyada primero).
  await panel.evaluar(`document.activeElement.blur()`);
  await panel.esperarA(`document.querySelector('#lista-preguntas > li[data-clave]').dataset.clave === ${JSON.stringify(q2)}`);
  assert.equal((await ordenIds())[0], q2);

  // ---------- Moderación: el botón que desaparece pasa el foco al siguiente de la misma pregunta ----------
  const q4 = (await (await estudiante(codigo)).emitWithAck('pregunta:enviar', { texto: 'Pregunta cuatro' })).pregunta.id;
  await panel.esperarA(`document.querySelector('#lista-preguntas > li[data-clave="${q4}"]')`);
  await panel.evaluar(`document.querySelector('#lista-preguntas > li[data-clave="${q4}"] [data-slot=respondida]').focus()`);
  await panel.evaluar(`document.querySelector('#lista-preguntas > li[data-clave="${q4}"] [data-slot=respondida]').click()`);
  await panel.esperarA(`document.querySelector('#lista-preguntas > li[data-clave="${q4}"]').classList.contains('respondida')`);
  assert.equal(await panel.evaluar(`document.activeElement.closest('li').dataset.clave`), q4, 'el foco permanece en la misma pregunta');
  assert.equal(await panel.evaluar(`document.activeElement.tagName`), 'BUTTON');
});

test('estudiante: la encuesta no se rehace cuando solo cambian las preguntas ni se pierde el foco al apoyar', { timeout: 180_000 }, async (t) => {
  const { panel, navegador, entrar, crearSala, abrirPregunta, estudiante, APP } = await montar(t);
  await entrar();
  const codigo = await crearSala('Sala estudiante');
  await abrirPregunta('¿Se rehace la encuesta?');
  const alumno = await navegador.pagina({ ancho: 390, alto: 800 });
  await alumno.ir(`${APP}/join/${codigo}`);
  await alumno.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto') && document.querySelector('#panel-encuesta input[name=opcion]')`);
  const otro1 = await estudiante(codigo), otro2 = await estudiante(codigo), otro3 = await estudiante(codigo);

  // La estudiante tiene el foco en una opción; el resto de la clase pregunta y apoya.
  await alumno.evaluar(`(() => { const r = document.querySelector('#panel-encuesta input[name=opcion][value="1"]'); r.focus(); r.__marca = 1;
    document.querySelector('#panel-encuesta .enunciado').__marca = 1; })()`);
  const q1 = (await otro1.emitWithAck('pregunta:enviar', { texto: 'Duda de otro compañero' })).pregunta.id;
  await alumno.esperarA(`document.querySelector('#lista-preguntas > li[data-clave="${q1}"]')`);
  assert.equal(await alumno.evaluar(`document.querySelector('#panel-encuesta .enunciado').__marca`), 1, 'una pregunta nueva no rehace la encuesta');
  assert.equal(await alumno.evaluar(`document.activeElement.__marca`), 1, 'el foco sigue en la opción');

  // Foco en «Apoyar»: los apoyos de otros actualizan el contador sin cambiar el nodo ni el foco.
  await alumno.evaluar(`(() => { const b = document.querySelector('#lista-preguntas > li[data-clave="${q1}"] button'); b.focus(); b.__marca = 1; })()`);
  await otro2.emitWithAck('pregunta:votar', { preguntaId: q1 });
  await otro3.emitWithAck('pregunta:votar', { preguntaId: q1 });
  await alumno.esperarA(`document.querySelector('#lista-preguntas > li[data-clave="${q1}"] button').textContent === '▲ 2'`);
  assert.equal(await alumno.evaluar(`document.activeElement.__marca`), 1, 'el botón de apoyo conserva nodo y foco');
  assert.equal(await alumno.evaluar(`document.querySelector('#panel-encuesta .enunciado').__marca`), 1);

  // Si la encuesta SÍ cambia (se cierra), la tarjeta se rehace y el foco cae en el enunciado, no se pierde.
  await alumno.evaluar(`document.querySelector('#panel-encuesta input[name=opcion][value="1"]').focus()`);
  await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
  await alumno.esperarA(`/Votación cerrada/.test(document.getElementById('panel-encuesta').textContent)`);
  assert.equal(await alumno.evaluar(`document.activeElement.classList.contains('enunciado')`), true, 'el foco queda en el enunciado de la tarjeta');
});

test('opciones improvisadas: etiquetas diferenciadas y foco al quitar', { timeout: 120_000 }, async (t) => {
  const { panel, entrar, crearSala } = await montar(t);
  await entrar();
  await crearSala('Sala etiquetas');
  await panel.evaluar(`document.getElementById('composer').open = true`);
  const etiquetas = () => panel.evaluar(`[...document.getElementById('opciones').children].map((f) => [
    f.querySelector('input[type=text]').getAttribute('aria-label'), f.querySelector('input[type=checkbox]').getAttribute('aria-label'), f.querySelector('button').getAttribute('aria-label')])`);
  assert.deepEqual(await etiquetas(), ['A', 'B', 'C', 'D'].map((l) => [`Opción ${l}`, `Respuesta correcta de ${l}`, `Quitar opción ${l}`]));
  // Quitar «B» desde el teclado: las etiquetas se reasignan y el foco pasa a la opción que ocupa su lugar.
  await panel.evaluar(`(() => { const b = document.getElementById('opciones').children[1].querySelector('button'); b.focus(); b.click(); })()`);
  assert.deepEqual(await etiquetas(), ['A', 'B', 'C'].map((l) => [`Opción ${l}`, `Respuesta correcta de ${l}`, `Quitar opción ${l}`]));
  assert.equal(await panel.evaluar(`document.activeElement === document.getElementById('opciones').children[1].querySelector('input[type=text]')`), true);
  // «+ Opción» conserva el foco en su botón y la nueva fila nace etiquetada.
  await panel.evaluar(`document.getElementById('btn-mas').focus(); document.getElementById('btn-mas').click()`);
  assert.equal(await panel.evaluar(`document.activeElement.id`), 'btn-mas');
  assert.equal((await etiquetas())[3][0], 'Opción D');
  // Compatibilidad con las pruebas existentes: seguimos exponiendo input[type=text] / input[type=checkbox] por fila.
  assert.equal(await panel.evaluar(`document.querySelectorAll('#opciones input[type=text]').length`), 4);
});
