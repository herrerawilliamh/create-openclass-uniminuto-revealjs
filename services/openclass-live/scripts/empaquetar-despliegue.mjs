/**
 * Prepara el paquete que se copia a /home/openclass-live/ en la VPS (sin .env ni secretos):
 *   docker-compose.yml, Dockerfile, .dockerignore, .env.example, package.json, package-lock.json, src/, public/,
 *   scripts/hash-password.mjs (para generar el hash de la contraseña dentro de la VPS)
 * Salida: despliegue/openclass-live-<versión>.tar.gz + SHA256SUMS (carpeta ignorada por git).
 * Se niega a empaquetar si encuentra archivos que no pertenecen al servicio.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, lstatSync, chmodSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const lock = JSON.parse(readFileSync(path.join(raiz, 'package-lock.json'), 'utf8'));
if (lock.version !== version || lock.packages[''].version !== version
  || !readFileSync(path.join(raiz, 'docker-compose.yml'), 'utf8').includes(`image: openclass-live:${version}`)) {
  throw new Error('Versiones package/lock/Compose incoherentes');
}
const nombre = `openclass-live-${version}`;
const salida = path.join(raiz, 'despliegue');
const carpeta = path.join(salida, nombre);
const ARCHIVOS = ['docker-compose.yml', 'Dockerfile', '.dockerignore', '.env.example', 'package.json', 'package-lock.json', 'src', 'public', 'scripts/hash-password.mjs'];
const PERMITIDAS = /\.(mjs|html|css|svg|json|yml|example)$|^(Dockerfile|\.dockerignore)$/;

rmSync(carpeta, { recursive: true, force: true });
mkdirSync(carpeta, { recursive: true });
function sinEnlaces(dir) {
  if (lstatSync(dir).isSymbolicLink()) throw new Error('Enlace no permitido');
  if (statSync(dir).isDirectory()) for (const n of readdirSync(dir)) sinEnlaces(path.join(dir, n));
}
for (const a of ARCHIVOS) {
  sinEnlaces(path.join(raiz, a));
  if (!existsSync(path.join(raiz, a))) throw new Error(`Falta ${a}`);
  cpSync(path.join(raiz, a), path.join(carpeta, a), { recursive: true });
}

const lista = [];
(function recorrer(dir) {
  for (const n of readdirSync(dir)) {
    const r = path.join(dir, n);
    if (statSync(r).isDirectory()) recorrer(r);
    else {
      if (!PERMITIDAS.test(n) || n === '.env') throw new Error(`Archivo no permitido en el paquete: ${path.relative(carpeta, r)}`);
      lista.push(path.relative(carpeta, r).split(path.sep).join('/'));
    }
  }
})(carpeta);

const tar = path.join(salida, `${nombre}.tar.gz`);
// Metadatos y orden constantes; gzip de Node omite la fecha de generación.
lista.sort();
for (const f of lista) { chmodSync(path.join(carpeta, f), 0o644); utimesSync(path.join(carpeta, f), 0, 0); }
const tipoTar = spawnSync('tar', ['--version'], { encoding: 'utf8' });
const propietario = tipoTar.stdout?.includes('GNU tar')
  ? ['--owner=root:0', '--group=root:0']
  : ['--uid', '0', '--gid', '0', '--uname', 'root', '--gname', 'root'];
const r = spawnSync('tar', ['--format', 'ustar', ...propietario, '-cf', '-', '-T', '-'], {
  cwd: salida, input: lista.map((f) => `${nombre}/${f}`).join('\n') + '\n', maxBuffer: 16 * 1024 * 1024,
});
if (r.status !== 0) throw new Error(`tar falló: ${r.stderr}`);
writeFileSync(tar, gzipSync(r.stdout, { level: 9 }));
const suma = createHash('sha256').update(readFileSync(tar)).digest('hex');
writeFileSync(path.join(salida, 'SHA256SUMS'), `${suma}  ${nombre}.tar.gz\n`);
console.log(`${lista.length} archivos → despliegue/${nombre}.tar.gz`);
console.log(`SHA-256 ${suma}`);
