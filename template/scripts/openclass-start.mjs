#!/usr/bin/env node
/** Arranque local independiente: nunca importa ni invoca el actualizador. */
import { existsSync, mkdtempSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { versionNotice } from './openclass-version-notice.mjs';

export async function start(root, args = [], { load = url => import(url), log = console.log } = {}) {
  if (args.some(a => !['--disable-updates', '--preview'].includes(a) && !/^--route=\/(?:[a-zA-Z0-9_-][a-zA-Z0-9/_-]*)?$/.test(a))) {
    throw Error('AUTOUPDATE=BLOCKED. Opción no admitida; el arranque no permite actualizar, adoptar ni recuperar archivos.');
  }
  log('Actualización automática bloqueada. Se inicia la versión local instalada, sin consultar la red ni instalar paquetes.');
  log('Aviso de versiones: consulta opcional con node scripts/openclass-start.mjs --check-version.');
  const local = path.join(root, 'node_modules/vite/dist/node/index.js');
  if (!existsSync(local)) throw Error('Motor local no disponible. No se descargó ni instaló nada. Use una copia estable con sus dependencias ya instaladas.');
  const vite = await load(pathToFileURL(local).href);
  // Caché efímera fuera del curso; runner evita el archivo temporal de configuración de Vite.
  const cacheDir = mkdtempSync(path.join(os.tmpdir(), 'openclass-start-'));
  const route = args.find(a => a.startsWith('--route='))?.slice(8) || '/';
  const options = { root, cacheDir, configLoader: 'runner',
    server: { host: '127.0.0.1', port: 8600, strictPort: true, open: route },
    preview: { host: '127.0.0.1', port: 8600, strictPort: true, open: route } };
  const server = args.includes('--preview') ? await vite.preview(options) : await vite.createServer(options);
  if (!args.includes('--preview')) await server.listen();
  server.printUrls();
  log('OPENCLASS_STABLE_READY; caché temporal: ' + cacheDir);
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  try {
    if (process.argv.slice(2).length === 1 && process.argv[2] === '--check-version') console.log(await versionNotice(root));
    else await start(root, process.argv.slice(2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
