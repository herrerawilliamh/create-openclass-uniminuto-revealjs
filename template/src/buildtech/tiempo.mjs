/**
 * Tiempo de clase de Build Tech (lógica pura, sin DOM). Independiente de la hora local y del tiempo de
 * votación de OpenClass Live: cambiar o cerrar una encuesta nunca lo toca. Se configura una vez por
 * sesión y se guarda en el navegador del docente (sobrevive a recargar o reabrir Build Tech).
 * Al agotarse solo hay un aviso: la sala En vivo no se finaliza.
 */
export const DURACIONES_CLASE = [45, 60, 90];
export const MIN_CLASE = 5;
export const MAX_CLASE = 300;

export const nuevoTiempo = (duracionMin = 60) => ({ duracionMin, acumulado: 0, desde: null });

export const transcurrido = (t, ahora) => t.acumulado + (t.desde !== null ? Math.max(0, ahora - t.desde) : 0);
export const restante = (t, ahora) => t.duracionMin * 60_000 - transcurrido(t, ahora);

/** 'lista' (sin iniciar) | 'corriendo' | 'pausada' | 'excedida' (corriendo o en pausa, pasada la duración). */
export function fase(t, ahora) {
  if (t.desde === null && t.acumulado === 0) return 'lista';
  if (restante(t, ahora) < 0) return 'excedida';
  return t.desde !== null ? 'corriendo' : 'pausada';
}

export const iniciar = (t, ahora) => (t.desde !== null ? t : { ...t, desde: ahora });
export const pausar = (t, ahora) => (t.desde === null ? t : { ...t, acumulado: transcurrido(t, ahora), desde: null });
export const reiniciar = (t) => nuevoTiempo(t.duracionMin);
export const duracionValida = (min) => Number.isInteger(min) && min >= MIN_CLASE && min <= MAX_CLASE;
/** Cambia la duración prevista sin perder el tiempo ya transcurrido. */
export const configurar = (t, min) => (duracionValida(min) ? { ...t, duracionMin: min } : t);

/** Estado leído del almacenamiento: cualquier valor dañado vuelve al predeterminado. */
export function leerTiempo(valor) {
  const t = valor && typeof valor === 'object' ? valor : {};
  const limpio = nuevoTiempo(duracionValida(t.duracionMin) ? t.duracionMin : 60);
  if (Number.isFinite(t.acumulado) && t.acumulado >= 0) limpio.acumulado = t.acumulado;
  if (Number.isFinite(t.desde) && t.desde > 0) limpio.desde = t.desde;
  return limpio;
}

/** 75 000 ms → «1:15»; 3 723 000 → «1:02:03». Negativo: tiempo excedido con signo «+». */
export function formatoReloj(ms) {
  const neg = ms < 0;
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const seg = s % 60;
  const texto = h ? `${h}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}` : `${m}:${String(seg).padStart(2, '0')}`;
  return neg ? `+${texto}` : texto;
}
