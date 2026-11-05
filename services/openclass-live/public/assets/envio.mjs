/**
 * OpenClass Live: envío con acuse acotado y resolución de resultados inciertos (módulo puro, sin DOM).
 * Un acuse perdido NO es un fallo: el servidor pudo haber aceptado el evento. Por eso hay cuatro resultados
 * distintos y nunca se reenvía nada por cuenta propia.
 *  - confirmado: el servidor respondió ok.
 *  - rechazado: el servidor respondió con error (no se registró).
 *  - no_enviado: no había conexión; el evento NO se emitió (así Socket.IO no lo guarda para reenviarlo solo).
 *  - desconocido: no llegó acuse a tiempo; pudo o no registrarse.
 */
export const MS_ACUSE = 10_000;

export function enviar(socket, evento, datos, ms = MS_ACUSE) {
  return new Promise((resolve) => {
    if (!socket || !socket.connected) return resolve({ resultado: 'no_enviado' });
    let resuelto = false;
    const cerrar = (valor) => { if (!resuelto) { resuelto = true; resolve(valor); } }; // un acuse tardío se ignora
    try {
      socket.timeout(ms).emit(evento, datos, (error, r) => {
        if (error) return cerrar({ resultado: 'desconocido' });
        if (r?.ok) return cerrar({ resultado: 'confirmado', respuesta: r });
        cerrar({ resultado: 'rechazado', error: r?.error, mensaje: r?.mensaje });
      });
    } catch { cerrar({ resultado: 'no_enviado' }); }
  });
}

const ordenadas = (a = []) => [...a].sort((x, y) => x - y);
const mismas = (a, b) => {
  const x = ordenadas(a); const y = ordenadas(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

/**
 * Compara un voto de resultado incierto con lo que el servidor dice ahora.
 * `fresco` = el estado llegó en una conexión nueva, posterior al envío (el evento viejo ya no puede estar en vuelo).
 * -> 'confirmado' | 'obsoleta' (cambió la encuesta/ronda o cerró) | 'no_registrada' | 'pendiente'
 */
export function resolverVoto(pendiente, enc, fresco) {
  if (!enc || enc.id !== pendiente.encuestaId || enc.ronda !== pendiente.ronda) return 'obsoleta';
  if (mismas(enc.miSeleccion, pendiente.seleccion)) return 'confirmado';
  if (enc.estado !== 'abierta') return 'obsoleta';
  return fresco ? 'no_registrada' : 'pendiente';
}

/**
 * El protocolo no devuelve un identificador elegido por el cliente: solo se puede decir que existe una pregunta
 * propia con el mismo texto que no estaba antes del envío. Es un indicio, no una garantía.
 */
export function buscarPregunta(pendiente, preguntas = []) {
  return preguntas.find((q) => q.propia && q.texto === pendiente.texto && !pendiente.idsAntes.includes(q.id)) ?? null;
}
