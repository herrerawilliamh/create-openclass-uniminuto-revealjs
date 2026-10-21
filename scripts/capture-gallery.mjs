#!/usr/bin/env node
/**
 * Capturas REALES de los 13 layouts (y del producto) desde un curso compilado.
 * Uso: node scripts/capture-gallery.mjs <dist-del-curso> [--base /]
 *  - template/public/galeria/<layout>.webp   640 × 360 (miniaturas de la galería y del paquete)
 *  - site/capturas/*.webp                    1280 × 720 (sitio de GitHub Pages y README)
 * El curso debe estar compilado con el tema neutro público (sin --assets).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirNavegador } from './lib/chrome.mjs';
import { servir } from './lib/servidor.mjs';
import { LAYOUTS } from '../template/galeria/layouts.mjs';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = process.argv[2];
const base = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : '/';
if (!dist) { console.error('Uso: node scripts/capture-gallery.mjs <dist> [--base /]'); process.exit(1); }

const miniaturas = path.join(raiz, 'template/public/galeria');
const capturas = path.join(raiz, 'site/capturas');
mkdirSync(miniaturas, { recursive: true });
mkdirSync(capturas, { recursive: true });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const servidor = await servir(dist, { base });
const navegador = await abrirNavegador({ ancho: 1600, alto: 900 });
try {
  const p = await navegador.pagina({ ancho: 1600, alto: 900 });
  await p.ir(`${servidor.url}demo-completa/`);
  await p.esperarA('window.OpenClass?.deck?.isReady?.()', { timeout: 30000 });
  await p.evaluar('document.fonts.ready.then(() => (OpenClass.deck.configure({ transition: "none", backgroundTransition: "none" }), true))');
  const foto = async (id, archivo, escala, carpeta) => {
    await p.evaluar(`(OpenClass.deck.slide(...Object.values(OpenClass.deck.getIndices(document.getElementById(${JSON.stringify(id)})))), true)`);
    await p.esperarA(`OpenClass.deck.getCurrentSlide().id === ${JSON.stringify(id)}`);
    // Revela todos los fragmentos para que la vista previa muestre el contenido completo.
    await p.evaluar('(() => { while (OpenClass.deck.nextFragment()); return true; })()');
    await esperar(id === 'actividad-iframe' ? 2500 : 1200);
    await p.evaluar('Promise.race([Promise.all([...document.images].filter((i) => i.loading !== "lazy").map((i) => i.decode().catch(() => null))), new Promise((r) => setTimeout(r, 4000))]).then(() => true)');
    const img = await p.captura({ formato: 'webp', calidad: escala < 0.5 ? 78 : 86, clip: { x: 0, y: 0, width: 1600, height: 900, scale: escala } });
    writeFileSync(path.join(carpeta, archivo), img);
    console.log(`CAPTURA=${path.relative(raiz, path.join(carpeta, archivo))} ${(img.length / 1024).toFixed(0)} KB`);
  };
  for (const l of LAYOUTS) await foto(l.captura || l.diapositiva, `${l.id}.webp`, 0.4, miniaturas);
  for (const id of ['portada', 'imagen-izquierda', 'codigo-scroll', 'actividad-iframe', 'mermaid', 'chart', 'formulas', 'cierre']) {
    await foto(id, `${id}.webp`, 0.8, capturas);
  }
  for (const [ruta, archivo, listo] of [
    ['', 'portal.webp', '!!document.querySelector(".portal")'],
    ['galeria/', 'galeria.webp', 'document.documentElement.dataset.listo === "true"'],
    ['guia/', 'guia.webp', '!!document.querySelector("main, body")'],
  ]) {
    await p.ir(`${servidor.url}${ruta}`);
    await p.esperarA(listo);
    await p.evaluar('Promise.race([Promise.all([...document.images].filter((i) => i.loading !== "lazy").map((i) => i.decode().catch(() => null))), new Promise((r) => setTimeout(r, 4000))]).then(() => document.fonts.ready).then(() => true)');
    await esperar(800);
    const img = await p.captura({ formato: 'webp', calidad: 86, clip: { x: 0, y: 0, width: 1600, height: 900, scale: 0.8 } });
    writeFileSync(path.join(capturas, archivo), img);
    console.log(`CAPTURA=site/capturas/${archivo} ${(img.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await navegador.cerrar();
  await servidor.cerrar();
}
