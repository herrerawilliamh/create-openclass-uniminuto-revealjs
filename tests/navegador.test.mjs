/**
 * Pruebas en Chrome real (headless) sobre un curso COMPILADO.
 * Variables: OPENCLASS_DIST (carpeta dist/) y OPENCLASS_BASE (base de Vite, p. ej. /mi-repo/).
 * `npm run test:navegador` prepara un curso nuevo, lo compila y define ambas variables.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { abrirNavegador } from '../scripts/lib/chrome.mjs';
import { servir } from '../scripts/lib/servidor.mjs';

const DIST = process.env.OPENCLASS_DIST;
const BASE = process.env.OPENCLASS_BASE || '/';
const omitir = !DIST || !existsSync(DIST) ? 'Define OPENCLASS_DIST o usa npm run test:navegador' : false;
const IDS = ['portada', 'separador', 'resultados', 'imagen-izquierda', 'imagen-derecha', 'titulo-izquierdo', 'titulo-derecho',
  'texto', 'dos-columnas', 'dos-titulos', 'codigo', 'codigo-scroll', 'codigo-paginado', 'tabla', 'video', 'formulas',
  'mermaid', 'chart', 'actividad-iframe', 'pregunta', 'actividad-practica', 'notas', 'resumen', 'cierre'];
const CLASES = ['oc-l-cover', 'oc-l-section', 'oc-l-image-left', 'oc-l-image-right', 'oc-l-top-right', 'oc-l-top-left',
  'oc-l-multimedia', 'oc-l-text', 'oc-l-objectives', 'oc-l-two-cols', 'oc-l-two-titles', 'oc-l-code', 'oc-l-closing'];

let servidor, navegador, pagina;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function abrirDeck(ruta, ancho = 1920, alto = 1080) {
  await pagina.viewport(ancho, alto);
  await pagina.ir(`${servidor.url}${ruta}`);
  await pagina.esperarA('window.OpenClass?.deck?.isReady?.()', { timeout: 30000 });
  await pagina.evaluar('document.fonts.ready.then(() => true)');
}
async function irA(id) {
  await pagina.evaluar(`(OpenClass.deck.slide(...Object.values(OpenClass.deck.getIndices(document.getElementById(${JSON.stringify(id)})))), true)`);
  await pagina.esperarA(`OpenClass.deck.getCurrentSlide().id === ${JSON.stringify(id)}`);
  await esperar(900); // transición y plugins que reaccionan a slidechanged
}
const indice = () => pagina.evaluar('OpenClass.deck.getIndices().h');

before(async () => {
  if (omitir) return;
  servidor = await servir(DIST, { base: BASE });
  navegador = await abrirNavegador();
  pagina = await navegador.pagina();
  await pagina.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
});
after(async () => { await navegador?.cerrar(); await servidor?.cerrar(); });

test('Portal: acceso a la demostración completa y a la galería', { skip: omitir }, async () => {
  await pagina.viewport(1366, 768);
  await pagina.ir(servidor.url);
  await pagina.esperarA('document.querySelector(".portal")');
  const enlaces = await pagina.evaluar('[...document.querySelectorAll(".portal a")].map(a => [a.textContent.trim(), a.getAttribute("href")])');
  const demo = enlaces.find(([t]) => /VER DEMOSTRACIÓN COMPLETA/.test(t));
  assert.ok(demo, 'falta VER DEMOSTRACIÓN COMPLETA');
  assert.equal(demo[1], `${BASE}demo-completa/`);
  assert.ok(enlaces.some(([, h]) => h === `${BASE}galeria/`), 'falta enlace a galería');
  assert.ok(enlaces.some(([, h]) => h === `${BASE}guia/`), 'falta enlace a guía');
  // La demostración no se presenta como semana académica.
  assert.equal(await pagina.evaluar('[...document.querySelectorAll(".week-grid a")].some(a => a.href.includes("demo-completa"))'), false);
});

test('Demostración completa: 13 layouts, ids, notas e identidad', { skip: omitir }, async () => {
  await abrirDeck('demo-completa/');
  const datos = await pagina.evaluar(`({
    ids: [...document.querySelectorAll('.reveal .slides > section[id]')].map(s => s.id),
    clases: [...new Set([...document.querySelectorAll('.reveal .slides > section')].flatMap(s => [...s.classList].filter(c => c.startsWith('oc-l-'))))],
    notas: document.querySelectorAll('.reveal .slides > section aside.notes').length,
    total: OpenClass.deck.getTotalSlides(),
    numero: document.querySelector('.reveal .slide-number')?.textContent.replace(/\\s+/g, ' ').trim(),
    herramientas: [...document.querySelectorAll('#customcontrols button')].filter(b => !/Show\\/hide/.test(b.title)).length,
    inicio: document.querySelector('.oc-inicio img')?.naturalWidth || 0,
    casa: !!document.querySelector('.back-link'),
    sello: getComputedStyle(document.querySelector('.slide-background[data-background-hash*="slide-01-portada"]'), '::after').backgroundImage,
  })`);
  for (const id of IDS) assert.ok(datos.ids.includes(id), `falta diapositiva #${id}`);
  for (const c of CLASES) assert.ok(datos.clases.includes(c), `falta layout ${c}`);
  assert.equal(datos.clases.length, 13);
  assert.ok(datos.notas >= 20, `notas: ${datos.notas}`);
  assert.match(datos.numero, new RegExp(`Diapositiva 1 / ${datos.total}`));
  assert.equal(datos.herramientas, 7);
  assert.ok(datos.inicio > 0, 'botón de inicio sin imagen');
  assert.ok(datos.casa);
  assert.ok(datos.sello.includes(`${BASE}imagenes/acreditacion-openclass.png`), `sello fuera de la base: ${datos.sello}`);
  // El botón de inicio vuelve a la diapositiva 0.
  await irA('texto');
  await pagina.evaluar('document.querySelector(".oc-inicio").click(), true');
  await pagina.esperarA('OpenClass.deck.getIndices().h === 0');
});

test('Código en modo scroll: rueda, teclado, copiar y sin tapar el pie', { skip: omitir }, async () => {
  await abrirDeck('demo-completa/');
  await irA('codigo-scroll');
  const h = await indice();
  const caja = await pagina.evaluar(`(() => { const s = OpenClass.deck.getCurrentSlide(); const p = s.querySelector('pre'); const r = p.getBoundingClientRect(); const sr = s.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, desborda: p.scrollHeight > p.clientHeight + 20, horizontal: p.scrollWidth > p.clientWidth + 20,
      lineas: p.querySelector('code').textContent.split('\\n').length, sobrePie: r.bottom <= sr.top + sr.height * 666 / 720 + 2,
      indicador: s.hasAttribute('data-oc-mas-codigo'), boton: !!s.querySelector('.oc-copiar') }; })()`);
  assert.ok(caja.desborda && caja.horizontal, 'el programa debería desbordar en ambos ejes');
  assert.ok(caja.lineas >= 44, `líneas: ${caja.lineas}`);
  assert.ok(caja.sobrePie, 'el código invade el pie');
  assert.ok(caja.indicador, 'falta el indicador de más código');
  assert.ok(caja.boton, 'falta el botón copiar');
  await pagina.rueda(caja.x, caja.y, 400);
  await esperar(400);
  assert.ok(await pagina.evaluar('OpenClass.deck.getCurrentSlide().querySelector("pre").scrollTop') > 0, 'la rueda no desplazó el código');
  assert.equal(await indice(), h, 'la rueda cambió de diapositiva');
  await pagina.evaluar('(() => { const p = OpenClass.deck.getCurrentSlide().querySelector("pre"); p.scrollTop = 0; p.scrollLeft = 0; p.focus(); return true; })()');
  await pagina.tecla('ArrowDown', { keyCode: 40 });
  await pagina.tecla('ArrowRight', { keyCode: 39 });
  await esperar(400);
  const tras = await pagina.evaluar('(() => { const p = OpenClass.deck.getCurrentSlide().querySelector("pre"); return { top: p.scrollTop, left: p.scrollLeft }; })()');
  assert.ok(tras.top > 0 && tras.left > 0, `las flechas no desplazaron: ${JSON.stringify(tras)}`);
  assert.equal(await indice(), h, 'una flecha cambió de diapositiva mientras había recorrido');
  // Al final del recorrido horizontal, la flecha derecha vuelve a avanzar (control remoto).
  await pagina.evaluar('(() => { const p = OpenClass.deck.getCurrentSlide().querySelector("pre"); p.scrollLeft = p.scrollWidth; p.focus(); return true; })()');
  await pagina.tecla('ArrowRight', { keyCode: 39 });
  await pagina.esperarA(`OpenClass.deck.getIndices().h === ${h + 1}`);
  // Copiar código.
  await irA('codigo-scroll');
  await pagina.evaluar('OpenClass.deck.getCurrentSlide().querySelector(".oc-copiar").click(), true');
  await pagina.esperarA('OpenClass.deck.getCurrentSlide().querySelector(".oc-copiar").textContent === "¡Copiado!"');
  const copiado = await pagina.evaluar('navigator.clipboard.readText().catch(() => "")');
  if (copiado) assert.match(copiado, /^\/\/ Registro de asistencia[\s\S]*Fin del programa/);
});

test('Código paginado: continuaciones de ≤16 líneas sin desbordar', { skip: omitir }, async () => {
  await abrirDeck('demo-completa/');
  const paginas = await pagina.evaluar(`[...document.querySelectorAll('.reveal .slides > section.oc-l-code')]
    .filter(s => /^Código paginado/.test(s.querySelector('h2')?.textContent || ''))
    .map(s => ({ titulo: s.querySelector('h2').textContent, lineas: s.querySelector('code').textContent.replace(/\\n$/, '').split('\\n').length, id: s.id }))`);
  assert.equal(paginas.length, 3, JSON.stringify(paginas));
  assert.deepEqual(paginas.map((p) => p.titulo), ['Código paginado', 'Código paginado (continuación 2)', 'Código paginado (continuación 3)']);
  assert.ok(paginas.every((p) => p.lineas <= 16));
  assert.deepEqual(paginas.map((p) => p.id), ['codigo-paginado', '', '']);
  await irA('codigo-paginado');
  assert.equal(await pagina.evaluar('(() => { const p = OpenClass.deck.getCurrentSlide().querySelector("pre"); return p.scrollHeight <= p.clientHeight + 2; })()'), true);
});

test('Mermaid, Chart, fórmulas, video, iframe y fragmentos', { skip: omitir }, async () => {
  await abrirDeck('demo-completa/');
  await irA('mermaid');
  assert.ok(await pagina.evaluar('!!document.querySelector("#mermaid .mermaid svg")'), 'Mermaid no generó SVG');
  await irA('chart');
  await pagina.esperarA('window.Chart && Chart.getChart(document.querySelector("#chart canvas"))');
  assert.equal(await pagina.evaluar('Chart.getChart(document.querySelector("#chart canvas")).data.datasets.length'), 2);
  await irA('formulas');
  const katex = await pagina.esperarA('document.querySelectorAll("#formulas .katex").length', { timeout: 20000 }).catch(() => 0);
  assert.ok(katex >= 2, 'KaTeX no renderizó (requiere conexión al CDN)');
  await irA('video');
  await pagina.esperarA('document.querySelector("#video video").readyState >= 1', { timeout: 15000 });
  const video = await pagina.evaluar('(() => { const v = document.querySelector("#video video"); return { duracion: v.duration, pistas: v.textTracks.length }; })()');
  assert.ok(video.duracion > 5 && video.duracion < 15, `duración ${video.duracion}`);
  assert.equal(video.pistas, 1);
  await irA('actividad-iframe');
  const iframe = await pagina.evaluar('(() => { const f = document.querySelector("#actividad-iframe iframe"); const r = f.getBoundingClientRect(); return { src: f.getAttribute("src"), sandbox: f.getAttribute("sandbox"), w: r.width, h: r.height }; })()');
  assert.equal(iframe.src, `${BASE}actividades/microactividad/index.html`);
  assert.equal(iframe.sandbox, 'allow-scripts allow-forms');
  assert.ok(iframe.w > 800 && iframe.h > 380);
  await irA('pregunta');
  assert.equal(await pagina.evaluar('document.querySelectorAll("#pregunta .fragment").length'), 2);
});

test('Microactividad: respuestas correctas, incorrectas, incompletas y reinicio', { skip: omitir }, async () => {
  await pagina.viewport(1196, 566);
  await pagina.ir(`${servidor.url}actividades/microactividad/index.html`);
  await pagina.esperarA('document.body.dataset.estado === "listo"');
  const responder = (modo) => pagina.evaluar(`(() => {
    const datos = window.OC_ACTIVIDAD;
    for (const item of document.querySelectorAll('.item')) {
      const e = datos.elementos[Number(item.dataset.indice)];
      const opciones = [...item.querySelectorAll('input')];
      const elegido = ${JSON.stringify(modo)} === 'correcto' ? opciones.find(o => o.value === e.categoria) : opciones.find(o => o.value !== e.categoria);
      elegido.click();
    }
    return true; })()`);
  await pagina.evaluar('document.querySelector("#comprobar").click(), true');
  assert.equal(await pagina.evaluar('document.body.dataset.estado'), 'incompleto');
  assert.equal(await pagina.evaluar('document.querySelectorAll(".item.pendiente").length'), 8);
  await responder('correcto');
  await pagina.evaluar('document.querySelector("#comprobar").click(), true');
  assert.equal(await pagina.evaluar('document.body.dataset.estado'), 'evaluado');
  assert.equal(await pagina.evaluar('document.body.dataset.aciertos'), '8');
  assert.match(await pagina.evaluar('document.querySelector("#puntaje").textContent'), /8 de 8 \(100 %\)/);
  await pagina.evaluar('document.querySelector("#reiniciar").click(), true');
  assert.equal(await pagina.evaluar('document.body.dataset.estado'), 'listo');
  assert.equal(await pagina.evaluar('document.querySelectorAll("input:checked").length'), 0);
  await responder('incorrecto');
  await pagina.evaluar('document.querySelector("#comprobar").click(), true');
  assert.equal(await pagina.evaluar('document.body.dataset.aciertos'), '0');
  assert.equal(await pagina.evaluar('document.querySelectorAll(".item.incorrecto").length'), 8);
  assert.match(await pagina.evaluar('document.querySelector("#estado").textContent'), /0 de 8/);
  assert.equal(await pagina.evaluar('document.querySelector("#reintentar").hidden'), false);
});

test('Galería: 13 fichas con miniatura real, copiar y ver ejemplo', { skip: omitir }, async () => {
  await pagina.viewport(1440, 900);
  await pagina.ir(`${servidor.url}galeria/`);
  await pagina.esperarA('document.documentElement.dataset.listo === "true"');
  await pagina.evaluar('document.querySelectorAll(".g-tarjeta img").forEach(i => { i.loading = "eager"; }), true');
  await pagina.esperarA('[...document.querySelectorAll(".g-tarjeta img")].every(i => i.complete)', { timeout: 20000 }).catch(() => {});
  const g = await pagina.evaluar(`({
    tarjetas: document.querySelectorAll('.g-tarjeta').length,
    rotas: [...document.querySelectorAll('.g-tarjeta img')].filter(i => !i.naturalWidth).map(i => i.src),
    enlaces: [...document.querySelectorAll('.g-tarjeta a.g-boton')].map(a => a.getAttribute('href')),
  })`);
  assert.equal(g.tarjetas, 13);
  assert.deepEqual(g.rotas, []);
  for (const h of g.enlaces) assert.match(h, new RegExp(`^${BASE}demo-completa/#/[a-z-]+$`));
  await pagina.evaluar('document.querySelector(".g-tarjeta .g-boton").click(), true');
  await pagina.esperarA('document.querySelector(".g-tarjeta .g-boton").textContent === "¡Copiado!"');
  await pagina.viewport(390, 844);
  assert.equal(await pagina.evaluar('document.documentElement.scrollWidth <= window.innerWidth'), true, 'scroll horizontal en móvil');
});

test('Guía del docente: 20 capítulos, buscador, miniaturas y móvil', { skip: omitir }, async () => {
  await pagina.viewport(1440, 900);
  await pagina.ir(`${servidor.url}guia/`);
  await pagina.esperarA('document.querySelectorAll("[data-search]").length > 0');
  assert.equal(await pagina.evaluar('document.querySelectorAll("section.chapter[data-search]").length'), 20);
  for (const id of ['requisitos', 'instalacion', 'configuracion', 'semanas', 'pedagogia', 'layouts', 'recursos', 'codigo', 'actividades', 'diagramas', 'ia', 'herramientas', 'pdf', 'publicacion']) {
    assert.ok(await pagina.evaluar(`!!document.getElementById(${JSON.stringify(id)})`), `falta capítulo #${id}`);
  }
  assert.match(await pagina.evaluar('document.getElementById("instalacion").textContent'), /npm create openclass-uniminuto-revealjs@latest mi-curso/);
  await pagina.evaluar('(() => { const s = document.querySelector("[data-guide-search]"); s.value = "paginate"; s.dispatchEvent(new Event("input")); return true; })()');
  const visibles = await pagina.evaluar('[...document.querySelectorAll("section.chapter")].filter(c => !c.hidden).map(c => c.id)');
  assert.ok(visibles.includes('codigo') && visibles.length < 20, `búsqueda: ${visibles}`);
  await pagina.evaluar('document.querySelectorAll(".thumbs img").forEach(i => { i.loading = "eager"; }), true');
  await pagina.esperarA('[...document.querySelectorAll(".thumbs img")].every(i => i.complete)');
  assert.equal(await pagina.evaluar('[...document.querySelectorAll(".thumbs img")].filter(i => i.naturalWidth > 0).length'), 13);
  await pagina.viewport(390, 844);
  await esperar(300);
  assert.equal(await pagina.evaluar('document.documentElement.scrollWidth <= window.innerWidth + 1'), true, 'scroll horizontal en móvil');
});

test('Resoluciones 1920×1080, 1920×945 y 1536×730: lienzo, pie y auditoría', { skip: omitir }, async () => {
  for (const [w, hh] of [[1920, 1080], [1920, 945], [1536, 730]]) {
    pagina.consola.length = 0;
    await abrirDeck('demo-completa/', w, hh);
    await esperar(500);
    const r = await pagina.evaluar(`(() => { const c = document.querySelector('#customcontrols')?.getBoundingClientRect();
      const n = document.querySelector('.reveal .slide-number')?.getBoundingClientRect();
      return { controles: c && c.bottom <= innerHeight && c.top >= 0, numero: n && n.bottom <= innerHeight }; })()`);
    assert.ok(r.controles, `${w}×${hh}: barra fuera de la ventana`);
    assert.ok(r.numero, `${w}×${hh}: contador fuera de la ventana`);
    const avisos = pagina.consola.filter((m) => /Contenido que requiere revisión/.test(m.texto));
    assert.equal(avisos.length, 0, `${w}×${hh}: ${avisos.map((m) => m.texto).join(' ')}`);
  }
});

test('Exportación PDF (?print-pdf) produce una página por diapositiva', { skip: omitir }, async () => {
  await pagina.viewport(1280, 720);
  await pagina.ir(`${servidor.url}demo-completa/?print-pdf`);
  await pagina.esperarA('window.OpenClass?.deck?.isReady?.()', { timeout: 30000 });
  await esperar(1500);
  const { data } = await pagina.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const pdf = Buffer.from(data, 'base64');
  const paginas = Math.max(0, ...(pdf.toString('latin1').match(/\/Count (\d+)/g) || []).map((m) => Number(m.slice(7))));
  const total = await pagina.evaluar('OpenClass.deck.getTotalSlides()');
  assert.equal(await pagina.evaluar('document.querySelectorAll(".pdf-page").length >= OpenClass.deck.getTotalSlides()'), true);
  assert.ok(pdf.length > 100000, `PDF demasiado pequeño: ${pdf.length}`);
  assert.ok(paginas >= total, `páginas ${paginas} < diapositivas ${total}`);
});

test('Sin errores de JavaScript ni recursos 404', { skip: omitir }, async () => {
  const errores = pagina.errores.filter((e) => !/favicon|cdn\.jsdelivr|net::ERR_INTERNET/.test(e));
  assert.deepEqual(errores, []);
});
