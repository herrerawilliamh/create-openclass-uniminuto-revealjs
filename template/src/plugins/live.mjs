/**
 * OpenClass Live: adaptador local de Reveal.js (participación en vivo sin publicar las diapositivas).
 *
 * La presentación sigue en el computador del docente; los estudiantes NO la cargan. El adaptador:
 * - no hace ninguna petición al servidor hasta que el docente pulsa «Conectar» con su clave de presentador;
 * - envía SOLO la encuesta de la diapositiva actual cuando el docente la abre expresamente
 *   (enunciado, código, tipo, opciones, correctas y explicación; nunca el Markdown, notas ni imágenes);
 * - muestra en la pantalla compartida el QR, los resultados y la pregunta que el docente proyecte;
 * - nunca recibe órdenes de navegación: ningún participante controla las diapositivas.
 *
 * Marcado de una encuesta en el Markdown de una diapositiva:
 *   <div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
 *     <p class="oc-live-enunciado">¿…?</p>
 *     <ol class="oc-live-opciones"><li>…</li><li>…</li></ol>
 *     <div class="oc-live-explicacion">Se muestra solo al revelar.</div>
 *   </div>
 * Atajo: tecla L abre o cierra el panel «En vivo».
 */
import './live.css';

const CLAVE_SESION = 'openclass-live:clave';
const leerClave = () => { try { return sessionStorage.getItem(CLAVE_SESION) ?? ''; } catch { return ''; } };
const guardarClave = (v) => { try { v ? sessionStorage.setItem(CLAVE_SESION, v) : sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ } };
const letra = (i) => String.fromCharCode(65 + i);

/** Texto de un nodo con sus bloques <pre> como ``` (el servidor y los estudiantes lo muestran sin ejecutarlo). */
function textoDe(nodo) {
  if (!nodo) return '';
  let salida = '';
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === 3) salida += hijo.textContent;
    else if (hijo.nodeType === 1 && hijo.tagName === 'PRE') salida += `\n\`\`\`\n${hijo.textContent.replace(/\n$/, '')}\n\`\`\`\n`;
    else if (hijo.nodeType === 1 && /^(P|DIV|LI|BR|H\d)$/.test(hijo.tagName)) salida += `${textoDe(hijo)}\n`;
    else if (hijo.nodeType === 1) salida += textoDe(hijo);
  }
  return salida.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Construye la carga mínima de una encuesta a partir de su elemento. Es la ÚNICA información de la
 * presentación que sale del computador del docente, y solo al abrir la votación.
 */
export function extraerEncuesta(elemento) {
  const enunciadoNodo = elemento.querySelector('.oc-live-enunciado');
  const codigoNodo = enunciadoNodo?.querySelector('pre') ?? elemento.querySelector(':scope > pre');
  const enunciadoCopia = enunciadoNodo?.cloneNode(true);
  enunciadoCopia?.querySelectorAll('pre').forEach((p) => p.remove());
  const opciones = [...elemento.querySelectorAll('.oc-live-opciones > li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const tipo = elemento.dataset.tipo === 'multiple' ? 'multiple' : 'unica';
  const correctas = String(elemento.dataset.correctas ?? '').split(/[\s,]+/).filter(Boolean).map((c) => {
    const n = /^\d+$/.test(c) ? Number(c) - 1 : c.toUpperCase().charCodeAt(0) - 65;
    return n;
  }).filter((n) => Number.isInteger(n) && n >= 0 && n < opciones.length);
  const explicacion = textoDe(elemento.querySelector('.oc-live-explicacion'));
  return {
    enunciado: textoDe(enunciadoCopia),
    ...(codigoNodo ? { codigo: codigoNodo.textContent.replace(/\n$/, '') } : {}),
    tipo,
    opciones,
    correctas: [...new Set(correctas)],
    ...(explicacion ? { explicacion } : {}),
  };
}

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

export function OpenClassLive({ servidor }) {
  const base = String(servidor).replace(/\/+$/, '');
  let deck = null;
  let socket = null;
  let estado = null;
  let sala = null; // { id, codigo }
  const creadas = new Map(); // firma de la encuesta de la diapositiva → id en el servidor
  const vista = { qr: false, resultados: false, pregunta: true };

  // ---------- Elementos de la interfaz (fuera de .slides: no se escalan ni entran en el PDF) ----------
  const boton = el('button', { type: 'button', clase: 'oc-live-boton', 'aria-label': 'OpenClass Live (L)', title: 'OpenClass Live (L)', texto: 'En vivo' });
  const panel = el('aside', { clase: 'oc-live-panel', 'aria-label': 'OpenClass Live', hidden: true });
  const capa = el('div', { clase: 'oc-live-capa', 'aria-live': 'polite', hidden: true });
  const banda = el('div', { clase: 'oc-live-banda', 'aria-live': 'polite', hidden: true });

  const encuestaDeDiapositiva = () => deck?.getCurrentSlide()?.querySelector('.oc-live-encuesta') ?? null;
  const firma = (d) => JSON.stringify([d.enunciado, d.opciones, d.tipo]);

  const emitir = (evento, datos) => new Promise((resolve) => {
    if (!socket?.connected) return resolve({ ok: false, mensaje: 'Sin conexión con OpenClass Live' });
    socket.timeout(10_000).emit(evento, datos, (err, r) => resolve(err ? { ok: false, mensaje: 'Sin respuesta del servidor' } : r));
  });

  function cargarCliente() {
    if (window.io) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `${base}/socket.io/socket.io.min.js`;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar el cliente de OpenClass Live'));
      document.head.append(s);
    });
  }

  async function conectar(clave) {
    mensaje('Conectando…');
    try { await cargarCliente(); } catch (e) { return mensaje(e.message, 'error'); }
    socket?.disconnect();
    socket = window.io(`${base}/docente`, { auth: { clave }, transports: ['websocket', 'polling'], reconnectionDelayMax: 5000 });
    socket.on('sesion', ({ rol, salaId, estado: e }) => {
      if (rol !== 'presentador') return;
      guardarClave(clave);
      sala = { id: salaId, codigo: e.sala.codigo };
      actualizar(e);
      mensaje('');
    });
    socket.on('estado', actualizar);
    socket.on('connect_error', (e) => {
      if (socket.active) return mensaje('Reconectando…', 'alerta');
      guardarClave('');
      sala = null; estado = null;
      mensaje(e.message === 'clave' ? 'Clave inválida, revocada o vencida. Copie una nueva desde el panel docente.' : 'No se pudo conectar con OpenClass Live.', 'error');
      pintarPanel();
    });
    socket.on('disconnect', (motivo) => { if (motivo === 'io server disconnect') { guardarClave(''); sala = null; estado = null; pintarPanel(); pintarCapas(); mensaje('El servidor cerró la conexión (sala finalizada o clave revocada).', 'alerta'); } });
    socket.on('sala:cerrada', () => { guardarClave(''); sala = null; estado = null; vista.qr = false; vista.resultados = false; pintarPanel(); pintarCapas(); mensaje('La sala finalizó.', 'alerta'); });
  }

  function desconectar() {
    socket?.disconnect();
    socket = null; sala = null; estado = null;
    guardarClave('');
    vista.qr = false; vista.resultados = false;
    pintarPanel(); pintarCapas();
  }

  let textoMensaje = { texto: '', tipo: '' };
  function mensaje(texto, tipo = '') { textoMensaje = { texto, tipo }; pintarPanel(); }

  function actualizar(e) {
    estado = e;
    pintarPanel();
    pintarCapas();
  }

  // ---------- Acciones del docente ----------
  async function abrirEncuestaActual() {
    const nodo = encuestaDeDiapositiva();
    if (!nodo) return;
    const datos = extraerEncuesta(nodo);
    const previa = creadas.get(firma(datos));
    const r = previa && estado?.historial.some((h) => h.id === previa)
      ? await emitir('encuesta:abrir', { salaId: sala.id, encuestaId: previa })
      : await emitir('encuesta:crear', { salaId: sala.id, encuesta: datos, abrir: true });
    if (!r.ok) return mensaje(r.mensaje, 'error');
    creadas.set(firma(datos), r.encuesta.id);
    vista.qr = false; vista.resultados = true;
    mensaje('');
  }

  const accion = (evento, tras) => async () => {
    const activa = estado?.activa;
    if (!activa && evento !== 'encuesta:retirar') return;
    const r = await emitir(evento, evento === 'encuesta:retirar' ? { salaId: sala.id } : { salaId: sala.id, encuestaId: activa.id });
    if (!r.ok) return mensaje(r.mensaje, 'error');
    tras?.();
    mensaje('');
    pintarCapas();
  };

  // ---------- Pintado del panel de control ----------
  function pintarPanel() {
    panel.replaceChildren();
    panel.append(el('div', { clase: 'oc-live-cabecera' }, el('strong', { texto: 'OpenClass Live' }),
      el('button', { type: 'button', clase: 'oc-live-x', 'aria-label': 'Cerrar panel', texto: '×', onclick: alternarPanel })));
    if (textoMensaje.texto) panel.append(el('p', { clase: `oc-live-msg ${textoMensaje.tipo}`, role: 'status', texto: textoMensaje.texto }));

    if (!sala) {
      const entrada = el('input', { type: 'password', clase: 'oc-live-entrada', placeholder: 'Clave de presentador', autocomplete: 'off', 'aria-label': 'Clave de presentador' });
      panel.append(
        el('p', { clase: 'oc-live-ayuda', texto: 'Cree la sala en el panel docente y copie la «clave de presentador». Hasta conectar, esta presentación no envía nada.' }),
        el('form', { onsubmit: (ev) => { ev.preventDefault(); if (entrada.value.trim()) conectar(entrada.value.trim()); } },
          entrada, el('button', { type: 'submit', clase: 'oc-live-accion', texto: 'Conectar' })),
        el('p', { clase: 'oc-live-ayuda', texto: base }));
      return;
    }

    const activa = estado?.activa;
    const ronda = activa?.rondas?.[activa.rondas.length - 1];
    const nodo = encuestaDeDiapositiva();
    panel.append(
      el('p', { clase: 'oc-live-sala' }, 'Sala ', el('b', { texto: sala.codigo }), ` · ${estado?.sala.conectados ?? 0} conectados`),
      el('div', { clase: 'oc-live-fila' },
        el('button', { type: 'button', clase: 'oc-live-accion', 'aria-pressed': String(vista.qr), texto: vista.qr ? 'Ocultar QR' : 'Mostrar QR', onclick: () => { vista.qr = !vista.qr; if (vista.qr) vista.resultados = false; pintarCapas(); pintarPanel(); } }),
        el('button', { type: 'button', clase: 'oc-live-accion', disabled: !nodo || activa?.estado === 'abierta', title: nodo ? '' : 'Esta diapositiva no tiene una encuesta (.oc-live-encuesta)', texto: 'Abrir encuesta de esta diapositiva', onclick: abrirEncuestaActual })));

    if (activa) {
      panel.append(el('div', { clase: 'oc-live-activa' },
        el('p', { clase: 'oc-live-enunciado-corto', texto: activa.enunciado }),
        el('p', { texto: `${activa.estado === 'abierta' ? 'Votación abierta' : 'Votación cerrada'} · ronda ${activa.ronda} · ${ronda?.respondientes ?? 0} respuestas` }),
        el('div', { clase: 'oc-live-fila' },
          activa.estado === 'abierta' ? el('button', { type: 'button', clase: 'oc-live-accion', texto: 'Cerrar votación', onclick: accion('encuesta:cerrar') }) : null,
          activa.estado === 'cerrada' && !activa.resultadosPublicados ? el('button', { type: 'button', clase: 'oc-live-accion', texto: 'Publicar resultados', onclick: accion('encuesta:publicar', () => { vista.resultados = true; }) }) : null,
          activa.estado === 'cerrada' && activa.ronda === 1 && !activa.correctaRevelada ? el('button', { type: 'button', clase: 'oc-live-accion', texto: 'Segunda ronda', onclick: accion('encuesta:segundaRonda') }) : null,
          activa.estado === 'cerrada' && !activa.correctaRevelada && (activa.correctas.length || activa.explicacion) ? el('button', { type: 'button', clase: 'oc-live-accion', texto: 'Revelar respuesta', onclick: accion('encuesta:revelar', () => { vista.resultados = true; }) }) : null,
          el('button', { type: 'button', clase: 'oc-live-accion', 'aria-pressed': String(vista.resultados), texto: vista.resultados ? 'Ocultar en pantalla' : 'Mostrar en pantalla', onclick: () => { vista.resultados = !vista.resultados; if (vista.resultados) vista.qr = false; pintarCapas(); pintarPanel(); } }),
          el('button', { type: 'button', clase: 'oc-live-accion secundaria', texto: 'Retirar', onclick: accion('encuesta:retirar', () => { vista.resultados = false; }) }))));
    }

    panel.append(el('label', { clase: 'oc-live-check' },
      el('input', { type: 'checkbox', checked: vista.pregunta, onchange: (ev) => { vista.pregunta = ev.target.checked; pintarCapas(); } }),
      ' Mostrar la pregunta que proyecte desde el panel docente'));
    panel.append(el('button', { type: 'button', clase: 'oc-live-accion secundaria', texto: 'Desconectar', onclick: desconectar }));
  }

  // ---------- Capas sobre la diapositiva (lo que ven los estudiantes por Zoom) ----------
  function pintarCapas() {
    capa.replaceChildren();
    const activa = estado?.activa;
    if (sala && vista.qr) {
      capa.append(el('div', { clase: 'oc-live-qr' },
        el('img', { src: `${base}/qr/${sala.codigo}.svg`, alt: `QR para unirse a la sala ${sala.codigo}` }),
        el('div', {}, el('p', { clase: 'oc-live-titulo', texto: 'Participe desde su teléfono' }),
          el('p', { clase: 'oc-live-url', texto: `${base.replace(/^https?:\/\//, '')}` }),
          el('p', { texto: 'Código de la sala' }), el('p', { clase: 'oc-live-codigo', texto: sala.codigo }))));
    } else if (sala && vista.resultados && activa) {
      const mostrarBarras = activa.estado === 'cerrada' && (activa.resultadosPublicados || activa.correctaRevelada);
      const correctas = activa.correctaRevelada ? activa.correctas : [];
      const ronda = activa.rondas[activa.rondas.length - 1];
      capa.append(el('div', { clase: 'oc-live-resultados' },
        el('p', { clase: 'oc-live-titulo', texto: activa.estado === 'abierta' ? `Votación abierta · ${ronda?.respondientes ?? 0} respuestas` : mostrarBarras ? 'Resultados' : `Votación cerrada · ${ronda?.respondientes ?? 0} respuestas` }),
        el('p', { clase: 'oc-live-enunciado-corto', texto: activa.enunciado }),
        // Mientras la votación está abierta solo se muestra el número de respuestas: la distribución
        // no se proyecta para no condicionar la respuesta individual.
        mostrarBarras ? el('div', { clase: 'oc-live-barras' }, activa.opciones.map((o, i) => {
          const relleno = el('i');
          relleno.style.width = `${ronda.porcentajes[i]}%`;
          const previa = activa.rondas.length > 1 ? activa.rondas[0].porcentajes[i] : null;
          return el('div', { clase: `oc-live-barra${correctas.includes(i) ? ' correcta' : ''}` },
            el('span', { clase: 'oc-live-op', texto: `${letra(i)}. ${o}` }),
            el('span', { clase: 'oc-live-pct', texto: `${ronda.porcentajes[i]}%${previa !== null ? `  (ronda 1: ${previa}%)` : ''}` }),
            el('span', { clase: 'oc-live-pista' }, relleno));
        })) : null,
        activa.correctaRevelada && activa.explicacion ? el('div', { clase: 'oc-live-explicacion-capa' }, activa.explicacion.split('```').map((parte, i) => (
          i % 2 ? el('pre', {}, el('code', { texto: parte.replace(/^[\w+-]*\n/, '').replace(/\n$/, '') })) : parte.trim() ? el('p', { texto: parte.trim() }) : null))) : null));
    }
    capa.hidden = capa.childElementCount === 0;
    capa.classList.toggle('oc-live-capa-qr', vista.qr);

    const proyectada = sala && vista.pregunta ? estado?.proyectada : null;
    banda.replaceChildren(...(proyectada ? [el('span', { clase: 'oc-live-etiqueta', texto: `Pregunta de la clase · ▲ ${proyectada.votos}` }), el('span', { texto: proyectada.texto })] : []));
    banda.hidden = !proyectada;
  }

  function alternarPanel() {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) pintarPanel();
  }

  return {
    id: 'openclass-live',
    init(reveal) {
      deck = reveal;
      if (/print-pdf/i.test(location.search)) return;
      boton.addEventListener('click', alternarPanel);
      document.body.append(boton, panel, capa, banda);
      reveal.addKeyBinding({ keyCode: 76, key: 'L', description: 'OpenClass Live' }, alternarPanel);
      reveal.on('slidechanged', () => { if (!panel.hidden) pintarPanel(); });
      window.OpenClassLive = { extraerEncuesta, conectar, desconectar, estado: () => estado, abrirEncuestaActual };
      const clave = leerClave();
      if (clave) conectar(clave);
    },
  };
}
