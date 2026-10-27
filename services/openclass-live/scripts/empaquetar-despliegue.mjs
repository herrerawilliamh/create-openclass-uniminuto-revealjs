/**
 * Prepara el paquete que se copia a /home/openclass-live/ en la VPS (sin .env ni secretos):
 *   docker-compose.yml, Dockerfile, .dockerignore, .env.example, package.json, package-lock.json, src/, public/,
 *   scripts/hash-password.mjs (para generar el hash de la contraseña dentro de la VPS)
 * Salida: despliegue/openclass-live-<versión>.tar.gz + SHA256SUMS (carpeta ignorada por git).
 * Se niega a empaquetar si encuentra archivos que no pertenecen al servicio.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(path.join(raiz, 'package.json'), 'utf8'));
const nombre = `openclass-live-${version}`;
const salida = path.join(raiz, 'despliegue');
const carpeta = path.join(salida, nombre);
const ARCHIVOS = ['docker-compose.yml', 'Dockerfile', '.dockerignore', '.env.example', 'package.json', 'package-lock.json', 'src', 'public', 'scripts/hash-password.mjs'];
const PERMITIDAS = /\.(mjs|html|css|svg|json|yml|example)$|^(Dockerfile|\.dockerignore)$/;

rmSync(carpeta, { recursive: true, force: true });
mkdirSync(carpeta, { recursive: true });
for (const a of ARCHIVOS) {
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
// Rutas relativas: GNU tar interpreta «D:\…» como un host remoto.
const r = spawnSync('tar', ['-czf', `${nombre}.tar.gz`, nombre], { cwd: salida, stdio: 'inherit' });
if (r.status !== 0) throw new Error('tar falló');
const suma = createHash('sha256').update(readFileSync(tar)).digest('hex');
writeFileSync(path.join(salida, 'SHA256SUMS'), `${suma}  ${nombre}.tar.gz\n`);
console.log(`${lista.length} archivos → despliegue/${nombre}.tar.gz`);
console.log(`SHA-256 ${suma}`);
