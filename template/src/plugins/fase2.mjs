/**
 * OpenClass — FASE 2: interacción en vivo con Seminar, Poll y Questions (rajgoel/reveal.js-plugins).
 * Los tres scripts ya están en public/vendor/reveal.js-plugins/ y el cargador está integrado en
 * ./index.mjs; quedan APAGADOS porque necesitan un servidor socket.io propio
 * (https://github.com/rajgoel/seminar). Para activarlos:
 *   1. Desplegar el servidor seminar y generar el hash de la sala en su URL.
 *   2. Completar `seminar.server`, `seminar.room` y `seminar.hash` y poner `activa: true`.
 *   3. Añadir a las diapositivas el HTML de encuesta/preguntas descrito en el README de cada plugin.
 * Poll y Questions dependen de Seminar: nunca se cargan sin él.
 */
export const FASE2 = {
  activa: false,
  seminar: { server: '', room: '', hash: '', autoJoin: true },
  poll: {},
  questions: {},
  // Debe coincidir con la versión mayor de socket.io del servidor seminar.
  socketIo: 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js',
};

export async function cargarFase2({ cargarScript, cargarCss, vendor }) {
  if (!FASE2.activa) return { plugins: [], config: {} };
  const { server, room, hash } = FASE2.seminar;
  if (!server || !room || !hash) {
    console.warn('[OpenClass] Fase 2 activa sin servidor seminar configurado: no se cargan Seminar, Poll ni Questions.');
    return { plugins: [], config: {} };
  }
  await cargarScript(FASE2.socketIo);
  await cargarScript(`${vendor}seminar/plugin.js`);
  await Promise.all([cargarScript(`${vendor}poll/plugin.js`), cargarScript(`${vendor}questions/plugin.js`)]);
  cargarCss(`${vendor}poll/style.css`);
  cargarCss(`${vendor}questions/style.css`);
  return {
    plugins: [window.RevealSeminar, window.RevealPoll, window.RevealQuestions],
    config: { seminar: FASE2.seminar, poll: FASE2.poll, questions: FASE2.questions },
  };
}
