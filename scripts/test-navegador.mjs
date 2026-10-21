#!/usr/bin/env node
/**
 * Prueba de extremo a extremo en Chrome real:
 *  1. crea un curso nuevo con el CLI en una carpeta temporal,
 *  2. instala dependencias y compila con una base de subcarpeta (como GitHub Pages),
 *  3. ejecuta tests/navegador.test.mjs contra ese build.
 * Uso: npm run test:navegador [-- --dist <dist existente> --base /ruta/] [--conservar]
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const valor = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const npm = (cwd, ...a) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });

let dist = valor('--dist');
let base = valor('--base') || '/';
let temporal;
if (!dist) {
  base = '/prueba-openclass/';
  // realpath expande rutas cortas 8.3 de Windows (p. ej. USUARI~1), que rompen el proxy HTML de Vite.
  temporal = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-e2e-')));
  const curso = path.join(temporal, 'curso-e2e');
  const crear = spawnSync(process.execPath, [path.join(raiz, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { stdio: 'inherit' });
  if (crear.status !== 0) process.exit(crear.status ?? 1);
  if (npm(curso, 'install', '--no-audit', '--no-fund').status !== 0) process.exit(1);
  process.env.SITE_BASE = base;
  if (npm(curso, 'run', 'build:all').status !== 0) process.exit(1);
  dist = path.join(curso, 'dist');
}
const r = spawnSync(process.execPath, ['--test', '--test-reporter=spec', path.join(raiz, 'tests/navegador.test.mjs')], {
  stdio: 'inherit', env: { ...process.env, OPENCLASS_DIST: dist, OPENCLASS_BASE: base },
});
if (temporal && !args.includes('--conservar')) rmSync(temporal, { recursive: true, force: true });
process.exit(r.status ?? 1);
