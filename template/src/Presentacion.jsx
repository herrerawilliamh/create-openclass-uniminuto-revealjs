import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Deck, Markdown } from '@revealjs/react';
import 'reveal.js/reveal.css';
import 'reveal.js/theme/white.css';
import 'reveal.js/plugin/highlight/monokai.css';
import mainMd from '../slides.md?raw';
import demoMd from '../demo-layouts.md?raw';
import labMd from '../laboratorio.md?raw';
import completaMd from '../demo-completa.md?raw';
import { paginarMarkdown, auditarOverflow } from './autoPaginar.mjs';
import { cargarPlugins } from './plugins/index.mjs';
// Solo las semanas de generation.activeWeeks (módulo virtual de vite.config.mjs).
import weekly from 'virtual:openclass-semanas';

const BASE = import.meta.env.BASE_URL;
// data-presentation de cada página HTML → Markdown fijo; las semanas se resuelven por número.
const FIJAS = { general: mainMd, demo: demoMd, laboratorio: labMd, completa: completaMd };
// Vistas previas (?receiver: Build Tech y las notas clásicas de Reveal.js): ningún iframe carga su contenido
// (YouTube, actividades, sitios externos); src/plugins/buildtech.mjs muestra en su lugar un aviso local.
const PREVIA = /receiver/i.test(location.search);
const sinIframes = (md) => md.replace(/(<iframe\b[^>]*?\s)(?:data-)?src=/gi, '$1data-oc-previa-src=');

/** «Diapositiva X / Y». Cuenta en el DOM porque Reveal formatea el número durante su
 *  inicialización, antes de que exista la instancia del deck. */
function numeroDiapositiva(slide) {
  const todas = [...document.querySelectorAll('.reveal .slides section:not(.stack)')];
  return [`Diapositiva ${todas.indexOf(slide) + 1}`, '/', todas.length];
}

/** H1 de la portada semanal igual a course.fullName. El generador escribe `# ${fullName}` tal cual (puede tener
 *  espacios extremos, saltos de línea, Markdown o HTML); aquí se busca esa cadena exacta al inicio de una línea de
 *  la primera diapositiva y se cambia por un marcador vacío. escribirCurso() pone luego el nombre original con
 *  textContent, sin pasar por {{BASE_URL}}, Markdown, HTML ni Smartypants. Si el docente editó el H1, no se toca. */
const MARCA_CURSO = 'data-oc-curso';
function protegerCurso(md, nombre) {
  if (!md || !nombre) return md;
  const h1 = `# ${nombre}`;
  for (let i = md.indexOf(h1); i >= 0; i = md.indexOf(h1, i + 1)) {
    if (/\r?\n---\r?\n/.test(md.slice(0, i))) break;
    const fin = i + h1.length;
    if ((i === 0 || md[i - 1] === '\n') && (fin === md.length || md[fin] === '\n' || md[fin] === '\r')) {
      return md.slice(0, i) + `# <span ${MARCA_CURSO}></span>` + md.slice(fin);
    }
  }
  return md;
}

/** Sustituye el marcador por el nombre como nodo de texto; pre-line hace visibles sus saltos de línea solo en ese H1. */
function escribirCurso(nombre) {
  const h1 = document.querySelector(`.reveal .slides h1 > [${MARCA_CURSO}]`)?.parentElement;
  if (!h1) return;
  h1.textContent = nombre;
  h1.style.whiteSpace = 'pre-line';
}

/** Portada y tema de las semanas: con un nombre, título o tema largo, se reduce el tamaño de letra hasta que el texto
 *  real cabe en la caja del layout (theme.css), sin recortarlo ni mover la composición. Si al mínimo aún no cabe, se
 *  permite el corte de palabras (títulos) o el salto de línea (línea secundaria). Una diapositiva oculta (sin caja)
 *  se ajusta cuando se muestra. */
const AJUSTES = [
  ['.oc-l-cover > h1', 26, (el) => el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1, ['overflow-wrap', 'anywhere']],
  ['.oc-l-cover > p:nth-of-type(2)', 15, (el) => el.scrollWidth <= el.clientWidth + 1, ['white-space', 'normal']],
  // Área útil del separador: hasta Y 666, sobre «Vigilada Mineducación».
  ['.oc-l-section > h2', 30, (el) => el.offsetTop + el.offsetHeight <= 666 && el.scrollWidth <= el.clientWidth + 1, ['overflow-wrap', 'anywhere']],
];
function ajustarTextos(raiz) {
  for (const [selector, minimo, cabe, ultimo] of AJUSTES) for (const el of raiz?.querySelectorAll(selector) ?? []) {
    if (!el.clientWidth) continue;
    el.style.removeProperty('font-size'); el.style.removeProperty(ultimo[0]);
    for (let px = parseFloat(getComputedStyle(el).fontSize); !cabe(el) && px > minimo;) {
      el.style.setProperty('font-size', `${px = Math.max(minimo, px - 2)}px`, 'important');
    }
    if (!cabe(el)) el.style.setProperty(...ultimo, 'important');
  }
}

const ICONO_CASA = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>
</svg>;

export function Presentacion({ kind, week, config }) {
  const number = Number(week);
  const nombre = config.course?.fullName;
  const raw = FIJAS[kind] ?? protegerCurso(weekly[number], nombre);
  const fuente = (raw || `# Semana ${number} no encontrada`).replaceAll('{{BASE_URL}}', BASE);
  const markdown = paginarMarkdown(PREVIA ? sinIframes(fuente) : fuente);

  // <Deck> lee sus plugins solo al montarse: se monta cuando los scripts vendorizados ya cargaron.
  const [extensiones, setExtensiones] = useState(null);
  useEffect(() => {
    let vigente = true;
    cargarPlugins(markdown).then((resultado) => vigente && setExtensiones(resultado));
    return () => { vigente = false; };
  }, []);
  // Las secciones del Markdown se insertan en el mismo commit que <Deck>; Reveal maqueta después (initialize es asíncrono).
  useLayoutEffect(() => { if (extensiones && !FIJAS[kind]) escribirCurso(nombre); }, [extensiones]);
  const deck = useRef(null);

  // Pie azul (theme.css): casa = portal del curso; logo 70 años = volver a la diapositiva 0.
  return <>
    <a className="back-link" href={BASE} title="Portal del curso" aria-label="Volver al portal del curso">{ICONO_CASA}</a>
    <button type="button" className="oc-inicio" title="Volver al inicio" data-tooltip="Volver al inicio"
      aria-label="Volver al inicio de la presentación" onClick={() => deck.current?.slide(0)}
      onKeyDown={(e) => e.key === ' ' && e.stopPropagation() /* Reveal avanzaría con Espacio */}>
      <img src={`${BASE}imagenes/70annos.png`} alt="" />
    </button>
    {extensiones && <Deck deckRef={deck} plugins={extensiones.plugins} onReady={() => {
      Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(() => {
        if (!FIJAS[kind]) {
          ajustarTextos(document.querySelector('.reveal .slides'));
          deck.current?.on('slidechanged', ({ currentSlide }) => ajustarTextos(currentSlide));
        }
        auditarOverflow();
      }));
    }} config={{
      hash: true, controls: true, progress: true, slideNumber: numeroDiapositiva,
      center: true, width: 1280, height: 720, margin: 0.06,
      // Sin vista de desplazamiento automática (Reveal la activa con ancho ≤ 435 px): #app la recorta (theme.css)
      // y la pizarra falla sin diapositiva actual. En el teléfono se ve el mismo lienzo escalado, con gestos.
      scrollActivationWidth: null,
      transition: 'slide',
      // PDF del estudiante: una página 16:9 por diapositiva, con los fragmentos visibles y sin cortes.
      pdfSeparateFragments: false, pdfMaxPagesPerSlide: 1,
      ...extensiones.config,
    }}>
      <Markdown markdown={markdown} options={{ smartypants: true }}/>
    </Deck>}
  </>;
}
