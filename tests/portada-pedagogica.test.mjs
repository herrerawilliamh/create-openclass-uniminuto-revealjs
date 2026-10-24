// Portada, tema y activación de las presentaciones semanales (P2 RED-R7, OpenClass 1.1.0).
// Secuencia inicial: 1) PORTADA (nombre completo del curso, semana, tema y fecha); 2) TEMA (centralTheme con el layout
// de sección); 3) ACTIVACIÓN (pregunta y dinámica breve para clases sincrónicas por Zoom o Teams).
// [GREEN] = control positivo: debe pasar con la implementación actual y después de P2 GREEN.
// [RED]   = requisito que fallaba en P2 RED (plantillas/semana.md, scripts/generar-desde-config.mjs); hoy debe
//           pasar como control de regresión.
// Solo se evalúa el contenido visible: se descartan comentarios HTML y todo lo que sigue a «Notes:».
// La participación no se infiere del lenguaje: se comprueba un contrato estructurado (weeks[].opening) y la instrucción
// afirmativa fija que la plantilla debe generar para cada modalidad.
// Tres resultados de validación, propios de estas pruebas (no forman parte del esquema público):
//   AUTO_PASS        comprobación estructural demostrada (layout, encabezados, instrucción canónica, contrato opening).
//   REVIEW_REQUIRED  texto libre (opening.question) que supera los controles objetivos: su pertinencia y si exige
//                    recursos externos solo puede decidirlas una persona. Ninguna expresión regular lo aprueba.
//   FAIL             incumplimiento objetivo: configuración inválida, enlaces o iframes, recursos externos en el texto
//                    canónico de la diapositiva.
// Ejecutar con `npm run test:p2` (también en CI: .github/workflows/ci.yml).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, realpathSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bin = path.join(root, 'bin/create-openclass-uniminuto-revealjs.mjs');
const win = process.platform === 'win32';
const npm = (cwd, ...a) => spawnSync(win ? 'npm.cmd' : 'npm', a, { cwd, encoding: 'utf8', shell: win });
const sha = (s) => createHash('sha256').update(s).digest('hex');
const readCfg = (dest) => JSON.parse(readFileSync(path.join(dest, 'openclass.config.json'), 'utf8'));
const writeCfg = (dest, cfg) => writeFileSync(path.join(dest, 'openclass.config.json'), JSON.stringify(cfg, null, 2) + '\n');

const LAYOUTS = ['oc-l-cover', 'oc-l-section', 'oc-l-image-left', 'oc-l-image-right', 'oc-l-top-right', 'oc-l-top-left',
 'oc-l-multimedia', 'oc-l-text', 'oc-l-objectives', 'oc-l-two-cols', 'oc-l-two-titles', 'oc-l-code', 'oc-l-closing'];
// La activación necesita espacio para pregunta e instrucción: cualquier layout de contenido, no portada, sección ni cierre.
const CONTENIDO = LAYOUTS.filter((l) => !['oc-l-cover', 'oc-l-section', 'oc-l-closing'].includes(l));
// SHA-256 de las diapositivas 3–8 de plantillas/semana.md (1ffb54a), sin sustituir. Al insertar la activación como
// tercera diapositiva pasan a ser las 4–9; P2 GREEN no debe alterar su contenido.
const COLA = [
 ['## Resultados de aprendizaje', 'f0237be2abc4310d1f4b74eb4ba52320e64b4d3996978cd5f3cfa6e36dee5427'],
 ['## Ideas principales', 'b3f50468e60a0740626214b9dd37e3f90df93884b43b5defd6dc982db63c0c59'],
 ['## Actividad práctica', 'cb15db20678185a1753465814f23e8548c1b4aa4d68dd463421eea9a0d896607'],
 ['## Pregunta de repaso', '3bde09fc02bd637155b30f9e6c187e8dbebe1bb929231c06e002e46098fb2818'],
 ['## Cierre y próximos pasos', 'b48a564d32defcbf9eae6c51dcb02fd2ddc55a10aab23a0695b2633c29d161f3'],
 ['# ¡Gracias!', 'c29c5ac40c27dc019bd666592e2f009177ddab6a8e1651c1bbfdc32b8400a651'],
];
const INICIALES = 3; // portada, tema y activación
// NOTAS[0] pertenece a la portada y NOTAS[1] a la diapositiva del tema; las demás, a la cola original.
const NOTAS = [
 'Introducir el tema central de esta semana.',
 'Anunciar el bloque temático y conectar con conocimientos previos.',
 'Práctica guiada. La actividad funciona de forma local y no envía resultados a un servidor.',
 'Indicar la actividad de seguimiento y fuentes de consulta.',
];

// Misma división que autoPaginar.mjs (--- fuera de bloques de código) y el separador de notas de Reveal.
function diapositivas(source) {
 const chunks = []; let current = []; let fence = null;
 for (const line of String(source).replace(/\r\n?/g, '\n').split('\n')) {
  const m = line.match(/^\s*(`{3,}|~{3,})/);
  if (m) { if (!fence) fence = m[1][0]; else if (m[1][0] === fence) fence = null; }
  if (!fence && line.trim() === '---') { chunks.push(current.join('\n').trim()); current = []; } else current.push(line);
 }
 chunks.push(current.join('\n').trim());
 return chunks.filter(Boolean).map((raw) => {
  const corte = raw.search(/^\s*notes?:/im);
  const visible = (corte >= 0 ? raw.slice(0, corte) : raw).replace(/<!--[\s\S]*?-->/g, '');
  const limpiar = (s) => s.replace(/^#{1,6}\s+/gm, '').replace(/<[^>]+>/g, ' ').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const encabezados = [
   ...[...visible.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => ({ nivel: m[1].length, texto: limpiar(m[2]) })),
   ...[...visible.matchAll(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ nivel: Number(m[1]), texto: limpiar(m[2]) })),
  ];
  const h1 = encabezados.filter((e) => e.nivel === 1).map((e) => e.texto);
  const sinH1 = visible.replace(/^#\s+.+$/gm, '').replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, '');
  // Líneas que actúan como encabezado aunque no lo sean: «**SEMANA 2**» sola en su línea.
  const destacadas = [...visible.matchAll(/^\s*(\*\*|__)(.+?)\1\s*$/gm)].map((m) => limpiar(m[2]));
  return {
   raw, notas: corte >= 0 ? raw.slice(corte) : '', encabezados, h1, destacadas, visible,
   clases: (raw.match(/<!--\s*\.slide:[^>]*class="([^"]*)"/) || [, ''])[1].split(/\s+/).filter(Boolean),
   texto: limpiar(visible), textoSinH1: limpiar(sinH1),
  };
 });
}

// Predicados del contrato; devuelven la lista de incumplimientos (vacía = cumple).
function contratoPortada(s, { fullName, number, title, date }) {
 const fallos = [];
 if (s.h1.length !== 1 || s.h1[0] !== fullName) fallos.push(`H1=${JSON.stringify(s.h1)}; se esperaba [${JSON.stringify(fullName)}]`);
 if (!s.textoSinH1.includes(title)) fallos.push(`el tema semanal «${title}» no es visible fuera del H1`);
 if (!new RegExp(`\\bsemana\\s*0?${number}\\b`, 'i').test(s.textoSinH1)) fallos.push(`«Semana ${number}» no es visible fuera del H1`);
 if (date && !s.textoSinH1.includes(date)) fallos.push(`la fecha «${date}» no es visible fuera del H1`);
 return fallos;
}
// Segunda diapositiva: presenta weeks[].centralTheme como H2 con el layout institucional de sección.
// No se le exige pregunta ni participación: la interacción corresponde a la tercera diapositiva.
function temaVisible(s, centralTheme) {
 const fallos = [];
 if (!s.clases.includes('oc-l-section')) fallos.push(`layout ${JSON.stringify(s.clases)}; se esperaba oc-l-section`);
 if (s.h1.length) fallos.push(`H1 en la diapositiva del tema: ${JSON.stringify(s.h1)}`);
 if (!s.encabezados.some((e) => e.nivel === 2 && e.texto === centralTheme)) fallos.push(`centralTheme «${centralTheme}» no es el H2`);
 return fallos;
}
const PREGUNTA = /¿[^¿?]{8,}\?/;
// Contrato de activación de cada semana (tercera diapositiva):
//   weeks[].opening = { question, participation, durationMinutes }
//   question         texto no vacío; se muestra tal cual en la tercera diapositiva (no solo en Notes).
//   participation    enumeración cerrada (claves de PARTICIPACION); cualquier otro valor es un error de configuración.
//   durationMinutes  número de 1 a 3; 0, 4 o un texto como "2" son errores de configuración.
// La plantilla muestra en la tercera diapositiva la pregunta y, literal, PARTICIPACION[participation](durationMinutes).
// Un opening inválido hace fallar `npm run semana` nombrando el campo, sin escribir el Markdown de esa semana.
// Semana sin opening (predeterminado): pregunta visible que contiene weeks[].centralTheme
// (p. ej. «¿Qué sabes ya sobre {centralTheme}?»), participation 'respuesta-individual', durationMinutes 2.
// El predeterminado se deriva al generar: no se escribe en openclass.config.json.
const minutos = (n) => (n === 1 ? '1 minuto' : `${n} minutos`);
// Cada instrucción se realiza dentro de la reunión de Zoom o Teams, sin aplicaciones externas.
// Canales principales: chat y participación oral. Ambos dependen de la configuración de la reunión, así que cada
// instrucción nombra los dos: si uno está deshabilitado, queda el otro.
// Funciones opcionales: reacciones y salas de grupos. Si una instrucción las usa, incluye «Si no hay reacciones» o
// «Si no hay salas de grupos» seguido de una alternativa con un canal principal y sin otra función opcional.
// Ninguna instrucción afirma que las funciones de la reunión estén siempre habilitadas.
const PARTICIPACION = {
 'respuesta-individual': (n) => `Escribe tu respuesta individual en el chat de la reunión durante ${minutos(n)}. `
  + 'Si el chat no está disponible, compártela de forma oral cuando se te dé la palabra.',
 'discusion-parejas': (n) => `Comenta tu respuesta con un compañero en una sala de grupos durante ${minutos(n)}. `
  + 'Si no hay salas de grupos, en la sala general escribe tu respuesta en el chat y responde a la de un compañero, '
  + 'o compártela de forma oral cuando sea tu turno.',
 'hipotesis-grupal': (n) => `Formulen en grupo una hipótesis durante ${minutos(n)}: `
  + 'una persona la comparte por micrófono o en el chat y el resto indica su acuerdo con una reacción. '
  + 'Si no hay reacciones, el resto indica su acuerdo en el chat o de forma oral.',
 'propuesta-caso': (n) => `Propón una solución para el caso en el chat de la reunión o de forma oral durante ${minutos(n)} `
  + 'y marca con una reacción la propuesta que te convenza. Si no hay reacciones, indica en el chat o de forma oral cuál te convence.',
};
const MODALIDADES = Object.keys(PARTICIPACION);
const DURACIONES = [1, 2, 3];
const PREDETERMINADA = { participation: 'respuesta-individual', durationMinutes: 2 };
const PRINCIPALES = { chat: /\bchat\b/i, oral: /\bmicrófono\b|\boral(?:es|mente)?\b|\ben voz alta\b/i };
const OPCIONALES = { reacciones: /\breacci(?:ón|ones)\b/i, salas: /\bsalas? de grupos\b/i };
const CANALES = { ...PRINCIPALES, ...OPCIONALES };
const SIN = { reacciones: /\bsi no hay reacciones\b/i, salas: /\bsi no hay salas de grupos\b/i };
const SIEMPRE = /\bsiempre\b[^.]*\b(?:habilitad|disponib|activad)\w*|\b(?:habilitad|disponib|activad)\w*\s+siempre\b|\btodas las funciones\b/i;
// Ejemplos conocidos de herramientas ajenas a la reunión. Solo complementan la detección genérica de DEPENDENCIAS:
// el control no depende de esta lista.
const EXTERNAS = /\b(?:kahoot|mentimeter|menti|padlet|slido|socrative|quizizz|wooclap|nearpod|jamboard|miro|forms|whatsapp|qr|descarga|descargar|instala|instalar|regístrate|suscripción|premium)\b|aplicación externa|https?:\/\/|www\./i;
// Dependencias genéricas de sitios o aplicaciones fuera de la reunión, por acción, por tipo de recurso o por nombre de
// dominio (cualquier etiqueta.tld, sin lista de dominios).
const DEPENDENCIAS = [
 /\b(?:descarg|instal|escane|naveg|visit)\w*|\b(?:regístr|registr)(?:ate|ense|arse)\b|\bsuscr[ií]b\w*|\binicia(?:r|n)?\s+sesión\b/i,
 /\b(?:enlace|link|url|sitio|web|navegador|aplicaci[oó]n|app|plataforma|formulario|correo electrónico)s?\b|\bfuera de la reunión\b/i,
 /(?:^|[^\w@.])(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/\S*)?(?![\w.])/i,
];
// Enlaces relativos o absolutos en el Markdown o HTML visible: la activación no remite a ningún recurso.
// Las imágenes Markdown (![…](…)) no son enlaces; una imagen remota se detecta igualmente como URL.
const ENLACES = [
 /(?<!!)\[[^\]\n]*\]\([^)\n]*\)/,
 /(?<!!)\[[^\]\n]+\]\[[^\]\n]*\]|^ {0,3}\[[^\]\n]+\]:\s*\S/m,
 /<(?:[a-z][a-z0-9+.-]*:|www\.)[^>\s]*>/i,
 /<(?:a|iframe|embed|object|form|script|link)\b/i,
 /\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\bmailto:/i,
];
const conEnlaces = (t) => ENLACES.some((r) => r.test(t));
const dependeDeFuera = (t) => {
 const sinImagenes = t.replace(/!\[[^\]\n]*\]\([^)\n]*\)/g, ' ');
 return EXTERNAS.test(sinImagenes) || DEPENDENCIAS.some((r) => r.test(sinImagenes));
};
// Indicios para quien revisa la pregunta libre. No deciden el resultado: una pregunta con indicios puede ser legítima
// («¿Qué ocurre cuando una aplicación abre un formulario?») y una sin indicios de acceso puede exigir una herramienta
// («es obligatorio usar la app…»). Solo orientan la revisión humana de REVIEW_REQUIRED.
const PETICION = String.raw`\b(?:puedes|puede|pueden|podrías|podría|podrían|debes|debe|deben|tienes que|tiene que|tienen que|`
 + String.raw`hay que|necesitas|necesita|necesitan|vas a|van a|te invito a|les invito a)\s+`;
const SALIDA = new RegExp(String.raw`\b(?:descarg(?:a|ue|uen)|instal(?:a|e|en)|escane(?:a|e|en)|reg[ií]str(?:ate|ense)|`
 + String.raw`inici(?:a|e|en)\s+sesión|conéct(?:ate|ense))\b|${PETICION}(?:descargar|instalar|escanear|registrar(?:te|se)|`
 + String.raw`iniciar\s+sesión|conectar(?:te|se))\b`, 'i');
const ACCESO = new RegExp(String.raw`\b(?:abr(?:e|a|an)|visit(?:a|e|en)|ingres(?:a|e|en)|entr(?:a|en)|acced(?:e|a|an)|`
 + String.raw`complet(?:a|e|en)|(?:re)?llen(?:a|e|en))\b|${PETICION}(?:abrir|visitar|ingresar|entrar|acceder|completar|(?:re)?llenar)\b`, 'i');
const RECURSOS = [DEPENDENCIAS[1], DEPENDENCIAS[2], EXTERNAS];
const OBLIGACION = new RegExp(String.raw`\b(?:obligatori[oa]|necesari[oa]|imprescindible|requisito|requiere)\b|${PETICION}`, 'i');
function indiciosSalida(pregunta) {
 const acceso = pregunta.split(/[?!;]|\.(?=\s|$)/).some((clausula) => {
  if (SALIDA.test(clausula)) return true;
  const m = clausula.match(ACCESO);
  return m !== null && RECURSOS.some((r) => r.test(clausula.slice(m.index + m[0].length)));
 });
 return [...(acceso ? ['acción de acceso a un recurso'] : []), ...(OBLIGACION.test(pregunta) ? ['formulación de obligación'] : []),
  ...(dependeDeFuera(pregunta) ? ['menciona un recurso fuera de la reunión'] : [])];
}
const AUTO_PASS = 'AUTO_PASS', REVIEW_REQUIRED = 'REVIEW_REQUIRED', FAIL = 'FAIL';
// opening.question es texto libre: FAIL solo por hechos objetivos (vacía o con enlaces); en otro caso, REVIEW_REQUIRED
// con los indicios para el revisor. Nunca AUTO_PASS.
function revisarPregunta(question) {
 if (typeof question !== 'string' || !question.trim()) return { resultado: FAIL, motivos: ['opening.question'] };
 if (conEnlaces(question)) return { resultado: FAIL, motivos: ['la pregunta contiene enlaces'] };
 return { resultado: REVIEW_REQUIRED, indicios: indiciosSalida(question) };
}
const escapar = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Campos de opening que incumplen el contrato (vacía = válido).
function contratoApertura(o) {
 const fallos = [];
 if (typeof o?.question !== 'string' || !o.question.trim()) fallos.push('opening.question');
 if (!MODALIDADES.includes(o?.participation)) fallos.push('opening.participation');
 if (typeof o?.durationMinutes !== 'number' || !(o.durationMinutes >= 1 && o.durationMinutes <= 3)) fallos.push('opening.durationMinutes');
 return fallos;
}
// Texto que sigue a «Si no hay <función>» hasta la siguiente alternativa; null si la instrucción no la prevé.
function alternativa(instruccion, funcion) {
 const m = instruccion.match(SIN[funcion]);
 if (!m) return null;
 const resto = instruccion.slice(m.index + m[0].length);
 return resto.slice(0, Math.min(...Object.values(SIN).map((r) => { const k = resto.search(r); return k < 0 ? resto.length : k; })));
}
// Una instrucción es ejecutable en Zoom/Teams si nombra chat y participación oral, cada función opcional que usa tiene
// una alternativa con un canal principal que no depende de otra función opcional, no remite a enlaces ni a recursos
// externos y no da por hecho que las funciones de la reunión estén siempre habilitadas.
function contratoCanales(instruccion) {
 const fallos = [];
 for (const c of Object.keys(PRINCIPALES)) if (!PRINCIPALES[c].test(instruccion)) fallos.push(`sin canal principal: ${c}`);
 for (const f of Object.keys(OPCIONALES)) {
  if (!OPCIONALES[f].test(instruccion)) continue;
  const alt = alternativa(instruccion, f);
  if (alt === null) fallos.push(`${f} sin alternativa`);
  else if (!Object.values(PRINCIPALES).some((r) => r.test(alt)) || Object.values(OPCIONALES).some((r) => r.test(alt))) {
   fallos.push(`${f}: la alternativa no usa solo canales principales`);
  }
 }
 if (conEnlaces(instruccion)) fallos.push('contiene enlaces');
 if (dependeDeFuera(instruccion)) fallos.push('depende de una herramienta externa');
 if (SIEMPRE.test(instruccion)) fallos.push('asume funciones siempre habilitadas');
 return fallos;
}
// Lo que debe verse en la tercera diapositiva para un opening; sin question solo se exige la instrucción.
function aperturaVisible(s, { question, participation, durationMinutes }) {
 const fallos = [];
 if (question !== undefined && !s.texto.includes(question)) fallos.push(`la pregunta «${question}» no es visible`);
 const esperada = PARTICIPACION[participation](durationMinutes);
 if (!s.texto.includes(esperada)) fallos.push(`la instrucción «${esperada}» no es visible`);
 for (const m of MODALIDADES) for (const d of DURACIONES) {
  const otra = PARTICIPACION[m](d);
  if (otra !== esperada && s.texto.includes(otra)) fallos.push(`instrucción ajena visible: «${otra}»`);
 }
 return fallos;
}
// Controles deterministas de la tercera diapositiva (vacía = AUTO_PASS de la forma): título propio, layout de contenido,
// sin enlaces en todo el contenido visible (incluido el texto libre) y sin herramientas externas en el texto canónico.
// `libre` (opening.question o, en el predeterminado, centralTheme) se excluye de la búsqueda de herramientas: su sentido
// no se decide aquí, sino con revisarPregunta.
function actividadDigital(s, libre) {
 const fallos = [];
 const usados = s.clases.filter((c) => c.startsWith('oc-l-'));
 if (usados.length !== 1 || !CONTENIDO.includes(usados[0])) fallos.push(`layout ${JSON.stringify(usados)}; se esperaba uno de contenido`);
 if (s.h1.length) fallos.push(`H1 en la activación: ${JSON.stringify(s.h1)}`);
 if (!s.encabezados.some((e) => e.nivel === 2)) fallos.push('la activación no tiene título H2');
 if (conEnlaces(s.visible)) fallos.push('la activación contiene enlaces o iframes');
 const propio = libre ? s.texto.replaceAll(libre, '') : s.texto;
 if (dependeDeFuera(propio)) fallos.push('la activación menciona una herramienta externa');
 if (SIEMPRE.test(propio)) fallos.push('la activación asume funciones siempre habilitadas');
 return fallos;
}
// Resultado conjunto de la tercera diapositiva: FAIL si falla un control determinista o la pregunta es objetivamente
// inválida; REVIEW_REQUIRED si hay pregunta configurada; AUTO_PASS solo sin texto libre que revisar.
function evaluarActivacion(s, question) {
 const fallos = actividadDigital(s, question);
 if (fallos.length) return { resultado: FAIL, fallos };
 if (question === undefined) return { resultado: AUTO_PASS, fallos };
 const r = revisarPregunta(question);
 return r.resultado === FAIL ? { resultado: FAIL, fallos: r.motivos } : { resultado: REVIEW_REQUIRED, fallos, indicios: r.indicios };
}
// Bloque de activación que solo puede aparecer en la tercera diapositiva: sus preguntas, la instrucción de cualquier
// modalidad (también un fragmento sin la duración) y la duración «durante N minuto(s)». Una pregunta temática distinta
// u otras expresiones pedagógicas no cuentan como activación.
const FRAGMENTOS = Object.fromEntries(MODALIDADES.map((m) => [m, [...new Set(DURACIONES.flatMap((d) =>
 PARTICIPACION[m](d).split(`durante ${minutos(d)}`).map((t) => t.replace(/^[\s.,:;]+|[\s.,:;]+$/g, '')).filter((t) => t.length >= 20)))]]));
const DURACION = /\bdurante\s+[1-3]\s+minutos?\b/i;
function aperturaAusente(s, preguntas = []) {
 const fallos = [];
 for (const p of preguntas) if (s.texto.includes(p)) fallos.push(`pregunta de la activación duplicada: «${p}»`);
 for (const m of MODALIDADES) if (FRAGMENTOS[m].some((f) => s.texto.includes(f))) fallos.push(`modalidad ${m} duplicada`);
 if (DURACION.test(s.texto)) fallos.push('duración de la activación duplicada');
 return fallos;
}
// Marcadores de generación sin sustituir. {{BASE_URL}} es el único token de ejecución: lo resuelve Presentacion.jsx.
const MARCADOR = /\{\{[^{}]*\}\}/g;
const pendientes = (raw) => (raw.match(MARCADOR) ?? []).filter((m) => m !== '{{BASE_URL}}');
// Encabezados o líneas destacadas que repiten «SEMANA N». `permitido` (centralTheme) se descuenta: el tema configurado
// puede contener la palabra semana, como el predeterminado «Tema central de la semana 2».
const repiteSemana = (s, number, permitido = '') => [...s.encabezados.map((e) => e.texto), ...s.destacadas]
 .map((t) => (permitido ? t.replaceAll(permitido, '') : t))
 .filter((t) => new RegExp(`\\bsemana\\s*0?${number}\\b`, 'i').test(t));

// Cursos desechables generados con el CLI real; la plantilla y los cursos reales no se tocan.
// Entre A, B, C (predeterminado) y D se cubren las cuatro modalidades y las duraciones 1, 2 y 3.
const PREGUNTA_A = '¿Qué sensor de tu entorno cotidiano te avisa de algo sin que lo notes?';
const PREGUNTA_B = '¿Qué datos tuyos compartiste hoy sin pensarlo dos veces?';
const PREGUNTA_D = '¿Cómo resolverías este problema utilizando software?';
const CURSOS = {
 A: { fullName: 'Fundamentos de Internet de las Cosas', number: 3, title: 'Sensores y actuadores', date: 'Junio 15 de 2026',
  centralTheme: 'Lectura de sensores analógicos', activity: 'Informe del laboratorio de sensores',
  opening: { question: PREGUNTA_A, participation: 'discusion-parejas', durationMinutes: 2 } },
 B: { fullName: 'Ética y Ciudadanía Digital', number: 5, title: 'Privacidad y datos personales', date: 'Septiembre 2 de 2026',
  centralTheme: 'Huella digital y consentimiento', activity: 'Foro sobre privacidad',
  opening: { question: PREGUNTA_B, participation: 'hipotesis-grupal', durationMinutes: 3 } },
 D: { fullName: 'Lógica y Programación', number: 4, title: 'Resolución de problemas con software', date: 'Octubre 7 de 2026',
  centralTheme: 'Algoritmos y diagramas de flujo', activity: 'Taller de algoritmos',
  opening: { question: PREGUNTA_D, participation: 'propuesta-caso', durationMinutes: 1 } },
};
// Configuraciones inválidas: se aplican sobre la apertura válida de D, en la semana 6 del curso D.
const INVALIDAS = [
 ['duración 0', { durationMinutes: 0 }, 'opening.durationMinutes'],
 ['duración 4', { durationMinutes: 4 }, 'opening.durationMinutes'],
 ['modalidad desconocida', { participation: 'lluvia-de-ideas' }, 'opening.participation'],
 ['duración no numérica', { durationMinutes: '2' }, 'opening.durationMinutes'],
 ['pregunta vacía', { question: '   ' }, 'opening.question'],
];
const PROVISIONAL = { fullName: 'Curso provisional de regeneración', title: 'Título provisional de regeneración', date: 'Enero 1 de 2026' };
let temp; const deck = {}; let primeraA;

function crear(nombre) {
 const dest = path.join(temp, nombre);
 const r = spawnSync(process.execPath, [bin, dest], { encoding: 'utf8' });
 assert.equal(r.status, 0, r.stderr);
 return dest;
}
const md = (dest, n) => path.join(dest, `semanas/${readCfg(dest).course.shortName}_semana${n}.md`);
function configurar(dest, { fullName, number, ...semana }) {
 const cfg = readCfg(dest);
 cfg.course.fullName = fullName;
 Object.assign(cfg.weeks.find((w) => Number(w.number) === number), semana);
 writeCfg(dest, cfg);
}
function generar(dest, ...a) {
 const r = npm(dest, 'run', 'semana', '--', ...a);
 assert.equal(r.status, 0, r.stdout + r.stderr);
}

before(() => {
 temp = mkdtempSync(path.join(realpathSync.native(os.tmpdir()), 'openclass-portada-'));
 // A: primera generación con valores provisionales y regeneración forzada con los definitivos.
 const a = crear('curso-a');
 configurar(a, { ...CURSOS.A, ...PROVISIONAL });
 generar(a, '3');
 primeraA = readFileSync(md(a, 3), 'utf8');
 configurar(a, CURSOS.A);
 generar(a, '3', '--force-content');
 deck.A = { dest: a, source: readFileSync(md(a, 3), 'utf8'), ...CURSOS.A };
 // B: otro nombre, semana y fecha.
 const b = crear('curso-b');
 configurar(b, CURSOS.B);
 generar(b, '5');
 deck.B = { dest: b, source: readFileSync(md(b, 5), 'utf8'), ...CURSOS.B };
 // C: valores predeterminados, sin apertura configurada.
 const c = crear('curso-c');
 generar(c, '2');
 const cfg = readCfg(c), w2 = cfg.weeks.find((w) => Number(w.number) === 2);
 deck.C = { dest: c, source: readFileSync(md(c, 2), 'utf8'), fullName: cfg.course.fullName, ...w2, number: 2 };
 // D: apertura «propuesta-caso» de 1 minuto; su semana 6 se usa para las configuraciones inválidas.
 const d = crear('curso-d');
 configurar(d, CURSOS.D);
 generar(d, '4');
 deck.D = { dest: d, source: readFileSync(md(d, 4), 'utf8'), ...CURSOS.D };
});
after(() => temp && rmSync(temp, { recursive: true, force: true }));

// ---------- Controles positivos ----------

test('[GREEN] el analizador ignora Notes, comentarios y separadores dentro de código', () => {
 const falso = [
  '# OpenClass — Tema', '<!-- .slide: class="oc-demo oc-l-cover" -->', '<!-- Curso real · ¿Pregunta oculta en comentario? -->',
  '**SEMANA 4**', '', 'Notes:', 'Curso real', 'Tema', '¿Qué pregunta solo está en las notas?',
  '---', '## Tema central', '<!-- .slide: class="oc-demo oc-l-section" -->',
  '---', '## Activación', '```', '---', '```', 'Notes:', PREGUNTA_A, PARTICIPACION['discusion-parejas'](2),
 ].join('\n');
 const [portada, tema, apertura, ...resto] = diapositivas(falso);
 assert.equal(resto.length, 0, 'el --- dentro de ``` no separa diapositivas');
 assert.deepEqual(portada.h1, ['OpenClass — Tema']);
 assert.ok(!portada.texto.includes('Curso real') && !PREGUNTA.test(portada.texto));
 assert.ok(contratoPortada(portada, { fullName: 'Curso real', number: 4, title: 'Tema', date: '' }).length > 0);
 assert.deepEqual(temaVisible(tema, 'Tema central'), []);
 assert.equal(aperturaVisible(apertura, CURSOS.A.opening).length, 2, 'pregunta e instrucción solo en Notes no cuentan');
 assert.deepEqual(repiteSemana(portada, 4), ['SEMANA 4'], 'una línea en negrita cuenta como encabezado');
});

test('[GREEN] el contrato de las tres diapositivas iniciales es satisfacible con los layouts existentes', () => {
 const { centralTheme, opening } = CURSOS.A;
 const ejemplo = [
  '# Fundamentos de Internet de las Cosas', '<!-- .slide: class="oc-demo oc-l-cover" -->', '', '## Sensores y actuadores', '',
  '**SEMANA 3**', '', 'Junio 15 de 2026', '', 'Notes:', 'Presentar el curso.',
  '---', `## ${centralTheme}`, '<!-- .slide: class="oc-demo oc-l-section" -->', '', 'Notes:', 'Anunciar el bloque temático.',
  '---', '## Activación', '<!-- .slide: class="oc-demo oc-l-text" -->', '', PREGUNTA_A, '', PARTICIPACION['discusion-parejas'](2),
 ].join('\n');
 const [portada, segunda, tercera] = diapositivas(ejemplo);
 assert.deepEqual(contratoPortada(portada, CURSOS.A), []);
 assert.deepEqual(temaVisible(segunda, centralTheme), []);
 assert.deepEqual(aperturaVisible(tercera, opening), []);
 assert.deepEqual(actividadDigital(tercera, opening.question), []);
 assert.equal(evaluarActivacion(tercera, opening.question).resultado, REVIEW_REQUIRED, 'la forma pasa; la pregunta libre queda en revisión');
 for (const s of [segunda, tercera]) assert.deepEqual(repiteSemana(s, 3, centralTheme), []);
 assert.ok(aperturaVisible(segunda, opening).length > 0, 'la activación se evalúa en la tercera diapositiva, no en la del tema');
 assert.ok(temaVisible({ ...segunda, clases: ['oc-demo', 'oc-l-text'] }, centralTheme).length > 0, 'el tema exige oc-l-section');
 assert.ok(temaVisible(segunda, 'Otro tema').length > 0, 'el H2 del tema es centralTheme');
 assert.ok(actividadDigital({ ...tercera, clases: ['oc-demo', 'oc-l-section'] }, opening.question).length > 0,
  'la activación usa un layout de contenido');
 assert.equal(aperturaVisible(tercera, { ...opening, participation: 'hipotesis-grupal' }).length, 2,
  'otra modalidad exige su propia instrucción y rechaza la ajena');
 assert.equal(aperturaVisible(tercera, { ...opening, durationMinutes: 3 }).length, 2, 'la duración forma parte de la instrucción');
 const [externa] = diapositivas(['## Activación', '<!-- .slide: class="oc-demo oc-l-text" -->', '',
  '<iframe src="https://www.mentimeter.com/app"></iframe>', '', PREGUNTA_A, '', 'Responde en Mentimeter.'].join('\n'));
 assert.equal(actividadDigital(externa, PREGUNTA_A).length, 2, 'un iframe o una plataforma externa invalidan la activación');
});

test('[GREEN] contrato opening: enumeración cerrada, duración de 1 a 3 y pregunta no vacía; la pregunta libre queda en revisión', () => {
 assert.deepEqual(MODALIDADES, ['respuesta-individual', 'discusion-parejas', 'hipotesis-grupal', 'propuesta-caso']);
 const instrucciones = MODALIDADES.flatMap((m) => DURACIONES.map((d) => [d, PARTICIPACION[m](d)]));
 assert.equal(new Set(instrucciones.map(([, t]) => t)).size, MODALIDADES.length * DURACIONES.length,
  'cada modalidad y duración da una instrucción distinta');
 for (const [d, t] of instrucciones) {
  assert.ok(!/^(?:no|nunca|evita)\b/i.test(t) && t.includes(`durante ${minutos(d)}`), `afirmativa y con duración: «${t}»`);
 }
 for (const n of ['A', 'B', 'D']) assert.deepEqual(contratoApertura(CURSOS[n].opening), [], `curso ${n}`);
 const usadas = [...['A', 'B', 'D'].map((n) => CURSOS[n].opening), PREDETERMINADA];
 assert.deepEqual(usadas.map((o) => o.participation).sort(), [...MODALIDADES].sort(), 'los cursos cubren las cuatro modalidades');
 assert.deepEqual([...new Set(usadas.map((o) => o.durationMinutes))].sort(), DURACIONES, 'y las duraciones 1, 2 y 3');
 for (const [caso, cambio, campo] of INVALIDAS) {
  assert.deepEqual(contratoApertura({ ...CURSOS.D.opening, ...cambio }), [campo], caso);
 }
 // Controles editoriales de opening.question: superar los controles sintácticos no equivale a validación semántica.
 assert.deepEqual(revisarPregunta('   '), { resultado: FAIL, motivos: ['opening.question'] }, 'pregunta vacía: FAIL objetivo');
 for (const q of ['¿Qué opinas de [este caso](./caso)?', '¿Qué opinas de <a href="./caso">este caso</a>?',
  '¿Qué opinas de este caso? https://ejemplo.com/caso']) {
  assert.deepEqual(revisarPregunta(q), { resultado: FAIL, motivos: ['la pregunta contiene enlaces'] }, `enlace en la pregunta: ${q}`);
 }
 const falsoPositivo = '¿Qué ocurre cuando una aplicación abre un formulario?';
 const r1 = revisarPregunta(falsoPositivo);
 assert.equal(r1.resultado, REVIEW_REQUIRED, 'mencionar una aplicación no la rechaza automáticamente');
 assert.ok(r1.indicios.length > 0, 'los indicios orientan al revisor sin decidir el resultado');
 const falsoNegativo = 'Para responder, es obligatorio usar la app EncuestaYa. ¿Qué eliges?';
 const r2 = revisarPregunta(falsoNegativo);
 assert.equal(r2.resultado, REVIEW_REQUIRED, 'una dependencia externa no detectada por forma verbal no se aprueba automáticamente');
 assert.ok(!r2.indicios.includes('acción de acceso a un recurso'), 'el patrón de acceso no la reconoce: la decisión es humana');
 const preguntas = [PREGUNTA_A, PREGUNTA_B, PREGUNTA_D, falsoPositivo, falsoNegativo,
  '¿Puedes abrir la app EncuestaYa y completar el formulario antes de responder?', 'Abre la URL encuestaya.app/sala: ¿qué opción elegiste?',
  '¿Qué aplicación utilizarías para resolver este problema?'];
 for (const q of preguntas) assert.equal(revisarPregunta(q).resultado, REVIEW_REQUIRED, `ninguna pregunta libre es AUTO_PASS: ${q}`);
 assert.deepEqual(revisarPregunta(PREGUNTA_A).indicios, [], 'sin indicios también requiere revisión');
});

test('[GREEN] cada modalidad usa chat y participación oral; reacciones y salas de grupos son opcionales y tienen alternativa', () => {
 for (const m of MODALIDADES) for (const d of DURACIONES) {
  assert.deepEqual(contratoCanales(PARTICIPACION[m](d)), [], `${m}, ${minutos(d)}`);
 }
 const usados = new Set(MODALIDADES.flatMap((m) => Object.keys(CANALES).filter((c) => CANALES[c].test(PARTICIPACION[m](2)))));
 assert.deepEqual([...usados].sort(), Object.keys(CANALES).sort(), 'entre las modalidades se usan los cuatro canales');
 // Controles positivos: alternativas reales para las funciones opcionales.
 const parejas = alternativa(PARTICIPACION['discusion-parejas'](2), 'salas');
 assert.ok(parejas && /\bsala general\b/i.test(parejas) && PRINCIPALES.chat.test(parejas) && PRINCIPALES.oral.test(parejas),
  'en parejas, sin salas de grupos, se intercambian ideas en la sala general por chat o de forma oral');
 for (const m of ['hipotesis-grupal', 'propuesta-caso']) {
  const sin = alternativa(PARTICIPACION[m](2), 'reacciones');
  assert.ok(sin && Object.values(PRINCIPALES).some((r) => r.test(sin)) && !OPCIONALES.reacciones.test(sin), `${m}: participación sin reacciones`);
 }
 assert.deepEqual(contratoCanales('Responde en el chat o de forma oral durante 1 minuto y marca con una reacción la que te convenza. '
  + 'Si no hay reacciones, escribe «de acuerdo» en el chat.'), [], 'alternativa válida escrita de otra forma');
 for (const m of MODALIDADES) assert.ok(!SIEMPRE.test(PARTICIPACION[m](2)), `${m}: no afirma funciones siempre habilitadas`);
 // Controles negativos: dependencia exclusiva de funciones opcionales.
 assert.deepEqual(contratoCanales('Piensa tu respuesta durante 2 minutos.'), ['sin canal principal: chat', 'sin canal principal: oral']);
 assert.deepEqual(contratoCanales('Marca con una reacción la propuesta que te convenza durante 1 minuto.'),
  ['sin canal principal: chat', 'sin canal principal: oral', 'reacciones sin alternativa']);
 assert.deepEqual(contratoCanales('Comenta con un compañero en una sala de grupos durante 2 minutos.'),
  ['sin canal principal: chat', 'sin canal principal: oral', 'salas sin alternativa']);
 assert.deepEqual(contratoCanales('Formulen en grupo una hipótesis durante 3 minutos: una persona la comparte por micrófono o en el chat '
  + 'y el resto indica su acuerdo con una reacción.'), ['reacciones sin alternativa'], 'hipótesis sin alternativa a las reacciones');
 assert.deepEqual(contratoCanales('Propón una solución en el chat o de forma oral durante 1 minuto y marca con una reacción la que te convenza.'),
  ['reacciones sin alternativa'], 'propuesta sin alternativa a las reacciones');
 assert.deepEqual(contratoCanales('Comenta tu respuesta en una sala de grupos, en el chat o de forma oral durante 2 minutos. '
  + 'Si no hay salas de grupos, indica tu acuerdo con una reacción.'),
  ['reacciones sin alternativa', 'salas: la alternativa no usa solo canales principales'], 'alternativa que depende de otra función opcional');
 assert.deepEqual(contratoCanales('Escribe en el chat o de forma oral durante 2 minutos: todas las funciones de la reunión están siempre habilitadas.'),
  ['asume funciones siempre habilitadas']);
 assert.deepEqual(contratoCanales('Escribe en el chat o de forma oral durante 2 minutos; el chat siempre está disponible.'),
  ['asume funciones siempre habilitadas']);
 // Controles negativos: recursos fuera de la reunión.
 assert.deepEqual(contratoCanales('Responde en Mentimeter y comparte el resultado en el chat o de forma oral durante 2 minutos.'),
  ['depende de una herramienta externa']);
 assert.deepEqual(contratoCanales('Escanea el código QR y escribe en el chat o de forma oral durante 1 minuto.'), ['depende de una herramienta externa']);
 assert.deepEqual(contratoCanales('Escribe en el chat o de forma oral durante 2 minutos tras leer [la guía](./guia).'), ['contiene enlaces']);
});

test('[GREEN] controles deterministas de la activación: sin enlaces relativos o absolutos ni dependencias externas en el texto canónico', () => {
 const tercera = (extra, question = PREGUNTA_A, instruccion = PARTICIPACION['discusion-parejas'](2)) => diapositivas(['## Activación',
  '<!-- .slide: class="oc-demo oc-l-text" -->', '', question, '', instruccion, '', extra].join('\n'))[0];
 assert.deepEqual(actividadDigital(tercera(''), PREGUNTA_A), [], 'control positivo: pregunta e instrucción');
 assert.deepEqual(actividadDigital(tercera('Piensa en un ejemplo cotidiano antes de responder.'), PREGUNTA_A), [],
  'control positivo: una indicación pedagógica ordinaria');
 assert.deepEqual(actividadDigital(tercera('![Sensor](./img/sensor.png)'), PREGUNTA_A), [], 'control positivo: una imagen local no es un enlace');
 const enlaces = ['[Recurso](/tool)', '[Recurso](./tool)', '[Recurso](../tool)', '[Recurso](tool)', '[Recurso](https://ejemplo.com)',
  '[Recurso](https://ejemplo.com/tool "título")', '[Recurso][r]\n\n[r]: ./tool', '[r]: /tool', '<https://ejemplo.com>',
  '<a href="/tool">Recurso</a>', '<a href="../tool">Recurso</a>', '<a href="https://ejemplo.com">Recurso</a>', "<A HREF='./tool'>Recurso</A>",
  '<iframe src="./tool"></iframe>', 'mailto:docente@ejemplo.com', 'https://ejemplo.com', 'www.ejemplo.com'];
 for (const e of enlaces) {
  assert.ok(actividadDigital(tercera(e), PREGUNTA_A).includes('la activación contiene enlaces o iframes'), `enlace detectado: ${e}`);
 }
 assert.ok(actividadDigital(tercera('', '¿Qué opinas de [este caso](./caso)?'), '¿Qué opinas de [este caso](./caso)?')
  .includes('la activación contiene enlaces o iframes'), 'tampoco se admite un enlace dentro de la pregunta configurada');
 // Dependencias de sitios o aplicaciones que no están en ninguna lista de nombres: la detección es genérica.
 const dependencias = ['Ingresa a herramientax.io/sala y vota.', 'Vota en ejemplo.com antes de seguir.', 'Abre la app EncuestaYa en tu celular.',
  'Completa el formulario de la plataforma del curso.', 'Responde la encuesta en el sitio web del curso.',
  'Inicia sesión con tu cuenta institucional.', 'Escanea el código de la pantalla con tu celular.', 'Continúa la actividad fuera de la reunión.'];
 for (const e of dependencias) {
  assert.ok(!EXTERNAS.test(e), `fuera de la lista de nombres: ${e}`);
  assert.ok(actividadDigital(tercera(e), PREGUNTA_A).includes('la activación menciona una herramienta externa'), `dependencia detectada: ${e}`);
 }
 assert.ok(actividadDigital(tercera('Las reacciones y las salas de grupos siempre están habilitadas.'), PREGUNTA_A)
  .includes('la activación asume funciones siempre habilitadas'));
 // La pregunta configurada es texto libre: los controles deterministas solo la rechazan por enlaces. Mencione o exija
 // herramientas, la diapositiva no es AUTO_PASS: pasa a REVIEW_REQUIRED con indicios para el revisor.
 const individual = PARTICIPACION['respuesta-individual'](2);
 const libres = ['¿Qué ocurre cuando una aplicación abre un formulario?', 'Para responder, es obligatorio usar la app EncuestaYa. ¿Qué eliges?',
  '¿Puedes abrir la app EncuestaYa y completar el formulario antes de responder?', 'Abre la URL encuestaya.app/sala: ¿qué opción elegiste?',
  'Completa el formulario de inscripción y luego responde: ¿qué esperas del curso?',
  '¿Qué aplicación utilizarías para resolver este problema?', '¿Qué riesgos tiene depender de una aplicación externa?'];
 for (const q of libres) {
  assert.deepEqual(actividadDigital(tercera('', q, individual), q), [], `sin fallo determinista: ${q}`);
  const r = evaluarActivacion(tercera('', q, individual), q);
  assert.equal(r.resultado, REVIEW_REQUIRED, `revisión humana: ${q}`);
  assert.ok(r.indicios.length > 0, `indicios para el revisor: ${q}`);
 }
 assert.equal(evaluarActivacion(tercera('', '¿Qué opinas de [este caso](./caso)?', individual), '¿Qué opinas de [este caso](./caso)?').resultado,
  FAIL, 'un enlace en la pregunta es un FAIL objetivo');
 assert.equal(evaluarActivacion(tercera('Abre la app EncuestaYa.'), PREGUNTA_A).resultado, FAIL,
  'fuera de la pregunta libre, una herramienta externa es un FAIL objetivo');
 const centralTheme = 'Aplicaciones web y formularios';
 const predeterminada = diapositivas(['## Activación', '<!-- .slide: class="oc-demo oc-l-text" -->', '',
  `¿Qué sabes ya sobre ${centralTheme}?`, '', individual].join('\n'))[0];
 assert.deepEqual(actividadDigital(predeterminada, centralTheme), [], 'en el predeterminado, centralTheme es texto libre y no se rechaza por mencionar una aplicación');
 assert.equal(evaluarActivacion(diapositivas(['## Activación', '<!-- .slide: class="oc-demo oc-l-text" -->', '', individual].join('\n'))[0]).resultado,
  AUTO_PASS, 'sin texto libre, la forma demostrada es AUTO_PASS');
});

test('[GREEN] la segunda diapositiva presenta solo el tema; el bloque opening se reconoce sin prohibir el lenguaje pedagógico', () => {
 const { centralTheme, opening } = CURSOS.A;
 const segunda = (...extra) => diapositivas([`## ${centralTheme}`, '<!-- .slide: class="oc-demo oc-l-section" -->', '', ...extra].join('\n'))[0];
 const instruccion = PARTICIPACION[opening.participation](opening.durationMinutes);
 const tematica = segunda('¿Por qué una señal analógica necesita conversión antes de procesarse?', '',
  'Reflexionemos sobre este tema y compartamos ejemplos durante la clase.');
 // Control positivo: una pregunta temática no es un rompehielos.
 assert.deepEqual(temaVisible(tematica, centralTheme), []);
 assert.deepEqual(aperturaAusente(tematica, [opening.question]), [], 'pregunta temática y expresiones ordinarias admitidas');
 assert.ok(aperturaVisible(tematica, opening).length > 0, 'la pregunta temática no satisface el bloque opening');
 for (const m of MODALIDADES) assert.ok(FRAGMENTOS[m].length > 0, `${m}: fragmentos reconocibles`);
 // Controles negativos: el bloque opening, completo o en partes, duplicado en la segunda diapositiva.
 assert.deepEqual(aperturaAusente(segunda(opening.question), [opening.question]), [`pregunta de la activación duplicada: «${opening.question}»`]);
 assert.deepEqual(aperturaAusente(segunda(instruccion), [opening.question]),
  [`modalidad ${opening.participation} duplicada`, 'duración de la activación duplicada']);
 assert.deepEqual(aperturaAusente(segunda('Comenta tu respuesta con un compañero en una sala de grupos.'), []),
  ['modalidad discusion-parejas duplicada'], 'modalidad sin duración');
 assert.deepEqual(aperturaAusente(segunda('Piensa en ello durante 2 minutos.'), []), ['duración de la activación duplicada']);
 for (const m of MODALIDADES) for (const d of DURACIONES) {
  assert.ok(aperturaAusente(segunda(PARTICIPACION[m](d)), []).includes(`modalidad ${m} duplicada`), `${m}, ${minutos(d)}`);
 }
});

test('[GREEN] ninguna diapositiva generada de los cursos A, B, C y D conserva marcadores {{…}}', () => {
 for (const [nombre, { source }] of Object.entries(deck)) {
  diapositivas(source).forEach((s, i) => assert.deepEqual(pendientes(s.raw), [], `curso ${nombre}, diapositiva ${i + 1}`));
 }
 assert.deepEqual(pendientes('{{BASE_URL}}x {{TITULO}} {{ TEMA }}'), ['{{TITULO}}', '{{ TEMA }}'], 'el detector sí ve marcadores pendientes');
});

test('[GREEN] la plantilla y los cursos generados conservan los 13 layouts', async () => {
 const fuente = await import(pathToFileURL(path.join(root, 'template/galeria/layouts.mjs')).href);
 assert.deepEqual(fuente.LAYOUTS.map((l) => l.clase).sort(), [...LAYOUTS].sort());
 for (const { dest, source } of Object.values(deck)) {
  const curso = await import(pathToFileURL(path.join(dest, 'galeria/layouts.mjs')).href);
  assert.deepEqual(curso.LAYOUTS.map((l) => l.clase).sort(), [...LAYOUTS].sort());
  const demo = readFileSync(path.join(dest, 'demo-completa.md'), 'utf8');
  for (const clase of LAYOUTS) assert.ok(demo.includes(clase), `demo-completa.md contiene ${clase}`);
  for (const s of diapositivas(source)) {
   const usados = s.clases.filter((c) => c.startsWith('oc-l-'));
   assert.equal(usados.length, 1, `una sola clase de layout en «${s.raw.split('\n')[0]}»`);
   assert.ok(LAYOUTS.includes(usados[0]), `${usados[0]} es uno de los 13 layouts`);
  }
 }
});

test('[GREEN] portada con oc-l-cover y segunda diapositiva con centralTheme en oc-l-section', () => {
 for (const [nombre, { source, centralTheme }] of Object.entries(deck)) {
  const [portada, segunda] = diapositivas(source);
  assert.ok(portada.clases.includes('oc-l-cover'), `curso ${nombre}: portada`);
  assert.deepEqual(temaVisible(segunda, centralTheme), [], `curso ${nombre}: tema`);
  assert.ok(portada.notas.includes(NOTAS[0]), `curso ${nombre}: notas de la portada`);
  assert.ok(segunda.notas.includes(NOTAS[1]), `curso ${nombre}: notas del tema`);
 }
});

test('[GREEN] las diapositivas originales 3–8 conservan su contenido al final del deck (SHA-256)', () => {
 const plantilla = diapositivas(readFileSync(path.join(root, 'template/plantillas/semana.md'), 'utf8')).slice(-COLA.length);
 assert.deepEqual(plantilla.map((s) => sha(s.raw)), COLA.map(([, h]) => h), 'plantillas/semana.md');
 for (const [nombre, { source, activity }] of Object.entries(deck)) {
  const cola = diapositivas(source).slice(-COLA.length);
  cola.forEach((s, i) => {
   assert.equal(s.raw.split('\n')[0], COLA[i][0], `curso ${nombre}: orden`);
   assert.equal(sha(s.raw.replaceAll(activity, '{{ACTIVIDAD}}')), COLA[i][1], `curso ${nombre}: ${COLA[i][0]}`);
  });
 }
});

test('[GREEN] las notas del presentador se conservan', () => {
 for (const [nombre, { source }] of Object.entries(deck)) {
  const notas = diapositivas(source).map((s) => s.notas).join('\n');
  for (const nota of NOTAS) assert.ok(notas.includes(nota), `curso ${nombre}: «${nota}»`);
 }
});

test('[GREEN] la regeneración forzada aplica los cambios de configuración', () => {
 assert.ok(primeraA.includes(PROVISIONAL.date) && primeraA.includes(PROVISIONAL.title), 'la primera generación usó los valores provisionales');
 const { source, title, date, centralTheme } = deck.A;
 for (const v of [title, date, centralTheme]) assert.ok(source.includes(v), `aplicado: ${v}`);
 for (const v of Object.values(PROVISIONAL)) assert.ok(!source.includes(v), `retirado: ${v}`);
 assert.notEqual(deck.A.source, deck.B.source);
});

test('[GREEN] número de semana y fecha visibles en la portada fuera del H1', () => {
 for (const [nombre, { source, number, date }] of Object.entries(deck)) {
  const [portada] = diapositivas(source);
  assert.match(portada.textoSinH1, new RegExp(`\\bsemana\\s*0?${number}\\b`, 'i'), `curso ${nombre}`);
  assert.ok(portada.textoSinH1.includes(date), `curso ${nombre}: fecha`);
 }
});

test('[GREEN] tema y activación no repiten «SEMANA N» como encabezado', () => {
 for (const [nombre, { source, number, centralTheme }] of Object.entries(deck)) {
  const [, segunda, tercera] = diapositivas(source);
  assert.deepEqual(repiteSemana(segunda, number, centralTheme), [], `curso ${nombre}: tema`);
  assert.deepEqual(repiteSemana(tercera, number, centralTheme), [], `curso ${nombre}: tercera diapositiva`);
 }
});

// ---------- RED: portada ----------
// Hoy el H1 es «OpenClass — {{TITULO}}»: no muestra course.fullName y absorbe el tema semanal.

for (const nombre of ['A', 'B', 'C']) {
 test(`[RED] portada del curso ${nombre}: H1 único igual a course.fullName`, () => {
  const { source, fullName } = deck[nombre];
  const [portada] = diapositivas(source);
  assert.deepEqual(portada.h1, [fullName]);
 });
}

test('[RED] portada: el tema semanal es visible sin sustituir el nombre del curso', () => {
 for (const [nombre, d] of Object.entries(deck)) {
  const [portada] = diapositivas(d.source);
  assert.deepEqual(contratoPortada(portada, d), [], `curso ${nombre}`);
 }
});

// ---------- RED: tercera diapositiva (activación sincrónica) ----------
// Hoy la tercera diapositiva es «## Resultados de aprendizaje»: no hay pregunta ni dinámica de participación.

test('[RED] activación: pregunta e instrucción configuradas visibles en la tercera diapositiva', () => {
 for (const nombre of ['A', 'B', 'D']) {
  const [, , tercera] = diapositivas(deck[nombre].source);
  const { opening } = deck[nombre];
  assert.deepEqual(aperturaVisible(tercera, opening), [], `curso ${nombre}: «${tercera.texto}»`);
  assert.deepEqual(actividadDigital(tercera, opening.question), [], `curso ${nombre}: forma de la activación`);
  assert.equal(evaluarActivacion(tercera, opening.question).resultado, REVIEW_REQUIRED, `curso ${nombre}: pregunta libre en revisión`);
 }
});

test('[RED] activación: cada modalidad muestra solo su propia instrucción', () => {
 const visibles = Object.fromEntries(Object.entries(deck).map(([n, { source }]) => [n, diapositivas(source)[2].texto]));
 const esperadas = { A: CURSOS.A.opening, B: CURSOS.B.opening, C: PREDETERMINADA, D: CURSOS.D.opening };
 for (const [n, o] of Object.entries(esperadas)) {
  const propia = PARTICIPACION[o.participation](o.durationMinutes);
  for (const [m, texto] of Object.entries(visibles)) {
   assert.equal(texto.includes(propia), m === n, `«${propia}» ${m === n ? 'visible' : 'ausente'} en el curso ${m}`);
  }
 }
 assert.ok(!visibles.A.includes(PREGUNTA_B) && !visibles.B.includes(PREGUNTA_A) && !visibles.D.includes(PREGUNTA_A),
  'cada semana usa su propia pregunta');
});

test('[RED] exclusividad: el bloque opening está en la tercera diapositiva y no se duplica en la portada ni en la del tema', () => {
 const esperadas = { A: CURSOS.A.opening, B: CURSOS.B.opening, C: PREDETERMINADA, D: CURSOS.D.opening };
 for (const [nombre, d] of Object.entries(deck)) {
  const [portada, segunda, tercera] = diapositivas(d.source);
  const o = esperadas[nombre];
  assert.deepEqual(aperturaVisible(tercera, o), [], `curso ${nombre}: bloque opening en la tercera diapositiva`);
  const preguntas = [...new Set([...(o.question ? [o.question] : []), ...(tercera.texto.match(/¿[^¿?]+\?/g) ?? [])])];
  assert.ok(preguntas.length > 0, `curso ${nombre}: la tercera diapositiva muestra la pregunta de activación`);
  assert.deepEqual(temaVisible(segunda, d.centralTheme), [], `curso ${nombre}: la segunda diapositiva presenta centralTheme`);
  assert.deepEqual(aperturaAusente(segunda, preguntas), [], `curso ${nombre}: sin activación en la diapositiva del tema`);
  assert.deepEqual(aperturaAusente(portada, preguntas), [], `curso ${nombre}: sin activación en la portada`);
 }
});

test('[RED] activación predeterminada: sin opening, pregunta con centralTheme y respuesta individual de 2 minutos', () => {
 const { dest, source, centralTheme } = deck.C;
 const [, , tercera] = diapositivas(source);
 assert.match(tercera.texto, new RegExp(`¿[^¿?]*${escapar(centralTheme)}[^¿?]*\\?`), 'pregunta visible contextualizada con centralTheme');
 assert.deepEqual(aperturaVisible(tercera, PREDETERMINADA), []);
 assert.deepEqual(actividadDigital(tercera, centralTheme), [], 'forma demostrada; centralTheme no se juzga por su redacción');
 assert.ok(!tercera.raw.includes('{{'), 'sin marcadores sin sustituir');
 assert.equal(readCfg(dest).weeks.find((w) => Number(w.number) === 2).opening, undefined, 'el predeterminado no se escribe en la configuración');
});

for (const [caso, cambio, campo] of INVALIDAS) {
 test(`[RED] configuración inválida (${caso}): npm run semana falla, nombra ${campo} y no escribe la semana`, () => {
  const { dest, fullName } = deck.D;
  const cfgPath = path.join(dest, 'openclass.config.json'), original = readFileSync(cfgPath, 'utf8');
  const destino = md(dest, 6);
  try {
   configurar(dest, { fullName, number: 6, opening: { ...CURSOS.D.opening, ...cambio } });
   const r = npm(dest, 'run', 'semana', '--', '6');
   assert.notEqual(r.status, 0, 'la generación debe rechazar la apertura');
   assert.match(r.stdout + r.stderr, new RegExp(escapar(campo)), `el error nombra ${campo}`);
   assert.ok(!existsSync(destino), 'no se escribe el Markdown de la semana inválida');
  } finally {
   writeFileSync(cfgPath, original);
   rmSync(destino, { force: true });
   rmSync(destino.replace(/\.md$/, ''), { recursive: true, force: true });
  }
 });
}

// ---------- RED: desplazamiento de las diapositivas originales ----------
// Hoy el deck tiene 8 diapositivas y «Resultados de aprendizaje» ocupa la tercera posición.

test('[RED] la activación se inserta como tercera diapositiva y las originales 3–8 pasan a 4–9 con el mismo contenido', () => {
 const plantilla = diapositivas(readFileSync(path.join(root, 'template/plantillas/semana.md'), 'utf8'));
 assert.equal(plantilla.length, INICIALES + COLA.length, 'plantillas/semana.md: 9 diapositivas');
 assert.deepEqual(plantilla.slice(INICIALES).map((s) => sha(s.raw)), COLA.map(([, h]) => h), 'plantillas/semana.md: diapositivas 4–9');
 for (const [nombre, { source, activity }] of Object.entries(deck)) {
  const todas = diapositivas(source);
  assert.equal(todas.length, INICIALES + COLA.length, `curso ${nombre}: 9 diapositivas`);
  assert.ok(!COLA.some(([h]) => todas[2].raw.split('\n')[0] === h), `curso ${nombre}: la tercera diapositiva es la activación nueva`);
  todas.slice(INICIALES).forEach((s, i) => {
   const n = INICIALES + i + 1;
   assert.equal(s.raw.split('\n')[0], COLA[i][0], `curso ${nombre}: diapositiva ${n}`);
   assert.equal(sha(s.raw.replaceAll(activity, '{{ACTIVIDAD}}')), COLA[i][1], `curso ${nombre}: contenido de la diapositiva ${n}`);
  });
 }
});
