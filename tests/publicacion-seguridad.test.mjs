// Contenido académico en los artefactos públicos de Vite (P4-RED, OpenClass 1.1.0).
// [GREEN]           = control: debe pasar con la implementación actual.
// [RED]             = fuga que fallaba en P4-RED; hoy debe pasar como control de regresión.
// [CARACTERIZACIÓN] = documenta el comportamiento actual; lo que aquí aparece es PÚBLICO.
// Curso temporal generado con el CLI y compilado con build:all; marcadores ficticios aleatorios.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, cpSync, existsSync, readFileSync, writeFileSync, readdirSync, rmSync, realpathSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs');
const win = process.platform === 'win32';
const npm = (cwd, ...a) => spawnSync(win ? 'npm.cmd' : 'npm', a, { cwd, encoding: 'utf8', shell: win });

// Marcadores únicos por ejecución: no pueden coincidir con texto de la plantilla.
const id = randomBytes(6).toString('hex').toUpperCase();
const M = {
 activaVisible: `OCP4-ACTIVA-VISIBLE-${id}`,
 activaNotas: `OCP4-ACTIVA-NOTAS-${id}`,
 inactivaVisible: `OCP4-INACTIVA-VISIBLE-${id}`,
 inactivaNotas: `OCP4-INACTIVA-NOTAS-${id}`,
 inactivaConfig: `OCP4-INACTIVA-CONFIG-${id}`,
 activaConfig: `OCP4-ACTIVA-CONFIG-${id}`,
 privadoRaiz: `OCP4-PRIVADO-RAIZ-${id}`,
 privadoMoodle: `OCP4-PRIVADO-MOODLE-${id}`,
 privadoCurso: `OCP4-PRIVADO-CURSO-${id}`,
 privadoGeneracion: `OCP4-PRIVADO-GENERACION-${id}`,
 privadoSemana: `OCP4-PRIVADO-SEMANA-${id}`,
 noUsadoSemana: `OCP4-NO-USADO-SEMANA-${id}`,
 solucionarioDocente: `OCP4-SOLUCIONARIO-DOCENTE-${id}`,
 solucionarioSemanas: `OCP4-SOLUCIONARIO-SEMANAS-${id}`,
 solucionarioPublic: `OCP4-SOLUCIONARIO-PUBLIC-${id}`,
};

// Solucionarios docentes ficticios (P4 CLOSURE-A). Los dos primeros están fuera de public/ y
// ningún módulo del cliente los importa; el tercero está dentro de public/ a propósito.
const SOLUCIONARIOS = {
 solucionarioDocente: 'docente/solucionarios/oc-privado-solucionario-docente.md',
 solucionarioSemanas: 'semanas/oc-privado-solucionario-semanas.md',
 solucionarioPublic: 'public/docente/oc-solucionario-en-public.md',
};
const solucionario = (marcador) => `# Solucionario ficticio\n\nRespuesta de prueba: ${marcador}\n`;

const semana = (n, visible, notas) => `# Semana ${n} ficticia\n\n${visible}\n\nNotes:\n${notas}\n\n---\n\n## Cierre\n\nContenido ficticio de prueba.\n`;

let temp, dest, dist, cfgTexto, cfgDespues, artefactos = [];

// Todos los archivos distribuidos, leídos como bytes (HTML, JS, CSS, JSON, imágenes...).
function listar(dir) {
 return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? listar(p) : [p];
 });
}
const contienen = (marcador) => artefactos
 .filter((a) => a.bytes.includes(Buffer.from(marcador, 'utf8')))
 .map((a) => a.rel);

before(() => {
 // Rutas largas en Windows: los nombres 8.3 rompen el proxy HTML de Vite.
 temp = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-p4-')));
 dest = path.join(temp, 'curso');
 const r = spawnSync(process.execPath, [bin, dest], { encoding: 'utf8' });
 assert.equal(r.status, 0, r.stderr);

 const cfgPath = path.join(dest, 'openclass.config.json');
 const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
 const short = cfg.course.shortName;
 // Semana 1 activa; semana 2 con Markdown en disco pero fuera de activeWeeks.
 cfg.generation.activeWeeks = [1];
 cfg.weeks.find((w) => w.number === 2).title = M.inactivaConfig;
 // Campos que la interfaz no usa: raíz personalizada, extra.moodle, claves desconocidas y
 // una clave conocida (activity) que el portal no muestra.
 const s1 = cfg.weeks.find((w) => w.number === 1);
 Object.assign(s1, { title: M.activaConfig, activity: M.noUsadoSemana, notaInterna: M.privadoSemana });
 cfg.secretoDocente = { clave: M.privadoRaiz };
 cfg.extra = { moodle: { token: M.privadoMoodle } };
 cfg.course.correoInterno = M.privadoCurso;
 cfg.generation.claveTecnica = M.privadoGeneracion;
 cfgTexto = JSON.stringify(cfg, null, 2) + '\n';
 writeFileSync(cfgPath, cfgTexto);
 writeFileSync(path.join(dest, `semanas/${short}_semana1.md`), semana(1, M.activaVisible, M.activaNotas));
 writeFileSync(path.join(dest, `semanas/${short}_semana2.md`), semana(2, M.inactivaVisible, M.inactivaNotas));
 for (const [k, rel] of Object.entries(SOLUCIONARIOS)) {
  mkdirSync(path.dirname(path.join(dest, rel)), { recursive: true });
  writeFileSync(path.join(dest, rel), solucionario(M[k]));
 }

 const inst = npm(dest, 'install', '--no-audit', '--no-fund');
 assert.equal(inst.status, 0, inst.stdout + inst.stderr);
 const build = npm(dest, 'run', 'build:all');
 assert.equal(build.status, 0, build.stdout + build.stderr);
 // La semana 2 sigue inactiva tras build:all (config no la activa por tener Markdown).
 cfgDespues = readFileSync(cfgPath, 'utf8');
 assert.deepEqual(JSON.parse(cfgDespues).generation.activeWeeks, [1]);

 dist = path.join(dest, 'dist');
 artefactos = listar(dist).map((f) => ({ rel: path.relative(dist, f).replaceAll('\\', '/'), bytes: readFileSync(f) }));
});

after(() => { if (temp) rmSync(temp, { recursive: true, force: true }); });

test('[GREEN] dist/ contiene artefactos y la semana activa tiene página publicada', (t) => {
 t.diagnostic(`ARTEFACTOS_INSPECCIONADOS=${artefactos.length}`);
 assert.ok(artefactos.length > 0, 'dist/ vacío');
 assert.ok(artefactos.some((a) => /^semanas\/[^/]+_semana1\/index\.html$/.test(a.rel)), 'página semana 1');
 assert.ok(!artefactos.some((a) => /^semanas\/[^/]+_semana2\//.test(a.rel)), 'la semana 2 no tiene página propia');
 assert.ok(!artefactos.some((a) => /_semana\d\.md$/.test(a.rel)), 'el Markdown fuente no se copia a dist/');
});

// Control positivo: demuestra que la inspección de bytes detecta contenido real del curso.
test('[GREEN] el marcador visible de la semana activa aparece en los artefactos', (t) => {
 const donde = contienen(M.activaVisible);
 t.diagnostic(`ACTIVA_VISIBLE en: ${donde.join(', ') || '(ninguno)'}`);
 assert.ok(donde.length > 0);
});

// RED: Presentacion.jsx usa import.meta.glob('../semanas/*.md', { eager: true }), que incluye
// cualquier Markdown de semanas/ sin consultar generation.activeWeeks.
test('[RED] el Markdown de una semana inactiva no aparece en los artefactos públicos', (t) => {
 const donde = contienen(M.inactivaVisible);
 t.diagnostic(`INACTIVA_VISIBLE en: ${donde.join(', ') || '(ninguno)'}`);
 assert.deepEqual(donde, [], `fuga del contenido de la semana 2 inactiva en ${donde.join(', ')}`);
});

test('[RED] las notas Notes: de una semana inactiva no aparecen en los artefactos públicos', (t) => {
 const donde = contienen(M.inactivaNotas);
 t.diagnostic(`INACTIVA_NOTAS en: ${donde.join(', ') || '(ninguno)'}`);
 assert.deepEqual(donde, [], `fuga de las notas de la semana 2 inactiva en ${donde.join(', ')}`);
});

// RED: main.jsx importaba openclass.config.json completo (weeks[] inactivas y campos privados).
// El cliente debe recibir solo la proyección pública; el archivo del docente no se modifica.
test('[RED] los metadatos de una semana inactiva y los campos privados de la configuración no aparecen en los artefactos', (t) => {
 const activa = contienen(M.activaConfig);
 const fugas = Object.fromEntries(['inactivaConfig', 'privadoRaiz', 'privadoMoodle', 'privadoCurso', 'privadoGeneracion', 'privadoSemana', 'noUsadoSemana']
  .map((k) => [k, contienen(M[k])]));
 t.diagnostic(`ACTIVA_CONFIG en: ${activa.join(', ') || '(ninguno)'}; ${Object.entries(fugas).map(([k, v]) => `${k}=${v.join(',') || '(ninguno)'}`).join('; ')}`);
 assert.equal(cfgDespues, cfgTexto, 'openclass.config.json del docente modificado por build:all');
 assert.ok(activa.length > 0, 'el título de la semana activa no llega al portal');
 for (const [k, donde] of Object.entries(fugas)) assert.deepEqual(donde, [], `fuga de ${k} en ${donde.join(', ')}`);
});

// No se exige eliminar las notas de semanas activas (Reveal.js las necesita para la vista
// del ponente); se fija que hoy viajan en el bundle y, por tanto, son contenido público.
test('[CARACTERIZACIÓN] las notas Notes: de la semana activa viajan en el bundle público', (t) => {
 const donde = contienen(M.activaNotas);
 t.diagnostic(`ACTIVA_NOTAS en: ${donde.join(', ') || '(ninguno)'} — tratar como PÚBLICAS`);
 assert.ok(donde.length > 0, 'las notas de la semana activa ya no están en dist/: actualizar caracterización');
});

// Privacidad docente (P4 CLOSURE-A): solo es privado lo que Vite no copia (public/) ni importa.
describe('privacidad de solucionarios docentes', () => {
 const nombre = (rel) => path.posix.basename(rel);

 test('[GREEN] los solucionarios fuera de public/ y no importados no aparecen en dist/', (t) => {
  const privados = ['solucionarioDocente', 'solucionarioSemanas'];
  // Los archivos siguen en disco tras build:all: la ausencia en dist/ no es trivial.
  for (const k of privados) assert.ok(existsSync(path.join(dest, SOLUCIONARIOS[k])), `falta ${SOLUCIONARIOS[k]}`);
  // Ningún archivo del cliente los referencia por nombre.
  const fuentes = listar(path.join(dest, 'src')).filter((f) => /\.(m?js|jsx)$/.test(f));
  const refs = fuentes.filter((f) => privados.some((k) => readFileSync(f, 'utf8').includes(nombre(SOLUCIONARIOS[k]))));
  assert.deepEqual(refs, [], `src/ referencia un solucionario: ${refs.join(', ')}`);
  const fugas = Object.fromEntries(privados.map((k) => [k, contienen(M[k])]));
  const rutas = artefactos.filter((a) => privados.some((k) => nombre(a.rel) === nombre(SOLUCIONARIOS[k]))).map((a) => a.rel);
  t.diagnostic(`ARTEFACTOS=${artefactos.length}; ${Object.entries(fugas).map(([k, v]) => `${k}=${v.join(',') || '(ninguno)'}`).join('; ')}; RUTAS=${rutas.join(',') || '(ninguna)'}`);
  for (const [k, donde] of Object.entries(fugas)) assert.deepEqual(donde, [], `fuga de ${k} en ${donde.join(', ')}`);
  assert.deepEqual(rutas, [], `solucionario copiado a dist/: ${rutas.join(', ')}`);
 });

 // public/ se copia íntegro a dist/: un archivo ahí es descargable por URL aunque ninguna
 // página lo enlace. Ocultar el enlace no lo protege; public/ NO es una ubicación privada.
 test('[CARACTERIZACIÓN] un solucionario dentro de public/ se distribuye en dist/', (t) => {
  const donde = contienen(M.solucionarioPublic);
  t.diagnostic(`SOLUCIONARIO_PUBLIC en: ${donde.join(', ') || '(ninguno)'} — public/ es PÚBLICO`);
  assert.deepEqual(donde, ['docente/oc-solucionario-en-public.md'], 'public/ ya no se copia tal cual: actualizar caracterización');
 });

 // Las Notes de la semana activa viajan junto a su contenido visible: disponibles para la vista
 // del ponente y, por tanto, PÚBLICAS. No son lugar para solucionarios.
 test('[CARACTERIZACIÓN] las Notes de la semana activa están en el mismo artefacto que su contenido', (t) => {
  const visible = new Set(contienen(M.activaVisible)), notas = contienen(M.activaNotas);
  t.diagnostic(`ACTIVA_NOTAS en: ${notas.join(', ') || '(ninguno)'} — tratar como PÚBLICAS`);
  assert.ok(notas.length > 0, 'las notas de la semana activa ya no están en dist/');
  assert.ok(notas.some((r) => visible.has(r)), 'las notas no acompañan al contenido de la semana activa');
 });
});

// Ciclo activar → compilar → desactivar → recompilar sobre el MISMO curso (P4 GREEN-A).
// Con OPENCLASS_P4_EVIDENCIA=<dir> se conservan ambos dist/, logs y un manifiesto SHA-256.
describe('ciclo de desactivación de una semana', () => {
 // Token propio de la semana 2: buscarlo solo detecta también fragmentos del marcador.
 const t2 = randomBytes(6).toString('hex').toUpperCase();
 const C = {
  s1Visible: `OCP4C-S1-VISIBLE-${id}`,
  s1Notas: `OCP4C-S1-NOTAS-${id}`,
  s2Visible: `OCP4C-S2-VISIBLE-${t2}`,
  s2Notas: `OCP4C-S2-NOTAS-${t2}`,
  s2Config: `OCP4C-S2-CONFIG-${t2}`,
  s2Token: t2,
 };
 const evidencia = process.env.OPENCLASS_P4_EVIDENCIA;
 let tempC, destC, cfgC, shortC, activa = [], desactivada = [];

 const leer = (dir) => listar(dir).map((f) => ({ rel: path.relative(dir, f).replaceAll('\\', '/'), bytes: readFileSync(f) }));
 const con = (lista, marcador) => lista.filter((a) => a.bytes.includes(Buffer.from(marcador, 'utf8'))).map((a) => a.rel);
 const compilar = (etiqueta, semanas) => {
  const cfg = JSON.parse(readFileSync(cfgC, 'utf8'));
  cfg.generation.activeWeeks = semanas;
  writeFileSync(cfgC, JSON.stringify(cfg, null, 2) + '\n');
  const build = npm(destC, 'run', 'build:all');
  if (evidencia) {
   cpSync(path.join(destC, 'dist'), path.join(evidencia, etiqueta), { recursive: true });
   writeFileSync(path.join(evidencia, `${etiqueta}.log`), `activeWeeks=${JSON.stringify(semanas)}\nstatus=${build.status}\n\n${build.stdout}\n${build.stderr}`);
   cpSync(cfgC, path.join(evidencia, `${etiqueta}.openclass.config.json`));
  }
  assert.equal(build.status, 0, build.stdout + build.stderr);
  assert.deepEqual(JSON.parse(readFileSync(cfgC, 'utf8')).generation.activeWeeks, semanas);
  return leer(path.join(destC, 'dist'));
 };

 before(() => {
  tempC = realpathSync.native(mkdtempSync(path.join(os.tmpdir(), 'openclass-p4c-')));
  destC = path.join(tempC, 'curso');
  const r = spawnSync(process.execPath, [bin, destC], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  cfgC = path.join(destC, 'openclass.config.json');
  const cfg = JSON.parse(readFileSync(cfgC, 'utf8'));
  shortC = cfg.course.shortName;
  // Título de la semana 2 en la configuración: también debe desaparecer al desactivarla.
  cfg.weeks.find((w) => w.number === 2).title = C.s2Config;
  writeFileSync(cfgC, JSON.stringify(cfg, null, 2) + '\n');
  writeFileSync(path.join(destC, `semanas/${shortC}_semana1.md`), semana(1, C.s1Visible, C.s1Notas));
  writeFileSync(path.join(destC, `semanas/${shortC}_semana2.md`), semana(`2 ${C.s2Token}`, C.s2Visible, C.s2Notas));
  if (evidencia) {
   mkdirSync(evidencia, { recursive: true });
   writeFileSync(path.join(evidencia, 'marcadores.json'), JSON.stringify(C, null, 2) + '\n');
  }

  const inst = npm(destC, 'install', '--no-audit', '--no-fund');
  assert.equal(inst.status, 0, inst.stdout + inst.stderr);
  activa = compilar('build-activa', [1, 2]);
  desactivada = compilar('build-desactivada', [1]);

  if (evidencia) {
   const archivos = listar(evidencia).map((f) => path.relative(evidencia, f).replaceAll('\\', '/'))
    .filter((f) => f !== 'MANIFEST.sha256').sort();
   writeFileSync(path.join(evidencia, 'MANIFEST.sha256'), archivos
    .map((f) => `${createHash('sha256').update(readFileSync(path.join(evidencia, f))).digest('hex')}  ${f}`).join('\n') + '\n');
  }
 });

 after(() => { if (tempC) rmSync(tempC, { recursive: true, force: true }); });

 // Control positivo: sin él, la ausencia posterior no demostraría nada.
 test('[GREEN] con la semana 2 activa, su Markdown, Notes y página están en dist/', (t) => {
  t.diagnostic(`ACTIVA: S2_VISIBLE en ${con(activa, C.s2Visible).join(', ') || '(ninguno)'}; S2_NOTAS en ${con(activa, C.s2Notas).join(', ') || '(ninguno)'}`);
  assert.ok(con(activa, C.s2Visible).length > 0, 'marcador visible de la semana 2');
  assert.ok(con(activa, C.s2Notas).length > 0, 'notas de la semana 2');
  assert.ok(con(activa, C.s2Config).length > 0, 'título de la semana 2 en el portal');
  assert.ok(activa.some((a) => /^semanas\/[^/]+_semana2\/index\.html$/.test(a.rel)), 'página semana 2');
 });

 test('[GREEN] tras desactivar y recompilar, ningún artefacto conserva la semana 2', (t) => {
  const visibles = con(desactivada, C.s2Visible), notas = con(desactivada, C.s2Notas), token = con(desactivada, C.s2Token);
  const paginas = desactivada.filter((a) => /(^|\/)semanas\/[^/]+_semana2(\/|$)/.test(a.rel)).map((a) => a.rel);
  // Archivos de la compilación activa que contenían la semana 2 y siguen con el mismo nombre.
  const antes = new Set([...con(activa, C.s2Token)]);
  const residuales = desactivada.filter((a) => antes.has(a.rel)).map((a) => a.rel);
  t.diagnostic(`DESACTIVADA: ARTEFACTOS=${desactivada.length}; S2_VISIBLE=${visibles.length}; S2_NOTAS=${notas.length}; S2_TOKEN=${token.length}; PAGINAS_S2=${paginas.length}; RESIDUALES=${residuales.length}`);
  assert.ok(desactivada.length > 0, 'dist/ vacío');
  assert.deepEqual(visibles, [], `Markdown de la semana 2 en ${visibles.join(', ')}`);
  assert.deepEqual(notas, [], `Notes de la semana 2 en ${notas.join(', ')}`);
  assert.deepEqual(token, [], `fragmentos de la semana 2 en ${token.join(', ')}`);
  assert.deepEqual(paginas, [], `HTML publicado de la semana 2: ${paginas.join(', ')}`);
  assert.deepEqual(residuales, [], `artefactos residuales de la compilación activa: ${residuales.join(', ')}`);
 });

 test('[GREEN] la semana 1 sigue publicada y su contenido es alcanzable desde su página', (t) => {
  const pagina = desactivada.find((a) => /^semanas\/[^/]+_semana1\/index\.html$/.test(a.rel));
  assert.ok(pagina, 'página semana 1');
  const existe = new Set(desactivada.map((a) => a.rel));
  const resolver = (desde, ref) => (ref.startsWith('/') ? ref.slice(1) : path.posix.join(path.posix.dirname(desde), ref));
  // Recursos locales de la página (scripts y modulepreload) y, desde ellos, sus imports de JS.
  const refs = [...pagina.bytes.toString('utf8').matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)].map((m) => resolver(pagina.rel, m[1]));
  const faltan = refs.filter((r) => !existe.has(r));
  assert.deepEqual(faltan, [], `recursos inexistentes: ${faltan.join(', ')}`);
  const alcanzados = new Set(), pendientes = refs.filter((r) => r.endsWith('.js'));
  while (pendientes.length) {
   const r = pendientes.pop();
   if (alcanzados.has(r) || !existe.has(r)) continue;
   alcanzados.add(r);
   const js = desactivada.find((a) => a.rel === r).bytes.toString('utf8');
   for (const m of js.matchAll(/["'`]((?:\.{1,2}\/|\/)?(?:assets\/)?[\w.-]+\.js)["'`]/g)) {
    const dir = m[1].startsWith('assets/') ? '' : path.posix.dirname(r);
    pendientes.push(m[1].startsWith('/') ? m[1].slice(1) : path.posix.normalize(path.posix.join(dir, m[1])));
   }
  }
  const s1 = con(desactivada.filter((a) => alcanzados.has(a.rel)), C.s1Visible);
  t.diagnostic(`SEMANA1: REFS=${refs.length}; JS_ALCANZADOS=${alcanzados.size}; S1_VISIBLE en ${s1.join(', ') || '(ninguno)'}`);
  assert.ok(s1.length > 0, 'el Markdown de la semana 1 no es alcanzable desde su página');
  assert.ok(con(desactivada, C.s1Notas).length > 0, 'notas de la semana 1');
 });
});
