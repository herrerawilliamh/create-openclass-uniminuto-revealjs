import fs from 'node:fs';
import path from 'node:path';
const config=JSON.parse(fs.readFileSync('openclass.config.json','utf8'));
const required=['src/Presentacion.jsx','src/plugins/index.mjs','src/plugins/fase2.mjs','public/vendor/reveal.js-plugins/chalkboard/plugin.js','public/vendor/reveal.js-plugins/customcontrols/plugin.js','public/vendor/reveal.js-plugins/chart/plugin.js','src/theme.css','src/autoPaginar.mjs','demo-layouts.md','laboratorio.md','general/index.html','demo-layouts/index.html','laboratorio/index.html','guia/index.html','docs/GUIA-DOCENTE.md','public/actividades/quiz-iot.html','public/actividades/laboratorio-sensores.html',
 'demo-completa.md','demo-completa/index.html','galeria/index.html','galeria/layouts.mjs','src/plugins/codigo.mjs',
 'public/actividades/microactividad/index.html','public/actividades/microactividad/datos.js','public/actividades/microactividad/logica.js',
 'docs/IA/INSTRUCCIONES-OPENCLASS.md','docs/IA/PLANTILLA-SEMANAL.md','docs/IA/PROMPT-CREAR-SEMANA.md',
 ...['cover','section','image-left','image-right','top-right','top-left','multimedia','text','objectives','two-cols','two-titles','code','closing'].map(id=>`public/galeria/${id}.webp`)];
const short=String(config.course.shortName||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
for(const n of config.generation.activeWeeks){required.push(`semanas/${short}_semana${n}.md`, `semanas/${short}_semana${n}/index.html`);}
let failed=0;
for(const filename of required){const ok=fs.existsSync(filename)&&fs.statSync(filename).size>0;console.log(`${ok?'PASS':'FAIL'}=${filename}`);if(!ok)failed++;}
if(!fs.readFileSync('src/plugins/index.mjs','utf8').includes('RevealHighlight'))failed++;
if(!fs.readFileSync('src/theme.css','utf8').includes('oc-section-plane'))failed++;
console.log(`ESTRUCTURA=${failed?'FAIL':'PASS'}`);
process.exitCode=failed?1:0;
