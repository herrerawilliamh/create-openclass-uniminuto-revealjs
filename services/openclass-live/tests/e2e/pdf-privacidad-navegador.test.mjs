/**
 * Solución privada fuera de pantalla y del PDF, con OpenClass Live APAGADO y ENCENDIDO (Chrome real).
 * Un curso temporal creado con el CLI (la plantilla y los cursos reales no se tocan) lleva una pregunta
 * con explicación privada, notas, video integrado y una explicación pedagógica pública. Se compila dos
 * veces (LIVE.activa=false y true) y en cada una: vista normal, `?print-pdf`, PDF de Chrome y su texto.
 * Variables: OPENCLASS_EVIDENCIA=<dir> conserva los PDF.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { servir } from '../../../../scripts/lib/servidor.mjs';
import { DIAPOSITIVAS, YOUTUBE_ID } from './build-tech-curso.mjs';
import { inspeccionar } from './pdf-privacidad.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const npm = (cwd, ...a) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SITE_BASE: '/' } });

const PUBLICA = `
---

## Explicación pública
<!-- .slide: id="pdf-publica" class="oc-demo oc-l-text" -->

<div>EXPLICACION-PUBLICA-PDF: esta explicación pedagógica sí se imprime.</div>

<p class="oc-live-explicacion">EXPLICACION-SUELTA-PDF: fuera de una pregunta no es una solución.</p>
`;
const PRIVADAS = ['EXPLICACION-PRIVADA', 'NOTA-ENCUESTA', 'PASO-CERO', 'NOTA-YOUTUBE'];
const PUBLICAS = ['Quién controla la navegación de la presentación', 'La presentación principal', 'El servidor OpenClass Live', 'EXPLICACION-PUBLICA-PDF', 'EXPLICACION-SUELTA-PDF'];

test('PDF y pantalla sin la solución privada, con LIVE apagado y encendido', { timeout: 900_000 }, async (t) => {
  const temporal = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-pdf-')));
  t.after(() => rmSync(temporal, { recursive: true, force: true }));
  const curso = path.join(temporal, 'curso-pdf');
  assert.equal(spawnSync(process.execPath, [path.join(RAIZ, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { stdio: 'inherit' }).status, 0);
  const slides = path.join(curso, 'slides.md');
  const md = readFileSync(slides, 'utf8');
  const corte = md.lastIndexOf('\n---\n');
  writeFileSync(slides, `${md.slice(0, corte)}\n${DIAPOSITIVAS}${PUBLICA}${md.slice(corte)}`);
  assert.equal(npm(curso, 'install', '--no-audit', '--no-fund').status, 0);

  const fase2 = path.join(curso, 'src/plugins/fase2.mjs');
  const original = readFileSync(fase2, 'utf8');
  assert.match(original, /activa: false,\n  servidor: '/, 'la plantilla trae LIVE apagado');
  const dists = {};
  for (const live of [false, true]) {
    writeFileSync(fase2, live ? original.replace(/activa: false,\n  servidor: '[^']*'/, "activa: true,\n  servidor: 'http://127.0.0.1:9'") : original);
    assert.equal(npm(curso, 'run', 'build:all').status, 0, `compila con LIVE.activa=${live}`);
    dists[live] = path.join(temporal, `dist-live-${live}`);
    cpSync(path.join(curso, 'dist'), dists[live], { recursive: true });
  }

  const evidencia = process.env.OPENCLASS_EVIDENCIA ? path.resolve(process.env.OPENCLASS_EVIDENCIA) : temporal;
  mkdirSync(evidencia, { recursive: true });
  const navegador = await abrirNavegador({ ancho: 1280, alto: 720 });
  t.after(() => navegador.cerrar());

  for (const live of [false, true]) {
    const estatico = await servir(dists[live], { base: '/' });
    try {
      const r = await inspeccionar(navegador, `${estatico.url}general/`, { idEncuesta: 'bt-encuesta', pdf: path.join(evidencia, `pdf-live-${live}.pdf`) });
      const caso = `LIVE.activa=${live}`;
      assert.equal(r.vista.live, live, `${caso}: el adaptador Live se carga solo si está activo`);
      assert.equal(r.vista.encuestas, 1, caso);
      assert.equal(r.vista.explicaciones, 1, `${caso}: la explicación existe en el DOM (Build Tech la lee)`);
      assert.equal(r.vista.explicacionesVisibles, 0, `${caso}: la explicación no se ve en la presentación`);
      assert.equal(r.vista.enunciadosVisibles, 1, `${caso}: la pregunta sí se ve`);
      assert.equal(r.dom.explicacionesVisibles, 0, `${caso}: sin explicación en la impresión`);
      assert.equal(r.dom.opcionesVisibles, 4, `${caso}: las opciones se imprimen`);
      assert.equal(r.dom.capasLive, 0, `${caso}: sin capas de Live en el PDF`);
      assert.ok(r.dom.enlacesVideo.includes(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`), `${caso}: el video queda como enlace`);
      assert.equal(r.dom.paginas, r.dom.total, `${caso}: una página por diapositiva`);
      assert.ok(r.bytes > 100_000, `${caso}: el PDF conserva fondos e imágenes`);
      assert.ok(r.texto, 'hay un extractor de texto PDF (pdftotext o pypdf)');
      for (const m of PRIVADAS) assert.ok(!r.texto.texto.includes(m), `${caso}: el texto del PDF no contiene «${m}»`);
      for (const m of PUBLICAS) assert.ok(r.texto.texto.includes(m), `${caso}: el texto del PDF conserva «${m}» (${r.texto.extractor})`);
    } finally { await estatico.cerrar(); }
  }
});
