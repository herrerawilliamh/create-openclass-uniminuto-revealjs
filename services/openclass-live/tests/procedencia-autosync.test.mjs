import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
import { digest, validarLock, verificarOci, verificarAutoridad, composePorDigest,
  repository, imageRepository } from '../scripts/procedencia-autosync.mjs';

// Fixtures sintéticas: prueban el contrato, NO una release, pull o rollback reales.
function fixture(sha = 'a'.repeat(40), revision = sha) {
  const blobs = new Map();
  const put = value => {
    const bytes = Buffer.from(JSON.stringify(value)), hash = digest(bytes);
    blobs.set(hash, bytes);
    return { digest: hash, size: bytes.length };
  };
  const config = put({ os: 'linux', architecture: 'amd64', config: { Labels: {
    'org.opencontainers.image.revision': revision,
    'org.opencontainers.image.version': VERSION,
    'org.opencontainers.image.source': `https://github.com/${repository}`,
  } } });
  const manifest = put({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: { ...config, mediaType: 'application/vnd.oci.image.config.v1+json' },
    layers: [put({ syntheticLayer: sha })] });
  const lock = { schema: 1, version: VERSION, tag: `openclass-live-v${VERSION}`,
    sourceCommit: sha, source: `https://github.com/${repository}`, imageRepository,
    manifestDigest: manifest.digest, configDigest: config.digest, ciRun: '123', platform: 'linux/amd64',
    evidence: { workflow: '.github/workflows/openclass-live.yml', runAttempt: '1',
      ociArchiveSha256: 'c'.repeat(64), payloadSha256: 'd'.repeat(64) } };
  const calls = [];
  const run = args => {
    calls.push(args);
    if (args[0] !== 'api') return '';
    if (args[1].includes('releases/tags')) return JSON.stringify({ immutable: true, draft: false, prerelease: false });
    if (args[1].includes('/commits/')) return JSON.stringify({ sha });
    return JSON.stringify({ head_sha: sha, status: 'completed', conclusion: 'success',
      event: 'workflow_dispatch', path: '.github/workflows/openclass-live.yml' });
  };
  return { lock, blobs, run, calls, read: hash => { assert.ok(blobs.has(hash), 'Descarga incompleta'); return blobs.get(hash); } };
}
const base = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
function verify(f) { verificarAutoridad(f.lock, 'release-lock.json', f.run); return verificarOci(f.lock, f.read); }

test('1. contrato de release aprobada: autoridad y todos los bytes antes del candidato', () => {
  const f = fixture();
  assert.equal(verify(f).imageId, f.lock.configDigest);
  const compose = composePorDigest(base, f.lock);
  assert.ok(compose.includes(`image: ${imageRepository}@${f.lock.manifestDigest}`));
  assert.ok(!compose.includes('build:'));
  const normalized = base.replace(/\r\n/g, '\n');
  assert.equal(compose.slice(compose.indexOf('    container_name:')),
    normalized.slice(normalized.indexOf('    container_name:')));
  const attest = f.calls.find(args => args[0] === 'attestation');
  assert.ok(attest.includes('--source-digest') && attest.includes(f.lock.sourceCommit));
  assert.ok(attest.includes('--signer-digest') && attest.includes('--deny-self-hosted-runners'));
});
test('2. cambio Git ajeno al servicio no cambia imagen ni identidad del código', () => {
  const f = fixture();
  const first = composePorDigest(base, f.lock);
  // HEAD del monorepo no es un campo del lock ni entrada del constructor del candidato.
  assert.equal(composePorDigest(base, { ...f.lock, unrelatedRepositoryHead: 'b'.repeat(40) }), first);
  assert.equal(verify(f).image, validarLock(f.lock));
});
test('3. commit no aprobado, release mutable, CI de PR o firma ausente abortan', () => {
  for (const mode of ['sha', 'mutable', 'pr', 'signature']) {
    const f = fixture(), original = f.run;
    f.run = args => {
      if (mode === 'signature' && args[0] === 'attestation') throw Error('firma ausente');
      let value = original(args);
      if (args[0] === 'api') {
        const json = JSON.parse(value);
        if (mode === 'sha' && args[1].includes('/commits/')) json.sha = 'b'.repeat(40);
        if (mode === 'mutable') json.immutable = false;
        if (mode === 'pr') json.event = 'pull_request';
        value = JSON.stringify(json);
      }
      return value;
    };
    assert.throws(() => verify(f), undefined, mode);
  }
});
test('4. SHA OCI engañoso incluso con hashes internos coherentes aborta', () => {
  assert.throws(() => verify(fixture('a'.repeat(40), 'b'.repeat(40))));
});
test('5. LIVE_REVISION obsoleta no puede etiquetar ni seleccionar imagen', () => {
  const f = fixture();
  const env = { LIVE_REVISION: 'b'.repeat(40) };
  assert.ok(!composePorDigest(base, f.lock).includes(env.LIVE_REVISION));
  assert.ok(!composePorDigest(base, f.lock).includes('LIVE_REVISION'));
  assert.equal(verify(f).image, validarLock(f.lock));
});
test('6. imagen, config o capa diferentes de las aprobadas abortan', () => {
  for (const which of ['manifest', 'config', 'layer']) {
    const f = fixture();
    const hash = which === 'manifest' ? f.lock.manifestDigest : which === 'config' ? f.lock.configDigest :
      JSON.parse(f.read(f.lock.manifestDigest)).layers[0].digest;
    f.blobs.set(hash, Buffer.from('contenido sustituido'));
    assert.throws(() => verify(f), /Digest OCI incorrecto/);
  }
});
test('7. fallo de descarga/autoridad cierra; no existe fallback a build', () => {
  const f = fixture();
  f.blobs.delete(f.lock.configDigest);
  assert.throws(() => verify(f), /Descarga incompleta/);
  assert.throws(() => verificarAutoridad(f.lock, 'lock.json', () => { throw Error('red caída'); }));
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/procedencia-autosync.mjs', import.meta.url))], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, '');
});
test('8. rollback de candidato vuelve a los mismos digests, sin reconstrucción', () => {
  const previous = fixture(), next = fixture('b'.repeat(40));
  const before = composePorDigest(base, previous.lock);
  assert.notEqual(composePorDigest(base, next.lock), before);
  assert.equal(verify(previous).image, validarLock(previous.lock));
  assert.equal(composePorDigest(base, previous.lock), before);
});
