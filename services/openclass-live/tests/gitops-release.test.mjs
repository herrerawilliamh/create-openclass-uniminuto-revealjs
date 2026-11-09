import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { esBinario } from '../scripts/huella.mjs';

test('gate GitOps admite checkout LF y rechaza payload, Compose o SHA divergentes', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'oclive-gitops-'));
  try {
    for (const f of ['package.json', 'package-lock.json', 'src', 'public', 'Dockerfile',
      '.dockerignore', '.env.example', 'docker-compose.yml', 'docker-compose.gitops.yml', 'scripts', 'releases']) {
      cpSync(new URL(`../${f}`, import.meta.url), path.join(dir, f), { recursive: true });
    }
    const run = (revision = 'a'.repeat(40)) => spawnSync(process.execPath,
      ['scripts/verificar-gitops.mjs'], { cwd: dir, encoding: 'utf8', env: { ...process.env, LIVE_REVISION: revision } });
    const manifest = JSON.parse(readFileSync(path.join(dir, 'releases/0.3.0.json')));
    for (const { path: f } of manifest.files) {
      if (esBinario(f)) continue; // los binarios nunca se reescriben como texto
      const p = path.join(dir, f);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/\r\n/g, '\n'));
    }
    { const r0 = run(); assert.equal(r0.status, 0, 'checkout Linux conserva la procedencia normalizada ' + r0.stderr.slice(0, 600)); }
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

test('binarios: los cinco WOFF2 coinciden con sus bytes y un byte alterado hace FALLAR el gate', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'oclive-bin-'));
  try {
    for (const f of ['package.json', 'package-lock.json', 'src', 'public', 'Dockerfile',
      '.dockerignore', '.env.example', 'docker-compose.yml', 'docker-compose.gitops.yml', 'scripts', 'releases']) {
      cpSync(new URL(`../${f}`, import.meta.url), path.join(dir, f), { recursive: true });
    }
    const manifest = JSON.parse(readFileSync(path.join(dir, 'releases/0.3.0.json')));
    const fuentes = manifest.files.filter((f) => f.path.endsWith('.woff2'));
    assert.equal(fuentes.length, 5);
    for (const f of fuentes) {
      const h = createHash('sha256').update(readFileSync(path.join(dir, f.path))).digest('hex');
      assert.equal(f.sha256, h, `sha256 de bytes: ${f.path}`);
      assert.equal(f.gitSha256, h, `un binario no se normaliza: ${f.path}`);
    }
    const run = () => spawnSync(process.execPath, ['scripts/verificar-gitops.mjs'],
      { cwd: dir, encoding: 'utf8', env: { ...process.env, LIVE_REVISION: 'a'.repeat(40) } });
    assert.equal(run().status, 0);
    const woff = path.join(dir, fuentes[0].path), original = readFileSync(woff);
    const mutado = Buffer.from(original); mutado[mutado.length >> 1] ^= 0x01;
    writeFileSync(woff, mutado);
    assert.notEqual(run().status, 0, 'un byte distinto en un WOFF2 debe provocar FAIL');
    writeFileSync(woff, original);
    assert.equal(run().status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
