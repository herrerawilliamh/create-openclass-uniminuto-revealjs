import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditarWorkflow, verificarIdentidad, leerLayout, crearLock, bytesPublicables,
  mismosBlobs, composeCandidato, sha256Hex } from '../scripts/publicacion-ci.mjs';
import { parseWorkflowYaml } from '../scripts/workflow-yaml.mjs';
import { digest, verificarOci, repository } from '../scripts/procedencia-autosync.mjs';

const here = p => fileURLToPath(new URL(p, import.meta.url));
const workflow = readFileSync(here('../../../.github/workflows/openclass-live.yml'), 'utf8');
const VERSION = JSON.parse(readFileSync(here('../package.json'), 'utf8')).version;
const base = readFileSync(here('../docker-compose.yml'), 'utf8');
const SHA = 'a'.repeat(40);

// Layout OCI sintético: prueba el contrato, no una imagen real ni una publicación.
function layout(dir, { sha = SHA, extraManifest = false, layerText = 'capa' } = {}) {
  mkdirSync(path.join(dir, 'blobs', 'sha256'), { recursive: true });
  const put = value => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    const d = digest(bytes);
    writeFileSync(path.join(dir, 'blobs', 'sha256', d.slice(7)), bytes);
    return { digest: d, size: bytes.length };
  };
  const config = put({ os: 'linux', architecture: 'amd64', config: { Labels: {
    'org.opencontainers.image.revision': sha, 'org.opencontainers.image.version': VERSION,
    'org.opencontainers.image.source': `https://github.com/${repository}` } } });
  const manifest = put({ schemaVersion: 2, mediaType: 'application/vnd.oci.image.manifest.v1+json',
    config: { ...config, mediaType: 'application/vnd.oci.image.config.v1+json' },
    layers: [{ ...put(Buffer.from(layerText)), mediaType: 'application/vnd.oci.image.layer.v1.tar' }] });
  const entry = { ...manifest, mediaType: 'application/vnd.oci.image.manifest.v1+json' };
  writeFileSync(path.join(dir, 'oci-layout'), '{"imageLayoutVersion":"1.0.0"}');
  writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ schemaVersion: 2,
    manifests: extraManifest ? [entry, entry] : [entry] }));
  return dir;
}
function conTmp(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'oclive-pub-'));
  try { return fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
const lockDe = dir => crearLock({ version: VERSION, sourceCommit: SHA, ciRun: '99', layout: dir,
  ociArchiveSha256: 'e'.repeat(64), payloadSha256: 'f'.repeat(64) });
const ident = (o = {}) => ({ event: 'workflow_dispatch', refType: 'tag', version: VERSION,
  releaseTag: `openclass-live-v${VERSION}`, ref: `refs/tags/openclass-live-v${VERSION}`,
  refName: `openclass-live-v${VERSION}`, githubSha: SHA, head: SHA, tagCommit: SHA, branchTip: SHA, ...o });

test('1. workflow real cumple el contrato: SHA fijados, permisos mínimos, publicación aislada', () => {
  assert.deepEqual(auditarWorkflow(workflow), []);
});

test('2. mutaciones del workflow se detectan (acción móvil, permisos, credenciales, rebuild, PR)', () => {
  const mut = (desde, hacia, esperado) => {
    assert.ok(workflow.includes(desde), `Mutación sin ancla: ${desde}`);
    const problemas = auditarWorkflow(workflow.replace(desde, hacia));
    assert.ok(problemas.some(p => esperado.test(p)), `${desde} → ${problemas.join('|')}`);
  };
  mut('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020', 'actions/setup-node@v4', /no fijada/);
  mut('  contents: read\n\nconcurrency', '  contents: read\n  packages: write\n\nconcurrency', /globales/);
  mut('    permissions: {}', '    permissions:\n      contents: write', /approval|escritura/);
  mut('      - run: npm ci --ignore-scripts', '      - run: echo "${{ secrets.TOKEN }}"\n      - run: npm ci --ignore-scripts', /credenciales/);
  mut('Validar Compose GitOps (sin construir)', 'Validar\n        run: docker compose build', /construir/);
  mut('persist-credentials: false', 'persist-credentials: true', /credenciales persistentes/);
  mut('  pull_request:\n', '  pull_request_target:\n', /no confiable/);
  mut('needs: [build, approval]', 'needs: [build]', /publish exige/);
  mut("if: github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/tags/openclass-live-v')",
    "if: github.event_name == 'workflow_dispatch'", /tag de release/);
  mut("    if: github.event_name == 'workflow_dispatch'\n    needs: checks\n    runs-on", '    needs: checks\n    runs-on', /exclusivo/);
  mut('docker://$IMAGE@$DIGEST', 'docker://$IMAGE:latest', /latest/);
  mut('node $S mismos --a', 'echo skip --a', /bytes aprobados y publicados/);
});

test('2b. mutaciones del informe Codex: aprobación omitida, fuente cambiada, integridad ignorada, login ausente', () => {
  const mutar = (desde, hacia, esperado) => {
    assert.ok(workflow.includes(desde), `Mutación sin ancla: ${desde}`);
    const problemas = auditarWorkflow(workflow.replace(desde, hacia));
    assert.ok(problemas.length > 0 && problemas.some(p => esperado.test(p)), `${desde} → ${problemas.join('|')}`);
  };
  // A. approval se omite con una condición falsa y publish continúa con always().
  const dispatch = "if: github.event_name == 'workflow_dispatch'";
  const aprobacion = `  approval:\n    name: Live aprobación humana\n    ${dispatch}`;
  const publicacion = "if: github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/tags/openclass-live-v')";
  let a = workflow.replace(aprobacion, aprobacion.replace(dispatch, 'if: ${{ false }}'));
  assert.notEqual(a, workflow);
  a = a.replace(publicacion, `if: always() && ${publicacion.slice(4)}`);
  const pa = auditarWorkflow(a);
  assert.ok(pa.some(p => /job approval/.test(p)) && pa.some(p => /job publish/.test(p)), pa.join('|'));
  mutar(dispatch + "\n    needs: build\n    runs-on: ubuntu-24.04\n    environment", "if: ${{ false }}\n    needs: build\n    runs-on: ubuntu-24.04\n    environment", /job approval/);
  mutar('    environment: openclass-live-release\n', '    environment: openclass-live-release\n    continue-on-error: true\n', /continue-on-error/);
  // B. La fuente deja de ser el SHA aprobado.
  mutar('git archive "$GITHUB_SHA" services/openclass-live', 'git archive main services/openclass-live', /\$GITHUB_SHA/);
  mutar('git archive "$GITHUB_SHA" services/openclass-live', 'git archive origin/main services/openclass-live', /\$GITHUB_SHA/);
  mutar('          ref: ${{ github.sha }}\n          fetch-depth: 1', '          ref: main\n          fetch-depth: 1', /github\.sha/);
  // C. Errores de integridad silenciados.
  mutar('(cd live-build && sha256sum --check SHA256SUMS)', '(cd live-build && sha256sum --check SHA256SUMS) || true', /silenciar/);
  mutar('tar -xf live-build/image.oci.tar -C "$RUNNER_TEMP/built"', 'tar -xf live-build/image.oci.tar -C "$RUNNER_TEMP/built" || true', /silenciar/);
  mutar('node $S bytes --lock live-build/release-lock.json --archive live-build/image.oci.tar', 'node $S bytes --lock live-build/release-lock.json --archive live-build/image.oci.tar || :', /silenciar/);
  mutar('          set -euo pipefail\n          S=services/openclass-live/scripts/publicacion-ci.mjs\n          (cd live-build', '          set -u\n          S=services/openclass-live/scripts/publicacion-ci.mjs\n          (cd live-build', /estricto/);
  // P1. El login Docker debe existir, precederla publicación/attestation y no usar skopeo login.
  const login = workflow.match(/ {6}- name: Iniciar sesión en GHCR[\s\S]*?password: \$\{\{ github\.token \}\}\n/)[0];
  assert.deepEqual(auditarWorkflow(workflow.replace(login, '')).filter(p => /login-action/.test(p)).length, 1);
  const pasoAtt = workflow.match(/ {6}- name: Attestation de procedencia[\s\S]*?push-to-registry: true\n/)[0];
  const orden = workflow.replace(login, '').replace(pasoAtt, login + pasoAtt); // login tras publicar, pero antes de attestation
  assert.deepEqual(auditarWorkflow(orden).filter(p => /login-action/.test(p)).length, 1, 'login tras skopeo copy debe rechazarse');
  const tarde = workflow.replace(login, '').replace(pasoAtt, pasoAtt + login);
  assert.ok(auditarWorkflow(tarde).some(p => /login-action/.test(p)), 'login después de la attestation debe rechazarse');
  mutar('password: ${{ github.token }}', 'password: ${{ secrets.GHCR_PAT }}', /login de GHCR/);
  mutar('subject-digest: ${{ steps.push.outputs.digest }}', 'subject-digest: sha256:deadbeef', /vincular el digest/);
  mutar('        run: |\n          set -euo pipefail\n          S=services/openclass-live/scripts/publicacion-ci.mjs\n          command -v skopeo',
    '        run: |\n          set -euo pipefail\n          S=services/openclass-live/scripts/publicacion-ci.mjs\n          echo x | skopeo login ghcr.io --username u --password-stdin\n          command -v skopeo', /credenciales/);
});

test('2c. P2: validación canónica del paso de integridad rechaza toda forma de continuar tras un fallo', () => {
  assert.deepEqual(auditarWorkflow(workflow), []);
  const CHECK = '(cd live-build && sha256sum --check SHA256SUMS)';
  const rechaza = (nombre, cambiar) => {
    const mod = cambiar(workflow);
    assert.notEqual(mod, workflow, `${nombre}: la mutación no cambió nada`);
    assert.ok(auditarWorkflow(mod).length > 0, `${nombre} fue aceptado`);
  };
  const enCheck = sufijo => w => w.replace(CHECK, CHECK + sufijo);
  rechaza('|| true', enCheck(' || true'));
  rechaza('|| "true"', enCheck(' || "true"'));
  rechaza("|| 'true'", enCheck(" || 'true'"));
  rechaza('|| continuación true', enCheck(' || \\\n          true'));
  rechaza('||\\ true (sin espacio)', enCheck(' ||\\\n          true'));
  rechaza('|| :', enCheck(' || :'));
  rechaza('|| exit 0', enCheck(' || exit 0'));
  rechaza('; true', enCheck('; true'));
  rechaza('comando extra', enCheck('\n          echo ok'));
  rechaza('set +e', w => w.replace('          (cd live-build && sha256sum --check', '          set +e\n          (cd live-build && sha256sum --check'));
  rechaza('set +e en otro paso', w => w.replace('          mkdir live-release', '          set +e\n          mkdir live-release'));
  rechaza('continue-on-error en paso crítico', w => w.replace(
    '      - name: Bytes aprobados (hash del tar, lock y layout) sin reconstruir\n        shell: bash\n',
    '      - name: Bytes aprobados (hash del tar, lock y layout) sin reconstruir\n        shell: bash\n        continue-on-error: true\n'));
  rechaza('continue-on-error en otro paso', w => w.replace('        id: push\n', '        id: push\n        continue-on-error: true\n'));
  rechaza('if en el paso canónico', w => w.replace(
    '      - name: Bytes aprobados (hash del tar, lock y layout) sin reconstruir\n',
    "      - name: Bytes aprobados (hash del tar, lock y layout) sin reconstruir\n        if: ${{ false }}\n"));
  rechaza('git archive main', w => w.replace('git archive "$GITHUB_SHA" services/openclass-live', 'git archive main services/openclass-live'));
  rechaza('always() en publish', w => w.replace("if: github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/tags/openclass-live-v')",
    "if: always() && github.event_name == 'workflow_dispatch' && startsWith(github.ref, 'refs/tags/openclass-live-v')"));
  rechaza('approval omitida con always()', w => w.replace('needs: [build, approval]', 'needs: [build]'));
  rechaza('retirada del paso canónico', w => w.replace(CHECK + '\n', ''));
  rechaza('paso canónico renombrado', w => w.replace('Bytes aprobados (hash del tar, lock y layout) sin reconstruir', 'Verificar'));
  rechaza('línea del paso canónico alterada', w => w.replace('--check SHA256SUMS)', '--check --quiet SHA256SUMS)'));
  rechaza('orden alterado', w => w.replace(
    'mkdir -p "$RUNNER_TEMP/built"\n          tar -xf live-build/image.oci.tar -C "$RUNNER_TEMP/built"',
    'tar -xf live-build/image.oci.tar -C "$RUNNER_TEMP/built"\n          mkdir -p "$RUNNER_TEMP/built"'));
  rechaza('script externo no aprobado', w => w.replace('S=services/openclass-live/scripts/publicacion-ci.mjs\n          (cd live-build',
    'S=/tmp/falso.mjs\n          (cd live-build'));
  rechaza('script externo no aprobado en otro paso', w => w.replace('S=services/openclass-live/scripts/publicacion-ci.mjs\n          command -v skopeo',
    'S=otro/publicacion-ci.mjs\n          command -v skopeo'));
  rechaza('clave run duplicada', w => w.replace('        shell: bash\n        run: |\n          set -euo pipefail\n          S=services/openclass-live/scripts/publicacion-ci.mjs\n          (cd live-build',
    '        shell: bash\n        run: echo noop\n        run: |\n          set -euo pipefail\n          S=services/openclass-live/scripts/publicacion-ci.mjs\n          (cd live-build'));
  rechaza('YAML no analizable falla cerrado', w => w + '\n\tbasura: [\n');
});

test('2d. lector YAML estricto: estructura, bloques literales y construcciones prohibidas', () => {
  const d = parseWorkflowYaml('a:\n  - x: 1\n    y: "z"  # c\n  - k: |\n      l1\n      l2\nb: [p, q]\n');
  assert.deepEqual(d, { a: [{ x: '1', y: 'z' }, { k: 'l1\nl2\n' }], b: ['p', 'q'] });
  for (const mal of ['a: 1\na: 2\n', 'a: &x 1\n', 'a: *x\n', 'a: !t 1\n', '\ta: 1\n', 'a: >\n  x\n', 'a: {b: 1}\n'])
    assert.throws(() => parseWorkflowYaml(mal), undefined, JSON.stringify(mal));
  assert.equal(parseWorkflowYaml(workflow).jobs.publish.needs.join(), 'build,approval');
});

test('3. identidad: tag, ref, SHA, HEAD y rama de release deben coincidir exactamente', () => {
  assert.equal(verificarIdentidad(ident()), SHA);
  const otros = { b: 'b'.repeat(40) };
  for (const [caso, o] of Object.entries({
    pr: { event: 'pull_request' }, rama: { refType: 'branch' }, tagOtra: { releaseTag: 'openclass-live-v9.9.9' },
    version: { version: '9.9.9' }, ref: { ref: 'refs/heads/main' }, nombre: { refName: 'otra' },
    workflow: { githubSha: otros.b }, head: { head: otros.b }, tagMovida: { tagCommit: otros.b },
    rama2: { branchTip: otros.b }, corto: { head: 'abc123', githubSha: 'abc123' },
  })) assert.throws(() => verificarIdentidad(ident(o)), undefined, caso);
});

test('4. layout real → lock con evidencia → verificación OCI; digest/plataforma/multiarch fallan', () => conTmp(dir => {
  const l = layout(path.join(dir, 'a'));
  const info = leerLayout(l);
  const lock = lockDe(l);
  assert.equal(lock.manifestDigest, info.manifestDigest);
  assert.equal(lock.sourceCommit, SHA);
  assert.equal(lock.evidence.workflow, '.github/workflows/openclass-live.yml');
  assert.equal(verificarOci(lock, d => readFileSync(path.join(l, 'blobs', 'sha256', d.slice(7)))).imageId, lock.configDigest);
  assert.throws(() => leerLayout(layout(path.join(dir, 'm'), { extraManifest: true })), /único manifiesto/);
  assert.throws(() => crearLock({ ...{ version: VERSION, sourceCommit: SHA, ciRun: '1', layout: l,
    ociArchiveSha256: 'xyz', payloadSha256: 'f'.repeat(64) } }));
  const sinEvidencia = { ...lock }; delete sinEvidencia.evidence;
  assert.throws(() => verificarOci(sinEvidencia, () => Buffer.alloc(0)));
  // La label es solo un dato: una revisión OCI distinta al código aprobado aborta aunque los hashes cuadren.
  const falsa = layout(path.join(dir, 'f'), { sha: 'b'.repeat(40) });
  assert.throws(() => verificarOci(lockDe(falsa), d => readFileSync(path.join(falsa, 'blobs', 'sha256', d.slice(7)))));
}));

test('5. bytes publicables: el tar debe ser el aprobado; lo publicado debe igualar lo construido', () => conTmp(dir => {
  const a = layout(path.join(dir, 'a')), lock = lockDe(a);
  const tar = Buffer.from('tar construido');
  lock.evidence.ociArchiveSha256 = sha256Hex(tar);
  bytesPublicables(lock, tar);
  assert.throws(() => bytesPublicables(lock, Buffer.from('tar reconstruido')), /construido y aprobado/);
  const igual = layout(path.join(dir, 'b'));
  mismosBlobs(a, igual);
  assert.throws(() => mismosBlobs(a, layout(path.join(dir, 'c'), { layerText: 'capa distinta' })), /difieren/);
  // Blob sustituido en el registro: el hash ya no corresponde al digest declarado.
  const corrupto = layout(path.join(dir, 'd'));
  writeFileSync(path.join(corrupto, 'blobs', 'sha256', lock.configDigest.slice(7)), 'sustituido');
  assert.throws(() => verificarOci(lock, d => readFileSync(path.join(corrupto, 'blobs', 'sha256', d.slice(7)))), /Digest OCI/);
}));

test('6. Compose candidato: solo digest literal; sin latest, tags ni build', () => conTmp(dir => {
  const lock = lockDe(layout(path.join(dir, 'a')));
  const out = composeCandidato(base, lock);
  assert.ok(out.includes(`image: ghcr.io/herrerawilliamh/openclass-live@${lock.manifestDigest}`));
  assert.ok(!/latest|build:|LIVE_REVISION/.test(out));
  assert.throws(() => composeCandidato(base, { ...lock, manifestDigest: 'latest' }));
  assert.throws(() => composeCandidato(base, { ...lock, imageRepository: 'ghcr.io/otro/openclass-live' }));
}));

test('7. CLI: identidad sin tag/ref aprobados, workflow y comandos desconocidos cierran con error', () => {
  const run = (args, env = {}) => spawnSync(process.execPath,
    [here('../scripts/publicacion-ci.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
  assert.equal(run(['workflow']).status, 0);
  const pr = run(['identidad'], { GITHUB_EVENT_NAME: 'pull_request', GITHUB_REF_TYPE: 'branch',
    GITHUB_REF: 'refs/pull/1/merge', GITHUB_REF_NAME: '1/merge', RELEASE_TAG: `openclass-live-v${VERSION}`,
    GITHUB_SHA: SHA });
  assert.notEqual(pr.status, 0);
  assert.match(pr.stderr, /PUBLICATION_GATE=FAIL/);
  assert.notEqual(run(['desconocido']).status, 0);
});

test('8. el manifiesto histórico 0.2.0 sigue intacto', () => {
  assert.equal(sha256Hex(readFileSync(here('../releases/0.2.0.json'))),
    'a1003793eececf5f4f06e4c7333ca197c77a05375a825290822fc107eee02359');
});
