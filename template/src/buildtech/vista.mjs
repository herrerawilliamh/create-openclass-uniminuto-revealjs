/**
 * Build Tech: cabina privada del docente, en una ventana aparte (segundo monitor). Nunca se comparte.
 *
 * - No monta el deck ni se conecta a ningún servidor: la presentación principal (window.opener) es la
 *   autoridad; aquí solo se envían órdenes explícitas por el puente local y se pinta el estado recibido.
 * - Prioridad visual: las notas del orador (Notes: del Markdown). Las vistas previas son la misma
 *   presentación en modo «receiver» (sin sonido, sin Live, sin teclado) y llevan los marcadores de las
 *   notas ancladas, que jamás aparecen en la pantalla proyectada.
 * - Tres relojes independientes: hora local, tiempo de clase (local, configurable una vez por sesión,
 *   solo avisa al terminar) y tiempo de votación (el global de OpenClass Live, que no se pide aquí).
 * - Todo el texto se pinta con textContent: ni notas ni datos de Live insertan HTML.
 */
import './vista.css';
import { PROTOCOLO, mensajeDe, sobre, urlVista } from '../plugins/puente.mjs';
import { ACCIONES_NOTA } from '../plugins/notas.mjs';
import { DURACIONES_CLASE, MAX_CLASE, MIN_CLASE, configurar, duracionValida, fase, formatoReloj, iniciar, leerTiempo, pausar, reiniciar, restante, transcurrido } from './tiempo.mjs';

const PREFS = 'openclass-build-tech:prefs';
const CLASE = `openclass-build-tech:clase:${location.pathname}`;
const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const letra = (i) => String.fromCharCode(65 + i);
const mmss = (s) => (Number.isFinite(s) ? formatoReloj(s * 1000) : '–:––');
const ACCION_TEXTO = { reproducir: 'Reproducir', pausar: 'Pausar', reiniciar: 'Reiniciar' };

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

export function montarBuildTech(raiz) {
  document.documentElement.dataset.ocVista = 'build-tech';
  // La clave de presentador (si el navegador copió sessionStorage al abrir la ventana) no se usa aquí.
  try { sessionStorage.removeItem('openclass-live:clave'); } catch { /* sin almacenamiento */ }
  const origen = location.origin;
  const prefs = { letra: 30, soloNotas: false, siguiente: true, notas: null, ...leer(PREFS, {}) };
  let tiempo = leerTiempo(leer(CLASE, null));
  let est = null;
  let ultimoEstado = 0;
  let conexion = 'esperando'; // esperando | conectada | perdida | sin-presentacion
  let confirmarReinicio = false;
  let avisoClase = false;
  let destacada = null; // ancla destacada desde un marcador
  let solucionAbierta = false;
  let pasoPrevio = null;

  // ---------- Esqueleto ----------
  const relojHora = el('time', { clase: 'bt-hora', 'aria-label': 'Hora actual' });
  const clase = el('section', { clase: 'bt-clase', 'aria-label': 'Tiempo de clase' });
  const chipLive = el('div', { clase: 'bt-chip-live', 'aria-live': 'polite' });
  const estadoConexion = el('p', { clase: 'bt-conexion', role: 'status' });
  const herramientas = el('div', { clase: 'bt-herramientas', role: 'group', 'aria-label': 'Preferencias de Build Tech' });
  const cabecera = el('header', { clase: 'bt-cabecera' },
    el('div', { clase: 'bt-marca' }, el('strong', { texto: 'Build Tech' }), el('span', { clase: 'bt-privado', texto: 'Privado · no compartir' })),
    relojHora, clase, chipLive, herramientas);

  const notasCab = el('div', { clase: 'bt-notas-cab' });
  const notasTexto = el('div', { clase: 'bt-notas-texto', tabindex: '0', 'aria-label': 'Notas del orador', 'aria-live': 'off' });
  const navegacion = el('nav', { clase: 'bt-nav', 'aria-label': 'Navegación de la presentación' });
  const notas = el('section', { clase: 'bt-notas', 'aria-label': 'Notas del orador' }, notasCab, notasTexto, navegacion);
  const divisor = el('div', { clase: 'bt-divisor', role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Cambiar el ancho de las notas (flechas izquierda y derecha)', tabindex: '0' });

  const marcoActual = el('div', { clase: 'bt-marco' });
  const anclasCapa = el('div', { clase: 'bt-anclas' });
  const previaActual = el('section', { clase: 'bt-previa', 'aria-label': 'Vista previa de la diapositiva actual' },
    el('h2', { clase: 'bt-titulo', texto: 'Diapositiva actual' }), marcoActual);
  const marcoSiguiente = el('div', { clase: 'bt-marco' });
  const previaSiguiente = el('section', { clase: 'bt-siguiente', 'aria-label': 'Vista previa de la siguiente diapositiva' },
    el('h2', { clase: 'bt-titulo', texto: 'Siguiente diapositiva' }), marcoSiguiente);
  const medios = el('section', { clase: 'bt-medios', 'aria-label': 'Multimedia de la diapositiva', hidden: true });
  const solucion = el('section', { clase: 'bt-solucion', 'aria-label': 'Solución privada', hidden: true });
  const liveSec = el('section', { clase: 'bt-live', 'aria-label': 'En vivo', hidden: true, tabindex: '-1' });
  const preguntas = el('section', { clase: 'bt-preguntas', 'aria-label': 'Preguntas de estudiantes', hidden: true });
  // Lo que pide acción en este momento (multimedia o votación) va justo bajo la diapositiva actual, sin desplazarse.
  const lateral = el('aside', { clase: 'bt-lateral' }, previaActual, medios, liveSec, solucion, previaSiguiente, preguntas);
  const aviso = el('p', { clase: 'bt-aviso', role: 'status', 'aria-live': 'polite' });
  const cuerpo = el('main', { clase: 'bt-cuerpo' }, notas, divisor, lateral);
  const app = el('div', { clase: 'bt' }, cabecera, estadoConexion, cuerpo, aviso);
  raiz.replaceChildren(app);

  // ---------- Puente con la presentación ----------
  const pendientes = new Map();
  let secuencia = 0;
  const presentacion = () => window.opener;
  function enviar(tipo, datos) {
    const p = presentacion();
    if (!p || p.closed) return false;
    try { p.postMessage(sobre(tipo, datos), origen); return true; } catch { return false; }
  }
  /** Orden explícita a la presentación; devuelve su confirmación (o un error si no responde). */
  function orden(o) {
    if (conexion !== 'conectada') return Promise.resolve({ ok: false, mensaje: 'Sin conexión con la presentación.' });
    const id = `o${++secuencia}`;
    return new Promise((resolve) => {
      const reloj = setTimeout(() => { pendientes.delete(id); resolve({ ok: false, mensaje: 'La presentación no respondió. Revise que siga abierta.' }); }, o.ambito === 'medio' ? 8000 : 12_000);
      pendientes.set(id, (r) => { clearTimeout(reloj); resolve(r); });
      if (!enviar('orden', { id, orden: o })) { clearTimeout(reloj); pendientes.delete(id); resolve({ ok: false, mensaje: 'Sin conexión con la presentación.' }); }
    });
  }
  async function pedir(o, boton) {
    if (boton) boton.disabled = true;
    const r = await orden(o);
    if (boton?.isConnected) boton.disabled = conexion !== 'conectada';
    if (!r.ok) avisar(r.mensaje || 'No se pudo completar la acción.', 'error'); else if (o.ambito !== 'navegar') avisar('');
    return r;
  }

  window.addEventListener('message', (ev) => {
    const d = mensajeDe(ev, { origen, esperada: presentacion(), de: 'presentacion' });
    if (!d) return;
    if (d.tipo === 'respuesta') { pendientes.get(d.id)?.({ ok: d.ok, mensaje: d.mensaje }); pendientes.delete(d.id); return; }
    if (d.tipo === 'adios') { cambiarConexion('perdida'); return; }
    if (d.tipo === 'estado' && d.estado) {
      est = d.estado;
      ultimoEstado = Date.now();
      cambiarConexion('conectada');
      pintar();
    }
  });
  window.addEventListener('pagehide', () => enviar('adios'));
  // Saludo inicial y latido: si la presentación se recarga, la conexión se recupera sola.
  const saludar = () => {
    const p = presentacion();
    if (!p || p.closed) return cambiarConexion('sin-presentacion');
    if (Date.now() - ultimoEstado > 7000 && conexion === 'conectada') cambiarConexion('perdida');
    enviar('hola');
  };
  saludar();
  setInterval(saludar, 2500);

  function cambiarConexion(nueva) {
    if (conexion === nueva) return;
    conexion = nueva;
    const textos = {
      esperando: 'Conectando con la presentación…',
      perdida: 'La presentación no responde (¿se está recargando?). Build Tech se reconecta sola; la clase sigue en la presentación.',
      'sin-presentacion': 'No hay presentación vinculada. Abra Build Tech desde la presentación: botón «Vista del presentador» → Build Tech, o tecla T.',
      conectada: '',
    };
    estadoConexion.textContent = textos[nueva];
    estadoConexion.dataset.estado = nueva;
    app.classList.toggle('bt-desconectada', nueva !== 'conectada');
    for (const k of Object.keys(firmas)) delete firmas[k];
    pintar();
  }

  let relojAviso = null;
  function avisar(texto, tipo = '') {
    aviso.textContent = texto;
    aviso.dataset.tipo = tipo;
    clearTimeout(relojAviso);
    if (texto) relojAviso = setTimeout(() => { aviso.textContent = ''; }, tipo === 'error' ? 9000 : 5000);
  }

  // ---------- Repintado por secciones (el foco no salta con cada actualización) ----------
  const firmas = {};
  function seccion(nombre, nodo, firma, construir, actualizar) {
    const f = JSON.stringify(firma);
    if (firmas[nombre] !== f) {
      firmas[nombre] = f;
      const foco = nodo.contains(document.activeElement) ? document.activeElement.dataset.foco : null;
      nodo.replaceChildren(...[construir()].flat().filter(Boolean));
      if (foco) nodo.querySelector(`[data-foco="${CSS.escape(foco)}"]`)?.focus();
    }
    actualizar?.();
  }
  const activo = () => conexion === 'conectada';
  // Toda acción sobre la presentación queda deshabilitada mientras no hay conexión con ella.
  const boton = (texto, accionClick, { primario = false, foco, ayuda, clase: c = '', disabled = false, ...otros } = {}) => el('button', {
    type: 'button', clase: `bt-boton${primario ? ' primario' : ''}${c ? ` ${c}` : ''}`, 'data-foco': foco ?? texto, title: ayuda, texto,
    ...otros, disabled: !activo() || disabled, onclick: (ev) => accionClick(ev.currentTarget) });
  const ayuda = (texto) => el('p', { clase: 'bt-ayuda', texto });

  // ---------- Herramientas (preferencias locales) ----------
  function pintarHerramientas() {
    seccion('herramientas', herramientas, [prefs, est?.relojPublico, activo()], () => [
      el('button', { type: 'button', clase: 'bt-boton', 'aria-label': 'Reducir la letra de las notas (−)', title: 'Reducir letra (−)', texto: 'A−', 'data-foco': 'menos', onclick: () => cambiarLetra(-2) }),
      el('button', { type: 'button', clase: 'bt-boton', 'aria-label': 'Ampliar la letra de las notas (+)', title: 'Ampliar letra (+)', texto: 'A+', 'data-foco': 'mas', onclick: () => cambiarLetra(2) }),
      el('button', { type: 'button', clase: 'bt-boton', 'aria-pressed': String(prefs.soloNotas), 'data-foco': 'solo', title: 'Solo notas (N)', texto: 'Solo notas', onclick: alternarSoloNotas }),
      el('label', { clase: 'bt-check' }, el('input', { type: 'checkbox', checked: prefs.siguiente, 'data-foco': 'siguiente', onchange: (e) => { prefs.siguiente = e.target.checked; guardarPrefs(); aplicarPrefs(); } }), ' Siguiente'),
      el('label', { clase: 'bt-check', title: 'Muestra la hora, pequeña, en la pantalla compartida. Desactivado por defecto.' },
        el('input', { type: 'checkbox', checked: Boolean(est?.relojPublico), disabled: !activo(), 'data-foco': 'reloj', onchange: (e) => pedir({ ambito: 'reloj', accion: 'publico', valor: e.target.checked }) }), ' Hora en la presentación'),
      el('details', { clase: 'bt-atajos' }, el('summary', { texto: 'Atajos' }),
        el('p', { texto: '→ / AvPág / Espacio: siguiente · ← / RePág: anterior · Inicio / Fin · N: solo notas · + / −: letra · L: En vivo · Esc: cerrar ayuda' })),
    ]);
  }
  const guardarPrefs = () => guardar(PREFS, prefs);
  function cambiarLetra(d) { prefs.letra = Math.min(56, Math.max(18, prefs.letra + d)); guardarPrefs(); aplicarPrefs(); pintarHerramientas(); }
  function alternarSoloNotas() { prefs.soloNotas = !prefs.soloNotas; guardarPrefs(); aplicarPrefs(); pintarHerramientas(); }
  function aplicarPrefs() {
    app.style.setProperty('--bt-letra', `${prefs.letra}px`);
    if (prefs.notas) app.style.setProperty('--bt-ancho-notas', `${prefs.notas}px`); else app.style.removeProperty('--bt-ancho-notas');
    app.classList.toggle('bt-solo-notas', prefs.soloNotas);
    previaSiguiente.hidden = !prefs.siguiente;
  }

  // ---------- Divisor redimensionable (puntero y teclado) ----------
  function fijarAncho(px) {
    const max = Math.max(360, cuerpo.clientWidth - 320);
    prefs.notas = Math.round(Math.min(max, Math.max(320, px)));
    divisor.setAttribute('aria-valuenow', String(prefs.notas));
    aplicarPrefs();
  }
  divisor.addEventListener('pointerdown', (ev) => {
    divisor.setPointerCapture(ev.pointerId);
    const mover = (e) => fijarAncho(e.clientX - cuerpo.getBoundingClientRect().left);
    const fin = () => { divisor.removeEventListener('pointermove', mover); guardarPrefs(); };
    divisor.addEventListener('pointermove', mover);
    divisor.addEventListener('pointerup', fin, { once: true });
    divisor.addEventListener('lostpointercapture', fin, { once: true });
  });
  divisor.addEventListener('keydown', (ev) => {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    ev.preventDefault(); ev.stopPropagation();
    fijarAncho(notas.getBoundingClientRect().width + (ev.key === 'ArrowRight' ? 32 : -32));
    guardarPrefs();
  });

  // ---------- Relojes ----------
  const guardarTiempo = () => guardar(CLASE, tiempo);
  function pintarClase() {
    const ahora = Date.now();
    const f = fase(tiempo, ahora);
    seccion('clase', clase, [f === 'excedida' ? (tiempo.desde !== null ? 'corriendo' : 'pausada') : f, tiempo.duracionMin, confirmarReinicio], () => {
      const corre = tiempo.desde !== null;
      const cifras = el('div', { clase: 'bt-clase-cifras' },
        el('span', { clase: 'bt-etq', texto: 'Clase' }),
        el('b', { clase: 'bt-transcurrido', role: 'timer', 'aria-label': 'Tiempo de clase transcurrido' }),
        el('span', { clase: 'bt-restante', role: 'timer', 'aria-label': 'Tiempo de clase restante' }));
      const acciones = el('div', { clase: 'bt-clase-acciones' });
      if (f === 'lista') {
        const otra = el('input', { type: 'number', min: String(MIN_CLASE), max: String(MAX_CLASE), step: '5', value: String(tiempo.duracionMin), clase: 'bt-minutos',
          'aria-label': 'Duración personalizada en minutos', 'data-foco': 'minutos',
          onchange: (e) => { const n = Number(e.target.value); if (duracionValida(n)) { tiempo = configurar(tiempo, n); guardarTiempo(); pintarClase(); } else avisar(`La duración debe estar entre ${MIN_CLASE} y ${MAX_CLASE} minutos.`, 'error'); } });
        acciones.append(
          el('div', { clase: 'bt-segmentos', role: 'radiogroup', 'aria-label': 'Duración de la clase' },
            DURACIONES_CLASE.map((m) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(tiempo.duracionMin === m), clase: `bt-boton${tiempo.duracionMin === m ? ' activo' : ''}`, 'data-foco': `d${m}`, texto: `${m}`,
              title: `${m} minutos`, onclick: () => { tiempo = configurar(tiempo, m); guardarTiempo(); pintarClase(); } })),
            el('label', { clase: 'bt-otra' }, otra, ' min')),
          el('button', { type: 'button', clase: 'bt-boton primario', 'data-foco': 'iniciar', texto: 'Iniciar', onclick: () => { tiempo = iniciar(tiempo, Date.now()); guardarTiempo(); pintarClase(); } }));
      } else if (confirmarReinicio) {
        acciones.append(el('span', { clase: 'bt-confirmar', texto: '¿Reiniciar el tiempo de clase?' }),
          el('button', { type: 'button', clase: 'bt-boton peligro', 'data-foco': 'si', texto: 'Sí, reiniciar', onclick: () => { tiempo = reiniciar(tiempo); avisoClase = false; confirmarReinicio = false; guardarTiempo(); pintarClase(); } }),
          el('button', { type: 'button', clase: 'bt-boton', 'data-foco': 'no', texto: 'Cancelar', onclick: () => { confirmarReinicio = false; pintarClase(); } }));
      } else {
        acciones.append(
          corre ? el('button', { type: 'button', clase: 'bt-boton', 'data-foco': 'pausa', texto: 'Pausar', onclick: () => { tiempo = pausar(tiempo, Date.now()); guardarTiempo(); pintarClase(); } })
            : el('button', { type: 'button', clase: 'bt-boton primario', 'data-foco': 'reanudar', texto: 'Reanudar', onclick: () => { tiempo = iniciar(tiempo, Date.now()); guardarTiempo(); pintarClase(); } }),
          el('button', { type: 'button', clase: 'bt-boton', 'data-foco': 'reiniciar', texto: 'Reiniciar…', title: 'Pide confirmación', onclick: () => { confirmarReinicio = true; pintarClase(); } }),
          el('span', { clase: 'bt-duracion', texto: `de ${tiempo.duracionMin} min` }));
      }
      return [cifras, acciones];
    }, () => {
      const t = transcurrido(tiempo, ahora); const r = restante(tiempo, ahora);
      clase.querySelector('.bt-transcurrido').textContent = formatoReloj(t);
      clase.querySelector('.bt-restante').textContent = r >= 0 ? `restan ${formatoReloj(r)}` : `excedido ${formatoReloj(r)}`;
      clase.dataset.fase = f;
      if (f === 'excedida' && !avisoClase) {
        avisoClase = true;
        avisar('Terminó el tiempo de clase previsto. La sala En vivo sigue abierta: ciérrela cuando usted decida.', 'alerta');
      }
    });
  }

  // ---------- Notas ----------
  const pasoActual = () => est?.fragmentos?.visibles ?? 0;
  function numeroAncla(a) { return (est?.anclas ?? []).filter((x) => anclasConNota().includes(x)).indexOf(a) + 1; }
  function anclasConNota() { return [...new Set((est?.notas ?? []).map((b) => b.ancla).filter(Boolean))].filter((a) => est?.anclas?.includes(a)); }
  const texto = (segs) => segs.map((s) => (s.f.length ? el(s.f.includes('code') ? 'code' : s.f.includes('b') ? 'strong' : 'em', { clase: s.f.join(' '), texto: s.t }) : s.t));

  function pintarNotas() {
    const e = est;
    seccion('notas-cab', notasCab, [e?.posicion, e?.total, e?.titulo, e?.fragmentos], () => e ? [
      el('span', { clase: 'bt-posicion', texto: `Diapositiva ${e.posicion} / ${e.total}` }),
      e.fragmentos.total ? el('span', { clase: 'bt-pasos', texto: `· paso ${e.fragmentos.visibles} de ${e.fragmentos.total}` }) : null,
      el('span', { clase: 'bt-titulo-diapo', texto: e.titulo }),
    ] : el('span', { texto: 'Esperando la presentación…' }));

    seccion('notas', notasTexto, [e?.indices?.h, e?.indices?.v, e?.notas, e?.notasFragmento, e?.medios?.map((m) => [m.id, m.ancla, m.control]), e?.anclas, activo()], () => {
      if (!e) return el('p', { clase: 'bt-vacio', texto: 'Las notas aparecerán aquí al conectar con la presentación.' });
      const bloques = [];
      const fragmento = e.notasFragmento?.length ? el('div', { clase: 'bt-nota-fragmento', 'aria-label': 'Nota del fragmento actual' }, e.notasFragmento.map(pintarBloque)) : null;
      if (fragmento) bloques.push(fragmento);
      for (const b of e.notas) bloques.push(pintarBloque(b));
      if (!e.notas.length && !fragmento) bloques.push(el('p', { clase: 'bt-vacio', texto: 'Esta diapositiva no tiene notas. Escríbalas en el Markdown, después de «Notes:».' }));
      return bloques;
    }, () => {
      const paso = pasoActual();
      let actual = null;
      for (const n of notasTexto.querySelectorAll('[data-paso]')) {
        const es = Number(n.dataset.paso) === paso;
        n.classList.toggle('actual', es);
        if (es) actual ??= n;
      }
      for (const n of notasTexto.querySelectorAll('[data-ancla]')) n.classList.toggle('destacada', n.dataset.ancla === destacada);
      const clave = `${e?.indices?.h}.${e?.indices?.v}.${paso}`;
      if (actual && clave !== pasoPrevio) actual.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      else if (!actual && e && `${e.indices.h}.${e.indices.v}` !== pasoPrevio?.split('.').slice(0, 2).join('.')) notasTexto.scrollTop = 0;
      pasoPrevio = clave;
    });
  }

  function pintarBloque(b) {
    const etiqueta = { p: 'p', h: 'h3', pre: 'pre', cita: 'blockquote', li: 'div', hr: 'hr' }[b.tipo] ?? 'p';
    if (b.tipo === 'hr') return el('hr');
    const nodo = el(etiqueta, { clase: `bt-nota bt-nota-${b.tipo}${b.tipo === 'li' ? ` bt-nivel-${Math.min(3, b.nivel ?? 0)}` : ''}`, 'data-paso': b.paso ?? null, 'data-ancla': b.ancla ?? null });
    if (b.tipo === 'li') nodo.append(el('span', { clase: 'bt-vineta', 'aria-hidden': 'true', texto: b.lista === 'ol' ? `${b.n}.` : '•' }));
    if (b.paso !== undefined) nodo.append(el('span', { clase: 'bt-marca-paso', title: `Punto de lectura: con ${b.paso} fragmento(s) visibles`, texto: `${b.paso}` }));
    if (b.ancla) {
      const n = numeroAncla(b.ancla);
      nodo.append(el('button', { type: 'button', clase: 'bt-marca-ancla', 'data-foco': `nota-${b.ancla}`, title: n ? 'Nota anclada: ver su marcador en la vista previa' : `Ancla «${b.ancla}» no encontrada en esta diapositiva`,
        'aria-label': `Nota anclada ${n || b.ancla}`, texto: n ? String(n) : '?', onclick: () => destacar(b.ancla) }));
    }
    nodo.append(...(b.tipo === 'pre' ? [el('code', { texto: b.texto.map((s) => s.t).join('') })] : texto(b.texto)));
    if (b.accion && ACCIONES_NOTA.includes(b.accion)) {
      const medio = est?.medios?.find((m) => m.ancla === b.ancla);
      const posible = Boolean(medio?.control);
      nodo.append(el('button', { type: 'button', clase: 'bt-boton bt-accion-nota', 'data-foco': `accion-${b.ancla}-${b.accion}`, disabled: !activo() || !posible,
        title: posible ? `Acción declarada en la nota: ${ACCION_TEXTO[b.accion].toLowerCase()} «${medio.titulo}» en la presentación` : (medio?.motivo ?? 'No hay un video o audio controlable en ese ancla'),
        texto: `${b.accion === 'reproducir' ? '▶ ' : b.accion === 'pausar' ? '❚❚ ' : '↺ '}${ACCION_TEXTO[b.accion]}${medio ? ` · ${medio.titulo}` : ''}`,
        onclick: (ev) => pedir({ ambito: 'medio', accion: b.accion, medio: medio.id }, ev.currentTarget) }));
    }
    return nodo;
  }

  function destacar(ancla) {
    destacada = destacada === ancla ? null : ancla;
    firmas['anclas'] = '';
    pintar();
    if (destacada) {
      const nota = notasTexto.querySelector(`[data-ancla="${CSS.escape(ancla)}"]`);
      nota?.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
  }

  // ---------- Vistas previas privadas (la misma presentación en modo receiver, sin sonido) ----------
  function crearPrevia(marco, titulo, conAnclas) {
    const iframe = el('iframe', { src: urlVista(location, 'previa'), title: titulo, tabindex: '-1', loading: 'eager' });
    marco.append(iframe);
    if (conAnclas) marco.append(anclasCapa);
    return { iframe, objetivo: null, aplicado: null, conAnclas };
  }
  const previas = [crearPrevia(marcoActual, 'Vista previa privada de la diapositiva actual', true), crearPrevia(marcoSiguiente, 'Vista previa privada de la siguiente diapositiva', false)];
  const deckDe = (p) => { try { const d = p.iframe.contentWindow?.OpenClass?.deck; return d?.isReady?.() ? d : null; } catch { return null; } };
  function sincronizarPrevias() {
    const e = est;
    previas[0].objetivo = e ? { indexh: e.indices.h, indexv: e.indices.v, indexf: e.indices.f } : null;
    previas[1].objetivo = e?.siguiente ? { indexh: e.siguiente.h, indexv: e.siguiente.v, indexf: -1 } : null;
    marcoSiguiente.classList.toggle('bt-fin', Boolean(e && !e.siguiente));
    for (const p of previas) {
      if (!p.objetivo) continue;
      const f = JSON.stringify(p.objetivo);
      if (f === p.aplicado) continue;
      const d = deckDe(p);
      if (!d) continue;
      try { d.setState(p.objetivo); p.aplicado = f; } catch { continue; }
      if (p.conAnclas) requestAnimationFrame(() => requestAnimationFrame(pintarAnclas));
    }
  }
  setInterval(sincronizarPrevias, 400);
  new ResizeObserver(() => pintarAnclas()).observe(marcoActual);

  /** Marcadores sobre la miniatura privada: solo para elementos con ancla explícita y nota que la cite. */
  function pintarAnclas() {
    const d = deckDe(previas[0]);
    const lista = anclasConNota();
    anclasCapa.replaceChildren();
    if (!d || !lista.length) return;
    const slide = d.getCurrentSlide();
    const caja = previas[0].iframe.getBoundingClientRect();
    const capa = anclasCapa.getBoundingClientRect();
    for (const a of lista) {
      const objetivo = [...slide.querySelectorAll('[data-oc-nota]')].find((n) => n.dataset.ocNota === a);
      const r = objetivo?.getBoundingClientRect();
      if (!r || !r.width) continue;
      const n = numeroAncla(a);
      const nota = est.notas.find((b) => b.ancla === a);
      const resumen = (nota?.texto ?? []).map((s) => s.t).join('').slice(0, 140);
      anclasCapa.append(el('button', { type: 'button', clase: `bt-ancla${destacada === a ? ' destacada' : ''}`, 'data-foco': `ancla-${a}`,
        style: `left:${caja.left - capa.left + r.left}px;top:${caja.top - capa.top + r.top}px`,
        'aria-label': `Nota anclada ${n}: ${resumen}`, title: resumen, texto: String(n), onclick: () => destacar(a) }));
    }
  }

  // ---------- Navegación ----------
  function pintarNavegacion() {
    const e = est;
    seccion('nav', navegacion, [e?.posicion, e?.total, e?.fragmentos, activo()], () => [
      boton('|◀', (b) => pedir({ ambito: 'navegar', accion: 'anteriorDiapositiva' }, b), { foco: 'ant-d', ayuda: 'Diapositiva anterior (sin fragmentos)', 'aria-label': 'Diapositiva anterior', disabled: !e || e.posicion <= 1 }),
      boton('◀ Anterior', (b) => pedir({ ambito: 'navegar', accion: 'anterior' }, b), { foco: 'ant', ayuda: 'Paso anterior (←)', clase: 'grande', disabled: !e || (e.posicion <= 1 && !e.fragmentos.visibles) }),
      el('span', { clase: 'bt-nav-pos', 'aria-live': 'polite', texto: e ? `${e.posicion} / ${e.total}` : '' }),
      boton('Siguiente ▶', (b) => pedir({ ambito: 'navegar', accion: 'siguiente' }, b), { foco: 'sig', primario: true, ayuda: 'Siguiente paso o fragmento (→)', clase: 'grande', disabled: !e || (e.posicion >= e.total && e.fragmentos.visibles >= e.fragmentos.total) }),
      boton('▶|', (b) => pedir({ ambito: 'navegar', accion: 'siguienteDiapositiva' }, b), { foco: 'sig-d', ayuda: 'Siguiente diapositiva (sin fragmentos)', 'aria-label': 'Siguiente diapositiva', disabled: !e || e.posicion >= e.total }),
    ]);
  }

  // ---------- Multimedia ----------
  function pintarMedios() {
    const lista = est?.medios ?? [];
    medios.hidden = !lista.length;
    seccion('medios', medios, [lista.map((m) => [m.id, m.tipo, m.titulo, m.control, m.motivo, m.preparando]), activo()], () => [
      el('h2', { clase: 'bt-titulo', texto: 'Multimedia en la presentación' }),
      ayuda('Las órdenes se ejecutan en el reproductor de la presentación compartida; aquí no suena nada.'),
      ...lista.map((m) => {
        const tarjeta = el('div', { clase: 'bt-medio', 'data-medio': m.id },
          el('p', { clase: 'bt-medio-titulo' }, el('span', { clase: 'bt-tipo', texto: { video: 'Video', audio: 'Audio', youtube: 'YouTube', externo: 'Integrado' }[m.tipo] }), ` ${m.titulo}`));
        if (!m.control) { tarjeta.append(el('p', { clase: `bt-ayuda${m.preparando ? '' : ' bt-sin-control'}`, texto: m.preparando ? m.motivo : `Control externo no disponible. ${m.motivo}` })); return tarjeta; }
        const pedirMedio = (accion, valor) => (b) => pedir({ ambito: 'medio', medio: m.id, accion, ...(valor !== undefined ? { valor } : {}) }, b);
        tarjeta.append(
          el('p', { clase: 'bt-medio-estado', 'aria-live': 'polite' }),
          el('div', { clase: 'bt-fila' },
            boton('▶ Reproducir', pedirMedio('reproducir'), { primario: true, foco: `${m.id}-play`, clase: 'bt-play' }),
            boton('❚❚ Pausar', pedirMedio('pausar'), { foco: `${m.id}-pausa`, clase: 'bt-pausa' }),
            boton('↺ Reiniciar', pedirMedio('reiniciar'), { foco: `${m.id}-reiniciar`, ayuda: 'Vuelve al inicio' }),
            boton('Silenciar', (b) => pedir({ ambito: 'medio', medio: m.id, accion: 'silencio', valor: !b.dataset.silencio }, b), { foco: `${m.id}-mute`, clase: 'bt-mute' })),
          el('label', { clase: 'bt-rango' }, el('span', { texto: 'Posición' }),
            el('input', { type: 'range', min: '0', max: '100', step: '1', value: '0', clase: 'bt-pos', 'data-foco': `${m.id}-pos`, disabled: !activo(),
              'aria-label': `Posición de ${m.titulo}`, onchange: (e) => pedir({ ambito: 'medio', medio: m.id, accion: 'buscar', valor: Number(e.target.value) }) })),
          el('label', { clase: 'bt-rango' }, el('span', { texto: 'Volumen' }),
            el('input', { type: 'range', min: '0', max: '1', step: '0.05', value: '1', clase: 'bt-vol', 'data-foco': `${m.id}-vol`, disabled: !activo(),
              'aria-label': `Volumen de ${m.titulo}`, onchange: (e) => pedir({ ambito: 'medio', medio: m.id, accion: 'volumen', valor: Number(e.target.value) }) })));
        return tarjeta;
      })], () => {
      for (const m of lista) {
        const t = medios.querySelector(`[data-medio="${m.id}"]`);
        if (!t || !m.control) continue;
        t.querySelector('.bt-medio-estado').textContent = `${m.error ? `${m.error} ` : ''}${m.reproduciendo ? 'Reproduciendo' : m.terminado ? 'Terminado' : 'En pausa'} · ${mmss(m.actual)} / ${mmss(m.duracion)}${m.silencio ? ' · silenciado' : ''}`;
        t.dataset.reproduciendo = String(Boolean(m.reproduciendo));
        const pos = t.querySelector('.bt-pos');
        if (document.activeElement !== pos) { pos.max = String(Math.max(1, Math.floor(m.duracion ?? 0))); pos.value = String(Math.floor(m.actual ?? 0)); }
        const vol = t.querySelector('.bt-vol');
        if (document.activeElement !== vol) vol.value = String(m.volumen ?? 1);
        const mute = t.querySelector('.bt-mute');
        mute.textContent = m.silencio ? 'Activar sonido' : 'Silenciar';
        if (m.silencio) mute.dataset.silencio = '1'; else delete mute.dataset.silencio;
      }
    });
  }

  // ---------- Solución privada ----------
  function pintarSolucion() {
    const enc = est?.encuesta;
    solucion.hidden = !enc;
    seccion('solucion', solucion, [enc, solucionAbierta], () => {
      if (!enc) return [];
      const definida = enc.correctas.length || enc.explicacion;
      const detalles = el('details', { clase: 'bt-solucion-det', open: solucionAbierta, ontoggle: () => { solucionAbierta = detalles.open; } },
        el('summary', { 'data-foco': 'solucion', texto: 'Solución privada (solo usted la ve)' }),
        !definida ? ayuda('Esta pregunta no tiene respuesta correcta ni explicación definidas.') : null,
        enc.correctas.length ? el('p', { clase: 'bt-correcta' }, el('strong', { texto: enc.correctas.length > 1 ? 'Correctas: ' : 'Correcta: ' }),
          enc.correctas.map((l) => `${l}. ${enc.opciones[l.charCodeAt(0) - 65] ?? ''}`).join(' · ')) : null,
        enc.explicacion ? el('div', { clase: 'bt-explicacion' }, enc.explicacion.split('```').map((parte, i) => (i % 2
          ? el('pre', {}, el('code', { texto: parte.replace(/^[\w+-]*\n/, '').replace(/\n$/, '') }))
          : parte.trim() ? el('p', { texto: parte.trim() }) : null))) : null,
        ayuda('Consultarla aquí no la publica. Para mostrarla a todos use «Revelar explicación» en En vivo.'));
      return [el('h2', { clase: 'bt-titulo', texto: 'Pregunta de esta diapositiva' }), el('p', { clase: 'bt-enunciado', texto: enc.enunciado }), detalles];
    });
  }

  // ---------- OpenClass Live ----------
  const ultima = (a) => a?.rondas?.[a.rondas.length - 1] ?? null;
  function pintarChipLive() {
    const l = est?.live;
    let texto = 'En vivo: no activado'; let tipo = 'apagado';
    if (l?.disponible) {
      if (l.conectando) { texto = 'En vivo: conectando…'; tipo = 'alerta'; }
      else if (l.reconectando) { texto = 'En vivo: reconectando…'; tipo = 'alerta'; }
      else if (!l.sala) { texto = 'En vivo: sala sin conectar'; tipo = 'apagado'; }
      else if (l.momento.tipo === 'votando') { texto = `Votación · ${ultima(l.activa)?.respondientes ?? 0} de ${l.sala.conectados}`; tipo = 'votando'; }
      else { texto = `Sala ${l.sala.codigo.slice(0, 3)} ${l.sala.codigo.slice(3)} · ${l.sala.conectados} conectados`; tipo = 'conectado'; }
    }
    const r = ultima(l?.activa);
    seccion('chip', chipLive, [texto, tipo, l?.momento?.tipo === 'votando' ? r?.cierraLocal : null], () => [
      el('span', { clase: 'bt-punto', 'aria-hidden': 'true' }), el('span', { texto }),
      l?.momento?.tipo === 'votando' && r?.cierraLocal ? el('b', { clase: 'bt-voto-tiempo', role: 'timer', 'aria-label': 'Tiempo de votación restante', 'data-bt-hasta': String(r.cierraLocal) }) : null]);
    chipLive.dataset.estado = tipo;
  }

  function barras(a, r, privado) {
    return el('div', { clase: 'bt-barras', 'aria-label': privado ? 'Tendencias privadas' : 'Resultados' }, a.opciones.map((o, i) => el('div', { clase: 'bt-barra', 'data-i': String(i) },
      el('span', { clase: 'bt-op', texto: `${letra(i)}. ${o}` }), el('span', { clase: 'bt-pct', texto: `${r?.porcentajes?.[i] ?? 0}% (${r?.conteos?.[i] ?? 0})` }),
      el('span', { clase: 'bt-pista' }, el('i', { style: `width:${r?.porcentajes?.[i] ?? 0}%` })))));
  }

  function pintarLive() {
    const l = est?.live;
    liveSec.hidden = !l?.disponible;
    if (!l?.disponible) return;
    const m = l.momento;
    const a = l.activa;
    const r = ultima(a);
    const live = (accion, valor) => (b) => pedir({ ambito: 'live', accion, ...(valor !== undefined ? { valor } : {}) }, b);
    seccion('live', liveSec, [m, a && { ...a, rondas: a.rondas.map((x) => [x.cierraLocal, x.cierre]) }, l.sala && { ...l.sala, conectados: 0 }, l.vista, l.aqui, l.conectando, l.reconectando, activo()], () => {
      const partes = [el('h2', { clase: 'bt-titulo', texto: 'En vivo' })];
      if (l.conectando || l.reconectando) partes.push(ayuda(l.conectando ? 'Conectando la presentación con la sala…' : 'Conexión momentánea perdida: la sala y la votación siguen en el servidor.'));
      if (!l.sala) {
        partes.push(ayuda('La sala se conecta en la presentación: menú «En vivo» (tecla L), pegando la clave del panel docente. Build Tech nunca recibe la clave.'),
          boton('Abrir «En vivo» en la presentación', live('menu'), { foco: 'menu', ayuda: 'El menú aparece en la pantalla compartida: hágalo antes de compartir, o pegue la clave rápido.' }));
        return partes;
      }
      partes.push(el('p', { clase: 'bt-sala' }, 'Sala ', el('b', { 'aria-label': [...l.sala.codigo].join(' '), texto: `${l.sala.codigo.slice(0, 3)} ${l.sala.codigo.slice(3)}` }), ' · ',
        el('b', { 'data-bt-conectados': '' }), ' conectados · votación de ', l.sala.duracionVotacion ? `${l.sala.duracionVotacion} s` : 'tiempo libre'));
      switch (m.tipo) {
        case 'sin-encuesta':
          partes.push(ayuda('Esta diapositiva no tiene pregunta. Al llegar a una con pregunta aparecerá «Iniciar votación».'));
          break;
        case 'lista':
          partes.push(el('p', { clase: 'bt-enunciado', texto: l.aqui?.enunciado ?? '' }),
            boton(`Iniciar votación · ${l.sala.duracionVotacion ? `${l.sala.duracionVotacion} s` : 'sin límite'}`, live('iniciar'), { primario: true, foco: 'iniciar' }),
            ayuda('Los estudiantes responden desde el teléfono. Las tendencias solo las ve usted hasta que decida proyectarlas.'));
          break;
        case 'votando':
          partes.push(el('p', { clase: 'bt-m-titulo', texto: `${a.ronda === 2 ? 'Segunda ronda' : 'Votación'} abierta${m.otra ? ' (de otra diapositiva)' : ''}` }),
            el('div', { clase: 'bt-cifras' },
              r?.cierraLocal ? el('b', { clase: 'bt-voto-reloj', role: 'timer', 'aria-label': 'Tiempo de votación restante', 'data-bt-hasta': String(r.cierraLocal) }) : el('b', { clase: 'bt-voto-reloj', texto: 'Sin límite' }),
              el('span', {}, el('b', { 'data-bt-respuestas': '' }), ' de ', el('span', { 'data-bt-conectados': '' }), ' respondieron')),
            el('p', { clase: 'bt-etiqueta-barras', texto: l.vista.tendencias ? 'Tendencias: proyectadas en la pantalla (sin la correcta)' : 'Tendencias privadas: no se proyectan' }),
            barras(a, r, true),
            el('div', { clase: 'bt-fila' },
              boton('Cerrar ahora', live('cerrar'), { primario: true, foco: 'cerrar', ayuda: 'Cierra la votación. No muestra resultados.' }),
              r?.cierraLocal ? boton('+30 segundos', live('extender'), { foco: 'extender' }) : null,
              boton(l.vista.tendencias ? 'Dejar de proyectar tendencias' : 'Proyectar tendencias', live('tendencias'), { foco: 'tendencias', 'aria-pressed': String(l.vista.tendencias), ayuda: 'Muestra en la pantalla compartida cómo van las respuestas, sin la correcta.' })));
          break;
        case 'finalizada':
          partes.push(el('p', { clase: 'bt-m-titulo', texto: r?.cierre === 'tiempo' ? 'Votación finalizada · se acabó el tiempo' : 'Votación finalizada' }),
            el('p', { clase: 'bt-etiqueta-barras', texto: 'Resultados privados: aún no se muestran' }), barras(a, r, true),
            el('div', { clase: 'bt-fila' }, boton('Mostrar resultados', live('publicar'), { primario: true, foco: 'publicar', ayuda: 'Pantalla y teléfonos ven las barras; no revela la correcta.' }),
              boton('Retirar encuesta', live('retirar'), { foco: 'retirar', ayuda: 'La quita de las pantallas; queda en el historial.' })));
          break;
        case 'resultados':
          partes.push(el('p', { clase: 'bt-m-titulo', texto: a.ronda === 2 ? 'Resultados de las dos rondas en pantalla' : 'Resultados en pantalla' }), barras(a, r, false),
            el('div', { clase: 'bt-fila' },
              a.ronda === 1 ? boton('Discutir y repetir', live('segundaRonda'), { primario: true, foco: 'repetir', ayuda: 'Discusión en parejas y segunda ronda con el mismo tiempo de la sala' }) : null,
              a.puedeRevelar ? boton('Revelar explicación', live('revelar'), { primario: a.ronda !== 1, foco: 'revelar', ayuda: 'Muestra la correcta y la explicación a todos' }) : null),
            el('div', { clase: 'bt-fila' },
              boton(l.vista.resultados ? 'Quitar de la pantalla' : 'Volver a mostrar', live('pantalla'), { foco: 'pantalla', 'aria-pressed': String(l.vista.resultados) }),
              boton('Retirar encuesta', live('retirar'), { foco: 'retirar' })));
          break;
        case 'revelada':
          partes.push(el('p', { clase: 'bt-m-titulo', texto: 'Respuesta revelada' }), barras(a, r, false),
            el('div', { clase: 'bt-fila' },
              boton(l.vista.resultados ? 'Quitar de la pantalla' : 'Volver a mostrar', live('pantalla'), { foco: 'pantalla', 'aria-pressed': String(l.vista.resultados) }),
              boton('Retirar encuesta', live('retirar'), { foco: 'retirar' })),
            ayuda('Avance a la siguiente diapositiva: la sala y los participantes se mantienen.'));
          break;
        case 'votada':
          partes.push(ayuda(`Esta pregunta ya se votó (${l.aqui?.votada ?? 1} ronda(s), ${l.aqui?.respondientes ?? 0} respuestas). El detalle está en el panel docente.`));
          break;
        default: break;
      }
      partes.push(el('div', { clase: 'bt-fila bt-secundaria' },
        boton(l.vista.qr ? 'Reducir QR' : 'Ampliar QR', live('qr'), { foco: 'qr', 'aria-pressed': String(l.vista.qr), ayuda: 'QR grande en la pantalla compartida para que se unan' })));
      if (l.mensaje?.tipo === 'error') partes.push(el('p', { clase: 'bt-error', role: 'alert', texto: l.mensaje.texto }));
      return partes;
    }, () => {
      for (const n of liveSec.querySelectorAll('[data-bt-conectados]')) n.textContent = String(l.sala?.conectados ?? 0);
      for (const n of liveSec.querySelectorAll('[data-bt-respuestas]')) n.textContent = String(r?.respondientes ?? 0);
      // Las barras se actualizan en su sitio con cada voto (sin rehacer la sección ni mover el foco).
      liveSec.querySelectorAll('.bt-barra').forEach((fila) => {
        const i = Number(fila.dataset.i);
        fila.querySelector('.bt-pct').textContent = `${r?.porcentajes?.[i] ?? 0}% (${r?.conteos?.[i] ?? 0})`;
        fila.querySelector('.bt-pista > i').style.width = `${r?.porcentajes?.[i] ?? 0}%`;
      });
    });
  }

  function pintarPreguntas() {
    const l = est?.live;
    const lista = (l?.disponible && l.sala ? l.preguntas : []).filter((q) => q.estado !== 'oculta');
    preguntas.hidden = !(l?.disponible && l.sala);
    if (preguntas.hidden) return;
    const pendientes = lista.filter((q) => q.estado === 'pendiente').length;
    const moderar = (q, accion) => (b) => pedir({ ambito: 'live', accion: 'moderar', valor: { preguntaId: q.id, accion } }, b);
    seccion('preguntas', preguntas, [lista, activo()], () => {
      const orden = [...lista].sort((x, y) => (x.estado === 'pendiente') - (y.estado === 'pendiente') || y.votos - x.votos);
      return [el('details', { clase: 'bt-preguntas-det', open: pendientes > 0 || lista.length <= 3 },
        el('summary', { 'data-foco': 'preguntas', texto: `Preguntas de estudiantes (${lista.length}${pendientes ? ` · ${pendientes} por revisar` : ''})` }),
        !lista.length ? ayuda('Aún no hay preguntas. Los estudiantes las envían desde el teléfono.') : null,
        el('ul', { clase: 'bt-lista-preguntas' }, orden.slice(0, 30).map((q) => el('li', { clase: `bt-pregunta bt-q-${q.estado}${q.proyectada ? ' proyectada' : ''}` },
          el('p', {}, el('span', { clase: 'bt-votos', texto: `▲ ${q.votos}` }), ` ${q.texto}`),
          el('div', { clase: 'bt-fila' },
            q.estado === 'pendiente' ? boton('Aprobar', moderar(q, 'aprobar'), { foco: `${q.id}-a`, primario: true }) : null,
            q.estado === 'visible' ? boton(q.proyectada ? 'Quitar de la pantalla' : 'Proyectar', moderar(q, q.proyectada ? 'quitarProyeccion' : 'proyectar'), { foco: `${q.id}-p` }) : null,
            q.estado === 'visible' ? boton('Respondida', moderar(q, 'respondida'), { foco: `${q.id}-r` }) : null,
            boton('Ocultar', moderar(q, 'ocultar'), { foco: `${q.id}-o` })))))),
      ];
    });
  }

  // ---------- Cuentas regresivas locales ----------
  function tictac() {
    relojHora.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    relojHora.dateTime = new Date().toISOString();
    pintarClase();
    for (const n of document.querySelectorAll('[data-bt-hasta]')) {
      const ms = Math.max(0, Number(n.dataset.btHasta) - Date.now());
      n.textContent = formatoReloj(Math.ceil(ms / 1000) * 1000);
      n.classList.toggle('urgente', ms <= 10_000);
    }
  }
  setInterval(tictac, 250);

  function pintar() {
    pintarHerramientas();
    pintarClase();
    pintarChipLive();
    pintarNotas();
    pintarNavegacion();
    pintarMedios();
    pintarSolucion();
    pintarLive();
    pintarPreguntas();
    sincronizarPrevias();
    const f = JSON.stringify([est?.indices, est?.notas?.map((b) => b.ancla), est?.anclas, destacada]);
    if (firmas.anclas !== f) { firmas.anclas = f; requestAnimationFrame(pintarAnclas); }
    document.title = `Build Tech · ${est?.documento ?? 'OpenClass'}`;
    tictac();
  }

  // ---------- Teclado (no actúa mientras se escribe ni sobre controles que usan la tecla) ----------
  window.addEventListener('keydown', (ev) => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const t = ev.target;
    if (t.closest?.('input, textarea, select, [contenteditable=""], [contenteditable=true]')) return;
    const enControl = t.closest?.('button, summary, a, [role=separator]');
    const nav = { ArrowRight: 'siguiente', PageDown: 'siguiente', ArrowLeft: 'anterior', PageUp: 'anterior', Home: 'primera', End: 'ultima' }[ev.key]
      ?? (ev.key === ' ' && !enControl ? 'siguiente' : null);
    if (nav) { ev.preventDefault(); pedir({ ambito: 'navegar', accion: nav }); return; }
    if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); alternarSoloNotas(); }
    else if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); cambiarLetra(2); }
    else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); cambiarLetra(-2); }
    else if ((ev.key === 'l' || ev.key === 'L') && !liveSec.hidden) { ev.preventDefault(); if (prefs.soloNotas) alternarSoloNotas(); liveSec.focus(); liveSec.scrollIntoView({ block: 'nearest' }); }
    else if (ev.key === 'Escape') { const d = document.querySelector('.bt-atajos[open]'); if (d) d.open = false; }
  });

  aplicarPrefs();
  pintar();
  // Exposición mínima para pruebas automatizadas (sin datos de la sala ni claves).
  window.OpenClassBuildTech = { estado: () => est, conexion: () => conexion, tiempo: () => ({ ...tiempo }), protocolo: PROTOCOLO };
}
