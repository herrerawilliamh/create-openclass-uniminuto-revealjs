/**
 * OpenClass Live — extremo a extremo en Chrome real (Node >= 22):
 *  1. levanta el servicio en 127.0.0.1;
 *  2. crea un curso temporal con el CLI del repositorio maestro, activa LIVE en SU copia de fase2.mjs y
 *     añade a SU slides.md una diapositiva con encuesta (la plantilla y los cursos reales no se tocan);
 *  3. docente (panel), presentación Reveal.js local y tres estudiantes móviles en perfiles separados;
 *  4. una clase = una sala: QR real en portada, temática y cada encuesta (nunca antes de conectar),
 *     A entra al inicio, B llega tarde a la pregunta 1, C entra con el QR de la pregunta 2; dos rondas,
 *     revelación, QR junto a los resultados, sin solapes a 1920×1080, 1920×945 y 1536×730, PDF sin
 *     capas, pregunta proyectada y la presentación solo envió las encuestas abiertas;
 *  5. UX docente v0.2: control «En vivo» en el pie (sin botón flotante), menú contextual también desde el
 *     QR, orientación descartable, teclado (L, Esc), tiempo global de 30 s en preguntas consecutivas,
 *     preferencia que solo afecta a rondas futuras, cierre automático con la presentación desconectada,
 *     +30 s, tendencias privadas en el panel (proyección explícita, sin la correcta) y formulario
 *     improvisado plegado.
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
<!-- .slide: id="encuesta-live" class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

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
<!-- .slide: id="privada" class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

MARCADOR-DIAPOSITIVA-PRIVADA

---

## Segunda pregunta
<!-- .slide: id="encuesta-live-2" class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<div class="oc-live-encuesta" data-tipo="multiple" data-correctas="A,C">
<p class="oc-live-enunciado">¿Qué datos salen del computador del docente al abrir una encuesta?</p>
<ol class="oc-live-opciones">
<li>El enunciado y las opciones</li>
<li>Las notas del presentador</li>
<li>La explicación, para revelarla al final</li>
<li>Las demás diapositivas</li>
</ol>
<div class="oc-live-explicacion">Solo la encuesta abierta; notas, fondos y diapositivas quedan en el computador.</div>
</div>

---

## Tercera pregunta
<!-- .slide: id="encuesta-live-3" class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<div class="oc-live-encuesta" data-tipo="unica" data-correctas="C">
<div class="oc-live-enunciado"><p>¿Qué imprime este programa?</p><pre><code>console.log((7 / 2) | 0);</code></pre></div>
<ol class="oc-live-opciones">
<li>3.5</li>
<li>4</li>
<li>3</li>
</ol>
<div class="oc-live-explicacion">El operador | convierte a entero de 32 bits y descarta la parte decimal: 3.</div>
</div>
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
  await pagina.send('Page.bringToFront'); // una pestaña en segundo plano no entrega capturas
  writeFileSync(path.join(CAPTURAS, `${nombre}.png`), await pagina.captura());
}

// Bloque de participación de la diapositiva actual: solapes con su texto y sus medios (comprobación
// independiente de la ubicación que calcula live.mjs), posición en el lienzo 1280×720 y estado del QR.
const BLOQUE = `(() => {
  const b = document.querySelector('.reveal .slides section.present > .oc-live-participa');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const sec = b.parentElement;
  const toca = (t) => t.width > 0 && t.height > 0 && t.left < r.right && r.left < t.right && t.top < r.bottom && r.top < t.bottom;
  const choques = [];
  const rango = document.createRange();
  const w = document.createTreeWalker(sec, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (b.contains(n) || !n.textContent.trim() || n.parentElement.closest('aside')) continue;
    rango.selectNodeContents(n);
    if ([...rango.getClientRects()].some(toca)) choques.push(n.textContent.trim().slice(0, 40));
  }
  for (const m of sec.querySelectorAll('img, pre, svg, iframe, video, canvas, table, .oc-section-plane')) if (!b.contains(m) && toca(m.getBoundingClientRect())) choques.push(m.tagName);
  const caja = sec.getBoundingClientRect(); const k = caja.width / sec.offsetWidth;
  const img = b.querySelector('img');
  return { choques, dentro: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
    lienzo: { x: (r.left - caja.left) / k, y: (r.top - caja.top) / k, derecha: (r.right - caja.left) / k, abajo: (r.bottom - caja.top) / k },
    qr: img ? { src: img.src, cargado: img.complete && img.naturalWidth > 0, lado: img.getBoundingClientRect().width, visible: getComputedStyle(img).display !== 'none' } : null,
    texto: b.textContent, grupos: [...b.querySelectorAll('.oc-live-grupo')].map((g) => g.textContent) };
})()`;

test('OpenClass Live en Chrome: una sala para toda la clase, QR integrado y tres estudiantes', { timeout: 900_000 }, async (t) => {
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

  const nDocente = await abrirNavegador({ ancho: 1920, alto: 1080 });
  const nAlumnos = [];
  for (let i = 0; i < 3; i++) nAlumnos.push(await abrirNavegador({ ancho: 390, alto: 844 }));
  t.after(async () => { await nDocente.cerrar(); for (const n of nAlumnos) await n.cerrar(); });

  // ---------- Panel docente: UNA sala para toda la clase ----------
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
  assert.equal(await panel.evaluar(`document.getElementById('composer').open`), false, '«Crear pregunta improvisada» plegado por defecto');
  assert.equal(await panel.evaluar(`document.getElementById('configuracion').open`), false, 'configuración secundaria plegada');
  assert.match(await panel.evaluar(`document.getElementById('resumen-config').textContent`), /30 s/, 'tiempo de votación global de 30 s');
  await panel.esperarA(`document.getElementById('qr').complete && document.getElementById('qr').naturalWidth > 0`);
  const codigo = await panel.evaluar(`document.getElementById('codigo-sala').textContent`);
  await capturar(panel, '02-panel-sala');
  await panel.evaluar(`document.getElementById('btn-clave').click()`);
  const clave = await panel.esperarA(`window.__clave`);
  assert.match(clave, /^[\w-]+\.[\w-]+$/);
  const unaSala = () => assert.equal(app.almacen.tamano, 1, 'una sola sala en el servidor');

  // ---------- Estudiantes (móvil, perfiles separados) ----------
  const entrar = async (n) => {
    const p = await nAlumnos[n].pagina({ ancho: 390, alto: 844, escala: 2 });
    await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await p.ir(`${APP}/join/${codigo}`); // la URL que codifica el QR (/qr/<código>.svg)
    return p;
  };
  const opciones = (p, n) => p.esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]').length === ${n}`);
  const responder = async (p, indices) => {
    await p.evaluar(`(() => { const i = document.querySelectorAll('#panel-encuesta input[name=opcion]'); for (const n of ${JSON.stringify(indices)}) i[n].click(); })()`);
    await pulsar(p, (await p.evaluar(`[...document.querySelectorAll('#panel-encuesta button')].map((b) => b.textContent).find((t) => /respuesta/.test(t))`)), `document.getElementById('panel-encuesta')`);
    await p.esperarA(`/Respuesta registrada/.test(document.getElementById('panel-encuesta').textContent)`);
  };
  const enSala = (p) => p.evaluar(`document.getElementById('vista-fin').classList.contains('oculto')`);

  // Estudiante A entra al inicio: aún no hay pregunta abierta, espera la siguiente.
  const A = await entrar(0);
  await A.esperarA(`/Esperando la próxima pregunta/.test(document.getElementById('panel-encuesta').textContent)`);

  // ---------- Presentación local: sin peticiones ni QR hasta conectar ----------
  const deck = await nDocente.pagina({ ancho: 1920, alto: 1080 });
  const tramas = [];
  const peticiones = [];
  deck.cdp.oyentes.add((m) => {
    if (m.sessionId !== deck.sessionId) return;
    if (m.method === 'Network.webSocketFrameSent') tramas.push(m.params.response.payloadData);
    if (m.method === 'Network.requestWillBeSent') peticiones.push({ url: m.params.request.url, cuerpo: m.params.request.postData ?? '' });
  });
  await deck.send('Network.enable');
  await deck.ir(`${estatico.url}general/`);
  await deck.esperarA(`window.OpenClass?.deck?.isReady?.() && document.querySelector('.oc-live-control')`);
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-boton').length`), 0, 'sin botón flotante superior');
  await esperar(500);
  assert.equal(peticiones.filter((p) => p.url.startsWith(APP)).length, 0, 'sin ninguna petición a OpenClass Live antes de conectar');
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-participa').length`), 0, 'sin sala conectada no hay QR (ni falso)');

  const menuVisible = `!document.querySelector('.oc-live-menu').hidden`;
  const abrirPanel = () => deck.evaluar(`if (document.querySelector('.oc-live-menu').hidden) document.querySelector('.oc-live-control').click()`);
  const cerrarPanel = () => deck.evaluar(`if (!document.querySelector('.oc-live-menu').hidden) document.querySelector('.oc-live-control').click()`);
  const momento = () => deck.evaluar(`window.OpenClassLive.momento()`);
  const irA = async (destino) => {
    const nodo = typeof destino === 'number' ? `window.OpenClass.deck.getSlides()[${destino}]` : `document.getElementById(${JSON.stringify(destino)})`;
    await deck.evaluar(`(() => { const d = window.OpenClass.deck; const i = d.getIndices(${nodo}); d.slide(i.h, i.v); })()`);
    await deck.esperarA(`window.OpenClass.deck.getCurrentSlide() === ${nodo}`);
    // Fin de la transición y del ajuste de tamaño: nada se mueve entre dos lecturas.
    await deck.esperarA(`(() => { const s = window.OpenClass.deck.getCurrentSlide(); const b = s.querySelector('.oc-live-participa');
      const r = JSON.stringify([s.getBoundingClientRect(), b?.getBoundingClientRect()]); const quieta = r === window.__rect; window.__rect = r; return quieta; })()`, { intervalo: 300 });
  };
  const qrListo = `document.querySelector('.reveal .slides section.present > .oc-live-participa img')?.complete && document.querySelector('.reveal .slides section.present > .oc-live-participa img').naturalWidth > 0`;

  // Control «En vivo» en el pie azul: dentro del hueco libre X 862–1110 (portada: hueco de «anterior»).
  const controlEn = async () => deck.evaluar(`(() => { const c = document.querySelector('.oc-live-control').getBoundingClientRect(); const s = window.OpenClass.deck.getCurrentSlide().getBoundingClientRect();
    const k = s.width / 1280; const otros = [...document.querySelectorAll('.reveal .controls button.enabled, #customcontrols li button, .reveal .slide-number, .oc-inicio, .back-link')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect());
    const choca = otros.some((o) => o.width && c.left < o.right && o.left < c.right && c.top < o.bottom && o.top < c.bottom);
    return { x: (c.left - s.left) / k, derecha: (c.right - s.left) / k, y: (c.top - s.top) / k, choca, ayuda: document.querySelector('.oc-live-control').dataset.ayuda }; })()`);
  await irA(2);
  let pie = await controlEn();
  assert.ok(pie.x >= 855 && pie.derecha <= 1112 && pie.y >= 700 && !pie.choca, `control en el pie azul sin tocar otros botones ${JSON.stringify(pie)}`);
  assert.match(pie.ayuda, /tecla L/, 'ayuda al pasar el mouse o enfocar');
  await irA(0);
  pie = await controlEn();
  assert.ok(!pie.choca, `portada: control sin solapes ${JSON.stringify(pie)}`);

  // Teclado: L abre el menú con el foco en la clave; la orientación inicial es breve y descartable; Esc cierra.
  await deck.tecla('l', { code: 'KeyL', keyCode: 76 });
  await deck.esperarA(menuVisible);
  assert.equal(await deck.evaluar(`document.activeElement.id`), 'oc-live-clave', 'foco en la clave');
  assert.match(await deck.evaluar(`document.querySelector('.oc-live-menu').textContent`), /Copiar clave de presentador/, 'orientación con los tres pasos');
  await capturar(deck, '16-presentacion-conectar');
  await pulsar(deck, 'Entendido');
  assert.equal(await deck.evaluar(`localStorage.getItem('openclass-live:orientacion')`), 'vista', 'la orientación no vuelve a aparecer');
  assert.equal(await deck.evaluar(`!!document.querySelector('.oc-live-guia')`), false);
  await deck.evaluar(`document.getElementById('oc-live-clave').focus()`);
  await deck.tecla('Escape', { code: 'Escape', keyCode: 27 });
  await deck.esperarA(`document.querySelector('.oc-live-menu').hidden && document.activeElement === document.querySelector('.oc-live-control')`);
  assert.equal(await deck.evaluar(`window.OpenClass.deck.isOverview()`), false, 'Esc cierra el menú sin abrir la vista general');

  await abrirPanel();
  await deck.evaluar(`document.getElementById('oc-live-clave').value = 'clave-mal-copiada'; document.getElementById('oc-live-clave').form.requestSubmit();`);
  await deck.esperarA(`/no es válida o venció/.test(document.querySelector('.oc-live-menu').textContent)`);
  await deck.evaluar(`document.getElementById('oc-live-clave').value = ${JSON.stringify(clave)}; document.getElementById('oc-live-clave').form.requestSubmit();`);
  await deck.esperarA(`window.OpenClassLive.sala()?.codigo === ${JSON.stringify(codigo)}`);
  await deck.esperarA(`/Sala conectada/.test(document.querySelector('.oc-live-menu').textContent)`);
  await cerrarPanel();

  // Pulsar el QR de la diapositiva abre el MISMO menú (no hay un segundo panel).
  await irA(0);
  await deck.esperarA(qrListo);
  await deck.evaluar(`document.querySelector('section.present > .oc-live-participa').click()`);
  await deck.esperarA(menuVisible);
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-menu, .oc-live-panel').length`), 1, 'un único menú');
  assert.equal(await momento(), 'sin-encuesta');
  await cerrarPanel();

  // ---------- QR en portada, temática y pregunta, a tres tamaños de ventana ----------
  const MOMENTOS = [[0, 'portada', /Participa durante la sesión/], [1, 'tematica', /Tu participación es importante/], ['encuesta-live', 'encuesta', /./]];
  const NOMBRES = { portada: '12-presentacion-portada', tematica: '13-presentacion-tematica', encuesta: '14-presentacion-encuesta-qr' };
  for (const [ancho, alto] of [[1920, 1080], [1920, 945], [1536, 730]]) {
    await deck.viewport(ancho, alto);
    await deck.evaluar(`window.dispatchEvent(new Event('resize'))`);
    for (const [destino, nombre, lema] of MOMENTOS) {
      await irA(destino);
      await deck.esperarA(qrListo);
      const b = await deck.evaluar(BLOQUE);
      const donde = `${nombre} a ${ancho}×${alto}`;
      assert.deepEqual(b.choques, [], `${donde}: el QR no cubre texto ni medios`);
      assert.ok(b.dentro, `${donde}: dentro de la ventana`);
      assert.ok(b.qr.visible && b.qr.cargado, `${donde}: QR real cargado`);
      assert.equal(b.qr.src, `${APP}/qr/${codigo}.svg`, `${donde}: QR de la misma sala`);
      assert.ok(b.texto.includes(codigo), `${donde}: código visible (sin espacios en el texto)`);
      assert.deepEqual(b.grupos, [codigo.slice(0, 3), codigo.slice(3)], `${donde}: código en dos grupos de tres`);
      assert.match(b.texto, lema, `${donde}: mensaje de participación`);
      if (nombre === 'portada') assert.ok(b.lienzo.x >= 395 && b.lienzo.derecha <= 870 && b.lienzo.abajo <= 206, `${donde}: junto a la franja, sin logos, avión ni título ${JSON.stringify(b.lienzo)}`);
      if (nombre === 'tematica') assert.ok(b.lienzo.x >= 401 && b.lienzo.y >= 83 && b.lienzo.abajo <= 368, `${donde}: sobre la banda temática ${JSON.stringify(b.lienzo)}`);
      // Lado mínimo en pantalla (antes de la compresión de Zoom): 1 px del lienzo ≈ alto / 763 px.
      assert.ok(b.qr.lado >= (nombre === 'encuesta' ? 140 : 160) * (alto / 763), `${donde}: QR legible (${Math.round(b.qr.lado)} px)`);
      await capturar(deck, `${NOMBRES[nombre]}${ancho === 1920 && alto === 1080 ? '' : `-${ancho}x${alto}`}`);
    }
  }
  await deck.viewport(1920, 1080);
  await deck.evaluar(`window.dispatchEvent(new Event('resize'))`);
  await esperar(300);

  // Ampliar y reducir con la tecla Q; ocultar y volver a mostrar el QR de esta diapositiva.
  await deck.tecla('q', { code: 'KeyQ', keyCode: 81 });
  await deck.esperarA(`document.querySelector('.oc-live-capa.oc-live-capa-qr .oc-live-qr img')?.naturalWidth > 0`);
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-codigo').textContent`), codigo);
  await capturar(deck, '03-presentacion-qr');
  await deck.tecla('q', { code: 'KeyQ', keyCode: 81 });
  await deck.esperarA(`document.querySelector('.oc-live-capa').hidden`);
  await deck.evaluar(`document.querySelector('section.present .oc-live-p-ocultar').click()`);
  await deck.esperarA(`!document.querySelector('.oc-live-participa')`);
  await abrirPanel();
  await pulsar(deck, 'Mostrar QR aquí');
  await deck.esperarA(qrListo);
  await cerrarPanel();
  await deck.evaluar(`document.querySelector('section.present .oc-live-p-abrir').click()`);
  await deck.esperarA(menuVisible);
  assert.equal(await momento(), 'lista', 'en la diapositiva con pregunta: «Iniciar votación»');
  assert.equal(await deck.evaluar(`getComputedStyle(document.querySelector('#encuesta-live .oc-live-explicacion')).display`), 'none', 'la explicación no se ve en la diapositiva');

  // ---------- Pregunta 1: se abre desde Reveal.js (autoría única en el Markdown) con el tiempo global ----------
  await pulsar(deck, 'Iniciar votación · 30 s');
  await deck.esperarA(`window.OpenClassLive.estado()?.activa?.estado === 'abierta'`);
  const duracionRonda = (n) => deck.evaluar(`(() => { const e = window.OpenClassLive.estado(); return Math.round((e.activa.rondas[${n}].cierra - e.servidor) / 1000); })()`);
  assert.ok(Math.abs(await duracionRonda(0) - 30) <= 1, 'pregunta 1: 30 s sin configurar la pregunta');
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-capa').hidden`), true, 'durante la votación ninguna capa tapa la diapositiva');
  await deck.esperarA(`/^0:[0-3]\\d · 0 resp\\.$/.test(document.querySelector('section.present .oc-live-p-estado')?.textContent ?? '')`);
  await deck.esperarA(`/Votación\\s*0:[0-3]\\d/.test(document.querySelector('.oc-live-control').textContent)`);
  const b1 = await deck.evaluar(BLOQUE);
  assert.deepEqual(b1.choques, [], 'la tarjeta con cuenta regresiva no cubre texto ni medios');
  await opciones(A, 3);
  await A.esperarA(`/Quedan 0:[0-3]\\d/.test(document.getElementById('tiempo-restante')?.textContent ?? '')`);
  await capturar(A, '04-estudiante-encuesta');
  await responder(A, [0]);
  await capturar(A, '05-estudiante-registrada');

  // Estudiante B llega tarde con el mismo QR y recibe la pregunta abierta de inmediato.
  const B = await entrar(1);
  await opciones(B, 3);
  await responder(B, [1]);
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[0].respondientes === 2`);
  unaSala();
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-barra').length`), 0, 'con la votación abierta no se proyecta la distribución');
  // Tendencias privadas: el panel las ve en vivo, sin marcar la correcta; los estudiantes no.
  await panel.esperarA(`document.querySelectorAll('#panel-activa .res-fila').length === 3 && /50% \\(1\\)/.test(document.querySelector('#panel-activa .resultados').textContent)`);
  assert.equal(await panel.evaluar(`document.querySelectorAll('#panel-activa .res-fila.correcta').length`), 0, 'panel: sin la correcta durante la votación');
  assert.match(await panel.evaluar(`document.querySelector('#panel-activa .reloj')?.textContent ?? ''`), /^0:[0-3]\d$/, 'panel: tiempo restante');
  await capturar(panel, '17-panel-tendencias');
  for (const p of [A, B]) assert.equal(await p.evaluar(`document.querySelectorAll('#panel-encuesta .res-fila').length`), 0, 'el estudiante no ve estadísticas anticipadas');
  // Proyectar tendencias: acción explícita, sin la correcta; se apaga de nuevo.
  await abrirPanel();
  await pulsar(deck, 'Proyectar tendencias');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra').length === 3 && /Tendencia en vivo/.test(document.querySelector('.oc-live-capa').textContent)`);
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-barra.correcta').length`), 0, 'las tendencias proyectadas no revelan la correcta');
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-capa .oc-live-qr-lateral img')?.naturalWidth > 0`), true, 'QR de la sala junto a las tendencias');
  await capturar(deck, '18-presentacion-tendencias');
  await pulsar(deck, 'Dejar de proyectar tendencias');
  await deck.esperarA(`document.querySelector('.oc-live-capa').hidden`);
  // +30 s y cambio de preferencia: la ronda en curso conserva su vencimiento + 30 s; la siguiente usará 15 s.
  const cierra1 = await deck.evaluar(`window.OpenClassLive.estado().activa.rondas[0].cierra`);
  await pulsar(deck, '+30 segundos');
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[0].cierra === ${cierra1 + 30_000}`);
  await deck.evaluar(`document.querySelector('.oc-live-config > summary').click()`);
  await deck.evaluar(`document.querySelector('.oc-live-menu input[name=oc-live-duracion][value="15"]').click()`);
  await deck.esperarA(`window.OpenClassLive.estado().sala.duracionVotacion === 15`);
  assert.equal(await deck.evaluar(`window.OpenClassLive.estado().activa.rondas[0].cierra`), cierra1 + 30_000, 'la votación en curso no cambia en silencio');
  assert.match(await deck.evaluar(`document.querySelector('.oc-live-menu .oc-live-msg').textContent`), /próximas votaciones durarán 15 s.*conserva su tiempo/);

  // Reconexión: A recarga la página y conserva su respuesta.
  await A.ir(`${APP}/join/${codigo}`);
  await A.esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]')[0]?.checked === true`);

  await pulsar(deck, 'Cerrar ahora');
  await deck.esperarA(`window.OpenClassLive.estado().activa.estado === 'cerrada'`);
  assert.equal(await momento(), 'finalizada');
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-capa').hidden`), true, 'cerrar no muestra resultados');
  assert.equal(await B.evaluar(`document.querySelectorAll('#panel-encuesta .res-fila').length`), 0, 'cerrar no publica resultados');
  await pulsar(deck, 'Mostrar resultados');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra').length === 3`);
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-barra.correcta').length`), 0, 'publicar no revela la correcta');
  await B.esperarA(`document.querySelectorAll('#panel-encuesta .res-fila').length === 3`);

  // Segunda ronda tras la discusión (15 s, la preferencia vigente): ambos eligen B.
  await pulsar(deck, 'Discutir y repetir');
  await deck.esperarA(`window.OpenClassLive.estado().activa.ronda === 2 && window.OpenClassLive.estado().activa.estado === 'abierta'`);
  assert.ok(Math.abs(await duracionRonda(1) - 15) <= 1, 'la segunda ronda usa la preferencia vigente (15 s)');
  const ids = await deck.evaluar(`({ sala: window.OpenClassLive.sala().id, encuesta: window.OpenClassLive.estado().activa.id })`);
  for (const p of [A, B]) {
    await p.esperarA(`/Segunda ronda/.test(document.getElementById('panel-encuesta').textContent)`);
    await responder(p, [1]);
  }
  // El docente se desconecta (cierra la presentación): el servidor cierra solo, sin publicar.
  await deck.ir('about:blank');
  await A.esperarA(`/Votación cerrada/.test(document.getElementById('panel-encuesta').textContent)`, { timeout: 30_000 });
  const r2 = app.almacen.encuestaDocente(ids.sala, ids.encuesta);
  assert.equal(r2.rondas[1].cierre, 'tiempo', 'cierre automático por el servidor');
  assert.equal(r2.resultadosPublicados, false, 'el cierre automático no publica');
  assert.equal(r2.correctaRevelada, false, 'ni revela');
  assert.equal(r2.rondas[1].respondientes, 2);
  // Reconexión: la misma pestaña recupera la sala (clave de la sesión) y continúa donde quedó.
  await deck.ir(`${estatico.url}general/#/encuesta-live`);
  await deck.esperarA(`window.OpenClassLive?.sala()?.codigo === ${JSON.stringify(codigo)} && window.OpenClassLive.momento() === 'finalizada'`);
  await deck.esperarA(qrListo);
  assert.match(await deck.evaluar(`document.querySelector('section.present .oc-live-p-estado').textContent`), /Votación finalizada/);
  await abrirPanel();
  assert.match(await deck.evaluar(`document.querySelector('.oc-live-menu').textContent`), /se acabó el tiempo/);
  await capturar(deck, '19-presentacion-finalizada');
  // La preferencia vuelve a 30 s para las preguntas siguientes.
  await deck.evaluar(`document.querySelector('.oc-live-config > summary').click()`);
  await deck.evaluar(`document.querySelector('.oc-live-menu input[name=oc-live-duracion][value="30"]').click()`);
  await deck.esperarA(`window.OpenClassLive.estado().sala.duracionVotacion === 30`);
  await pulsar(deck, 'Mostrar resultados');
  await deck.esperarA(`window.OpenClassLive.momento() === 'resultados'`);
  await pulsar(deck, 'Revelar explicación');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra.correcta').length === 1 && /socket\\.join/.test(document.querySelector('.oc-live-capa').textContent)`);
  assert.match(await deck.evaluar(`document.querySelector('.oc-live-capa').textContent`), /ronda 1: 50%/, 'comparación con la primera ronda');
  // QR y resultados conviven sin solaparse.
  assert.equal(await deck.evaluar(`(() => { const q = document.querySelector('.oc-live-capa .oc-live-qr-lateral'); const r = document.querySelector('.oc-live-capa .oc-live-resultados'); if (!q || !q.querySelector('img').naturalWidth) return false;
    const a = q.getBoundingClientRect(); const b = r.getBoundingClientRect(); return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top; })()`), true, 'QR junto a los resultados, sin solaparse');
  await cerrarPanel();
  await capturar(deck, '06-presentacion-resultados');
  await A.esperarA(`/Su respuesta fue correcta/.test(document.getElementById('panel-encuesta').textContent) && document.querySelector('#panel-encuesta pre')`);
  await capturar(A, '07-estudiante-revelada');
  await panel.esperarA(`document.querySelector('#panel-activa table.comparar')`);
  await capturar(panel, '08-panel-comparacion');

  // ---------- Navegar: la sala y los estudiantes siguen; capa y QR de la encuesta se ocultan ----------
  await irA('privada');
  assert.equal(await deck.evaluar(`document.querySelector('.oc-live-capa').hidden && !document.querySelector('.oc-live-participa')`), true, 'fuera de la diapositiva de la encuesta no hay QR ni resultados');
  await irA(1);
  await deck.esperarA(qrListo);
  await irA('privada');
  assert.equal(await deck.evaluar(`window.OpenClassLive.sala().codigo`), codigo);
  assert.equal(await deck.evaluar(`window.OpenClassLive.estado().sala.conectados`), 2, 'A y B siguen conectados');
  for (const p of [A, B]) assert.equal(await enSala(p), true, 'el estudiante sigue en la sala');
  unaSala();

  // ---------- Pregunta 2 en la MISMA sala; C entra con el QR contextual ----------
  await irA('encuesta-live-2');
  await deck.esperarA(qrListo);
  const b2 = await deck.evaluar(BLOQUE);
  assert.deepEqual(b2.choques, [], 'pregunta 2: el QR no cubre el enunciado ni las opciones');
  assert.equal(b2.qr.src, `${APP}/qr/${codigo}.svg`, 'pregunta 2: QR de la misma sala');
  await abrirPanel();
  await pulsar(deck, 'Iniciar votación · 30 s');
  await deck.esperarA(`/Qué datos salen/.test(window.OpenClassLive.estado()?.activa?.enunciado) && window.OpenClassLive.estado().activa.estado === 'abierta'`);
  assert.ok(Math.abs(await duracionRonda(0) - 30) <= 1, 'pregunta 2: de nuevo 30 s, sin configurar la pregunta');
  for (const p of [A, B]) await opciones(p, 4);
  const C = await entrar(2);
  await opciones(C, 4);
  await responder(A, [0, 2]);
  await responder(B, [0]);
  await responder(C, [0, 2]);
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[0].respondientes === 3`);
  assert.equal(await deck.evaluar(`window.OpenClassLive.estado().sala.conectados`), 3, 'A, B y C conectados');
  unaSala();
  await pulsar(deck, 'Cerrar ahora');
  await deck.esperarA(`window.OpenClassLive.estado().activa.estado === 'cerrada'`);
  await pulsar(deck, 'Mostrar resultados');
  await deck.esperarA(`window.OpenClassLive.momento() === 'resultados'`);
  await pulsar(deck, 'Revelar explicación');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra').length === 4 && document.querySelectorAll('.oc-live-barra.correcta').length === 2`);
  await cerrarPanel();
  await capturar(deck, '15-presentacion-pregunta2-resultados');
  await C.esperarA(`/Su respuesta fue correcta/.test(document.getElementById('panel-encuesta').textContent)`);

  // ---------- Pregunta 3 (con código) en la MISMA sala: A, B y C responden; C se reconecta ----------
  await irA('encuesta-live-3');
  await deck.esperarA(qrListo);
  const b3 = await deck.evaluar(BLOQUE);
  assert.deepEqual(b3.choques, [], 'pregunta 3: el QR no cubre el enunciado, el código ni las opciones');
  assert.equal(await deck.evaluar(`window.OpenClassLive.estado().activa.estado`), 'cerrada', 'llegar a la diapositiva no abre la votación');
  await abrirPanel();
  await pulsar(deck, 'Iniciar votación · 30 s');
  await deck.esperarA(`/Qué imprime/.test(window.OpenClassLive.estado()?.activa?.enunciado) && window.OpenClassLive.estado().activa.estado === 'abierta'`);
  assert.ok(Math.abs(await duracionRonda(0) - 30) <= 1, 'pregunta 3: 30 s');
  for (const p of [A, B, C]) await opciones(p, 3);
  await responder(A, [2]);
  await responder(B, [0]);
  await responder(C, [2]);
  await C.ir(`${APP}/join/${codigo}`);
  await C.esperarA(`document.querySelectorAll('#panel-encuesta input[name=opcion]')[2]?.checked === true`);
  await deck.esperarA(`window.OpenClassLive.estado().activa.rondas[0].respondientes === 3`);
  unaSala();
  await pulsar(deck, 'Cerrar ahora');
  await deck.esperarA(`window.OpenClassLive.estado().activa.estado === 'cerrada'`);
  await pulsar(deck, 'Mostrar resultados');
  await deck.esperarA(`window.OpenClassLive.momento() === 'resultados'`);
  await pulsar(deck, 'Revelar explicación');
  await deck.esperarA(`document.querySelectorAll('.oc-live-barra.correcta').length === 1 && document.querySelector('.oc-live-capa .oc-live-qr-lateral img')?.naturalWidth > 0`);
  for (const p of [A, C]) await p.esperarA(`/Su respuesta fue correcta/.test(document.getElementById('panel-encuesta').textContent)`);

  // ---------- Pregunta abierta: moderada antes de llegar a la pantalla compartida ----------
  await B.evaluar(`document.getElementById('tab-preguntas').click(); document.getElementById('texto-pregunta').value = '<b>¿</b>Se puede usar join con varias salas?'; document.getElementById('form-pregunta').requestSubmit();`);
  await B.esperarA(`/docente la apruebe/.test(document.getElementById('aviso-pregunta').textContent)`);
  await capturar(B, '09-estudiante-pregunta');
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
  assert.ok(salientes.length >= 8, 'eventos emitidos por la presentación');
  const todo = `${tramas.join('\n')}\n${peticiones.filter((p) => p.url.startsWith(APP)).map((p) => `${p.url} ${p.cuerpo}`).join('\n')}`;
  for (const m of MARCADORES) assert.ok(!todo.includes(m), `no sale «${m}»`);
  // Formato de trama: 42/docente,<ack>[evento, datos]. Cada pregunta sale UNA vez, tal como está en el Markdown.
  const creadas = salientes.map((x) => JSON.parse(x.replace(/^42(?:\/[^,[]*,)?\d*/, ''))).filter(([ev]) => ev === 'encuesta:crear');
  assert.equal(creadas.length, 3, 'una creación por pregunta');
  for (const [, datos] of creadas.slice(0, 2)) assert.deepEqual(Object.keys(datos.encuesta).sort(), ['correctas', 'enunciado', 'explicacion', 'opciones', 'tipo']);
  assert.deepEqual(creadas[0][1].encuesta.opciones, ['socket.enter()', 'socket.join()', 'io.attach()']);
  assert.deepEqual(creadas[0][1].encuesta.correctas, [1]);
  assert.deepEqual(creadas[1][1].encuesta.correctas, [0, 2]);
  assert.equal(creadas[1][1].encuesta.tipo, 'multiple');
  assert.deepEqual(creadas[2][1].encuesta, { enunciado: '¿Qué imprime este programa?', codigo: 'console.log((7 / 2) | 0);', tipo: 'unica', opciones: ['3.5', '4', '3'], correctas: [2], explicacion: 'El operador | convierte a entero de 32 bits y descarta la parte decimal: 3.' });
  assert.ok(creadas.every(([, d]) => d.salaId === creadas[0][1].salaId), 'las tres preguntas en la misma sala');
  const recursos = peticiones.filter((p) => p.url.startsWith(APP)).map((p) => new URL(p.url).pathname);
  assert.ok(recursos.every((r) => r.startsWith('/socket.io/') || /^\/qr\/[A-Z2-9]{6}\.svg$/.test(r)), `solo cliente Socket.IO y QR: ${[...new Set(recursos)].join(', ')}`);
  assert.ok(!registro.join('\n').includes('join con varias salas'), 'el texto de la pregunta no se registra');

  // ---------- PDF: ni QR ni capas, aunque la clave siga en la sesión del navegador ----------
  const pdf = await nDocente.pagina({ ancho: 1280, alto: 720 });
  const pdfPeticiones = [];
  pdf.cdp.oyentes.add((m) => { if (m.sessionId === pdf.sessionId && m.method === 'Network.requestWillBeSent') pdfPeticiones.push(m.params.request.url); });
  await pdf.send('Network.enable');
  await pdf.ir(`${estatico.url}general/`);
  await pdf.evaluar(`sessionStorage.setItem('openclass-live:clave', ${JSON.stringify(clave)})`);
  await pdf.ir(`${estatico.url}general/?print-pdf`);
  await pdf.esperarA(`window.OpenClass?.deck?.isReady?.() && document.documentElement.classList.contains('reveal-print')`, { timeout: 30000 });
  await esperar(1500);
  assert.equal(await pdf.evaluar(`document.querySelectorAll('.oc-live-participa, .oc-live-control, .oc-live-capa, .oc-live-banda, .oc-live-menu').length`), 0, 'PDF sin QR ni capas de OpenClass Live');
  assert.equal(pdfPeticiones.filter((u) => u.startsWith(APP)).length, 0, 'el PDF no contacta OpenClass Live');
  const { data } = await pdf.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true });
  assert.ok(data.length > 1000, 'PDF generado');
  if (CAPTURAS) writeFileSync(path.join(CAPTURAS, 'presentacion.pdf'), Buffer.from(data, 'base64'));

  // ---------- Fin de sesión ----------
  await pulsar(panel, 'Finalizar sesión');
  for (const p of [A, B, C]) await p.esperarA(`!document.getElementById('vista-fin').classList.contains('oculto')`);
  await deck.esperarA(`!window.OpenClassLive.sala() && !document.querySelector('.oc-live-participa')`);
  assert.equal(app.almacen.tamano, 0, 'datos eliminados del servidor');
  for (const p of [panel, deck, A, B, C, pdf]) assert.deepEqual(p.errores, [], 'sin excepciones de JavaScript');
});
