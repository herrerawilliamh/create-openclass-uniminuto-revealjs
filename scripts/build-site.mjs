#!/usr/bin/env node
/**
 * Construye el sitio público de GitHub Pages en _site/ (separado de la generación de cursos):
 *   _site/            landing (site/index.html + site.css + capturas)
 *   _site/curso/      curso de demostración creado con el CLI y compilado con su base
 * La generación de cursos sigue siendo local con npm; este sitio solo documenta y demuestra.
 * Variables: PAGES_BASE (por defecto /create-openclass-uniminuto-revealjs/).
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAYOUTS } from '../template/galeria/layouts.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const BASE = process.env.PAGES_BASE || '/create-openclass-uniminuto-revealjs/';
const GITHUB = 'https://github.com/herrerawilliamh/create-openclass-uniminuto-revealjs';
const NPM = 'https://www.npmjs.com/package/create-openclass-uniminuto-revealjs';
const trabajo = path.join(raiz, '.site-build');
const salida = path.join(raiz, '_site');
const curso = path.join(trabajo, 'curso');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ejecutar = (cmd, args, opciones) => {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opciones });
  if (r.status !== 0) { console.error(`FALLÓ: ${cmd} ${args.join(' ')}`); process.exit(r.status ?? 1); }
};

rmSync(trabajo, { recursive: true, force: true });
rmSync(salida, { recursive: true, force: true });
mkdirSync(trabajo, { recursive: true });

// 1. Curso de demostración creado con el generador (tema neutro público, sin --assets).
ejecutar(process.execPath, [path.join(raiz, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso]);
const cfgRuta = path.join(curso, 'openclass.config.json');
const cfg = JSON.parse(readFileSync(cfgRuta, 'utf8'));
cfg.course.shortName = 'demo';
cfg.course.fullName = 'Curso de demostración OpenClass';
cfg.course.description = 'Portal de ejemplo generado con create-openclass-uniminuto-revealjs. La generación de cursos ocurre en tu equipo con npm.';
cfg.weeks[0] = { ...cfg.weeks[0], title: 'Semana 1 · plantilla recién creada', centralTheme: 'Así se ve una semana nueva antes de editarla' };
writeFileSync(cfgRuta, `${JSON.stringify(cfg, null, 2)}\n`);
rmSync(path.join(curso, 'semanas'), { recursive: true, force: true });
ejecutar('npm', ['install', '--no-audit', '--no-fund'], { cwd: curso });
ejecutar('npm', ['run', 'build:all'], { cwd: curso, env: { ...process.env, SITE_BASE: `${BASE}curso/` } });

// 2. Landing con las 13 fichas (miniaturas del propio curso compilado).
mkdirSync(salida, { recursive: true });
cpSync(path.join(curso, 'dist'), path.join(salida, 'curso'), { recursive: true });
cpSync(path.join(raiz, 'site/capturas'), path.join(salida, 'capturas'), { recursive: true });
cpSync(path.join(raiz, 'site/site.css'), path.join(salida, 'site.css'));
const tarjetas = LAYOUTS.map((l) => `      <article class="layout">
        <img src="curso/galeria/${l.id}.webp" alt="Vista previa real del layout ${esc(l.nombre)}" loading="lazy" width="640" height="360">
        <div><span class="clase">${l.clase}</span><h3>${esc(l.nombre)}</h3><p>${esc(l.objetivo)}</p>
          <span class="botones"><button type="button" data-layout="${l.id}">Copiar Markdown</button><a href="curso/demo-completa/#/${l.diapositiva}">Ver ejemplo</a><a href="curso/galeria/#layout-${l.id}">Ficha</a></span></div>
      </article>`).join('\n');
const datos = JSON.stringify(Object.fromEntries(LAYOUTS.map((l) => [l.id, l.markdown]))).replace(/</g, '\\u003c');
const html = readFileSync(path.join(raiz, 'site/index.html'), 'utf8')
  .replace('<!--TARJETAS-->', tarjetas)
  .replace('<!--DATOS-->', datos)
  .replaceAll('{{VERSION}}', pkg.version)
  .replaceAll('{{GITHUB}}', GITHUB)
  .replaceAll('{{NPM}}', NPM);
writeFileSync(path.join(salida, 'index.html'), html);
writeFileSync(path.join(salida, '404.html'), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Página no encontrada · OpenClass</title><body style="font-family:system-ui;padding:40px;color:#233660"><h1>Página no encontrada</h1><p><a href="${BASE}">Volver a OpenClass</a></p></body></html>`);
writeFileSync(path.join(salida, '.nojekyll'), '');
for (const f of ['index.html', 'curso/index.html', 'curso/demo-completa/index.html', 'curso/galeria/index.html', 'curso/guia/index.html']) {
  if (!existsSync(path.join(salida, f))) { console.error(`FALTA=${f}`); process.exit(1); }
}
console.log(`SITIO=PASS ${salida} base=${BASE}`);
