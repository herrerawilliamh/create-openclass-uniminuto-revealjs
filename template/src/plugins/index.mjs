/**
 * OpenClass: registro único de plugins del deck.
 * - Oficiales de reveal.js (módulos ES): Markdown, Highlight, Search, Notes, Zoom y Math (KaTeX).
 * - rajgoel/reveal.js-plugins 4.6.0, vendorizados en public/vendor/: Chalkboard, Custom Controls y
 *   Chart. Son scripts clásicos (usan el `this` global y rutas relativas a su <script>), por eso se
 *   cargan con <script> y no con import.
 * - Mermaid y Chart.js se importan solo si el Markdown los usa.
 * - Código (./codigo.mjs): botón copiar y desplazamiento seguro del layout oc-l-code.
 * - Fase 2 (Seminar, Poll, Questions): preparada y apagada en ./fase2.mjs.
 * Las herramientas de Custom Controls van en el pie azul, a lado y lado del logo 70 años (theme.css).
 */
import './compat-math.mjs';
import RevealMarkdown from 'reveal.js/plugin/markdown';
import RevealHighlight from 'reveal.js/plugin/highlight';
import RevealNotes from 'reveal.js/plugin/notes';
import RevealSearch from 'reveal.js/plugin/search';
import RevealZoom from 'reveal.js/plugin/zoom';
import RevealMath from 'reveal.js/plugin/math';
import { OpenClassMermaid } from './mermaid.mjs';
import { OpenClassCodigo } from './codigo.mjs';
import { cargarFase2 } from './fase2.mjs';

const VENDOR = `${import.meta.env.BASE_URL}vendor/reveal.js-plugins/`;
const PALETA = ['#243764', '#ffca05', '#5464bf', '#f0a800', '#6b79a8', '#40547d'];

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    document.head.append(script);
  });
}

function cargarCss(href) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/** Un plugin vendorizado que no carga se omite con un aviso; nunca bloquea la presentación. */
async function vendorizado(nombre, global) {
  try {
    await cargarScript(`${VENDOR}${nombre}/plugin.js`);
    return window[global] ? [window[global]] : [];
  } catch (error) {
    console.warn('[OpenClass]', error.message);
    return [];
  }
}

const icono = (trazo) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${trazo}</svg>`;

// Custom Controls inserta `action` como atributo onclick: solo llamadas a window.OpenClass.
const HERRAMIENTAS = [
  { id: 'oc-h-pizarra', title: 'Pizarra (B)', action: 'OpenClass.pizarra()',
    icon: icono('<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20l4-4 4 4"/>') },
  { id: 'oc-h-anotar', title: 'Anotar sobre la diapositiva (C)', action: 'OpenClass.anotar()',
    icon: icono('<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>') },
  { id: 'oc-h-borrar', title: 'Borrar anotaciones de esta diapositiva (Supr)', action: 'OpenClass.borrar()',
    icon: icono('<path d="M5 15l8-8 6 6-5 5H9z"/><path d="M9 20h11"/>') },
  { id: 'oc-h-buscar', title: 'Buscar (Ctrl+Shift+F)', action: 'OpenClass.buscar()',
    icon: icono('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>') },
  { id: 'oc-h-presentador', title: 'Vista del presentador (S)', action: 'OpenClass.presentador()',
    icon: icono('<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>') },
  { id: 'oc-h-vista', title: 'Vista general (Esc)', action: 'OpenClass.vistaGeneral()',
    icon: icono('<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>') },
  { id: 'oc-h-completa', title: 'Pantalla completa', action: 'OpenClass.pantallaCompleta()',
    icon: icono('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') },
];

/** Expone las acciones de la barra; los métodos de RevealChalkboard existen tras su init. */
const OpenClassHerramientas = () => ({
  id: 'oc-herramientas',
  init(deck) {
    window.OpenClass = {
      deck,
      pizarra: () => window.RevealChalkboard?.toggleChalkboard(),
      anotar: () => window.RevealChalkboard?.toggleNotesCanvas(),
      borrar: () => window.RevealChalkboard?.clear(),
      buscar: () => deck.getPlugin('search')?.toggle(),
      presentador: () => deck.getPlugin('notes')?.open(),
      vistaGeneral: () => deck.toggleOverview(),
      pantallaCompleta: () => (document.fullscreenElement
        ? document.exitFullscreen()
        : document.documentElement.requestFullscreen?.()),
    };
  },
});

let carga;

/** Devuelve { plugins, config } para <Deck>. Se resuelve una sola vez por página. */
export function cargarPlugins(markdown) {
  carga ??= (async () => {
    const config = {
      katex: { version: '0.19.0' },
      chalkboard: {
        storage: `openclass-pizarra:${location.pathname}`,
        readOnly: false,
        boardmarkerWidth: 4,
        toggleChalkboardButton: false,
        toggleNotesButton: false,
        boardHandle: false,
      },
      customcontrols: { controls: HERRAMIENTAS },
    };

    if (/data-chart\s*=/.test(markdown)) {
      try {
        const { default: Chart } = await import('chart.js/auto');
        window.Chart = Chart;
        config.chart = {
          defaults: {
            color: '#233660',
            borderColor: '#dce3ee',
            font: { family: "'Atkinson Hyperlegible', Arial, sans-serif", size: 18 },
          },
          bar: { backgroundColor: PALETA, borderColor: PALETA },
          line: { borderColor: PALETA, backgroundColor: PALETA.map((c) => `${c}33`) },
          radar: { borderColor: PALETA, backgroundColor: PALETA.map((c) => `${c}33`) },
          pie: { backgroundColor: [PALETA] },
          doughnut: { backgroundColor: [PALETA] },
        };
      } catch (error) {
        console.warn('[OpenClass] No se pudo cargar Chart.js:', error);
      }
    }

    cargarCss(`${VENDOR}chalkboard/style.css`);
    const [chalkboard, controles, chart] = await Promise.all([
      vendorizado('chalkboard', 'RevealChalkboard'),
      vendorizado('customcontrols', 'RevealCustomControls'),
      window.Chart ? vendorizado('chart', 'RevealChart') : [],
    ]);
    const fase2 = await cargarFase2({ cargarScript, cargarCss, vendor: VENDOR })
      .catch((error) => { console.warn('[OpenClass] Fase 2:', error); return { plugins: [], config: {} }; });

    return {
      plugins: [
        OpenClassMermaid, OpenClassCodigo, RevealMarkdown, RevealHighlight, RevealNotes, RevealSearch, RevealZoom,
        RevealMath.KaTeX, ...chalkboard, ...controles, ...chart, OpenClassHerramientas, ...fase2.plugins,
      ],
      config: { ...config, ...fase2.config },
    };
  })();
  return carga;
}
