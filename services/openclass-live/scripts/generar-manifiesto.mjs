/**
 * Genera releases/<versión>.json desde el árbol Git (LF) y el artefacto producido por
 * `npm run empaquetar`. No modifica manifiestos existentes: se niega a sobrescribir.
 * Uso: node scripts/generar-manifiesto.mjs <sourceBase-sha-40>
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(base ?? '')) throw new Error('Se requiere sourceBase de 40 hex');
const pkg = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const destino = path.join(raiz, 'releases', `${pkg.version}.json`);
if (existsSync(destino)) throw new Error(`${destino} ya existe: los manifiestos son inmutables`);
const nombre = `openclass-live-${pkg.version}`;
const sha = (b) => createHash('sha256').update(b).digest('hex');
const carpeta = path.join(raiz, 'despliegue', nombre);
const archivo = path.join(raiz, 'despliegue', `${nombre}.tar.gz`);
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    const rel = path.relative(carpeta, p).split(path.sep).join('/');
    const bytes = readFileSync(p);
    const lf = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
    files.push({ path: rel, sha256: sha(bytes), gitSha256: sha(lf) });
  }
})(carpeta);
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const manifiesto = { version: pkg.version, protocol: 2, archive: `${nombre}.tar.gz`,
  archiveSha256: sha(readFileSync(archivo)), sourceBase: base, files };
writeFileSync(destino, JSON.stringify(manifiesto, null, 2) + '\n');
console.log(`${destino}\nARCHIVE_SHA256=${manifiesto.archiveSha256} FILES=${files.length}`);
