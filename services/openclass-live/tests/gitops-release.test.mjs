import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('gate GitOps admite checkout LF y rechaza payload, Compose o SHA divergentes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'oclive-gitops-'));
  try {
    for (const f of ['package.json', 'package-lock.json', 'src', 'public', 'Dockerfile',
      '.dockerignore', '.env.example', 'docker-compose.yml', 'docker-compose.gitops.yml', 'scripts', 'releases']) {
      cpSync(new URL(`../${f}`, import.meta.url), path.join(dir, f), { recursive: true });
    }
    const run = (revision = 'a'.repeat(40)) => spawnSync(process.execPath,
      ['scripts/verificar-gitops.mjs'], { cwd: dir, encoding: 'utf8', env: { ...process.env, LIVE_REVISION: revision } });
    const manifest = JSON.parse(readFileSync(path.join(dir, 'releases/0.2.0.json')));
    for (const { path: f } of manifest.files) {
      const p = path.join(dir, f);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    }
    assert.equal(run().status, 0, 'checkout Linux conserva la procedencia normalizada');
    assert.notEqual(run('latest').status, 0, 'se exige SHA completo');
    const payload = path.join(dir, 'src/server.mjs'), original = readFileSync(payload);
    writeFileSync(payload, Buffer.concat([original, Buffer.from('\n// unexpected payload\n')]));
    assert.notEqual(run().status, 0, 'un cambio de ejecución necesita nueva aprobación');
    writeFileSync(payload, original);
    const compose = path.join(dir, 'docker-compose.gitops.yml'), yaml = readFileSync(compose);
    writeFileSync(compose, yaml.toString().replace('pull_policy: never', 'pull_policy: always'));
    assert.notEqual(run().status, 0, 'no admite reemplazar la imagen por un pull');
    writeFileSync(compose, yaml);
    assert.equal(run().status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
