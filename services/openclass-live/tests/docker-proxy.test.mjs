/**
 * P2 «confianza de proxy» en una topología Docker real y mínima: red de ENTRADA dedicada con IP fija para el proxy.
 *   - «proxy» (IP fija) hace de Traefik: único par TCP de confianza (TRUSTED_PROXY_CIDRS=<IP del proxy>/32).
 *   - «intruso» (IP fija) es otro contenedor de la misma red: no puede falsear su IP ni con X-Forwarded-For
 *     ni con X-Real-Ip, y el acceso directo al servicio cuenta contra SU dirección real.
 *   - Producción sin TRUSTED_PROXY_CIDRS: el servicio no arranca (fallo seguro).
 * Es la validación del PROCEDIMIENTO propuesto en docs/PROXY-ENTRADA.md; no cambia ninguna configuración de la VPS.
 * Solo con INTERACT_TEST_DOCKER=1 (usa la imagen de la versión vigente, construida por docker-redes.test.mjs o
 * `docker compose build`). Proyecto efímero «oc-p-<aleatorio>».
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const docker = (args) => spawnSync('docker', args, { encoding: 'utf8' });
const hay = !docker(['info', '--format', '{{.ServerVersion}}']).status;
const exigir = process.env.INTERACT_TEST_REQUIRE_DOCKER === '1';
const activo = process.env.INTERACT_TEST_DOCKER === '1' || exigir;
const omitir = !activo ? 'defina INTERACT_TEST_DOCKER=1 (integración Docker)' : (!hay && !exigir ? 'Docker no disponible' : false);

const P = `oc-p-${randomBytes(3).toString('hex')}`;
const IMG = `openclass-live:${JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}`;
const clave = randomBytes(18).toString('base64url');
const BASE = `10.${100 + (Number.parseInt(P.slice(-6, -4), 16) % 150)}.77`; // subred de ensayo poco probable de colisionar
const SUBRED = `${BASE}.0/24`;
const IP = { app: `${BASE}.10`, proxy: `${BASE}.2`, intruso: `${BASE}.3` };

const envApp = (extra = []) => ['-e', 'NODE_ENV=production', '-e', 'APP_URL=https://interact.test', '-e', `SESSION_SECRET=${randomBytes(32).toString('hex')}`,
  '-e', `DATABASE_URL=postgres://postgres:${clave}@${P}-pg:5432/postgres`, '-e', 'DB_MIGRATIONS=auto', '-e', 'PRESENTER_ORIGINS=http://localhost:8613',
  '-e', 'TRUST_PROXY=true', ...extra];

// Seis solicitudes al vínculo con las cabeceras indicadas; devuelve los códigos de estado.
function rafaga(desde, cabeceras) {
  const js = `const http=require('http');const h=JSON.parse(process.env.H);const out=[];
    const una=(i)=>new Promise((ok)=>{const hd={origin:'http://localhost:8613','content-type':'application/json',...Object.fromEntries(Object.entries(h).map(([k,v])=>[k,String(v).replace('{i}',i)]))};
      const r=http.request({host:'${IP.app}',port:3000,path:'/api/vinculo/iniciar',method:'POST',headers:hd},(res)=>{res.resume();res.on('end',()=>ok(res.statusCode))});r.on('error',()=>ok(0));r.end('{}')});
    (async()=>{for(let i=0;i<6;i++)out.push(await una(i));console.log(JSON.stringify(out))})()`;
  const r = docker(['run', '--rm', '--network', `${P}_ingreso`, '--ip', IP[desde], '-e', `H=${JSON.stringify(cabeceras)}`, '--entrypoint', 'node', IMG, '-e', js]);
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

before(() => {
  if (omitir) return;
  assert.equal(docker(['network', 'create', '--subnet', SUBRED, `${P}_ingreso`]).status, 0);
  assert.equal(docker(['network', 'create', '--internal', `${P}_db`]).status, 0);
  assert.equal(docker(['run', '-d', '--name', `${P}-pg`, '--network', `${P}_db`, '-e', `POSTGRES_PASSWORD=${clave}`, 'postgres:16.10-alpine']).status, 0);
  for (let i = 0; i < 60; i++) {
    if (!docker(['exec', `${P}-pg`, 'pg_isready', '-q', '-h', '127.0.0.1', '-U', 'postgres']).status) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 2000); // el arranque temporal de initdb reinicia el servidor
  const app = docker(['run', '-d', '--name', `${P}-app`, '--network', `${P}_ingreso`, '--ip', IP.app, ...envApp(['-e', `TRUSTED_PROXY_CIDRS=${IP.proxy}/32`]), IMG]);
  assert.equal(app.status, 0, app.stderr);
  assert.equal(docker(['network', 'connect', `${P}_db`, `${P}-app`]).status, 0);
  for (let i = 0; i < 60; i++) {
    const r = docker(['exec', `${P}-app`, 'node', '-e', "fetch('http://127.0.0.1:3000/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]);
    if (!r.status) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  assert.fail(`el servicio no arrancó:\n${docker(['logs', `${P}-app`]).stdout}${docker(['logs', `${P}-app`]).stderr}`);
});

after(() => {
  if (omitir) return;
  docker(['rm', '-f', `${P}-app`, `${P}-pg`]);
  docker(['network', 'rm', `${P}_ingreso`, `${P}_db`]);
});

test('proxy de confianza con cabecera válida: la IP del cliente sale de X-Forwarded-For y el cupo es 5 por IP', { skip: omitir, timeout: 120_000 }, () => {
  assert.deepEqual(rafaga('proxy', { 'x-forwarded-for': '203.0.113.7' }), [200, 200, 200, 200, 200, 429], 'cinco aceptados y el sexto rechazado para ese cliente');
  assert.deepEqual(rafaga('proxy', { 'x-forwarded-for': '198.51.100.{i}' }).slice(0, 5), [200, 200, 200, 200, 200], 'clientes distintos reenviados por el proxy no comparten cupo');
});

test('par TCP no autorizado: otro contenedor de la red no falsea su IP con X-Forwarded-For (acceso directo)', { skip: omitir, timeout: 120_000 }, () => {
  assert.deepEqual(rafaga('intruso', { 'x-forwarded-for': '192.0.2.{i}' }), [200, 200, 200, 200, 200, 429], 'seis IP inventadas cuentan como la dirección real del intruso');
});

test('X-Real-Ip falsificado no abre cupo nuevo (ni desde el intruso ni desde el proxy)', { skip: omitir, timeout: 120_000 }, () => {
  assert.deepEqual(rafaga('intruso', { 'x-real-ip': '192.0.3.{i}' }), [429, 429, 429, 429, 429, 429], 'el cupo del intruso ya está agotado: X-Real-Ip no lo reinicia');
  // Desde el proxy de confianza, sin X-Forwarded-For válido cuenta la dirección del propio proxy (nunca X-Real-Ip).
  const r = rafaga('proxy', { 'x-real-ip': '192.0.4.{i}' });
  assert.deepEqual(r, [200, 200, 200, 200, 200, 429], 'cuenta contra la IP del par (el proxy), no contra X-Real-Ip');
});

test('producción con TRUST_PROXY=true y sin TRUSTED_PROXY_CIDRS: el servicio no arranca (fallo seguro)', { skip: omitir, timeout: 120_000 }, () => {
  const r = docker(['run', '--rm', '--network', 'none', ...envApp(), IMG]);
  assert.notEqual(r.status, 0);
  assert.match(`${r.stdout}${r.stderr}`, /TRUSTED_PROXY_CIDRS/);
  const ancho = docker(['run', '--rm', '--network', 'none', ...envApp(['-e', 'TRUSTED_PROXY_CIDRS=172.16.0.0/12']), IMG]);
  assert.notEqual(ancho.status, 0);
  assert.match(`${ancho.stdout}${ancho.stderr}`, /demasiado amplio/);
});
