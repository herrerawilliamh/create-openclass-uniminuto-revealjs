// Documentación docente P3 (OpenClass 1.1.0) tal como la distribuye el generador: un curso creado con el CLI
// debe traer la guía web con el capítulo «Diseñar la semana», el prompt maestro pedagógico y el contrato técnico
// sin instrucciones contradictorias, y el paquete npm debe incluirlos. No instala dependencias.
// Ejecutar con `npm run test:docente` (también en CI: .github/workflows/ci.yml).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
let temp, curso;
const leer = (f) => readFileSync(path.join(curso, f), 'utf8');
// Texto visible de un capítulo de la guía, sin etiquetas ni entidades.
const texto = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
function capitulo(guia, id) {
 const i = guia.indexOf(`id="${id}"`);
 assert.ok(i > 0, `falta el capítulo #${id}`);
 return texto(guia.slice(guia.lastIndexOf('<section', i), guia.indexOf('</section>', i)));
}

before(() => {
 temp = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-docente-p3-')));
 curso = path.join(temp, 'curso');
 const r = spawnSync(process.execPath, [path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs'), curso], { encoding: 'utf8' });
 assert.equal(r.status, 0, r.stdout + r.stderr);
});
after(() => { if (temp) rmSync(temp, { recursive: true, force: true }); });

test('[P3] guía web: 20 capítulos numerados, índice y anclas internas válidos', () => {
 const guia = leer('guia/index.html');
 const ids = [...guia.matchAll(/<section class="chapter" data-search id="([^"]+)"/g)].map((m) => m[1]);
 assert.equal(ids.length, 20);
 assert.equal(new Set(ids).size, 20, 'ids únicos');
 assert.equal(ids[ids.indexOf('semanas') + 1], 'pedagogia', 'Diseñar la semana sigue a Semanas');
 assert.deepEqual([...guia.matchAll(/<span class="chapter-number">(\d+)<\/span>/g)].map((m) => +m[1]), ids.map((_, i) => i + 1));
 assert.deepEqual([...guia.matchAll(/class="toc-link" href="#([^"]+)"/g)].map((m) => m[1]), ids, 'índice en el orden de los capítulos');
 const todos = new Set([...guia.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
 for (const [, ancla] of guia.matchAll(/href="#([^"]+)"/g)) assert.ok(todos.has(ancla), `ancla rota #${ancla}`);
 assert.match(guia, /<span>20 capítulos<\/span>/);
});

test('[P3] guía web: capítulo «Diseñar la semana» cubre el contrato pedagógico completo', () => {
 const c = capitulo(leer('guia/index.html'), 'pedagogia');
 const requisitos = {
  'ruta de la semana': /Ruta de la semana/,
  'qué se aprenderá': /Qué se aprenderá/,
  'relación con semanas anteriores': /relaciona con las semanas anteriores/,
  'qué podrá demostrar': /podrá demostrar/,
  'consulta posterior': /consultar la presentación después/,
  'sin resultados inventados': /no inventes resultados institucionales/,
  'contrato weeks[].opening': /weeks\[\]\.opening/,
  'cuatro formas de participación': /respuesta-individual[\s\S]*discusion-parejas[\s\S]*hipotesis-grupal[\s\S]*propuesta-caso/,
  'duración de 1 a 3': /entre 1 y 3/,
  'no sobrescribir lo elaborado': /reemplaza el archivo completo de la semana N/,
  'Zoom o Teams': /Actividades para Zoom o Teams/,
  'alternativa por chat u oral': /alternativa por chat u oral/,
  'tres recorridos': /Sincrónico por Zoom o Teams[\s\S]*Asincrónico guiado[\s\S]*Autónomo/,
  'no son modalidades oficiales': /no los describas como modalidades institucionales oficiales/,
  'fuentes verificables': /fuentes oficiales, académicas y actuales[\s\S]*PENDIENTE DE VERIFICAR/,
  'videos de 0 a 3': /de cero a tres por semana/,
  'videos de 5 a 10 minutos': /de 5 a 10 minutos/,
  'un video por diapositiva': /ocupa su propia diapositiva/,
  'verificar actividades': /Elaborar y verificar actividades/,
  'Notes públicas': /Notes: guion docente público/,
  'solucionarios confidenciales': /docente\/solucionarios\/[\s\S]*\.gitignore/,
  'compilar y probar': /npm run test:estructura[\s\S]*npm run build:all[\s\S]*npm run preview:pages/,
  'preparar para estudiantes': /comparte con los estudiantes el enlace del portal/,
 };
 for (const [nombre, re] of Object.entries(requisitos)) assert.match(c, re, nombre);
 // El ejemplo de «Ruta de la semana» usa un layout existente y cabe en su límite de 6 viñetas.
 assert.doesNotMatch(c, /oc-l-(?!text\b|two-cols\b|multimedia\b)[a-z-]+/, 'solo layouts existentes en el capítulo');
 const ejemplo = c.slice(c.indexOf('## Ruta de la semana'), c.indexOf('Notes:'));
 assert.ok((ejemplo.match(/ - \*\*/g) || []).length <= 6, 'máximo 6 viñetas');
 // Crear el curso desde npm y configurar la información académica siguen en sus capítulos.
 const guia = leer('guia/index.html');
 assert.match(capitulo(guia, 'instalacion'), /npm create openclass-uniminuto-revealjs@latest mi-curso/);
 assert.match(capitulo(guia, 'configuracion'), /solo llegan course\.fullName , description , year/);
 assert.match(capitulo(guia, 'ia'), /cópialo en weeks\[\][\s\S]*--force-content[\s\S]*desde la cuarta/);
});

test('[P3] prompt maestro y contrato técnico distribuidos, coherentes con la guía', () => {
 const prompt = leer('docs/IA/PROMPT-CREAR-SEMANA.md');
 const contrato = leer('docs/IA/INSTRUCCIONES-OPENCLASS.md');
 const docente = leer('docs/GUIA-DOCENTE.md');
 for (const re of [/«Ruta de la semana» \(oc-l-text\)/, /qué podrá demostrar el estudiante/, /no inventes resultados institucionales/,
  /Sincrónico por Zoom o Teams/, /no modalidades académicas oficiales/, /De 0 a 3 por semana, de 5 a 10 minutos/i, /uno por\s+diapositiva/,
  /guion docente público/, /docente\/solucionarios\//, /Investiga los conceptos/, /weeks\[\]\.opening/])
  assert.match(prompt, re);
 // Orden sin contradicción: opening en la configuración → generar → pegar desde la cuarta diapositiva.
 const despues = prompt.slice(prompt.indexOf('## Después de recibir la respuesta'));
 assert.ok(despues.indexOf('opening') < despues.indexOf('npm run semana') && despues.indexOf('npm run semana') < despues.indexOf('desde la cuarta'));
 assert.match(despues, /Si ya tiene contenido elaborado, no lo uses/);
 assert.match(despues, /\/guia\/#pedagogia/);
 assert.match(contrato, /reemplaza el archivo completo de la semana N/);
 assert.match(contrato, /«Ruta de la semana»/);
 for (const t of [prompt, contrato, docente]) assert.doesNotMatch(t, /solo se\s+reescribe la semana N|reescribe solo la semana N\)/, 'instrucción contradictoria sobre --force-content');
 assert.match(docente, /## 2b\. Diseñar la semana/);
 assert.match(docente, /\/guia\/#pedagogia/);
 // Una sola fuente de verdad para la plantilla semanal: el prompt remite a ella y la plantilla al prompt.
 assert.match(leer('docs/IA/PLANTILLA-SEMANAL.md'), /PROMPT-CREAR-SEMANA\.md/);
});

test('[P3] el paquete npm incluye la guía, el prompt maestro y el portal; nunca recursos institucionales', () => {
 const r = spawnSync(win ? 'npm.cmd' : 'npm', ['pack', '--dry-run', '--json'], { cwd: root, encoding: 'utf8', shell: win });
 assert.equal(r.status, 0, r.stderr);
 const archivos = JSON.parse(r.stdout)[0].files.map((f) => f.path);
 for (const f of ['template/guia/index.html', 'template/docs/GUIA-DOCENTE.md', 'template/docs/IA/PROMPT-CREAR-SEMANA.md',
  'template/docs/IA/INSTRUCCIONES-OPENCLASS.md', 'template/docs/IA/PLANTILLA-SEMANAL.md', 'template/src/Portal.jsx', 'template/src/theme.css'])
  assert.ok(archivos.includes(f), `falta ${f} en el paquete`);
 assert.deepEqual(archivos.filter((f) => /recursos-institucionales|docente\/solucionarios/.test(f)), []);
 // Lo distribuido al curso es idéntico a la plantilla del paquete.
 for (const f of ['guia/index.html', 'docs/IA/PROMPT-CREAR-SEMANA.md', 'src/Portal.jsx'])
  assert.equal(leer(f), readFileSync(path.join(root, 'template', f), 'utf8'), f);
});
