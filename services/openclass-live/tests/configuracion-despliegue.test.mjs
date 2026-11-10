import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { leerConfig } from '../src/config.mjs';

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
    assert.equal(config.hashDocente, '', 'sin contraseña compartida por defecto');
    assert.equal(config.db.migraciones, 'verificar', 'producción no migra desde el servicio');
    assert.match(env.DATABASE_URL, /^postgres:\/\/interact_app:[A-Za-z0-9_-]{43}@interact-db:5432\/interact$/);
    // Cuatro contraseñas distintas, cada una coherente con su URL; ningún marcador CAMBIAR queda en el archivo.
    const pw = ['POSTGRES_ADMIN_PASSWORD', 'INTERACT_DB_MIGRATOR_PASSWORD', 'INTERACT_DB_APP_PASSWORD', 'INTERACT_DB_BACKUP_PASSWORD'].map((k) => env[k]);
    assert.equal(new Set(pw).size, 4);
    assert.ok(env.DATABASE_URL.includes(env.INTERACT_DB_APP_PASSWORD) && env.DATABASE_MIGRATION_URL.includes(env.INTERACT_DB_MIGRATOR_PASSWORD));
    assert.ok(env.DATABASE_BACKUP_URL.includes(env.INTERACT_DB_BACKUP_PASSWORD) && env.DATABASE_ADMIN_URL.includes(env.POSTGRES_ADMIN_PASSWORD));
    assert.doesNotMatch(contenido, /CAMBIAR/);
    for (const p of pw) assert.ok(!result.stdout.includes(p) && !result.stderr.includes(p));
    assert.ok(!result.stdout.includes(config.secreto) && !result.stderr.includes(config.secreto));
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
  assert.match(compose, /ADMIN_PASSWORD_HASH: \$\{ADMIN_PASSWORD_HASH:-\}/);
  assert.match(compose, /DATABASE_URL: \$\{DATABASE_URL:\?/);
  assert.match(compose, /DB_MIGRATIONS: verificar/);
  assert.match(compose, /interact-db:\n\s+internal: true/);
  assert.match(compose, /interact-pgdata:\/var\/lib\/postgresql\/data/);
  assert.doesNotMatch(compose, /DATA_DIR|sqlite/i);
  assert.doesNotMatch(compose, /5432:/, 'el puerto de PostgreSQL nunca se publica');
  // El servicio no recibe credenciales de administración, migraciones ni respaldo.
  const app = compose.slice(compose.indexOf('  openclass-live:\n'));
  assert.doesNotMatch(app.slice(0, app.indexOf('    labels:')), /DATABASE_(ADMIN|MIGRATION|BACKUP)_URL|POSTGRES_ADMIN_PASSWORD|INTERACT_DB_/);
  assert.match(compose, /APP_URL: \$\{APP_URL:\?/);
  assert.match(compose, /Host\(`\$\{APP_HOST\}`\)/);
  assert.match(compose, /certresolver=myresolver/);
  assert.match(compose, /web:\s*\n\s+external: true/);
  assert.doesNotMatch(compose, /^\s*ports:/m);
});
