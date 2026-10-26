/**
 * OpenClass Live: estado de las salas en memoria. Es la ÚNICA fuente de verdad de votaciones y preguntas.
 * No depende de Socket.IO ni de HTTP: lo reutilizan el servidor actual y una futura Zoom App.
 *
 * Privacidad: no guarda IP ni datos personales; el alias es opcional; los tokens de participante se
 * guardan como hash SHA-256. Al finalizar o vencer una sala se elimina todo su contenido.
 * Un reinicio del proceso pierde las salas abiertas (documentado en el README).
 *
 * Tiempo de votación: UNA preferencia por sala (`duracionVotacion`, 30 s por omisión; 0 = sin límite).
 * Cada ronda guarda su vencimiento absoluto (`cierra`, ms del servidor) al abrirse: cambiar la
 * preferencia solo afecta a las rondas siguientes. El cierre por tiempo ocurre una sola vez y nunca
 * publica resultados ni revela respuestas. Toda lectura de la sala aplica los vencimientos pendientes,
 * así ninguna respuesta tardía entra aunque el temporizador del proceso se retrase.
 *
 * Soluciones: el servidor NO conoce la respuesta correcta ni la explicación hasta la revelación
 * explícita (`revelarCorrecta`), que valida y guarda la solución en una sola operación síncrona. Antes
 * de ese momento ninguna vista (docente, presentador o estudiante) puede contenerla ni derivarla.
 */
import { randomBytes, randomInt, createHash } from 'node:crypto';
import { ALFABETO_CODIGO, DURACION_PREDETERMINADA } from './validar.mjs';

export class ErrorSala extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo; }
}
const falla = (codigo, mensaje) => { throw new ErrorSala(codigo, mensaje); };

const nuevoId = (bytes = 12) => randomBytes(bytes).toString('base64url');
const hashToken = (token) => createHash('sha256').update(token).digest('base64url');

export const LIMITES_SALA = Object.freeze({
  encuestas: 40,
  preguntas: 300,
  preguntasPorParticipante: 5,
  intervaloPreguntaMs: 15_000,
  extensionMs: 30_000,
  restanteMaxMs: 10 * 60_000,
});

export function crearAlmacen({ ttlMin, maxParticipantes, maxSalas, ahora = () => Date.now() }) {
  const salas = new Map();
  const porCodigo = new Map();

  function generarCodigo() {
    for (let intento = 0; intento < 50; intento++) {
      let c = '';
      for (let i = 0; i < 6; i++) c += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
      if (!porCodigo.has(c)) return c;
    }
    return falla('codigo', 'No se pudo generar un código de sala');
  }

  function sala(id) {
    const s = salas.get(id);
    if (!s) return falla('sala_inexistente', 'La sala no existe o ya finalizó');
    if (s.vence <= ahora()) { eliminar(id); return falla('sala_vencida', 'La sala venció'); }
    vencerRondas(s);
    return s;
  }

  /** Cierra la ronda abierta de la sala si ya pasó su vencimiento. Devuelve true solo en la transición. */
  function vencerRondas(s) {
    const e = s.activa ? s.encuestas.get(s.activa) : null;
    const r = e?.rondas.length ? rondaActual(e) : null;
    return Boolean(r?.abierta && r.cierra !== null && r.cierra <= ahora() && cerrarRonda(r, 'tiempo'));
  }

  /** Cierre único: solo la primera llamada cambia el estado (tiempo, docente o retiro). */
  function cerrarRonda(r, motivo) {
    if (!r.abierta) return false;
    r.abierta = false;
    r.cierre = motivo;
    return true;
  }

  const nuevaRonda = (s, numero) => ({
    numero, abierta: true, respuestas: new Map(), cierre: null,
    cierra: s.duracionVotacion ? ahora() + s.duracionVotacion * 1000 : null,
  });

  function eliminar(id) {
    const s = salas.get(id);
    if (!s) return null;
    salas.delete(id);
    porCodigo.delete(s.codigo);
    // Vaciar explícitamente: no deben quedar referencias a respuestas ni preguntas.
    s.participantes.clear(); s.tokens.clear(); s.encuestas.clear(); s.preguntas.clear();
    return s;
  }

  const encuesta = (s, eid) => s.encuestas.get(eid) ?? falla('encuesta_inexistente', 'La encuesta no existe');
  function rondaActual(e) { return e.rondas[e.rondas.length - 1]; }

  function participante(s, pid) {
    const p = s.participantes.get(pid);
    if (!p) return falla('participante', 'Participante no reconocido');
    if (p.bloqueado) return falla('bloqueado', 'La participación fue bloqueada por el docente');
    return p;
  }

  // ---------- Resultados (calculados siempre aquí, nunca en el navegador) ----------
  // El acierto solo existe tras revelar: antes el servidor no tiene con qué calcularlo.
  function resumenRonda(e, r) {
    const conteos = e.def.opciones.map(() => 0);
    let correctos = 0;
    const clave = e.solucion?.correctas.join(',') ?? '';
    for (const seleccion of r.respuestas.values()) {
      for (const i of seleccion) conteos[i]++;
      if (clave && seleccion.join(',') === clave) correctos++;
    }
    const n = r.respuestas.size;
    return {
      numero: r.numero,
      estado: r.abierta ? 'abierta' : 'cerrada',
      cierra: r.cierra,
      ...(r.cierre ? { cierre: r.cierre } : {}),
      respondientes: n,
      conteos,
      porcentajes: conteos.map((c) => (n ? Math.round((c / n) * 1000) / 10 : 0)),
      ...(clave ? { porcentajeCorrecto: n ? Math.round((correctos / n) * 1000) / 10 : 0 } : {}),
    };
  }

  /** Resumen para estudiantes: lista blanca de campos; el acierto, solo con la respuesta ya revelada. */
  function resumenParticipante(e, r) {
    const { numero, estado, respondientes, conteos, porcentajes, cierre, porcentajeCorrecto } = resumenRonda(e, r);
    return { numero, estado, respondientes, conteos, porcentajes, ...(cierre ? { cierre } : {}),
      ...(e.correctaRevelada && porcentajeCorrecto !== undefined ? { porcentajeCorrecto } : {}) };
  }

  function estadoEncuesta(e) {
    if (!e.rondas.length) return 'lista';
    return rondaActual(e).abierta ? 'abierta' : 'cerrada';
  }

  // ---------- Vistas: qué ve cada rol ----------
  function vistaEncuestaDocente(e) {
    return {
      id: e.id, ...e.def, estado: estadoEncuesta(e), ronda: e.rondas.length,
      resultadosPublicados: e.resultadosPublicados, correctaRevelada: e.correctaRevelada,
      ...(e.correctaRevelada && e.solucion ? { correctas: e.solucion.correctas, explicacion: e.solucion.explicacion } : {}),
      rondas: e.rondas.map((r) => resumenRonda(e, r)),
    };
  }

  /**
   * Lo que recibe un estudiante: sin respuesta correcta, explicación ni acierto hasta que el docente
   * las revele; la distribución por opciones solo cuando el docente publica los resultados.
   */
  function vistaEncuestaParticipante(e, pid) {
    const r = e.rondas.length ? rondaActual(e) : null;
    const vista = {
      id: e.id, enunciado: e.def.enunciado, codigo: e.def.codigo, tipo: e.def.tipo, opciones: e.def.opciones,
      estado: estadoEncuesta(e), ronda: e.rondas.length,
      cierra: r?.abierta ? r.cierra : null,
      miSeleccion: r?.respuestas.get(pid) ?? [],
      resultadosPublicados: e.resultadosPublicados, correctaRevelada: e.correctaRevelada,
    };
    if (e.resultadosPublicados) vista.rondas = e.rondas.filter((x) => !x.abierta).map((x) => resumenParticipante(e, x));
    if (e.correctaRevelada && e.solucion) { vista.correctas = e.solucion.correctas; vista.explicacion = e.solucion.explicacion; }
    return vista;
  }

  function vistaPreguntaDocente(s, q) {
    return { id: q.id, texto: q.texto, estado: q.estado, votos: q.votos.size, creada: q.creada,
      alias: s.participantes.get(q.autor)?.alias || '', proyectada: s.proyectada === q.id };
  }

  const ordenarPorVotos = (a, b) => b.votos - a.votos || a.creada - b.creada;

  function conectados(s) {
    let n = 0;
    for (const p of s.participantes.values()) if (p.conexiones > 0 && !p.bloqueado) n++;
    return n;
  }

  const api = {
    get tamano() { return salas.size; },

    crearSala({ titulo = '', preModeracion = true } = {}) {
      if (salas.size >= maxSalas) falla('limite_salas', 'Se alcanzó el máximo de salas simultáneas');
      const s = {
        id: nuevoId(16), codigo: generarCodigo(), titulo, creada: ahora(), vence: ahora() + ttlMin * 60_000,
        versionPresentador: 1, duracionVotacion: DURACION_PREDETERMINADA,
        participantes: new Map(), tokens: new Map(),
        encuestas: new Map(), activa: null,
        preguntas: new Map(), preguntasAbiertas: true, preModeracion, proyectada: null,
      };
      salas.set(s.id, s);
      porCodigo.set(s.codigo, s.id);
      return api.resumenSala(s.id);
    },

    resumenSala(id) {
      const s = sala(id);
      return { id: s.id, codigo: s.codigo, titulo: s.titulo, creada: s.creada, vence: s.vence,
        participantes: s.participantes.size, conectados: conectados(s),
        preguntasAbiertas: s.preguntasAbiertas, preModeracion: s.preModeracion, versionPresentador: s.versionPresentador,
        duracionVotacion: s.duracionVotacion };
    },

    listarSalas: () => [...salas.keys()].filter((id) => salas.get(id).vence > ahora()).map((id) => api.resumenSala(id)),

    idPorCodigo: (codigo) => porCodigo.get(codigo) ?? null,

    /** Une o reconecta: con un token válido recupera al mismo participante y sus respuestas. */
    unir(codigo, { alias = '', token = null } = {}) {
      const id = porCodigo.get(codigo);
      if (!id) return falla('sala_inexistente', 'No hay una sala abierta con ese código');
      const s = sala(id);
      if (token) {
        const pid = s.tokens.get(hashToken(token));
        if (pid) {
          const p = participante(s, pid);
          if (alias) p.alias = alias;
          return { salaId: s.id, pid, token, reconectado: true };
        }
      }
      if (s.participantes.size >= maxParticipantes) falla('sala_llena', 'La sala alcanzó el máximo de participantes');
      const pid = nuevoId(12);
      const nuevo = nuevoId(24);
      s.participantes.set(pid, { pid, alias, conexiones: 0, bloqueado: false, preguntas: 0, ultimaPregunta: 0 });
      s.tokens.set(hashToken(nuevo), pid);
      return { salaId: s.id, pid, token: nuevo, reconectado: false };
    },

    conectar(salaId, pid) { const s = salas.get(salaId); const p = s?.participantes.get(pid); if (p) p.conexiones++; },
    desconectar(salaId, pid) { const p = salas.get(salaId)?.participantes.get(pid); if (p && p.conexiones > 0) p.conexiones--; },

    rotarClavePresentador(salaId) { const s = sala(salaId); s.versionPresentador++; return s.versionPresentador; },
    versionPresentador: (salaId) => sala(salaId).versionPresentador,

    // ---------- Encuestas ----------
    crearEncuesta(salaId, def) {
      const s = sala(salaId);
      if (s.encuestas.size >= LIMITES_SALA.encuestas) falla('limite_encuestas', 'Se alcanzó el máximo de encuestas de la sesión');
      const e = { id: nuevoId(9), def, rondas: [], resultadosPublicados: false, correctaRevelada: false, solucion: null, creada: ahora() };
      s.encuestas.set(e.id, e);
      return vistaEncuestaDocente(e);
    },

    abrirEncuesta(salaId, eid) {
      const s = sala(salaId);
      const e = encuesta(s, eid);
      const otra = s.activa && s.activa !== eid ? s.encuestas.get(s.activa) : null;
      if (otra && estadoEncuesta(otra) === 'abierta') falla('otra_abierta', 'Cierre primero la votación abierta');
      if (e.rondas.length) falla('ya_abierta', 'La encuesta ya se abrió; use «Segunda ronda» para repetirla');
      e.rondas.push(nuevaRonda(s, 1));
      s.activa = eid;
      return vistaEncuestaDocente(e);
    },

    responder(salaId, pid, { encuestaId, ronda, seleccion }) {
      const s = sala(salaId);
      participante(s, pid);
      if (s.activa !== encuestaId) falla('no_activa', 'Esa encuesta no está activa');
      const e = encuesta(s, encuestaId);
      const r = e.rondas.length ? rondaActual(e) : null;
      if (!r?.abierta) falla('cerrada', 'La votación está cerrada');
      if (r.numero !== ronda) falla('ronda', 'La ronda cambió; recargue la pregunta');
      // Una respuesta por participante y ronda: un nuevo envío reemplaza al anterior (sin duplicados).
      r.respuestas.set(pid, seleccion);
      return { encuestaId, ronda, seleccion };
    },

    cerrarEncuesta(salaId, eid) {
      const e = encuesta(sala(salaId), eid);
      const r = e.rondas.length ? rondaActual(e) : null;
      if (!r?.abierta) falla('no_abierta', 'La votación ya está cerrada');
      cerrarRonda(r, 'docente');
      return vistaEncuestaDocente(e);
    },

    /** «+30 segundos» sobre la ronda abierta (sin efecto en salas sin límite). */
    extenderVotacion(salaId, eid) {
      const e = encuesta(sala(salaId), eid);
      const r = e.rondas.length ? rondaActual(e) : null;
      if (!r?.abierta) falla('no_abierta', 'La votación ya está cerrada');
      if (r.cierra === null) falla('sin_limite', 'Esta votación no tiene límite de tiempo');
      const cierra = Math.max(r.cierra, ahora()) + LIMITES_SALA.extensionMs;
      if (cierra - ahora() > LIMITES_SALA.restanteMaxMs) falla('limite_tiempo', 'La votación no puede durar más de 10 minutos desde ahora');
      r.cierra = cierra;
      return vistaEncuestaDocente(e);
    },

    publicarResultados(salaId, eid) {
      const e = encuesta(sala(salaId), eid);
      if (estadoEncuesta(e) !== 'cerrada') falla('no_cerrada', 'Cierre la votación antes de publicar resultados');
      e.resultadosPublicados = true;
      return vistaEncuestaDocente(e);
    },

    /**
     * Revelación explícita y atómica: la solución llega aquí por primera vez (validada por el llamador
     * contra esta misma encuesta) y solo se acepta para la encuesta activa, con la votación cerrada y una
     * única vez. Una segunda petición (otro presentador, reintento) falla sin cambiar nada.
     */
    revelarCorrecta(salaId, eid, solucion) {
      const s = sala(salaId);
      const e = encuesta(s, eid);
      if (s.activa !== eid) falla('no_activa', 'Solo se revela la pregunta activa en las pantallas');
      if (estadoEncuesta(e) !== 'cerrada') falla('no_cerrada', 'No se revela la respuesta con la votación abierta');
      if (e.correctaRevelada) falla('ya_revelada', 'La respuesta de esta pregunta ya se reveló');
      if (!solucion?.correctas?.length && !solucion?.explicacion) falla('sin_correcta', 'La encuesta no tiene respuesta correcta ni explicación');
      e.solucion = { correctas: [...(solucion.correctas ?? [])], explicacion: solucion.explicacion ?? '' };
      e.correctaRevelada = true;
      return vistaEncuestaDocente(e);
    },

    segundaRonda(salaId, eid) {
      const s = sala(salaId);
      const e = encuesta(s, eid);
      const otra = s.activa && s.activa !== eid ? s.encuestas.get(s.activa) : null;
      if (otra && estadoEncuesta(otra) === 'abierta') falla('otra_abierta', 'Cierre primero la votación abierta');
      if (estadoEncuesta(e) !== 'cerrada') falla('no_cerrada', 'Cierre la primera ronda antes de repetir');
      if (e.rondas.length >= 2) falla('max_rondas', 'La encuesta ya tuvo dos rondas');
      if (e.correctaRevelada) falla('revelada', 'Ya se reveló la respuesta: una segunda ronda no aportaría evidencia');
      e.rondas.push(nuevaRonda(s, 2));
      e.resultadosPublicados = false;
      s.activa = eid;
      return vistaEncuestaDocente(e);
    },

    /** Retira la encuesta de las pantallas de los estudiantes (queda en el historial de la sesión). */
    retirarEncuesta(salaId) {
      const s = sala(salaId);
      const e = s.activa ? s.encuestas.get(s.activa) : null;
      if (e && estadoEncuesta(e) === 'abierta') cerrarRonda(rondaActual(e), 'docente');
      s.activa = null;
    },

    encuestaDocente: (salaId, eid) => vistaEncuestaDocente(encuesta(sala(salaId), eid)),
    historial: (salaId) => [...sala(salaId).encuestas.values()].map(vistaEncuestaDocente),
    activa: (salaId) => sala(salaId).activa,

    // ---------- Preguntas abiertas ----------
    enviarPregunta(salaId, pid, { texto }) {
      const s = sala(salaId);
      const p = participante(s, pid);
      if (!s.preguntasAbiertas) falla('preguntas_cerradas', 'La recepción de preguntas está cerrada');
      if (s.preguntas.size >= LIMITES_SALA.preguntas) falla('limite_preguntas', 'La sala alcanzó el máximo de preguntas');
      if (p.preguntas >= LIMITES_SALA.preguntasPorParticipante) falla('limite_propias', 'Alcanzó el máximo de preguntas por persona');
      if (ahora() - p.ultimaPregunta < LIMITES_SALA.intervaloPreguntaMs) falla('frecuencia', 'Espere unos segundos antes de enviar otra pregunta');
      p.preguntas++;
      p.ultimaPregunta = ahora();
      const q = { id: nuevoId(9), autor: pid, texto, estado: s.preModeracion ? 'pendiente' : 'visible', votos: new Set(), creada: ahora() };
      s.preguntas.set(q.id, q);
      return vistaPreguntaDocente(s, q);
    },

    votarPregunta(salaId, pid, qid) {
      const s = sala(salaId);
      participante(s, pid);
      const q = s.preguntas.get(qid);
      if (!q || (q.estado !== 'visible' && q.estado !== 'respondida')) falla('pregunta_inexistente', 'La pregunta no está disponible');
      if (q.autor === pid) falla('propia', 'No puede votar su propia pregunta');
      if (q.votos.has(pid)) q.votos.delete(pid); else q.votos.add(pid);
      return { id: q.id, votos: q.votos.size, votada: q.votos.has(pid) };
    },

    moderar(salaId, { preguntaId, accion }) {
      const s = sala(salaId);
      const q = s.preguntas.get(preguntaId) ?? falla('pregunta_inexistente', 'La pregunta no existe');
      switch (accion) {
        case 'aprobar': q.estado = 'visible'; break;
        case 'ocultar': q.estado = 'oculta'; if (s.proyectada === q.id) s.proyectada = null; break;
        case 'respondida': q.estado = 'respondida'; break;
        case 'proyectar':
          if (q.estado === 'oculta') falla('oculta', 'No se proyecta una pregunta oculta');
          if (q.estado === 'pendiente') q.estado = 'visible';
          s.proyectada = q.id;
          break;
        case 'quitarProyeccion': if (s.proyectada === q.id) s.proyectada = null; break;
        case 'bloquearAutor': {
          const autor = s.participantes.get(q.autor);
          if (autor) autor.bloqueado = true;
          for (const otra of s.preguntas.values()) {
            if (otra.autor === q.autor) { otra.estado = 'oculta'; if (s.proyectada === otra.id) s.proyectada = null; }
          }
          return { bloqueado: q.autor };
        }
        default: falla('accion', 'Acción no admitida');
      }
      return vistaPreguntaDocente(s, q);
    },

    /** Preferencias de la sesión: afectan a las rondas que se abran después, nunca a la ronda en curso. */
    ajustarSala(salaId, { duracionVotacion }) {
      const s = sala(salaId);
      s.duracionVotacion = duracionVotacion;
      return { duracionVotacion: s.duracionVotacion };
    },

    /** Vencimiento (ms del servidor) de la ronda abierta de la sala, o null. */
    proximoCierre(salaId) {
      const s = salas.get(salaId);
      const e = s?.activa ? s.encuestas.get(s.activa) : null;
      const r = e?.rondas.length ? rondaActual(e) : null;
      return r?.abierta ? r.cierra : null;
    },

    /** Aplica los vencimientos pendientes (de una sala o de todas); devuelve las salas que cambiaron. */
    vencerVotaciones(salaId) {
      const ids = salaId ? [salaId] : [...salas.keys()];
      return ids.filter((id) => { const s = salas.get(id); return s && s.vence > ahora() && vencerRondas(s); });
    },

    ajustarPreguntas(salaId, { abiertas, preModeracion }) {
      const s = sala(salaId);
      if (abiertas !== undefined) s.preguntasAbiertas = abiertas;
      if (preModeracion !== undefined) s.preModeracion = preModeracion;
      return { preguntasAbiertas: s.preguntasAbiertas, preModeracion: s.preModeracion };
    },

    preguntasDocente(salaId) {
      const s = sala(salaId);
      return [...s.preguntas.values()].map((q) => vistaPreguntaDocente(s, q)).sort(ordenarPorVotos);
    },

    /** Para estudiantes: solo preguntas moderadas como visibles o respondidas, y las propias pendientes. */
    preguntasParticipante(salaId, pid) {
      const s = sala(salaId);
      return [...s.preguntas.values()]
        .filter((q) => q.estado === 'visible' || q.estado === 'respondida' || (q.autor === pid && q.estado === 'pendiente'))
        .map((q) => ({ id: q.id, texto: q.texto, estado: q.estado, votos: q.votos.size, creada: q.creada,
          propia: q.autor === pid, votada: q.votos.has(pid) }))
        .sort(ordenarPorVotos);
    },

    /** La única pregunta abierta que puede aparecer en la pantalla compartida: la proyectada por el docente. */
    proyectada(salaId) {
      const s = sala(salaId);
      const q = s.proyectada ? s.preguntas.get(s.proyectada) : null;
      return q ? { id: q.id, texto: q.texto, votos: q.votos.size } : null;
    },

    // ---------- Estado completo por rol ----------
    estadoDocente(salaId) {
      const s = sala(salaId);
      return {
        servidor: ahora(),
        sala: api.resumenSala(salaId),
        activa: s.activa ? vistaEncuestaDocente(s.encuestas.get(s.activa)) : null,
        historial: api.historial(salaId),
        preguntas: api.preguntasDocente(salaId),
        proyectada: api.proyectada(salaId),
      };
    },

    estadoParticipante(salaId, pid) {
      const s = sala(salaId);
      const p = s.participantes.get(pid);
      return {
        servidor: ahora(),
        sala: { codigo: s.codigo, titulo: s.titulo, vence: s.vence, preguntasAbiertas: s.preguntasAbiertas, preModeracion: s.preModeracion },
        yo: { alias: p?.alias ?? '', bloqueado: !!p?.bloqueado },
        encuesta: s.activa ? vistaEncuestaParticipante(s.encuestas.get(s.activa), pid) : null,
        preguntas: api.preguntasParticipante(salaId, pid),
      };
    },

    participantesDe: (salaId) => [...(salas.get(salaId)?.participantes.keys() ?? [])],
    bloqueado: (salaId, pid) => !!salas.get(salaId)?.participantes.get(pid)?.bloqueado,

    finalizar(salaId) { sala(salaId); return eliminar(salaId) ? true : false; },

    /** Elimina salas vencidas; devuelve sus ids para avisar a los clientes conectados. */
    purgar() {
      const vencidas = [];
      for (const [id, s] of salas) if (s.vence <= ahora()) { eliminar(id); vencidas.push(id); }
      return vencidas;
    },

    existe: (salaId) => { const s = salas.get(salaId); return !!s && s.vence > ahora(); },
  };
  return api;
}
