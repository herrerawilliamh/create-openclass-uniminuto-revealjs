import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { leerConfig } from '../src/config.mjs';
import { verificarPassword } from '../src/auth.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));

test('gen-env creates valid secrets privately and never overwrites existing configuration', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'oclive-config-'));
  const destino = path.join(dir, '.env');
  const password = 'synthetic-deployment-test-password';
  const run = () => spawnSync(process.execPath, [path.join(raiz, 'scripts/generar-env.mjs')], {
    input: password, encoding: 'utf8', env: { ...process.env, OPENCLASS_ENV_DESTINO: destino },
  });
  try {
    const result = run();
    assert.equal(result.status, 0, 'environment generation succeeds');
    const contenido = readFileSync(destino, 'utf8');
    const env = Object.fromEntries(contenido.split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^'|'$/g, '')];
    }));
    const config = leerConfig(env);
    assert.equal(config.secreto.length, 64);
    assert.ok(verificarPassword(password, config.hashDocente));
    assert.ok(!result.stdout.includes(config.secreto) && !result.stderr.includes(config.secreto));
    assert.ok(!result.stdout.includes(config.hashDocente) && !result.stderr.includes(config.hashDocente));
    assert.ok(!result.stdout.includes(password) && !result.stderr.includes(password));
    if (process.platform !== 'win32') assert.equal(statSync(destino).mode & 0o777, 0o600);
    assert.notEqual(run().status, 0);
    assert.equal(readFileSync(destino, 'utf8'), contenido);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Dockhand Git stack accepts explicit environment without requiring an env_file', () => {
  const compose = readFileSync(path.join(raiz, 'docker-compose.yml'), 'utf8');
  assert.doesNotMatch(compose, /^\s*env_file:/m);
  assert.match(compose, /context: \./);
  assert.match(compose, /dockerfile: Dockerfile/);
  assert.match(compose, /SESSION_SECRET: \$\{SESSION_SECRET:\?/);
  assert.match(compose, /ADMIN_PASSWORD_HASH: \$\{ADMIN_PASSWORD_HASH:\?/);
  assert.match(compose, /APP_URL: \$\{APP_URL:\?/);
  assert.match(compose, /Host\(`\$\{APP_HOST\}`\)/);
  assert.match(compose, /certresolver=myresolver/);
  assert.match(compose, /web:\s*\n\s+external: true/);
  assert.doesNotMatch(compose, /^\s*ports:/m);
});
