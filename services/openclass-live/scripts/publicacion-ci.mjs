/**
 * Cadena de publicación de OpenClass Live (lado CI). No publica, no firma y no accede a la red:
 * solo decide, con bytes locales, si una identidad/imagen puede continuar hacia la publicación.
 * Cada comprobación falla cerrada (excepción); ninguna usa labels como prueba suficiente.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { parseWorkflowYaml } from './workflow-yaml.mjs';
import { digest, repository, imageRepository, validarLock, verificarOci, composePorDigest }
  from './procedencia-autosync.mjs';

export const workflowPath = '.github/workflows/openclass-live.yml';
const sha40 = /^[a-f0-9]{40}$/;
const digestPattern = /^sha256:[a-f0-9]{64}$/;
export const sha256Hex = bytes => createHash('sha256').update(bytes).digest('hex');

/** Tag, ref, SHA del workflow, HEAD, commit de la tag y punta de la rama estable: un único commit. */
export function verificarIdentidad(e) {
  assert.equal(e.event, 'workflow_dispatch', 'La promoción solo se inicia manualmente');
  assert.equal(e.refType, 'tag', 'El workflow debe ejecutarse desde una tag, no desde una rama');
  assert.match(e.version, /^\d+\.\d+\.\d+$/);
  assert.equal(e.releaseTag, `openclass-live-v${e.version}`, 'La tag no corresponde a la versión del paquete');
  assert.equal(e.ref, `refs/tags/${e.releaseTag}`, 'GITHUB_REF no es la tag aprobada');
  assert.equal(e.refName, e.releaseTag);
  for (const campo of ['githubSha', 'head', 'tagCommit', 'branchTip']) {
    assert.match(String(e[campo]), sha40, `${campo} no es un SHA completo`);
  }
  assert.equal(e.githubSha, e.head, 'El checkout no es el commit del workflow');
  assert.equal(e.head, e.tagCommit, 'HEAD no es el commit de la tag');
  assert.equal(e.head, e.branchTip, 'La tag no es la punta de la rama de release');
  return e.head;
}

/** Lee un layout OCI de un único manifiesto y plataforma; verifica el hash de cada blob que usa. */
export function leerLayout(layout) {
  const file = (...p) => readFileSync(path.join(layout, ...p));
  assert.equal(JSON.parse(file('oci-layout')).imageLayoutVersion, '1.0.0');
  const index = JSON.parse(file('index.json'));
  assert.equal(index.manifests?.length, 1, 'Se exige un único manifiesto (sin índice multiarch ni extras)');
  const [entry] = index.manifests;
  assert.equal(entry.mediaType, 'application/vnd.oci.image.manifest.v1+json');
  const blob = d => {
    assert.match(d, digestPattern);
    const bytes = file('blobs', 'sha256', d.slice(7));
    assert.equal(digest(bytes), d, 'Digest OCI incorrecto');
    return bytes;
  };
  const manifest = JSON.parse(blob(entry.digest));
  const config = JSON.parse(blob(manifest.config.digest));
  return { manifestDigest: entry.digest, configDigest: manifest.config.digest,
    platform: `${config.os}/${config.architecture}` };
}

/** Conjunto de blobs de un layout, para comparar lo construido con lo publicado. */
export function blobsDe(layout) {
  return readdirSync(path.join(layout, 'blobs', 'sha256')).sort();
}
export function mismosBlobs(a, b) {
  assert.deepEqual(blobsDe(a), blobsDe(b), 'Los bytes publicados difieren de los construidos');
  assert.equal(leerLayout(a).manifestDigest, leerLayout(b).manifestDigest);
}

export function crearLock({ version, sourceCommit, ciRun, runAttempt = '1', layout, ociArchiveSha256, payloadSha256 }) {
  assert.match(ociArchiveSha256, /^[a-f0-9]{64}$/);
  assert.match(payloadSha256, /^[a-f0-9]{64}$/);
  const lock = { schema: 1, version, tag: `openclass-live-v${version}`, sourceCommit,
    source: `https://github.com/${repository}`, imageRepository, ...leerLayout(layout),
    ciRun: String(ciRun), evidence: { workflow: workflowPath, runAttempt: String(runAttempt),
      ociArchiveSha256, payloadSha256 } };
  return lock;
}

export function bytesPublicables(lock, archiveBytes) {
  validarLock(lock);
  assert.equal(sha256Hex(archiveBytes), lock.evidence.ociArchiveSha256,
    'El artefacto no es el construido y aprobado');
}

/** Compose candidato: solo por digest; rechaza tags móviles y referencias sin digest. */
export function composeCandidato(base, lock) {
  const out = composePorDigest(base, lock);
  const images = [...out.matchAll(/^\s+image:\s*(\S+)\s*$/gm)].map(m => m[1]);
  const propias = images.filter((i) => i.startsWith(`${imageRepository}@`) || /(^|\/)openclass-live[:@]/.test(i));
  assert.ok(propias.length >= 1, 'El Compose candidato debe usar la imagen del servicio');
  for (const i of propias) assert.equal(i, `${imageRepository}@${lock.manifestDigest}`);
  // Imágenes de terceros (PostgreSQL): solo por digest literal, nunca por etiqueta móvil.
  for (const i of images.filter((x) => !propias.includes(x))) assert.match(i, /^[\w./-]+:[\w.-]+@sha256:[a-f0-9]{64}$/, `Imagen sin digest: ${i}`);
  assert.ok(!/latest/i.test(out), 'latest no es una referencia admisible');
  return out;
}

/** Auditoría estática del workflow: permisos mínimos, Actions fijadas, publicación aislada. */
export function auditarWorkflow(text) {
  const v = [];
  const t = text.replace(/\r\n/g, '\n');
  const bad = (cond, msg) => { if (!cond) v.push(msg); };
  for (const m of t.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
    bad(/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(m[1]), `Action no fijada por SHA completo: ${m[1]}`);
  }
  bad(!/pull_request_target|workflow_run|secrets:\s*inherit|\bself-hosted\b/.test(t),
    'Disparador o runner no confiable');
  bad(!/:latest\b/.test(t), 'Referencia latest');
  const top = t.match(/^permissions:\n((?:  .*\n)+)/m);
  bad(top && top[1].trim() === 'contents: read', 'Permisos globales deben ser solo contents: read');
  const jobsAt = t.indexOf('\njobs:\n');
  bad(jobsAt >= 0, 'Sin jobs');
  const blocks = {};
  const parts = t.slice(jobsAt + 7).split(/^  (?=[a-z][\w-]*:\n)/m);
  for (const p of parts) { const n = p.match(/^([\w-]+):\n/); if (n) blocks[n[1]] = p; }
  const dispatchOnly = /if:\s*github\.event_name == 'workflow_dispatch'/;
  const sensible = /GITHUB_TOKEN|github\.token|secrets\.|skopeo login|docker\/login-action|attest-build-provenance|packages:|id-token|attestations:/;
  for (const nombre of ['checks', 'build', 'approval', 'publish']) bad(blocks[nombre], `Falta el job ${nombre}`);
  for (const [nombre, b] of Object.entries(blocks)) {
    const w = [...b.matchAll(/^ {6}(contents|packages|id-token|attestations|actions|pull-requests|issues|checks|deployments): *write/gm)];
    if (nombre !== 'publish') bad(w.length === 0, `El job ${nombre} no debe tener permisos de escritura`);
    if (nombre !== 'publish') bad(!sensible.test(b), `El job ${nombre} no debe ver credenciales de publicación`);
    for (const c of b.matchAll(/actions\/checkout@[a-f0-9]{40}[^\n]*\n(?: {8}.*\n)*/g)) {
      bad(/persist-credentials: false/.test(c[0]), `Checkout con credenciales persistentes en ${nombre}`);
    }
    if (nombre !== 'checks') bad(dispatchOnly.test(b), `El job ${nombre} debe ser exclusivo de workflow_dispatch`);
  }
  const { checks = '', build = '', approval = '', publish = '' } = blocks;
  bad(!/docker (buildx )?build|compose[^\n]* build/.test(checks), 'Los tests no deben construir la imagen');
  bad(/needs:\s*checks/.test(build), 'build debe depender de checks');
  bad(/permissions:\s*\{\}/.test(approval) && /environment:\s*openclass-live-release/.test(approval),
    'approval exige entorno revisado y permisos vacíos');
  bad(/needs:\s*\[\s*build\s*,\s*approval\s*\]/.test(publish), 'publish exige build y approval');
  bad(/refs\/tags\/openclass-live-v/.test(publish), 'publish debe comprobar la tag de release');
  bad(!/docker (buildx )?build|compose[^\n]* build/.test(publish), 'publish no puede reconstruir la imagen');
  bad(!/pull_request/.test(publish.replace(/^\s*#.*$/gm, '')), 'publish no puede depender de PR');
  const w = new Set([...publish.matchAll(/^ {6}([\w-]+): *write/gm)].map(m => m[1]));
  bad(w.size === 3 && ['packages', 'id-token', 'attestations'].every(k => w.has(k)),
    'publish: solo packages, id-token y attestations en write');
  bad(/ bytes --lock/.test(publish) && / mismos --a/.test(publish),
    'publish debe verificar bytes aprobados y publicados');
  /* ---- Comprobaciones estructurales por job y por paso ---- */
  const pasos = b => b.split(/^ {6}- /m).slice(1);
  const cond = b => (b.match(/^ {4}if:[ 	]*(.*)$/m) || [])[1]?.trim().replace(/\s+/g, ' ');
  const EXIGIDO = { build: "github.event_name == 'workflow_dispatch'", approval: "github.event_name == 'workflow_dispatch'",
    publish: "github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/tags/openclass-live-v')" };
  // A. La aprobación debe ser efectiva: sin condición alterada, sin always()/failure()/cancelled(), sin continue-on-error.
  for (const [nombre, esperado] of Object.entries(EXIGIDO)) {
    bad(cond(blocks[nombre] ?? '') === esperado, `La condición del job ${nombre} no es la aprobada (no puede omitirse ni forzarse)`);
  }
  for (const [nombre, b] of Object.entries(blocks)) {
    bad(!/\b(always|failure|cancelled|success)\s*\(/.test(b.replace(/^\s*#.*$/gm, '')),
      `El job ${nombre} no puede usar funciones de estado (always/failure/cancelled)`);
    bad(!/continue-on-error/.test(b), `El job ${nombre} no puede tolerar errores (continue-on-error)`);
    // C. Ningún error de integridad puede silenciarse.
    bad(!/\|\|\s*(true|:|exit\s+0)(?![\w-])|set \+e\b|\bset\s+\+o\s+errexit/.test(b),
      `El job ${nombre} no puede silenciar errores (|| true, set +e)`);
  }
  bad(/needs:\s*approval\b|needs:\s*\[[^\]]*\bapproval\b/.test(publish) && /needs:\s*build\b/.test(approval),
    'publish depende de approval y approval de build');
  // B. La fuente es el SHA inmutable aprobado, nunca una rama.
  const cmdsArchive = [...t.matchAll(/git archive\s+(\S+)/g)].map(m => m[1].replace(/^["']|["']$/g, ''));
  bad(cmdsArchive.length === 1 && cmdsArchive[0] === '$GITHUB_SHA' && /git archive[^\n]*/.test(build),
    'build debe archivar exactamente $GITHUB_SHA (commit aprobado e inmutable)');
  bad(!/\b(origin\/)?(main|master|HEAD)\b[^\n]*\|\s*tar|\|\s*tar[^\n]*\b(main|master)\b/.test(build.replace(/^\s*#.*$/gm, '')),
    'build no puede tomar la fuente de una rama');
  for (const nombre of ['build', 'publish']) {
    for (const p of pasos(blocks[nombre] ?? '').filter(x => /uses:\s*actions\/checkout@/.test(x))) {
      bad(/^ {10}ref:\s*\$\{\{ github\.sha \}\}\s*$/m.test(p), `Checkout de ${nombre} debe fijarse a github.sha`);
    }
  }
  bad(/TESTED_SHA/.test(build) && /rev-parse HEAD\)" = "\$TESTED_SHA"/.test(build),
    'build debe comprobar que construye el SHA probado');
  // Integridad del artefacto: verificación presente, estricta y en orden antes de extraer/publicar.
  const pb = pasos(publish);
  const ix = re => pb.findIndex(x => re.test(x));
  const iBytes = ix(/sha256sum --check SHA256SUMS/), iPush = ix(/skopeo copy/), iLogin = ix(/uses:\s*docker\/login-action@/);
  const iAtt = ix(/uses:\s*actions\/attest-build-provenance@/);
  bad(iBytes >= 0 && /set -euo pipefail/.test(pb[iBytes] ?? '') && /tar -xf live-build\/image\.oci\.tar/.test(pb[iBytes] ?? ''),
    'publish debe verificar sumas y bytes del tar en modo estricto (set -euo pipefail)');
  bad(iBytes >= 0 && iPush > iBytes, 'La verificación de integridad debe preceder a la publicación');
  bad(/set -euo pipefail/.test(pasos(build).find(x => /id: lock/.test(x)) ?? ''), 'build/lock debe ser estricto (set -euo pipefail)');
  // P1. Credenciales Docker (~/.docker/config.json) antes de publicar y de atestiguar.
  bad(iLogin >= 0 && iPush > iLogin && iAtt > iLogin, 'publish: docker/login-action debe preceder a skopeo copy y a la attestation');
  const login = pb[iLogin] ?? '';
  bad(/^ {10}registry:\s*ghcr\.io\s*$/m.test(login) && /^ {10}password:\s*\$\{\{ github\.token \}\}\s*$/m.test(login)
    && /^ {10}username:\s*\$\{\{ github\.actor \}\}\s*$/m.test(login), 'El login de GHCR debe usar ghcr.io con github.actor y github.token');
  bad(!/skopeo login|--password(?!-stdin)\b|echo[^\n]*(token|password)/i.test(publish), 'publish no puede exponer ni pasar credenciales por línea de comandos');
  const att = pb[iAtt] ?? '';
  bad(/subject-name:\s*\$\{\{ steps\.push\.outputs\.image \}\}/.test(att) && /subject-digest:\s*\$\{\{ steps\.push\.outputs\.digest \}\}/.test(att)
    && /push-to-registry:\s*true/.test(att), 'La attestation debe vincular el digest OCI publicado (steps.push.outputs)');
  bad(iAtt > ix(/id: push/), 'La attestation debe seguir a la publicación');
  v.push(...auditarEstructura(t));
  return v;
}

/**
 * Secuencia canónica del paso de integridad de publish. Coincidencia EXACTA línea a línea.
 * Normalizaciones inocuas admitidas (únicas): fin de línea CRLF→LF, espacios finales, sangría
 * de línea, líneas en blanco y líneas de comentario completas. Una continuación `\` NO se normaliza.
 */
export const PASO_INTEGRIDAD = Object.freeze({
  name: 'Bytes aprobados (hash del tar, lock y layout) sin reconstruir',
  shell: 'bash',
  comandos: Object.freeze([
    'set -euo pipefail',
    'S=services/openclass-live/scripts/publicacion-ci.mjs',
    '(cd live-build && sha256sum --check SHA256SUMS)',
    'test "$(cat live-build/source-commit.txt)" = "$GITHUB_SHA"',
    'test "$(node -p "require(\'./live-build/release-lock.json\').manifestDigest")" = "${{ needs.build.outputs.manifest_digest }}"',
    'node $S bytes --lock live-build/release-lock.json --archive live-build/image.oci.tar',
    'mkdir -p "$RUNNER_TEMP/built"',
    'tar -xf live-build/image.oci.tar -C "$RUNNER_TEMP/built"',
    'node $S layout --layout "$RUNNER_TEMP/built" --lock live-build/release-lock.json',
  ]),
});
const SCRIPT_APROBADO = 'services/openclass-live/scripts/publicacion-ci.mjs';

/** Comandos de un `run` tras las normalizaciones inocuas documentadas en PASO_INTEGRIDAD. */
export function comandosNormalizados(run) {
  return String(run).replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/, ''))
    .filter(l => !/^\s*(#.*)?$/.test(l)).map(l => l.trim());
}

/** Validación sobre el YAML estructurado (no sobre texto): paso canónico y operadores de escape. */
function auditarEstructura(texto) {
  const v = [];
  const bad = (cond, msg) => { if (!cond) v.push(msg); };
  let doc;
  try { doc = parseWorkflowYaml(texto); } catch (e) { return [`YAML del workflow no analizable (falla cerrado): ${e.message}`]; }
  const jobs = doc && typeof doc.jobs === 'object' && doc.jobs ? doc.jobs : {};
  bad(!Object.hasOwn(doc ?? {}, 'continue-on-error') && !Object.hasOwn(doc?.defaults ?? {}, 'continue-on-error'),
    'continue-on-error no admitido a nivel de workflow');
  const canon = [];
  for (const [nombre, job] of Object.entries(jobs)) {
    bad(!Object.hasOwn(job ?? {}, 'continue-on-error'), `El job ${nombre} no puede tolerar errores (continue-on-error)`);
    const steps = Array.isArray(job?.steps) ? job.steps : [];
    steps.forEach((s, n) => {
      const id = `${nombre}[${n}]`;
      bad(!Object.hasOwn(s ?? {}, 'continue-on-error'), `El paso ${id} no puede tolerar errores (continue-on-error)`);
      if (typeof s?.run !== 'string') return;
      const cmds = comandosNormalizados(s.run);
      const unido = cmds.join('\n').replace(/\\\n\s*/g, ' ');
      bad(!/\|\||\bset\s+\+|\btrap\b|\bexit\s+0\b/.test(unido),
        `El paso ${id} no puede silenciar errores (||, set +e, trap, exit 0; operadores de escape prohibidos)`);
      for (const c of cmds.filter(c => /^S=/.test(c))) {
        bad(c === `S=${SCRIPT_APROBADO}`, `El paso ${id} sustituye el script aprobado (${c})`);
      }
      if (/sha256sum --check SHA256SUMS/.test(s.run)) canon.push({ nombre, n, s, cmds });
    });
  }
  bad(canon.length === 1 && canon[0].nombre === 'publish',
    'Debe existir exactamente un paso canónico de integridad, en el job publish');
  const c = canon[0];
  if (c) {
    bad(JSON.stringify(Object.keys(c.s).sort()) === JSON.stringify(['name', 'run', 'shell']),
      'El paso canónico de integridad solo admite name, shell y run (sin if, env, continue-on-error, uses, working-directory)');
    bad(c.s.name === PASO_INTEGRIDAD.name && c.s.shell === PASO_INTEGRIDAD.shell,
      'El paso canónico de integridad cambió de nombre o intérprete');
    bad(JSON.stringify(c.cmds) === JSON.stringify(PASO_INTEGRIDAD.comandos),
      'El contenido ejecutable del paso canónico de integridad difiere del aprobado');
  }
  return v;
}

/* ---- CLI ---- */
const arg = (flag, args) => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

function main(args) {
  const [cmd] = args;
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const lockOf = () => JSON.parse(readFileSync(arg('--lock', args)));
  switch (cmd) {
    case 'identidad': {
      const env = process.env;
      const sha = verificarIdentidad({ event: env.GITHUB_EVENT_NAME, refType: env.GITHUB_REF_TYPE,
        ref: env.GITHUB_REF, refName: env.GITHUB_REF_NAME, releaseTag: env.RELEASE_TAG,
        githubSha: env.GITHUB_SHA, head: git('rev-parse', 'HEAD'),
        tagCommit: git('rev-parse', `refs/tags/${env.RELEASE_TAG}^{commit}`),
        branchTip: git('rev-parse', 'origin/release/openclass-live'), version: pkg.version });
      console.log(`IDENTITY=PASS SHA=${sha} VERSION=${pkg.version}`);
      break;
    }
    case 'lock': {
      const archive = arg('--archive', args);
      const lock = crearLock({ version: pkg.version, sourceCommit: git('rev-parse', 'HEAD'),
        ciRun: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT, layout: arg('--layout', args),
        ociArchiveSha256: sha256Hex(readFileSync(archive)),
        payloadSha256: sha256Hex(readFileSync(new URL(`../releases/${pkg.version}.json`, import.meta.url))) });
      assert.equal(lock.sourceCommit, git('rev-parse', 'HEAD'));
      verificarOci(lock, d => readFileSync(path.join(arg('--layout', args), 'blobs', 'sha256', d.slice(7))));
      writeFileSync(arg('--out', args), `${JSON.stringify(lock, null, 2)}\n`);
      console.log(`LOCK=PASS MANIFEST=${lock.manifestDigest} CONFIG=${lock.configDigest}`);
      break;
    }
    case 'bytes': // el tar descargado es exactamente el aprobado en build
      bytesPublicables(lockOf(), readFileSync(arg('--archive', args)));
      console.log('APPROVED_BYTES=PASS');
      break;
    case 'layout': { // verificación OCI offline contra el lock (construido o descargado de GHCR)
      const layout = arg('--layout', args), lock = lockOf();
      verificarOci(lock, d => readFileSync(path.join(layout, 'blobs', 'sha256', d.slice(7))));
      console.log(`OCI_LAYOUT=PASS ${lock.manifestDigest}`);
      break;
    }
    case 'mismos':
      mismosBlobs(arg('--a', args), arg('--b', args));
      console.log('PUBLISHED_EQUALS_BUILT=PASS');
      break;
    case 'compose':
      writeFileSync(arg('--out', args), composeCandidato(
        readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8'), lockOf()));
      console.log('COMPOSE_BY_DIGEST=PASS');
      break;
    case 'workflow': {
      const file = new URL(`../../../${workflowPath}`, import.meta.url);
      const problems = auditarWorkflow(readFileSync(file, 'utf8'));
      assert.deepEqual(problems, [], problems.join('\n'));
      console.log('WORKFLOW_CONTRACT=PASS');
      break;
    }
    default: throw new Error('Uso: publicacion-ci.mjs identidad|lock|bytes|layout|mismos|compose|workflow');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (error) {
    console.error(`PUBLICATION_GATE=FAIL ${error.message}`);
    process.exitCode = 1;
  }
}
