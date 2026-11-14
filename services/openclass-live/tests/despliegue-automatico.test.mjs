import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const wf = readFileSync(new URL('../../../.github/workflows/openclass-live-deploy.yml', import.meta.url), 'utf8');
const sh = new URL('../ops/vps/interact-actualizar.sh', import.meta.url);
const script = readFileSync(sh, 'utf8');

test('workflow de despliegue: acciones fijadas, sin build, sin ramas, protegido por variable y entorno', () => {
  for (const m of wf.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) assert.match(m[1], /@[a-f0-9]{40}$/);
  assert.doesNotMatch(wf, /pull_request|self-hosted|:latest|docker (buildx )?build|secrets:\s*inherit/);
  assert.match(wf, /vars\.INTERACT_AUTODEPLOY == 'true'/);
  assert.match(wf, /environment: interact-production/);
  assert.match(wf, /cancel-in-progress: false/);
  assert.match(wf, /startsWith\(github\.event\.workflow_run\.head_branch, 'openclass-live-v'\)/);
  assert.match(wf, /merge-base --is-ancestor/);
  assert.match(wf, /gh attestation verify/);
  assert.match(wf, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(wf, /set -x|StrictHostKeyChecking=no/);
  assert.match(wf, /^permissions:\n  contents: read\n/m);
  assert.doesNotMatch(wf, /: write/);
});

test('script de la VPS: sintaxis, comandos acotados y salvaguardas', () => {
  const r = spawnSync('bash', ['-n', sh.pathname]);
  assert.equal(r.status, 0, r.stderr?.toString());
  assert.match(script, /flock -n/);
  assert.match(script, /--no-build --pull never/);
  assert.match(script, /hash_db/);
  assert.match(script, /restaurar/);
  assert.doesNotMatch(script.replace(/^\s*#.*$/gm, ''), /down -v|--volumes|volume rm|system prune|image prune|docker rm|--remove-orphans|up[^\n]*--build/);
});

test('script de la VPS: rechaza entradas inválidas antes de tocar nada', () => {
  const env = { ...process.env, INTERACT_STACK_DIR: '/nonexistent-stack', INTERACT_STATE_DIR: `/tmp/interact-test-${process.pid}` };
  for (const cmd of ['deploy abc sha256:00', 'rm -rf /', 'deploy']) {
    const r = spawnSync('bash', [sh.pathname], { env: { ...env, SSH_ORIGINAL_COMMAND: cmd }, input: '' });
    assert.notEqual(r.status, 0);
  }
});
