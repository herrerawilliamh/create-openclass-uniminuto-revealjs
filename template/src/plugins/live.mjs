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
 * Una clase = una sala = un QR = un código. Con la sala conectada (nunca antes: no hay QR falso), el
 * QR real y el código se integran en la diapositiva actual: portada (junto a la franja amarilla),
 * segunda diapositiva (bloque de participación sobre la banda temática) y cada diapositiva con
 * encuesta (QR compacto en una esquina libre, que se amplía o se oculta). Cambiar de diapositiva no
 * toca la conexión; quien llega tarde entra con el mismo QR y recibe la encuesta abierta.
 *
 * Marcado de una encuesta en el Markdown de una diapositiva:
 *   <div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
 *     <p class="oc-live-enunciado">¿…?</p>
 *     <ol class="oc-live-opciones"><li>…</li><li>…</li></ol>
 *     <div class="oc-live-explicacion">Se muestra solo al revelar.</div>
 *   </div>
 * Atajos: tecla L abre o cierra el panel «En vivo»; tecla Q amplía o reduce el QR de la sala.
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

export function OpenClassLive({ servidor }) {
  const base = String(servidor).replace(/\/+$/, '');
  let deck = null;
  let socket = null;
  let estado = null;
  let sala = null; // { id, codigo }
  const creadas = new Map(); // firma de la encuesta de la diapositiva → id en el servidor
  const origenes = new Map(); // id de la encuesta → diapositiva desde la que se abrió
  const ocultos = new WeakSet(); // diapositivas con encuesta cuyo QR compacto ocultó el docente
  // qr: QR ampliado; diapositivas: QR integrado en portada, temática y encuestas.
  const vista = { qr: false, resultados: false, pregunta: true, diapositivas: true };

  // ---------- Elementos de la interfaz (fuera de .slides: no se escalan ni entran en el PDF) ----------
  const boton = el('button', { type: 'button', clase: 'oc-live-boton', 'aria-label': 'OpenClass Live (L)', title: 'OpenClass Live (L)', texto: 'En vivo' });
  const panel = el('aside', { clase: 'oc-live-panel', 'aria-label': 'OpenClass Live', hidden: true });
  const capa = el('div', { clase: 'oc-live-capa', 'aria-live': 'polite', hidden: true });
  const banda = el('div', { clase: 'oc-live-banda', 'aria-live': 'polite', hidden: true });

  let bloque = null; // bloque de participación insertado en la diapositiva actual

  const encuestaDeDiapositiva = () => deck?.getCurrentSlide()?.querySelector('.oc-live-encuesta') ?? null;
  const urlQr = () => `${base}/qr/${sala.codigo}.svg`;
  const anfitrion = () => base.replace(/^https?:\/\//, '');
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
      pintarCapas();
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
    origenes.set(r.encuesta.id, deck.getCurrentSlide());
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
    const actual = deck.getCurrentSlide();
    panel.append(
      el('p', { clase: 'oc-live-sala' }, 'Sala ', el('b', { texto: sala.codigo }), ` · ${estado?.sala.conectados ?? 0} conectados`),
      el('div', { clase: 'oc-live-fila' },
        el('button', { type: 'button', clase: 'oc-live-accion', 'aria-pressed': String(vista.qr), texto: vista.qr ? 'Reducir QR' : 'Ampliar QR', title: 'Tecla Q', onclick: alternarQr }),
        nodo ? el('button', { type: 'button', clase: 'oc-live-accion secundaria', 'aria-pressed': String(ocultos.has(actual)), texto: ocultos.has(actual) ? 'Mostrar QR en esta diapositiva' : 'Ocultar QR en esta diapositiva', onclick: () => alternarQrDiapositiva(actual) }) : null,
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
      el('input', { type: 'checkbox', checked: vista.diapositivas, onchange: (ev) => { vista.diapositivas = ev.target.checked; pintarCapas(); } }),
      ' QR y código en la portada, la temática y las encuestas'));
    panel.append(el('label', { clase: 'oc-live-check' },
      el('input', { type: 'checkbox', checked: vista.pregunta, onchange: (ev) => { vista.pregunta = ev.target.checked; pintarCapas(); } }),
      ' Mostrar la pregunta que proyecte desde el panel docente'));
    panel.append(el('button', { type: 'button', clase: 'oc-live-accion secundaria', texto: 'Desconectar', onclick: desconectar }));
  }

  // ---------- Capas sobre la diapositiva (lo que ven los estudiantes por Zoom) ----------
  function pintarCapas() {
    capa.replaceChildren();
    const activa = estado?.activa;
    // Los resultados de una encuesta abierta desde una diapositiva acompañan a esa diapositiva: al
    // salir de ella se ocultan (la votación y la sala siguen igual) y vuelven al regresar.
    const origen = activa && origenes.get(activa.id);
    const enSuDiapositiva = !origen || origen === deck?.getCurrentSlide();
    if (sala && vista.qr) {
      capa.append(el('div', { clase: 'oc-live-qr' },
        el('img', { src: urlQr(), alt: `QR para unirse a la sala ${sala.codigo}` }),
        el('div', {}, el('p', { clase: 'oc-live-titulo', texto: 'Participe desde su teléfono' }),
          el('p', { clase: 'oc-live-url', texto: anfitrion() }),
          el('p', { texto: 'Código de la sala' }), codigoVisible('p', 'oc-live-codigo'),
          el('button', { type: 'button', clase: 'oc-live-accion secundaria oc-live-reducir', texto: 'Reducir (Q)', onclick: alternarQr }))));
    } else if (sala && vista.resultados && activa && enSuDiapositiva) {
      const mostrarBarras = activa.estado === 'cerrada' && (activa.resultadosPublicados || activa.correctaRevelada);
      const correctas = activa.correctaRevelada ? activa.correctas : [];
      const ronda = activa.rondas[activa.rondas.length - 1];
      // QR compacto de la misma sala junto a la votación y los resultados (entrada tardía).
      if (qrContextualVisible()) {
        lateral ??= imagenQr();
        if (!lateral.src.endsWith(`/${sala.codigo}.svg`)) lateral = imagenQr();
        capa.append(el('div', { clase: 'oc-live-qr-lateral' }, lateral,
          codigoVisible('span', 'oc-live-p-codigo'),
          el('span', { clase: 'oc-live-p-url', texto: anfitrion() })));
      }
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
    capa.classList.toggle('oc-live-capa-qr', Boolean(sala && vista.qr));

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
    pintarCapas();
    if (!panel.hidden) pintarPanel();
  }

  function alternarQrDiapositiva(diapositiva) {
    if (ocultos.has(diapositiva)) ocultos.delete(diapositiva); else ocultos.add(diapositiva);
    pintarCapas();
    if (!panel.hidden) pintarPanel();
  }

  // ---------- QR integrado en la diapositiva actual (escala con ella; nunca existe en el PDF) ----------
  function pintarParticipacion() {
    const diapositiva = deck?.getCurrentSlide();
    const tipo = sala && vista.diapositivas && diapositiva ? tipoParticipacion(diapositiva, deck.getSlides().indexOf(diapositiva)) : null;
    const mostrar = tipo && !(tipo === 'encuesta' && ocultos.has(diapositiva));
    // Cada voto repinta las capas: el bloque solo se rehace si cambia la diapositiva o la sala.
    if (mostrar && bloque?.parentNode === diapositiva && bloque.dataset.sala === sala.codigo) return;
    bloque?.remove();
    bloque = null;
    if (!mostrar) return;
    const qr = imagenQr();
    const codigo = codigoVisible('span', 'oc-live-p-codigo');
    const url = el('span', { clase: 'oc-live-p-url', texto: anfitrion() });
    if (tipo === 'portada') {
      bloque = el('div', { clase: 'oc-live-participa oc-live-p-portada', role: 'group', 'aria-label': `Sala ${sala.codigo}` }, qr,
        el('div', { clase: 'oc-live-p-texto' }, el('span', { clase: 'oc-live-p-lema', texto: 'Participa durante la sesión' }), codigo, url));
    } else if (tipo === 'tematica') {
      bloque = el('div', { clase: 'oc-live-participa oc-live-p-tematica', role: 'group', 'aria-label': `Sala ${sala.codigo}` }, qr,
        el('div', { clase: 'oc-live-p-texto' },
          el('span', { clase: 'oc-live-p-lema', texto: 'Durante esta sesión resolveremos preguntas y actividades. ¡Tu participación es importante!' }),
          el('span', { clase: 'oc-live-p-etiqueta', texto: 'Escanea el QR o entra a' }), url,
          el('span', { clase: 'oc-live-p-etiqueta', texto: 'y escribe el código' }), codigo));
    } else {
      bloque = el('div', { clase: 'oc-live-participa oc-live-p-encuesta', role: 'group', 'aria-label': `Sala ${sala.codigo}` },
        el('button', { type: 'button', clase: 'oc-live-p-ampliar', title: 'Ampliar QR (Q)', 'aria-label': `Ampliar el QR de la sala ${sala.codigo}`, onclick: alternarQr }, qr, codigo),
        el('button', { type: 'button', clase: 'oc-live-p-ocultar', title: 'Ocultar QR en esta diapositiva', 'aria-label': 'Ocultar el QR en esta diapositiva', texto: '×', onclick: () => alternarQrDiapositiva(diapositiva) }));
    }
    bloque.dataset.sala = sala.codigo;
    diapositiva.append(bloque);
    if (tipo === 'encuesta') ubicarCompacto(diapositiva);
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
      reveal.addKeyBinding({ keyCode: 81, key: 'Q', description: 'OpenClass Live: ampliar o reducir el QR' }, alternarQr);
      // Cambiar de diapositiva solo cambia lo que se ve: la conexión y la sala siguen intactas.
      reveal.on('slidechanged', () => { pintarCapas(); if (!panel.hidden) pintarPanel(); });
      reveal.on('resize', () => { if (bloque?.classList.contains('oc-live-p-encuesta')) ubicarCompacto(reveal.getCurrentSlide()); });
      window.OpenClassLive = { extraerEncuesta, conectar, desconectar, estado: () => estado, abrirEncuestaActual, sala: () => sala };
      const clave = leerClave();
      if (clave) conectar(clave);
    },
  };
}
