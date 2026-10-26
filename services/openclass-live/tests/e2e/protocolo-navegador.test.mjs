/**
 * Negociación de protocolo en Chrome real (Node >= 22): la presentación v0.2 contra el servicio v0.1
 * REAL (src/ y public/ del commit 37c15cd, extraídos con git a una carpeta temporal y servidos con las
 * mismas dependencias). El adaptador recibe una `sesion` sin versión, corta la conexión, no recuerda la
 * clave, muestra «La presentación y OpenClass Live utilizan versiones diferentes…» y no envía ninguna
 * encuesta; «Iniciar votación» no aparece. (La combinación inversa, adaptador v0.1 contra servicio v0.2,
 * está en tests/integracion.test.mjs con el handshake exacto del v0.1: `auth: { clave }`.)
 * Variables: OPENCLASS_LIVE_DIST=<dist compilado con LIVE activo> (p. ej., el que deja
 * OPENCLASS_LIVE_CONSERVAR=1 en live-navegador.test.mjs); sin él, compila un curso temporal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { io as cliente } from 'socket.io-client';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { servir } from '../../../../scripts/lib/servidor.mjs';
import { evento, pedir, peticion } from '../ayuda.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SERVICIO = path.join(RAIZ, 'services/openclass-live');
const COMMIT_V01 = '37c15cd';
const PASSWORD = 'clave-e2e-protocolo-openclass';
const MENSAJE = 'La presentación y OpenClass Live utilizan versiones diferentes. Actualice el servicio OpenClass Live.';
const npm = (cwd, ...a) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SITE_BASE: '/' } });

const ENCUESTA = `
---

## Pregunta en vivo
<!-- .slide: id="encuesta-live" class="oc-demo oc-l-text" -->

<div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
<p class="oc-live-enunciado">¿Qué método une un socket a una sala?</p>
<ol class="oc-live-opciones"><li>socket.enter()</li><li>socket.join()</li></ol>
<div class="oc-live-explicacion">EXPLICACION-PROTOCOLO-PRIVADA</div>
</div>
`;

function puertoCompilado(dist) {
  for (const f of readdirSync(path.join(dist, 'assets')).filter((n) => n.endsWith('.js'))) {
    const m = /servidor:"http:\/\/127\.0\.0\.1:(\d+)"/.exec(readFileSync(path.join(dist, 'assets', f), 'utf8'));
    if (m) return Number(m[1]);
  }
  return null;
}

function compilarCurso(temporal, servidor) {
  const curso = path.join(temporal, 'curso');
  assert.equal(spawnSync(process.execPath, [path.join(RAIZ, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { stdio: 'inherit' }).status, 0);
  const fase2 = path.join(curso, 'src/plugins/fase2.mjs');
  const original = readFileSync(fase2, 'utf8');
  const activado = original.replace(/activa: false,\n  servidor: '[^']*'/, `activa: true,\n  servidor: '${servidor}'`);
  assert.notEqual(activado, original, 'LIVE se activa en la copia temporal');
  writeFileSync(fase2, activado);
  const slides = path.join(curso, 'slides.md');
  const md = readFileSync(slides, 'utf8');
  const corte = md.lastIndexOf('\n---\n');
  writeFileSync(slides, `${md.slice(0, corte)}\n${ENCUESTA}${md.slice(corte)}`);
  assert.equal(npm(curso, 'install', '--no-audit', '--no-fund').status, 0);
  assert.equal(npm(curso, 'run', 'build:all').status, 0);
  return path.join(curso, 'dist');
}

/** Extrae el servicio v0.1 del historial de Git y le enlaza las dependencias actuales (mismas versiones). */
function extraerV01(destino) {
  const archivo = path.join(destino, 'v01.tar');
  const r = spawnSync('git', ['archive', '--format=tar', '-o', archivo, COMMIT_V01, 'services/openclass-live/src', 'services/openclass-live/public'], { cwd: RAIZ });
  if (r.status !== 0) return null;
  // Ruta relativa: el tar de GNU (Git para Windows) tomaría «C:» por un host remoto.
  assert.equal(spawnSync('tar', ['-xf', 'v01.tar'], { cwd: destino }).status, 0, 'tar extrae el servicio v0.1');
  const raiz = path.join(destino, 'services/openclass-live');
  assert.equal(readFileSync(path.join(raiz, 'src/sockets.mjs'), 'utf8').includes('presentadorCompatible'), false, 'es el servicio v0.1, sin negociación');
  const enlace = spawnSync(process.platform === 'win32' ? 'cmd' : 'ln', process.platform === 'win32'
    ? ['/c', 'mklink', '/J', path.join(raiz, 'node_modules'), path.join(SERVICIO, 'node_modules')]
    : ['-s', path.join(SERVICIO, 'node_modules'), path.join(raiz, 'node_modules')]);
  assert.equal(enlace.status, 0, 'dependencias enlazadas');
  writeFileSync(path.join(raiz, 'package.json'), JSON.stringify({ type: 'module' }));
  return raiz;
}

test('protocolo: la presentación v0.2 detecta un servicio v0.1 y no envía nada', { timeout: 900_000 }, async (t) => {
  const temporal = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-protocolo-e2e-')));
  t.after(() => rmSync(temporal, { recursive: true, force: true }));
  const v01 = extraerV01(temporal);
  if (!v01) return t.skip(`el commit ${COMMIT_V01} no está en este clon (¿clon superficial?)`);
  const { crearApp } = await import(pathToFileURL(path.join(v01, 'src/app.mjs')).href);
  const { hashPassword } = await import(pathToFileURL(path.join(v01, 'src/auth.mjs')).href);
  const { leerConfig } = await import(pathToFileURL(path.join(v01, 'src/config.mjs')).href);

  let dist = process.env.OPENCLASS_LIVE_DIST;
  let port = dist && puertoCompilado(dist);
  if (!dist) {
    const sondeo = crearApp(leerConfig({ APP_URL: 'http://127.0.0.1:1', SESSION_SECRET: 'x'.repeat(48), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD) }), { log: () => {} });
    ({ port } = await sondeo.escuchar(0, '127.0.0.1'));
    await sondeo.cerrar();
    dist = compilarCurso(temporal, `http://127.0.0.1:${port}`);
  }
  assert.ok(port, 'puerto del servicio compilado en la presentación');
  const APP = `http://127.0.0.1:${port}`;
  const estatico = await servir(dist, { base: '/' });
  t.after(() => estatico.cerrar());
  const DECK = new URL(estatico.url).origin;

  const app = crearApp(leerConfig({ APP_URL: APP, SESSION_SECRET: 'v01'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), PRESENTER_ORIGINS: DECK, TRUST_PROXY: 'false' }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());

  // Sala y clave de presentador desde el panel del servicio v0.1 (cliente Socket.IO con la cookie).
  const login = await peticion(`${APP}/api/docente/login`, { metodo: 'POST', cuerpo: { password: PASSWORD }, origen: APP });
  assert.equal(login.estado, 200);
  const doc = cliente(`${APP}/docente`, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: { origin: APP, cookie: login.cabeceras['set-cookie'][0].split(';')[0] } });
  t.after(() => doc.disconnect());
  const sesionPanel = await evento(doc, 'sesion');
  assert.equal(sesionPanel.protocolo, undefined, 'el servicio v0.1 no declara versión');
  const { sala, clave } = await pedir(doc, 'sala:crear', { titulo: 'Protocolo v0.1' });

  const navegador = await abrirNavegador({ ancho: 1920, alto: 1080 });
  t.after(() => navegador.cerrar());
  const deck = await navegador.pagina({ ancho: 1920, alto: 1080 });
  const tramas = [];
  deck.cdp.oyentes.add((m) => { if (m.sessionId === deck.sessionId && m.method === 'Network.webSocketFrameSent') tramas.push(m.params.response.payloadData); });
  await deck.send('Network.enable');
  await deck.ir(`${estatico.url}general/`);
  await deck.esperarA(`window.OpenClass?.deck?.isReady?.() && document.querySelector('.oc-live-control')`);
  const indice = await deck.evaluar(`window.OpenClass.deck.getSlides().findIndex((s) => s.querySelector('.oc-live-encuesta'))`);
  assert.ok(indice > 0, 'diapositiva con encuesta');
  await deck.evaluar(`window.OpenClass.deck.slide(${indice})`);
  await deck.evaluar(`document.querySelector('.oc-live-control').click()`);
  await deck.esperarA(`document.getElementById('oc-live-clave')`);
  await deck.evaluar(`document.getElementById('oc-live-clave').value = ${JSON.stringify(clave)}; document.getElementById('oc-live-clave').form.requestSubmit();`);
  await deck.esperarA(`document.querySelector('.oc-live-menu').textContent.includes(${JSON.stringify(MENSAJE)})`);

  assert.equal(await deck.evaluar(`window.OpenClassLive.momento()`), 'desconectado', 'acciones bloqueadas: sin sala');
  assert.equal(await deck.evaluar(`sessionStorage.getItem('openclass-live:clave')`), null, 'no recuerda la clave de un servicio incompatible');
  assert.equal(await deck.evaluar(`[...document.querySelectorAll('.oc-live-menu button')].some((b) => /Iniciar votación/.test(b.textContent))`), false, 'sin «Iniciar votación»');
  assert.equal(await deck.evaluar(`document.querySelectorAll('.oc-live-participa').length`), 0, 'sin QR de una sala no confirmada');
  // La API de Build Tech tampoco puede ordenar acciones.
  assert.equal(await deck.evaluar(`window.OpenClass.deck.getPlugin('openclass-live').buildTech.ordenar('iniciar').then((r) => r.ok)`), false);
  await new Promise((r) => setTimeout(r, 800));
  const salido = tramas.join('\n');
  assert.ok(!/encuesta:|sala:ajustar/.test(salido), 'ningún evento de encuesta salió hacia el servicio v0.1');
  assert.ok(!salido.includes('EXPLICACION-PROTOCOLO-PRIVADA') && !/"correctas"/.test(salido), 'ni la solución');
  assert.match(salido, /"protocolo":2/, 'el handshake declaró la versión');
  assert.equal((await pedir(doc, 'sala:seguir', { salaId: sala.id })).estado.historial.length, 0, 'el servicio v0.1 no recibió encuestas');
});
