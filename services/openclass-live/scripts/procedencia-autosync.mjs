/** Preparación de un candidato por digest. No despliega ni publica; sin evidencia aborta. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export const repository = 'herrerawilliamh/create-openclass-uniminuto-revealjs';
export const imageRepository = 'ghcr.io/herrerawilliamh/openclass-live';
const source = `https://github.com/${repository}`;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
export const digest = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

export function validarLock(lock) {
  assert.equal(lock.schema, 1);
  assert.match(lock.version, /^\d+\.\d+\.\d+$/);
  assert.equal(lock.tag, `openclass-live-v${lock.version}`);
  assert.match(lock.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(lock.source, source);
  assert.equal(lock.imageRepository, imageRepository);
  assert.match(lock.manifestDigest, digestPattern);
  assert.match(lock.configDigest, digestPattern);
  assert.match(String(lock.ciRun), /^[1-9][0-9]*$/);
  assert.ok(['linux/amd64', 'linux/arm64'].includes(lock.platform));
  // Evidencia del build único: tar OCI aprobado, payload aprobado y workflow emisor.
  assert.equal(lock.evidence?.workflow, '.github/workflows/openclass-live.yml');
  assert.match(String(lock.evidence.runAttempt), /^[1-9][0-9]*$/);
  assert.match(lock.evidence.ociArchiveSha256, /^[a-f0-9]{64}$/);
  assert.match(lock.evidence.payloadSha256, /^[a-f0-9]{64}$/);
  return `${imageRepository}@${lock.manifestDigest}`;
}

/** readBlob debe entregar bytes OCI; no se confía en nombres, labels ni hashes declarados. */
export function verificarOci(lock, readBlob) {
  validarLock(lock);
  const blob = descriptor => {
    assert.match(descriptor.digest, digestPattern);
    const bytes = readBlob(descriptor.digest);
    assert.equal(digest(bytes), descriptor.digest, 'Digest OCI incorrecto');
    if (descriptor.size !== undefined) assert.equal(bytes.length, descriptor.size);
    return bytes;
  };
  const manifest = JSON.parse(blob({ digest: lock.manifestDigest }));
  assert.equal(manifest.schemaVersion, 2);
  // Un solo manifiesto/plataforma: un índice multiarch requiere otra política de resolución.
  assert.equal(manifest.mediaType, 'application/vnd.oci.image.manifest.v1+json');
  assert.equal(manifest.config.mediaType, 'application/vnd.oci.image.config.v1+json');
  assert.equal(manifest.config.digest, lock.configDigest);
  const config = JSON.parse(blob(manifest.config));
  assert.equal(`${config.os}/${config.architecture}`, lock.platform);
  assert.equal(config.config.Labels['org.opencontainers.image.revision'], lock.sourceCommit);
  assert.equal(config.config.Labels['org.opencontainers.image.version'], lock.version);
  assert.equal(config.config.Labels['org.opencontainers.image.source'], lock.source);
  assert.ok(Array.isArray(manifest.layers) && manifest.layers.length > 0);
  for (const layer of manifest.layers) blob(layer);
  return { image: validarLock(lock), imageId: lock.configDigest };
}

/** Parte del Compose base aprobado; preserva íntegros secretos, Traefik e identidad. */
export function composePorDigest(base, lock) {
  const image = validarLock(lock);
  const build = '    build:\n      context: .\n      dockerfile: Dockerfile\n';
  const oldImage = `    image: openclass-live:${lock.version}\n`;
  base = base.replace(/\r\n/g, '\n');
  assert.equal(base.split(build).length, 2, 'Build base inesperado');
  assert.equal(base.split(oldImage).length, 2, 'Imagen base inesperada');
  const result = base.replace(build, '').replace(oldImage,
    `    image: ${image}\n    platform: ${lock.platform}\n    pull_policy: always\n`);
  assert.ok(!/\bbuild:|LIVE_REVISION|\$\{.*(?:IMAGE|REVISION)/.test(result));
  return result;
}

/** Adaptador real de verificación: errores de red/herramienta no se convierten en PASS. */
export function verificarAutoridad(lock, lockPath, run) {
  const image = validarLock(lock);
  const api = endpoint => JSON.parse(run(['api', `repos/${repository}/${endpoint}`]));
  const release = api(`releases/tags/${lock.tag}`);
  assert.equal(release.immutable, true, 'Release no inmutable');
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  assert.equal(api(`commits/${lock.tag}`).sha, lock.sourceCommit, 'Tag movida o SHA diferente');
  run(['release', 'verify', lock.tag, '--repo', repository]);
  run(['release', 'verify-asset', lock.tag, lockPath, '--repo', repository]);
  const ci = api(`actions/runs/${lock.ciRun}`);
  assert.equal(ci.head_sha, lock.sourceCommit);
  assert.equal(ci.status, 'completed');
  assert.equal(ci.conclusion, 'success');
  assert.equal(ci.event, 'workflow_dispatch');
  assert.equal(ci.path, '.github/workflows/openclass-live.yml');
  run(['attestation', 'verify', `oci://${image}`, '--repo', repository,
    '--signer-workflow', `${repository}/.github/workflows/openclass-live.yml`,
    '--signer-digest', lock.sourceCommit, '--source-digest', lock.sourceCommit,
    '--source-ref', `refs/tags/${lock.tag}`, '--deny-self-hosted-runners']);
  return image;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const [, , lockPath, layout] = process.argv;
    assert.ok(lockPath && layout, 'Uso: node scripts/procedencia-autosync.mjs <release-lock.json> <oci-layout>');
    // Una variable antigua no interviene en identidad, labels ni selección de imagen.
    const lock = JSON.parse(readFileSync(lockPath));
    const run = args => execFileSync('gh', args, { encoding: 'utf8', timeout: 120000,
      stdio: ['ignore', 'pipe', 'pipe'] });
    verificarAutoridad(lock, lockPath, run);
    verificarOci(lock, d => readFileSync(path.join(layout, 'blobs', 'sha256', d.slice(7))));
    const base = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8');
    // Solo emite un candidato completo tras TODAS las verificaciones; nunca ejecuta Compose.
    process.stdout.write(composePorDigest(base, lock));
  } catch (error) {
    console.error(`CANDIDATE_PROVENANCE=FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
