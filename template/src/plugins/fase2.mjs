/**
 * OpenClass — FASE 2: interacción en vivo. Ambas opciones quedan APAGADAS por defecto.
 *
 * A) OpenClass Live (recomendada): ./live.mjs + servicio services/openclass-live del repositorio maestro.
 *    La presentación sigue en localhost y se comparte por Zoom/Teams/Meet; los estudiantes entran con
 *    QR o código desde su teléfono y NO cargan las diapositivas. Solo sale del computador la encuesta que
 *    el docente abre expresamente. Para activarla: `LIVE.activa = true` y `LIVE.servidor` con la URL del
 *    servicio. La clave de presentador se pega en el botón «En vivo» (tecla L); nunca va en este archivo.
 *
 * B) Seminar, Poll y Questions (rajgoel/reveal.js-plugins, vendorizados en public/vendor/): necesitan
 *    el servidor https://github.com/rajgoel/seminar y que la audiencia cargue LA PRESENTACIÓN COMPLETA en
 *    su dispositivo (sincroniza la navegación). No se usa con diapositivas institucionales. Para activarla:
 *    completar `seminar.server`, `seminar.room` y `seminar.hash` y poner `FASE2.activa = true`.
 *    Poll y Questions dependen de Seminar: nunca se cargan sin él.
 */
export const LIVE = {
  activa: false,
  servidor: 'https://openclass-live.apps.willedtech.io',
};

export const FASE2 = {
  activa: false,
  seminar: { server: '', room: '', hash: '', autoJoin: true },
  poll: {},
  questions: {},
  // Debe coincidir con la versión mayor de socket.io del servidor seminar.
  socketIo: 'https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.8.1/socket.io.min.js',
};

export async function cargarFase2({ cargarScript, cargarCss, vendor }) {
  // OpenClass Live no hace ninguna petición al cargar: el cliente se descarga al pulsar «Conectar».
  const live = LIVE.activa && /^https?:\/\/[^/]+\/?$/.test(LIVE.servidor)
    ? [(await import('./live.mjs')).OpenClassLive({ servidor: LIVE.servidor })] : [];
  if (!FASE2.activa) return { plugins: live, config: {} };
  const { server, room, hash } = FASE2.seminar;
  if (!server || !room || !hash) {
    console.warn('[OpenClass] Fase 2 activa sin servidor seminar configurado: no se cargan Seminar, Poll ni Questions.');
    return { plugins: live, config: {} };
  }
  await cargarScript(FASE2.socketIo);
  await cargarScript(`${vendor}seminar/plugin.js`);
  await Promise.all([cargarScript(`${vendor}poll/plugin.js`), cargarScript(`${vendor}questions/plugin.js`)]);
  cargarCss(`${vendor}poll/style.css`);
  cargarCss(`${vendor}questions/style.css`);
  return {
    // questions/plugin.js se registra como window.RevealQnA (no RevealQuestions).
    plugins: [...live, window.RevealSeminar, window.RevealPoll, window.RevealQnA].filter(Boolean),
    config: { seminar: FASE2.seminar, poll: FASE2.poll, questions: FASE2.questions },
  };
}
