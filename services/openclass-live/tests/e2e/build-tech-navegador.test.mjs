/**
 * Build Tech — extremo a extremo en Chrome real (Node >= 22). Curso temporal del CLI (./build-tech-curso.mjs)
 * con LIVE activado contra el servicio v0.2 local; panel docente, presentación, Build Tech en su propia
 * ventana y un estudiante móvil:
 *  1. Build Tech se abre desde la presentación (tecla T / «Vista del presentador») en otra ventana; la vista
 *     clásica de Reveal.js sigue disponible; sin clave en su almacenamiento ni peticiones a OpenClass Live.
 *  2. Navegación desde Build Tech; notas sincronizadas con diapositivas y fragmentos (punto de lectura),
 *     HTML de las notas neutralizado, letra ±, «Solo notas», marcadores anclados privados.
 *  3. Hora, tiempo de clase (45/60/90 o personalizado, pausa, reinicio con confirmación) y votación de 30 s
 *     independientes.
 *  4. Video HTML5 y YouTube controlados en la ventana principal; las vistas previas no reproducen nada.
 *  5. Votación completa desde Build Tech y desde el menú «En vivo», solución privada sin publicar, tendencias
 *     privadas, revelación sincronizada, retirar, preguntas moderadas.
 *  6. Recarga de la presentación y cierre/reapertura de Build Tech.
 *  7. Botón «Exportar a PDF»: pestaña ?print-pdf con diálogo de impresión; PDF 16:9, una página por
 *     diapositiva, sin notas, soluciones, QR, controles ni capas, y sin peticiones a OpenClass Live.
 * Variables: OPENCLASS_BT_DIST=<dist compilado> para no recompilar; OPENCLASS_BT_CONSERVAR=1 conserva el curso;
 * OPENCLASS_CAPTURAS=<dir> guarda PNG; OPENCLASS_BT_YOUTUBE=omitir si no hay acceso a YouTube.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, Pagina } from '../../../../scripts/lib/chrome.mjs';
import { servir } from '../../../../scripts/lib/servidor.mjs';
import { crearApp } from '../../src/app.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';
import { crearCurso } from './build-tech-curso.mjs';

const PASSWORD = 'clave-e2e-docente-build-tech';
const CAPTURAS = process.env.OPENCLASS_CAPTURAS;
const NOTAS_PRIVADAS = ['PASO-CERO', 'PASO-UNO', 'ANCLA-DIAGRAMA', 'NOTA-VIDEO', 'NOTA-YOUTUBE', 'NOTA-ENCUESTA', 'INYECCION-NEUTRA'];
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function prepararCurso(servidorLive) {
  if (process.env.OPENCLASS_BT_DIST) return { dist: process.env.OPENCLASS_BT_DIST, limpiar: () => {} };
  const temporal = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-bt-e2e-')));
  const dist = crearCurso(path.join(temporal, 'curso-bt'), servidorLive);
  if (process.env.OPENCLASS_BT_CONSERVAR) { console.log(`Curso conservado: OPENCLASS_BT_DIST=${dist}`); return { dist, limpiar: () => {} }; }
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

async function capturar(pagina, nombre) {
  if (!CAPTURAS) return;
  mkdirSync(CAPTURAS, { recursive: true });
  await pagina.send('Page.bringToFront');
  writeFileSync(path.join(CAPTURAS, `${nombre}.png`), await pagina.captura());
}

/** Espera a que el botón exista y esté habilitado (el estado llega por el puente) y lo pulsa. */
async function pulsarEn(pagina, ambito, texto) {
  const buscar = `[...document.querySelectorAll(${JSON.stringify(`${ambito} button`)})].find((b) => b.textContent === ${JSON.stringify(texto)} && !b.disabled)`;
  await pagina.esperarA(buscar);
  await pagina.evaluar(`${buscar}.click()`);
}

/** Se adjunta a la primera ventana nueva cuya URL cumple el filtro (Build Tech, PDF). */
async function adjuntarNueva(cdp, filtro, conocidas, { timeout = 20000 } = {}) {
  const limite = Date.now() + timeout;
  while (Date.now() < limite) {
    const { targetInfos } = await cdp.send('Target.getTargets');
    const t = targetInfos.find((x) => x.type === 'page' && !conocidas.has(x.targetId) && filtro(x.url));
    if (t) {
      conocidas.add(t.targetId);
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
      const p = new Pagina(cdp, sessionId);
      p.targetId = t.targetId;
      await p.send('Page.enable'); await p.send('Runtime.enable'); await p.send('Log.enable');
      return p;
    }
    await esperar(150);
  }
  throw new Error('No se abrió la ventana esperada');
}

test('Build Tech en Chrome: cabina privada, notas, relojes, multimedia, En vivo y PDF', { timeout: 900_000 }, async (t) => {
  let port = Number(process.env.OPENCLASS_BT_DIST && puertoCompilado(process.env.OPENCLASS_BT_DIST));
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
    APP_URL: APP, SESSION_SECRET: 'bt-e2e'.repeat(10), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), PRESENTER_ORIGINS: DECK, TRUST_PROXY: 'false',
  }), { log: (e, d = {}) => registro.push(JSON.stringify({ e, ...d })) });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());

  const nDocente = await abrirNavegador({ ancho: 1920, alto: 1080 });
  const nAlumno = await abrirNavegador({ ancho: 390, alto: 844 });
  t.after(async () => { await nDocente.cerrar(); await nAlumno.cerrar(); });

  // ---------- Panel docente: sala y clave ----------
  const panel = await nDocente.pagina({ ancho: 1366, alto: 900 });
  await panel.ir(`${APP}/docente/`);
  await panel.esperarA(`!document.getElementById('vista-login').classList.contains('oculto')`);
  await panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(PASSWORD)}; document.getElementById('form-login').requestSubmit();`);
  await panel.esperarA(`!document.getElementById('vista-salas').classList.contains('oculto')`);
  await panel.evaluar(`window.confirm = () => true; window.alert = () => {}; window.__clave = null;
    navigator.clipboard.writeText = async (t) => { window.__clave = t; };
    document.getElementById('titulo-sala').value = 'Build Tech · prueba'; document.getElementById('form-sala').requestSubmit();`);
  await panel.esperarA(`/^[A-Z2-9]{6}$/.test(document.getElementById('codigo-sala').textContent)`);
  const codigo = await panel.evaluar(`document.getElementById('codigo-sala').textContent`);
  await panel.evaluar(`document.getElementById('btn-clave').click()`);
  const clave = await panel.esperarA(`window.__clave`);

  // ---------- Presentación (monitor compartido) ----------
  const deck = await nDocente.pagina({ ancho: 1920, alto: 1080 });
  const conocidas = new Set([deck.targetId, panel.targetId]);
  const tramas = [];
  const peticionesDeck = [];
  deck.cdp.oyentes.add((m) => {
    if (m.sessionId !== deck.sessionId) return;
    if (m.method === 'Network.webSocketFrameSent') tramas.push(m.params.response.payloadData);
    if (m.method === 'Network.requestWillBeSent') peticionesDeck.push(m.params.request.url);
  });
  await deck.send('Network.enable');
  await deck.ir(`${estatico.url}general/`);
  await deck.esperarA(`window.OpenClass?.deck?.isReady?.() && window.OpenClass.buildTech && document.querySelector('#oc-h-pdf button')`);
  const D = (expr) => deck.evaluar(expr);
  const irA = async (id) => {
    await D(`(() => { const d = window.OpenClass.deck; const i = d.getIndices(document.getElementById(${JSON.stringify(id)})); d.slide(i.h, i.v); })()`);
    await deck.esperarA(`window.OpenClass.deck.getCurrentSlide().id === ${JSON.stringify(id)}`);
  };

  // Pie azul: «Exportar a PDF» con nombre accesible, sin tocar otros botones; «Vista del presentador» ofrece ambas vistas.
  await irA('bt-notas');
  const pie = await D(`(() => { const b = document.querySelector('#oc-h-pdf button'); const r = b.getBoundingClientRect(); const s = window.OpenClass.deck.getCurrentSlide().getBoundingClientRect(); const k = s.width / 1280;
    const otros = [...document.querySelectorAll('#customcontrols li button, .oc-inicio, .back-link, .reveal .slide-number, .oc-live-control')].filter((x) => x !== b && x.offsetParent).map((x) => x.getBoundingClientRect());
    return { nombre: b.getAttribute('aria-label'), x: (r.left - s.left) / k, derecha: (r.right - s.left) / k, y: (r.top - s.top) / k,
      choca: otros.some((o) => r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom), total: document.querySelectorAll('#customcontrols li button').length }; })()`);
  assert.equal(pie.nombre, 'Exportar a PDF');
  assert.ok(pie.x >= 425 && pie.derecha <= 470 && pie.y >= 700 && !pie.choca, `botón PDF en el pie azul, sin solapes ${JSON.stringify(pie)}`);
  assert.equal(pie.total, 8, 'siete herramientas + PDF');
  await D(`document.querySelector('#oc-h-presentador button').click()`);
  await deck.esperarA(`!document.getElementById('oc-vistas').hidden`);
  assert.deepEqual(await D(`[...document.querySelectorAll('#oc-vistas [data-vista]')].map((b) => b.dataset.vista)`), ['build-tech', 'clasica'], 'selector: Build Tech y notas clásicas');
  assert.equal(await D(`typeof window.OpenClass.deck.getPlugin('notes')?.open`), 'function', 'la vista clásica de Reveal.js sigue disponible');
  await deck.tecla('Escape', { code: 'Escape', keyCode: 27 });
  await deck.esperarA(`document.getElementById('oc-vistas').hidden`);
  assert.equal(await D(`window.OpenClass.deck.isOverview()`), false, 'Esc cierra el selector sin abrir la vista general');

  // Conectar la sala en la presentación (la clave nunca pasa por Build Tech).
  await D(`document.querySelector('.oc-live-control').click()`);
  await deck.esperarA(`!document.querySelector('.oc-live-menu').hidden`);
  await D(`document.getElementById('oc-live-clave').value = ${JSON.stringify(clave)}; document.getElementById('oc-live-clave').form.requestSubmit();`);
  await deck.esperarA(`window.OpenClassLive.sala()?.codigo === ${JSON.stringify(codigo)}`);
  await D(`document.querySelector('.oc-live-control').click()`);

  // ---------- 1. Abrir Build Tech (tecla T) en una ventana independiente ----------
  await deck.tecla('t', { code: 'KeyT', keyCode: 84, texto: 't' });
  const bt = await adjuntarNueva(deck.cdp, (u) => u.includes('oc-vista=build-tech'), conocidas);
  const peticionesBt = [];
  deck.cdp.oyentes.add((m) => { if (m.sessionId === bt.sessionId && m.method === 'Network.requestWillBeSent') peticionesBt.push(m.params.request.url); });
  await bt.send('Network.enable');
  await bt.viewport(1440, 900);
  await bt.esperarA(`window.OpenClassBuildTech?.conexion() === 'conectada'`);
  const B = (expr) => bt.evaluar(expr);
  const ventanas = await Promise.all([deck, bt].map((p) => deck.cdp.send('Browser.getWindowForTarget', { targetId: p.targetId })));
  assert.notEqual(ventanas[0].windowId, ventanas[1].windowId, 'Build Tech vive en su propia ventana (movible a otro monitor)');
  assert.equal(await B(`sessionStorage.getItem('openclass-live:clave')`), null, 'Build Tech no conserva la clave de presentador');
  assert.equal(await B(`location.search`), '?oc-vista=build-tech', 'la URL de Build Tech no lleva secretos');
  assert.match(await B(`document.title`), /^Build Tech · /);

  // ---------- 2. Notas sincronizadas, fragmentos, HTML neutralizado y anclas ----------
  await bt.esperarA(`/PASO-CERO/.test(document.querySelector('.bt-notas-texto').textContent)`);
  assert.match(await B(`document.querySelector('.bt-notas-texto .actual')?.textContent ?? ''`), /PASO-CERO/, 'punto de lectura: antes de los fragmentos');
  assert.equal(await B(`window.__xss ?? null`), null, 'el HTML de las notas no se ejecuta en Build Tech');
  assert.equal(await B(`document.querySelectorAll('.bt-notas-texto img, .bt-notas-texto script').length`), 0, 'ni imágenes ni scripts desde las notas');
  assert.match(await B(`document.querySelector('.bt-notas-texto').textContent`), /importante con codigo y\s*INYECCION-NEUTRA/, 'el texto se conserva');
  assert.equal(await B(`document.querySelector('.bt-notas-texto strong')?.textContent`), 'importante', 'formato mínimo (negrita)');
  // Navegar desde Build Tech: teclado y botón. Notas y vista previa siguen a la presentación.
  await bt.tecla('ArrowRight', { code: 'ArrowRight', keyCode: 39 });
  await deck.esperarA(`window.OpenClass.deck.getIndices().f === 0`);
  await bt.esperarA(`/PASO-UNO/.test(document.querySelector('.bt-notas-texto .actual')?.textContent ?? '')`);
  await B(`[...document.querySelectorAll('.bt-nav button')].find((b) => /Siguiente ▶/.test(b.textContent)).click()`);
  await deck.esperarA(`window.OpenClass.deck.getIndices().f === 1`);
  await bt.esperarA(`/PASO-DOS/.test(document.querySelector('.bt-notas-texto .actual')?.textContent ?? '')`);
  assert.match(await B(`document.querySelector('.bt-notas-cab').textContent`), /paso 2 de 2/);
  await bt.esperarA(`(() => { const d = document.querySelector('.bt-previa iframe').contentWindow.OpenClass?.deck; const s = d?.getCurrentSlide(); return s?.id === 'bt-notas' && d.getIndices().f === 1; })()`);
  assert.equal(await B(`document.querySelector('.bt-previa iframe').contentWindow.document.documentElement.classList.contains('oc-previa')`), true, 'vista previa en modo receiver');
  assert.equal(await B(`!!document.querySelector('.bt-previa iframe').contentWindow.OpenClassLive`), false, 'la vista previa no carga OpenClass Live');
  // Marcador anclado: solo en la miniatura privada; al pulsarlo destaca su nota.
  await bt.esperarA(`document.querySelectorAll('.bt-anclas .bt-ancla').length === 1`);
  await B(`document.querySelector('.bt-anclas .bt-ancla').click()`);
  await bt.esperarA(`/ANCLA-DIAGRAMA/.test(document.querySelector('.bt-notas-texto .destacada')?.textContent ?? '')`);
  assert.equal(await D(`document.querySelectorAll('.bt-ancla, .bt-anclas, [class*="bt-"]').length`), 0, 'ningún marcador de Build Tech en la presentación');
  assert.equal(await D(`[...document.querySelectorAll('.reveal .slides section.present aside.notes')].every((a) => getComputedStyle(a).display === 'none')`), true, 'las notas no se proyectan');
  // Letra y «Solo notas».
  const letra = await B(`parseFloat(getComputedStyle(document.querySelector('.bt-notas-texto')).fontSize)`);
  await B(`document.querySelector('[aria-label^="Ampliar la letra"]').click()`);
  assert.equal(await B(`parseFloat(getComputedStyle(document.querySelector('.bt-notas-texto')).fontSize)`), letra + 2, 'A+ amplía la letra');
  await bt.tecla('n', { code: 'KeyN', keyCode: 78, texto: 'n' });
  await bt.esperarA(`getComputedStyle(document.querySelector('.bt-lateral')).display === 'none'`);
  assert.ok(await B(`document.querySelector('.bt-notas').getBoundingClientRect().width > 1300`), 'solo notas: ocupan todo el ancho');
  await bt.tecla('n', { code: 'KeyN', keyCode: 78, texto: 'n' });
  // Divisor redimensionable con teclado (y puntero).
  const ancho = await B(`document.querySelector('.bt-notas').getBoundingClientRect().width`);
  await B(`document.querySelector('.bt-divisor').focus()`);
  await bt.tecla('ArrowRight', { code: 'ArrowRight', keyCode: 39 });
  assert.ok(Math.abs(await B(`document.querySelector('.bt-notas').getBoundingClientRect().width`) - ancho - 32) <= 2, 'el divisor amplía las notas');
  assert.equal(await D(`window.OpenClass.deck.getIndices().f`), 1, 'las flechas sobre el divisor no navegan');
  // Prioridad visual: las notas ocupan más área que las miniaturas y su letra es mayor.
  const areas = await B(`(() => { const a = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.width * r.height; }; return { notas: a('.bt-notas-texto'), previa: a('.bt-previa .bt-marco') + a('.bt-siguiente .bt-marco') }; })()`);
  assert.ok(areas.notas > areas.previa, `las notas tienen más área que las miniaturas ${JSON.stringify(areas)}`);
  await capturar(bt, '20-build-tech-notas');

  // ---------- 3. Hora, tiempo de clase y votación independientes ----------
  assert.match(await B(`document.querySelector('.bt-hora').textContent`), /\d{1,2}:\d{2}:\d{2}/, 'hora local con segundos');
  await pulsarEn(bt, '.bt-clase', "45");
  await B(`document.querySelector('.bt-minutos').value = '50'; document.querySelector('.bt-minutos').dispatchEvent(new Event('change'))`);
  assert.equal(await B(`window.OpenClassBuildTech.tiempo().duracionMin`), 50, 'duración personalizada');
  await pulsarEn(bt, '.bt-clase', "45");
  await pulsarEn(bt, '.bt-clase', "Iniciar");
  await bt.esperarA(`/restan 4[45]:\\d\\d/.test(document.querySelector('.bt-restante').textContent)`);
  await esperar(1200);
  await pulsarEn(bt, '.bt-clase', "Pausar");
  const pausado = await B(`window.OpenClassBuildTech.tiempo()`);
  assert.ok(pausado.desde === null && pausado.acumulado >= 1000, 'pausa conserva lo transcurrido');
  await esperar(600);
  assert.equal((await B(`window.OpenClassBuildTech.tiempo()`)).acumulado, pausado.acumulado, 'en pausa no avanza');
  await pulsarEn(bt, '.bt-clase', "Reanudar");
  await pulsarEn(bt, '.bt-clase', "Reiniciar…");
  assert.match(await B(`document.querySelector('.bt-clase').textContent`), /¿Reiniciar el tiempo de clase\?/, 'reiniciar pide confirmación');
  await pulsarEn(bt, '.bt-clase', "Cancelar");
  assert.notEqual((await B(`window.OpenClassBuildTech.tiempo()`)).desde, null, 'cancelar no reinicia');
  assert.equal(await D(`!!document.querySelector('.oc-reloj-publico')`), false, 'sin reloj público salvo activación explícita');
  await B(`document.querySelector('[data-foco="reloj"]').click()`);
  await deck.esperarA(`/^\\d{1,2}:\\d{2}/.test(document.querySelector('.oc-reloj-publico')?.textContent ?? '')`);
  assert.equal(await D(`!!document.querySelector('.oc-reloj-publico').closest('.slides')`), false, 'reloj público fuera del lienzo');
  await B(`document.querySelector('[data-foco="reloj"]').click()`);
  await deck.esperarA(`!document.querySelector('.oc-reloj-publico')`);

  // ---------- 4. Multimedia: HTML5 y YouTube en la ventana principal; una sola reproducción ----------
  const reproduciendo = `(() => { const n = []; const ver = (doc, d) => { for (const m of doc.querySelectorAll('video, audio')) if (!m.paused) n.push(d); for (const f of doc.querySelectorAll('iframe')) { try { if (f.contentDocument) ver(f.contentDocument, d + '>iframe'); } catch {} } }; ver(document, 'raiz'); return n; })()`;
  await irA('bt-video');
  await bt.esperarA(`document.querySelector('.bt-medios [data-medio="m0"] .bt-play') && !document.querySelector('.bt-medios [data-medio="m0"] .bt-play').disabled`);
  await B(`document.querySelector('.bt-medios [data-medio="m0"] .bt-play').click()`);
  await deck.esperarA(`!document.querySelector('#bt-video video').paused`);
  await bt.esperarA(`/Reproduciendo/.test(document.querySelector('.bt-medios .bt-medio-estado').textContent)`);
  assert.deepEqual(await D(reproduciendo), ['raiz'], 'solo suena el video de la presentación');
  assert.deepEqual(await B(reproduciendo), [], 'Build Tech y sus vistas previas no reproducen nada');
  assert.equal(await B(`[...document.querySelectorAll('.bt-marco iframe')].every((f) => [...f.contentDocument.querySelectorAll('video')].every((v) => v.muted))`), true, 'vistas previas silenciadas');
  await B(`document.querySelector('.bt-medios [data-medio="m0"] .bt-pausa').click()`);
  await deck.esperarA(`document.querySelector('#bt-video video').paused`);
  await B(`(() => { const r = document.querySelector('.bt-medios .bt-pos'); r.value = '2'; r.dispatchEvent(new Event('change')); })()`);
  await deck.esperarA(`Math.abs(document.querySelector('#bt-video video').currentTime - 2) < 0.6`);
  await B(`document.querySelector('.bt-medios .bt-mute').click()`);
  await deck.esperarA(`document.querySelector('#bt-video video').muted`);
  await bt.esperarA(`/silenciado/.test(document.querySelector('.bt-medios .bt-medio-estado').textContent)`);
  await B(`document.querySelector('.bt-medios .bt-mute').click()`);
  await deck.esperarA(`!document.querySelector('#bt-video video').muted`);
  await B(`(() => { const r = document.querySelector('.bt-medios .bt-vol'); r.value = '0.5'; r.dispatchEvent(new Event('change')); })()`);
  await deck.esperarA(`document.querySelector('#bt-video video').volume === 0.5`);
  // Acción explícita declarada en la nota anclada al video.
  await bt.esperarA(`document.querySelector('.bt-accion-nota') && !document.querySelector('.bt-accion-nota').disabled`);
  await B(`document.querySelector('.bt-accion-nota').click()`);
  await deck.esperarA(`!document.querySelector('#bt-video video').paused`);
  await B(`document.querySelector('.bt-medios .bt-pausa').click()`);
  await deck.esperarA(`document.querySelector('#bt-video video').paused`);
  await capturar(bt, '21-build-tech-video');

  await irA('bt-youtube');
  assert.match(await D(`document.querySelector('#bt-youtube iframe').src`), /enablejsapi=1/, 'el iframe de YouTube acepta la API oficial');
  if (process.env.OPENCLASS_BT_YOUTUBE !== 'omitir') {
    await bt.esperarA(`/YouTube/.test(document.querySelector('.bt-medios [data-medio="m0"] .bt-tipo')?.textContent ?? '') && document.querySelector('.bt-medios [data-medio="m0"] .bt-play:not(:disabled)')`, { timeout: 30000 });
    await B(`document.querySelector('.bt-medios [data-medio="m0"] .bt-play').click()`);
    await bt.esperarA(`/Reproduciendo/.test(document.querySelector('.bt-medios .bt-medio-estado')?.textContent ?? '')`, { timeout: 30000 });
    assert.equal(await B(`[...document.querySelectorAll('.bt-marco iframe')].every((f) => ![...f.contentDocument.querySelectorAll('iframe')].some((x) => /youtube/.test(x.src)))`), true, 'las vistas previas no cargan YouTube');
    await B(`document.querySelector('.bt-medios .bt-pausa').click()`);
    await bt.esperarA(`/En pausa/.test(document.querySelector('.bt-medios .bt-medio-estado')?.textContent ?? '')`, { timeout: 15000 });
  }
  // Un proveedor sin API: se informa sin prometer control.
  await D(`(() => { const f = document.createElement('iframe'); f.title = 'Externo'; f.src = 'about:blank'; document.querySelector('#bt-youtube').append(f); window.OpenClass.deck.slide(window.OpenClass.deck.getIndices().h); })()`);
  await irA('bt-video'); await irA('bt-youtube');
  await bt.esperarA(`/Control externo no disponible/.test(document.querySelector('.bt-medios').textContent)`);

  // ---------- 5. En vivo desde Build Tech y desde la presentación ----------
  const A = await nAlumno.pagina({ ancho: 390, alto: 844, escala: 2 });
  await A.ir(`${APP}/join/${codigo}`);
  await A.esperarA(`/Esperando la próxima pregunta/.test(document.getElementById('panel-encuesta').textContent)`);
  await irA('bt-encuesta');
  await bt.esperarA(`[...document.querySelectorAll('.bt-live button')].some((b) => b.textContent === 'Iniciar votación · 30 s')`);
  // Solución privada: plegada; consultarla no la publica.
  assert.equal(await B(`document.querySelector('.bt-solucion-det').open`), false, 'solución privada plegada por defecto');
  await B(`document.querySelector('.bt-solucion-det > summary').click()`);
  assert.match(await B(`document.querySelector('.bt-solucion').textContent`), /Correcta: B\. La presentación principal.*EXPLICACION-PRIVADA/s);
  assert.equal(await D(`getComputedStyle(document.querySelector('#bt-encuesta .oc-live-explicacion')).display`), 'none', 'la explicación no se ve en la presentación');
  assert.equal(await D(`document.querySelector('.oc-live-capa').hidden`), true);
  await pulsarEn(bt, '.bt-live', "Iniciar votación · 30 s");
  await deck.esperarA(`window.OpenClassLive.estado()?.activa?.estado === 'abierta'`);
  const duracion = await D(`(() => { const e = window.OpenClassLive.estado(); return Math.round((e.activa.rondas[0].cierra - e.servidor) / 1000); })()`);
  assert.ok(Math.abs(duracion - 30) <= 1, 'temporizador global de 30 s, sin pedir duración');
  assert.ok((await B(`window.OpenClassBuildTech.tiempo()`)).desde !== null, 'abrir una votación no reinicia el tiempo de clase');
  await bt.esperarA(`/^0:[0-3]\\d$/.test(document.querySelector('.bt-voto-reloj')?.textContent ?? '')`);
  await A.esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]').length === 4`);
  await A.evaluar(`document.querySelectorAll('#panel-encuesta input[name=opcion]')[1].click()`);
  await A.evaluar(`[...document.querySelectorAll('#panel-encuesta button')].find((b) => /respuesta/.test(b.textContent)).click()`);
  await bt.esperarA(`/100% \\(1\\)/.test(document.querySelector('.bt-live .bt-barras')?.textContent ?? '')`);
  assert.match(await B(`document.querySelector('.bt-live').textContent`), /Tendencias privadas: no se proyectan/);
  assert.equal(await D(`document.querySelectorAll('.oc-live-barra').length`), 0, 'las estadísticas anticipadas no se proyectan');
  assert.equal(await A.evaluar(`document.querySelectorAll('#panel-encuesta .res-fila').length`), 0, 'el estudiante no ve estadísticas anticipadas');
  const cierra = await D(`window.OpenClassLive.estado().activa.rondas[0].cierra`);
  await pulsarEn(bt, '.bt-live', "+30 segundos");
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[0].cierra === ${cierra + 30_000}`);
  await pulsarEn(bt, '.bt-live', "Proyectar tendencias");
  await deck.esperarA(`/Tendencia en vivo/.test(document.querySelector('.oc-live-capa').textContent)`);
  assert.equal(await D(`document.querySelectorAll('.oc-live-barra.correcta').length`), 0, 'tendencias proyectadas sin la correcta');
  await pulsarEn(bt, '.bt-live', "Dejar de proyectar tendencias");
  await deck.esperarA(`document.querySelector('.oc-live-capa').hidden`);
  await capturar(bt, '22-build-tech-votacion');
  await pulsarEn(bt, '.bt-live', "Cerrar ahora");
  await bt.esperarA(`[...document.querySelectorAll('.bt-live button')].some((b) => b.textContent === 'Mostrar resultados')`);
  assert.equal(await D(`document.querySelector('.oc-live-capa').hidden`), true, 'cerrar no publica');
  await pulsarEn(bt, '.bt-live', "Mostrar resultados");
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra').length === 4`);
  await A.esperarA(`document.querySelectorAll('#panel-encuesta .res-fila').length === 4`);
  assert.equal(await D(`window.OpenClassLive.estado().activa.correctaRevelada`), false, 'consultar la solución en Build Tech no la reveló');
  await pulsarEn(bt, '.bt-live', "Discutir y repetir");
  await deck.esperarA(`window.OpenClassLive.estado().activa.ronda === 2 && window.OpenClassLive.estado().activa.estado === 'abierta'`);
  // La misma votación se controla también desde el menú «En vivo» de la presentación.
  await A.esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]').length === 4 && !document.querySelectorAll('#panel-encuesta input[name=opcion]')[1].checked`);
  await A.evaluar(`document.querySelectorAll('#panel-encuesta input[name=opcion]')[1].click()`);
  await A.evaluar(`[...document.querySelectorAll('#panel-encuesta button')].find((b) => /respuesta/.test(b.textContent)).click()`);
  await D(`document.querySelector('.oc-live-control').click()`);
  await deck.esperarA(`[...document.querySelectorAll('.oc-live-menu button')].some((b) => b.textContent === 'Cerrar ahora')`);
  await pulsarEn(deck, '.oc-live-menu', "Cerrar ahora");
  await deck.esperarA(`[...document.querySelectorAll('.oc-live-menu button')].some((b) => b.textContent === 'Mostrar resultados')`);
  await pulsarEn(deck, '.oc-live-menu', "Mostrar resultados");
  await D(`document.querySelector('.oc-live-control').click()`);
  await bt.esperarA(`[...document.querySelectorAll('.bt-live button')].some((b) => b.textContent === 'Revelar explicación')`);
  await pulsarEn(bt, '.bt-live', "Revelar explicación");
  await deck.esperarA(`/EXPLICACION-PRIVADA/.test(document.querySelector('.oc-live-capa').textContent) && document.querySelectorAll('.oc-live-barra.correcta').length === 1`);
  await A.esperarA(`/EXPLICACION-PRIVADA/.test(document.getElementById('panel-encuesta').textContent)`);
  await bt.esperarA(`/Respuesta revelada/.test(document.querySelector('.bt-live').textContent)`);
  await capturar(deck, '23-presentacion-revelada-desde-build-tech');
  await pulsarEn(bt, '.bt-live', "Retirar encuesta");
  await deck.esperarA(`document.querySelector('.oc-live-capa').hidden && !window.OpenClassLive.estado().activa`);
  // Preguntas de estudiantes: moderación desde Build Tech con los permisos del presentador.
  await A.evaluar(`document.getElementById('tab-preguntas').click(); document.getElementById('texto-pregunta').value = '¿Build Tech se comparte por Zoom?'; document.getElementById('form-pregunta').requestSubmit();`);
  await bt.esperarA(`/por revisar/.test(document.querySelector('.bt-preguntas summary')?.textContent ?? '')`);
  await pulsarEn(bt, '.bt-preguntas', "Aprobar");
  await bt.esperarA(`[...document.querySelectorAll('.bt-preguntas button')].some((b) => b.textContent === 'Proyectar')`);
  await pulsarEn(bt, '.bt-preguntas', "Proyectar");
  await deck.esperarA(`/Build Tech se comparte/.test(document.querySelector('.oc-live-banda')?.textContent ?? '')`);
  await pulsarEn(bt, '.bt-preguntas', "Quitar de la pantalla");
  await deck.esperarA(`document.querySelector('.oc-live-banda').hidden`);
  assert.equal(app.almacen.tamano, 1, 'una sola sala');

  // ---------- 6. Recarga de la presentación, cierre y reapertura de Build Tech ----------
  await deck.ir(`${estatico.url}general/#/1`);
  await deck.esperarA(`window.OpenClass?.deck?.isReady?.() && window.OpenClassLive?.sala()?.codigo === ${JSON.stringify(codigo)}`);
  await bt.esperarA(`window.OpenClassBuildTech.conexion() === 'conectada' && window.OpenClassBuildTech.estado()?.posicion === 2`, { timeout: 20000 });
  assert.ok((await B(`window.OpenClassBuildTech.tiempo()`)).desde !== null, 'el tiempo de clase sobrevive a la recarga de la presentación');
  await B(`[...document.querySelectorAll('.bt-nav button')].find((b) => /Siguiente ▶/.test(b.textContent)).click()`);
  await deck.esperarA(`window.OpenClass.deck.getIndices().h === 2`);
  await deck.cdp.send('Target.closeTarget', { targetId: bt.targetId });
  await esperar(2000);
  await D(`window.OpenClass.deck.next()`);
  await deck.esperarA(`window.OpenClass.deck.getIndices().h === 3`);
  assert.deepEqual(deck.errores.filter((e) => !/favicon|general\/x$/.test(e)), [], 'la presentación sigue sin errores tras cerrar Build Tech');
  await deck.tecla('t', { code: 'KeyT', keyCode: 84, texto: 't' });
  const bt2 = await adjuntarNueva(deck.cdp, (u) => u.includes('oc-vista=build-tech'), conocidas);
  await bt2.esperarA(`window.OpenClassBuildTech?.conexion() === 'conectada' && window.OpenClassBuildTech.estado()?.posicion === 4`);
  assert.ok((await bt2.evaluar(`window.OpenClassBuildTech.tiempo()`)).desde !== null, 'el tiempo de clase sobrevive al cierre de Build Tech');

  // La vista clásica de notas de Reveal.js (tecla S) sigue funcionando; sus vistas previas (?receiver) ya no se
  // conectan a la sala ni duplican el QR.
  for (const { targetId } of (await deck.cdp.send('Target.getTargets')).targetInfos) conocidas.add(targetId);
  await deck.tecla('s', { code: 'KeyS', keyCode: 83, texto: 's' });
  const clasica = await adjuntarNueva(deck.cdp, () => true, conocidas);
  await clasica.esperarA(`document.querySelectorAll('iframe').length >= 2 && [...document.querySelectorAll('iframe')].every((f) => f.contentWindow?.OpenClass?.deck?.isReady?.())`, { timeout: 30000 });
  assert.equal(await clasica.evaluar(`[...document.querySelectorAll('iframe')].every((f) => /receiver/.test(f.src) && !f.contentDocument.querySelector('.oc-live-control, .oc-live-participa'))`), true, 'notas clásicas: vistas previas sin OpenClass Live');
  assert.match(await clasica.evaluar(`document.body.textContent`), /PASO-CERO|NOTA-|Notas|Speaker/i, 'notas clásicas con sus notas');
  await deck.cdp.send('Target.closeTarget', { targetId: clasica.targetId });

  // ---------- Privacidad: notas fuera del servidor; Build Tech no contacta OpenClass Live ----------
  for (const marca of NOTAS_PRIVADAS) assert.ok(!tramas.some((x) => x.includes(marca)), `${marca} no viaja al servidor`);
  assert.ok(!tramas.some((x) => /oc-vista|build-tech|ANCLA/.test(x)), 'el estado de Build Tech no viaja al servidor');
  // Build Tech y sus vistas previas solo cargan la propia presentación (y las mismas bibliotecas que ella, p. ej.
  // KaTeX): nunca OpenClass Live ni el contenido integrado (YouTube), que solo vive en la ventana principal.
  const externas = peticionesBt.filter((u) => !u.startsWith(DECK) && !/^(data|about|blob):/.test(u));
  assert.equal(externas.filter((u) => u.startsWith(APP) || /youtube|ytimg|googlevideo/.test(u)).length, 0, `Build Tech no contacta Live ni YouTube ${externas.join(' ')}`);
  assert.ok(externas.every((u) => /^https:\/\/cdn\.jsdelivr\.net\/npm\/katex@/.test(u)), `solo las bibliotecas de la propia presentación ${externas.join(' ')}`);
  for (const l of registro) for (const marca of [...NOTAS_PRIVADAS, clave]) assert.ok(!l.includes(marca), 'los registros no contienen notas ni la clave');

  // ---------- 7. Exportar a PDF desde el botón del pie ----------
  await irA('bt-notas');
  const r = await D(`(() => { const b = document.querySelector('#oc-h-pdf button').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; })()`);
  await deck.clic(r.x, r.y);
  const pdf = await adjuntarNueva(deck.cdp, (u) => /print-pdf/.test(u), conocidas);
  const peticionesPdf = [];
  deck.cdp.oyentes.add((m) => { if (m.sessionId === pdf.sessionId && m.method === 'Network.requestWillBeSent') peticionesPdf.push(m.params.request.url); });
  await pdf.send('Network.enable');
  await pdf.esperarA(`document.documentElement.classList.contains('reveal-print') && window.OpenClass?.deck?.isReady?.()`, { timeout: 30000 });
  assert.equal(await pdf.evaluar(`location.search`), '?print-pdf&oc-imprimir', 'URL de impresión sin secretos');
  assert.equal(await pdf.evaluar(`window.opener`), null, 'la pestaña PDF no controla la presentación');
  assert.equal(await pdf.evaluar(`sessionStorage.getItem('openclass-live:clave')`), null, 'la pestaña PDF no hereda la clave');
  await pdf.esperarA(`/Guardar como PDF/.test(document.querySelector('.oc-imprimir')?.textContent ?? '')`, { timeout: 30000 });
  await pdf.send('Emulation.setEmulatedMedia', { media: 'print' });
  const visible = await pdf.evaluar(`(() => { const vis = (n) => n.getClientRects().length > 0 && getComputedStyle(n).visibility !== 'hidden';
    return { capas: [...document.querySelectorAll('.oc-live-control, .oc-live-menu, .oc-live-capa, .oc-live-banda, .oc-live-participa, .oc-vistas, .oc-reloj-publico, .oc-imprimir, #customcontrols, .back-link, .oc-inicio, .reveal .controls, .reveal .progress')].filter(vis).map((n) => n.className || n.id),
      notas: [...document.querySelectorAll('aside.notes, .speaker-notes')].filter(vis).length,
      explicacion: [...document.querySelectorAll('.oc-live-explicacion')].filter(vis).length,
      texto: document.body.innerText, paginas: document.querySelectorAll('.pdf-page').length, total: window.OpenClass.deck.getTotalSlides(),
      altas: [...document.querySelectorAll('.pdf-page')].filter((p) => p.scrollHeight > p.clientHeight + 2).length }; })()`);
  assert.deepEqual(visible.capas, [], 'el PDF no lleva controles, QR, capas ni la barra de impresión');
  assert.equal(visible.notas, 0, 'el PDF no lleva notas');
  assert.equal(visible.explicacion, 0, 'el PDF no lleva respuestas ocultas');
  for (const marca of [...NOTAS_PRIVADAS, 'EXPLICACION-PRIVADA', codigo, 'Build Tech']) assert.ok(!visible.texto.includes(marca), `el PDF no contiene ${marca}`);
  assert.equal(visible.paginas, visible.total, 'una página por diapositiva (sin páginas en blanco ni duplicadas)');
  assert.equal(visible.altas, 0, 'ninguna diapositiva se corta en dos páginas');
  assert.equal(await pdf.evaluar(`document.querySelector('#bt-youtube .oc-pdf-medio a')?.href`), 'https://www.youtube.com/watch?v=M7lc1UVf-VE', 'el video integrado queda como enlace en el PDF');
  assert.equal(await pdf.evaluar(`[...document.querySelectorAll('.slides iframe')].every((f) => getComputedStyle(f).display === 'none')`), true, 'sin iframes vacíos en el PDF');
  const { data } = await pdf.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(data, 'base64');
  const caja = /\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/.exec(bytes.toString('latin1'));
  assert.ok(caja && Math.abs(Number(caja[1]) / Number(caja[2]) - 16 / 9) < 0.02, `PDF horizontal 16:9 ${caja?.slice(1)}`);
  const paginasPdf = Math.max(0, ...(bytes.toString('latin1').match(/\/Count (\d+)/g) || []).map((m) => Number(m.slice(7))));
  assert.equal(paginasPdf, visible.total, 'el PDF tiene una página por diapositiva');
  assert.ok(bytes.length > 100_000, 'el PDF conserva imágenes y fondos');
  assert.equal(peticionesPdf.filter((u) => u.startsWith(APP)).length, 0, 'el PDF no contacta OpenClass Live');
  if (CAPTURAS) writeFileSync(path.join(CAPTURAS, 'semana-build-tech.pdf'), bytes);
  // El único 404 admitido es el <img src="x"> de la sonda de inyección, que las vistas previas (la propia
  // presentación) cargan como cualquier HTML del Markdown; en Build Tech nunca se inserta.
  assert.deepEqual(bt2.errores.filter((e) => !/general\/x$/.test(e)), [], 'Build Tech sin errores de JavaScript');
});
