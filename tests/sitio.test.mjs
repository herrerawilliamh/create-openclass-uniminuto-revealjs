/**
 * Sitio de GitHub Pages construido en _site/ (npm run site:build): landing, enlaces y recursos.
 * SITIO_URL permite probar el sitio publicado real (p. ej. https://usuario.github.io/repo/).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../scripts/lib/chrome.mjs';
import { servir } from '../scripts/lib/servidor.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.PAGES_BASE || '/create-openclass-uniminuto-revealjs/';
const remoto = process.env.SITIO_URL;
const omitir = !remoto && !existsSync(path.join(raiz, '_site/index.html')) ? 'Ejecuta npm run site:build' : false;
let servidor, navegador, pagina, url;

before(async () => {
  if (omitir) return;
  if (remoto) url = remoto.endsWith('/') ? remoto : `${remoto}/`;
  else { servidor = await servir(path.join(raiz, '_site'), { base: BASE }); url = servidor.url; }
  navegador = await abrirNavegador();
  pagina = await navegador.pagina({ ancho: 1440, alto: 900 });
  await pagina.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] }).catch(() => {});
});
after(async () => { await navegador?.cerrar(); await servidor?.cerrar(); });

test('Landing: botones principales y 13 tarjetas con miniatura real', { skip: omitir }, async () => {
  await pagina.ir(url);
  const d = await pagina.evaluar(`({
    botones: [...document.querySelectorAll('.heroe .boton')].map(a => a.textContent.trim()),
    tarjetas: document.querySelectorAll('.rejilla-layouts .layout').length,
    secciones: ['instalar', 'layouts', 'actividades', 'ia'].filter(id => document.getElementById(id)),
    aviso: document.querySelector('.aviso')?.textContent || '',
  })`);
  for (const b of ['INSTALAR CON NPM', 'VER DEMOSTRACIÓN', 'EXPLORAR LOS 13 LAYOUTS', 'GUÍA DEL DOCENTE', 'GITHUB']) assert.ok(d.botones.includes(b), `falta ${b}`);
  assert.equal(d.tarjetas, 13);
  assert.equal(d.secciones.length, 4);
  assert.match(d.aviso, /No es un sitio oficial/);
  await pagina.evaluar('document.querySelectorAll("img").forEach(i => { i.loading = "eager"; }), true');
  await pagina.esperarA('[...document.images].every(i => i.complete)', { timeout: 30000 });
  assert.deepEqual(await pagina.evaluar('[...document.images].filter(i => !i.naturalWidth).map(i => i.src)'), []);
});

test('Landing: todos los enlaces internos responden 200 (rutas con base)', { skip: omitir }, async () => {
  await pagina.ir(url);
  const enlaces = await pagina.evaluar(`[...new Set([...document.querySelectorAll('a[href]')].map(a => a.href.split('#')[0]))].filter(h => h.startsWith(location.origin))`);
  assert.ok(enlaces.length >= 5, `enlaces internos: ${enlaces.join(' ')}`);
  for (const enlace of enlaces) {
    const r = await fetch(enlace);
    assert.equal(r.status, 200, enlace);
  }
  // Refresh directo de páginas internas.
  for (const ruta of ['curso/', 'curso/demo-completa/', 'curso/galeria/', 'curso/guia/', 'curso/actividades/microactividad/index.html']) {
    assert.equal((await fetch(new URL(ruta, url))).status, 200, ruta);
  }
});

test('Landing: copiar Markdown de un layout y diseño móvil', { skip: omitir }, async () => {
  await pagina.ir(url);
  await pagina.evaluar('document.querySelector("[data-layout=code]").click(), true');
  await pagina.esperarA('document.querySelector("[data-layout=code]").textContent === "¡Copiado!"');
  const texto = await pagina.evaluar('navigator.clipboard.readText().catch(() => "")');
  if (texto) assert.match(texto, /oc-l-code/);
  await pagina.viewport(390, 844);
  await pagina.ir(url);
  assert.equal(await pagina.evaluar('document.documentElement.scrollWidth <= innerWidth + 1'), true, 'scroll horizontal en móvil');
});

test('Demostración publicada: carga el deck con recursos bajo la base', { skip: omitir }, async () => {
  await pagina.viewport(1920, 1080);
  pagina.errores.length = 0;
  await pagina.ir(new URL('curso/demo-completa/', url).href);
  await pagina.esperarA('window.OpenClass?.deck?.isReady?.()', { timeout: 40000 });
  assert.ok(await pagina.evaluar('OpenClass.deck.getTotalSlides()') >= 26);
  const errores = pagina.errores.filter((e) => !/favicon/.test(e));
  assert.deepEqual(errores, []);
});
