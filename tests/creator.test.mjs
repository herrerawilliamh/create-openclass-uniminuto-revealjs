import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs');
const fixture = () => mkdtempSync(path.join(os.tmpdir(), 'openclass-definitivo-'));
const run = (...args) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
test('Ayuda CLI', () => assert.equal(run('--help').status, 0));
test('Generación de curso limpio y assets institucionales', () => {
 const temp=fixture(), dest=path.join(temp,'Curso-IoT');
 try {
  const r=run(dest,'--iot'); assert.equal(r.status,0, r.stderr);
  for (const asset of ['guia/index.html','docs/GUIA-DOCENTE.md','src/theme.css','src/Presentacion.jsx','src/plugins/index.mjs','public/vendor/reveal.js-plugins/chalkboard/plugin.js','public/fondos/slide-01-portada.png','public/fondos/slide-06-cierre.png','public/imagenes/acreditacion-openclass.png','public/imagenes/70annos.png','.gitignore','semanas/cursoiot_semana1.md']) assert.ok(existsSync(path.join(dest,asset)), asset);
  assert.equal(JSON.parse(readFileSync(path.join(dest,'package.json'),'utf8')).name,'curso-iot');
  assert.equal(JSON.parse(readFileSync(path.join(dest,'openclass.config.json'),'utf8')).course.shortName,'cursoiot');
  assert.equal(spawnSync(process.execPath,['scripts/verificar-estructura.mjs'],{cwd:dest}).status,0);
  for (const bad of ['dist','respaldos','node_modules','package-lock.json']) assert.ok(!existsSync(path.join(dest,bad)), bad);
 } finally { rmSync(temp,{recursive:true,force:true}); }
});
test('No sobreescribir carpeta existente', () => {
 const temp=fixture(), dest=path.join(temp,'curso');
 try {
  assert.equal(run(dest).status,0);
  const key=path.join(dest,'slides.md');
  writeFileSync(key,'NO TOCAR');
  assert.notEqual(run(dest,'--force').status,0);
  assert.notEqual(run(dest).status,0);
  assert.equal(readFileSync(key,'utf8'),'NO TOCAR');
 } finally {rmSync(temp,{recursive:true,force:true});}
});
test('Actualización preserva Markdown y hace respaldos', () => {
 const temp=fixture(), dest=path.join(temp,'curso');
 try {
  assert.equal(run(dest).status,0);
  writeFileSync(path.join(dest,'slides.md'),'CLASE PROPIA');
  const r=run(dest,'--update-theme'); assert.equal(r.status,0,r.stderr);
  assert.equal(readFileSync(path.join(dest,'slides.md'),'utf8'),'CLASE PROPIA');
  assert.ok(existsSync(path.join(dest,'respaldos')));
  assert.ok(existsSync(path.join(dest,'guia/index.html')));
  assert.ok(existsSync(path.join(dest,'docs/GUIA-DOCENTE.md')));
 } finally {rmSync(temp,{recursive:true,force:true});}
});

test('--assets aplica imágenes locales sobre el tema neutro y rechaza código', () => {
 const temp=fixture(), dest=path.join(temp,'curso'), recursos=path.join(temp,'recursos');
 try {
  mkdirSync(path.join(recursos,'public','fondos'),{recursive:true});
  writeFileSync(path.join(recursos,'public','fondos','slide-01-portada.png'),'PNG-LOCAL');
  writeFileSync(path.join(recursos,'public','malicioso.js'),'alert(1)');
  const r=run(dest,'--assets',recursos); assert.equal(r.status,0,r.stderr);
  assert.match(r.stdout,/RECURSOS_LOCALES=1 /);
  assert.equal(readFileSync(path.join(dest,'public/fondos/slide-01-portada.png'),'utf8'),'PNG-LOCAL');
  assert.ok(!existsSync(path.join(dest,'public/malicioso.js')));
  assert.ok(existsSync(path.join(dest,'public/fondos/slide-05-template.png')), 'los demás fondos neutros se conservan');
  assert.notEqual(run(path.join(temp,'otro'),'--assets',path.join(temp,'no-existe')).status,0);
  // --update-theme --assets también los aplica, sin tocar el Markdown.
  writeFileSync(path.join(dest,'slides.md'),'CLASE PROPIA');
  writeFileSync(path.join(recursos,'public','fondos','slide-01-portada.png'),'PNG-V2');
  assert.equal(run(dest,'--update-theme','--assets',recursos).status,0);
  assert.equal(readFileSync(path.join(dest,'public/fondos/slide-01-portada.png'),'utf8'),'PNG-V2');
  assert.equal(readFileSync(path.join(dest,'slides.md'),'utf8'),'CLASE PROPIA');
 } finally {rmSync(temp,{recursive:true,force:true});}
});

test('Demostración completa, galería, microactividad y archivos de IA en el curso', () => {
 const temp=fixture(), dest=path.join(temp,'curso');
 try {
  assert.equal(run(dest).status,0);
  for (const f of ['demo-completa.md','demo-completa/index.html','galeria/index.html','galeria/layouts.mjs','src/plugins/codigo.mjs','public/galeria/code.webp','public/videos/demo-openclass.webm','public/videos/demo-openclass.vtt','public/actividades/microactividad/datos.js','docs/IA/INSTRUCCIONES-OPENCLASS.md','docs/IA/PLANTILLA-SEMANAL.md','docs/IA/PROMPT-CREAR-SEMANA.md']) assert.ok(existsSync(path.join(dest,f)),f);
  assert.match(readFileSync(path.join(dest,'src/Portal.jsx'),'utf8'),/VER DEMOSTRACIÓN COMPLETA/);
  assert.match(readFileSync(path.join(dest,'vite.config.mjs'),'utf8'),/demo-completa\/index\.html[\s\S]*galeria\/index\.html/);
  assert.equal(spawnSync(process.execPath,['scripts/verificar-estructura.mjs'],{cwd:dest}).status,0);
  // Ningún recurso institucional aislado viaja en la plantilla pública.
  assert.ok(!existsSync(path.join(dest,'recursos-institucionales')));
 } finally {rmSync(temp,{recursive:true,force:true});}
});

test('Guía integrada, acceso desde portal y build configurado', () => {
 const temp=fixture(), dest=path.join(temp,'curso');
 try {
  assert.equal(run(dest).status, 0);
  const guia=readFileSync(path.join(dest,'guia/index.html'),'utf8');
  const portal=readFileSync(path.join(dest,'src/Portal.jsx'),'utf8');
  const vite=readFileSync(path.join(dest,'vite.config.mjs'),'utf8');
  assert.match(guia,/Cómo crear tu/);
  assert.match(guia,/data-search/);
  assert.match(portal,/\$\{base\}guia\//);
  assert.match(vite,/guia: resolve\('guia\/index.html'\)/);
  assert.match(readFileSync(path.join(dest,'README.md'),'utf8'),/guia\//);
 } finally {rmSync(temp,{recursive:true,force:true});}
});
