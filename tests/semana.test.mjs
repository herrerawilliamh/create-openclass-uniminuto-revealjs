// Creación y activación de semanas en un curso temporal (GATE 1 RED, OpenClass 1.1.0).
// [GREEN] = debe pasar con la implementación actual.
// [RED]   = requisito que fallaba en GATE 1 RED (template/scripts/semana.mjs); hoy debe pasar como control de regresión.
// Forma parte de `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, existsSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs');
const win = process.platform === 'win32';
// Rutas largas en Windows: los nombres 8.3 del temporal rompen herramientas posteriores.
const tmp = () => mkdtempSync(path.join(realpathSync.native(os.tmpdir()), 'openclass-semana-'));
const npm = (cwd, ...a) => spawnSync(win ? 'npm.cmd' : 'npm', a, { cwd, encoding: 'utf8', shell: win });
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const readCfg = (dest) => JSON.parse(readFileSync(path.join(dest, 'openclass.config.json'), 'utf8'));
const writeCfg = (dest, cfg) => writeFileSync(path.join(dest, 'openclass.config.json'), JSON.stringify(cfg, null, 2) + '\n');

// Curso desechable generado con el CLI; nunca se toca el curso real ni la plantilla.
function curso(fn) {
 const temp = tmp(), dest = path.join(temp, 'curso');
 try {
  const r = spawnSync(process.execPath, [bin, dest], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const short = readCfg(dest).course.shortName;
  const md = (n) => path.join(dest, `semanas/${short}_semana${n}.md`);
  const html = (n) => path.join(dest, `semanas/${short}_semana${n}/index.html`);
  fn({ dest, md, html });
 } finally { rmSync(temp, { recursive: true, force: true }); }
}

test('[GREEN] npm run semana -- 2 genera Markdown y lanzador HTML y activa [1,2]', () => curso(({ dest, md, html }) => {
 assert.ok(!existsSync(md(2)), 'la semana 2 no existe antes');
 const r = npm(dest, 'run', 'semana', '--', '2');
 assert.equal(r.status, 0, r.stdout + r.stderr);
 assert.ok(existsSync(md(2)), 'Markdown semana 2');
 assert.ok(existsSync(html(2)), 'lanzador HTML semana 2');
 assert.match(readFileSync(html(2), 'utf8'), /data-presentation="week" data-week="2"/);
 assert.deepEqual(readCfg(dest).generation.activeWeeks, [1, 2]);
}));

test('[GREEN] la semana 1 se conserva byte a byte (SHA-256)', () => curso(({ dest, md }) => {
 writeFileSync(md(1), '# Semana 1 editada por el docente\n');
 const antes = sha(md(1));
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 assert.equal(sha(md(1)), antes);
}));

test('[GREEN] conserva campos personalizados de course, generation y raíz', () => curso(({ dest }) => {
 const cfg = readCfg(dest);
 cfg.course.docente = 'Docente de prueba';
 cfg.generation.notaInterna = 'conservar';
 cfg.extra = { moodle: 'curso-123' };
 writeCfg(dest, cfg);
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 const after = readCfg(dest);
 assert.equal(after.course.docente, 'Docente de prueba');
 assert.equal(after.course.fullName, cfg.course.fullName);
 assert.equal(after.generation.notaInterna, 'conservar');
 assert.deepEqual(after.extra, { moodle: 'curso-123' });
}));

// RED: normalizeWeek() reconstruye cada semana solo con claves fijas y descarta las demás.
test('[RED] conserva campos personalizados dentro de cada semana', () => curso(({ dest }) => {
 const cfg = readCfg(dest);
 cfg.weeks[0].recursos = ['lectura.pdf'];
 cfg.weeks[1].observaciones = 'Laboratorio en sala 3';
 writeCfg(dest, cfg);
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 const weeks = readCfg(dest).weeks;
 assert.deepEqual(weeks.find((w) => w.number === 1).recursos, ['lectura.pdf']);
 assert.equal(weeks.find((w) => w.number === 2).observaciones, 'Laboratorio en sala 3');
}));

test('[GREEN] la segunda ejecución no sobrescribe contenido editado', () => curso(({ dest, md }) => {
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 writeFileSync(md(2), '# Semana 2 editada\n');
 const antes = sha(md(2));
 const r = npm(dest, 'run', 'semana', '--', '2');
 assert.equal(r.status, 0);
 assert.match(r.stdout, /CONSERVADO=.*semana2\.md/);
 assert.equal(sha(md(2)), antes);
 assert.deepEqual(readCfg(dest).generation.activeWeeks, [1, 2]);
}));

test('[GREEN] --force-content sobrescribe solo cuando se solicita', () => curso(({ dest, md }) => {
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 writeFileSync(md(2), '# Semana 2 editada\n');
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 assert.equal(readFileSync(md(2), 'utf8'), '# Semana 2 editada\n', 'sin la bandera se conserva');
 assert.equal(npm(dest, 'run', 'semana', '--', '2', '--force-content').status, 0);
 assert.notEqual(readFileSync(md(2), 'utf8'), '# Semana 2 editada\n', 'con la bandera se regenera');
}));

// RED: --force-content llega al generador como bandera global y regenera todas las semanas activas.
test('[RED] --force-content de la semana 2 no sobrescribe la semana 1', () => curso(({ dest, md }) => {
 writeFileSync(md(1), '# Semana 1 editada por el docente\n');
 const antes = sha(md(1));
 assert.equal(npm(dest, 'run', 'semana', '--', '2', '--force-content').status, 0);
 assert.equal(sha(md(1)), antes);
}));

test('[GREEN] la semana 9 se rechaza sin modificar el curso', () => curso(({ dest, md, html }) => {
 const cfgAntes = sha(path.join(dest, 'openclass.config.json'));
 const r = npm(dest, 'run', 'semana', '--', '9');
 assert.notEqual(r.status, 0);
 assert.match(r.stderr, /entre 1 y 8/);
 assert.equal(sha(path.join(dest, 'openclass.config.json')), cfgAntes);
 assert.ok(!existsSync(md(9)) && !existsSync(html(9)));
}));

test('[GREEN] test:estructura finaliza correctamente tras activar la semana 2', () => curso(({ dest }) => {
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 const r = npm(dest, 'run', 'test:estructura');
 assert.equal(r.status, 0, r.stdout);
 assert.match(r.stdout, /PASS=semanas\/.*_semana2\/index\.html/);
 assert.match(r.stdout, /ESTRUCTURA=PASS/);
}));

test('[GREEN] la ausencia de un lanzador HTML produce FAIL', () => curso(({ dest, html }) => {
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 rmSync(html(2));
 const r = npm(dest, 'run', 'test:estructura');
 assert.notEqual(r.status, 0);
 assert.match(r.stdout, /FAIL=semanas\/.*_semana2\/index\.html/);
 assert.match(r.stdout, /ESTRUCTURA=FAIL/);
}));

test('[GREEN] npm run config recupera el lanzador sin sobrescribir Markdown', () => curso(({ dest, md, html }) => {
 assert.equal(npm(dest, 'run', 'semana', '--', '2').status, 0);
 writeFileSync(md(1), '# Semana 1 editada\n');
 writeFileSync(md(2), '# Semana 2 editada\n');
 const antes = [sha(md(1)), sha(md(2))];
 rmSync(html(2));
 assert.equal(npm(dest, 'run', 'config').status, 0);
 assert.ok(existsSync(html(2)), 'lanzador recuperado');
 assert.deepEqual([sha(md(1)), sha(md(2))], antes);
 assert.equal(npm(dest, 'run', 'test:estructura').status, 0);
}));
