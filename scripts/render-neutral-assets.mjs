#!/usr/bin/env node
/**
 * Genera los recursos gráficos NEUTROS y redistribuibles de OpenClass (diseño propio, MIT).
 * Reemplazan, con el mismo nombre de archivo y la misma geometría, a los recursos
 * institucionales que no se publican (ver recursos-institucionales/LEEME.md). Así el tema, el
 * CSS y el Markdown funcionan igual con ambos conjuntos.
 *
 * Uso: node scripts/render-neutral-assets.mjs
 * Escribe las fuentes SVG en recursos-neutros/ y los PNG/JPG en template/public/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './lib/chrome.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AZUL = '#233359', AZUL2 = '#243764', AMARILLO = '#ffcd0f', NARANJA = '#f6a81b', TINTA = '#233660', LILA = '#5464bf';
const FUENTE = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

const defsAvion = `
  <linearGradient id="av1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fbe7a6"/><stop offset=".55" stop-color="#e4b448"/><stop offset="1" stop-color="#b9862a"/></linearGradient>
  <linearGradient id="av2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f2cd6b"/><stop offset="1" stop-color="#a8741d"/></linearGradient>
  <linearGradient id="av3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9b6b1c"/><stop offset="1" stop-color="#6d4911"/></linearGradient>`;
// Avión de papel geométrico propio en una caja de 500 × 300.
const avion = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">
  <path d="M0 152 L500 0 L172 182 Z" fill="url(#av1)"/>
  <path d="M172 182 L500 0 L252 268 Z" fill="url(#av2)"/>
  <path d="M172 182 L252 268 L206 300 Z" fill="url(#av3)"/>
  <path d="M0 152 L500 0" stroke="#fff6d6" stroke-width="3" opacity=".7"/>
</g>`;
const marca = (x, y, color = AZUL2, sub = LILA, tam = 1) => `<g font-family="${FUENTE}" text-anchor="end">
  <text x="${x}" y="${y}" font-size="${86 * tam}" font-weight="800" fill="${color}" letter-spacing="-2">Open<tspan fill="${AMARILLO === color ? AZUL2 : '#f2a900'}">Class</tspan></text>
  <text x="${x}" y="${y + 44 * tam}" font-size="${27 * tam}" font-weight="600" fill="${sub}" letter-spacing="3">PLANTILLA DOCENTE · REVEAL.JS</text>
</g>`;

const svg = (w, h, cuerpo, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defsAvion}${defs}</defs>${cuerpo}</svg>`;

const RECURSOS = [];
const add = (salida, w, h, cuerpo, { defs = '', formato = 'png', transparente = false } = {}) =>
  RECURSOS.push({ salida, w, h, formato, transparente, svg: svg(w, h, cuerpo, defs) });

// 01 · Portada: franja vertical amarilla X 240–614, banda azul Y 470–828, bloque inferior.
add('fondos/slide-01-portada.png', 1920, 1080, `
  <rect width="1920" height="1080" fill="#fff"/>
  <rect x="240" y="0" width="374" height="828" fill="url(#franja)"/>
  <rect x="0" y="470" width="1920" height="358" fill="${AZUL}"/>
  <rect x="240" y="470" width="374" height="358" fill="#f8b416"/>
  <rect x="243" y="966" width="372" height="114" fill="${AMARILLO}"/>
  ${avion(238, 326, 1.02)}
  ${marca(1850, 150)}
  <rect x="1420" y="214" width="430" height="6" rx="3" fill="${AMARILLO}"/>`,
{ defs: `<linearGradient id="franja" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd21a"/><stop offset="1" stop-color="#fcc10f"/></linearGradient>` });

// 03–11 y 13 · Interna: banda superior Y 0–150 con cuñas, pie azul Y 1012–1080.
add('fondos/slide-05-template.png', 1920, 1080, `
  <rect width="1920" height="1080" fill="#fff"/>
  <path d="M0 0 H1280 L1130 150 H0 Z" fill="${AZUL}"/>
  <path d="M1280 0 H1410 L1260 150 H1130 Z" fill="${NARANJA}"/>
  <path d="M1410 0 H1475 L1352 115 H1290 Z" fill="${AMARILLO}"/>
  ${marca(1885, 92, AZUL2, LILA, .78)}
  <path d="M0 1012 H1840 L1772 1080 H0 Z" fill="${AZUL}"/>
  <path d="M1760 1080 L1920 944 V990 L1812 1080 Z" fill="${NARANJA}"/>
  <path d="M1838 1080 L1920 1010 V1036 L1868 1080 Z" fill="${AMARILLO}"/>
  <path d="M0 1080 L58 1022 H96 L38 1080 Z" fill="${AMARILLO}"/>
  ${avion(8, 990, .26)}`);

// 12 · Cierre: GRACIAS sobre azul profundo.
add('fondos/slide-06-cierre.png', 1920, 1080, `
  <rect width="1920" height="1080" fill="url(#noche)"/>
  <circle cx="1640" cy="820" r="420" fill="#ffffff" opacity=".035"/>
  <circle cx="260" cy="980" r="300" fill="#ffffff" opacity=".03"/>
  <rect x="0" y="140" width="1160" height="16" fill="${AMARILLO}"/>
  ${marca(1850, 160, '#ffffff', AMARILLO, .9)}
  ${avion(330, 300, .74)}
  <text x="720" y="452" font-family="${FUENTE}" font-size="168" font-weight="800" fill="#fff" letter-spacing="-3">GRACIAS</text>
  <text x="960" y="580" text-anchor="middle" font-family="${FUENTE}" font-size="42" font-weight="600" fill="#e8edf7">Aprender, practicar y compartir en cada sesión</text>
  <text x="960" y="680" text-anchor="middle" font-family="${FUENTE}" font-size="80" font-weight="800" fill="${AMARILLO}" letter-spacing="1">¡HASTA LA PRÓXIMA!</text>
  <rect x="760" y="760" width="400" height="6" rx="3" fill="${AMARILLO}" opacity=".85"/>
  <text x="960" y="970" text-anchor="middle" font-family="${FUENTE}" font-size="36" font-weight="600" fill="#fff">Presentación creada con <tspan fill="${AMARILLO}">OpenClass · Reveal.js</tspan></text>`,
{ defs: `<linearGradient id="noche" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a1430"/><stop offset=".6" stop-color="#15234a"/><stop offset="1" stop-color="#1f2f5e"/></linearGradient>` });

add('imagenes/avion.png', 279, 191, avion(6, 6, .534), { transparente: true });

// Botón «volver al inicio» del pie azul (ocupa el lugar del logotipo institucional).
add('imagenes/70annos.png', 1448, 1086, `
  <rect x="60" y="210" width="600" height="460" rx="40" fill="${AMARILLO}"/>
  <text x="360" y="560" text-anchor="middle" font-family="${FUENTE}" font-size="300" font-weight="800" fill="${AZUL2}" letter-spacing="-10">OC</text>
  <rect x="752" y="186" width="10" height="740" fill="#fff"/>
  <g fill="none" stroke="#fff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1300 560 A230 230 0 1 1 1180 358"/>
    <path d="M1150 250 L1190 362 L1080 400"/>
  </g>
  <text x="1100" y="980" text-anchor="middle" font-family="${FUENTE}" font-size="120" font-weight="800" fill="#fff" letter-spacing="8">INICIO</text>`,
{ transparente: true });

// Sello del bloque inferior derecho de la portada (sin referencias institucionales).
add('imagenes/acreditacion-openclass.png', 1200, 626, `
  <rect width="1200" height="626" fill="#fff"/>
  <g font-family="${FUENTE}" fill="#0f3d6e">
    <text x="20" y="200" font-size="190" font-weight="800" letter-spacing="-4">OPEN</text>
    <text x="20" y="380" font-size="190" font-weight="800" letter-spacing="-4">CLASS</text>
    <rect x="22" y="420" width="560" height="10"/>
    <text x="22" y="530" font-size="74" font-weight="700">Aula activa</text>
  </g>
  <path d="M640 600 V90" stroke="#0f3d6e" stroke-width="12" stroke-dasharray="34 22"/>
  <path d="M590 92 L640 18 L690 92 Z" fill="#0f3d6e"/>
  <g font-family="${FUENTE}" font-size="64" fill="#0f3d6e"><text x="700" y="190">Explicar,</text><text x="700" y="290">practicar y</text><text x="700" y="390">evaluar</text><text x="700" y="490" font-weight="700">juntos.</text></g>`);

const favicon = `
  <rect x="8" y="9" width="340" height="340" rx="70" fill="${AMARILLO}"/>
  <text x="178" y="252" text-anchor="middle" font-family="${FUENTE}" font-size="190" font-weight="800" fill="${AZUL2}" letter-spacing="-8">OC</text>`;
add('imagenes/favicon.png', 356, 358, favicon, { transparente: true });
add('favicon.png', 356, 358, favicon, { transparente: true });

// --- Ilustraciones propias (reemplazo de imágenes IoT de origen no documentado) ---
const tarjeta = (x, y, w, h, titulo, color = AZUL2, texto = '#fff', sub = '') => `
  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="22" fill="${color}"/>
  <text x="${x + w / 2}" y="${y + h / 2 + (sub ? -4 : 14)}" text-anchor="middle" font-family="${FUENTE}" font-size="40" font-weight="800" fill="${texto}">${titulo}</text>
  ${sub ? `<text x="${x + w / 2}" y="${y + h / 2 + 38}" text-anchor="middle" font-family="${FUENTE}" font-size="26" fill="${texto}" opacity=".9">${sub}</text>` : ''}`;
const fondoClaro = (w, h) => `<rect width="${w}" height="${h}" fill="url(#claro)"/>`;
const defsClaro = `<linearGradient id="claro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f7fd"/><stop offset="1" stop-color="#dfe7f6"/></linearGradient>`;
const flecha = (x, y1, y2) => `<path d="M${x} ${y1} V${y2 - 18}" stroke="${LILA}" stroke-width="8" stroke-dasharray="14 10"/><path d="M${x - 20} ${y2 - 24} L${x} ${y2} L${x + 20} ${y2 - 24} Z" fill="${LILA}"/>`;
const nodo = (cx, cy, r, etiqueta, icono) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="${AZUL2}" stroke-width="6"/>
  <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="46">${icono}</text>
  <text x="${cx}" y="${cy + r + 42}" text-anchor="middle" font-family="${FUENTE}" font-size="28" font-weight="700" fill="${TINTA}">${etiqueta}</text>`;

add('imagenes/layout-demo-iot-ecosistema.jpg', 623, 880, `${fondoClaro(623, 880)}
  <g stroke="${LILA}" stroke-width="5" stroke-dasharray="10 9" fill="none">
    <path d="M311 210 V380"/><path d="M311 470 L120 560"/><path d="M311 470 L502 560"/><path d="M311 470 L120 760"/><path d="M311 470 L502 760"/><path d="M311 470 V700"/>
  </g>
  <path d="M190 170 a70 70 0 0 1 60 -96 a90 90 0 0 1 160 20 a62 62 0 0 1 30 76 Z" fill="${AZUL2}"/>
  <text x="311" y="160" text-anchor="middle" font-family="${FUENTE}" font-size="34" font-weight="800" fill="#fff">Nube</text>
  <rect x="216" y="380" width="190" height="120" rx="20" fill="${AMARILLO}"/>
  <text x="311" y="452" text-anchor="middle" font-family="${FUENTE}" font-size="34" font-weight="800" fill="${AZUL2}">Pasarela</text>
  ${nodo(120, 580, 58, 'Luz', '💡')}${nodo(502, 580, 58, 'Cámara', '📷')}${nodo(311, 720, 58, 'Sensor', '🌡️')}
  ${nodo(120, 770, 50, '', '⌚')}${nodo(502, 770, 50, '', '📱')}`, { defs: defsClaro, formato: 'jpeg' });

add('imagenes/layout-demo-iot-arquitectura.jpg', 623, 880, `${fondoClaro(623, 880)}
  ${tarjeta(60, 60, 503, 150, 'Servicios', AZUL2, '#fff', 'nube · aplicaciones')}
  ${flecha(311, 210, 270)}
  ${tarjeta(60, 270, 503, 150, 'Conectividad', LILA, '#fff', 'Wi-Fi · Zigbee · LoRaWAN')}
  ${flecha(311, 420, 480)}
  ${tarjeta(60, 480, 503, 150, 'Control local', NARANJA, AZUL2, 'microcontrolador')}
  ${flecha(311, 630, 690)}
  ${tarjeta(60, 690, 503, 150, 'Percepción', AMARILLO, AZUL2, 'sensores · actuadores')}`, { defs: defsClaro, formato: 'jpeg' });

const pines = (x, y, n, paso, vertical = true) => Array.from({ length: n }, (_, i) =>
  `<rect x="${vertical ? x : x + i * paso}" y="${vertical ? y + i * paso : y}" width="${vertical ? 34 : 14}" height="${vertical ? 14 : 34}" fill="#c9a24a"/>`).join('');
add('imagenes/layout-demo-iot-esp32.jpg', 495, 880, `${fondoClaro(495, 880)}
  ${pines(56, 180, 15, 36)}${pines(405, 180, 15, 36)}
  <rect x="90" y="150" width="315" height="580" rx="18" fill="#1f2a44"/>
  <rect x="140" y="190" width="215" height="170" rx="10" fill="#c9ced8"/>
  <text x="247" y="285" text-anchor="middle" font-family="${FUENTE}" font-size="40" font-weight="800" fill="#1f2a44">MCU</text>
  <path d="M150 400 h195 M150 430 h150 M150 460 h175" stroke="#5c6b8a" stroke-width="8"/>
  <rect x="200" y="660" width="95" height="60" rx="8" fill="#9aa4b8"/>
  <circle cx="150" cy="560" r="16" fill="${AMARILLO}"/><circle cx="345" cy="560" r="16" fill="#e5534b"/>
  <text x="247" y="100" text-anchor="middle" font-family="${FUENTE}" font-size="40" font-weight="800" fill="${TINTA}">Microcontrolador</text>
  <text x="247" y="800" text-anchor="middle" font-family="${FUENTE}" font-size="30" fill="${TINTA}">procesamiento + conectividad</text>`, { defs: defsClaro, formato: 'jpeg' });

add('imagenes/layout-demo-iot-wokwi.jpg', 495, 880, `${fondoClaro(495, 880)}
  <text x="247" y="90" text-anchor="middle" font-family="${FUENTE}" font-size="40" font-weight="800" fill="${TINTA}">Circuito simulado</text>
  <rect x="150" y="300" width="195" height="300" rx="14" fill="#1f2a44"/>
  <text x="247" y="460" text-anchor="middle" font-family="${FUENTE}" font-size="34" font-weight="800" fill="#fff">MCU</text>
  <rect x="60" y="140" width="120" height="110" rx="10" fill="#fff" stroke="${LILA}" stroke-width="6"/>
  <text x="120" y="208" text-anchor="middle" font-family="${FUENTE}" font-size="26" font-weight="700" fill="${TINTA}">DHT22</text>
  <path d="M120 250 V330 H150" stroke="#2e8b57" stroke-width="7" fill="none"/>
  ${[['#2e9d5b', 660], ['#f2b705', 730], ['#e5534b', 800]].map(([c, y]) => `<path d="M345 ${y - 230} H400 V${y - 20}" stroke="${c}" stroke-width="7" fill="none"/><circle cx="400" cy="${y}" r="26" fill="${c}"/>`).join('')}
  <text x="120" y="720" text-anchor="middle" font-family="${FUENTE}" font-size="28" fill="${TINTA}">3 indicadores</text>`, { defs: defsClaro, formato: 'jpeg' });

// --- Ilustraciones para la presentación TEMÁTICA DE PRUEBA (820 × 1000) ---
add('imagenes/demo-secuencia.png', 820, 1000, `${fondoClaro(820, 1000)}
  <text x="410" y="96" text-anchor="middle" font-family="${FUENTE}" font-size="50" font-weight="800" fill="${TINTA}">Secuencia de la sesión</text>
  ${tarjeta(110, 160, 600, 150, '1 · Activar', AMARILLO, AZUL2, 'pregunta inicial')}
  ${flecha(410, 310, 370)}
  ${tarjeta(110, 370, 600, 150, '2 · Explicar', AZUL2, '#fff', 'concepto y ejemplo')}
  ${flecha(410, 520, 580)}
  ${tarjeta(110, 580, 600, 150, '3 · Practicar', LILA, '#fff', 'microactividad')}
  ${flecha(410, 730, 790)}
  ${tarjeta(110, 790, 600, 150, '4 · Evaluar', NARANJA, AZUL2, 'retroalimentación')}`, { defs: defsClaro });

const mosaico = (x, y, icono, titulo, color) => `<rect x="${x}" y="${y}" width="320" height="330" rx="26" fill="#fff" stroke="${color}" stroke-width="8"/>
  <text x="${x + 160}" y="${y + 170}" text-anchor="middle" font-size="120">${icono}</text>
  <text x="${x + 160}" y="${y + 280}" text-anchor="middle" font-family="${FUENTE}" font-size="40" font-weight="800" fill="${TINTA}">${titulo}</text>`;
add('imagenes/demo-recursos.png', 820, 1000, `${fondoClaro(820, 1000)}
  <text x="410" y="110" text-anchor="middle" font-family="${FUENTE}" font-size="50" font-weight="800" fill="${TINTA}">Recursos de una OpenClass</text>
  ${mosaico(70, 170, '🖼️', 'Imagen', AZUL2)}${mosaico(430, 170, '🎬', 'Video', NARANJA)}
  ${mosaico(70, 560, '💻', 'Código', LILA)}${mosaico(430, 560, '🧩', 'Actividad', AMARILLO)}`, { defs: defsClaro });

const barra = (x, h, color, etq) => `<rect x="${x}" y="${760 - h}" width="110" height="${h}" rx="12" fill="${color}"/>
  <text x="${x + 55}" y="810" text-anchor="middle" font-family="${FUENTE}" font-size="30" font-weight="700" fill="${TINTA}">${etq}</text>`;
add('imagenes/demo-evidencias.png', 820, 1000, `${fondoClaro(820, 1000)}
  <text x="410" y="110" text-anchor="middle" font-family="${FUENTE}" font-size="50" font-weight="800" fill="${TINTA}">Evidencias de aprendizaje</text>
  <path d="M90 760 H740" stroke="${TINTA}" stroke-width="5"/>
  ${barra(110, 260, LILA, 'Inicio')}${barra(270, 380, AZUL2, 'Práctica')}${barra(430, 470, NARANJA, 'Reto')}${barra(590, 540, AMARILLO, 'Cierre')}
  <text x="410" y="900" text-anchor="middle" font-family="${FUENTE}" font-size="34" fill="${TINTA}">progreso observable durante la sesión</text>`, { defs: defsClaro });

const persona = (cx, cy, color) => `<circle cx="${cx}" cy="${cy}" r="46" fill="${color}"/><path d="M${cx - 80} ${cy + 150} a80 80 0 0 1 160 0 Z" fill="${color}"/>`;
add('imagenes/demo-colaboracion.png', 820, 1000, `${fondoClaro(820, 1000)}
  <text x="410" y="110" text-anchor="middle" font-family="${FUENTE}" font-size="50" font-weight="800" fill="${TINTA}">Aprender en equipo</text>
  <g stroke="${LILA}" stroke-width="6" stroke-dasharray="12 10"><path d="M220 470 L600 470"/><path d="M220 470 L410 760"/><path d="M600 470 L410 760"/></g>
  ${persona(220, 400, AZUL2)}${persona(600, 400, NARANJA)}${persona(410, 690, LILA)}
  <rect x="300" y="180" width="220" height="110" rx="26" fill="${AMARILLO}"/><path d="M380 290 l20 34 l20 -34 Z" fill="${AMARILLO}"/>
  <text x="410" y="252" text-anchor="middle" font-family="${FUENTE}" font-size="54" font-weight="800" fill="${AZUL2}">¿Y si…?</text>
  <text x="410" y="950" text-anchor="middle" font-family="${FUENTE}" font-size="34" fill="${TINTA}">preguntar · discutir · construir</text>`, { defs: defsClaro });

const navegador = await abrirNavegador();
try {
  const pagina = await navegador.pagina();
  for (const r of RECURSOS) {
    const fuente = path.join(raiz, 'recursos-neutros', r.salida.replace(/\.(png|jpg)$/, '.svg'));
    mkdirSync(path.dirname(fuente), { recursive: true });
    writeFileSync(fuente, r.svg);
    await pagina.viewport(r.w, r.h);
    await pagina.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 255, g: 255, b: 255, a: r.transparente ? 0 : 1 } });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${r.svg}</body></html>`;
    await pagina.ir(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    await pagina.evaluar('document.fonts.ready.then(() => true)');
    const imagen = await pagina.captura({ formato: r.formato, calidad: r.formato === 'jpeg' ? 88 : undefined, clip: { x: 0, y: 0, width: r.w, height: r.h } });
    const destino = path.join(raiz, 'template/public', r.salida);
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, imagen);
    console.log(`GENERADO=${r.salida} ${r.w}x${r.h} ${(imagen.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await navegador.cerrar();
}
