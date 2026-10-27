/**
 * Build Tech, lado de la presentación principal (la que se comparte por Zoom).
 *
 * - «Vista del presentador» del pie azul abre un selector: Build Tech (cabina privada en una ventana
 *   aparte, para el segundo monitor; tecla T) o las notas clásicas de Reveal.js (tecla S, sin cambios).
 * - Esta ventana es la autoridad: Build Tech solo envía órdenes de la lista cerrada de ./puente.mjs y
 *   recibe estado (diapositiva, fragmentos, notas seguras, solución privada, multimedia y En vivo).
 *   Si Build Tech falla o se cierra, la presentación sigue igual.
 * - Las vistas previas de Build Tech cargan esta misma página con ?receiver: no se conectan a Live,
 *   no reproducen ni descargan video (sin audio duplicado) y no muestran la barra.
 * - ?print-pdf&oc-imprimir (botón «Exportar a PDF»): tras maquetar todas las diapositivas abre el
 *   diálogo de impresión del navegador; el destino lo elige el docente («Guardar como PDF»).
 * - Reloj público discreto (hora local), solo si el docente lo activa desde Build Tech.
 * Nada de esto hace peticiones de red; las notas nunca salen del computador.
 */
import './buildtech.css';
import { NOMBRE_VENTANA, PARAMETRO_VISTA, mensajeDe, sobre, urlVista, validarOrden } from './puente.mjs';
import { notasSeguras } from './notas.mjs';
import { extraerEncuesta } from './encuesta.mjs';
import { crearMultimedia, prepararYoutube } from './multimedia.mjs';

const letra = (i) => String.fromCharCode(65 + i);
const PLACEHOLDER_PREVIA = '<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;height:100vh;background:#243764;color:#fff;font:700 42px/1.3 Arial,sans-serif;text-align:center">▶<br>Contenido integrado<br><small style="font-size:26px;font-weight:400">Se controla en la presentación</small></body>';

function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'clase') nodo.className = v;
    else if (k === 'texto') nodo.textContent = v;
    else if (k.startsWith('on')) nodo.addEventListener(k.slice(2), v);
    else nodo.setAttribute(k, v === true ? '' : String(v));
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false) nodo.append(h);
  return nodo;
}

/** Vista previa: ningún medio suena ni se descarga; los iframes muestran un aviso local. */
function neutralizarMedios(raiz) {
  for (const n of raiz.querySelectorAll('video, audio')) {
    n.muted = true; n.autoplay = false; n.removeAttribute('autoplay'); n.removeAttribute('data-autoplay');
    n.preload = 'none';
    if (!n.paused) n.pause();
  }
  for (const f of raiz.querySelectorAll('iframe:not([data-oc-previa])')) {
    f.setAttribute('data-oc-previa', '');
    f.removeAttribute('data-autoplay'); f.removeAttribute('data-src');
    f.srcdoc = PLACEHOLDER_PREVIA;
    f.removeAttribute('src');
  }
}

function modoPrevia(deck) {
  document.documentElement.classList.add('oc-previa');
  // Cualquier reproducción (también un video de fondo) se detiene en el acto.
  document.addEventListener('play', (ev) => { ev.target.muted = true; ev.target.pause?.(); }, true);
  const raiz = () => deck.getRevealElement?.() ?? document;
  neutralizarMedios(raiz());
  for (const ev of ['ready', 'slidechanged']) deck.on(ev, () => neutralizarMedios(raiz()));
}

/** Enlace público de un iframe para el PDF: un video de YouTube integrado pasa a su página normal. */
export function enlaceImprimible(src) {
  try {
    const u = new URL(src, location.href);
    const yt = /^\/embed\/([\w-]{6,20})/.exec(u.pathname);
    if (yt && /(^|\.)youtube(-nocookie)?\.com$/.test(u.hostname)) return `https://www.youtube.com/watch?v=${yt[1]}`;
    return /^https?:$/.test(u.protocol) ? u.href : null;
  } catch { return null; }
}

/** En el PDF un iframe (video, actividad) no se puede imprimir: se ve su título y un enlace en su lugar. */
function iframesImprimibles(raiz) {
  for (const f of raiz.querySelectorAll('.slides iframe')) {
    const enlace = enlaceImprimible(f.getAttribute('src') || f.getAttribute('data-src') || '');
    const titulo = (f.getAttribute('title') || 'Contenido integrado').trim();
    f.classList.add('oc-pdf-oculto');
    f.after(el('div', { clase: 'oc-pdf-medio' }, el('strong', { texto: titulo }),
      enlace ? el('a', { href: enlace, texto: enlace }) : el('span', { texto: 'Disponible en la presentación en línea.' })));
  }
}

function modoImpresion(deck) {
  iframesImprimibles(deck.getRevealElement?.() ?? document);
  if (!new URLSearchParams(location.search).has('oc-imprimir')) return;
  const barra = el('div', { clase: 'oc-imprimir', role: 'status' },
    el('p', { texto: 'Preparando todas las diapositivas para imprimir…' }));
  document.body.append(barra);
  deck.on('pdf-ready', async () => {
    // Las imágenes y fuentes deben estar listas: si no, el PDF saldría con huecos.
    await Promise.resolve(document.fonts?.ready);
    await Promise.all([...document.images].map((i) => (i.complete ? null : i.decode?.().catch(() => null))));
    const imprimir = () => window.print();
    barra.replaceChildren(
      el('p', {}, el('strong', { texto: 'Exportar a PDF · ' }), 'En el diálogo elija «Guardar como PDF» como destino, orientación horizontal y «Gráficos de fondo» activado. El navegador decide dónde se guarda.'),
      el('button', { type: 'button', texto: 'Imprimir o guardar como PDF', onclick: imprimir }));
    setTimeout(imprimir, 400);
  });
}

export function OpenClassBuildTech() {
  let deck = null;
  let ventana = null; // Build Tech autorizada
  let multimedia = null;
  let live = null;
  let relojPublico = null;
  let selector = null;

  // ---------- Estado que recibe Build Tech ----------
  function estado() {
    const slide = deck.getCurrentSlide();
    const slides = deck.getSlides();
    const pos = slides.indexOf(slide);
    const indices = deck.getIndices();
    const siguiente = slides[pos + 1] ? deck.getIndices(slides[pos + 1]) : null;
    const pasos = new Set([...(slide?.querySelectorAll('.fragment') ?? [])].map((f, i) => f.dataset.fragmentIndex ?? `s${i}`)).size;
    const crudo = slide ? deck.getSlideNotes(slide) : '';
    const notas = notasSeguras(crudo, { esTexto: Boolean(slide?.hasAttribute('data-notes')) });
    const fragmento = slide?.querySelector('.current-fragment[data-notes]')?.getAttribute('data-notes');
    const nodoEncuesta = slide?.querySelector('.oc-live-encuesta');
    let encuesta = null;
    if (nodoEncuesta) {
      const d = extraerEncuesta(nodoEncuesta);
      encuesta = { enunciado: d.enunciado, opciones: d.opciones, tipo: d.tipo, correctas: d.correctas.map(letra), explicacion: d.explicacion ?? '' };
    }
    const anclas = [...(slide?.querySelectorAll('[data-oc-nota]') ?? [])].map((n) => n.dataset.ocNota).filter((a) => /^[A-Za-z][\w-]{0,39}$/.test(a));
    return {
      titulo: (slide?.querySelector('h1, h2, h3')?.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
      documento: document.title,
      indices: { h: indices.h, v: indices.v ?? 0, f: indices.f ?? -1 },
      siguiente: siguiente ? { h: siguiente.h, v: siguiente.v ?? 0 } : null,
      posicion: pos + 1, total: slides.length,
      fragmentos: { total: pasos, visibles: (indices.f ?? -1) + 1 },
      notas, notasFragmento: fragmento ? notasSeguras(fragmento, { esTexto: true }) : [],
      anclas: [...new Set(anclas)],
      encuesta,
      medios: multimedia.estado(),
      live: live ? live.estado() : { disponible: false },
      relojPublico: Boolean(relojPublico),
      vistaGeneral: deck.isOverview?.() ?? false,
    };
  }

  let programado = null;
  function enviarEstado() {
    if (!ventana || programado) return;
    programado = setTimeout(() => {
      programado = null;
      if (!ventana || ventana.closed) return soltarVentana();
      try { ventana.postMessage(sobre('estado', { estado: estado() }), location.origin); } catch (e) { console.warn('[OpenClass] Build Tech:', e); }
    }, 40);
  }

  function soltarVentana() {
    ventana = null;
    multimedia?.activar(false);
    pintarSelector();
  }

  /** ¿Es esta ventana una Build Tech de esta misma presentación, abierta desde aquí? */
  function esBuildTech(w) {
    if (w === ventana) return true;
    try {
      return w.opener === window && w.location.origin === location.origin && w.location.pathname === location.pathname
        && new URLSearchParams(w.location.search).get(PARAMETRO_VISTA) === 'build-tech';
    } catch { return false; }
  }

  // ---------- Órdenes autorizadas ----------
  function navegar(accion) {
    const slides = deck.getSlides();
    const pos = slides.indexOf(deck.getCurrentSlide());
    const ir = (s) => { if (!s) return; const i = deck.getIndices(s); deck.slide(i.h, i.v, -1); };
    if (accion === 'siguiente') deck.next();
    else if (accion === 'anterior') deck.prev();
    else if (accion === 'siguienteDiapositiva') ir(slides[pos + 1]);
    else if (accion === 'anteriorDiapositiva') ir(slides[pos - 1]);
    else if (accion === 'primera') ir(slides[0]);
    else if (accion === 'ultima') ir(slides[slides.length - 1]);
    return { ok: true };
  }

  async function ejecutar(orden) {
    switch (orden.ambito) {
      case 'navegar': return navegar(orden.accion);
      case 'medio': return multimedia.ejecutar(orden);
      case 'live': return live ? live.ordenar(orden.accion, orden.valor) : { ok: false, mensaje: 'OpenClass Live no está activado en este curso.' };
      case 'reloj': alternarRelojPublico(orden.valor); return { ok: true };
      default: return { ok: false, mensaje: 'Orden no admitida.' };
    }
  }

  async function alMensaje(ev) {
    const d = mensajeDe(ev, { origen: location.origin, esperada: esBuildTech, de: 'build-tech' });
    if (!d) return;
    if (d.tipo === 'adios') { if (ev.source === ventana) soltarVentana(); return; }
    if (ventana !== ev.source) { ventana = ev.source; multimedia.activar(true); pintarSelector(); }
    if (d.tipo === 'hola') return enviarEstado();
    const orden = validarOrden(d.orden);
    let r;
    try { r = orden ? await ejecutar(orden) : { ok: false, mensaje: 'Orden no autorizada.' }; } catch (e) { r = { ok: false, mensaje: 'La presentación no pudo ejecutar la orden.' }; console.warn('[OpenClass] Build Tech:', e); }
    try { ev.source.postMessage(sobre('respuesta', { id: typeof d.id === 'string' ? d.id.slice(0, 40) : '', ok: Boolean(r?.ok), mensaje: r?.mensaje ? String(r.mensaje) : '' }), location.origin); } catch { /* ventana cerrada */ }
    enviarEstado();
  }

  // ---------- Abrir Build Tech (una sola ventana con nombre; reabrirla la recupera) ----------
  function abrirBuildTech() {
    cerrarSelector();
    if (ventana && !ventana.closed) { ventana.focus(); return; }
    const w = window.open('', NOMBRE_VENTANA, 'popup=yes,width=1440,height=900');
    if (!w) { avisar('El navegador bloqueó la ventana de Build Tech. Permita ventanas emergentes para esta página y vuelva a intentarlo.'); return; }
    let yaEs = false;
    try { yaEs = w.location.pathname === location.pathname && new URLSearchParams(w.location.search).get(PARAMETRO_VISTA) === 'build-tech'; } catch { /* nueva */ }
    if (!yaEs) w.location.replace(urlVista(location, 'build-tech'));
    ventana = w;
    multimedia.activar(true);
    w.focus();
    pintarSelector();
  }

  // ---------- Selector de vistas (botón «Vista del presentador») ----------
  function cerrarSelector() {
    if (!selector || selector.hidden) return;
    selector.hidden = true;
    document.getElementById('oc-h-presentador')?.querySelector('button')?.setAttribute('aria-expanded', 'false');
  }
  function pintarSelector() {
    if (!selector) return;
    const abierta = Boolean(ventana && !ventana.closed);
    selector.querySelector('[data-vista=build-tech] small').textContent = abierta
      ? 'Abierta en otra ventana: pulse para traerla al frente' : 'Cabina privada en otra ventana: notas, relojes, videos y En vivo';
  }
  function abrirSelector() {
    if (!selector.hidden) return cerrarSelector();
    const boton = document.getElementById('oc-h-presentador')?.querySelector('button');
    const r = boton?.getBoundingClientRect();
    selector.hidden = false;
    pintarSelector();
    if (r) {
      const ancho = selector.offsetWidth;
      selector.style.left = `${Math.max(8, Math.min(innerWidth - ancho - 8, r.left + r.width / 2 - ancho / 2))}px`;
      selector.style.bottom = `${Math.max(8, innerHeight - r.top + 8)}px`;
    }
    boton?.setAttribute('aria-expanded', 'true');
    selector.querySelector('button')?.focus();
  }

  let relojAviso = null;
  function avisar(texto) {
    const nodo = selector?.querySelector('.oc-vistas-aviso');
    if (!nodo) return;
    nodo.textContent = texto;
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => { nodo.textContent = ''; }, 8000);
    if (selector.hidden) abrirSelector();
  }

  // ---------- Reloj público (opcional, discreto, fuera del lienzo y del PDF) ----------
  function alternarRelojPublico(mostrar) {
    if (!mostrar) { relojPublico?.nodo.remove(); clearInterval(relojPublico?.intervalo); relojPublico = null; return; }
    if (relojPublico) return;
    const nodo = el('div', { clase: 'oc-reloj-publico', 'aria-hidden': 'true' });
    const pasar = () => { nodo.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    pasar();
    document.body.append(nodo);
    relojPublico = { nodo, intervalo: setInterval(pasar, 5000) };
  }

  return {
    id: 'openclass-build-tech',
    init(reveal) {
      deck = reveal;
      if (/print-pdf/i.test(location.search)) return modoImpresion(reveal);
      if (reveal.isSpeakerNotes?.()) return modoPrevia(reveal);

      // YouTube acepta órdenes solo con enablejsapi=1: se prepara antes de reproducir nada.
      prepararYoutube(reveal.getRevealElement?.() ?? document, location.origin);
      multimedia = crearMultimedia({ deck: reveal, alCambiar: enviarEstado });
      live = reveal.getPlugin?.('openclass-live')?.buildTech ?? null;
      live?.suscribir(enviarEstado);

      selector = el('div', { clase: 'oc-vistas', id: 'oc-vistas', role: 'menu', 'aria-label': 'Vista del presentador', hidden: true },
        el('button', { type: 'button', role: 'menuitem', 'data-vista': 'build-tech', onclick: abrirBuildTech },
          el('strong', { texto: 'Build Tech (T)' }), el('small', {})),
        el('button', { type: 'button', role: 'menuitem', 'data-vista': 'clasica', onclick: () => { cerrarSelector(); reveal.getPlugin('notes')?.open(); } },
          el('strong', { texto: 'Notas clásicas de Reveal.js (S)' }), el('small', { texto: 'Vista del presentador original, en otra ventana' })),
        el('p', { clase: 'oc-vistas-aviso', role: 'status' }));
      selector.addEventListener('keydown', (ev) => {
        if (ev.key === ' ' || ev.key === 'Enter') ev.stopPropagation();
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          const b = [...selector.querySelectorAll('button')]; const i = b.indexOf(document.activeElement);
          b[(i + (ev.key === 'ArrowDown' ? 1 : b.length - 1)) % b.length]?.focus(); ev.preventDefault(); ev.stopPropagation();
        }
      });
      document.body.append(selector);
      window.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape' || selector.hidden) return;
        ev.stopImmediatePropagation(); ev.preventDefault();
        cerrarSelector();
        document.getElementById('oc-h-presentador')?.querySelector('button')?.focus();
      }, true);
      document.addEventListener('pointerdown', (ev) => {
        if (!selector.hidden && !selector.contains(ev.target) && !ev.target.closest?.('#oc-h-presentador')) cerrarSelector();
      });
      reveal.addKeyBinding({ keyCode: 84, key: 'T', description: 'Build Tech: vista privada del docente' }, abrirBuildTech);

      window.addEventListener('message', alMensaje);
      for (const ev of ['slidechanged', 'fragmentshown', 'fragmenthidden', 'overviewshown', 'overviewhidden']) reveal.on(ev, () => { multimedia.cambioDeDiapositiva(); enviarEstado(); });
      // Ventana cerrada sin despedirse (cierre del sistema, bloqueo): se detecta sin depender de ella.
      setInterval(() => { if (ventana?.closed) soltarVentana(); }, 1500);
      window.addEventListener('pagehide', () => { try { ventana?.postMessage(sobre('adios'), location.origin); } catch { /* cerrada */ } });

      Object.assign(window.OpenClass ?? (window.OpenClass = {}), {
        vistas: abrirSelector,
        buildTech: abrirBuildTech,
      });
    },
  };
}
