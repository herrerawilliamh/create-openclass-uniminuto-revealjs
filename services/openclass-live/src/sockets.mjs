/**
 * OpenClass Live: eventos Socket.IO (protocolo documentado en docs/PROTOCOLO.md).
 *
 * Espacios de nombres separados por rol; la autorización se comprueba en el handshake Y en cada evento:
 * - /participante: estudiantes anónimos con el código de sala (+ token de reconexión). Solo responder,
 *   preguntar y votar preguntas. Origen admitido: APP_URL.
 * - /docente: panel (cookie de sesión docente, origen APP_URL) o adaptador Reveal.js local (clave de
 *   presentador ligada a UNA sala, orígenes PRESENTER_ORIGINS). Ningún evento de participante otorga
 *   permisos docentes ni controla la navegación de las diapositivas.
 * Todos los eventos usan acuse: ack({ ok: true, ... }) o ack({ ok: false, error, mensaje }).
 *
 * Temporizador de votación: el servidor programa UN temporizador por sala al vencimiento absoluto de
 * la ronda abierta y difunde el estado una sola vez al cerrarla (nunca un mensaje por segundo: los
 * clientes cuentan hacia atrás con `cierra` y la hora del servidor `servidor`). Un barrido periódico
 * cubre cualquier temporizador perdido; no depende del navegador del docente.
 */
import { Server } from 'socket.io';
import { panelVigente } from './auth.mjs';
import { sesionDesdeCookie } from './http.mjs';
import { crearLimitador, ipCliente } from './limites.mjs';
import { PROTOCOLO, presentadorCompatible } from './protocolo.mjs';
import { ErrorSala } from './salas.mjs';
import * as V from './validar.mjs';

/** Rechaza navegadores de otro origen (CSWSH). Clientes sin navegador no envían Origin: dependen de su credencial. */
export function origenAdmitido(cabeceras, permitidos) {
  const origen = cabeceras.origin;
  if (origen) return permitidos.includes(origen);
  const sitio = cabeceras['sec-fetch-site'];
  return !sitio || sitio === 'same-origin' || sitio === 'none';
}

const errorDe = (error) => {
  if (error instanceof ErrorSala) return { ok: false, error: error.codigo, mensaje: error.message };
  if (error instanceof V.ErrorValidacion) return { ok: false, error: 'validacion', mensaje: error.message };
  return { ok: false, error: 'interno', mensaje: 'Error interno' };
};

/** Separa salaId del resto del mensaje para validar cada parte con su esquema. */
function conSala(datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new V.ErrorValidacion('mensaje: se esperaba un objeto');
  const { salaId, ...resto } = datos;
  return { salaId: V.id(salaId, 'salaId'), resto };
}

export function crearSockets(servidorHttp, { config, almacen, firmador, sesiones, log, historial = null, cuentas = null, ahora = Date.now, intervaloSesionesMs = 5_000 }) {
  const io = new Server(servidorHttp, {
    serveClient: true,
    maxHttpBufferSize: 16 * 1024,
    pingInterval: 20_000,
    pingTimeout: 20_000,
    connectTimeout: 15_000,
    transports: ['websocket', 'polling'],
    cors: { origin: [config.appUrl, ...config.origenesPresentador], credentials: false, methods: ['GET', 'POST'] },
    allowRequest: (req, callback) => callback(null, origenAdmitido(req.headers, [config.appUrl, ...config.origenesPresentador])),
  });

  // Uniones: una clase entera puede compartir IP (wifi del campus); solo los intentos FALLIDOS se limitan
  // estrictamente (fuerza bruta de códigos), y las conexiones en general con un margen amplio.
  const limiteFallidos = crearLimitador({ capacidad: 10, porSegundo: 0.1 });
  const limiteUniones = crearLimitador({ capacidad: 300, porSegundo: 5 });
  const limiteConexionDocente = crearLimitador({ capacidad: 20, porSegundo: 0.2 });
  const limiteEventos = crearLimitador({ capacidad: 15, porSegundo: 6 });
  const limiteEventosDocente = crearLimitador({ capacidad: 40, porSegundo: 20 });

  const participantes = io.of('/participante');
  const docentes = io.of('/docente');

  // ---------- H02: autorización del destinatario en el momento de enviar ----------
  /** Credencial del socket docente vigente AHORA (sesión del panel o clave de presentador de su sala). */
  async function destinatarioVigente(socket) {
    const { rol, salaId, version } = socket.data;
    if (rol === 'docente') return panelVigente(socket.data, sesiones);
    if (rol === 'presentador') return almacen.existe(salaId) && almacen.versionPresentador(salaId) === version && await propietarioActivo(salaId);
    return false;
  }
  /** Una cuenta suspendida deja sin efecto sus salas: las claves de presentador de su sala dejan de valer. */
  async function propietarioActivo(salaId) {
    const dueno = almacen.propietarioDe(salaId);
    return !dueno || !cuentas || (await cuentas.usuario(dueno))?.estado === 'activo';
  }
  /** Revalidación que falla cerrada: si la base no responde, el destinatario no se considera vigente. */
  const vigenteSeguro = (socket) => destinatarioVigente(socket).catch((error) => { log('revalidacion_fallida', { tipo: error.name }); return false; });
  function cortarSocket(socket) {
    for (const sala of socket.rooms) if (sala !== socket.id) socket.leave(sala);
    socket.disconnect(true);
  }
  /** Revalida a cada destinatario antes de enviar: un socket vencido o revocado se corta y no recibe nada. */
  async function emitirADocentes(salaId, nombre, payload) {
    const sala = `doc:${salaId}`;
    // Destinatarios fijados ahora (antes de cualquier espera): quien sale de la sala después ya fue elegido.
    const objetivos = [...docentes.sockets.values()].filter((socket) => socket.rooms.has(sala));
    const vigentes = await Promise.all(objetivos.map(vigenteSeguro));
    let datos;
    objetivos.forEach((socket, i) => {
      if (!vigentes[i]) { cortarSocket(socket); return; }
      datos ??= payload();
      if (datos !== null) socket.emit(nombre, datos);
    });
  }

  // ---------- Difusión agrupada (evita una ráfaga de mensajes por cada voto) ----------
  const pendientes = new Map();
  function difundir(salaId, { alumnos = true, docente = true } = {}) {
    const p = pendientes.get(salaId) ?? { alumnos: false, docente: false };
    p.alumnos ||= alumnos; p.docente ||= docente;
    if (pendientes.has(salaId)) return;
    pendientes.set(salaId, p);
    setTimeout(async () => {
      const { alumnos: a, docente: d } = pendientes.get(salaId);
      pendientes.delete(salaId);
      if (!almacen.existe(salaId)) return;
      if (d) await emitirADocentes(salaId, 'estado', () => (almacen.existe(salaId) ? almacen.estadoDocente(salaId) : null));
      if (a) {
        for (const s of await participantes.in(`sala:${salaId}`).fetchSockets()) {
          if (almacen.existe(salaId)) s.emit('estado', almacen.estadoParticipante(salaId, s.data.pid));
        }
      }
    }, 120);
  }

  // ---------- Cierre automático de votaciones (un temporizador por sala) ----------
  const temporizadores = new Map();
  function programarCierre(salaId) {
    clearTimeout(temporizadores.get(salaId));
    temporizadores.delete(salaId);
    const cierra = almacen.proximoCierre(salaId);
    if (cierra === null) return;
    const t = setTimeout(() => {
      temporizadores.delete(salaId);
      if (!almacen.existe(salaId)) return;
      almacen.vencerVotaciones(salaId);
      // Si una lectura ya aplicó el vencimiento, igual hay que avisar a todos una vez.
      if (almacen.proximoCierre(salaId) === null) { difundir(salaId); log('votacion_vencida', { sala: salaId.slice(0, 6) }); } else programarCierre(salaId);
    }, Math.max(50, cierra - ahora() + 20));
    t.unref?.();
    temporizadores.set(salaId, t);
  }

  function cerrarSala(salaId, motivo) {
    clearTimeout(temporizadores.get(salaId));
    temporizadores.delete(salaId);
    const aviso = { motivo };
    participantes.to(`sala:${salaId}`).emit('sala:cerrada', aviso);
    emitirADocentes(salaId, 'sala:cerrada', () => ({ salaId, ...aviso })).catch(() => {});
    participantes.in(`sala:${salaId}`).disconnectSockets(true);
    docentes.in(`doc:${salaId}`).socketsLeave(`doc:${salaId}`);
    // Los presentadores de esa sala ya no tienen nada que controlar.
    docentes.in(`pres:${salaId}`).disconnectSockets(true);
  }

  /** Envuelve un manejador: límite de frecuencia, ack obligatorio y errores normalizados. */
  const evento = (socket, limitador, manejador) => async (datos, ack) => {
    if (typeof ack !== 'function') return;
    if (!limitador.permitir(socket.id)) return ack({ ok: false, error: 'frecuencia', mensaje: 'Demasiadas acciones seguidas' });
    try { ack({ ok: true, ...(await manejador(datos ?? {})) }); } catch (error) {
      if (!(error instanceof ErrorSala) && !(error instanceof V.ErrorValidacion)) log('error_evento', { tipo: error.name });
      ack(errorDe(error));
    }
  };

  // ======================= Participantes =======================
  participantes.use((socket, next) => {
    const { headers, address } = socket.handshake;
    if (!origenAdmitido(headers, [config.appUrl])) return next(new Error('origen'));
    const ip = ipCliente(headers, address, config.confiarProxy);
    if (!limiteFallidos.disponible(ip) || !limiteUniones.permitir(ip)) return next(new Error('frecuencia'));
    try {
      const datos = V.union(socket.handshake.auth ?? {});
      const r = almacen.unir(datos.codigo, { alias: datos.alias, token: datos.token });
      socket.data = { salaId: r.salaId, pid: r.pid, token: r.token, reconectado: r.reconectado };
      next();
    } catch (error) {
      if (error instanceof V.ErrorValidacion || ['sala_inexistente', 'sala_vencida'].includes(error.codigo)) limiteFallidos.permitir(ip);
      next(new Error(error instanceof ErrorSala ? error.codigo : 'validacion'));
    }
  });

  participantes.on('connection', (socket) => {
    const { salaId, pid, token, reconectado } = socket.data;
    socket.join([`sala:${salaId}`, `p:${pid}`]);
    almacen.conectar(salaId, pid);
    socket.emit('sesion', { token, reconectado, estado: almacen.estadoParticipante(salaId, pid) });
    difundir(salaId, { alumnos: false });

    const vigente = () => {
      if (!almacen.existe(salaId)) throw new ErrorSala('sala_inexistente', 'La sala finalizó');
      if (almacen.bloqueado(salaId, pid)) throw new ErrorSala('bloqueado', 'La participación fue bloqueada por el docente');
    };

    socket.on('estado:solicitar', evento(socket, limiteEventos, () => { vigente(); return { estado: almacen.estadoParticipante(salaId, pid) }; }));

    socket.on('encuesta:responder', evento(socket, limiteEventos, (datos) => {
      vigente();
      const activa = almacen.activa(salaId);
      if (!activa || datos?.encuestaId !== activa) throw new ErrorSala('no_activa', 'Esa encuesta no está activa');
      const r = almacen.responder(salaId, pid, V.respuesta(datos, almacen.encuestaDocente(salaId, activa)));
      // Otras pestañas del mismo participante ven su selección; el docente ve el recuento.
      socket.to(`p:${pid}`).emit('estado', almacen.estadoParticipante(salaId, pid));
      difundir(salaId, { alumnos: false });
      return { respuesta: r };
    }));

    socket.on('pregunta:enviar', evento(socket, limiteEventos, (datos) => {
      vigente();
      const q = almacen.enviarPregunta(salaId, pid, V.preguntaAbierta(datos));
      difundir(salaId, { alumnos: q.estado === 'visible' });
      if (q.estado !== 'visible') socket.emit('estado', almacen.estadoParticipante(salaId, pid));
      return { pregunta: { id: q.id, estado: q.estado } };
    }));

    socket.on('pregunta:votar', evento(socket, limiteEventos, (datos) => {
      vigente();
      const r = almacen.votarPregunta(salaId, pid, V.soloId(datos, 'preguntaId'));
      difundir(salaId);
      return { voto: r };
    }));

    socket.on('disconnect', () => { almacen.desconectar(salaId, pid); difundir(salaId, { alumnos: false }); });
  });

  // ======================= Docente / presentador =======================
  /** H02: un socket invalidado sale de TODAS sus salas (deja de recibir difusiones) y se desconecta. */
  function salirDeSalas(socket) {
    for (const sala of socket.rooms) if (sala !== socket.id) socket.leave(sala);
  }
  /** Corta los sockets del panel cuya sesión ya no es válida (revocada o vencida). Los presentadores no se tocan. */
  async function cortarSesionesInvalidas() {
    const todos = [...docentes.sockets.values()];
    const vigentes = await Promise.all(todos.map(vigenteSeguro));
    todos.forEach((socket, i) => { if (!vigentes[i]) cortarSocket(socket); });
  }
  sesiones.alRevocar((sid) => {
    for (const socket of docentes.sockets.values()) {
      if (socket.data.rol === 'docente' && socket.data.sid === sid) cortarSocket(socket);
    }
  });
  docentes.use((socket, next) => {
    autenticarDocente(socket).then((e) => next(e ?? undefined), (error) => {
      log('handshake_fallido', { tipo: error.name });
      next(new Error('no_disponible'));
    });
  });
  /** Handshake del panel o del presentador. Devuelve un Error para rechazar, o null para admitir. */
  async function autenticarDocente(socket) {
    const next = (e) => e ?? null;
    const { headers, address, auth } = socket.handshake;
    const ip = ipCliente(headers, address, config.confiarProxy);
    if (!limiteConexionDocente.permitir(ip)) return next(new Error('frecuencia'));

    if (auth?.clave) {
      if (!origenAdmitido(headers, [config.appUrl, ...config.origenesPresentador])) return next(new Error('origen'));
      // Antes de mirar la clave: un adaptador de otra versión no llega a crear encuestas. Solo se
      // informa la versión y las capacidades que el servicio espera.
      if (!presentadorCompatible(auth)) {
        log('presentador_incompatible', { protocolo: Number.isInteger(auth.protocolo) ? auth.protocolo : 1 });
        return next(Object.assign(new Error('protocolo'), { data: { protocolo: PROTOCOLO } }));
      }
      const d = firmador.verificar(auth.clave, 'presentador');
      if (!d || !almacen.existe(d.s) || almacen.versionPresentador(d.s) !== d.v || !(await propietarioActivo(d.s))) return next(new Error('clave'));
      socket.data = { rol: 'presentador', salaId: d.s, version: d.v };
      return next();
    }
    // La cookie solo vale desde el propio panel: otro origen no puede reutilizarla.
    if (!origenAdmitido(headers, [config.appUrl])) return next(new Error('origen'));
    const s = await sesionDesdeCookie(headers.cookie, { firmador, sesiones });
    if (!s) return next(new Error('no_autenticado'));
    // H02: se conserva el exp VERIFICADO de la cookie (nunca un valor del cliente) para revalidarlo en cada envío.
    socket.data = { rol: 'docente', sid: s.sid, exp: s.exp, usuarioId: s.usuario.id };
    if (!(await panelVigente(socket.data, sesiones))) return next(new Error('no_autenticado'));
    return next();
  }

  docentes.on('connection', (socket) => {
    const { rol } = socket.data;
    // Los manejadores se registran en este mismo turno (un evento emitido justo tras «connect» no se pierde);
    // la revalidación con la base es una puerta: todo evento la espera y, si falla, no se ejecuta.
    // H02: el panel se une a una sala propia de su sesión; permite cortar todas sus pestañas a la vez.
    const listo = rol !== 'docente' ? Promise.resolve(true) : vigenteSeguro(socket).then((ok) => {
      if (!ok || !socket.connected) { cortarSocket(socket); return false; }
      socket.join(`sid:${socket.data.sid}`);
      return true;
    });

    // Primero viaja el acuse con el error; después se cierra la conexión.
    const expulsar = () => { salirDeSalas(socket); setTimeout(() => socket.disconnect(true), 100); };

    /** Autorización por evento: sesión aún válida (logout revoca) y sala dentro del alcance del rol. */
    async function autorizar(salaId, { soloDocente = false } = {}) {
      if (rol === 'docente') {
        if (!(await panelVigente(socket.data, sesiones))) { expulsar(); throw new ErrorSala('no_autenticado', 'Sesión docente vencida'); }
      } else {
        if (soloDocente) throw new ErrorSala('prohibido', 'Operación reservada al panel docente');
        if (salaId && salaId !== socket.data.salaId) throw new ErrorSala('prohibido', 'La clave no corresponde a esta sala');
        if (!almacen.existe(socket.data.salaId) || almacen.versionPresentador(socket.data.salaId) !== socket.data.version || !(await propietarioActivo(socket.data.salaId))) {
          expulsar();
          throw new ErrorSala('clave', 'La clave de presentador fue revocada o venció');
        }
      }
      if (salaId && !almacen.existe(salaId)) throw new ErrorSala('sala_inexistente', 'La sala no existe o ya finalizó');
      // Autorización por propiedad: una cuenta solo gobierna sus propias salas, aunque conozca otro identificador.
      if (rol === 'docente' && salaId && almacen.propietarioDe(salaId) !== socket.data.usuarioId) {
        throw new ErrorSala('prohibido', 'La sala pertenece a otra cuenta');
      }
    }

    const claveDe = (salaId) => {
      const sala = almacen.resumenSala(salaId);
      const segundos = Math.max(60, Math.floor((sala.vence - ahora()) / 1000));
      return firmador.firmar({ t: 'presentador', s: salaId, v: sala.versionPresentador }, segundos);
    };

    const on = (nombre, manejador) => socket.on(nombre, evento(socket, limiteEventosDocente, async (datos) => {
      if (!(await listo)) throw new ErrorSala('no_autenticado', 'Sesión docente vencida');
      return manejador(datos);
    }));
    const conEstado = (salaId, extra = {}) => { difundir(salaId); programarCierre(salaId); return extra; };

    if (rol === 'presentador') {
      socket.join([`doc:${socket.data.salaId}`, `pres:${socket.data.salaId}`]);
      socket.emit('sesion', { rol, protocolo: PROTOCOLO, salaId: socket.data.salaId, estado: almacen.estadoDocente(socket.data.salaId) });
    } else {
      listo.then((ok) => { if (ok) socket.emit('sesion', { rol, protocolo: PROTOCOLO, salas: almacen.listarSalas(socket.data.usuarioId) }); });
    }

    on('sala:crear', async (datos) => {
      await autorizar(null, { soloDocente: true });
      const sala = almacen.crearSala({ ...V.crearSala(datos), propietarioId: socket.data.usuarioId });
      // Sin bloquear la clase: si la base falla, el punto de control periódico registra la sala después.
      if (historial) await historial.abrir(almacen.resumenPersistible(sala.id)).catch((error) => log('historial_alta_fallida', { tipo: error.name }));
      socket.join(`doc:${sala.id}`);
      log('sala_creada', { sala: sala.id.slice(0, 6) });
      return { sala, enlace: `${config.appUrl}/join/${sala.codigo}`, qr: `${config.appUrl}/qr/${sala.codigo}.svg`, clave: claveDe(sala.id) };
    });

    on('sala:listar', async () => { await autorizar(null, { soloDocente: true }); return { salas: almacen.listarSalas(socket.data.usuarioId) }; });

    on('sala:seguir', async (datos) => {
      const { salaId } = conSala(datos);
      await autorizar(salaId);
      socket.join(`doc:${salaId}`);
      const sala = almacen.resumenSala(salaId);
      return { estado: almacen.estadoDocente(salaId), enlace: `${config.appUrl}/join/${sala.codigo}`, qr: `${config.appUrl}/qr/${sala.codigo}.svg` };
    });

    on('sala:clave', async (datos) => {
      const { salaId } = conSala(datos);
      await autorizar(salaId, { soloDocente: true });
      return { clave: claveDe(salaId) };
    });

    on('sala:revocarClaves', async (datos) => {
      const { salaId } = conSala(datos);
      await autorizar(salaId, { soloDocente: true });
      almacen.rotarClavePresentador(salaId);
      docentes.in(`pres:${salaId}`).disconnectSockets(true);
      return { clave: claveDe(salaId) };
    });

    on('encuesta:crear', async (datos) => {
      const { salaId, resto } = conSala(datos);
      await autorizar(salaId);
      const { encuesta, abrir, ...otros } = resto;
      if (Object.keys(otros).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      const def = V.definicionEncuesta(encuesta);
      const e = almacen.crearEncuesta(salaId, def, { abrir: abrir === true });
      log('encuesta_creada', { sala: salaId.slice(0, 6), opciones: def.opciones.length });
      return conEstado(salaId, { encuesta: e });
    });

    const accionEncuesta = (nombre, fn) => on(nombre, async (datos) => {
      const { salaId, resto } = conSala(datos);
      await autorizar(salaId);
      return conEstado(salaId, { encuesta: fn(salaId, V.soloId(resto, 'encuestaId')) });
    });
    accionEncuesta('encuesta:abrir', almacen.abrirEncuesta);
    accionEncuesta('encuesta:cerrar', almacen.cerrarEncuesta);
    accionEncuesta('encuesta:publicar', almacen.publicarResultados);
    accionEncuesta('encuesta:segundaRonda', almacen.segundaRonda);
    accionEncuesta('encuesta:extender', almacen.extenderVotacion);

    // La solución viaja SOLO aquí, desde quien la creó (presentación local o navegador del panel).
    // Validación y revelación ocurren en el mismo turno síncrono: nada se intercala entre ambas.
    on('encuesta:revelar', async (datos) => {
      const { salaId, resto } = conSala(datos);
      await autorizar(salaId);
      const { encuestaId, solucion, ...otros } = resto;
      if (Object.keys(otros).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      const eid = V.id(encuestaId, 'encuestaId');
      const e = almacen.revelarCorrecta(salaId, eid, V.solucion(solucion, almacen.encuestaDocente(salaId, eid)));
      log('encuesta_revelada', { sala: salaId.slice(0, 6) });
      return conEstado(salaId, { encuesta: e });
    });

    on('sala:ajustar', async (datos) => {
      const { salaId, resto } = conSala(datos);
      await autorizar(salaId);
      return conEstado(salaId, { ajustes: almacen.ajustarSala(salaId, V.ajustesSala(resto)) });
    });

    on('encuesta:retirar', async (datos) => {
      const { salaId, resto } = conSala(datos);
      if (Object.keys(resto).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      await autorizar(salaId);
      almacen.retirarEncuesta(salaId);
      return conEstado(salaId);
    });

    on('pregunta:moderar', async (datos) => {
      const { salaId, resto } = conSala(datos);
      await autorizar(salaId);
      const orden = V.moderacion(resto);
      const r = almacen.moderar(salaId, orden);
      if (orden.accion === 'bloquearAutor') {
        participantes.to(`p:${r.bloqueado}`).emit('bloqueado', {});
        participantes.in(`p:${r.bloqueado}`).disconnectSockets(true);
        return conEstado(salaId, { bloqueado: true });
      }
      return conEstado(salaId, { pregunta: r });
    });

    on('preguntas:ajustar', async (datos) => {
      const { salaId, resto } = conSala(datos);
      await autorizar(salaId);
      return conEstado(salaId, { ajustes: almacen.ajustarPreguntas(salaId, V.ajustesPreguntas(resto)) });
    });

    on('sala:finalizar', async (datos) => {
      const { salaId, resto } = conSala(datos);
      if (Object.keys(resto).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      await autorizar(salaId, { soloDocente: true });
      cerrarSala(salaId, 'finalizada');
      almacen.finalizar(salaId);
      log('sala_finalizada', { sala: salaId.slice(0, 6) });
      return {};
    });
  });

  // ---------- Vencimiento automático y limpieza de memoria ----------
  let ultimoPunto = ahora();
  const reloj = setInterval(() => {
    for (const id of almacen.purgar()) { cerrarSala(id, 'vencida'); log('sala_vencida', { sala: id.slice(0, 6) }); }
    for (const id of almacen.vencerVotaciones()) difundir(id);
    if (historial && ahora() - ultimoPunto >= 60_000) {
      ultimoPunto = ahora();
      for (const id of almacen.idsActivos()) {
        const r = almacen.resumenPersistible(id);
        // Sin bloquear la clase: un punto de control perdido se repite en el siguiente ciclo.
        if (r?.propietarioId) historial.checkpoint(r).catch((error) => log('checkpoint_fallido', { tipo: error.name }));
      }
    }
    sesiones.purgar().catch(() => {});
    for (const l of [limiteFallidos, limiteUniones, limiteConexionDocente, limiteEventos, limiteEventosDocente]) l.purgar();
  }, 15_000);
  reloj.unref();
  // Las sesiones vencidas cortan sus sockets aunque el cliente no envíe nada (exposición máxima: este intervalo).
  const relojSesiones = setInterval(() => { cortarSesionesInvalidas().catch(() => {}); }, intervaloSesionesMs);
  relojSesiones.unref();

  return { io, cerrar: () => {
    clearInterval(reloj);
    clearInterval(relojSesiones);
    for (const t of temporizadores.values()) clearTimeout(t);
    temporizadores.clear();
    return new Promise((r) => io.close(() => r()));
  }, purgarAhora: () => {
    for (const id of almacen.purgar()) cerrarSala(id, 'vencida');
  }, vencerAhora: () => {
    for (const id of almacen.vencerVotaciones()) difundir(id);
  } };
}
