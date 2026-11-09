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
    const archive = path.join(dir, 'despliegue/openclass-live-0.3.0.tar.gz');
    const first = readFileSync(archive);
    utimesSync(path.join(dir, 'src/server.mjs'), new Date(), new Date());
    assert.equal(run().status, 0);
    assert.deepEqual(readFileSync(archive), first, 'mtime no altera el artefacto');
    const listing = spawnSync('tar', ['-tzf', path.relative(dir, archive).split(path.sep).join('/')], { cwd: dir, encoding: 'utf8' });
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

test('empaquetador oficial: dos empaquetados independientes dan el mismo SHA-256 y coinciden con el manifiesto', async () => {
  const { createHash } = await import('node:crypto');
  const { huellaGit } = await import('../scripts/huella.mjs');
  const { mkdirSync, readdirSync, statSync } = await import('node:fs');
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const empaquetar = () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'oclive-repro-'));
    for (const f of ['package.json','package-lock.json','Dockerfile','.dockerignore','.env.example','docker-compose.yml','src','public','scripts']) {
      cpSync(new URL(f, raiz), path.join(dir, f), { recursive: true });
    }
    assert.equal(spawnSync(process.execPath, ['scripts/empaquetar-despliegue.mjs'], { cwd: dir, encoding: 'utf8' }).status, 0);
    return dir;
  };
  const a = empaquetar(), b = empaquetar();
  try {
    const nombre = 'despliegue/openclass-live-0.3.0.tar.gz';
    const ba = readFileSync(path.join(a, nombre)), bb = readFileSync(path.join(b, nombre));
    assert.equal(sha(ba), sha(bb), 'mismo árbol, mismo SHA-256');
    assert.equal(ba[9], 3, 'gzip: sistema operativo normalizado (Unix)');
    assert.equal(ba.readUInt32LE(4), 0, 'gzip: sin fecha');
    const manifiesto = JSON.parse(readFileSync(new URL('releases/0.3.0.json', raiz), 'utf8'));
    assert.equal(sha(ba), manifiesto.archiveSha256, 'el artefacto regenerado coincide con releases/0.3.0.json');
    const out = path.join(a, 'extraido');
    mkdirSync(out);
    assert.equal(spawnSync('tar', ['-xzf', nombre, '-C', 'extraido'], { cwd: a }).status, 0);
    const raizExtraida = path.join(out, 'openclass-live-0.3.0');
    const encontrados = [];
    (function walk(d) {
      for (const n of readdirSync(d)) {
        const p = path.join(d, n);
        if (statSync(p).isDirectory()) walk(p); else encontrados.push(path.relative(raizExtraida, p).split(path.sep).join('/'));
      }
    })(raizExtraida);
    assert.deepEqual(encontrados.sort(), manifiesto.files.map((f) => f.path).sort(), 'lista exacta de archivos');
    for (const f of manifiesto.files) {
      const bytes = readFileSync(path.join(raizExtraida, f.path));
      assert.equal(sha(bytes), f.sha256, `sha256 interno: ${f.path}`);
      assert.equal(huellaGit(f.path, bytes), f.gitSha256, `gitSha256 interno: ${f.path}`);
    }
    const lista = spawnSync('tar', ['-tzvf', nombre], { cwd: a, encoding: 'utf8' }).stdout;
    assert.match(lista, /root\/root/, 'propietarios normalizados');
  } finally { rmSync(a, { recursive: true, force: true }); rmSync(b, { recursive: true, force: true }); }
});
