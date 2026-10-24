// Portada semanal en el DOM renderizado (P2 GREEN-A-R2, OpenClass 1.1.0): H1.textContent es exactamente
// course.fullName (espacios extremos, saltos de línea, Markdown, HTML) sin interpretar etiquetas del nombre.
// Cada caso regenera la semana 1 de un curso desechable, lo compila con base de subcarpeta y lo abre en Chrome.
// Desbordamientos: tras cargar las fuentes y el ajuste final de Presentacion.jsx se miden los rectángulos del texto
// renderizado (Range.getClientRects, no la caja del elemento) en portada, tema y activación, con nombres largos.
// Si un caso falla, guarda capturas y mediciones en OPENCLASS_EVIDENCIA (o <tmp>/openclass-portada-dom-evidencia).
// Ejecutar con `npm run test:dom` (los ocho casos juntos; también en CI, job de Chrome: .github/workflows/ci.yml).
// OPENCLASS_CURSO=<curso con node_modules> reutiliza una instalación; su configuración y su semana 1 se sobrescriben.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../scripts/lib/chrome.mjs';
import { servir } from '../scripts/lib/servidor.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const BASE = '/prueba-openclass/';
const EVIDENCIA = process.env.OPENCLASS_EVIDENCIA || path.join(os.tmpdir(), 'openclass-portada-dom-evidencia');
// Cada proceso hijo tiene límite: un build colgado falla con ETIMEDOUT en lugar de bloquear la suite.
const npm = (cwd, a, env = {}, timeout = 300000) => spawnSync(win ? 'npm.cmd' : 'npm', a, { cwd, encoding: 'utf8', shell: win, timeout, env: { ...process.env, ...env } });
const ok = (r) => assert.equal(r.status, 0, `${r.error ? `${r.error.message}\n` : ''}${r.stdout}${r.stderr}`);

// Diagnóstico de bloqueos: cada fase asíncrona tiene un límite y, si se supera, el error nombra la fase.
// OPENCLASS_TRAZA=1 muestra además el inicio y el fin de cada fase en vivo.
const traza = (m) => process.env.OPENCLASS_TRAZA && console.error(`[DOM ${new Date().toISOString().slice(11, 23)}] ${m}`);
let tiempos = [];
async function fase(nombre, ms, fn) {
 const t0 = Date.now(); let reloj;
 traza(`→ ${nombre}`);
 try {
  return await Promise.race([fn(), new Promise((_, no) => { reloj = setTimeout(() => no(new Error(`fase «${nombre}» bloqueada más de ${ms} ms`)), ms); })]);
 } finally { clearTimeout(reloj); tiempos.push(`${nombre} ${Date.now() - t0} ms`); traza(`← ${nombre} ${Date.now() - t0} ms`); }
}
const sincrona = (nombre, fn) => fase(nombre, Infinity, async () => fn());

// El tema lleva comillas, guion doble y puntos suspensivos: Smartypants debe seguir transformándolos fuera del H1.
const SEMANA = { title: 'Tema "citado" -- con pausa...', date: 'Octubre 23 de 2026' };
// Los casos impares llevan además tema y pregunta largos: el ajuste de letra y el área útil también se miden con ellos.
const LARGA = {
 centralTheme: 'Comunicación asíncrona entre microservicios mediante colas de mensajes, eventos de dominio y contratos versionados',
 opening: { question: '¿Qué ocurriría en un sistema de pagos si uno de sus servicios dejara de responder durante varios minutos y nadie lo '
  + 'notara hasta que los clientes empezaran a reclamar por cobros duplicados, pedidos perdidos o confirmaciones que nunca llegaron?',
 participation: 'discusion-parejas', durationMinutes: 3 },
};
const CORTA = { centralTheme: 'Lectura de sensores analógicos', opening: undefined };
const CASOS = [
 ['BASE_URL literal', 'Curso {{BASE_URL}} literal'],
 ['comillas rectas', 'Curso "Digital"'],
 ['acentos', 'Ingeniería de Software'],
 ['Markdown y HTML', 'Curso *énfasis* _x_ `código` [enlace](u) <img src=x onerror="window.__oc=1"> <b>b</b> & \'apóstrofo\' -- ... # {{TITULO}} $& \\*'],
 ['espacios extremos', ' Curso literal '],
 ['salto de línea', 'Curso\nLiteral'],
 ['espacios internos consecutivos', 'Curso   con  espacios'],
 // Entidades ya escritas, separador de diapositiva, Notes y sintaxis de bloque tras el salto: nada debe interpretarse.
 ['comillas, Markdown y HTML especiales', '"Curso" \'x\' «y» **negrita** ~~t~~ &amp; &#60; &lt;b&gt; \\#\t<svg onload="window.__oc=2">\r\n---\n- lista\n> cita\nNotes: no'],
];

let temp, curso, navegador, pagina;
before(async () => {
 curso = process.env.OPENCLASS_CURSO;
 if (!curso) {
  // realpath expande rutas cortas 8.3 de Windows, que rompen el proxy HTML de Vite.
  temp = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-portada-dom-')));
  curso = path.join(temp, 'curso');
  ok(spawnSync(process.execPath, [path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { encoding: 'utf8' }));
  ok(npm(curso, ['install', '--no-audit', '--no-fund'], {}, 600000));
 }
 navegador = await fase('abrir Chrome', 30000, () => abrirNavegador());
 pagina = await fase('crear pestaña', 30000, () => navegador.pagina());
});
// El cierre de Chrome está acotado (scripts/lib/chrome.mjs); el temporal se borra aunque el cierre falle.
after(async () => {
 try { await fase('cerrar Chrome', 20000, async () => navegador?.cerrar()); }
 finally { if (temp) rmSync(temp, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 }); }
});

// Coordenadas del lienzo 1280×720 (theme.css). Rectángulos del texto renderizado, sin Notes.
const MEDIR = (i) => `(() => {
 const d = OpenClass.deck, s = d.getSlides()[${i}];
 if (!s || d.getIndices().h !== ${i} || d.getCurrentSlide() !== s) return { error: 'la diapositiva ${i} no es la actual' };
 const R = s.getBoundingClientRect(), k = R.width / 1280;
 const loc = (b) => ({ l: (b.left - R.left) / k, t: (b.top - R.top) / k, r: (b.right - R.left) / k, b: (b.bottom - R.top) / k });
 const texto = (raiz) => {
  const rs = [], tw = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT, { acceptNode: (n) =>
   n.textContent.trim() && !n.parentElement.closest('aside.notes') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
  while (tw.nextNode()) { const g = document.createRange(); g.selectNodeContents(tw.currentNode); rs.push(...[...g.getClientRects()].filter((x) => x.width > 0 && x.height > 0)); }
  return rs.length ? loc({ left: Math.min(...rs.map((x) => x.left)), top: Math.min(...rs.map((x) => x.top)),
   right: Math.max(...rs.map((x) => x.right)), bottom: Math.max(...rs.map((x) => x.bottom)) }) : null;
 };
 const el = (e) => e && { texto: texto(e), caja: loc(e.getBoundingClientRect()), fs: getComputedStyle(e).fontSize,
  desborde: { h: e.scrollWidth - e.clientWidth, v: e.scrollHeight - e.clientHeight } };
 return { todo: texto(s), h1: el(s.querySelector(':scope > h1')), h2: el(s.querySelector(':scope > h2')),
  ps: [...s.querySelectorAll(':scope > p')].map(el) };
})()`;
// Tamaños que ajusta Presentacion.jsx en las tres primeras diapositivas.
const TAMANOS = `[...OpenClass.deck.getSlides()].slice(0, 3).flatMap((s) => [...s.querySelectorAll(':scope > :is(h1, h2, p)')])
 .map((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).overflowWrap, getComputedStyle(e).whiteSpace].join()).join('|')`;

async function medir(i) {
 await pagina.evaluar(`OpenClass.deck.slide(${i})`);
 // Fuentes y ajuste final (slidechanged): espera a dos lecturas iguales seguidas de los tamaños de letra.
 await pagina.evaluar('document.fonts.ready');
 for (let k = 0, previo; k < 20; k++) {
  await pagina.evaluar('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 100))))');
  const t = await pagina.evaluar(TAMANOS);
  if (t === previo) break;
  previo = t;
 }
 return { ...await pagina.evaluar(MEDIR(i)), captura: await pagina.captura() };
}

async function portada(fullName, extra) {
 const cfgPath = path.join(curso, 'openclass.config.json');
 const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
 cfg.course.fullName = fullName;
 const w = cfg.weeks.find((x) => Number(x.number) === 1);
 Object.assign(w, SEMANA, extra);
 if (!extra.opening) delete w.opening;
 writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n');
 await sincrona('generar semana 1', () => ok(npm(curso, ['run', 'semana', '--', '1', '--force-content'], {}, 60000)));
 await sincrona('build:all', () => ok(npm(curso, ['run', 'build:all'], { SITE_BASE: BASE })));
 const servidor = await fase('iniciar servidor', 10000, () => servir(path.join(curso, 'dist'), { base: BASE }));
 try {
  await fase('cargar semana', 70000, async () => {
   await pagina.ir(`${servidor.url}semanas/${cfg.course.shortName}_semana1/`);
   await pagina.esperarA('window.OpenClass?.deck?.isReady?.()', { timeout: 30000 });
  });
  await pagina.evaluar('OpenClass.deck.configure({ transition: "none", backgroundTransition: "none" })');
  const diapos = [];
  for (const i of [0, 1, 2]) diapos.push(await fase(`medir diapositiva ${i + 1}`, 90000, () => medir(i)));
  const datos = await pagina.evaluar(`(() => {
   const [s, tema] = OpenClass.deck.getSlides(), h1 = [...s.querySelectorAll('h1')];
   const rango = document.createRange(); if (h1[0]) rango.selectNodeContents(h1[0]);
   return {
    clases: [...s.classList], h1: h1.map((h) => h.textContent), hijos: h1.map((h) => h.childElementCount),
    diapositivas: OpenClass.deck.getTotalSlides(), parrafos: s.querySelectorAll(':scope > p').length,
    espacio: h1[0] && getComputedStyle(h1[0]).whiteSpace,
    lineas: new Set([...rango.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size,
    otrosConEstilo: [...document.querySelectorAll('.reveal .slides :is(h1, h2)')].filter((h) => h !== h1[0] && h.style.whiteSpace).length,
    texto: [...s.querySelectorAll('p')].map((p) => p.textContent).join(' | '),
    notas: s.querySelector('aside.notes')?.textContent.trim(), fondo: s.dataset.backgroundImage,
    avion: tema.querySelector('.oc-section-plane img')?.getAttribute('src'),
    pendientes: document.querySelectorAll('[src*="{{"], [data-background-image*="{{"]').length,
    ejecutado: window.__oc ?? null, inyectadas: document.querySelectorAll('.reveal img[src="x"]').length,
   };
  })()`);
  return { ...datos, diapos };
 } finally {
  const { forzadas } = await fase('cerrar servidor', 10000, () => servidor.cerrar());
  if (forzadas) tiempos.push(`${forzadas} conexiones en curso cortadas`);
 }
}

const LIENZO = { l: 0, t: 0, r: 1280, b: 720 };
const TOL = 1.5;
const fmt = (c) => c ? `[X ${c.l.toFixed(1)}–${c.r.toFixed(1)}, Y ${c.t.toFixed(1)}–${c.b.toFixed(1)}]` : 'sin texto';
/** Texto `a` dentro de la zona `b`: falla nombrando el lado (horizontal o vertical) por el que se desborda. */
function dentro(a, b, que) {
 assert.ok(a, `${que}: sin texto renderizado`);
 const fuera = [a.l < b.l - TOL && `izquierda ${(b.l - a.l).toFixed(1)} px`, a.r > b.r + TOL && `derecha ${(a.r - b.r).toFixed(1)} px`,
  a.t < b.t - TOL && `arriba ${(b.t - a.t).toFixed(1)} px`, a.b > b.b + TOL && `abajo ${(a.b - b.b).toFixed(1)} px`].filter(Boolean);
 assert.deepEqual(fuera, [], `${que}: texto ${fmt(a)} se desborda de ${fmt(b)}`);
}
function sinDesbordes([portadaD, tema, activacion]) {
 for (const [n, d] of [['portada', portadaD], ['tema', tema], ['activación', activacion]]) {
  assert.equal(d.error, undefined, `${n}: ${d.error}`);
  dentro(d.todo, LIENZO, `${n}: todo el texto en el lienzo 1280×720`);
 }
 // Portada: el texto real del H1 en su caja (X 507–1164, Y 329–547) y la línea secundaria entre la franja y el logo.
 dentro(portadaD.h1.texto, portadaD.h1.caja, `portada: H1 (${portadaD.h1.fs})`);
 dentro(portadaD.h1.caja, { l: 507, t: 329, r: 1164, b: 547 }, 'portada: caja del H1 en la banda azul');
 portadaD.ps.forEach((p, i) => dentro(p.texto, { l: 393, t: 0, r: 991.5, b: 720 }, `portada: párrafo ${i + 1} (${p.fs})`));
 // Tema: el texto del H2 en su caja y por encima de «Vigilada Mineducación» (Y 666).
 dentro(tema.h2.texto, tema.h2.caja, `tema: H2 (${tema.h2.fs})`);
 dentro(tema.h2.texto, { l: 0, t: 0, r: 1280, b: 666 }, 'tema: área útil');
 // Activación: H2 en la barra superior; pregunta, instrucción y duración en el área útil Y 83–666.
 dentro(activacion.h2.texto, { l: 0, t: -23, r: 760, b: 83.4 }, 'activación: H2 en la barra');
 activacion.ps.forEach((p, i) => dentro(p.texto, { l: 0, t: 83, r: 1280, b: 666 }, `activación: párrafo ${i + 1} (${p.fs})`));
}
function evidencia(caso, p, error) {
 const dir = path.join(EVIDENCIA, caso.normalize('NFD').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''));
 mkdirSync(dir, { recursive: true });
 p.diapos.forEach((d, i) => writeFileSync(path.join(dir, `${i + 1}-${['portada', 'tema', 'activacion'][i]}.png`), d.captura));
 writeFileSync(path.join(dir, 'mediciones.json'), JSON.stringify(p.diapos.map(({ captura, ...d }) => d), null, 2));
 error.message += `\nEvidencia visual: ${dir}`;
 return error;
}

let diapositivas;
CASOS.forEach(([caso, fullName], i) => {
 test(`[DOM] portada (${caso}): H1.textContent igual a course.fullName`, { timeout: 900000 }, async (t) => {
  tiempos = [];
  traza(`inicio caso ${i + 1}/${CASOS.length}: ${caso}`);
  let p;
  try { p = await portada(fullName, i % 2 ? LARGA : CORTA); }
  finally { t.diagnostic(`fases: ${tiempos.join(' · ')}`); traza(`fin caso ${i + 1}/${CASOS.length}: ${caso}`); }
  try {
   assert.deepEqual(p.h1, [fullName], 'H1.textContent exacto, sin trim ni normalización');
   assert.deepEqual(p.hijos, [0], 'el H1 es solo texto: sin etiquetas interpretadas');
   diapositivas ??= p.diapositivas;
   assert.equal(p.diapositivas, diapositivas, 'el nombre no crea ni quita diapositivas');
   assert.equal(p.parrafos, 2, 'ninguna parte del nombre sale del H1 como párrafo');
   assert.equal(p.espacio, 'pre-line', 'los saltos de línea del nombre se muestran');
   assert.equal(p.lineas >= fullName.split(/\r?\n/).length, true, `líneas visibles: ${p.lineas}`);
   // Sin excepción por longitud: cualquier nombre, tema o pregunta debe caber en portada, tema y activación.
   sinDesbordes(p.diapos);
   assert.equal(p.otrosConEstilo, 0, 'ningún otro título cambia de white-space');
   assert.equal(p.ejecutado, null, 'ningún manejador del nombre se ejecuta');
   assert.equal(p.inyectadas, 0, 'ninguna imagen inyectada desde el nombre');
   assert.ok(p.clases.includes('oc-l-cover'), `layout ${JSON.stringify(p.clases)}`);
   assert.match(p.texto, /\bSEMANA 1\b/, 'semana visible');
   assert.ok(p.texto.includes('Tema “citado” – con pausa…'), `Smartypants conservado en el tema: «${p.texto}»`);
   assert.ok(p.texto.includes(SEMANA.date), 'fecha visible');
   assert.equal(p.notas, 'Introducir el tema central de esta semana.', 'Notes de la portada');
   assert.equal(p.fondo, `${BASE}fondos/slide-01-portada.png`, '{{BASE_URL}} del fondo resuelto');
   assert.equal(p.avion, `${BASE}imagenes/avion.png`, '{{BASE_URL}} de la imagen resuelto');
   assert.equal(p.pendientes, 0, 'sin {{…}} en recursos');
  } catch (e) { throw evidencia(caso, p, e); }
 });
});
