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
