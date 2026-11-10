/**
 * Interact: historial persistente de sesiones (solo datos agregados), en PostgreSQL.
 * Política: se guardan propietario, título, fechas, estado, número de participantes y de preguntas, y por actividad
 * enunciado, opciones y recuentos por ronda (jsonb). NO se guardan alias, tokens, respuestas individuales, textos de
 * preguntas de estudiantes, notas privadas, soluciones ni diapositivas. Si la sala se creó con
 * `conservarResultados = false`, solo se guardan los metadatos.
 * Una sala en memoria que no sobrevive a un reinicio se marca `interrumpida`; nunca se presenta como activa.
 * Aislamiento: toda lectura o borrado de un docente lleva su `propietario_id` en el WHERE (no se filtra después),
 * y un punto de control nunca puede reasignar una sala existente a otro propietario.
 * Orden: las escrituras son asíncronas; el estado solo avanza (activa → finalizada/vencida/interrumpida), de modo que
 * un punto de control que llegue después del cierre se descarta en la propia base.
 */
export const ESTADOS = Object.freeze(['activa', 'finalizada', 'vencida', 'interrumpida']);

const comodin = (v) => `%${String(v).slice(0, 80).replace(/[\\%_]/g, '\\$&')}%`;

export function crearHistorial(db, { ahora = Date.now } = {}) {
  async function guardar(resumen, estado, cerrada = null) {
    await db.tx(async (t) => {
      const r = await t.exec(`INSERT INTO salas_historial (id, propietario_id, titulo, estado, creada, actualizada, cerrada, participantes, preguntas)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET titulo = EXCLUDED.titulo, estado = EXCLUDED.estado, actualizada = EXCLUDED.actualizada,
           cerrada = EXCLUDED.cerrada, participantes = EXCLUDED.participantes, preguntas = EXCLUDED.preguntas
         WHERE salas_historial.propietario_id = EXCLUDED.propietario_id
           -- Un punto de control tardío (capturado antes del cierre) nunca reabre una sala cerrada.
           AND (EXCLUDED.estado <> 'activa' OR salas_historial.estado = 'activa')`,
      [resumen.id, resumen.propietarioId, resumen.titulo, estado, resumen.creada, ahora(), cerrada, resumen.participantes, resumen.preguntas]);
      if (r.changes !== 1) return; // identificador ajeno: no se toca nada
      await t.exec('DELETE FROM actividades_historial WHERE sala_id = $1', [resumen.id]);
      for (const a of resumen.actividades) {
        await t.exec(`INSERT INTO actividades_historial (sala_id, actividad_id, orden, enunciado, tipo, opciones, rondas, resultados_publicados, correcta_revelada)
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)`,
        [resumen.id, a.id, a.orden, a.enunciado, a.tipo, JSON.stringify(a.opciones), JSON.stringify(a.rondas), Boolean(a.resultadosPublicados), Boolean(a.correctaRevelada)]);
      }
    });
  }

  const filtro = ({ propietarioId, q: texto, estado, desde, hasta, usuario }) => {
    const c = []; const p = [];
    const param = (v) => { p.push(v); return `$${p.length}`; };
    if (propietarioId) c.push(`h.propietario_id = ${param(propietarioId)}`);
    if (usuario) { const l = comodin(usuario); c.push(`(u.email ILIKE ${param(l)} ESCAPE '\\' OR u.nombre ILIKE ${param(l)} ESCAPE '\\')`); }
    if (texto) c.push(`h.titulo ILIKE ${param(comodin(texto))} ESCAPE '\\'`);
    if (estado && ESTADOS.includes(estado)) c.push(`h.estado = ${param(estado)}`);
    if (Number.isFinite(desde)) c.push(`h.creada >= ${param(desde)}`);
    if (Number.isFinite(hasta)) c.push(`h.creada < ${param(hasta)}`);
    return { donde: c.length ? `WHERE ${c.join(' AND ')}` : '', p, param };
  };

  const api = {
    /** Alta al abrir la sala: queda registrada como activa. */
    abrir: (resumen) => guardar(resumen, 'activa'),
    /** Punto de control periódico mientras la sala vive. */
    checkpoint: (resumen) => guardar(resumen, 'activa'),
    cerrar: (resumen, motivo) => guardar(resumen, motivo === 'vencida' ? 'vencida' : 'finalizada', ahora()),
    /** Al arrancar: todo lo que seguía «activa» perdió su estado en memoria. */
    async marcarInterrumpidas() {
      return (await db.exec("UPDATE salas_historial SET estado = 'interrumpida', cerrada = actualizada WHERE estado = 'activa'")).changes;
    },

    async listar({ limite = 50, desplazamiento = 0, ...f } = {}) {
      const { donde, p, param } = filtro(f);
      const base = `FROM salas_historial h JOIN usuarios u ON u.id = h.propietario_id ${donde}`;
      const total = (await db.uno(`SELECT COUNT(*) AS n ${base}`, p)).n;
      const lim = param(Math.min(Math.max(1, limite), 200));
      const off = param(Math.max(0, desplazamiento));
      const filas = await db.q(`SELECT h.id, h.titulo, h.estado, h.creada, h.cerrada, h.participantes, h.preguntas,
          u.id AS "propietarioId", u.email AS "propietarioEmail", u.nombre AS "propietarioNombre",
          (SELECT COUNT(*) FROM actividades_historial a WHERE a.sala_id = h.id) AS actividades
        ${base} ORDER BY h.creada DESC, h.id LIMIT ${lim} OFFSET ${off}`, p);
      return { total, filas };
    },

    /** Detalle; `propietarioId` va en la consulta: un docente nunca obtiene la sala ajena aunque conozca su id. */
    async detalle(id, { propietarioId = null } = {}) {
      const h = await db.uno(`SELECT h.*, u.email AS "propietarioEmail", u.nombre AS "propietarioNombre"
        FROM salas_historial h JOIN usuarios u ON u.id = h.propietario_id
        WHERE h.id = $1 AND ($2::text IS NULL OR h.propietario_id = $2)`, [String(id ?? '').slice(0, 64), propietarioId]);
      if (!h) return null;
      const actividades = (await db.q(`SELECT actividad_id AS id, orden, enunciado, tipo, opciones, rondas,
          resultados_publicados AS publicados, correcta_revelada AS revelada
        FROM actividades_historial WHERE sala_id = $1 ORDER BY orden`, [h.id]));
      return { id: h.id, titulo: h.titulo, estado: h.estado, creada: h.creada, cerrada: h.cerrada, participantes: h.participantes, preguntas: h.preguntas,
        propietarioId: h.propietario_id, propietarioEmail: h.propietarioEmail, propietarioNombre: h.propietarioNombre, actividades };
    },

    /** CSV de datos autorizados (una fila por sala), con protección contra inyección de fórmulas. */
    async csv(f) {
      const { filas } = await api.listar({ ...f, limite: 200, desplazamiento: 0 });
      const celda = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };
      const fecha = (ms) => (ms ? new Date(ms).toISOString() : '');
      const cab = ['id', 'titulo', 'estado', 'creada', 'cerrada', 'participantes', 'preguntas', 'actividades', 'propietario'];
      return [cab.join(','), ...filas.map((r) => [r.id, r.titulo, r.estado, fecha(r.creada), fecha(r.cerrada), r.participantes, r.preguntas, r.actividades, r.propietarioEmail].map(celda).join(','))].join('\r\n') + '\r\n';
    },

    /** Política de conservación: elimina historial más antiguo que `dias`. */
    async purgar(dias) {
      return (await db.exec("DELETE FROM salas_historial WHERE estado <> 'activa' AND COALESCE(cerrada, actualizada) < $1", [ahora() - dias * 86_400_000])).changes;
    },
    /** Eliminación a petición (superusuario o propietario). El propietario va en el mismo DELETE. */
    async eliminar(id, { propietarioId = null } = {}) {
      return (await db.exec("DELETE FROM salas_historial WHERE id = $1 AND estado <> 'activa' AND ($2::text IS NULL OR propietario_id = $2)",
        [String(id ?? '').slice(0, 64), propietarioId])).changes === 1;
    },
  };
  return api;
}
