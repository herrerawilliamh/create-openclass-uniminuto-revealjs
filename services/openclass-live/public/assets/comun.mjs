/**
 * OpenClass Live: utilidades de interfaz compartidas por las vistas de estudiante y docente.
 * Todo contenido recibido se inserta como texto (textContent): ningún mensaje se interpreta como HTML
 * y ningún fragmento de código se ejecuta.
 */
export function el(etiqueta, atributos = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (clave === 'clase') nodo.className = valor;
    else if (clave === 'texto') nodo.textContent = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor === true ? '' : String(valor));
  }
  for (const hijo of hijos.flat()) if (hijo !== null && hijo !== undefined && hijo !== false) nodo.append(hijo);
  return nodo;
}

export const letra = (i) => String.fromCharCode(65 + i);

/** Texto con bloques ``` como <pre>: el código se muestra, nunca se evalúa. */
export function textoConCodigo(texto, clase = 'texto-plano') {
  const contenedor = el('div');
  String(texto ?? '').split('```').forEach((parte, i) => {
    if (!parte.trim()) return;
    if (i % 2) contenedor.append(el('pre', {}, el('code', { texto: parte.replace(/^[\w+-]*\n/, '').replace(/\n$/, '') })));
    else contenedor.append(el('p', { clase, texto: parte.trim() }));
  });
  return contenedor;
}

/** Barras de resultados de una ronda (los datos llegan calculados por el servidor). */
export function barras(opciones, ronda, correctas = []) {
  return el('div', { clase: 'resultados', role: 'list' }, opciones.map((opcion, i) => {
    const pct = ronda?.porcentajes?.[i] ?? 0;
    const n = ronda?.conteos?.[i] ?? 0;
    // CSP sin estilos en línea: el ancho se asigna por CSSOM, no con el atributo style.
    const relleno = el('i');
    relleno.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    return el('div', { clase: `res-fila${correctas.includes(i) ? ' correcta' : ''}`, role: 'listitem', 'data-i': String(i) },
      el('span', { clase: 'res-texto', texto: `${letra(i)}. ${opcion}` }),
      el('span', { clase: 'res-dato', texto: `${pct}% (${n})` }),
      el('span', { clase: 'res-barra', 'aria-hidden': 'true' }, relleno));
  }));
}

/** Actualiza en el sitio las barras creadas por barras(): el ancho se desliza (transición CSS), sin parpadeo. */
export function refrescarBarras(contenedor, ronda) {
  if (!contenedor) return;
  for (const fila of contenedor.querySelectorAll('.res-fila')) {
    const i = Number(fila.dataset.i);
    const pct = ronda?.porcentajes?.[i] ?? 0;
    fila.querySelector('.res-dato').textContent = `${pct}% (${ronda?.conteos?.[i] ?? 0})`;
    fila.querySelector('.res-barra > i').style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }
}

/** Tabla comparativa entre rondas (Freeman: primera respuesta individual → discusión → segunda). */
export function comparar(opciones, rondas, correctas = []) {
  if (!rondas || rondas.length < 2) return null;
  const [r1, r2] = rondas;
  return el('table', { clase: 'comparar' },
    el('thead', {}, el('tr', {}, el('th', { texto: 'Opción' }), el('th', { texto: 'Ronda 1' }), el('th', { texto: 'Ronda 2' }), el('th', { texto: 'Cambio' }))),
    el('tbody', {},
      opciones.map((o, i) => el('tr', {},
        el('td', { texto: `${letra(i)}. ${o}${correctas.includes(i) ? ' ✓' : ''}` }),
        el('td', { clase: 'num', texto: `${r1.porcentajes[i]}%` }),
        el('td', { clase: 'num', texto: `${r2.porcentajes[i]}%` }),
        el('td', { clase: 'num', texto: `${(r2.porcentajes[i] - r1.porcentajes[i] > 0 ? '+' : '')}${Math.round((r2.porcentajes[i] - r1.porcentajes[i]) * 10) / 10}` }))),
      el('tr', {}, el('td', { texto: 'Respondientes' }), el('td', { clase: 'num', texto: String(r1.respondientes) }), el('td', { clase: 'num', texto: String(r2.respondientes) }), el('td')),
      r1.porcentajeCorrecto !== undefined ? el('tr', {}, el('td', { texto: 'Acierto' }),
        el('td', { clase: 'num', texto: `${r1.porcentajeCorrecto}%` }), el('td', { clase: 'num', texto: `${r2.porcentajeCorrecto}%` }),
        el('td', { clase: 'num', texto: `${Math.round((r2.porcentajeCorrecto - r1.porcentajeCorrecto) * 10) / 10}` })) : null));
}

export const ESTADOS = { lista: 'Preparada', abierta: 'Votación abierta', cerrada: 'Votación finalizada' };

/**
 * Cuenta regresiva sincronizada con la hora del servidor: cada estado trae `servidor` (ms) y la
 * ronda abierta su vencimiento absoluto `cierra`. El servidor no emite un mensaje por segundo.
 */
export function crearCuenta() {
  let desfase = 0;
  return {
    sincronizar(servidor) { if (typeof servidor === 'number') desfase = servidor - Date.now(); },
    restante: (cierra) => (typeof cierra === 'number' ? Math.max(0, cierra - (Date.now() + desfase)) : null),
  };
}
export const formatoTiempo = (ms) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export const textoDuracion = (segundos) => (segundos ? `${segundos} s` : 'sin límite');

export const MENSAJES_ERROR = {
  sala_inexistente: 'No hay una sala abierta con ese código. Revise el código o pida uno nuevo.',
  sala_vencida: 'La sala venció.',
  sala_llena: 'La sala alcanzó el máximo de participantes.',
  bloqueado: 'El docente bloqueó la participación desde este dispositivo.',
  frecuencia: 'Demasiados intentos seguidos. Espere un minuto y vuelva a intentarlo.',
  validacion: 'Datos no válidos. Revise el código.',
  origen: 'Origen no permitido.',
};

/**
 * Mensaje comprensible para un fallo de la API HTTP del panel. `r` = { estado, falla } de api():
 * estado 0 con falla 'red' | 'timeout' cuando no hubo respuesta. `contexto: 'login'` distingue 401.
 */
export function mensajeHttp({ estado = 0, falla } = {}, contexto = '') {
  if (falla === 'timeout') return 'El servidor tardó demasiado en responder. Inténtelo de nuevo.';
  if (falla === 'red' || estado === 0) return 'Sin conexión con el servidor. Revise su red e inténtelo de nuevo.';
  if (estado === 401) return contexto === 'login' ? 'Contraseña incorrecta.' : 'La sesión venció. Entre de nuevo.';
  if (estado === 403) return 'El servidor rechazó la solicitud (origen o sesión no válidos). Recargue la página e inténtelo de nuevo.';
  if (estado === 429) return 'Demasiados intentos. Espere unos minutos.';
  if (estado >= 500) return 'El servidor tuvo un problema. Inténtelo de nuevo en unos minutos.';
  return `No se pudo completar la acción (código ${estado}).`;
}

/** ¿Un fallo HTTP puede ser pasajero (red, tiempo agotado, 429 o 5xx)? Si lo es, no se borra nada local. */
export const esTransitorio = ({ estado = 0, falla } = {}) => Boolean(falla) || estado === 0 || estado === 429 || estado >= 500;

/**
 * Nodo que debe recibir el foco dentro de `raiz`: el control de la misma `data-slot` si existe y, si no,
 * el primer control disponible (la acción desapareció: se pasa a la siguiente del mismo elemento).
 */
export const enfocable = (raiz, slot) =>
  (slot && raiz.querySelector(`[data-slot="${slot}"]:not(:disabled)`)) || raiz.querySelector('button:not(:disabled), input:not(:disabled), a[href]');

/**
 * Sincroniza una lista por clave sin rehacerla: un elemento sin cambios conserva su nodo (y su foco);
 * uno cambiado se reemplaza y el foco pasa al control de su mismo `data-slot`; `actualizar` ajusta en el
 * sitio lo que cambia sin que importe (p. ej. el contador de apoyos). El orden del servidor (por apoyos)
 * NO se aplica mientras la persona interactúa con la lista (foco dentro o puntero encima): los
 * elementos nuevos se añaden al final y el orden se actualiza al salir.
 * opciones: { clave(item), firma(item), crear(item) → <li>, actualizar?(nodo, item), vacio?() → <li> }
 */
export function sincronizarLista(ul, items, opciones) {
  const { clave, firma, crear, actualizar, vacio } = opciones;
  ul.__sync = { items, opciones };
  if (!ul.__enlazada) {
    ul.__enlazada = true;
    const resincronizar = () => setTimeout(() => {
      if (!ul.matches(':focus-within') && !ul.matches(':hover')) sincronizarLista(ul, ul.__sync.items, ul.__sync.opciones);
    }, 0);
    ul.addEventListener('focusout', resincronizar);
    ul.addEventListener('mouseleave', resincronizar);
  }
  const interactuando = ul.matches(':focus-within') || ul.matches(':hover');
  for (const n of ul.querySelectorAll(':scope > [data-vacio]')) n.remove();
  const actuales = new Map([...ul.children].filter((n) => n.dataset.clave !== undefined).map((n) => [n.dataset.clave, n]));
  const activo = ul.contains(document.activeElement) ? document.activeElement : null;
  const claveFoco = activo?.closest('[data-clave]')?.dataset.clave ?? null;
  const slot = activo?.dataset.slot ?? null;
  const vivos = new Set(items.map((i) => String(clave(i))));
  for (const [k, n] of actuales) if (!vivos.has(k)) { n.remove(); actuales.delete(k); }
  let foco = null;
  for (const item of items) {
    const k = String(clave(item)), f = firma(item);
    let nodo = actuales.get(k);
    if (!nodo) {
      nodo = crear(item); nodo.dataset.clave = k; nodo.dataset.firma = f;
      ul.append(nodo); actuales.set(k, nodo);
    } else if (nodo.dataset.firma !== f) {
      const nuevo = crear(item); nuevo.dataset.clave = k; nuevo.dataset.firma = f;
      nodo.replaceWith(nuevo); actuales.set(k, nuevo); nodo = nuevo;
      if (k === claveFoco) foco = enfocable(nuevo, slot);
    }
    actualizar?.(nodo, item);
  }
  if (!interactuando) {
    items.forEach((item, i) => {
      const n = actuales.get(String(clave(item)));
      if (ul.children[i] !== n) ul.insertBefore(n, ul.children[i] ?? null);
    });
  }
  if (!items.length && vacio) { const v = vacio(); v.dataset.vacio = ''; ul.append(v); }
  if (foco) foco.focus();
  else if (activo && !activo.isConnected) (enfocable(ul, slot) ?? ul).focus?.();
}
