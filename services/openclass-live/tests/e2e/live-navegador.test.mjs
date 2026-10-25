/**
 * OpenClass Live — extremo a extremo en Chrome real (Node >= 22):
 *  1. levanta el servicio en 127.0.0.1;
 *  2. crea un curso temporal con el CLI del repositorio maestro, activa LIVE en SU copia de fase2.mjs y
 *     añade a SU slides.md una diapositiva con encuesta (la plantilla y los cursos reales no se tocan);
 *  3. docente (panel), presentación Reveal.js local y dos estudiantes móviles en perfiles separados;
 *  4. verifica QR, encuesta en dos rondas, revelación, pregunta proyectada y que la presentación
 *     solo envió la encuesta abierta (sin Markdown, notas ni otras diapositivas).
 * Variables: OPENCLASS_LIVE_DIST=<dist ya compilado> para no recompilar; OPENCLASS_CAPTURAS=<dir> guarda PNG.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { servir } from '../../../../scripts/lib/servidor.mjs';
import { crearApp } from '../../src/app.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const PASSWORD = 'clave-e2e-docente-openclass';
const MARCADORES = ['MARCADOR-DIAPOSITIVA-PRIVADA', 'NOTA-PRIVADA-PRESENTADOR', 'Presentar la asignatura', 'fondos/slide-'];
const CAPTURAS = process.env.OPENCLASS_CAPTURAS;
const npm = (cwd, ...a) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SITE_BASE: '/' } });

const DIAPOSITIVAS = `
---

## Pregunta en vivo
<!-- .slide: id="encuesta-live" class="oc-demo oc-l-text" -->

<div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
<p class="oc-live-enunciado">¿Qué método une un socket a una sala en Socket.IO?</p>
<ol class="oc-live-opciones">
<li>socket.enter()</li>
<li>socket.join()</li>
<li>io.attach()</li>
</ol>
<div class="oc-live-explicacion">socket.join agrega el socket a una room del namespace.<pre><code>socket.join("sala");</code></pre></div>
</div>

Notes:
NOTA-PRIVADA-PRESENTADOR: no debe salir del computador.

---

## Diapositiva privada
<!-- .slide: class="oc-demo oc-l-text" -->

MARCADOR-DIAPOSITIVA-PRIVADA
`;

function prepararCurso(servidorLive) {
  if (process.env.OPENCLASS_LIVE_DIST) return { dist: process.env.OPENCLASS_LIVE_DIST, limpiar: () => {} };
  const temporal = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-live-e2e-')));
  const curso = path.join(temporal, 'curso-live');
  const crear = spawnSync(process.execPath, [path.join(RAIZ, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { stdio: 'inherit' });
  assert.equal(crear.status, 0, 'el CLI crea el curso temporal');
  const fase2 = path.join(curso, 'src/plugins/fase2.mjs');
  const original = readFileSync(fase2, 'utf8');
  const activado = original.replace(/activa: false,\n  servidor: '[^']*'/, `activa: true,\n  servidor: '${servidorLive}'`);
  assert.notEqual(activado, original, 'LIVE se activa en la copia temporal');
  writeFileSync(fase2, activado);
  const slides = path.join(curso, 'slides.md');
  const md = readFileSync(slides, 'utf8');
  const corte = md.lastIndexOf('\n---\n');
  writeFileSync(slides, `${md.slice(0, corte)}\n${DIAPOSITIVAS}${md.slice(corte)}`);
  assert.equal(npm(curso, 'install', '--no-audit', '--no-fund').status, 0);
  assert.equal(npm(curso, 'run', 'build:all').status, 0);
  const dist = path.join(curso, 'dist');
  if (process.env.OPENCLASS_LIVE_CONSERVAR) { console.log(`Curso conservado: OPENCLASS_LIVE_DIST=${dist}`); return { dist, limpiar: () => {} }; }
  return { dist, limpiar: () => rmSync(temporal, { recursive: true, force: true }) };
}

function puertoCompilado(dist) {
  const assets = path.join(dist, 'assets');
  for (const f of readdirSync(assets).filter((n) => n.endsWith('.js'))) {
    const m = /servidor:"http:\/\/127\.0\.0\.1:(\d+)"/.exec(readFileSync(path.join(assets, f), 'utf8'));
    if (m) return m[1];
  }
  return null;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
async function pulsar(pagina, texto, ambito = 'document') {
  const ok = await pagina.evaluar(`(() => { const b = [...${ambito}.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(texto)} && !x.disabled); if (!b) return false; b.click(); return true; })()`);
  assert.ok(ok, `botón «${texto}» disponible`);
}
async function capturar(pagina, nombre) {
  if (!CAPTURAS) return;
  mkdirSync(CAPTURAS, { recursive: true });
  writeFileSync(path.join(CAPTURAS, `${nombre}.png`), await pagina.captura());
}

test('OpenClass Live en Chrome: presentación local + panel docente + dos estudiantes móviles', { timeout: 900_000 }, async (t) => {
  // Puerto efímero para conocer APP_URL antes de compilar; con un dist reutilizado, el que quedó compilado.
  let port = Number(process.env.OPENCLASS_LIVE_DIST && puertoCompilado(process.env.OPENCLASS_LIVE_DIST));
  if (!port) {
    const sondeo = crearApp(leerConfig({ APP_URL: 'http://127.0.0.1:1', SESSION_SECRET: 'x'.repeat(48), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD) }), { log: () => {} });
    ({ port } = await sondeo.escuchar(0, '127.0.0.1'));
    await sondeo.cerrar();
  }
  const APP = `http://127.0.0.1:${port}`;

  const { dist, limpiar } = prepararCurso(APP);
  t.after(limpiar);
  const estatico = await servir(dist, { base: '/' });
  t.after(() => estatico.cerrar());
  const DECK = new URL(estatico.url).origin;

  const registro = [];
  const app = crearApp(leerConfig({
    APP_URL: APP, SESSION_SECRET: 'e2e'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), PRESENTER_ORIGINS: DECK, TRUST_PROXY: 'false',
  }), { log: (e, d = {}) => registro.push(JSON.stringify({ e, ...d })) });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());

  const nDocente = await abrirNavegador({ ancho: 1366, alto: 900 });
  const nAlumno1 = await abrirNavegador({ ancho: 390, alto: 844 });
  const nAlumno2 = await abrirNavegador({ ancho: 390, alto: 844 });
  t.after(async () => { await nDocente.cerrar(); await nAlumno1.cerrar(); await nAlumno2.cerrar(); });

  // ---------- Panel docente ----------
  const panel = await nDocente.pagina({ ancho: 1366, alto: 900 });
  await panel.ir(`${APP}/docente/`);
  await panel.esperarA(`!document.getElementById('vista-login').classList.contains('oculto')`);
  await capturar(panel, '01-panel-acceso');
  await panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(PASSWORD)}; document.getElementById('form-login').requestSubmit();`);
  await panel.esperarA(`!document.getElementById('vista-salas').classList.contains('oculto')`);
  await panel.evaluar(`window.confirm = () => true; window.alert = () => {}; window.__clave = null;
    navigator.clipboard.writeText = async (t) => { window.__clave = t; };
    document.getElementById('titulo-sala').value = 'Plataformas de desarrollo · prueba'; document.getElementById('form-sala').requestSubmit();`);
  await panel.esperarA(`/^[A-Z2-9]{6}$/.test(document.getElementById('codigo-sala').textContent)`);
  await panel.esperarA(`document.getElementById('qr').complete && document.getElementById('qr').naturalWidth > 0`);
  const codigo = await panel.evaluar(`document.getElementById('codigo-sala').textContent`);
  await capturar(panel, '02-panel-sala');
  await panel.evaluar(`document.getElementById('btn-clave').click()`);
  const clave = await panel.esperarA(`window.__clave`);
  assert.match(clave, /^[\w-]+\.[\w-]+$/);

  // ---------- Presentación local: sin peticiones al servicio hasta conectar ----------
  const deck = await nDocente.pagina({ ancho: 1366, alto: 768 });
  const tramas = [];
  const peticiones = [];
  deck.cdp.oyentes.add((m) => {
    if (m.sessionId !== deck.sessionId) return;
    if (m.method === 'Network.webSocketFrameSent') tramas.push(m.params.response.payloadData);
    if (m.method === 'Network.requestWillBeSent') peticiones.push({ url: m.params.request.url, cuerpo: m.params.request.postData ?? '' });
  });
  await deck.send('Network.enable');
  await deck.ir(`${estatico.url}general/`);
  await deck.esperarA(`window.OpenClass?.deck?.isReady?.() && document.querySelector('.oc-live-boton')`);
  await esperar(500);
  assert.equal(peticiones.filter((p) => p.url.startsWith(APP)).length, 0, 'sin ninguna petición a OpenClass Live antes de conectar');

  await deck.evaluar(`document.querySelector('.oc-live-boton').click()`);
  await deck.evaluar(`const p = document.querySelector('.oc-live-panel'); p.querySelector('input[type=password]').value = ${JSON.stringify(clave)}; p.querySelector('form').requestSubmit();`);
  await deck.esperarA(`document.querySelector('.oc-live-sala b')?.textContent === ${JSON.stringify(codigo)}`);
  await pulsar(deck, 'Mostrar QR');
  await deck.esperarA(`document.querySelector('.oc-live-qr img')?.complete && document.querySelector('.oc-live-qr img').naturalWidth > 0`);
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-codigo').textContent`), codigo);
  await deck.evaluar(`document.querySelector('.oc-live-panel').hidden = true`);
  await capturar(deck, '03-presentacion-qr');
  await deck.evaluar(`document.querySelector('.oc-live-panel').hidden = false`);

  // Ir a la diapositiva con la encuesta (la navegación es solo local).
  await deck.evaluar(`(() => { const d = window.OpenClass.deck; const s = document.getElementById('encuesta-live'); const i = d.getIndices(s); d.slide(i.h, i.v); })()`);
  await deck.esperarA(`window.OpenClass.deck.getCurrentSlide().id === 'encuesta-live'`);
  await deck.evaluar(`window.dispatchEvent(new Event('resize'))`);
  await esperar(300);
  assert.equal(await deck.evaluar(`getComputedStyle(document.querySelector('#encuesta-live .oc-live-explicacion')).display`), 'none', 'la explicación no se ve en la diapositiva');
  await pulsar(deck, 'Abrir encuesta de esta diapositiva');
  await deck.esperarA(`window.OpenClassLive.estado()?.activa?.estado === 'abierta'`);

  // ---------- Estudiantes (móvil) ----------
  const alumnos = [];
  for (const [n, navegador] of [[1, nAlumno1], [2, nAlumno2]]) {
    const p = await navegador.pagina({ ancho: 390, alto: 844, escala: 2 });
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await p.ir(`${APP}/join/${codigo}`);
    await p.esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]').length === 3`);
    alumnos.push(p);
    if (n === 1) await capturar(p, '04-estudiante-encuesta');
  }
  const responder = async (p, indice) => {
    await p.evaluar(`(() => { const i = document.querySelectorAll('#panel-encuesta input[name=opcion]')[${indice}]; i.click(); })()`);
    await pulsar(p, (await p.evaluar(`[...document.querySelectorAll('#panel-encuesta button')].map((b) => b.textContent).find((t) => /respuesta/.test(t))`)), `document.getElementById('panel-encuesta')`);
    await p.esperarA(`/Respuesta registrada/.test(document.getElementById('panel-encuesta').textContent)`);
  };
  await responder(alumnos[0], 0);
  await responder(alumnos[1], 1);
  await capturar(alumnos[0], '05-estudiante-registrada');
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[0].respondientes === 2`);
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-barra').length`), 0, 'con la votación abierta no se proyecta la distribución');

  // Reconexión: el estudiante 1 recarga la página y conserva su respuesta.
  await alumnos[0].ir(`${APP}/join/${codigo}`);
  await alumnos[0].esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]')[0]?.checked === true`);

  await pulsar(deck, 'Cerrar votación');
  await deck.esperarA(`window.OpenClassLive.estado().activa.estado === 'cerrada'`);
  await pulsar(deck, 'Publicar resultados');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra').length === 3`);
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-barra.correcta').length`), 0, 'publicar no revela la correcta');
  await alumnos[1].esperarA(`document.querySelectorAll('#panel-encuesta .res-fila').length === 3`);

  // Segunda ronda tras la discusión: ambos eligen B.
  await pulsar(deck, 'Segunda ronda');
  await deck.esperarA(`window.OpenClassLive.estado().activa.ronda === 2 && window.OpenClassLive.estado().activa.estado === 'abierta'`);
  for (const p of alumnos) {
    await p.esperarA(`/Segunda ronda/.test(document.getElementById('panel-encuesta').textContent)`);
    await responder(p, 1);
  }
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[1].respondientes === 2`);
  await pulsar(deck, 'Cerrar votación');
  await deck.esperarA(`window.OpenClassLive.estado().activa.estado === 'cerrada'`);
  await pulsar(deck, 'Revelar respuesta');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra.correcta').length === 1 && /socket\\.join/.test(document.querySelector('.oc-live-capa').textContent)`);
  assert.match(await deck.evaluar(`document.querySelector('.oc-live-capa').textContent`), /ronda 1: 50%/, 'comparación con la primera ronda');
  await deck.evaluar(`document.querySelector('.oc-live-panel').hidden = true`);
  await capturar(deck, '06-presentacion-resultados');
  await alumnos[0].esperarA(`/Su respuesta fue correcta/.test(document.getElementById('panel-encuesta').textContent) && document.querySelector('#panel-encuesta pre')`);
  await capturar(alumnos[0], '07-estudiante-revelada');

  // Panel docente: comparación de rondas.
  await panel.esperarA(`document.querySelector('#panel-activa table.comparar')`);
  await capturar(panel, '08-panel-comparacion');

  // ---------- Pregunta abierta: moderada antes de llegar a la pantalla compartida ----------
  await alumnos[1].evaluar(`document.getElementById('tab-preguntas').click(); document.getElementById('texto-pregunta').value = '<b>¿</b>Se puede usar join con varias salas?'; document.getElementById('form-pregunta').requestSubmit();`);
  await alumnos[1].esperarA(`/docente la apruebe/.test(document.getElementById('aviso-pregunta').textContent)`);
  await capturar(alumnos[1], '09-estudiante-pregunta');
  await panel.esperarA(`document.querySelectorAll('#lista-preguntas .pregunta.pendiente').length === 1`);
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-banda').hidden`), true, 'una pregunta sin moderar no aparece en la presentación');
  assert.equal(await panel.evaluar(`document.querySelector('#lista-preguntas .pregunta.pendiente .velo') !== null`), true, 'pendiente velada en el panel');
  assert.doesNotMatch(await panel.evaluar(`document.getElementById('panel-activa').textContent`), /\bnull\b|undefined/);
  await panel.evaluar(`document.getElementById('lista-preguntas').closest('.tarjeta').scrollIntoView()`);
  await capturar(panel, '10-panel-preguntas');
  await pulsar(panel, 'Proyectar en la presentación', `document.getElementById('lista-preguntas')`);
  await deck.esperarA(`!document.querySelector('.oc-live-banda').hidden`);
  assert.match(await deck.evaluar(`document.querySelector('.oc-live-banda').textContent`), /<b>¿<\/b>Se puede usar join/, 'el HTML llega como texto, sin interpretarse');
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-banda b')`), null);
  await deck.evaluar(`document.querySelector('.oc-live-capa').hidden = true`);
  await capturar(deck, '11-presentacion-pregunta');

  // ---------- Privacidad: qué salió de la presentación ----------
  const salientes = tramas.filter((x) => x.startsWith('42'));
  if (process.env.OPENCLASS_LIVE_TRAMAS) writeFileSync(process.env.OPENCLASS_LIVE_TRAMAS, JSON.stringify(salientes, null, 1));
  assert.ok(salientes.length >= 6, 'eventos emitidos por la presentación');
  const todo = `${tramas.join('\n')}\n${peticiones.filter((p) => p.url.startsWith(APP)).map((p) => `${p.url} ${p.cuerpo}`).join('\n')}`;
  for (const m of MARCADORES) assert.ok(!todo.includes(m), `no sale «${m}»`);
  // Formato de trama: 42/docente,<ack>[evento, datos]
  const crear = salientes.map((x) => JSON.parse(x.replace(/^42(?:\/[^,[]*,)?\d*/, ''))).find(([ev]) => ev === 'encuesta:crear');
  assert.deepEqual(Object.keys(crear[1].encuesta).sort(), ['correctas', 'enunciado', 'explicacion', 'opciones', 'tipo']);
  assert.deepEqual(crear[1].encuesta.opciones, ['socket.enter()', 'socket.join()', 'io.attach()']);
  assert.deepEqual(crear[1].encuesta.correctas, [1]);
  const recursos = peticiones.filter((p) => p.url.startsWith(APP)).map((p) => new URL(p.url).pathname);
  assert.ok(recursos.every((r) => r.startsWith('/socket.io/') || /^\/qr\/[A-Z2-9]{6}\.svg$/.test(r)), `solo cliente Socket.IO y QR: ${[...new Set(recursos)].join(', ')}`);
  assert.ok(!registro.join('\n').includes('join con varias salas'), 'el texto de la pregunta no se registra');

  // ---------- Fin de sesión ----------
  await pulsar(panel, 'Finalizar sesión');
  await alumnos[0].esperarA(`!document.getElementById('vista-fin').classList.contains('oculto')`);
  await deck.esperarA(`!document.querySelector('.oc-live-sala')`);
  assert.equal(app.almacen.tamano, 0, 'datos eliminados del servidor');
  for (const p of [panel, deck, ...alumnos]) assert.deepEqual(p.errores, [], 'sin excepciones de JavaScript');
});
