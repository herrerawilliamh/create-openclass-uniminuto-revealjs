/**
 * Curso temporal para la prueba de Build Tech (lo crea el CLI del repositorio maestro; la plantilla y los
 * cursos reales no se tocan). Activa LIVE en SU copia de fase2.mjs y añade a SU slides.md diapositivas con
 * notas marcadas, anclas, fragmentos, un intento de inyección en las notas, video HTML5, YouTube y encuesta.
 *   node tests/e2e/build-tech-curso.mjs <carpeta> <APP_URL>   → crea, instala y compila (deja dist/)
 *   node tests/e2e/build-tech-curso.mjs <carpeta> --recompilar → copia template/src (salvo fase2.mjs) y compila
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const npm = (cwd, ...a) => spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', a, { cwd, stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SITE_BASE: '/' } });

// Video de demostración oficial de la documentación de la API IFrame de YouTube.
export const YOUTUBE_ID = 'M7lc1UVf-VE';

export const DIAPOSITIVAS = `
---

## Notas ancladas
<!-- .slide: id="bt-notas" class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<p data-oc-nota="diagrama">Arquitectura de la sala</p>

- Primer paso visible
<!-- .element: class="fragment" -->
- Segundo paso visible
<!-- .element: class="fragment" -->

Notes:
[[0]] PASO-CERO: presentar la arquitectura antes de los fragmentos.

[[1]] PASO-UNO: comentar el primer paso.

[[2]] PASO-DOS: cerrar con el segundo paso.

[[#diagrama]] ANCLA-DIAGRAMA: señalar el diagrama de la sala.

Texto **importante** con \`codigo\` y <img src="x" onerror="window.__xss = 1"><script>window.__xss = 2</script> INYECCION-NEUTRA.

---

## Video local
<!-- .slide: id="bt-video" class="oc-demo oc-l-multimedia" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<div data-oc-nota="video"><video controls preload="metadata" src="{{BASE_URL}}videos/demo-openclass.webm" aria-label="Video de prueba Build Tech"></video></div>

Notes:
[[#video:reproducir]] NOTA-VIDEO: reproducir el video cuando el grupo esté atento.

---

## Video de YouTube
<!-- .slide: id="bt-youtube" class="oc-demo oc-l-multimedia" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<iframe title="Video de YouTube de prueba" src="https://www.youtube.com/embed/${YOUTUBE_ID}" allowfullscreen style="width:100%;height:100%;border:0"></iframe>

Notes:
NOTA-YOUTUBE: controlar el video desde la cabina.

---

## Pregunta de control
<!-- .slide: id="bt-encuesta" class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
<p class="oc-live-enunciado">¿Quién controla la navegación de la presentación?</p>
<ol class="oc-live-opciones">
<li>La ventana privada, directamente</li>
<li>La presentación principal</li>
<li>Cada estudiante</li>
<li>El servidor OpenClass Live</li>
</ol>
<div class="oc-live-explicacion">EXPLICACION-PRIVADA: la presentación principal es la única autoridad; la ventana privada solo envía órdenes.</div>
</div>

Notes:
NOTA-ENCUESTA: preguntar antes de revelar.
`;

function compilar(curso) {
  assert.equal(npm(curso, 'run', 'build:all').status, 0, 'el curso temporal compila');
}

/** Copia el src de la plantilla maestra al curso temporal, conservando su fase2.mjs (LIVE activado). */
export function recompilar(curso) {
  const fase2 = path.join(curso, 'src/plugins/fase2.mjs');
  const activado = readFileSync(fase2, 'utf8');
  cpSync(path.join(RAIZ, 'template/src'), path.join(curso, 'src'), { recursive: true, force: true });
  writeFileSync(fase2, activado);
  compilar(curso);
  return path.join(curso, 'dist');
}

export function crearCurso(curso, servidorLive) {
  const crear = spawnSync(process.execPath, [path.join(RAIZ, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { stdio: 'inherit' });
  assert.equal(crear.status, 0, 'el CLI crea el curso temporal');
  const fase2 = path.join(curso, 'src/plugins/fase2.mjs');
  const original = readFileSync(fase2, 'utf8');
  const activado = original.replace(/activa: false,\n  servidor: '[^']*'/, `activa: true,\n  servidor: '${servidorLive}'`);
  assert.notEqual(activado, original, 'LIVE se activa en la copia temporal');
  writeFileSync(fase2, activado);
  const slides = path.join(curso, 'slides.md');
  const md = readFileSync(slides, 'utf8');
  const corte = md.lastIndexOf('\n---\n');
  writeFileSync(slides, `${md.slice(0, corte)}\n${DIAPOSITIVAS}${md.slice(corte)}`);
  assert.equal(npm(curso, 'install', '--no-audit', '--no-fund').status, 0);
  compilar(curso);
  return path.join(curso, 'dist');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const [curso, segundo] = process.argv.slice(2);
  assert.ok(curso, 'indique la carpeta del curso temporal');
  if (segundo === '--recompilar') { assert.ok(existsSync(curso)); console.log(`DIST=${recompilar(curso)}`); }
  else console.log(`DIST=${crearCurso(curso, segundo)}`);
}
