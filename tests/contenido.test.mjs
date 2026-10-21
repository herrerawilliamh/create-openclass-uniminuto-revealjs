import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { paginarMarkdown } from '../template/src/autoPaginar.mjs';
import { LAYOUTS } from '../template/galeria/layouts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = (f) => readFileSync(path.join(root, f), 'utf8');
const slides = (md) => md.split('\n\n---\n\n');
const codigo = (n) => Array.from({ length: n }, (_, i) => `linea_${i + 1} = ${i + 1}`).join('\n');
const diapositivaCodigo = (n, extra = '') => `## Programa\n<!-- .slide: id="prog" class="oc-demo oc-l-code"${extra} -->\n\n\`\`\`python\n${codigo(n)}\n\`\`\`\n\nNotes:\nNota del docente.`;

test('Código modo scroll (predeterminado): una sola diapositiva con todo el programa', () => {
  const salida = slides(paginarMarkdown(diapositivaCodigo(60)));
  assert.equal(salida.length, 1);
  assert.match(salida[0], /linea_60 = 60/);
});

test('Código paginado: bloques de 16 líneas, títulos de continuación, notas e id solo al inicio', () => {
  const salida = slides(paginarMarkdown(diapositivaCodigo(40, ' data-oc-paginate="code"')));
  assert.equal(salida.length, 3);
  assert.match(salida[1], /^## Programa \(continuación 2\)/);
  assert.match(salida[2], /^## Programa \(continuación 3\)/);
  assert.match(salida[0], /linea_16 = 16\n```/);
  assert.match(salida[2], /linea_33 = 33[\s\S]*linea_40 = 40/);
  assert.match(salida[0], /Notes:/);
  assert.doesNotMatch(salida[1], /Notes:/);
  assert.match(salida[0], /id="prog"/);
  assert.doesNotMatch(salida[1], /id="prog"/);
  for (const s of salida) assert.match(s, /data-oc-paginate="code"/);
});

test('Código paginado: data-oc-lines ajusta el tamaño de página (acotado a 4–22)', () => {
  assert.equal(slides(paginarMarkdown(diapositivaCodigo(40, ' data-oc-paginate="code" data-oc-lines="20"'))).length, 2);
  assert.equal(slides(paginarMarkdown(diapositivaCodigo(44, ' data-oc-paginate="code" data-oc-lines="99"'))).length, 2);
});

test('La paginación de código no afecta al texto ordinario ni a menciones del atributo', () => {
  const texto = `## Texto\n<!-- .slide: class="oc-demo oc-l-text" -->\n\nUsa \`data-oc-paginate="code"\` para paginar.\n\n${codigo(3)}`;
  const largo = `## Lista\n<!-- .slide: class="oc-demo oc-l-text" data-oc-paginate="auto" -->\n\n${Array.from({ length: 16 }, (_, i) => `- Viñeta número ${i + 1} con un texto suficientemente largo para ocupar espacio en la diapositiva.`).join('\n')}`;
  const salida = slides(paginarMarkdown(`${texto}\n\n---\n\n${diapositivaCodigo(40, ' data-oc-paginate="code"')}\n\n---\n\n${largo}`));
  assert.equal(salida[0].trim(), texto, 'una mención del atributo no debe paginar');
  const textoAuto = salida.filter((s) => s.startsWith('## Lista'));
  assert.ok(textoAuto.length >= 2, 'la paginación automática de texto debe seguir funcionando');
  assert.equal(salida.filter((s) => s.startsWith('## Programa')).length, 3);
});

test('Separadores dentro de bloques de código no dividen diapositivas', () => {
  const md = `## A\n<!-- .slide: class="oc-demo oc-l-code" -->\n\n\`\`\`yaml\n---\nclave: valor\n\`\`\``;
  assert.equal(slides(paginarMarkdown(md)).length, 1);
});

test('Demostración completa: 13 layouts, ids únicos, notas y sin clases inventadas', () => {
  const md = leer('template/demo-completa.md');
  const clases = [...md.matchAll(/class="oc-demo (oc-l-[a-z-]+)"/g)].map((m) => m[1]);
  const validas = new Set(LAYOUTS.map((l) => l.clase));
  assert.equal(validas.size, 13);
  assert.deepEqual([...new Set(clases)].sort(), [...validas].sort());
  const ids = [...md.matchAll(/\.slide: id="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of LAYOUTS) assert.ok(ids.includes(l.diapositiva), `falta el ejemplo #${l.diapositiva}`);
  assert.match(md, /^# TEMÁTICA DE PRUEBA/);
  assert.ok((md.match(/^Notes:$/gm) || []).length >= 20);
  for (const recurso of ['```mermaid', 'data-chart=', '$$', '<video', '<iframe', 'data-oc-paginate="code"', 'fragment']) {
    assert.ok(md.includes(recurso), `falta ${recurso}`);
  }
});

test('Galería: cada ficha documenta todos los campos y su Markdown usa su clase', () => {
  for (const l of LAYOUTS) {
    for (const campo of ['nombre', 'objetivo', 'clase', 'markdown', 'imagenes', 'multimedia', 'notas', 'limites']) {
      assert.ok(l[campo], `${l.id}: falta ${campo}`);
    }
    assert.ok(l.parametros.length && l.errores.length, `${l.id}: parámetros/errores`);
    assert.match(l.markdown, new RegExp(`class="oc-demo ${l.clase}"`));
  }
});

function cargarMicroactividad() {
  const contexto = { window: {} };
  vm.createContext(contexto);
  vm.runInContext(leer('template/public/actividades/microactividad/datos.js'), contexto);
  vm.runInContext(leer('template/public/actividades/microactividad/logica.js'), contexto);
  return { D: contexto.window.OC_ACTIVIDAD, M: contexto.window.OCMicro };
}

test('Microactividad: datos válidos y evaluación de respuestas correctas', () => {
  const { D, M } = cargarMicroactividad();
  assert.equal(M.validarDatos(D).length, 0, M.validarDatos(D).join(' '));
  const r = M.evaluar(D.elementos, D.elementos.map((e) => e.categoria));
  assert.equal(r.aciertos, D.elementos.length);
  assert.equal(r.porcentaje, 100);
  assert.equal(r.completo, true);
  assert.match(M.mensajeFinal(r.porcentaje), /Excelente/);
});

test('Microactividad: respuestas incorrectas, parciales e incompletas', () => {
  const { D, M } = cargarMicroactividad();
  const otra = (e) => D.categorias.find((c) => c.id !== e.categoria).id;
  const mal = M.evaluar(D.elementos, D.elementos.map(otra));
  assert.equal(mal.aciertos, 0);
  assert.ok(mal.detalle.every((d) => !d.correcto && d.respondido));
  const parcial = M.evaluar(D.elementos, D.elementos.map((e, i) => (i % 2 ? e.categoria : otra(e))));
  assert.equal(parcial.aciertos, D.elementos.length / 2);
  const resumen = M.resumenPorCategoria(D.categorias, parcial, D.elementos);
  assert.equal(Object.values(resumen).reduce((s, g) => s + g.total, 0), D.elementos.length);
  const incompleta = M.evaluar(D.elementos, [D.elementos[0].categoria]);
  assert.equal(incompleta.completo, false);
  assert.equal(incompleta.pendientes, D.elementos.length - 1);
});

test('Microactividad: detecta datos inválidos y baraja de forma determinista', () => {
  const { M } = cargarMicroactividad();
  assert.ok(M.validarDatos({ categorias: [{ id: 'a' }], elementos: [] }).length >= 2);
  assert.match(M.validarDatos({ categorias: [{ id: 'a' }, { id: 'b' }], elementos: [{ texto: 'x', categoria: 'z' }] })[0], /inexistente/);
  const lista = [1, 2, 3, 4, 5, 6];
  assert.deepEqual(M.barajar(lista, 7), M.barajar(lista, 7));
  assert.deepEqual([...M.barajar(lista, 7)].sort(), lista);
});
