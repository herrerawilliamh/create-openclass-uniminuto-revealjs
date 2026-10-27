import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { crearApp } from '../src/app.mjs';
import { leerConfig } from '../src/config.mjs';
import { hashPassword } from '../src/auth.mjs';

const raiz = new URL('../', import.meta.url);

test('paquete reproducible, aislado y con versiones coherentes; rechaza archivos ajenos', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'oclive-release-'));
  try {
    for (const f of ['package.json','package-lock.json','Dockerfile','.dockerignore','.env.example','docker-compose.yml','src','public','scripts']) {
      cpSync(new URL(f, raiz), path.join(dir, f), { recursive: true });
    }
    writeFileSync(path.join(dir, '.env'), 'PRIVATE_SENTINEL=DO_NOT_PACKAGE');
    const run = () => spawnSync(process.execPath, ['scripts/empaquetar-despliegue.mjs'], { cwd: dir, encoding: 'utf8' });
    assert.equal(run().status, 0);
    const archive = path.join(dir, 'despliegue/openclass-live-0.2.0.tar.gz');
    const first = readFileSync(archive);
    utimesSync(path.join(dir, 'src/server.mjs'), new Date(), new Date());
    assert.equal(run().status, 0);
    assert.deepEqual(readFileSync(archive), first, 'mtime no altera el artefacto');
    const listing = spawnSync('tar', ['-tzf', archive], { encoding: 'utf8' });
    assert.equal(listing.status, 0);
    assert.doesNotMatch(listing.stdout, /(?:\/\.env\n|\.md\n|node_modules|tests\/)/);
    writeFileSync(path.join(dir, 'public/private.md'), 'PRIVATE_SENTINEL');
    assert.notEqual(run().status, 0);
    rmSync(path.join(dir, 'public/private.md'));
    const lock = JSON.parse(readFileSync(path.join(dir, 'package-lock.json')));
    lock.packages[''].version = '0.1.0';
    writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify(lock));
    assert.notEqual(run().status, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('verificador de promoción completa HTTP, WS y protocolo 2 con el servicio real', async () => {
  const reserva = createServer();
  await new Promise((resolve) => reserva.listen(0, '127.0.0.1', resolve));
  const port = reserva.address().port;
  await new Promise((resolve) => reserva.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const password = 'synthetic-release-verifier-password';
  const app = crearApp(leerConfig({ APP_URL: base, SESSION_SECRET: 'synthetic-release-signing-secret-for-local-test', ADMIN_PASSWORD_HASH: hashPassword(password) }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['scripts/verificar-despliegue.mjs', base], { cwd: raiz, env: { ...process.env, OCLIVE_PASSWORD: password }, timeout: 45000 });
      let output = '';
      child.stdout.on('data', (b) => { output += b; });
      child.stderr.on('data', (b) => { output += b; });
      child.on('error', reject);
      child.on('close', (code) => resolve({ code, output }));
    });
    assert.equal(result.code, 0, result.output);
    assert.match(result.output, /PASS  protocolo v2 anunciado/);
    assert.equal(app.almacen.listarSalas().length, 0);
  } finally { await app.cerrar(); }
});
