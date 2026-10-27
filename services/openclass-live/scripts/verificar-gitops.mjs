/** Gate local/CI sin red ni Docker daemon. No genera ni modifica el artefacto aprobado. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const actual = [];
function walk(rel) {
  const p = path.join(root, rel), stat = lstatSync(p);
  assert.ok(!stat.isSymbolicLink(), `Enlace no permitido: ${rel}`);
  if (stat.isDirectory()) for (const name of readdirSync(p)) walk(`${rel}/${name}`);
  else actual.push({ path: rel, gitSha256: sha256(read(rel)) });
}
for (const rel of ['docker-compose.yml', 'Dockerfile', '.dockerignore', '.env.example',
  'package.json', 'package-lock.json', 'src', 'public', 'scripts/hash-password.mjs']) walk(rel);
const sorted = (a) => [...a].sort((a, b) => a.path.localeCompare(b.path, 'en'));
assert.deepEqual(sorted(actual), sorted(release.files.map(({ path, gitSha256 }) => ({ path, gitSha256 }))),
  'El payload Git (LF, según .gitattributes) difiere del artefacto aprobado');
const archive = path.join(root, 'despliegue', release.archive);
if (existsSync(archive)) assert.equal(sha256(readFileSync(archive)), release.archiveSha256);
const base = read('docker-compose.yml');
assert.ok(base.includes(`    image: openclass-live:${pkg.version}\n`));
assert.match(read('Dockerfile'), /node:22\.23\.1-alpine@sha256:[a-f0-9]{64}/);
const expected = base.replace(
  '# OpenClass Live — stack para /home/openclass-live/ (Docker Compose plugin; adoptable en Dockhand).',
  '# GitOps: generado desde docker-compose.yml; verificar con scripts/verificar-gitops.mjs.',
).replace(`    image: openclass-live:${pkg.version}`, [
  '      labels:',
  `        org.opencontainers.image.version: "${pkg.version}"`,
  '        org.opencontainers.image.revision: ${LIVE_REVISION:?Full approved Git SHA required}',
  '        org.opencontainers.image.source: https://github.com/herrerawilliamh/create-openclass-uniminuto-revealjs',
  `    image: openclass-live:${pkg.version}-` + '${LIVE_REVISION:?Full approved Git SHA required}',
  '    pull_policy: never',
].join('\n'));
assert.equal(read('docker-compose.gitops.yml'), expected, 'Compose GitOps desincronizado');
if (process.env.LIVE_REVISION !== undefined) assert.match(process.env.LIVE_REVISION, /^[a-f0-9]{40}$/);
console.log(`GITOPS_PAYLOAD=PASS VERSION=${pkg.version} PROTOCOL=${release.protocol} FILES=${actual.length}`);
