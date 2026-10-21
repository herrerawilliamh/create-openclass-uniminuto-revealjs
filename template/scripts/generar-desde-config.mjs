import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function flag(name, fallback) { const pos=args.indexOf(name); return pos>=0 ? args[pos+1] : fallback; }
const configPath=flag('--config','openclass.config.json');
const overwriteWeeks = args.includes('--force-content');
const dryRun = args.includes('--dry-run');
const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
const short = String(config.course?.shortName || 'curso').normalize('NFD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'');
if (!short) throw new Error('course.shortName no puede estar vacío');
const active=[...new Set(config.generation?.activeWeeks || [])].map(Number).sort((a,b)=>a-b);
if (active.some(n=>!Number.isInteger(n)||n<1||n>8)) throw new Error('Las semanas deben estar entre 1 y 8');
const template=fs.readFileSync('plantillas/semana.md','utf8');
const weeks=new Map((config.weeks||[]).map(w=>[Number(w.number),w]));
const html = n => `<!doctype html>
<html lang="es" data-kind="demo" data-presentation="week" data-week="${n}">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>OpenClass · Semana ${n}</title><link rel="icon" href="%BASE_URL%favicon.png"/></head>
<body><div id="app"></div><script type="module" src="/src/main.jsx"></script></body>
</html>
`;
function write(filepath,contents,{ifMissing=false}={}) {
 if (ifMissing && fs.existsSync(filepath)) return console.log(`CONSERVADO=${filepath}`);
 if (!dryRun) { fs.mkdirSync(path.dirname(filepath),{recursive:true});fs.writeFileSync(filepath,contents,'utf8'); }
 console.log(`${dryRun?'DRY_RUN':'GENERADO'}=${filepath}`);
}
if (!fs.existsSync('slides.md')) throw new Error('Falta la presentación general slides.md');
if (!fs.existsSync('index.html') || !fs.existsSync('general/index.html')) throw new Error('Faltan HTML de portal o general');
for (const n of active) {
 const week=weeks.get(n)||{};
 const values={SEMANA:String(n),TITULO:week.title||`Semana ${n}`,FECHA:week.date||'',TEMA:week.centralTheme||'Tema central',ACTIVIDAD:week.activity||'Actividad'};
 const source=Object.entries(values).reduce((s,[key,value])=>s.replaceAll(`{{${key}}}`,String(value)),template);
 write(`semanas/${short}_semana${n}.md`,source,{ifMissing:!overwriteWeeks});
 write(`semanas/${short}_semana${n}/index.html`,html(n));
}
console.log(`CONFIG_OK=TRUE; SEMANAS_ACTIVAS=${active.join(',')}; GENERAL_CONSERVADA=TRUE`);
