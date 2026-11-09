/**
 * WillEdTech Design System v3
 * tailwind.config.js · Tailwind CSS 3.4.1 o superior, compatible con 4.x mediante @config.
 *
 * CAPAS
 *   1. Primitivos  violet, yellow, orange, neutral, success, warning, error, info (50-950).
 *   2. Semánticos  canvas, surface, ink, line, primary... cambian solos en modo oscuro.
 *   3. Efectos     radios asimétricos, sombras, vidrio, gradientes y recursos del manual.
 *   4. Plugin      variables --wt-*, modo oscuro, lectura accesible y puente a Reveal.js.
 *
 * USO COMO PRESET, en cada producto de la marca
 *   module.exports = {
 *     presets: [require('./tailwind.config.js')],
 *     content: ['./src/index.html'],
 *
 *     // Reveal.js: conserva sus estilos y gana a reglas como `.reveal h1`
 *     // corePlugins: { preflight: false }, important: '.reveal',
 *
 *     // Moodle o Bootstrap: evita choques con su .bg-primary, .border o .p-3 con !important.
 *     // Las clases pasan a ser wt-bg-primary, dark:wt-text-ink, wt-glass...
 *     // corePlugins: { preflight: false }, prefix: 'wt-',
 *   };
 *   Mantén siempre `@tailwind base`: ahí viven las variables.
 *
 * OTRAS FORMAS DE CARGARLO
 *   CDN (prototipos)  <script src="https://cdn.tailwindcss.com"></script>
 *                     <script src="./tailwind.config.js"></script>
 *   Tailwind 4        @import "tailwindcss"; @config "./tailwind.config.js";
 *                     Ahí `border` sin color usa currentColor: escribe border-line.
 *
 * MODO OSCURO   class="dark" o data-theme="dark" en <html> o en cualquier contenedor.
 *               Con `prefix`, usa solo data-theme: Tailwind también prefija la clase dark.
 * OPENDYSLEXIC  data-font="accessible" en un contenedor, o la clase .readable en un bloque.
 * FUENTES       Se cargan en cada proyecto; este archivo solo las nombra:
 *   https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Merriweather+Sans:wght@400;500;600;700;800&display=swap
 *   https://cdn.jsdelivr.net/npm/@fontsource/opendyslexic@5.3.0/400.css (y 700.css)
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. PRIMITIVOS
// ─────────────────────────────────────────────────────────────────────────────

/** Canon: los 6 colores de la ficha de marca. Son la fuente de verdad y no se derivan. */
const wtBrand = {
  white: '#FFFFFF',
  black: '#000000',
  violet: '#5464BF',
  gray: '#B3B3B3',
  yellow: '#F2E205',
  orange: '#F27405',
};

/**
 * Escalas generadas en OKLCH y ancladas al HEX exacto de marca (paso a, base L0):
 *   Luminosidad  L = Ltop - (Ltop - L0)·(i/a)^1.6            tintes,  i <= a
 *                L = L0 - (L0 - Lbot)·((i-a)/(10-a))^q       sombras, i > a
 *   Crominancia  C = min(tope, r·Cmax(L, h))                 relativa al gamut sRGB
 *   Matiz        h = h0 + k·(L - L0)                         evita amarillos oliva
 *
 * Contrato verificado en todas las familias:
 *   Sobre blanco       -600 >= 3:1 (bordes, iconos)   -700 >= 4.5:1 (texto)
 *   Sobre neutral-950  -400 >= 4.5:1 (texto)
 *   Neutros            se resuelven por contraste contra blanco:
 *                      400 = 3.2:1, 500 = 4.8:1, 600 = 7:1
 *
 * Matices semánticos derivados de la marca, no elegidos a ojo (OKLCH):
 *   success  161.9°  punto medio del arco Naranja-Violeta
 *   warning   77.5°  mezcla de Amarillo y Naranja
 *   error     18.5°  Naranja girado 32° hacia el Violeta
 *   info     238.2°  Violeta girado 35° hacia el azul
 *
 * Este bloque lo escribe generate-palette.mjs a partir de wtBrand: no lo edites a mano.
 */
const wtPalette = {
  violet: {
    50: '#F4F7FD', 100: '#E6EBFA', 200: '#CAD5F3', 300: '#A7B6E7', 400: '#7E90D6',
    500: '#5464BF', // Violeta de marca
    600: '#4550A9', 700: '#363B93', 800: '#2A2C73', 900: '#1E1E54', 950: '#121137',
  },
  yellow: {
    50: '#FDFDE7', 100: '#FCFBCB', 200: '#FBF697', 300: '#F8EE56',
    400: '#F2E205', // Amarillo de marca
    500: '#D3B613', 600: '#B39115', 700: '#936F13', 800: '#72510F', 900: '#523509', 950: '#331D04',
  },
  orange: {
    50: '#FEF7F2', 100: '#FDEEE3', 200: '#FCDCC4', 300: '#FBC198', 400: '#FC9D5B',
    500: '#F27405', // Naranja de marca
    600: '#CB5D13', 700: '#A54714', 800: '#813312', 900: '#5D210C', 950: '#3B1006',
  },
  neutral: {
    50: '#FAFAFD', 100: '#F3F4F6', 200: '#E5E6E9', 300: '#CBCCD2', 400: '#8D8F99', 500: '#6F727C',
    600: '#565862', 700: '#3D3F49', 800: '#262931', 900: '#161920', 950: '#0C0E15',
  },
  success: {
    50: '#EEFDF4', 100: '#DBF7E7', 200: '#B7EBCE', 300: '#89D9AF', 400: '#53BF8D', 500: '#079F6C',
    600: '#17845A', 700: '#1A6B48', 800: '#185338', 900: '#123C28', 950: '#0B2718',
  },
  warning: {
    50: '#FEFAF2', 100: '#FEF4E4', 200: '#FEE9C6', 300: '#FFD899', 400: '#FFC254', 500: '#FDA900',
    600: '#D08400', 700: '#A66500', 800: '#7E490A', 900: '#58300A', 950: '#351905',
  },
  error: {
    50: '#FDF4F5', 100: '#FBE8E8', 200: '#F8CDCE', 300: '#F5A6AA', 400: '#F36F7A', 500: '#DA2F4A',
    600: '#B7283F', 700: '#952133', 800: '#751928', 900: '#56111C', 950: '#3A0911',
  },
  info: {
    50: '#F2F9FD', 100: '#E1F1FC', 200: '#BDE2F9', 300: '#88CCF7', 400: '#56AFE4', 500: '#218CC5',
    600: '#2275A4', 700: '#1F5E84', 800: '#1A4967', 900: '#13354B', 950: '#0B2131',
  },
};

/** '#5464BF' -> '84 100 191'. Canales para rgb(var(--x) / alfa). */
const wtChannels = (hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ');

/** 'violet.500' o 'white' -> HEX. */
const wtHex = (path) => {
  const [family, step] = path.split('.');
  return step ? wtPalette[family][step] : wtBrand[family];
};

/** Color de Tailwind respaldado por una variable; admite modificadores como /50. */
const wtVar = (name) => `rgb(var(--wt-${name}) / <alpha-value>)`;

/** Color para valores CSS compuestos: wtRgb('orange-500', 0.5). */
const wtRgb = (name, alpha) =>
  alpha === undefined ? `rgb(var(--wt-${name}))` : `rgb(var(--wt-${name}) / ${alpha})`;

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEMÁNTICOS: [modo claro, modo oscuro]
// ─────────────────────────────────────────────────────────────────────────────

const wtFoundation = {
  canvas: ['neutral.50', 'neutral.950'], // fondo de página
  surface: ['white', 'neutral.900'], // tarjetas
  'surface-raised': ['white', 'neutral.800'], // menús, modales
  'surface-sunken': ['neutral.100', 'black'], // campos, pozos
  ink: ['neutral.950', 'neutral.50'], // texto principal
  'ink-soft': ['neutral.600', 'neutral.300'], // texto secundario
  'ink-faint': ['neutral.500', 'neutral.400'], // metadatos
  line: ['neutral.200', 'neutral.800'], // divisores
  'line-strong': ['neutral.400', 'neutral.500'], // bordes funcionales, >= 3:1
  focus: ['orange.600', 'orange.400'], // anillo de foco, >= 3:1
};

/**
 * Cada rol tiene la misma API, así un componente cambia de rol cambiando una palabra:
 *   bg-{rol} text-{rol}-on hover:bg-{rol}-hover
 *   bg-{rol}-soft text-{rol}-ink border-{rol}-line
 *
 * Orden de cada fila, primero claro y luego oscuro:
 *   relleno, hover, texto sobre relleno, fondo suave, texto sobre suave, borde
 */
const wtRoleSlots = ['', 'hover', 'on', 'soft', 'ink', 'line'];
const wtRoles = {
  primary: {
    scale: 'violet',
    modes: [
      ['violet.500', 'violet.600', 'white', 'violet.100', 'violet.700', 'violet.300'],
      ['violet.500', 'violet.600', 'white', 'violet.950', 'violet.200', 'violet.700'],
    ],
  },
  secondary: {
    scale: 'orange',
    modes: [
      ['orange.500', 'orange.400', 'violet.950', 'orange.100', 'orange.800', 'orange.300'],
      ['orange.500', 'orange.400', 'violet.950', 'orange.950', 'orange.400', 'orange.700'],
    ],
  },
  accent: {
    scale: 'yellow',
    modes: [
      ['yellow.400', 'yellow.300', 'violet.950', 'yellow.100', 'yellow.800', 'yellow.500'],
      ['yellow.400', 'yellow.300', 'violet.950', 'yellow.950', 'yellow.400', 'yellow.700'],
    ],
  },
  // Estados: pasos elegidos por búsqueda para maximizar la distinción con protanopia,
  // deuteranopia y tritanopia. Aun así, acompáñalos siempre con icono o texto.
  success: {
    scale: 'success',
    modes: [
      ['success.500', 'success.400', 'neutral.950', 'success.100', 'success.800', 'success.300'],
      ['success.300', 'success.200', 'neutral.950', 'success.950', 'success.200', 'success.700'],
    ],
  },
  warning: {
    scale: 'warning',
    modes: [
      ['warning.500', 'warning.400', 'violet.950', 'warning.100', 'warning.900', 'warning.400'],
      ['warning.500', 'warning.400', 'violet.950', 'warning.950', 'warning.200', 'warning.700'],
    ],
  },
  error: {
    scale: 'error',
    modes: [
      ['error.600', 'error.700', 'white', 'error.100', 'error.800', 'error.300'],
      ['error.500', 'error.600', 'white', 'error.950', 'error.200', 'error.700'],
    ],
  },
  info: {
    scale: 'info',
    modes: [
      ['info.700', 'info.800', 'white', 'info.100', 'info.800', 'info.300'],
      ['info.500', 'info.400', 'neutral.950', 'info.950', 'info.200', 'info.700'],
    ],
  },
};

const wtRoleColors = ({ scale }, role) => ({
  ...wtPalette[scale],
  DEFAULT: wtVar(role),
  hover: wtVar(`${role}-hover`),
  on: wtVar(`${role}-on`),
  soft: wtVar(`${role}-soft`),
  ink: wtVar(`${role}-ink`),
  line: wtVar(`${role}-line`),
});

/**
 * La paleta reemplaza a la de Tailwind: bg-indigo-500, bg-red-500 y compañía dejan de
 * existir, así que nada fuera de la marca puede colarse. gray y slate apuntan a neutral
 * para que los componentes de terceros hereden el tinte violeta.
 */
const wtColors = {
  transparent: 'transparent',
  current: 'currentColor',
  inherit: 'inherit',
  white: wtBrand.white,
  black: wtBrand.black,

  violet: wtPalette.violet,
  yellow: wtPalette.yellow,
  orange: wtPalette.orange,
  neutral: wtPalette.neutral,
  gray: wtPalette.neutral,
  slate: wtPalette.neutral,

  canvas: wtVar('canvas'),
  surface: {
    DEFAULT: wtVar('surface'),
    raised: wtVar('surface-raised'),
    sunken: wtVar('surface-sunken'),
  },
  ink: { DEFAULT: wtVar('ink'), soft: wtVar('ink-soft'), faint: wtVar('ink-faint') },
  line: { DEFAULT: wtVar('line'), strong: wtVar('line-strong') },
  focus: wtVar('focus'),

  ...Object.fromEntries(
    Object.entries(wtRoles).map(([role, spec]) => [role, wtRoleColors(spec, role)]),
  ),

  // bg-wt-violet = HEX exacto de la ficha. El resto son tokens de la v2, sin cambios.
  wt: {
    ...wtBrand,
    ink: '#273051',
    cream: '#F8F9FC',
    night: '#0B0F19',
    surface: '#FFFDF9',
    paper: '#F3EFD9',
    muted: '#E9ECFA',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. EFECTOS
// ─────────────────────────────────────────────────────────────────────────────

/** Geometría medida sobre el isotipo (810 px): corte superior y trazo diagonal. */
const wtAngles = { cut: 20.3, stroke: 22.8 };

/** Proporción constante 1:3. human y human-sm vienen de la v2. */
const wtRadii = {
  'asym-xs': '0.25rem 0.75rem 0.25rem 0.75rem',
  'asym-sm': '0.5rem 1.5rem 0.5rem 1.5rem',
  asym: '1rem 3rem 1rem 3rem',
  'asym-lg': '1.5rem 4.5rem 1.5rem 4.5rem',
  'asym-flip': '3rem 1rem 3rem 1rem',
  human: '18px 5px 18px 5px',
  'human-sm': '12px 4px 12px 4px',
};

const wtShadowColor = (factor = 1) =>
  `rgb(var(--wt-shadow) / calc(var(--wt-shadow-alpha) * ${factor}))`;

/** La luz cae desde arriba a la izquierda: la masa de sombra nunca es simétrica. */
const wtShadows = {
  'asym-sm': `4px 8px 18px -8px ${wtShadowColor()}`,
  asym: `10px 18px 40px -16px ${wtShadowColor()}, -2px -2px 10px -6px ${wtShadowColor(0.5)}`,
  'asym-lg': `18px 32px 64px -24px ${wtShadowColor()}, -4px -4px 18px -10px ${wtShadowColor(0.5)}`,
  // Sombra dura de imprenta, sin desenfoque
  'offset-violet': `5px 7px 0 0 ${wtRgb('violet-500')}`,
  'offset-orange': `5px 7px 0 0 ${wtRgb('orange-500')}`,
  'offset-yellow': `5px 7px 0 0 ${wtRgb('yellow-400')}`,
  'offset-ink': `5px 7px 0 0 ${wtRgb('ink')}`,
  // Halo bicolor: violeta arriba a la izquierda, naranja abajo a la derecha
  duo: `-10px -8px 34px -14px ${wtRgb('violet-500', 0.55)}, 12px 16px 38px -14px ${wtRgb('orange-500', 0.5)}`,
  // Tokens de la v2
  vio: '0 18px 45px -22px rgba(84,100,191,.35)',
  warm: '0 17px 38px -23px rgba(242,116,5,.27)',
  soft: '0 14px 32px -25px rgba(47,58,115,.24)',
};

/** Las bandas del corte y del trazo quedan paralelas a los bordes reales del isotipo. */
const wtCutAngle = `${180 - wtAngles.cut}deg`;
const wtStrokeAngle = `${90 - wtAngles.stroke}deg`;

const wtGradients = {
  // Corte: masa violeta partida por el filo naranja y amarillo del logo
  cut: `linear-gradient(${wtCutAngle}, ${wtRgb('violet-900')} 0 74%, ${wtRgb('orange-500')} 74% 75.5%, ${wtRgb('yellow-400')} 75.5% 77%, ${wtRgb('violet-950')} 77% 100%)`,
  // Trazo: bandas diagonales duras, con la inclinación de la W
  stroke: `linear-gradient(${wtStrokeAngle}, ${wtRgb('violet-950')} 0 46%, ${wtRgb('violet-800')} 46% 72%, ${wtRgb('orange-500')} 72% 74%, ${wtRgb('violet-700')} 74% 100%)`,
  // Brasa: noche violeta con el calor concentrado en una sola esquina
  ember: `radial-gradient(38% 52% at 100% 100%, ${wtRgb('yellow-400', 0.92)}, ${wtRgb('yellow-400', 0)} 72%), radial-gradient(72% 92% at 100% 100%, ${wtRgb('orange-500', 0.95)}, ${wtRgb('orange-500', 0)} 70%), linear-gradient(${wtCutAngle}, ${wtRgb('violet-950')} 0%, ${wtRgb('violet-800')} 62%, ${wtRgb('violet-600')} 100%)`,
  // Malla: ambiente de página para que el vidrio tenga algo que desenfocar
  mesh: `radial-gradient(55% 60% at 8% 0%, ${wtRgb('violet-500', 'var(--wt-mesh-alpha)')}, transparent 72%), radial-gradient(45% 50% at 96% 12%, ${wtRgb('orange-500', 'calc(var(--wt-mesh-alpha) * .7)')}, transparent 70%), radial-gradient(40% 45% at 78% 100%, ${wtRgb('yellow-400', 'calc(var(--wt-mesh-alpha) * .6)')}, transparent 72%)`,
};

/** Pilas con respaldo; se exponen como variables para poder conmutarlas en caliente. */
const wtFonts = {
  heading:
    '"Merriweather Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  body: '"Atkinson Hyperlegible", "Atkinson Hyperlegible Next", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  accessible: 'OpenDyslexic, "Atkinson Hyperlegible", ui-sans-serif, system-ui, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PLUGIN
// ─────────────────────────────────────────────────────────────────────────────

const wtSemanticVars = (mode) => {
  const vars = {};
  for (const [name, values] of Object.entries(wtFoundation)) {
    vars[`--wt-${name}`] = wtChannels(wtHex(values[mode]));
  }
  for (const [role, { modes }] of Object.entries(wtRoles)) {
    modes[mode].forEach((path, i) => {
      const slot = wtRoleSlots[i] ? `-${wtRoleSlots[i]}` : '';
      vars[`--wt-${role}${slot}`] = wtChannels(wtHex(path));
    });
  }
  return vars;
};

const wtPrimitiveVars = () => {
  const vars = {};
  for (const [family, steps] of Object.entries(wtPalette)) {
    for (const [step, hex] of Object.entries(steps)) {
      vars[`--wt-${family}-${step}`] = wtChannels(hex);
    }
  }
  return vars;
};

/** Alfa .72: text-ink conserva AA aunque detrás del vidrio haya blanco o negro puros. */
const wtDepthVars = [
  {
    'color-scheme': 'light',
    '--wt-shadow': wtChannels(wtPalette.violet[950]),
    '--wt-shadow-alpha': '.3',
    '--wt-mesh-alpha': '.28',
    '--wt-glass-fill': wtChannels(wtBrand.white),
    '--wt-glass-alpha': '.72',
    '--wt-glass-edge': wtChannels(wtBrand.white),
    '--wt-glass-edge-alpha': '.65',
    '--wt-glass-saturate': '170%',
  },
  {
    'color-scheme': 'dark',
    '--wt-shadow': wtChannels(wtBrand.black),
    '--wt-shadow-alpha': '.65',
    '--wt-mesh-alpha': '.42',
    '--wt-glass-fill': wtChannels(wtPalette.neutral[900]),
    '--wt-glass-alpha': '.72',
    '--wt-glass-edge': wtChannels(wtBrand.white),
    '--wt-glass-edge-alpha': '.12',
    '--wt-glass-saturate': '150%',
  },
];

const wtGlassFilter = 'blur(var(--wt-glass-blur)) saturate(var(--wt-glass-saturate))';
const wtReadable = { lineHeight: '1.85', wordSpacing: '0.12em' };

// Función simple, sin require('tailwindcss/plugin'), para que también funcione en el CDN.
const wtPlugin = ({ addBase, addComponents }) => {
  addBase({
    ':root': {
      ...wtPrimitiveVars(),
      ...wtSemanticVars(0),
      ...wtDepthVars[0],
      '--wt-font-heading': wtFonts.heading,
      '--wt-font-body': wtFonts.body,
      '--wt-font-accessible': wtFonts.accessible,
      '--wt-font-mono': wtFonts.mono,
      '--wt-blur-sm': '8px',
      '--wt-blur-md': '16px',
      '--wt-blur-lg': '28px',
      '--wt-glass-blur': 'var(--wt-blur-md)',
    },
    // has-dark-background / has-light-background: las añade Reveal.js a cada diapositiva
    // según su data-background-color.
    '.dark, [data-theme="dark"], .has-dark-background': {
      ...wtSemanticVars(1),
      ...wtDepthVars[1],
    },
    '.light, [data-theme="light"], .has-light-background': {
      ...wtSemanticVars(0),
      ...wtDepthVars[0],
    },
    '[data-font="accessible"]': {
      '--wt-font-heading': 'var(--wt-font-accessible)',
      '--wt-font-body': 'var(--wt-font-accessible)',
      ...wtReadable,
    },
    // Reveal.js lee estas variables, sea cual sea el tema base que cargues. Selector de
    // atributo y no de clase: Tailwind 3 descarta las clases que no ve en `content`.
    '[class~="reveal-viewport"], [class~="reveal"]': {
      '--r-background-color': wtRgb('canvas'),
      '--r-main-font': 'var(--wt-font-body)',
      '--r-main-color': wtRgb('ink'),
      '--r-heading-font': 'var(--wt-font-heading)',
      '--r-heading-color': wtRgb('ink'),
      '--r-heading-font-weight': '800',
      '--r-heading-letter-spacing': '-0.02em',
      '--r-heading-text-transform': 'none',
      '--r-heading-text-shadow': 'none',
      '--r-heading1-text-shadow': 'none',
      '--r-code-font': 'var(--wt-font-mono)',
      '--r-link-color': wtRgb('primary-ink'),
      '--r-link-color-dark': wtRgb('violet-700'),
      '--r-link-color-hover': wtRgb('secondary-ink'),
      '--r-selection-background-color': wtRgb('yellow-400'),
      '--r-selection-color': wtRgb('violet-950'),
    },
  });

  addComponents({
    '.glass': {
      backgroundColor: 'rgb(var(--wt-glass-fill) / var(--wt-glass-alpha))',
      border: '1px solid rgb(var(--wt-glass-edge) / var(--wt-glass-edge-alpha))',
      boxShadow: `inset 0 1px 0 rgb(var(--wt-glass-edge) / var(--wt-glass-edge-alpha)), ${wtShadows.asym}`,
      backdropFilter: wtGlassFilter,
      WebkitBackdropFilter: wtGlassFilter,
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))': {
        backgroundColor: 'rgb(var(--wt-glass-fill))',
      },
      '@media (prefers-reduced-transparency: reduce)': {
        backgroundColor: 'rgb(var(--wt-glass-fill))',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
      },
    },
    '.glass-sm': { '--wt-glass-blur': 'var(--wt-blur-sm)' },
    '.glass-lg': { '--wt-glass-blur': 'var(--wt-blur-lg)' },
    // Vidrio teñido para texto claro: blanco >= 7:1, amarillo de marca >= 4.5:1
    '.glass-violet': {
      '--wt-glass-fill': wtChannels(wtPalette.violet[950]),
      '--wt-glass-edge': wtChannels(wtPalette.violet[300]),
      '--wt-glass-edge-alpha': '.28',
    },
    '.readable': { fontFamily: 'var(--wt-font-accessible)', ...wtReadable },
    // Recursos del manual de marca (Retícula de composición)
    // Barra de texto: <span class="marker bg-violet-500 text-white">Título</span>
    '.marker': {
      display: 'inline',
      padding: '0.06em 0.4em',
      lineHeight: '1.75',
      WebkitBoxDecorationBreak: 'clone',
      boxDecorationBreak: 'clone',
    },
    // Retícula visible. Ajustable con [--wt-grid-color:...] y [--wt-grid-size:...]
    '.bg-grid': {
      backgroundImage:
        'linear-gradient(to right, var(--wt-grid-color, rgb(var(--wt-ink) / .1)) 1px, transparent 1px), ' +
        'linear-gradient(to bottom, var(--wt-grid-color, rgb(var(--wt-ink) / .1)) 1px, transparent 1px)',
      backgroundSize: 'var(--wt-grid-size, 2.25rem) var(--wt-grid-size, 2.25rem)',
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const willEdTechConfig = {
  darkMode: ['selector', ':is(.dark, [data-theme="dark"], .has-dark-background)'],
  content: [
    './*.html',
    './src/**/*.{html,js,jsx,ts,tsx,vue,svelte,md,mdx}',
    './components/**/*.{html,js,jsx,ts,tsx}',
  ],
  theme: {
    colors: wtColors,
    extend: {
      fontFamily: {
        sans: 'var(--wt-font-body)',
        body: 'var(--wt-font-body)',
        heading: 'var(--wt-font-heading)',
        accessible: 'var(--wt-font-accessible)',
        mono: 'var(--wt-font-mono)',
      },
      borderRadius: wtRadii,
      boxShadow: wtShadows,
      backgroundImage: wtGradients,
      backdropBlur: {
        'glass-sm': 'var(--wt-blur-sm)',
        glass: 'var(--wt-blur-md)',
        'glass-lg': 'var(--wt-blur-lg)',
      },
      backdropSaturate: { glass: 'var(--wt-glass-saturate)' },
      rotate: { cut: `-${wtAngles.cut}deg` },
      skew: { stroke: `${wtAngles.stroke}deg` },
      borderColor: { DEFAULT: wtVar('line') },
      ringColor: { DEFAULT: wtVar('focus') },
    },
  },
  plugins: [wtPlugin],
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = willEdTechConfig;
}

// Modo CDN: <script src="./tailwind.config.js"> justo después del script de Tailwind.
if (typeof window !== 'undefined' && window.tailwind) {
  window.tailwind.config = willEdTechConfig;
}
