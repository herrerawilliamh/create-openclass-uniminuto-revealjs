import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import '@fontsource/merriweather-sans/700.css';
import './galeria.css';
import { LAYOUTS } from './layouts.mjs';

const BASE = import.meta.env.BASE_URL;
const $ = (s) => document.querySelector(s);
const crear = (etiqueta, props = {}, ...hijos) => {
  const el = Object.assign(document.createElement(etiqueta), props);
  el.append(...hijos.filter((h) => h !== null && h !== undefined));
  return el;
};
const vista = (l) => `${BASE}galeria/${l.id}.webp`;
const ejemplo = (l) => `${BASE}demo-completa/#/${l.diapositiva}`;

async function copiar(texto, boton) {
  let ok = true;
  try { await navigator.clipboard.writeText(texto); } catch {
    const area = Object.assign(document.createElement('textarea'), { value: texto });
    document.body.append(area); area.select(); ok = document.execCommand('copy'); area.remove();
  }
  const original = boton.textContent;
  boton.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
  setTimeout(() => { boton.textContent = original; }, 1800);
}

function lista(titulo, elementos) {
  return crear('div', {}, crear('h4', { textContent: titulo }),
    crear('ul', {}, ...elementos.map((t) => crear('li', { textContent: t }))));
}
function dato(titulo, texto) {
  return crear('div', {}, crear('h4', { textContent: titulo }), crear('p', { textContent: texto }));
}

function tarjeta(l) {
  const botonCopiar = crear('button', { type: 'button', className: 'g-boton', textContent: 'COPIAR CÓDIGO' });
  botonCopiar.addEventListener('click', () => copiar(l.markdown, botonCopiar));
  const ficha = crear('details', { className: 'g-ficha' },
    crear('summary', { textContent: 'Ficha completa' }),
    dato('Objetivo pedagógico', l.objetivo),
    dato('Clase CSS', l.clase),
    lista('Parámetros que puedes cambiar', l.parametros),
    dato('Cómo insertar imágenes', l.imagenes),
    dato('Cómo añadir recursos multimedia', l.multimedia),
    dato('Cómo colocar notas', l.notas),
    dato('Límites del contenido', l.limites),
    lista('Errores frecuentes', l.errores),
    crear('h4', { textContent: 'Estructura Markdown completa' }),
    crear('pre', { className: 'g-codigo', tabIndex: 0 }, crear('code', { textContent: l.markdown })));
  const busqueda = [l.nombre, l.clase, l.objetivo, l.multimedia, l.parametros.join(' ')].join(' ').toLowerCase();
  const art = crear('article', { className: 'g-tarjeta', id: `layout-${l.id}` },
    crear('a', { href: ejemplo(l), className: 'g-miniatura', ariaLabel: `Ver ejemplo de ${l.nombre}` },
      crear('img', { src: vista(l), alt: `Vista previa real del layout ${l.nombre}`, loading: 'lazy', width: 640, height: 360 })),
    crear('div', { className: 'g-cuerpo' },
      crear('p', { className: 'g-numero', textContent: `Layout ${l.numero} · ${l.clase}` }),
      crear('h2', { textContent: l.nombre }),
      crear('p', { textContent: l.objetivo }),
      crear('div', { className: 'g-acciones' }, botonCopiar,
        crear('a', { className: 'g-boton secundario', href: ejemplo(l), textContent: 'VER EJEMPLO' })),
      ficha));
  art.dataset.busqueda = busqueda;
  return art;
}

function comparar() {
  const a = LAYOUTS.find((l) => l.id === $('#comparar-a').value);
  const b = LAYOUTS.find((l) => l.id === $('#comparar-b').value);
  $('#comparacion').replaceChildren(...[a, b].map((l) => crear('figure', {},
    crear('img', { src: vista(l), alt: `Vista previa de ${l.nombre}`, width: 640, height: 360 }),
    crear('figcaption', {}, crear('strong', { textContent: l.nombre }), ` · ${l.clase} — ${l.limites}`))));
}

$('#galeria').replaceChildren(...LAYOUTS.map(tarjeta));
for (const [select, inicial] of [['#comparar-a', 'image-left'], ['#comparar-b', 'top-right']]) {
  $(select).replaceChildren(...LAYOUTS.map((l) => crear('option', { value: l.id, textContent: `${l.numero} · ${l.nombre}`, selected: l.id === inicial })));
  $(select).addEventListener('change', comparar);
}
comparar();
$('#buscar').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let visibles = 0;
  for (const art of document.querySelectorAll('.g-tarjeta')) {
    const ok = !q || art.dataset.busqueda.normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q);
    art.hidden = !ok; visibles += ok;
  }
  $('#sin-resultados').hidden = visibles > 0;
});
// Enlace directo a una ficha: /galeria/#layout-code abre la ficha correspondiente.
const destino = /^#layout-[a-z-]+$/.test(location.hash) ? document.querySelector(location.hash) : null;
if (destino?.classList.contains('g-tarjeta')) { destino.querySelector('details').open = true; destino.scrollIntoView(); }
document.documentElement.dataset.listo = 'true';
