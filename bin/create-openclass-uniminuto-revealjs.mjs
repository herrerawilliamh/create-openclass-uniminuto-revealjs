#!/usr/bin/env node
/** Creador independiente de OpenClass UNIMINUTO — Reveal.js (NO Slidev). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const template = path.join(root, 'template');
const input = process.argv.slice(2);
const flags = new Set();
const positional = [];
let assetsDir = null;
for (let i = 0; i < input.length; i++) {
  const arg = input[i];
  if (arg === '--assets') assetsDir = input[++i] ?? '';
  else if (arg.startsWith('--assets=')) assetsDir = arg.slice('--assets='.length);
  else if (arg.startsWith('-')) flags.add(arg);
  else positional.push(arg);
}
const target = path.resolve(positional[0] || 'openclass-curso-nuevo');
const marker = { openclassEngine: 'reveal-react-v2', openclassVariant: 'uniminuto-revealjs' };
const fail = (message) => { console.error(`ERROR: ${message}`); process.exit(1); };
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'curso';
const short = (s) => slug(s).replace(/-/g, '').replace(/^openclass/, '') || 'curso';

function copy(from, to, { overwrite = false, backupRoot = null, templateRoot = null } = {}) {
  const stat = fs.lstatSync(from);
  if (stat.isSymbolicLink()) fail(`No se permiten enlaces simbólicos en el template: ${from}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const child of fs.readdirSync(from)) {
      copy(path.join(from, child), path.join(to, child), { overwrite, backupRoot, templateRoot });
    }
    return;
  }
  if (fs.existsSync(to)) {
    if (!overwrite) return;
    if (backupRoot) {
      const rel = path.relative(target, to);
      const backup = path.join(backupRoot, rel);
      fs.mkdirSync(path.dirname(backup), { recursive: true });
      fs.copyFileSync(to, backup);
    }
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

/** Recursos gráficos permitidos en --assets: solo imágenes, nunca código. */
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico']);

/** Copia los recursos institucionales locales sobre public/ (mismos nombres que los neutros). */
function applyAssets(dir, course) {
  const source = path.resolve(dir);
  if (!dir || !fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    fail(`--assets necesita una carpeta existente: ${dir || '(vacío)'}`);
  }
  const from = fs.existsSync(path.join(source, 'public')) ? path.join(source, 'public') : source;
  let count = 0;
  const walk = (dirFrom, dirTo) => {
    for (const child of fs.readdirSync(dirFrom)) {
      const a = path.join(dirFrom, child), b = path.join(dirTo, child);
      const stat = fs.lstatSync(a);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) walk(a, b);
      else if (ASSET_EXT.has(path.extname(child).toLowerCase())) {
        fs.mkdirSync(dirTo, { recursive: true });
        fs.copyFileSync(a, b);
        count++;
      }
    }
  };
  walk(from, path.join(course, 'public'));
  if (!count) fail(`--assets no contiene imágenes reconocibles en ${from}`);
  console.log(`RECURSOS_LOCALES=${count} archivos aplicados desde ${from}`);
}

if (flags.has('--help') || flags.has('-h')) {
  console.log(`OpenClass Reveal.js — generador independiente (NO modifica Slidev)
Uso:
  npm create openclass-uniminuto-revealjs@latest <carpeta-nueva> [-- --assets <carpeta>]
  node bin/create-openclass-uniminuto-revealjs.mjs <carpeta-nueva> [--iot] [--install] [--assets <carpeta>]
  node bin/create-openclass-uniminuto-revealjs.mjs <curso-existente> --update-theme [--assets <carpeta>]

Opciones:
  --iot              Nombre inicial: Introducción a Internet de las Cosas
  --install          Ejecuta npm install tras crear el curso
  --assets <carpeta> Copia imágenes locales (p. ej. fondos y logotipos institucionales) sobre
                     public/. Acepta una carpeta con public/ o con fondos/ e imagenes/.
                     El paquete público trae un tema neutro con los mismos nombres de archivo.
  --update-theme     Actualiza la infraestructura de un curso Reveal.js reconocido;
                     guarda una copia previa y conserva los Markdown académicos.
  --help             Muestra esta ayuda.

Documentación: cada curso generado incorpora /guia/, /galeria/ y docs/GUIA-DOCENTE.md.

Precaución: no sobrescribe carpetas no vacías para nuevas creaciones.`);
  process.exit(0);
}
if (assetsDir !== null && !assetsDir) fail('--assets necesita la ruta de una carpeta.');
if (flags.has('--force')) fail('La actualización destructiva --force está deshabilitada. Usa una carpeta nueva o --update-theme con respaldo.');
if (!fs.existsSync(path.join(template, 'src/Presentacion.jsx'))) fail('Paquete incompleto: falta la plantilla.');

if (flags.has('--update-theme') || flags.has('--sync-theme')) {
  const pkgPath = path.join(target, 'package.json');
  if (!fs.existsSync(pkgPath)) fail('No existe package.json en el proyecto de destino.');
  const old = readJSON(pkgPath);
  if (old.openclassEngine !== marker.openclassEngine || old.openclassVariant !== marker.openclassVariant) {
    fail('ACTUALIZACION_BLOQUEADA: no es un proyecto OpenClass Reveal.js reconocido.');
  }
  const suffix = new Date().toISOString().replace(/[:.]/g, '-');
  const backup = path.join(target, 'respaldos', `generador-${suffix}`);
  const entries = ['src', 'scripts', 'plantillas', '.github/workflows', 'vite.config.mjs',
    'index.html', 'general/index.html', 'demo-layouts/index.html', 'demo-completa/index.html',
    'laboratorio/index.html', 'guia', 'galeria', 'docs', 'demo-layouts.md', 'demo-completa.md', 'laboratorio.md',
    'public/vendor', 'public/galeria', 'public/actividades/microactividad'];
  for (const entry of entries) copy(path.join(template, entry), path.join(target, entry), {
    overwrite: true, backupRoot: backup,
  });
  // Solo assets faltantes. Los fondos e imágenes institucionales editados se conservan.
  copy(path.join(template, 'public'), path.join(target, 'public'), { overwrite: false });
  if (assetsDir) applyAssets(assetsDir, target);
  const fresh = readJSON(path.join(template, 'package.json'));
  fs.mkdirSync(backup, { recursive: true });
  fs.copyFileSync(pkgPath, path.join(backup, 'package.json'));
  old.scripts = { ...old.scripts, ...fresh.scripts };
  old.dependencies = { ...old.dependencies, ...fresh.dependencies };
  old.devDependencies = { ...old.devDependencies, ...fresh.devDependencies };
  old.version = fresh.version;
  writeJSON(pkgPath, old);
  console.log(`ACTUALIZACION=PASS\nRESPALDO=${backup}\nMARKDOWN=CONSERVADO\nCONFIG=CONSERVADA`);
  console.log('SIGUIENTE: npm install && npm run test:estructura && npm run pages:build');
  process.exit(0);
}

if (fs.existsSync(target) && fs.readdirSync(target).length > 0) {
  fail(`Carpeta no vacía: ${target}. Crea un curso con un nombre nuevo; no se modifica lo existente.`);
}
copy(template, target);
if (assetsDir) applyAssets(assetsDir, target);
const gitignoreSeed = path.join(target, 'gitignore.template');
if (fs.existsSync(gitignoreSeed)) {
  fs.renameSync(gitignoreSeed, path.join(target, '.gitignore'));
}
const pkgPath = path.join(target, 'package.json');
const pkg = readJSON(pkgPath);
pkg.name = slug(path.basename(target));
writeJSON(pkgPath, pkg);
const cfgPath = path.join(target, 'openclass.config.json');
const cfg = readJSON(cfgPath);
cfg.course.shortName = short(path.basename(target));
cfg.course.fullName = flags.has('--iot') ? 'Introducción a Internet de las Cosas' : path.basename(target).replace(/[-_]/g, ' ');
cfg.course.year = String(new Date().getFullYear());
for (const week of cfg.weeks || []) week.date = cfg.course.year;
writeJSON(cfgPath, cfg);
const gen = spawnSync(process.execPath, ['scripts/generar-desde-config.mjs'], { cwd: target, stdio: 'inherit' });
if (gen.status !== 0) fail('No se pudo crear la semana inicial.');
if (flags.has('--install')) {
  const cmd = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm install'] : ['install'];
  const installed = spawnSync(cmd, args, { cwd: target, stdio: 'inherit' });
  if (installed.status !== 0) fail('El proyecto fue creado, pero npm install falló. Puedes reintentarlo desde el directorio.');
}
console.log(`CREADOR=PASS\nPROYECTO=${target}\nPRESENTACION=slides.md\nSEMANA=semanas/${cfg.course.shortName}_semana1.md`);
console.log('SIGUIENTE: npm install && npm run test:estructura && npm run pages:build');
console.log('VITE: npm run dev -- --port 8610 (si 8600 está ocupado)');
console.log('GUIA: abre /guia/ desde el portal del curso');
