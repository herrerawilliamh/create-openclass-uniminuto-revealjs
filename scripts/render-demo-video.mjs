#!/usr/bin/env node
/**
 * Genera el video propio de la demostración (WebM VP8/VP9, sin audio) con Chrome headless:
 * una animación de canvas grabada con MediaRecorder. Diseño original del proyecto (MIT).
 * Uso: node scripts/render-demo-video.mjs  →  template/public/videos/demo-openclass.webm
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './lib/chrome.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = path.join(raiz, 'template/public/videos');

const animacion = `(async () => {
  const W = 960, H = 540, FPS = 30, DURACION = 9000;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  document.body.append(c);
  const g = c.getContext('2d');
  const pasos = [
    ['1', 'Activar', 'Una pregunta conecta con lo que ya sabes', '#ffca05', '#243764'],
    ['2', 'Explicar', 'Concepto, ejemplo y representación visual', '#243764', '#ffffff'],
    ['3', 'Practicar', 'Microactividad con retroalimentación', '#5464bf', '#ffffff'],
    ['4', 'Evaluar', 'Evidencia observable del aprendizaje', '#f6a81b', '#243764'],
  ];
  const tramo = DURACION / pasos.length;
  function cuadro(t) {
    g.fillStyle = '#f4f7fd'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#243764'; g.fillRect(0, 0, W, 70);
    g.fillStyle = '#ffca05'; g.fillRect(0, 70, W * Math.min(1, t / DURACION), 8);
    g.fillStyle = '#fff'; g.font = '800 32px Segoe UI, Arial'; g.fillText('Ciclo de una OpenClass', 32, 47);
    pasos.forEach(([n, titulo, texto, fondo, tinta], i) => {
      const inicio = i * tramo, k = Math.max(0, Math.min(1, (t - inicio) / 600));
      const x = 40 + i * 225, y = 150 + (1 - k) * 40;
      g.globalAlpha = 0.25 + 0.75 * k;
      g.fillStyle = fondo; g.beginPath(); g.roundRect(x, y, 200, 250, 18); g.fill();
      g.fillStyle = tinta; g.font = '800 64px Segoe UI, Arial'; g.fillText(n, x + 20, y + 80);
      g.font = '800 30px Segoe UI, Arial'; g.fillText(titulo, x + 20, y + 135);
      g.font = '18px Segoe UI, Arial';
      const palabras = texto.split(' '); let linea = '', yy = y + 172;
      for (const p of palabras) { if (g.measureText(linea + p).width > 165) { g.fillText(linea, x + 20, yy); linea = ''; yy += 24; } linea += p + ' '; }
      g.fillText(linea, x + 20, yy);
      g.globalAlpha = 1;
    });
    const actual = Math.min(pasos.length - 1, Math.floor(t / tramo));
    g.fillStyle = '#243764'; g.font = '700 26px Segoe UI, Arial';
    g.fillText('Ahora: ' + pasos[actual][1] + ' — ' + pasos[actual][2], 40, 470);
  }
  const flujo = c.captureStream(FPS);
  const tipo = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8';
  const grabador = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 700000 });
  const partes = []; grabador.ondataavailable = (e) => e.data.size && partes.push(e.data);
  const fin = new Promise((r) => (grabador.onstop = r));
  grabador.start(250);
  const t0 = performance.now();
  await new Promise((resolve) => {
    (function paso() { const t = performance.now() - t0; cuadro(Math.min(t, DURACION)); t < DURACION + 300 ? requestAnimationFrame(paso) : resolve(); })();
  });
  grabador.stop(); await fin;
  const duracion = performance.now() - t0;
  const blob = new Blob(partes, { type: 'video/webm' });
  const datos = await new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(blob); });
  return { tipo, duracion, datos: datos.split(',')[1] };
})()`;

/** Longitud de un entero de tamaño variable EBML según sus ceros iniciales. */
const largoVint = (byte) => { for (let i = 0; i < 8; i++) if (byte & (0x80 >> i)) return i + 1; throw new Error('vint inválido'); };
/**
 * MediaRecorder escribe WebM sin Duration: el reproductor muestra «Infinity» y no permite
 * conocer la duración. Inserta Duration (0x4489, float64 en ms) dentro de Info (0x1549A966).
 */
function fijarDuracion(buffer, ms) {
  const info = buffer.indexOf(Buffer.from([0x15, 0x49, 0xa9, 0x66]));
  if (info < 0) throw new Error('WebM sin elemento Info');
  const inicioTam = info + 4, largo = largoVint(buffer[inicioTam]);
  let tam = buffer[inicioTam] & (0xff >> largo);
  for (let i = 1; i < largo; i++) tam = tam * 256 + buffer[inicioTam + i];
  const contenido = buffer.subarray(inicioTam + largo, inicioTam + largo + tam);
  const duracion = Buffer.alloc(11);
  duracion.set([0x44, 0x89, 0x88]);
  duracion.writeDoubleBE(ms, 3);
  const nuevoTam = Buffer.alloc(8);
  nuevoTam[0] = 0x01; // vint de 8 bytes
  nuevoTam.writeUIntBE(tam + duracion.length, 2, 6);
  return Buffer.concat([buffer.subarray(0, inicioTam), nuevoTam, contenido, duracion, buffer.subarray(inicioTam + largo + tam)]);
}

const navegador = await abrirNavegador({ ancho: 1000, alto: 600 });
try {
  const pagina = await navegador.pagina({ ancho: 1000, alto: 600 });
  await pagina.ir('data:text/html,<body style="margin:0">');
  const { tipo, duracion, datos } = await pagina.evaluar(animacion);
  mkdirSync(destino, { recursive: true });
  const buffer = fijarDuracion(Buffer.from(datos, 'base64'), duracion);
  writeFileSync(path.join(destino, 'demo-openclass.webm'), buffer);
  writeFileSync(path.join(destino, 'demo-openclass.vtt'), `WEBVTT

00:00:00.000 --> 00:00:02.250
Activar: una pregunta conecta con lo que ya sabes.

00:00:02.250 --> 00:00:04.500
Explicar: concepto, ejemplo y representación visual.

00:00:04.500 --> 00:00:06.750
Practicar: microactividad con retroalimentación.

00:00:06.750 --> 00:00:09.300
Evaluar: evidencia observable del aprendizaje.
`);
  console.log(`VIDEO=${tipo} ${(buffer.length / 1024).toFixed(0)} KB`);
} finally {
  await navegador.cerrar();
}
