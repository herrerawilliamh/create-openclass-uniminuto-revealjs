/**
 * Puente local entre la presentación principal (Reveal.js) y Build Tech, la ventana privada del docente.
 *
 * - Mismo computador y mismo origen: window.postMessage con targetOrigin = location.origin; cada lado
 *   acepta solo mensajes de ese origen y de la ventana esperada (Build Tech: su `opener`; la
 *   presentación: la ventana que ella abrió o, tras recargarse, una ventana Build Tech cuyo opener es ella).
 * - La presentación es la ÚNICA autoridad de navegación, multimedia y OpenClass Live: Build Tech envía
 *   órdenes explícitas de una lista cerrada y recibe confirmación y estado. El estado nunca genera órdenes
 *   (sin bucles) y las vistas previas de Build Tech no reproducen nada (sin audio duplicado).
 * - Nada de esto sale del computador: ni las notas ni el estado viajan a OpenClass Live; la clave de
 *   presentador no forma parte de ningún mensaje, URL ni registro.
 */
export const PROTOCOLO = 'openclass-build-tech';
export const VERSION = 1;
export const NOMBRE_VENTANA = 'openclass-build-tech';
export const PARAMETRO_VISTA = 'oc-vista';

const TIPOS_BT = new Set(['hola', 'orden', 'adios']);
const TIPOS_PRESENTACION = new Set(['estado', 'respuesta', 'adios']);

const NAVEGAR = new Set(['siguiente', 'anterior', 'siguienteDiapositiva', 'anteriorDiapositiva', 'primera', 'ultima']);
const MEDIO = new Set(['reproducir', 'pausar', 'reiniciar', 'buscar', 'volumen', 'silencio']);
const LIVE = new Set(['iniciar', 'cerrar', 'extender', 'publicar', 'segundaRonda', 'revelar', 'retirar', 'tendencias', 'pantalla', 'qr', 'menu', 'duracion', 'moderar']);
const MODERAR = new Set(['aprobar', 'ocultar', 'respondida', 'proyectar', 'quitarProyeccion']);
const DURACIONES = new Set([0, 15, 30, 60, 90]);

const plano = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const id = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : null);

/** URL de la vista (Build Tech o vista previa) de esta misma presentación: sin hash ni otros parámetros. */
export function urlVista(location, vista) {
  // Vista previa: modo «receiver» de Reveal (el de sus notas clásicas), sin teclado, gestos ni transiciones.
  const extra = vista === 'previa'
    ? 'receiver&controls=false&progress=false&history=false&hash=false&keyboard=false&touch=false&overview=false&transition=none&backgroundTransition=none&autoSlide=0&' : '';
  return `${location.pathname}?${extra}${PARAMETRO_VISTA}=${vista}`;
}

export const sobre = (tipo, datos = {}) => ({ protocolo: PROTOCOLO, version: VERSION, tipo, ...datos });

/**
 * Valida una orden de Build Tech y devuelve su forma normalizada, o null si no está autorizada.
 * Solo admite acciones explícitas de la lista cerrada, con argumentos acotados.
 */
export function validarOrden(orden) {
  if (!plano(orden) || typeof orden.ambito !== 'string' || typeof orden.accion !== 'string') return null;
  const { ambito, accion, valor } = orden;
  switch (ambito) {
    case 'navegar':
      return NAVEGAR.has(accion) ? { ambito, accion } : null;
    case 'medio': {
      const medio = id(orden.medio);
      if (!medio || !MEDIO.has(accion)) return null;
      if (accion === 'buscar') return Number.isFinite(valor) && valor >= 0 && valor <= 86_400 ? { ambito, accion, medio, valor } : null;
      if (accion === 'volumen') return Number.isFinite(valor) && valor >= 0 && valor <= 1 ? { ambito, accion, medio, valor } : null;
      if (accion === 'silencio') return typeof valor === 'boolean' ? { ambito, accion, medio, valor } : null;
      return { ambito, accion, medio };
    }
    case 'live':
      if (!LIVE.has(accion)) return null;
      if (accion === 'duracion') return DURACIONES.has(valor) ? { ambito, accion, valor } : null;
      if (accion === 'moderar') {
        const preguntaId = id(valor?.preguntaId);
        return plano(valor) && preguntaId && MODERAR.has(valor.accion) ? { ambito, accion, valor: { preguntaId, accion: valor.accion } } : null;
      }
      return { ambito, accion };
    case 'reloj':
      return accion === 'publico' && typeof valor === 'boolean' ? { ambito, accion, valor } : null;
    default:
      return null;
  }
}

/**
 * Datos de un MessageEvent si cumple el protocolo y viene del origen y la ventana esperados; si no, null.
 * `esperada` es la ventana autorizada o una función que decide sobre la ventana de origen.
 */
export function mensajeDe(evento, { origen, esperada, de }) {
  if (!evento || evento.origin !== origen) return null;
  const fuente = evento.source;
  if (!fuente || !(typeof esperada === 'function' ? esperada(fuente) : fuente === esperada)) return null;
  const d = evento.data;
  if (!plano(d) || d.protocolo !== PROTOCOLO || d.version !== VERSION) return null;
  return (de === 'build-tech' ? TIPOS_BT : TIPOS_PRESENTACION).has(d.tipo) ? d : null;
}
