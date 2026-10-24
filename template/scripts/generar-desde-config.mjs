import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function flag(name, fallback) { const pos=args.indexOf(name); return pos>=0 ? args[pos+1] : fallback; }
const configPath=flag('--config','openclass.config.json');
const overwriteWeeks = args.includes('--force-content');
// --force-week N: sobrescribe solo el Markdown de la semana N (usado por npm run semana).
const forceWeek = Number(flag('--force-week', NaN));
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
// Activación sincrónica (tercera diapositiva): weeks[].opening = { question, participation, durationMinutes }.
// Cada instrucción se realiza dentro de la reunión de Zoom o Teams: nombra chat y participación oral, y toda función
// opcional (reacciones, salas de grupos) trae su alternativa. Textos fijos: tests/portada-pedagogica.test.mjs.
// Su fondo en plantillas/semana.md es relativo (../../fondos/…): cada semana vive en semanas/<curso>_semanaN/,
// dos niveles bajo la base, y la diapositiva no lleva ningún marcador {{…}}.
const minutos = n => n===1 ? '1 minuto' : `${String(n).replace('.',',')} minutos`;
const PARTICIPACION = {
 'respuesta-individual': n => `Escribe tu respuesta individual en el chat de la reunión durante ${minutos(n)}. `
  + 'Si el chat no está disponible, compártela de forma oral cuando se te dé la palabra.',
 'discusion-parejas': n => `Comenta tu respuesta con un compañero en una sala de grupos durante ${minutos(n)}. `
  + 'Si no hay salas de grupos, en la sala general escribe tu respuesta en el chat y responde a la de un compañero, '
  + 'o compártela de forma oral cuando sea tu turno.',
 'hipotesis-grupal': n => `Formulen en grupo una hipótesis durante ${minutos(n)}: `
  + 'una persona la comparte por micrófono o en el chat y el resto indica su acuerdo con una reacción. '
  + 'Si no hay reacciones, el resto indica su acuerdo en el chat o de forma oral.',
 'propuesta-caso': n => `Propón una solución para el caso en el chat de la reunión o de forma oral durante ${minutos(n)} `
  + 'y marca con una reacción la propuesta que te convenza. Si no hay reacciones, indica en el chat o de forma oral cuál te convence.',
};
// Sin opening: pregunta contextualizada con centralTheme. Se deriva aquí y nunca se escribe en la configuración.
const predeterminada = tema => ({ question:`¿Qué sabes ya sobre ${tema}?`, participation:'respuesta-individual', durationMinutes:2 });
const ENLACE = /\[[^\]\n]*\]\s*[([]|<\s*(?:a|iframe|embed|object|form|script|link)\b|<[a-z][a-z0-9+.-]*:|\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\bmailto:/i;
function erroresApertura(o) {
 if (o === null || typeof o !== 'object' || Array.isArray(o)) return ['opening debe ser un objeto { question, participation, durationMinutes }'];
 const e = [];
 if (typeof o.question !== 'string' || !o.question.trim()) e.push('opening.question debe ser un texto no vacío');
 else if (ENLACE.test(o.question)) e.push('opening.question no puede contener enlaces ni etiquetas de enlace');
 if (!Object.hasOwn(PARTICIPACION, o.participation)) e.push(`opening.participation debe ser una de: ${Object.keys(PARTICIPACION).join(', ')}`);
 if (typeof o.durationMinutes !== 'number' || !(o.durationMinutes >= 1 && o.durationMinutes <= 3)) e.push('opening.durationMinutes debe ser un número entre 1 y 3');
 return e;
}
// Texto libre como texto literal en Markdown: una línea y la puntuación Markdown/HTML escapada, así no crea
// enlaces, etiquetas, listas, diapositivas ni Notes, y un «{{BASE_URL}}» escrito en la pregunta no se resuelve.
const literal = s => String(s).replace(/\s+/g,' ').trim()
 .replace(/[\\`*_{}[\]<>&~]/g,'\\$&').replace(/^[-+#>]/,'\\$&').replace(/^(\d+)([.)])/,'$1\\$2').replace(/^(notes?):/i,'$1\\:');
const invalidas = active.flatMap(n => { const o = weeks.get(n)?.opening; return o == null ? [] : erroresApertura(o).map(e => `semana ${n}: ${e}`); });
if (invalidas.length) throw new Error(`Configuración de apertura inválida; no se generó ninguna semana:\n - ${invalidas.join('\n - ')}`);

if (!fs.existsSync('slides.md')) throw new Error('Falta la presentación general slides.md');
if (!fs.existsSync('index.html') || !fs.existsSync('general/index.html')) throw new Error('Faltan HTML de portal o general');
for (const n of active) {
 const week=weeks.get(n)||{};
 const tema=week.centralTheme||'Tema central', titulo=week.title||`Semana ${n}`, fecha=String(week.date??'').trim();
 const apertura=week.opening ?? predeterminada(tema);
 if (week.opening != null) console.log(`REVISION_DOCENTE=semana ${n}: la pertinencia de opening.question la decide el docente`);
 const values={CURSO:config.course?.fullName||'Curso',SEMANA:String(n),TITULO:titulo,FECHA:fecha,
  // Sin fecha, la línea secundaria de la portada es solo el título: sin «·» huérfano.
  TITULO_FECHA:fecha ? `${titulo} · ${fecha}` : titulo,
  TEMA:tema,ACTIVIDAD:week.activity||'Actividad',
  PREGUNTA:literal(apertura.question),PARTICIPACION:PARTICIPACION[apertura.participation](apertura.durationMinutes),
  DURACION:minutos(apertura.durationMinutes)};
 // Una sola pasada con función: un valor con «{{…}}» o «$&» se inserta literal; {{BASE_URL}} queda para Presentacion.jsx.
 const source=template.replace(/\{\{(\w+)\}\}/g,(m,key)=>Object.hasOwn(values,key)?String(values[key]):m);
 write(`semanas/${short}_semana${n}.md`,source,{ifMissing:!(overwriteWeeks||n===forceWeek)});
 write(`semanas/${short}_semana${n}/index.html`,html(n));
}
console.log(`CONFIG_OK=TRUE; SEMANAS_ACTIVAS=${active.join(',')}; GENERAL_CONSERVADA=TRUE`);
