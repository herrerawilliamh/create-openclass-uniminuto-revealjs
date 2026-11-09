/**
 * Interact: historial persistente de sesiones (solo datos agregados).
 * Política: se guardan propietario, título, fechas, estado, número de participantes y de preguntas, y por actividad
 * enunciado, opciones y recuentos por ronda. NO se guardan alias, tokens, respuestas individuales, textos de
 * preguntas de estudiantes, notas privadas, soluciones ni diapositivas. Si la sala se creó con
 * `conservarResultados = false`, solo se guardan los metadatos.
 * Una sala en memoria que no sobrevive a un reinicio se marca `interrumpida`; nunca se presenta como activa.
 */
import { transaccion } from './db.mjs';

export const ESTADOS = Object.freeze(['activa', 'finalizada', 'vencida', 'interrumpida']);

export function crearHistorial(db, { ahora = Date.now } = {}) {
  const q = (sql) => db.prepare(sql);

  function guardar(resumen, estado, cerrada = null) {
    transaccion(db, () => {
      q(`INSERT INTO salas_historial (id, propietario_id, titulo, estado, creada, actualizada, cerrada, participantes, preguntas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET titulo = excluded.titulo, estado = excluded.estado, actualizada = excluded.actualizada,
           cerrada = excluded.cerrada, participantes = excluded.participantes, preguntas = excluded.preguntas`)
        .run(resumen.id, resumen.propietarioId, resumen.titulo, estado, resumen.creada, ahora(), cerrada, resumen.participantes, resumen.preguntas);
      q('DELETE FROM actividades_historial WHERE sala_id = ?').run(resumen.id);
      const ins = q('INSERT INTO actividades_historial (sala_id, actividad_id, orden, enunciado, tipo, opciones, rondas, resultados_publicados, correcta_revelada) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const a of resumen.actividades) {
        ins.run(resumen.id, a.id, a.orden, a.enunciado, a.tipo, JSON.stringify(a.opciones), JSON.stringify(a.rondas), a.resultadosPublicados ? 1 : 0, a.correctaRevelada ? 1 : 0);
      }
    });
  }

  const filtro = ({ propietarioId, q: texto, estado, desde, hasta, usuario }) => {
    const c = []; const p = [];
    if (propietarioId) { c.push('h.propietario_id = ?'); p.push(propietarioId); }
    if (usuario) { c.push('(u.email LIKE ? ESCAPE \'\\\' OR u.nombre LIKE ? ESCAPE \'\\\')'); const l = `%${String(usuario).slice(0, 80).replace(/[\\%_]/g, '\\$&')}%`; p.push(l, l); }
    if (texto) { c.push('h.titulo LIKE ? ESCAPE \'\\\''); p.push(`%${String(texto).slice(0, 80).replace(/[\\%_]/g, '\\$&')}%`); }
    if (estado && ESTADOS.includes(estado)) { c.push('h.estado = ?'); p.push(estado); }
    if (Number.isFinite(desde)) { c.push('h.creada >= ?'); p.push(desde); }
    if (Number.isFinite(hasta)) { c.push('h.creada < ?'); p.push(hasta); }
    return { donde: c.length ? `WHERE ${c.join(' AND ')}` : '', p };
  };

  return {
    /** Alta al abrir la sala: queda registrada como activa. */
    abrir: (resumen) => guardar(resumen, 'activa'),
    /** Punto de control periódico mientras la sala vive. */
    checkpoint: (resumen) => guardar(resumen, 'activa'),
    cerrar: (resumen, motivo) => guardar(resumen, motivo === 'vencida' ? 'vencida' : 'finalizada', ahora()),
    /** Al arrancar: todo lo que seguía «activa» perdió su estado en memoria. */
    marcarInterrumpidas() {
      return q("UPDATE salas_historial SET estado = 'interrumpida', cerrada = actualizada WHERE estado = 'activa'").run().changes;
    },

    listar({ limite = 50, desplazamiento = 0, ...f } = {}) {
      const { donde, p } = filtro(f);
      const base = `FROM salas_historial h JOIN usuarios u ON u.id = h.propietario_id ${donde}`;
      const total = q(`SELECT COUNT(*) AS n ${base}`).get(...p).n;
      const filas = q(`SELECT h.id, h.titulo, h.estado, h.creada, h.cerrada, h.participantes, h.preguntas, u.id AS propietarioId, u.email AS propietarioEmail, u.nombre AS propietarioNombre,
        (SELECT COUNT(*) FROM actividades_historial a WHERE a.sala_id = h.id) AS actividades
        ${base} ORDER BY h.creada DESC LIMIT ? OFFSET ?`).all(...p, Math.min(limite, 200), Math.max(0, desplazamiento));
      return { total, filas };
    },

    /** Detalle; `propietarioId` obliga a que la sala sea de esa cuenta (un docente nunca ve la ajena aunque cambie el id). */
    detalle(id, { propietarioId = null } = {}) {
      const h = q('SELECT h.*, u.email AS propietarioEmail, u.nombre AS propietarioNombre FROM salas_historial h JOIN usuarios u ON u.id = h.propietario_id WHERE h.id = ?').get(String(id).slice(0, 64));
      if (!h || (propietarioId && h.propietario_id !== propietarioId)) return null;
      const actividades = q('SELECT actividad_id AS id, orden, enunciado, tipo, opciones, rondas, resultados_publicados AS publicados, correcta_revelada AS revelada FROM actividades_historial WHERE sala_id = ? ORDER BY orden').all(h.id)
        .map((a) => ({ ...a, opciones: JSON.parse(a.opciones), rondas: JSON.parse(a.rondas), publicados: Boolean(a.publicados), revelada: Boolean(a.revelada) }));
      return { id: h.id, titulo: h.titulo, estado: h.estado, creada: h.creada, cerrada: h.cerrada, participantes: h.participantes, preguntas: h.preguntas,
        propietarioId: h.propietario_id, propietarioEmail: h.propietarioEmail, propietarioNombre: h.propietarioNombre, actividades };
    },

    /** CSV de datos autorizados (una fila por sala), con protección contra inyección de fórmulas. */
    csv(f) {
      const { filas } = this.listar({ ...f, limite: 200, desplazamiento: 0 });
      const celda = (v) => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`; return `"${t.replace(/"/g, '""')}"`; };
      const fecha = (ms) => (ms ? new Date(ms).toISOString() : '');
      const cab = ['id', 'titulo', 'estado', 'creada', 'cerrada', 'participantes', 'preguntas', 'actividades', 'propietario'];
      return [cab.join(','), ...filas.map((r) => [r.id, r.titulo, r.estado, fecha(r.creada), fecha(r.cerrada), r.participantes, r.preguntas, r.actividades, r.propietarioEmail].map(celda).join(','))].join('\r\n') + '\r\n';
    },

    /** Política de conservación: elimina historial más antiguo que `dias`. */
    purgar(dias) {
      return q("DELETE FROM salas_historial WHERE estado <> 'activa' AND COALESCE(cerrada, actualizada) < ?").run(ahora() - dias * 86_400_000).changes;
    },
    /** Eliminación a petición (superusuario o propietario). */
    eliminar(id, { propietarioId = null } = {}) {
      const h = q('SELECT propietario_id FROM salas_historial WHERE id = ?').get(String(id).slice(0, 64));
      if (!h || (propietarioId && h.propietario_id !== propietarioId)) return false;
      return q("DELETE FROM salas_historial WHERE id = ? AND estado <> 'activa'").run(id).changes === 1;
    },
  };
}
