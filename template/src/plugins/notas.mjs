/**
 * Notas del orador para Build Tech. Única fuente: las `Notes:` del Markdown, leídas con
 * Reveal.getSlideNotes(). El HTML resultante se analiza con DOMParser (documento inerte: no ejecuta
 * scripts ni carga recursos) y se reduce a bloques de texto con formato mínimo (negrita, cursiva,
 * código). Build Tech los pinta con textContent: ninguna nota inserta HTML ni ejecuta código.
 *
 * Marcadores explícitos, al comienzo de un párrafo o elemento de lista de las notas:
 *   [[2]]                 punto de lectura: se resalta cuando se han mostrado 2 fragmentos ([[0]] al llegar).
 *   [[#red]]              nota anclada al elemento de la diapositiva con data-oc-nota="red"
 *                         (en el Markdown: <!-- .element: data-oc-nota="red" -->).
 *   [[#video:reproducir]] además ofrece la acción explícita reproducir | pausar | reiniciar sobre el
 *                         video o audio de ese ancla. Nunca se ejecuta sola: el docente pulsa el botón.
 */
const MARCADOR = /^\s*\[\[\s*(?:(\d{1,3})|#([A-Za-z][\w-]{0,39})(?::(reproducir|pausar|reiniciar))?)\s*\]\]\s*/;
export const ACCIONES_NOTA = ['reproducir', 'pausar', 'reiniciar'];

/** Marcador al inicio de un texto: { paso } | { ancla, accion? } | null, y cuántos caracteres ocupa. */
export function marcadorDe(texto) {
  const m = MARCADOR.exec(String(texto ?? ''));
  if (!m) return null;
  const largo = m[0].length;
  if (m[1] !== undefined) return { paso: Number(m[1]), largo };
  return { ancla: m[2], ...(m[3] ? { accion: m[3] } : {}), largo };
}

const EN_LINEA = { STRONG: 'b', B: 'b', EM: 'i', I: 'i', CODE: 'code', MARK: 'b', U: 'i' };
const TITULOS = /^H[1-6]$/;
const MAX_BLOQUES = 400;
const MAX_TEXTO = 4000;

/** Segmentos [{ t, f: ['b','i','code'] }] de un nodo en línea; los saltos <br> son '\n'. */
function segmentos(nodo, formato = [], salida = []) {
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === 3) {
      if (hijo.textContent) salida.push({ t: hijo.textContent, f: formato });
    } else if (hijo.nodeType === 1) {
      const tag = hijo.tagName;
      if (tag === 'BR') salida.push({ t: '\n', f: formato });
      else if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') continue;
      else if (tag === 'UL' || tag === 'OL') continue; // sublistas: bloques propios
      else segmentos(hijo, EN_LINEA[tag] && !formato.includes(EN_LINEA[tag]) ? [...formato, EN_LINEA[tag]] : formato, salida);
    }
  }
  return salida;
}

/** Une espacios, recorta y quita el marcador inicial de los segmentos; devuelve el bloque o null si queda vacío. */
function bloque(tipo, segs, extra = {}) {
  const limpios = [];
  for (const s of segs) {
    const t = s.f.includes('code') ? s.t : s.t.replace(/[ \t\r\n]+/g, (x) => (x.includes('\n') && s.t === '\n' ? '\n' : ' '));
    const previo = limpios[limpios.length - 1];
    if (previo && previo.f.join() === s.f.join()) previo.t += t; else limpios.push({ t, f: s.f });
  }
  const texto = limpios.map((s) => s.t).join('');
  const marca = marcadorDe(texto);
  if (marca) {
    let quitar = marca.largo;
    while (quitar > 0 && limpios.length) {
      const s = limpios[0];
      if (s.t.length <= quitar) { quitar -= s.t.length; limpios.shift(); } else { s.t = s.t.slice(quitar); quitar = 0; }
    }
  }
  if (limpios.length) { limpios[0].t = limpios[0].t.replace(/^\s+/, ''); const u = limpios[limpios.length - 1]; u.t = u.t.replace(/\s+$/, ''); }
  const finales = limpios.filter((s) => s.t);
  let total = 0;
  for (const s of finales) { if (total + s.t.length > MAX_TEXTO) s.t = s.t.slice(0, Math.max(0, MAX_TEXTO - total)); total += s.t.length; }
  if (!finales.some((s) => s.t.trim())) return null;
  const { largo, ...m } = marca ?? {};
  return { tipo, texto: finales, ...extra, ...m };
}

function recorrer(nodo, bloques, nivel = 0) {
  for (const hijo of nodo.childNodes) {
    if (bloques.length >= MAX_BLOQUES) return;
    if (hijo.nodeType === 3) {
      const b = hijo.textContent.trim() ? bloque('p', [{ t: hijo.textContent, f: [] }]) : null;
      if (b) bloques.push(b);
      continue;
    }
    if (hijo.nodeType !== 1) continue;
    const tag = hijo.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEMPLATE') continue;
    if (tag === 'P' || tag === 'BLOCKQUOTE') {
      const b = bloque(tag === 'P' ? 'p' : 'cita', segmentos(hijo));
      if (b) bloques.push(b);
    } else if (TITULOS.test(tag)) {
      const b = bloque('h', segmentos(hijo));
      if (b) bloques.push(b);
    } else if (tag === 'PRE') {
      const t = hijo.textContent.replace(/\n$/, '').slice(0, MAX_TEXTO);
      if (t.trim()) bloques.push({ tipo: 'pre', texto: [{ t, f: ['code'] }] });
    } else if (tag === 'UL' || tag === 'OL') {
      let n = Number(hijo.getAttribute('start')) || 1;
      for (const li of hijo.children) {
        if (li.tagName !== 'LI') continue;
        const b = bloque('li', segmentos(li), { lista: tag === 'OL' ? 'ol' : 'ul', n: n++, nivel });
        if (b) bloques.push(b);
        for (const sub of li.children) if (sub.tagName === 'UL' || sub.tagName === 'OL') recorrer({ childNodes: [sub] }, bloques, nivel + 1);
      }
    } else if (tag === 'HR') {
      bloques.push({ tipo: 'hr', texto: [] });
    } else if (/^(DIV|SECTION|ARTICLE|ASIDE|MAIN|HEADER|FOOTER|DETAILS|SUMMARY|TABLE|TBODY|THEAD|TR|TD|TH|DL|DT|DD|FIGURE|FIGCAPTION)$/.test(tag)) {
      recorrer(hijo, bloques, nivel);
    } else {
      const b = bloque('p', segmentos({ childNodes: [hijo] }));
      if (b) bloques.push(b);
    }
  }
}

/** Bloques seguros a partir del HTML de getSlideNotes() (o del texto de data-notes). */
export function notasSeguras(html, { esTexto = false } = {}) {
  const fuente = String(html ?? '');
  if (!fuente.trim()) return [];
  const bloques = [];
  if (esTexto || typeof DOMParser === 'undefined') {
    for (const parrafo of fuente.split(/\n\s*\n/)) {
      const b = bloque('p', [{ t: parrafo.replace(/\s+/g, ' '), f: [] }]);
      if (b) bloques.push(b);
    }
    return bloques.slice(0, MAX_BLOQUES);
  }
  const doc = new DOMParser().parseFromString(`<!doctype html><body>${fuente}`, 'text/html');
  recorrer(doc.body, bloques);
  return bloques;
}
