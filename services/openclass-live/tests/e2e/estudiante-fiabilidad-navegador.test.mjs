/**
 * Vista del estudiante en Chrome real (Node >= 22): confiabilidad de acuses, pestañas accesibles y selección (I5).
 * Servidor real + docente por Socket.IO (Node). Los fallos de acuse se simulan en el cliente envolviendo
 * `socket.timeout(ms).emit`, sin tocar el servidor ni el protocolo:
 *  - 'aceptado_sin_acuse': el servidor recibe el evento pero el acuse nunca llega (y uno tardío se ignora);
 *  - 'perdido': el evento no llega al servidor y el acuse tampoco.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as cliente } from 'socket.io-client';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearApp } from '../../src/app.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';
import { PASSWORD, peticion, pedir, esperar } from '../ayuda.mjs';

const SIMULADOR = `(() => {
  const cfg = () => { try { return JSON.parse(sessionStorage.getItem('t:cfg')) ?? {}; } catch { return {}; } };
  window.__emitidos = []; window.__errs = [];
  addEventListener('error', (e) => window.__errs.push(String(e.message)));
  addEventListener('unhandledrejection', (e) => window.__errs.push(String(e.reason)));
  let real;
  Object.defineProperty(window, 'io', { configurable: true, get: () => real, set: (v) => {
    real = (...a) => {
      const s = v(...a); window.__sock = s;
      const original = s.timeout.bind(s);
      s.timeout = (ms) => { const q = original(ms); return { emit: (ev, d, cb) => {
        const c = cfg(); const modo = (c.ev ?? {})[ev]; const demora = c.demora ?? 300;
        window.__emitidos.push({ ev, modo: modo ?? 'normal' });
        if (modo === 'aceptado_sin_acuse') {
          s.emit(ev, d, () => {}); // el servidor lo recibe, el acuse real se descarta
          setTimeout(() => cb(new Error('timeout')), demora);
          setTimeout(() => cb(null, { ok: true, respuesta: { respuesta: { seleccion: d.seleccion }, pregunta: { id: 'x', estado: 'visible' } } }), demora + 400);
        } else if (modo === 'perdido') setTimeout(() => cb(new Error('timeout')), demora);
        else q.emit(ev, d, cb);
      } }; };
      return s;
    };
    Object.assign(real, v);
  } });
})();`;

async function montar(t) {
  const env = { SESSION_SECRET: 'est'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), TRUST_PROXY: 'false' };
  const sondeo = crearApp(leerConfig({ ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {} });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = crearApp(leerConfig({ ...env, APP_URL: APP }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());

  const login = await peticion(`${APP}/api/docente/login`, { metodo: 'POST', cuerpo: { password: PASSWORD }, origen: APP });
  assert.equal(login.estado, 200);
  const cookie = login.cabeceras['set-cookie'][0].split(';')[0];
  const doc = cliente(`${APP}/docente`, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: { origin: APP, cookie } });
  t.after(() => doc.disconnect());
  await new Promise((ok, mal) => { doc.once('sesion', ok); doc.once('connect_error', mal); });
  const sala = (await pedir(doc, 'sala:crear', { titulo: 'Sala estudiante I5', preModeracion: false })).sala;
  const ENC = { enunciado: '¿Qué protocolo usa Socket.IO?', tipo: 'unica', opciones: ['HTTP', 'WebSocket', 'FTP'] };
  const abrirEncuesta = async (extra = {}) => (await pedir(doc, 'encuesta:crear', { salaId: sala.id, encuesta: { ...ENC, ...extra }, abrir: true })).encuesta;

  const navegador = await abrirNavegador({ ancho: 390, alto: 800 });
  t.after(() => navegador.cerrar());
  const A = await navegador.pagina({ ancho: 390, alto: 800 });
  await A.send('Page.addScriptToEvaluateOnNewDocument', { source: SIMULADOR });
  await A.ir(`${APP}/join/${sala.codigo}`);
  await A.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto')`);

  const q = (js) => A.evaluar(js);
  const h = {
    APP, A, doc, sala, abrirEncuesta, q,
    cfg: (c) => q(`sessionStorage.setItem('t:cfg', ${JSON.stringify(JSON.stringify(c))})`),
    texto: (sel) => q(`document.querySelector(${JSON.stringify(sel)})?.textContent ?? ''`),
    emitidos: (ev) => q(`window.__emitidos.filter((e) => e.ev === ${JSON.stringify(ev)}).length`),
    marcada: () => q(`[...document.querySelectorAll('input[name=opcion]')].map((x) => x.checked)`),
    elegir: (i) => q(`document.querySelectorAll('input[name=opcion]')[${i}].click()`),
    enviarVoto: () => q(`document.getElementById('btn-enviar').click()`),
    esperar: async (expr, timeout) => {
      try { await A.esperarA(expr, { timeout: timeout ?? 20000 }); } catch (e) {
        const d = await q(`JSON.stringify({ errs: window.__errs, envio: document.getElementById('estado-envio')?.textContent, aviso: document.getElementById('aviso-pregunta')?.textContent, btn: document.getElementById('btn-enviar')?.textContent, con: document.getElementById('conexion').textContent })`).catch(() => '?');
        throw new Error(e.message + ' :: ' + d);
      }
    },
    conSocket: async (sala2 = sala) => {
      const s = cliente(`${APP}/participante`, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: { origin: APP }, auth: { codigo: sala2.codigo, alias: 'otro', token: null } });
      t.after(() => s.disconnect());
      await new Promise((ok, mal) => { s.once('sesion', ok); s.once('connect_error', mal); });
      return s;
    },
  };
  return h;
}

test('A–C: acuse recibido, acuse perdido tras aceptar, acuse perdido antes de aceptar y respuesta tardía', { timeout: 120_000 }, async (t) => {
  const h = await montar(t);
  const { A, abrirEncuesta, cfg, texto, emitidos, marcada, elegir, enviarVoto, esperar: esp } = h;
  await abrirEncuesta();
  await esp(`document.querySelectorAll('input[name=opcion]').length === 3`);

  // Acuse recibido.
  await elegir(1); await enviarVoto();
  await esp(`/Respuesta registrada/.test(document.getElementById('estado-envio').textContent)`);
  assert.equal(await texto('#btn-enviar'), 'Actualizar respuesta');
  assert.equal(await emitidos('encuesta:responder'), 1);

  // A: el servidor acepta el cambio de voto pero el acuse se pierde → «Enviando…», luego verificación y confirmación sin reenviar.
  await cfg({ ev: { 'encuesta:responder': 'aceptado_sin_acuse' }, demora: 600 });
  await elegir(2); await enviarVoto();
  await esp(`document.getElementById('btn-enviar').getAttribute('aria-busy') === 'true'`);
  assert.equal(await texto('#btn-enviar'), 'Enviando…');
  assert.equal(await A.evaluar(`document.getElementById('btn-enviar').disabled`), true, 'el botón se bloquea mientras espera');
  await enviarVoto(); // doble clic accidental: el botón está deshabilitado, no emite
  await esp(`/Respuesta registrada/.test(document.getElementById('estado-envio').textContent) && !document.getElementById('btn-enviar').disabled`);
  assert.deepEqual(await marcada(), [false, false, true], 'la selección se conserva y coincide con lo confirmado');
  await esperar(700); // C: el acuse tardío (después del timeout) llega y no cambia nada
  assert.equal(await emitidos('encuesta:responder'), 2, 'un único envío por acción: sin reenvío automático');
  assert.match(await texto('#estado-envio'), /Respuesta registrada/);
  assert.equal(await A.evaluar(`document.getElementById('btn-enviar').disabled`), false, 'controles reactivados');

  // B: el evento se pierde antes de que el servidor lo acepte → resultado conocido tras reconectar, selección conservada.
  await cfg({ ev: { 'encuesta:responder': 'perdido' }, demora: 300 });
  await elegir(0); await enviarVoto();
  await esp(`/no registr/.test(document.getElementById('estado-envio').textContent)`);
  assert.deepEqual(await marcada(), [true, false, false], 'selección conservada mientras no se confirma');
  assert.equal(await A.evaluar(`document.getElementById('btn-enviar').disabled`), false, 'puede reintentar con un clic explícito');
  assert.equal(await emitidos('encuesta:responder'), 3);
  // El reintento (acción del usuario) sí llega y se confirma.
  await cfg({});
  await enviarVoto();
  await esp(`/Respuesta registrada/.test(document.getElementById('estado-envio').textContent)`);
  assert.equal(await emitidos('encuesta:responder'), 4);
  assert.deepEqual(await marcada(), [true, false, false]);
});

test('D: la votación termina mientras el cliente espera → la selección pendiente ya no se presenta como válida', { timeout: 120_000 }, async (t) => {
  const h = await montar(t);
  const { A, abrirEncuesta, cfg, texto, marcada, elegir, enviarVoto, esperar: esp, doc, sala } = h;
  const enc = await abrirEncuesta();
  await esp(`document.querySelectorAll('input[name=opcion]').length === 3`);
  await cfg({ ev: { 'encuesta:responder': 'perdido' }, demora: 1500 });
  await elegir(1); await enviarVoto();
  await esp(`document.getElementById('btn-enviar').getAttribute('aria-busy') === 'true'`);
  await pedir(doc, 'encuesta:cerrar', { salaId: sala.id, encuestaId: enc.id }); // termina mientras espera
  await esp(`/Votación cerrada/.test(document.getElementById('panel-encuesta').textContent)`);
  await esp(`/cambió o terminó/.test(document.getElementById('aviso-sala').textContent)`);
  assert.match(await texto('#aviso-sala'), /ya no aplica/);
  assert.equal(await A.evaluar(`document.querySelector('input[name=opcion]').disabled`), true);
  assert.equal(await A.evaluar(`document.getElementById('btn-enviar')?.disabled ?? true`), true);
  // Una encuesta nueva no hereda la selección anterior.
  await h.abrirEncuesta({ enunciado: 'Otra pregunta distinta' });
  await esp(`/Otra pregunta distinta/.test(document.getElementById('panel-encuesta').textContent)`);
  assert.deepEqual(await marcada(), [false, false, false]);
  void esperar;
});

test('E: acuse perdido en pregunta:enviar → estado desconocido, texto conservado, sin reenvío automático ni falsa confirmación', { timeout: 120_000 }, async (t) => {
  const h = await montar(t);
  const { A, cfg, texto, emitidos, esperar: esp } = h;
  await A.evaluar(`document.getElementById('tab-preguntas').click()`);
  const escribir = (v) => A.evaluar(`(() => { const t = document.getElementById('texto-pregunta'); t.value = ${JSON.stringify(v)}; t.dispatchEvent(new Event('input')); })()`);
  const enviarForm = () => A.evaluar(`document.getElementById('form-pregunta').requestSubmit()`);

  // El servidor la registra pero el acuse se pierde: no se afirma «registrada»; se encuentra el indicio tras reconectar.
  await cfg({ ev: { 'pregunta:enviar': 'aceptado_sin_acuse' }, demora: 600 });
  await escribir('¿Cómo funciona el acuse?');
  await enviarForm();
  await esp(`document.getElementById('btn-preguntar').getAttribute('aria-busy') === 'true'`);
  assert.equal(await texto('#btn-preguntar'), 'Enviando…');
  await enviarForm(); // Enter repetido durante el envío: ignorado
  await esp(`/probablemente ya se registr/.test(document.getElementById('aviso-pregunta').textContent)`);
  assert.equal(await A.evaluar(`document.getElementById('texto-pregunta').value`), '¿Cómo funciona el acuse?', 'el borrador no se borra sin confirmación');
  assert.equal(await emitidos('pregunta:enviar'), 1, 'sin reenvío automático');
  assert.doesNotMatch(await texto('#aviso-pregunta'), /^Pregunta (enviada|publicada)/);
  assert.equal(await A.evaluar(`!document.getElementById('recuperacion-pregunta').classList.contains('oculto')`), true);
  await A.evaluar(`document.getElementById('btn-descartar-pregunta').click()`);
  assert.equal(await A.evaluar(`document.getElementById('texto-pregunta').value`), '');

  // El evento se pierde antes de llegar: no aparece en la lista; el texto se conserva y se ofrece reenviar.
  await cfg({ ev: { 'pregunta:enviar': 'perdido' }, demora: 300 });
  await escribir('Pregunta que no llegó');
  await enviarForm();
  await esp(`/probablemente no se registr/.test(document.getElementById('aviso-pregunta').textContent)`);
  assert.equal(await A.evaluar(`document.getElementById('texto-pregunta').value`), 'Pregunta que no llegó');
  assert.equal(await texto('#btn-preguntar'), 'Enviar de nuevo');
  assert.equal(await emitidos('pregunta:enviar'), 2);
  // Reenvío explícito del usuario: ahora sí se confirma y se limpia.
  await cfg({});
  await esperar(15_500); // el servidor limita una pregunta cada 15 s por persona
  await enviarForm();
  await esp(`/Pregunta (enviada|publicada)/.test(document.getElementById('aviso-pregunta').textContent)`);
  assert.equal(await A.evaluar(`document.getElementById('texto-pregunta').value`), '');
  assert.equal(await emitidos('pregunta:enviar'), 3);
});

test('C(selección): se conserva ante preguntas nuevas, otros votos, reconexión y actualización de resultados', { timeout: 120_000 }, async (t) => {
  const h = await montar(t);
  const { A, abrirEncuesta, marcada, elegir, enviarVoto, esperar: esp, q } = h;
  const enc = await abrirEncuesta();
  await esp(`document.querySelectorAll('input[name=opcion]').length === 3`);
  await elegir(1); // seleccionada, aún sin enviar
  const otro = await h.conSocket();
  await pedir(otro, 'pregunta:enviar', { texto: 'Pregunta de otra persona' });
  await esp(`/Pregunta de otra persona/.test(document.getElementById('lista-preguntas').textContent)`);
  assert.equal((await pedir(otro, 'encuesta:responder', { encuestaId: enc.id, ronda: 1, seleccion: [0] })).ok, true);
  assert.deepEqual(await marcada(), [false, true, false], 'preguntas y votos ajenos no tocan la selección local');
  await q(`void window.__sock.disconnect().connect()`); // reconexión
  await esp(`document.getElementById('conexion').textContent === 'Conectado'`);
  await esperar(300);
  assert.deepEqual(await marcada(), [false, true, false], 'la reconexión conserva la selección local sin enviar');
  await enviarVoto();
  await esp(`/Respuesta registrada/.test(document.getElementById('estado-envio').textContent)`);
  await q(`void window.__sock.disconnect().connect()`);
  await esperar(500);
  assert.deepEqual(await marcada(), [false, true, false], 'tras reconectar se restaura miSeleccion del servidor');
  assert.equal(await q(`localStorage.getItem('oclive:${h.sala.codigo}') !== null`), true, 'contrato oclive:<codigo> intacto');
  assert.equal(await q(`Object.keys(JSON.parse(localStorage.getItem('oclive:${h.sala.codigo}'))).includes('token')`), true);
  void A;
});

test('pestañas: flechas, Inicio/Fin, aria-selected, tabindex, asociación tab/panel, foco estable, clic y toque', { timeout: 120_000 }, async (t) => {
  const h = await montar(t);
  const { A, q, esperar: esp } = h;
  const estadoPestanas = () => q(`['tab-encuesta','tab-preguntas'].map((id) => { const t = document.getElementById(id); const p = document.getElementById(t.getAttribute('aria-controls'));
    return { id, sel: t.getAttribute('aria-selected'), idx: t.tabIndex, panelVisible: !p.classList.contains('oculto'), rotulado: p.getAttribute('aria-labelledby') === id, foco: document.activeElement === t }; })`);
  assert.equal(await q(`document.querySelector('[role=tablist]').getAttribute('aria-label')`), 'Secciones');
  let e = await estadoPestanas();
  assert.deepEqual(e.map((x) => [x.sel, x.idx, x.panelVisible, x.rotulado]), [['true', 0, true, true], ['false', -1, false, true]]);

  await q(`document.getElementById('tab-encuesta').focus()`);
  await A.tecla('ArrowRight', { code: 'ArrowRight', keyCode: 39 });
  e = await estadoPestanas();
  assert.deepEqual(e.map((x) => [x.sel, x.idx, x.panelVisible, x.foco]), [['false', -1, false, false], ['true', 0, true, true]], 'flecha derecha activa y enfoca');
  await A.tecla('ArrowRight', { code: 'ArrowRight', keyCode: 39 });
  assert.equal((await estadoPestanas())[0].sel, 'true', 'la flecha derecha da la vuelta');
  await A.tecla('ArrowLeft', { code: 'ArrowLeft', keyCode: 37 });
  assert.equal((await estadoPestanas())[1].foco, true, 'la flecha izquierda da la vuelta');
  await A.tecla('Home', { code: 'Home', keyCode: 36 });
  e = await estadoPestanas();
  assert.equal(e[0].foco && e[0].sel === 'true', true);
  await A.tecla('End', { code: 'End', keyCode: 35 });
  e = await estadoPestanas();
  assert.equal(e[1].foco && e[1].sel === 'true' && e[1].panelVisible && !e[0].panelVisible, true);

  // Tab desde la pestaña activa lleva al contenido (solo una pestaña está en el orden de tabulación).
  await A.tecla('Tab', { code: 'Tab', keyCode: 9 });
  assert.equal(await q(`document.getElementById('panel-preguntas').contains(document.activeElement)`), true);

  // Clic/toque: cambia sin perder la coherencia ARIA.
  const caja = await q(`(() => { const r = document.getElementById('tab-encuesta').getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await A.clic(caja[0], caja[1]);
  e = await estadoPestanas();
  assert.deepEqual(e.map((x) => [x.sel, x.idx, x.panelVisible]), [['true', 0, true], ['false', -1, false]]);
  void esp;
});
