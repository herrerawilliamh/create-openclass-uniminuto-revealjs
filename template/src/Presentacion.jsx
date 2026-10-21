import React, { useEffect, useRef, useState } from 'react';
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

// El glob permite importar contenido de semanas independientes sin un servidor adicional.
const weekly = import.meta.glob('../semanas/*.md', { query: '?raw', import: 'default', eager: true });
const BASE = import.meta.env.BASE_URL;
// data-presentation de cada página HTML → Markdown fijo; las semanas se resuelven por número.
const FIJAS = { general: mainMd, demo: demoMd, laboratorio: labMd, completa: completaMd };

function slug(input) {
  return String(input || 'curso').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** «Diapositiva X / Y». Cuenta en el DOM porque Reveal formatea el número durante su
 *  inicialización, antes de que exista la instancia del deck. */
function numeroDiapositiva(slide) {
  const todas = [...document.querySelectorAll('.reveal .slides section:not(.stack)')];
  return [`Diapositiva ${todas.indexOf(slide) + 1}`, '/', todas.length];
}

const ICONO_CASA = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M3 11l9-8 9 8"/><path d="M5 10v10h5v-6h4v6h5V10"/>
</svg>;

export function Presentacion({ kind, week, config }) {
  const number = Number(week);
  const file = `../semanas/${slug(config.course?.shortName)}_semana${number}.md`;
  const raw = FIJAS[kind] ?? weekly[file];
  const markdown = paginarMarkdown((raw || `# Semana ${number} no encontrada`)
    .replaceAll('{{BASE_URL}}', BASE));

  // <Deck> lee sus plugins solo al montarse: se monta cuando los scripts vendorizados ya cargaron.
  const [extensiones, setExtensiones] = useState(null);
  useEffect(() => {
    let vigente = true;
    cargarPlugins(markdown).then((resultado) => vigente && setExtensiones(resultado));
    return () => { vigente = false; };
  }, []);
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
      Promise.resolve(document.fonts?.ready).then(() => requestAnimationFrame(auditarOverflow));
    }} config={{
      hash: true, controls: true, progress: true, slideNumber: numeroDiapositiva,
      center: true, width: 1280, height: 720, margin: 0.06,
      transition: 'slide',
      ...extensiones.config,
    }}>
      <Markdown markdown={markdown} options={{ smartypants: true }}/>
    </Deck>}
  </>;
}
