/** Gate local/CI sin red ni Docker daemon. No genera ni modifica el artefacto aprobado. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { esBinario, huellaGit, sha256 } from './huella.mjs';
import { PAYLOAD, derivarGitops } from './compose-gitops.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (f) => readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const json = (f) => JSON.parse(read(f));
const pkg = json('package.json'), lock = json('package-lock.json');
const release = json(`releases/${pkg.version}.json`);
assert.equal(release.version, pkg.version);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
assert.deepEqual(lock.packages[''].dependencies, pkg.dependencies);
assert.match(read('src/protocolo.mjs'), /version:\s*2\b/);
assert.equal(release.protocol, 2);
/** Versión de Git (HEAD) de un binario; null fuera de un repositorio o si no está versionado. */
function blobGit(rel) {
  try {
    return execFileSync('git', ['show', `HEAD:./${rel}`], { cwd: root, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return null; }
}
const actual = [];
function walk(rel) {
  const p = path.join(root, rel), stat = lstatSync(p);
  assert.ok(!stat.isSymbolicLink(), `Enlace no permitido: ${rel}`);
  if (stat.isDirectory()) for (const name of readdirSync(p)) walk(`${rel}/${name}`);
  else {
    const bytes = readFileSync(p); // Buffer: nunca decodificar binarios como UTF-8
    if (esBinario(rel)) {
      const git = blobGit(rel);
      if (git) assert.equal(sha256(git), sha256(bytes), `El binario difiere de la versión Git (HEAD): ${rel}`);
    }
    actual.push({ path: rel, gitSha256: huellaGit(rel, bytes) });
  }
}
for (const rel of PAYLOAD) walk(rel);
const sorted = (a) => [...a].sort((a, b) => a.path.localeCompare(b.path, 'en'));
assert.deepEqual(sorted(actual), sorted(release.files.map(({ path, gitSha256 }) => ({ path, gitSha256 }))),
  'El payload Git (LF, según .gitattributes) difiere del artefacto aprobado');
const archive = path.join(root, 'despliegue', release.archive);
if (existsSync(archive)) assert.equal(sha256(readFileSync(archive)), release.archiveSha256);
const base = read('docker-compose.yml');
assert.ok(base.includes(`    image: openclass-live:${pkg.version}\n`));
assert.match(read('Dockerfile'), /node:22\.23\.1-alpine@sha256:[a-f0-9]{64}/);
assert.match(base, /^\s+image: postgres:16\.\d+-alpine@sha256:[a-f0-9]{64}$/m, 'PostgreSQL fijado por versión y digest');
assert.doesNotMatch(base, /^\s*ports:/m, 'Ningún puerto publicado (ni 3000 ni 5432)');
assert.match(base, /interact-db:\n\s+internal: true/, 'La red de la base es interna');
assert.equal(read('docker-compose.gitops.yml'), derivarGitops(base, pkg.version), 'Compose GitOps desincronizado');
if (process.env.LIVE_REVISION !== undefined) assert.match(process.env.LIVE_REVISION, /^[a-f0-9]{40}$/);
console.log(`GITOPS_PAYLOAD=PASS VERSION=${pkg.version} PROTOCOL=${release.protocol} FILES=${actual.length}`);
