/**
 * OpenClass Live: adaptador local de Reveal.js (participación en vivo sin publicar las diapositivas).
 *
 * La presentación sigue en el computador del docente; los estudiantes NO la cargan. El adaptador:
 * - no hace ninguna petición al servidor hasta que el docente pulsa «Conectar» con su clave de presentador;
 * - envía SOLO la encuesta de la diapositiva actual cuando el docente la abre expresamente
 *   (enunciado, código, tipo y opciones; nunca el Markdown, notas ni imágenes);
 * - conserva la solución (correctas y explicación) en este computador y la envía únicamente al pulsar
 *   «Revelar explicación», con la votación ya cerrada (`encuesta:revelar`);
 * - muestra en la pantalla compartida el QR, los resultados y la pregunta que el docente proyecte;
 * - nunca recibe órdenes de navegación: ningún participante controla las diapositivas.
 *
 * Una clase = una sala = un QR = un código. Con la sala conectada (nunca antes: no hay QR falso), el
 * QR real y el código se integran en la diapositiva actual: portada (junto a la franja amarilla),
 * segunda diapositiva (bloque de participación sobre la banda temática) y cada diapositiva con
 * encuesta (QR compacto en una esquina libre, con la cuenta regresiva durante la votación). Cambiar de
 * diapositiva no toca la conexión; quien llega tarde entra con el mismo QR y recibe la encuesta abierta.
 *
 * Experiencia docente (diseño progresivo): un único control «En vivo» en el pie azul de Reveal muestra
 * la conexión, los participantes y la cuenta regresiva; al pulsarlo (o pulsar cualquier QR de la
 * diapositiva, o la tecla L) abre UN menú con solo las acciones del momento: conectar → «Iniciar
 * votación · 30 s» → «Cerrar ahora» / «+30 segundos» → «Mostrar resultados» → «Discutir y repetir» o
 * «Revelar explicación». El tiempo de votación es una preferencia de la sala (Configuración de la
 * sesión), no de cada pregunta. Las tendencias en vivo no se proyectan salvo que el docente pulse
 * «Proyectar tendencias»; nunca incluyen la respuesta correcta.
 *
 * Marcado de una encuesta en el Markdown de una diapositiva:
 *   <div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
 *     <p class="oc-live-enunciado">¿…?</p>
 *     <ol class="oc-live-opciones"><li>…</li><li>…</li></ol>
 *     <div class="oc-live-explicacion">Se muestra solo al revelar.</div>
 *   </div>
 * Atajos: tecla L abre o cierra el menú «En vivo»; tecla Q amplía o reduce el QR de la sala; Esc cierra el menú.
 */
import './live.css';
import { extraerEncuesta, separarSolucion } from './encuesta.mjs';
import { PROTOCOLO_LIVE, componenteDesactualizado, textoIncompatible } from './protocolo-live.mjs';

export { extraerEncuesta };

const CLAVE_SESION = 'openclass-live:clave';
const leerClave = () => { try { return sessionStorage.getItem(CLAVE_SESION) ?? ''; } catch { return ''; } };
const guardarClave = (v) => { try { v ? sessionStorage.setItem(CLAVE_SESION, v) : sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ } };
const letra = (i) => String.fromCharCode(65 + i);

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

/**
 * Qué bloque de participación lleva una diapositiva: la portada (1.ª, oc-l-cover), la temática (2.ª,
 * oc-l-section) o una con encuesta. Las demás no muestran QR.
 */
export function tipoParticipacion(diapositiva, indice) {
  if (!diapositiva) return null;
  if (diapositiva.querySelector('.oc-live-encuesta')) return 'encuesta';
  if (indice === 0 && diapositiva.classList.contains('oc-l-cover')) return 'portada';
  if (indice === 1 && diapositiva.classList.contains('oc-l-section')) return 'tematica';
  return null;
}

/**
 * Primer hueco (x, y, ancho, alto en px del lienzo 1280×720) que no toca ningún rectángulo ocupado,
 * con un margen de separación. Devuelve null si todos chocan.
 */
export function elegirHueco(candidatos, ocupados, margen = 12) {
  const choca = (a, b) => a.x < b.x + b.ancho + margen && b.x < a.x + a.ancho + margen
    && a.y < b.y + b.alto + margen && b.y < a.y + a.alto + margen;
  return candidatos.find((c) => !ocupados.some((o) => choca(c, o))) ?? null;
}

// Huecos para el QR compacto de una encuesta (lienzo 1280×720; contenido entre la banda superior,
// Y 83, y «VIGILADA MINEDUCACIÓN» del fondo, Y 676): primero a la derecha, después abajo a la
// izquierda. Si nada cabe, una etiqueta con solo el código.
const HUECOS_QR = [[1092, 448], [1092, 104], [1092, 276], [16, 448], [560, 448]].map(([x, y]) => ({ x, y, ancho: 172, alto: 214 }));
const HUECOS_CODIGO = [[1046, 606], [1046, 104], [16, 606], [520, 606]].map(([x, y]) => ({ x, y, ancho: 218, alto: 56 }));
const MEDIOS = new Set(['IMG', 'SVG', 'CANVAS', 'IFRAME', 'VIDEO', 'PRE', 'TABLE', 'svg']);

/** Rectángulos (en px del lienzo) de todo lo visible de la diapositiva: texto, medios, código y cajas. */
function ocupadosEn(seccion, excluir) {
  const caja = seccion.getBoundingClientRect();
  const escala = caja.width / (seccion.offsetWidth || 1280) || 1;
  const rects = [];
  const anotar = (r) => { if (r.width > 0 && r.height > 0) rects.push({ x: (r.left - caja.left) / escala, y: (r.top - caja.top) / escala, ancho: r.width / escala, alto: r.height / escala }); };
  const rango = document.createRange();
  const recorrer = (nodo) => {
    for (const hijo of nodo.childNodes) {
      if (hijo === excluir) continue;
      if (hijo.nodeType === 3) {
        if (!hijo.textContent.trim()) continue;
        rango.selectNodeContents(hijo);
        for (const r of rango.getClientRects()) anotar(r);
      } else if (hijo.nodeType === 1) {
        if (hijo.tagName === 'ASIDE' || !hijo.getClientRects().length) continue;
        // Los fragmentos aún ocultos cuentan: aparecerán en esa misma posición.
        const estilo = getComputedStyle(hijo);
        const fondo = estilo.backgroundColor !== 'rgba(0, 0, 0, 0)' && estilo.backgroundColor !== 'transparent';
        if (MEDIOS.has(hijo.tagName) || fondo || parseFloat(estilo.borderTopWidth) > 0) anotar(hijo.getBoundingClientRect());
        if (hijo.tagName === 'LI') { const r = hijo.getBoundingClientRect(); anotar({ left: r.left - 48 * escala, top: r.top, width: 52 * escala, height: Math.min(r.height, 40 * escala) }); }
        if (!MEDIOS.has(hijo.tagName)) recorrer(hijo);
      }
    }
  };
  recorrer(seccion);
  return rects;
}

// ---------- Utilidades del controlador ----------
const ORIENTACION = 'openclass-live:orientacion';
const orientacionVista = () => { try { return localStorage.getItem(ORIENTACION) === 'vista'; } catch { return false; } };
const marcarOrientacion = () => { try { localStorage.setItem(ORIENTACION, 'vista'); } catch { /* sin almacenamiento */ } };
const normal = (t) => String(t ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
/** Identidad de una encuesta (la del Markdown y la guardada en el servidor coinciden): sobrevive a recargas. */
export const firmaEncuesta = (d) => JSON.stringify([normal(d.enunciado), (d.opciones ?? []).map(normal), d.tipo ?? 'unica']);
export const formatoTiempo = (ms) => { const s = Math.ceil(Math.max(0, ms) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const textoDuracion = (s) => (s ? `${s} s` : 'sin límite');
const DURACIONES = [15, 30, 60, 90];
// Icono «en vivo» (ondas) con el mismo trazo que las herramientas del pie azul.
const ICONO_EN_VIVO = (() => {
  if (typeof document === 'undefined') return null;
  const plantilla = document.createElement('template');
  plantilla.innerHTML = '<svg class="oc-live-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8"/></svg>';
  return plantilla.content.firstChild;
})();
const ultimaRonda = (e) => e?.rondas?.[e.rondas.length - 1] ?? null;

/**
 * Momento de la clase según la sala, la votación activa y la diapositiva actual. El menú «En vivo»
 * solo ofrece las acciones de ese momento (diseño progresivo).
 */
export function momentoDe({ sala, estado, aqui, delMazo = true }) {
  if (!sala) return { tipo: 'desconectado' };
  const activa = estado?.activa ?? null;
  // Una encuesta improvisada desde el panel no tiene diapositiva: se controla desde cualquiera que no
  // tenga su propia pregunta (la pregunta de la diapositiva tiene prioridad sobre una improvisada cerrada).
  const coincide = Boolean(activa && aqui?.previa?.id === activa.id);
  const deAqui = coincide || Boolean(activa && !delMazo && !aqui);
  if (activa?.estado === 'abierta') return { tipo: 'votando', activa, deAqui, otra: delMazo && !coincide };
  if (activa && deAqui) {
    if (activa.correctaRevelada) return { tipo: 'revelada', activa };
    return { tipo: activa.resultadosPublicados ? 'resultados' : 'finalizada', activa };
  }
  if (aqui) return aqui.previa?.rondas.length ? { tipo: 'votada', previa: aqui.previa } : { tipo: 'lista', previa: aqui.previa };
  return { tipo: 'sin-encuesta' };
}

export function OpenClassLive({ servidor }) {
  const base = String(servidor).replace(/\/+$/, '');
  let deck = null;
  let socket = null;
  let compatible = false; // el servicio confirmó en `sesion` el mismo protocolo (PROTOCOLO_LIVE)
  let estado = null;
  let sala = null; // { id, codigo }
  let conectando = false;
  let desfase = 0; // hora del servidor − hora local (la cuenta regresiva no depende del reloj del equipo)
  const ocultos = new WeakSet(); // diapositivas con encuesta cuyo QR compacto ocultó el docente
  const enMazo = new Map(); // id de encuesta → ¿pertenece a una diapositiva de este mazo?
  // qr: QR ampliado; resultados: barras publicadas en pantalla; tendencias: barras en vivo (explícito);
  // diapositivas: QR integrado en portada, temática y encuestas; pregunta: pregunta proyectada.
  const vista = { qr: false, resultados: false, tendencias: false, pregunta: true, diapositivas: true };
  let guiaAbierta = !orientacionVista();
  let configAbierta = false;

  // ---------- Elementos (fuera de .slides: no se escalan ni entran en el PDF) ----------
  const control = el('button', { type: 'button', clase: 'oc-live-control', id: 'oc-live-control', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': 'oc-live-menu', 'data-estado': 'apagado' });
  const menu = el('div', { clase: 'oc-live-menu', id: 'oc-live-menu', role: 'dialog', 'aria-label': 'En vivo', hidden: true });
  const capa = el('div', { clase: 'oc-live-capa', 'aria-live': 'polite', hidden: true });
  const banda = el('div', { clase: 'oc-live-banda', 'aria-live': 'polite', hidden: true });
  let bloque = null; // bloque de participación insertado en la diapositiva actual

  const encuestaDeDiapositiva = () => deck?.getCurrentSlide()?.querySelector('.oc-live-encuesta') ?? null;
  const urlQr = () => `${base}/qr/${sala.codigo}.svg`;
  const anfitrion = () => base.replace(/^https?:\/\//, '');
  const restante = (cierra) => (typeof cierra === 'number' ? Math.max(0, cierra - (Date.now() + desfase)) : null);
  const duracion = () => estado?.sala?.duracionVotacion ?? 30;

  /** Encuesta de la diapositiva actual y, si ya existe en el servidor, su versión allí. */
  function encuestaAqui() {
    const nodo = encuestaDeDiapositiva();
    if (!nodo) return null;
    const datos = extraerEncuesta(nodo);
    const f = firmaEncuesta(datos);
    const previa = [...(estado?.historial ?? [])].reverse().find((h) => firmaEncuesta(h) === f) ?? null;
    return { nodo, datos, previa };
  }
  /**
   * Solución local de una encuesta del servidor: la de su diapositiva en este mazo (o null). El servidor
   * no la conoce hasta revelarla; una improvisada del panel guarda la suya en el navegador del panel.
   */
  function solucionLocal(enc) {
    if (!enc) return null;
    const f = firmaEncuesta(enc);
    for (const s of deck?.getSlides() ?? []) {
      for (const n of s.querySelectorAll('.oc-live-encuesta')) {
        const datos = extraerEncuesta(n);
        if (firmaEncuesta(datos) === f) return separarSolucion(datos).solucion;
      }
    }
    return null;
  }
  /** Las encuestas improvisadas del panel no tienen diapositiva: sus resultados se ven en cualquiera. */
  function esDelMazo(enc) {
    if (!enMazo.has(enc.id)) {
      const f = firmaEncuesta(enc);
      enMazo.set(enc.id, (deck?.getSlides() ?? []).some((s) => [...s.querySelectorAll('.oc-live-encuesta')].some((n) => firmaEncuesta(extraerEncuesta(n)) === f)));
    }
    return enMazo.get(enc.id);
  }
  const momento = () => momentoDe({ sala, estado, aqui: sala ? encuestaAqui() : null, delMazo: estado?.activa ? esDelMazo(estado.activa) : true });

  const emitir = (evento, datos) => new Promise((resolve) => {
    // Nada sale hacia un servicio cuya versión no se confirmó en `sesion` (p. ej., un backend v0.1).
    if (!compatible) return resolve({ ok: false, mensaje: textoMensaje.texto || 'Conecte primero la sala con OpenClass Live.' });
    if (!socket?.connected) return resolve({ ok: false, mensaje: 'Sin conexión con OpenClass Live. Revise internet; la presentación reintenta sola.' });
    socket.timeout(10_000).emit(evento, datos, (err, r) => resolve(err ? { ok: false, mensaje: 'El servidor no respondió. Intente de nuevo.' } : r));
  });

  function cargarCliente() {
    if (window.io) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}/socket.io/socket.io.min.js`;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo contactar el servicio OpenClass Live. Revise la conexión a internet.'));
      document.head.append(s);
    });
  }

  function olvidarSala() {
    guardarClave('');
    sala = null; estado = null; conectando = false; previo = null;
    vista.qr = false; vista.resultados = false; vista.tendencias = false;
    pintar();
  }

  async function conectar(clave) {
    conectando = true;
    mensaje('Conectando…');
    try { await cargarCliente(); } catch (e) { conectando = false; return mensaje(e.message, 'error'); }
    socket?.disconnect();
    compatible = false;
    const auth = { clave, protocolo: PROTOCOLO_LIVE.version, capacidades: [...PROTOCOLO_LIVE.capacidades] };
    socket = window.io(`${base}/docente`, { auth, transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
    socket.on('sesion', ({ rol, protocolo, salaId, estado: e }) => {
      if (rol !== 'presentador') return;
      const desactualizado = componenteDesactualizado(protocolo);
      if (desactualizado) return incompatible(desactualizado);
      compatible = true;
      guardarClave(clave);
      conectando = false;
      sala = { id: salaId, codigo: e.sala.codigo };
      mensaje('Sala conectada. El QR ya aparece en la portada, la temática y las preguntas.', 'ok', 5000);
      actualizar(e);
    });
    socket.on('estado', actualizar);
    socket.on('connect', () => { if (sala) { mensaje(''); pintarControl(); } });
    socket.on('connect_error', (e) => {
      if (e.message === 'protocolo') return incompatible('presentacion'); // el servicio es más nuevo y nos rechazó
      if (socket.active) { mensaje('Reconectando… La sala y las votaciones siguen en el servidor.', 'alerta'); return pintarControl(); }
      olvidarSala();
      mensaje(e.message === 'clave' ? 'La clave no es válida o venció. En el panel docente pulse «Copiar clave de presentador» y péguela de nuevo.' : 'No se pudo conectar con OpenClass Live. Revise la conexión e intente de nuevo.', 'error');
    });
    socket.on('disconnect', (motivo) => {
      compatible = false;
      if (motivo === 'io server disconnect') { olvidarSala(); mensaje('El servidor cerró la conexión: la sala finalizó o la clave fue revocada.', 'alerta'); } else pintarControl();
    });
    socket.on('sala:cerrada', () => { olvidarSala(); mensaje('La sala finalizó.', 'alerta'); });
  }

  /** Versiones distintas: se corta la conexión sin reintentos y la clave no se recuerda. */
  function incompatible(componente) {
    compatible = false;
    socket?.disconnect();
    socket = null;
    olvidarSala();
    mensaje(textoIncompatible(componente), 'error');
  }

  function desconectar() {
    socket?.disconnect();
    socket = null;
    olvidarSala();
    mensaje('Presentación desconectada. La sala sigue abierta en el panel docente.', 'ok', 5000);
  }

  let textoMensaje = { texto: '', tipo: '' };
  let relojMensaje = null;
  function mensaje(texto, tipo = '', duracionMs = 0) {
    clearTimeout(relojMensaje);
    textoMensaje = { texto, tipo };
    if (duracionMs) relojMensaje = setTimeout(() => { textoMensaje = { texto: '', tipo: '' }; pintarMenu(); }, duracionMs);
    pintarMenu();
  }

  let previo = null;
  function actualizar(e) {
    if (typeof e?.servidor === 'number') desfase = e.servidor - Date.now();
    const antes = previo;
    estado = e;
    previo = e.activa ? { id: e.activa.id, ronda: e.activa.ronda, estado: e.activa.estado } : null;
    // Señal discreta y única cuando la votación termina sola (el docente puede tener el menú cerrado).
    if (antes?.estado === 'abierta' && previo?.id === antes.id && previo.ronda === antes.ronda && previo.estado === 'cerrada') {
      vista.tendencias = false;
      avisarControl();
    }
    pintar();
  }

  // ---------- Acciones del docente ----------
  async function iniciarVotacion() {
    const aqui = encuestaAqui();
    if (!aqui) return;
    const r = aqui.previa && !aqui.previa.rondas.length
      ? await emitir('encuesta:abrir', { salaId: sala.id, encuestaId: aqui.previa.id })
      : await emitir('encuesta:crear', { salaId: sala.id, encuesta: separarSolucion(aqui.datos).publica, abrir: true });
    if (!r.ok) return mensaje(r.mensaje, 'error');
    enMazo.set(r.encuesta.id, true);
    vista.qr = false; vista.resultados = false;
    mensaje('');
  }

  const accion = (evento, { tras, silencio = [] } = {}) => async () => {
    const activa = estado?.activa;
    if (!activa) return;
    const r = await emitir(evento, { salaId: sala.id, encuestaId: activa.id });
    if (!r.ok && !silencio.includes(r.error)) return mensaje(r.mensaje, 'error');
    tras?.();
    mensaje('');
    pintar();
  };
  const cerrarAhora = accion('encuesta:cerrar', { silencio: ['no_abierta'] });
  const extender = accion('encuesta:extender');
  const mostrarResultados = accion('encuesta:publicar', { tras: () => { vista.resultados = true; vista.qr = false; } });
  const segundaRonda = accion('encuesta:segundaRonda', { tras: () => { vista.resultados = false; } });
  /** La solución sale de este computador solo aquí; el servidor la valida y la revela una sola vez. */
  async function revelar() {
    const activa = estado?.activa;
    if (!activa || activa.correctaRevelada) return;
    const solucion = solucionLocal(activa);
    if (!solucion) return mensaje(esDelMazo(activa) ? 'Esta pregunta no tiene respuesta correcta ni explicación en su diapositiva.' : 'Esta pregunta se creó en el panel docente: su solución está en ese navegador. Revélela desde el panel.', 'error');
    const r = await emitir('encuesta:revelar', { salaId: sala.id, encuestaId: activa.id, solucion });
    if (!r.ok && r.error !== 'ya_revelada') return mensaje(r.mensaje, 'error');
    vista.resultados = true; vista.qr = false;
    mensaje('');
    pintar();
  }

  async function cambiarDuracion(segundos) {
    if (segundos === duracion()) return;
    const r = await emitir('sala:ajustar', { salaId: sala.id, duracionVotacion: segundos });
    if (!r.ok) return mensaje(r.mensaje, 'error');
    const enCurso = estado?.activa?.estado === 'abierta' ? ' La votación en curso conserva su tiempo.' : '';
    mensaje(`Las próximas votaciones durarán ${textoDuracion(segundos)}.${enCurso}`, 'ok', 5000);
  }

  function alternarVista(clave) { vista[clave] = !vista[clave]; if (vista[clave] && clave !== 'diapositivas' && clave !== 'pregunta') vista.qr = false; pintar(); }

  // ---------- Control en la barra inferior ----------
  let relojAviso = null;
  function avisarControl() {
    control.classList.add('oc-live-aviso');
    clearTimeout(relojAviso);
    relojAviso = setTimeout(() => control.classList.remove('oc-live-aviso'), 2400);
  }

  function pintarControl() {
    const m = momento();
    const r = ultimaRonda(m.activa);
    let estadoControl = 'apagado'; let etiqueta = 'En vivo'; let dato = ''; let ayuda = 'Participación en vivo: conectar la sala (tecla L)';
    if (conectando && !sala) { estadoControl = 'alerta'; dato = 'conectando…'; ayuda = 'Conectando con OpenClass Live'; }
    else if (sala && socket && !socket.connected) { estadoControl = 'alerta'; dato = 'reconectando…'; ayuda = 'Sin conexión momentánea; la sala sigue abierta'; }
    else if (sala && m.tipo === 'votando') {
      estadoControl = 'votando'; etiqueta = 'Votación';
      dato = `${r?.cierra ? '' : 'abierta · '}${r?.respondientes ?? 0} resp.`;
      ayuda = 'Votación abierta: tiempo restante y respuestas recibidas (tecla L para las acciones)';
    } else if (sala && m.tipo === 'finalizada') { estadoControl = 'cerrada'; etiqueta = 'Votación finalizada'; ayuda = 'Siguiente paso: «Mostrar resultados» (tecla L)'; }
    else if (sala) { estadoControl = 'conectado'; dato = `${estado?.sala?.conectados ?? 0}`; ayuda = `Sala ${sala.codigo} · ${estado?.sala?.conectados ?? 0} participantes conectados (tecla L)`; }
    control.dataset.estado = estadoControl;
    control.dataset.ayuda = ayuda;
    control.setAttribute('aria-label', `En vivo. ${ayuda}`);
    // En la portada (sin pie azul) el control es un botón de icono en el hueco de «anterior».
    control.replaceChildren(...[ICONO_EN_VIVO.cloneNode(true), el('span', { clase: 'oc-live-punto', 'aria-hidden': 'true' }), el('span', { clase: 'oc-live-etq', texto: etiqueta }),
      estadoControl === 'votando' && r?.cierra ? el('span', { clase: 'oc-live-dato oc-live-tiempo', 'data-oc-cierra': String(r.cierra), texto: formatoTiempo(restante(r.cierra)) }) : null,
      dato ? el('span', { clase: `oc-live-dato${estadoControl === 'conectado' ? ' oc-live-personas' : ''}`, texto: dato }) : null].filter(Boolean));
    notificar();
  }

  // ---------- Menú contextual «En vivo» ----------
  const boton = (texto, onclick, { primario = false, foco, ayuda, ...otros } = {}) => el('button', {
    type: 'button', clase: `oc-live-accion${primario ? ' primaria' : ' secundaria'}`, 'data-foco': foco ?? texto, title: ayuda, texto, onclick, ...otros });
  const ayudaTexto = (texto) => el('p', { clase: 'oc-live-ayuda', texto });

  function seccionMomento(m) {
    const r = ultimaRonda(m.activa);
    const tarjeta = el('section', { clase: `oc-live-momento oc-live-m-${m.tipo}`, 'aria-label': 'Acciones de este momento' });
    const agregar = (...hijos) => tarjeta.append(...hijos.filter((h) => h !== null && h !== undefined && h !== false));
    const enunciado = (t) => el('p', { clase: 'oc-live-enunciado-corto', title: t, texto: t });
    switch (m.tipo) {
      case 'sin-encuesta':
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: 'Esta diapositiva no tiene pregunta' }),
          ayudaTexto('Al llegar a una diapositiva con pregunta aparecerá aquí «Iniciar votación». Mientras tanto, los estudiantes pueden unirse con el QR.'));
        break;
      case 'lista':
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: 'Pregunta de esta diapositiva' }), enunciado(encuestaAqui()?.datos.enunciado ?? ''),
          boton(`Iniciar votación · ${duracion() ? `${duracion()} s` : 'sin límite'}`, iniciarVotacion, { primario: true, foco: 'iniciar' }),
          ayudaTexto(duracion() ? `Los estudiantes responden desde su teléfono. Se cierra sola a los ${duracion()} s; los resultados no se muestran hasta que usted lo decida.` : 'Los estudiantes responden desde su teléfono. Sin límite de tiempo: ciérrela con «Cerrar ahora».'));
        break;
      case 'votando': {
        const conectados = estado?.sala?.conectados ?? 0;
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: m.activa.ronda === 2 ? 'Segunda ronda abierta' : 'Votación abierta' }),
          m.otra ? el('p', { clase: 'oc-live-ayuda', texto: 'Esta votación pertenece a otra diapositiva; puede cerrarla desde aquí.' }) : null,
          el('div', { clase: 'oc-live-cifras' },
            r?.cierra ? el('span', { clase: 'oc-live-reloj', role: 'timer', 'aria-label': 'Tiempo restante', 'data-oc-cierra': String(r.cierra), texto: formatoTiempo(restante(r.cierra)) }) : el('span', { clase: 'oc-live-reloj sin-limite', texto: 'Sin límite' }),
            el('span', { clase: 'oc-live-respuestas' }, el('b', { 'data-oc-respuestas': '', texto: String(r?.respondientes ?? 0) }), ` de ${conectados} respondieron`)),
          el('div', { clase: 'oc-live-fila' },
            boton('Cerrar ahora', cerrarAhora, { primario: true, foco: 'cerrar', ayuda: 'Cierra la votación ya. No muestra resultados.' }),
            r?.cierra ? boton('+30 segundos', extender, { foco: 'extender', ayuda: 'Da 30 segundos más a esta votación' }) : null),
          el('div', { clase: 'oc-live-fila' },
            boton(vista.tendencias ? 'Dejar de proyectar tendencias' : 'Proyectar tendencias', () => alternarVista('tendencias'), { foco: 'tendencias', 'aria-pressed': String(vista.tendencias), ayuda: 'Muestra en la pantalla compartida cómo van las respuestas, sin la correcta. Desactivado por defecto.' })),
          ayudaTexto(vista.tendencias ? 'Todos ven las barras en vivo (sin la respuesta correcta).' : 'Las tendencias solo las ve usted en el panel docente; aquí no se proyectan.'));
        break;
      }
      case 'finalizada':
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: r?.cierre === 'tiempo' ? 'Votación finalizada · se acabó el tiempo' : 'Votación finalizada' }),
          el('p', { clase: 'oc-live-cifras' }, el('span', { clase: 'oc-live-respuestas' }, el('b', { texto: String(r?.respondientes ?? 0) }), ' respuestas')),
          boton('Mostrar resultados', mostrarResultados, { primario: true, foco: 'resultados' }),
          ayudaTexto('Muestra las barras en la pantalla y en los teléfonos. No revela la respuesta correcta.'));
        break;
      case 'resultados': {
        const puedeRepetir = m.activa.ronda === 1;
        const puedeRevelar = Boolean(solucionLocal(m.activa));
        const enPanel = !puedeRevelar && !esDelMazo(m.activa);
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: m.activa.ronda === 2 ? 'Resultados de las dos rondas' : 'Resultados en pantalla' }),
          el('div', { clase: 'oc-live-fila' },
            puedeRepetir ? boton('Discutir y repetir', segundaRonda, { primario: true, foco: 'repetir', ayuda: 'Los estudiantes discuten en parejas y votan de nuevo' }) : null,
            puedeRevelar ? boton('Revelar explicación', revelar, { primario: !puedeRepetir, foco: 'revelar', ayuda: 'Muestra la respuesta correcta y la explicación a todos' }) : null),
          ayudaTexto(puedeRepetir ? `«Discutir y repetir» abre una segunda ronda de ${textoDuracion(duracion())} tras conversar en parejas.${puedeRevelar ? ' «Revelar explicación» cierra la pregunta.' : ''}` : puedeRevelar ? 'Compare las dos rondas y revele la explicación.' : 'Listo: avance a la siguiente diapositiva.'),
          enPanel ? ayudaTexto('Pregunta improvisada: su solución está en el navegador del panel docente; revélela desde allí.') : null,
          boton(vista.resultados ? 'Quitar de la pantalla' : 'Volver a mostrar', () => alternarVista('resultados'), { foco: 'pantalla', 'aria-pressed': String(vista.resultados) }));
        break;
      }
      case 'revelada':
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: 'Respuesta revelada' }),
          ayudaTexto('Avance a la siguiente diapositiva: la sala, el QR y los participantes se mantienen.'),
          boton(vista.resultados ? 'Quitar de la pantalla' : 'Volver a mostrar', () => alternarVista('resultados'), { foco: 'pantalla', 'aria-pressed': String(vista.resultados) }));
        break;
      case 'votada': {
        const n = ultimaRonda(m.previa)?.respondientes ?? 0;
        agregar(el('p', { clase: 'oc-live-m-titulo', texto: 'Esta pregunta ya se votó' }), ayudaTexto(`${n} respuestas en la ronda ${m.previa.rondas.length}. El detalle está en el panel docente.`));
        break;
      }
      default: break;
    }
    return tarjeta;
  }

  function seccionConectar() {
    const entrada = el('input', { type: 'password', clase: 'oc-live-entrada', id: 'oc-live-clave', placeholder: 'Pegue aquí la clave', autocomplete: 'off', 'data-foco': 'clave' });
    const pasos = el('ol', { clase: 'oc-live-pasos' },
      el('li', {}, 'Abra el ', el('a', { href: `${base}/docente/`, target: '_blank', rel: 'noopener noreferrer', texto: 'panel docente' }), ' y cree la sala de la clase.'),
      el('li', { texto: 'Pulse «Copiar clave de presentador».' }),
      el('li', { texto: 'Pegue la clave aquí y pulse «Conectar participación».' }));
    return el('section', { clase: 'oc-live-momento oc-live-m-desconectado' },
      el('p', { clase: 'oc-live-m-titulo', texto: 'Conectar participación' }),
      guiaAbierta ? el('div', { clase: 'oc-live-guia' }, pasos,
        ayudaTexto('Una sala sirve para toda la clase: el mismo QR en la portada, la temática y cada pregunta. Hasta conectar, la presentación no envía nada.'),
        boton('Entendido', () => { guiaAbierta = false; marcarOrientacion(); pintarMenu(); }, { foco: 'guia' }))
        : boton('¿Cómo funciona?', () => { guiaAbierta = true; pintarMenu(); }, { foco: 'guia', clase: 'oc-live-enlace' }),
      el('form', { onsubmit: (ev) => { ev.preventDefault(); const v = entrada.value.trim(); if (v) conectar(v); else mensaje('Pegue primero la clave de presentador.', 'error'); } },
        el('label', { for: 'oc-live-clave', clase: 'oc-live-oculto', texto: 'Clave de presentador' }), entrada,
        el('button', { type: 'submit', clase: 'oc-live-accion primaria', 'data-foco': 'conectar', texto: 'Conectar participación' })));
  }

  function seccionConfiguracion() {
    const d = duracion();
    const opcion = (s, texto) => el('label', { clase: `oc-live-opcion${d === s ? ' activa' : ''}` },
      el('input', { type: 'radio', name: 'oc-live-duracion', value: String(s), checked: d === s, 'data-foco': `duracion-${s}`, onchange: () => cambiarDuracion(s) }), texto);
    const casilla = (clave, texto) => el('label', { clase: 'oc-live-check' },
      el('input', { type: 'checkbox', checked: vista[clave], 'data-foco': clave, onchange: () => alternarVista(clave) }), ` ${texto}`);
    const detalles = el('details', { clase: 'oc-live-config', open: configAbierta, ontoggle: () => { configAbierta = detalles.open; } },
      el('summary', { 'data-foco': 'config', texto: 'Configuración de la sesión' }),
      el('fieldset', { clase: 'oc-live-duracion' },
        el('legend', { texto: 'Tiempo de votación (todas las preguntas)' }),
        el('div', { clase: 'oc-live-segmentos' }, DURACIONES.map((s) => opcion(s, `${s} s`))),
        el('details', { clase: 'oc-live-avanzado', open: d === 0 }, el('summary', { texto: 'Opción avanzada' }), opcion(0, 'Sin límite de tiempo')),
        ayudaTexto('Se aplica a las próximas votaciones; una votación en curso conserva su tiempo.')),
      casilla('diapositivas', 'QR en la portada, la temática y las preguntas'),
      casilla('pregunta', 'Mostrar la pregunta de estudiante que proyecte desde el panel'),
      boton('Desconectar esta presentación', desconectar, { foco: 'desconectar' }));
    return detalles;
  }

  let firmaMenu = '';
  function pintarMenu() {
    pintarControl();
    if (menu.hidden) { firmaMenu = ''; return tictac(); }
    const m = momento();
    const r = ultimaRonda(m.activa);
    // Con cada voto solo cambia el número de respuestas: se actualiza sin rehacer el menú (el foco no salta).
    const firma = JSON.stringify([m.tipo, m.deAqui, m.activa?.id, m.activa?.ronda, m.activa?.estado, m.activa?.resultadosPublicados, m.activa?.correctaRevelada,
      r?.cierra, r?.cierre, m.previa?.id, sala?.codigo, estado?.sala?.conectados, duracion(), textoMensaje, guiaAbierta, vista, conectando,
      encuestaDeDiapositiva() ? ocultos.has(deck.getCurrentSlide()) : null, deck?.getIndices?.()]);
    if (firma === firmaMenu) {
      menu.querySelectorAll('[data-oc-respuestas]').forEach((n) => { n.textContent = String(r?.respondientes ?? 0); });
      return tictac();
    }
    firmaMenu = firma;
    const foco = document.activeElement?.closest?.('.oc-live-menu') ? document.activeElement.dataset.foco : null;
    menu.replaceChildren(...[
      el('div', { clase: 'oc-live-cabecera' },
        el('div', {}, el('strong', { texto: 'En vivo' }),
          sala ? el('span', { clase: 'oc-live-sala' }, ' · Sala ', el('b', { 'aria-label': [...sala.codigo].join(' '), texto: `${sala.codigo.slice(0, 3)} ${sala.codigo.slice(3)}` }), ` · ${estado?.sala?.conectados ?? 0} conectados`) : null),
        el('button', { type: 'button', clase: 'oc-live-x', 'aria-label': 'Cerrar el menú (Esc)', title: 'Cerrar (Esc)', texto: '×', 'data-foco': 'x', onclick: () => alternarMenu(false) })),
      textoMensaje.texto ? el('p', { clase: `oc-live-msg ${textoMensaje.tipo}`, role: textoMensaje.tipo === 'error' ? 'alert' : 'status', texto: textoMensaje.texto }) : null,
      sala ? seccionMomento(m) : seccionConectar(),
      sala ? el('div', { clase: 'oc-live-fila oc-live-qr-acciones' },
        boton(vista.qr ? 'Reducir QR' : 'Ampliar QR', alternarQr, { foco: 'qr', 'aria-pressed': String(vista.qr), ayuda: 'Muestra el QR grande para que los estudiantes se unan (tecla Q)' }),
        encuestaDeDiapositiva() ? boton(ocultos.has(deck.getCurrentSlide()) ? 'Mostrar QR aquí' : 'Ocultar QR aquí', () => alternarQrDiapositiva(deck.getCurrentSlide()), { foco: 'qr-aqui', ayuda: 'Solo en esta diapositiva' }) : null) : null,
      sala ? seccionConfiguracion() : null,
      el('p', { clase: 'oc-live-atajos', texto: 'Atajos: L abre o cierra este menú · Q amplía el QR · Esc cierra' })].filter(Boolean));
    // El foco sigue en el mismo control; si ese control ya no existe, pasa a la acción principal del momento.
    if (foco) (menu.querySelector(`[data-foco="${CSS.escape(foco)}"]`) ?? menu.querySelector('.oc-live-momento .primaria') ?? menu.querySelector('.oc-live-momento button') ?? menu.querySelector('.oc-live-x'))?.focus();
    tictac();
  }

  function alternarMenu(abrir = menu.hidden) {
    menu.hidden = !abrir;
    control.setAttribute('aria-expanded', String(abrir));
    // Al cerrar, el foco vuelve al control sin que su ayuda aparezca sobre la pantalla compartida.
    control.classList.toggle('oc-live-silencio', !abrir);
    if (abrir) {
      pintarMenu();
      (sala ? menu.querySelector('.oc-live-momento .primaria') : menu.querySelector('#oc-live-clave'))?.focus();
    } else if (menu.contains(document.activeElement)) control.focus();
  }

  // ---------- Capas sobre la diapositiva (lo que ven los estudiantes por Zoom) ----------
  let firmaCapa = '';
  function pintarCapas() {
    const activa = estado?.activa;
    const aqui = activa ? encuestaAqui() : null;
    const enSuDiapositiva = activa && (aqui ? aqui.previa?.id === activa.id : !esDelMazo(activa));
    const r = ultimaRonda(activa);
    const publicadas = activa?.estado === 'cerrada' && (activa.resultadosPublicados || activa.correctaRevelada);
    let modo = '';
    if (sala && vista.qr) modo = 'qr';
    else if (sala && enSuDiapositiva && vista.resultados && publicadas) modo = 'resultados';
    else if (sala && enSuDiapositiva && vista.tendencias && activa.estado === 'abierta') modo = 'tendencias';
    const firma = JSON.stringify([modo, sala?.codigo, activa?.id, activa?.ronda, activa?.correctaRevelada, qrContextualVisible()]);
    if (firma !== firmaCapa) {
      firmaCapa = firma;
      capa.replaceChildren();
      if (modo === 'qr') {
        capa.append(el('div', { clase: 'oc-live-qr' },
          el('img', { src: urlQr(), alt: `QR para unirse a la sala ${sala.codigo}` }),
          el('div', {}, el('p', { clase: 'oc-live-titulo', texto: 'Participe desde su teléfono' }),
            el('p', { clase: 'oc-live-url', texto: anfitrion() }),
            el('p', { texto: 'Código de la sala' }), codigoVisible('p', 'oc-live-codigo'),
            el('button', { type: 'button', clase: 'oc-live-accion secundaria oc-live-reducir', texto: 'Reducir (Q)', onclick: alternarQr }))));
      } else if (modo) {
        if (qrContextualVisible()) {
          lateral ??= imagenQr();
          if (!lateral.src.endsWith(`/${sala.codigo}.svg`)) lateral = imagenQr();
          capa.append(el('div', { clase: 'oc-live-qr-lateral' }, lateral, codigoVisible('span', 'oc-live-p-codigo'), el('span', { clase: 'oc-live-p-url', texto: anfitrion() })));
        }
        capa.append(el('div', { clase: 'oc-live-resultados' },
          el('p', { clase: 'oc-live-titulo' }),
          el('p', { clase: 'oc-live-enunciado-corto', texto: activa.enunciado }),
          el('div', { clase: 'oc-live-barras' }, activa.opciones.map((o, i) => el('div', { clase: 'oc-live-barra', 'data-i': String(i) },
            el('span', { clase: 'oc-live-op', texto: `${letra(i)}. ${o}` }), el('span', { clase: 'oc-live-pct' }), el('span', { clase: 'oc-live-pista' }, el('i'))))),
          activa.correctaRevelada && activa.explicacion ? el('div', { clase: 'oc-live-explicacion-capa' }, activa.explicacion.split('```').map((parte, i) => (
            i % 2 ? el('pre', {}, el('code', { texto: parte.replace(/^[\w+-]*\n/, '').replace(/\n$/, '') })) : parte.trim() ? el('p', { texto: parte.trim() }) : null))) : null));
      }
    }
    // Actualización en el sitio: las barras se deslizan (transición CSS) en lugar de rehacerse con cada voto.
    if (modo === 'resultados' || modo === 'tendencias') {
      const correctas = activa.correctaRevelada ? activa.correctas ?? [] : [];
      const titulo = capa.querySelector('.oc-live-resultados > .oc-live-titulo');
      if (modo === 'tendencias') {
        titulo.replaceChildren('Tendencia en vivo · ', r?.cierra ? el('span', { 'data-oc-cierra': String(r.cierra), texto: formatoTiempo(restante(r.cierra)) }) : 'sin límite', ` · ${r?.respondientes ?? 0} respuestas`);
      } else titulo.textContent = activa.rondas.length > 1 ? `Resultados · ronda 2 · ${r?.respondientes ?? 0} respuestas` : `Resultados · ${r?.respondientes ?? 0} respuestas`;
      capa.querySelectorAll('.oc-live-barra').forEach((fila) => {
        const i = Number(fila.dataset.i);
        const previa = modo === 'resultados' && activa.rondas.length > 1 ? activa.rondas[0].porcentajes[i] : null;
        fila.classList.toggle('correcta', correctas.includes(i));
        fila.querySelector('.oc-live-pct').textContent = `${r.porcentajes[i]}% (${r.conteos[i]})${previa !== null ? `  · ronda 1: ${previa}%` : ''}`;
        fila.querySelector('.oc-live-pista > i').style.width = `${r.porcentajes[i]}%`;
      });
    }
    capa.hidden = capa.childElementCount === 0;
    capa.classList.toggle('oc-live-capa-qr', modo === 'qr');

    const proyectada = sala && vista.pregunta ? estado?.proyectada : null;
    banda.replaceChildren(...(proyectada ? [el('span', { clase: 'oc-live-etiqueta', texto: `Pregunta de la clase · ▲ ${proyectada.votos}` }), el('span', { texto: proyectada.texto })] : []));
    banda.hidden = !proyectada;
    pintarParticipacion();
    // Con la capa (QR ampliado o resultados, que traen su propio QR) la tarjeta no asoma por detrás.
    if (bloque) bloque.style.visibility = capa.hidden ? '' : 'hidden';
  }

  // La misma imagen se mueve entre repintados: no se vuelve a pedir ni parpadea con cada voto.
  let lateral = null;
  // Código en dos grupos de tres, fácil de dictar; el texto sigue siendo de 6 caracteres sin espacios.
  const codigoVisible = (etiqueta, clase) => el(etiqueta, { clase, 'aria-label': [...sala.codigo].join(' ') },
    el('span', { clase: 'oc-live-grupo', texto: sala.codigo.slice(0, 3) }), el('span', { clase: 'oc-live-grupo', texto: sala.codigo.slice(3) }));
  const imagenQr = () => el('img', { src: urlQr(), alt: `QR para unirse a la sala ${sala.codigo}`, width: 300, height: 300 });
  const qrContextualVisible = () => Boolean(sala && vista.diapositivas && !ocultos.has(deck?.getCurrentSlide()));

  function alternarQr() {
    if (!sala) return;
    vista.qr = !vista.qr;
    pintar();
  }

  function alternarQrDiapositiva(diapositiva) {
    if (ocultos.has(diapositiva)) ocultos.delete(diapositiva); else ocultos.add(diapositiva);
    pintar();
  }

  // ---------- QR integrado en la diapositiva actual (escala con ella; nunca existe en el PDF) ----------
  // Pulsar el QR abre el mismo menú «En vivo» (no hay un segundo panel).
  const abrirDesdeQr = (ev) => { ev.stopPropagation(); alternarMenu(true); };
  function pintarParticipacion() {
    const diapositiva = deck?.getCurrentSlide();
    const tipo = sala && vista.diapositivas && diapositiva ? tipoParticipacion(diapositiva, deck.getSlides().indexOf(diapositiva)) : null;
    const mostrar = tipo && !(tipo === 'encuesta' && ocultos.has(diapositiva));
    // Cada voto repinta las capas: el bloque solo se rehace si cambia la diapositiva o la sala.
    if (!(mostrar && bloque?.parentNode === diapositiva && bloque.dataset.sala === sala.codigo)) {
      bloque?.remove();
      bloque = null;
      if (!mostrar) return;
      const qr = imagenQr();
      const codigo = codigoVisible('span', 'oc-live-p-codigo');
      const url = el('span', { clase: 'oc-live-p-url', texto: anfitrion() });
      const comun = { type: 'button', title: 'Opciones de En vivo', 'aria-label': `Sala ${sala.codigo}: abrir el menú En vivo`, onclick: abrirDesdeQr };
      if (tipo === 'portada') {
        bloque = el('button', { ...comun, clase: 'oc-live-participa oc-live-p-portada' }, qr,
          el('span', { clase: 'oc-live-p-texto' }, el('span', { clase: 'oc-live-p-lema', texto: 'Participa durante la sesión' }), codigo, url));
      } else if (tipo === 'tematica') {
        bloque = el('button', { ...comun, clase: 'oc-live-participa oc-live-p-tematica' }, qr,
          el('span', { clase: 'oc-live-p-texto' },
            el('span', { clase: 'oc-live-p-lema', texto: 'Durante esta sesión resolveremos preguntas y actividades. ¡Tu participación es importante!' }),
            el('span', { clase: 'oc-live-p-etiqueta', texto: 'Escanea el QR o entra a' }), url,
            el('span', { clase: 'oc-live-p-etiqueta', texto: 'y escribe el código' }), codigo));
      } else {
        bloque = el('div', { clase: 'oc-live-participa oc-live-p-encuesta', role: 'group', 'aria-label': `Sala ${sala.codigo}` },
          el('button', { ...comun, clase: 'oc-live-p-abrir' }, qr, codigo, el('span', { clase: 'oc-live-p-estado', 'aria-live': 'off' })),
          el('button', { type: 'button', clase: 'oc-live-p-ocultar', title: 'Ocultar QR en esta diapositiva', 'aria-label': 'Ocultar el QR en esta diapositiva', texto: '×', onclick: (ev) => { ev.stopPropagation(); alternarQrDiapositiva(diapositiva); } }));
      }
      bloque.dataset.sala = sala.codigo;
      protegerTeclas(bloque);
      diapositiva.append(bloque);
      if (tipo === 'encuesta') ubicarCompacto(diapositiva);
    }
    estadoEnTarjeta();
  }

  /** Cuenta regresiva y respuestas dentro de la tarjeta QR de la diapositiva de la votación. */
  function estadoEnTarjeta() {
    const nodo = bloque?.querySelector('.oc-live-p-estado');
    if (!nodo) return;
    const m = momento();
    const r = ultimaRonda(m.activa);
    const ver = (m.tipo === 'votando' && m.deAqui) || m.tipo === 'finalizada';
    nodo.replaceChildren(...(!ver ? [] : m.tipo === 'finalizada' ? ['Votación finalizada']
      : [r?.cierra ? el('b', { 'data-oc-cierra': String(r.cierra), texto: formatoTiempo(restante(r.cierra)) }) : 'Abierta', ` · ${r?.respondientes ?? 0} resp.`]));
    bloque.classList.toggle('oc-live-p-con-estado', ver);
  }

  /** Coloca el QR compacto en el primer hueco libre; si no hay, deja solo el código en una etiqueta. */
  function ubicarCompacto(diapositiva) {
    if (!bloque) return;
    bloque.classList.remove('oc-live-p-solo-codigo', 'oc-live-p-sin-hueco');
    const ocupados = ocupadosEn(diapositiva, bloque);
    let hueco = elegirHueco(HUECOS_QR, ocupados);
    if (!hueco) {
      bloque.classList.add('oc-live-p-solo-codigo');
      hueco = elegirHueco(HUECOS_CODIGO, ocupados);
      if (!hueco) { hueco = HUECOS_CODIGO[0]; bloque.classList.add('oc-live-p-sin-hueco'); }
    }
    bloque.style.setProperty('left', `${hueco.x}px`, 'important');
    bloque.style.setProperty('top', `${hueco.y}px`, 'important');
  }

  // ---------- Cuenta regresiva local: un intervalo solo mientras hay una votación con límite ----------
  let reloj = null;
  function tictac() {
    const pasar = () => {
      const nodos = document.querySelectorAll('[data-oc-cierra]');
      for (const n of nodos) {
        const ms = restante(Number(n.dataset.ocCierra));
        n.textContent = formatoTiempo(ms);
        n.classList.toggle('urgente', ms <= 10_000);
      }
      if (!nodos.length) { clearInterval(reloj); reloj = null; }
    };
    pasar();
    if (!reloj && document.querySelector('[data-oc-cierra]')) reloj = setInterval(pasar, 250);
  }

  function pintar() {
    pintarCapas();
    pintarMenu();
  }

  /** Reveal escucha el teclado en document: Espacio e Intro dentro de los controles no cambian de diapositiva. */
  function protegerTeclas(nodo) {
    nodo.addEventListener('keydown', (ev) => {
      if ((ev.key === ' ' || ev.key === 'Enter') && ev.target.closest('button, summary, a, input, label')) ev.stopPropagation();
    });
  }

  // ---------- Build Tech: la misma sala controlada desde la ventana privada del docente ----------
  // Build Tech no tiene socket propio: pide las acciones a esta presentación (una sola conexión,
  // ninguna votación duplicada) y recibe una vista privada del estado. La clave nunca forma parte de ella.
  const oyentes = new Set();
  let avisoPendiente = false;
  function notificar() {
    if (!oyentes.size || avisoPendiente) return;
    avisoPendiente = true;
    queueMicrotask(() => { avisoPendiente = false; for (const fn of oyentes) try { fn(); } catch { /* Build Tech nunca rompe la presentación */ } });
  }
  const retirar = async () => {
    const r = await emitir('encuesta:retirar', { salaId: sala.id });
    if (!r.ok) return mensaje(r.mensaje, 'error');
    vista.resultados = false; vista.tendencias = false;
    mensaje('');
    pintar();
  };

  function estadoBuildTech() {
    const m = momento();
    const ronda = (x) => ({ conteos: x.conteos, porcentajes: x.porcentajes, respondientes: x.respondientes, cierre: x.cierre ?? null,
      cierraLocal: typeof x.cierra === 'number' ? x.cierra - desfase : null, porcentajeCorrecto: x.porcentajeCorrecto ?? null });
    const a = m.activa ?? (m.tipo === 'votando' ? estado?.activa : null);
    const aqui = sala ? encuestaAqui() : null;
    return {
      disponible: true,
      conectando: conectando && !sala,
      reconectando: Boolean(sala && socket && !socket.connected),
      sala: sala ? { codigo: sala.codigo, conectados: estado?.sala?.conectados ?? 0, participantes: estado?.sala?.participantes ?? 0,
        duracionVotacion: duracion(), preguntasAbiertas: estado?.sala?.preguntasAbiertas ?? true } : null,
      momento: { tipo: m.tipo, deAqui: Boolean(m.deAqui), otra: Boolean(m.otra) },
      aqui: aqui ? { enunciado: aqui.datos.enunciado, opciones: aqui.datos.opciones, votada: aqui.previa?.rondas.length ?? 0,
        respondientes: ultimaRonda(aqui.previa)?.respondientes ?? 0 } : null,
      activa: a ? { id: a.id, enunciado: a.enunciado, opciones: a.opciones, tipo: a.tipo, estado: a.estado, ronda: a.ronda,
        resultadosPublicados: a.resultadosPublicados, correctaRevelada: a.correctaRevelada, delMazo: esDelMazo(a),
        puedeRevelar: !a.correctaRevelada && Boolean(solucionLocal(a)), rondas: a.rondas.map(ronda) } : null,
      vista: { tendencias: vista.tendencias, resultados: vista.resultados, qr: vista.qr, diapositivas: vista.diapositivas },
      preguntas: (estado?.preguntas ?? []).map((q) => ({ id: q.id, texto: q.texto, estado: q.estado, votos: q.votos, proyectada: Boolean(q.proyectada) })),
      mensaje: textoMensaje.texto ? { ...textoMensaje } : null,
    };
  }

  const ACCIONES_BT = {
    iniciar: () => iniciarVotacion(),
    cerrar: () => cerrarAhora(),
    extender: () => extender(),
    publicar: () => mostrarResultados(),
    segundaRonda: () => segundaRonda(),
    revelar: () => revelar(),
    retirar: () => retirar(),
    tendencias: () => alternarVista('tendencias'),
    pantalla: () => alternarVista('resultados'),
    qr: () => alternarQr(),
    menu: () => alternarMenu(true),
    duracion: (s) => cambiarDuracion(s),
  };
  /** Ejecuta una acción pedida por Build Tech con los mismos caminos que el menú «En vivo». */
  async function ordenBuildTech(accion, valor) {
    if (accion === 'menu') { alternarMenu(true); return { ok: true }; }
    if (!sala || !socket?.connected) return { ok: false, mensaje: 'La presentación no está conectada a OpenClass Live. Conéctela con el menú «En vivo» (tecla L).' };
    if (accion === 'moderar') {
      const r = await emitir('pregunta:moderar', { salaId: sala.id, preguntaId: valor?.preguntaId, accion: valor?.accion });
      return r.ok ? { ok: true } : { ok: false, mensaje: r.mensaje };
    }
    const fn = ACCIONES_BT[accion];
    if (!fn) return { ok: false, mensaje: 'Acción no admitida.' };
    textoMensaje = { texto: '', tipo: '' };
    await fn(valor);
    return textoMensaje.tipo === 'error' ? { ok: false, mensaje: textoMensaje.texto } : { ok: true };
  }

  return {
    id: 'openclass-live',
    buildTech: { estado: estadoBuildTech, ordenar: ordenBuildTech, suscribir: (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); } },
    init(reveal) {
      deck = reveal;
      // Ni el PDF ni las vistas previas (Build Tech, notas clásicas: ?receiver) se conectan a la sala.
      if (/print-pdf/i.test(location.search) || reveal.isSpeakerNotes?.()) return;
      control.addEventListener('click', () => alternarMenu());
      for (const ev of ['blur', 'pointerleave']) control.addEventListener(ev, () => control.classList.remove('oc-live-silencio'));
      protegerTeclas(control);
      protegerTeclas(menu);
      protegerTeclas(capa);
      document.body.append(control, menu, capa, banda);
      // Esc con el menú abierto lo cierra (antes de que Reveal abra la vista general), esté donde esté el foco.
      window.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape' || menu.hidden) return;
        ev.stopImmediatePropagation(); ev.preventDefault();
        alternarMenu(false);
        control.focus();
      }, true);
      // Clic fuera del menú: se cierra (el QR y el control lo abren por su cuenta).
      document.addEventListener('pointerdown', (ev) => {
        if (!menu.hidden && !menu.contains(ev.target) && !control.contains(ev.target) && !ev.target.closest?.('.oc-live-participa')) alternarMenu(false);
      });
      reveal.addKeyBinding({ keyCode: 76, key: 'L', description: 'OpenClass Live: menú En vivo' }, () => alternarMenu());
      reveal.addKeyBinding({ keyCode: 81, key: 'Q', description: 'OpenClass Live: ampliar o reducir el QR' }, alternarQr);
      // Cambiar de diapositiva solo cambia lo que se ve: la conexión y la sala siguen intactas.
      reveal.on('slidechanged', pintar);
      reveal.on('resize', () => { if (bloque?.classList.contains('oc-live-p-encuesta')) ubicarCompacto(reveal.getCurrentSlide()); });
      window.OpenClassLive = { extraerEncuesta, conectar, desconectar, estado: () => estado, iniciarVotacion, abrirEncuestaActual: iniciarVotacion, sala: () => sala, menu: alternarMenu, momento: () => momento().tipo };
      pintarControl();
      const clave = leerClave();
      if (clave) conectar(clave);
    },
  };
}
