// Portal académico centrado en el estudiante (P3, OpenClass 1.1.0) en Chrome real sobre un curso desechable
// compilado con base de subcarpeta (como GitHub Pages). Jerarquía: identidad del curso → Comenzar aquí → semanas
// publicadas (solo generation.activeWeeks, en orden) → tres recorridos → recursos complementarios (secundario).
// También: enlaces que responden, teclado, escritorio y móvil sin desbordes, y ningún dato de semanas inactivas.
// Evidencia (capturas, mediciones y SHA-256 del build) en OPENCLASS_EVIDENCIA (o <tmp>/openclass-portal-p3-evidencia).
// Ejecutar con `npm run test:portal` (también en CI, job de Chrome: .github/workflows/ci.yml).
// OPENCLASS_CURSO=<curso con node_modules> reutiliza una instalación; su configuración se sobrescribe.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, realpathSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../scripts/lib/chrome.mjs';
import { servir } from '../scripts/lib/servidor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const BASE = '/prueba-openclass/';
const EVIDENCIA = process.env.OPENCLASS_EVIDENCIA || path.join(os.tmpdir(), 'openclass-portal-p3-evidencia');
const npm = (cwd, a, env = {}) => spawnSync(win ? 'npm.cmd' : 'npm', a, { cwd, encoding: 'utf8', shell: win, env: { ...process.env, ...env } });
const ok = (r) => assert.equal(r.status, 0, r.stdout + r.stderr);
const sha = (b) => createHash('sha256').update(b).digest('hex');
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Marcadores que solo existen en datos no publicables: semana inactiva y claves fuera de la lista pública.
const SECRETOS = ['P3_INACTIVA_TITULO_7f3a', 'P3_INACTIVA_TEMA_7f3a', 'P3_PRIVADO_RAIZ_7f3a', 'P3_PRIVADO_CURSO_7f3a', 'P3_PRIVADO_ACTIVIDAD_7f3a'];
const NOMBRE = 'Fundamentos de Ingeniería de Software para Sistemas Distribuidos y Computación en la Nube';
const SEMANAS = {
 1: { title: 'Introducción a los sistemas distribuidos', centralTheme: 'Qué es un sistema distribuido' },
 3: { title: 'Comunicación entre servicios', centralTheme: 'Mensajes, colas y eventos' },
 5: { title: 'Consistencia, disponibilidad y tolerancia a particiones en arquitecturas de microservicios desplegadas en la nube',
  centralTheme: 'Teorema CAP aplicado a decisiones de diseño con réplicas geográficamente distribuidas y latencias variables' },
};
const config = (activeWeeks) => ({
 p3Privado: SECRETOS[2],
 course: { shortName: 'sdp3', fullName: NOMBRE, year: '2026', description: 'Curso de prueba P3: arquitectura y operación de sistemas distribuidos.',
  openClassLabel: 'Open Class', privado: SECRETOS[3] },
 generation: { weeksTotal: 8, activeWeeks, overwriteWeekContent: false },
 weeks: Array.from({ length: 8 }, (_, i) => {
  const n = i + 1;
  const w = SEMANAS[n] || (n === 2 ? { title: SECRETOS[0], centralTheme: SECRETOS[1] } : { title: `Semana ${n} sin publicar`, centralTheme: `Tema ${n}` });
  // La actividad de una semana activa sí se publica (cierre de su deck); la de la inactiva no debe salir.
  return { number: n, ...w, date: '2026', activity: n === 2 ? SECRETOS[4] : 'Participación y aplicación' };
 }),
});
const RUTAS = ['demo-completa/', 'galeria/', 'demo-layouts/', 'laboratorio/', 'guia/'];
const TECNICOS = /\b(layouts?|markdown|npm|reveal|plugins?|mermaid|iframe|github|vite|json|css|html)\b/i;
const VISTAS = [[1920, 1080], [1366, 768], [768, 1024], [390, 844], [320, 640]];

let temp, curso, dist, servidor, navegador, pagina;
const manifiesto = { base: BASE, capturas: {}, build: {} };
function construir(activeWeeks, outDir) {
 writeFileSync(path.join(curso, 'openclass.config.json'), JSON.stringify(config(activeWeeks), null, 2));
 ok(npm(curso, ['run', 'config']));
 ok(npm(curso, ['exec', '--', 'vite', 'build', '--outDir', outDir, '--emptyOutDir'], { SITE_BASE: BASE }));
 return path.join(curso, outDir);
}
function archivos(dir) {
 return readdirSync(dir).flatMap((f) => { const p = path.join(dir, f); return statSync(p).isDirectory() ? archivos(p) : [p]; });
}

before(async () => {
 curso = process.env.OPENCLASS_CURSO;
 if (!curso) {
  // realpath expande rutas cortas 8.3 de Windows, que rompen el proxy HTML de Vite.
  temp = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-portal-p3-')));
  curso = path.join(temp, 'curso');
  ok(spawnSync(process.execPath, [path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { encoding: 'utf8' }));
  ok(npm(curso, ['install', '--no-audit', '--no-fund']));
 }
 // Activas desordenadas y repetidas: el portal debe mostrarlas una vez y en orden ascendente.
 dist = construir([5, 1, 3, 3], 'dist');
 servidor = await servir(dist, { base: BASE });
 navegador = await abrirNavegador();
 pagina = await navegador.pagina();
 mkdirSync(EVIDENCIA, { recursive: true });
});
after(async () => {
 if (dist && existsSync(dist)) {
  for (const f of archivos(dist).filter((f) => /\.(html|js|css)$/.test(f))) manifiesto.build[path.relative(dist, f).replaceAll('\\', '/')] = sha(readFileSync(f));
  writeFileSync(path.join(EVIDENCIA, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
 }
 await navegador?.cerrar(); await servidor?.cerrar();
 if (temp) rmSync(temp, { recursive: true, force: true });
});

async function abrirPortal(w = 1366, h = 768) {
 await pagina.viewport(w, h);
 await pagina.ir(servidor.url);
 await pagina.esperarA('document.querySelector(".portal #recursos")');
 await pagina.evaluar('document.fonts.ready.then(() => true)');
}

test('[P3] jerarquía académica: identidad, comenzar, semanas, recorridos y recursos', async () => {
 await abrirPortal();
 const d = await pagina.evaluar(`(() => { const m = document.querySelector('main.portal');
  return {
   bloques: [...m.children].filter(e => !e.classList.contains('oc-skip')).map(e => e.id || e.tagName.toLowerCase()),
   h1: [...document.querySelectorAll('h1')].map(h => h.textContent),
   h2: [...m.querySelectorAll('h2')].map(h => h.textContent),
   niveles: [...m.querySelectorAll('h1,h2,h3')].map(h => +h.tagName[1]),
   cabecera: m.querySelector('.portal-header').innerText,
   comenzar: [...m.querySelectorAll('#comenzar .oc-pasos > li h3')].map(h => h.textContent),
   general: m.querySelector('#comenzar a[href$="general/"]')?.getAttribute('href'),
   alaRuta: m.querySelector('#comenzar a[href="#ruta"]') !== null,
   primeraPantalla: ['.portal-header', '#comenzar', '#ruta', '#recorridos'].map(s => m.querySelector(s).innerText).join('\\n'),
  }; })()`);
 assert.deepEqual(d.bloques, ['header', 'comenzar', 'ruta', 'recorridos', 'recursos'], 'orden A → E');
 assert.deepEqual(d.h1, [NOMBRE], 'un único H1 con el nombre completo');
 assert.deepEqual(d.h2, ['Antes de la primera semana', 'Semanas publicadas', 'Tres recorridos complementarios', 'Material de referencia']);
 d.niveles.forEach((n, i) => assert.ok(i === 0 || n <= d.niveles[i - 1] + 1, `encabezados sin saltos: ${d.niveles}`));
 assert.match(d.cabecera, /arquitectura y operación de sistemas distribuidos/, 'descripción académica');
 assert.match(d.cabecera, /Empieza por la presentación general/, 'orientación breve');
 assert.match(d.cabecera, /2026 · 3 semanas publicadas/);
 assert.deepEqual(d.comenzar, ['Presentación general', 'Cómo usar el material', 'Ruta de aprendizaje']);
 assert.equal(d.general, `${BASE}general/`);
 assert.ok(d.alaRuta, 'acceso a la ruta de aprendizaje');
 assert.doesNotMatch(d.primeraPantalla, TECNICOS, 'sin terminología de desarrollo antes de los recursos complementarios');
});

test('[P3] solo semanas activas, en orden, con número, título, tema y continuidad', async () => {
 await abrirPortal();
 const s = await pagina.evaluar(`[...document.querySelectorAll('#ruta .week-grid > li')].map(li => ({
  semana: li.querySelector('.overline').textContent, titulo: li.querySelector('h3').textContent,
  tema: li.querySelector('.oc-week-tema')?.textContent, continuidad: li.querySelector('.oc-week-continuidad').textContent,
  href: li.querySelector('a').getAttribute('href'), etiqueta: li.querySelector('a').getAttribute('aria-label') }))`);
 assert.deepEqual(s.map((x) => x.semana), ['Semana 1', 'Semana 3', 'Semana 5']);
 assert.deepEqual(s.map((x) => x.titulo), [1, 3, 5].map((n) => SEMANAS[n].title));
 assert.deepEqual(s.map((x) => x.tema), [1, 3, 5].map((n) => SEMANAS[n].centralTheme));
 assert.deepEqual(s.map((x) => x.continuidad), ['Punto de partida de la ruta', 'Continúa la semana 1', 'Continúa la semana 3']);
 assert.deepEqual(s.map((x) => x.href), [1, 3, 5].map((n) => `${BASE}semanas/sdp3_semana${n}/`));
 assert.equal(s[0].etiqueta, `Abrir la presentación de la semana 1: ${SEMANAS[1].title}`);
 const html = await pagina.evaluar('document.documentElement.outerHTML');
 for (const m of SECRETOS) assert.ok(!html.includes(m), `el portal expone ${m}`);
 assert.ok(!html.includes('sdp3_semana2'), 'enlace a semana inactiva');
 for (const f of archivos(dist)) {
  assert.ok(!/semana2/.test(path.basename(f)) && !/semana2[\\/]/.test(f), `archivo de semana inactiva en dist: ${f}`);
  if (/\.(html|js|css|json|md)$/.test(f)) { const t = readFileSync(f, 'utf8'); for (const m of SECRETOS) assert.ok(!t.includes(m), `${m} en ${f}`); }
 }
});

test('[P3] tres recorridos con resultados equivalentes, sin presentarse como modalidades oficiales', async () => {
 await abrirPortal();
 const r = await pagina.evaluar(`({ titulos: [...document.querySelectorAll('#recorridos .oc-recorridos > li h3')].map(h => h.textContent),
  textos: [...document.querySelectorAll('#recorridos .oc-recorridos > li p')].map(p => p.textContent),
  todo: document.getElementById('recorridos').innerText })`);
 assert.deepEqual(r.titulos, ['Sincrónico por Zoom o Teams', 'Asincrónico guiado', 'Aprendizaje autónomo']);
 r.textos.forEach((t) => assert.ok(t.length > 80, `recorrido sin explicación: ${t}`));
 assert.match(r.todo, /mismas presentaciones y actividades/);
 assert.match(r.todo, /mismos resultados\s+de aprendizaje/);
 assert.match(r.todo, /no reemplazan la\s+modalidad ni el calendario oficiales/);
 assert.doesNotMatch(r.todo, /modalidad(es)? (institucional|oficial|acreditada)(es)? (del|de la) (curso|universidad)/i);
});

test('[P3] recursos complementarios conservados en un bloque secundario y todos los enlaces responden', async () => {
 await abrirPortal();
 const e = await pagina.evaluar(`({ recursos: [...document.querySelectorAll('#recursos li a')].map(a => [a.textContent, a.getAttribute('href')]),
  sombra: [...document.querySelectorAll('#recursos li')].map(li => getComputedStyle(li).boxShadow),
  enlaces: [...document.querySelectorAll('.portal a[href]')].map(a => a.getAttribute('href')) })`);
 assert.deepEqual(e.recursos.map(([, h]) => h), RUTAS.map((r) => BASE + r));
 assert.match(e.recursos[0][0], /VER DEMOSTRACIÓN COMPLETA/);
 assert.ok(e.sombra.every((s) => s === 'none'), 'los recursos no compiten visualmente con las semanas');
 const estados = await pagina.evaluar(`Promise.all(${JSON.stringify(e.enlaces)}.map(async h => {
  if (h.startsWith('#')) return [h, document.getElementById(h.slice(1)) ? 200 : 404];
  const r = await fetch(h); const t = await r.text();
  return [h, r.status, /<div id="app">|<main/.test(t)]; }))`);
 for (const [h, status, pagina_] of estados) {
  assert.equal(status, 200, `${h} responde ${status}`);
  if (!h.startsWith('#')) assert.ok(pagina_, `${h} no es una página del curso`);
 }
 // Acceso funcional: la semana 3 carga su presentación desde el enlace del portal.
 await pagina.evaluar(`document.querySelector('a[href$="sdp3_semana3/"]').click(), true`);
 await pagina.esperarA('window.OpenClass?.deck?.isReady?.()', { timeout: 30000 });
 assert.equal(await pagina.evaluar('document.documentElement.dataset.week'), '3');
});

test('[P3] teclado: salto a las semanas, orden de foco y foco visible', async () => {
 await abrirPortal();
 const foco = () => pagina.evaluar(`(() => { const a = document.activeElement; const s = getComputedStyle(a);
  return { href: a.getAttribute('href'), texto: a.textContent.trim(), contorno: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2,
   visible: (() => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight; })() }; })()`);
 await pagina.tecla('Tab', { keyCode: 9 });
 const salto = await foco();
 assert.equal(salto.href, '#ruta', 'el primer Tab ofrece ir a las semanas');
 assert.ok(salto.contorno && salto.visible, 'enlace de salto visible al recibir el foco');
 await pagina.tecla('Enter', { keyCode: 13, texto: '\r' });
 await esperar(300);
 await pagina.tecla('Tab', { keyCode: 9 });
 const semana = await foco();
 assert.equal(semana.href, `${BASE}semanas/sdp3_semana1/`, 'tres teclas llevan a la primera semana');
 assert.ok(semana.contorno, 'foco visible en la tarjeta de semana');
 // Recorrido completo: cada enlace del portal recibe el foco una vez, en el orden del documento, con contorno.
 await abrirPortal();
 const orden = await pagina.evaluar(`[...document.querySelectorAll('.portal a[href]')].map(a => a.getAttribute('href'))`);
 const vistos = [];
 for (let i = 0; i < orden.length; i++) {
  await pagina.tecla('Tab', { keyCode: 9 });
  const f = await foco();
  assert.ok(f.contorno, `sin foco visible en ${f.href}`);
  vistos.push(f.href);
 }
 assert.deepEqual(vistos, orden);
});

test('[P3] escritorio y móvil: sin scroll horizontal ni textos desbordados (evidencia con SHA-256)', async () => {
 for (const [w, h] of VISTAS) {
  await abrirPortal(w, h);
  const m = await pagina.evaluar(`(() => {
   const fuera = [...document.querySelectorAll('.portal *')].filter(e => !e.classList.contains('oc-skip') && !e.closest('.oc-skip')).map(e => [e, e.getBoundingClientRect()])
    .filter(([, r]) => r.width && (r.left < -0.5 || r.right > innerWidth + 0.5)).map(([e]) => e.className || e.tagName);
   const desbordes = [...document.querySelectorAll('.portal .card, .portal-header, .portal h1, .portal h2, .portal h3, .portal p, .portal a')]
    .filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).display !== 'inline').map(e => e.className || e.tagName);
   const semanas = [...document.querySelectorAll('.week-grid > li')].map(li => li.getBoundingClientRect().width);
   return { ancho: document.documentElement.scrollWidth, vista: innerWidth, alto: document.documentElement.scrollHeight, fuera, desbordes, semanas,
    // Texto de lectura ≥ 14 px; la etiqueta .overline (mayúsculas, negrita, estilo aprobado) ≥ 12 px.
    letra: Math.min(...[...document.querySelectorAll('.portal p:not(.overline), .portal a, .portal h3')].map(e => parseFloat(getComputedStyle(e).fontSize))),
    etiqueta: Math.min(...[...document.querySelectorAll('.portal .overline')].map(e => parseFloat(getComputedStyle(e).fontSize))) };
  })()`);
  const nombre = `${w}x${h}`;
  await pagina.viewport(w, Math.min(m.alto, 12000));
  await esperar(200);
  const png = await pagina.captura();
  writeFileSync(path.join(EVIDENCIA, `portal-${nombre}.png`), png);
  manifiesto.capturas[`portal-${nombre}.png`] = { sha256: sha(png), ...m };
  assert.ok(m.ancho <= m.vista, `${nombre}: scroll horizontal (${m.ancho} > ${m.vista})`);
  assert.deepEqual(m.fuera, [], `${nombre}: elementos fuera de la vista`);
  assert.deepEqual(m.desbordes, [], `${nombre}: texto desbordado`);
  assert.ok(m.semanas.every((x) => x >= 240 || w < 400), `${nombre}: tarjetas de semana demasiado estrechas ${m.semanas}`);
  assert.ok(m.letra >= 14, `${nombre}: letra mínima ${m.letra}px`);
  assert.ok(m.etiqueta >= 12, `${nombre}: etiqueta mínima ${m.etiqueta}px`);
 }
});

test('[P3] sin semanas activas: el portal lo indica sin enlaces a semanas', async () => {
 const vacio = construir([], 'dist-vacio');
 const s = await servir(vacio, { base: BASE });
 try {
  await pagina.viewport(1366, 768);
  await pagina.ir(s.url);
  await pagina.esperarA('document.querySelector(".portal #recursos")');
  const v = await pagina.evaluar(`({ chip: document.querySelector('.chip').textContent, vacio: document.querySelector('#ruta .oc-portal-vacio')?.textContent,
   semanas: document.querySelectorAll('a[href*="/semanas/"]').length, recursos: document.querySelectorAll('#recursos a').length })`);
  assert.equal(v.chip, '2026 · 0 semanas publicadas');
  assert.match(v.vacio, /Aún no hay semanas publicadas/);
  assert.equal(v.semanas, 0);
  assert.equal(v.recursos, RUTAS.length);
 } finally { await s.cerrar(); }
});
