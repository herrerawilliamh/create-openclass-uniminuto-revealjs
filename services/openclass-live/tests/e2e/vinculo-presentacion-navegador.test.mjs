/**
 * Interact 0.4.0 — vínculo desde la presentación local en Chrome real:
 * «Iniciar sesión con su cuenta» muestra el código SIN cambiar de diapositiva, la aprobación (con confirmación)
 * conecta la cuenta, iniciar sesión no crea sala, «Iniciar clase» sí, el foco se conserva y no se filtran credenciales.
 * Variable: OPENCLASS_LIVE_DIST=<dist ya compilado> para no recompilar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { servir } from '../../../../scripts/lib/servidor.mjs';
import { crearApp } from '../../src/app.mjs';
import { leerConfig } from '../../src/config.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const ADMIN = { email: 'admin@willedtech.test', password: 'clave-admin-larga-2026' };
const npm = (cwd, ...a) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SITE_BASE: '/' } });

function prepararCurso(servidorLive) {
  if (process.env.OPENCLASS_LIVE_DIST) return { dist: process.env.OPENCLASS_LIVE_DIST, limpiar: () => {} };
  const temporal = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-vinculo-e2e-')));
  const curso = path.join(temporal, 'curso');
  assert.equal(spawnSync(process.execPath, [path.join(RAIZ, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { stdio: 'inherit' }).status, 0);
  const fase2 = path.join(curso, 'src/plugins/fase2.mjs');
  const original = readFileSync(fase2, 'utf8');
  const activado = original.replace(/activa: false,\n  servidor: '[^']*'/, `activa: true,\n  servidor: '${servidorLive}'`);
  assert.notEqual(activado, original);
  writeFileSync(fase2, activado);
  assert.equal(npm(curso, 'install', '--no-audit', '--no-fund').status, 0);
  assert.equal(npm(curso, 'run', 'build:all').status, 0);
  return { dist: path.join(curso, 'dist'), limpiar: () => rmSync(temporal, { recursive: true, force: true }) };
}
function puertoCompilado(dist) {
  const assets = path.join(dist, 'assets');
  for (const f of readdirSync(assets).filter((n) => n.endsWith('.js'))) {
    const m = /servidor:"http:\/\/127\.0\.0\.1:(\d+)"/.exec(readFileSync(path.join(assets, f), 'utf8'));
    if (m) return m[1];
  }
  return null;
}

test('presentación local: iniciar sesión con la cuenta actualiza el menú al instante y no abre sala hasta «Iniciar clase»', { timeout: 600_000 }, async (t) => {
  let port = Number(process.env.OPENCLASS_LIVE_DIST && puertoCompilado(process.env.OPENCLASS_LIVE_DIST));
  const env = { SESSION_SECRET: 'vin'.repeat(20), TRUST_PROXY: 'false' };
  if (!port) {
    const sondeo = crearApp(leerConfig({ ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {} });
    ({ port } = await sondeo.escuchar(0, '127.0.0.1'));
    await sondeo.cerrar();
  }
  const APP = `http://127.0.0.1:${port}`;
  const { dist, limpiar } = prepararCurso(APP);
  t.after(limpiar);
  const estatico = await servir(dist, { base: '/' });
  t.after(() => estatico.cerrar());
  const DECK = new URL(estatico.url).origin;
  const app = crearApp(leerConfig({ ...env, APP_URL: APP, PRESENTER_ORIGINS: DECK }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());
  app.cuentas.crearSuperusuario(ADMIN);

  const nav = await abrirNavegador({ ancho: 1920, alto: 1080 });
  t.after(() => nav.cerrar());
  const deck = await nav.pagina({ ancho: 1920, alto: 1080 });
  await deck.ir(`${estatico.url}general/`);
  await deck.esperarA(`window.OpenClass?.deck?.isReady?.() && document.querySelector('.oc-live-control')`);
  await deck.evaluar(`window.__abiertas = []; window.open = (u) => { window.__abiertas.push(u); return null; };`);
  const indiceAntes = await deck.evaluar(`JSON.stringify(window.OpenClass.deck.getIndices())`);
  await deck.evaluar(`document.querySelector('.oc-live-control').click()`);
  await deck.esperarA(`!document.querySelector('.oc-live-menu').hidden`);

  const pulsar = (txt) => deck.evaluar(`(() => { const b = [...document.querySelectorAll('.oc-live-menu button')].find((x) => x.textContent.trim() === ${JSON.stringify(txt)} && !x.disabled); if (!b) return false; b.focus(); b.click(); return true; })()`);
  const menuTexto = () => deck.evaluar(`document.querySelector('.oc-live-menu').textContent`);

  // El código aparece sin cambiar de diapositiva.
  assert.ok(await pulsar('Iniciar sesión con su cuenta'));
  await deck.esperarA(`/[A-Z2-9]{4}-[A-Z2-9]{4}/.test(document.querySelector('.oc-live-menu').textContent)`);
  assert.equal(await deck.evaluar(`JSON.stringify(window.OpenClass.deck.getIndices())`), indiceAntes, 'sin cambiar de diapositiva');
  assert.equal(app.almacen.tamano, 0, 'iniciar sesión no crea sala');
  const codigo = /([A-Z2-9]{4}-[A-Z2-9]{4})/.exec(await menuTexto())[1];
  assert.equal(await deck.evaluar(`document.activeElement.closest('.oc-live-menu') !== null`), true, 'el menú conserva el foco');

  // Aprobación con confirmación desde otro contexto.
  const post = (ruta, cuerpo, h = {}) => fetch(`${APP}${ruta}`, { method: 'POST', headers: { origin: APP, 'content-type': 'application/json', ...h }, body: JSON.stringify(cuerpo) });
  const login = await post('/api/auth/login', ADMIN);
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  const { csrf } = await login.json();
  const aprobar = (confirmar) => post('/api/vinculo/aprobar', { codigo, confirmar }, { cookie, 'x-oc-csrf': csrf }).then((r) => r.json());
  assert.equal((await aprobar(false)).pendiente, true);
  assert.ok(!/Cerrar sesión/i.test(await menuTexto()), 'aún sin conectar');
  assert.equal((await aprobar(true)).ok, true);
  await deck.esperarA(`/Iniciar clase/.test(document.querySelector('.oc-live-menu').textContent) && !/[A-Z2-9]{4}-[A-Z2-9]{4}/.test(document.querySelector('.oc-live-menu').textContent)`);
  assert.equal(app.almacen.tamano, 0, 'aprobar no crea sala');

  // «Iniciar clase» sí crea la sala.
  assert.ok(await pulsar('Iniciar clase'));
  await deck.esperarA(`window.OpenClassLive.sala()`);
  assert.equal(app.almacen.tamano, 1);

  // Sin filtraciones de credenciales.
  const f = JSON.parse(await deck.evaluar(`JSON.stringify({ ls: Object.keys(localStorage).concat(Object.keys(sessionStorage)), url: location.href })`));
  assert.deepEqual(f.ls.filter((k) => /credencial|vinculo|token|bearer/i.test(k)), []);
  assert.ok(!f.url.includes(codigo) && !/credencial|secreto/.test(f.url));
});
