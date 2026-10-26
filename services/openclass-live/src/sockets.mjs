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
import { sesionDesdeCookie } from './http.mjs';
import { crearLimitador, ipCliente } from './limites.mjs';
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

export function crearSockets(servidorHttp, { config, almacen, firmador, sesiones, log, ahora = Date.now }) {
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
      if (d) docentes.to(`doc:${salaId}`).emit('estado', almacen.estadoDocente(salaId));
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
    docentes.to(`doc:${salaId}`).emit('sala:cerrada', { salaId, ...aviso });
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
  docentes.use((socket, next) => {
    const { headers, address, auth } = socket.handshake;
    const ip = ipCliente(headers, address, config.confiarProxy);
    if (!limiteConexionDocente.permitir(ip)) return next(new Error('frecuencia'));

    if (auth?.clave) {
      if (!origenAdmitido(headers, [config.appUrl, ...config.origenesPresentador])) return next(new Error('origen'));
      const d = firmador.verificar(auth.clave, 'presentador');
      if (!d || !almacen.existe(d.s) || almacen.versionPresentador(d.s) !== d.v) return next(new Error('clave'));
      socket.data = { rol: 'presentador', salaId: d.s, version: d.v };
      return next();
    }
    // La cookie solo vale desde el propio panel: otro origen no puede reutilizarla.
    if (!origenAdmitido(headers, [config.appUrl])) return next(new Error('origen'));
    const s = sesionDesdeCookie(headers.cookie, { firmador, sesiones });
    if (!s) return next(new Error('no_autenticado'));
    socket.data = { rol: 'docente', sid: s.sid };
    return next();
  });

  docentes.on('connection', (socket) => {
    const { rol } = socket.data;

    // Primero viaja el acuse con el error; después se cierra la conexión.
    const expulsar = () => setTimeout(() => socket.disconnect(true), 100);

    /** Autorización por evento: sesión aún válida (logout revoca) y sala dentro del alcance del rol. */
    function autorizar(salaId, { soloDocente = false } = {}) {
      if (rol === 'docente') {
        if (!sesiones.valida(socket.data.sid)) { expulsar(); throw new ErrorSala('no_autenticado', 'Sesión docente vencida'); }
      } else {
        if (soloDocente) throw new ErrorSala('prohibido', 'Operación reservada al panel docente');
        if (salaId && salaId !== socket.data.salaId) throw new ErrorSala('prohibido', 'La clave no corresponde a esta sala');
        if (!almacen.existe(socket.data.salaId) || almacen.versionPresentador(socket.data.salaId) !== socket.data.version) {
          expulsar();
          throw new ErrorSala('clave', 'La clave de presentador fue revocada o venció');
        }
      }
      if (salaId && !almacen.existe(salaId)) throw new ErrorSala('sala_inexistente', 'La sala no existe o ya finalizó');
    }

    const claveDe = (salaId) => {
      const sala = almacen.resumenSala(salaId);
      const segundos = Math.max(60, Math.floor((sala.vence - ahora()) / 1000));
      return firmador.firmar({ t: 'presentador', s: salaId, v: sala.versionPresentador }, segundos);
    };

    const on = (nombre, manejador) => socket.on(nombre, evento(socket, limiteEventosDocente, manejador));
    const conEstado = (salaId, extra = {}) => { difundir(salaId); programarCierre(salaId); return extra; };

    if (rol === 'presentador') {
      socket.join([`doc:${socket.data.salaId}`, `pres:${socket.data.salaId}`]);
      socket.emit('sesion', { rol, salaId: socket.data.salaId, estado: almacen.estadoDocente(socket.data.salaId) });
    } else {
      socket.emit('sesion', { rol, salas: almacen.listarSalas() });
    }

    on('sala:crear', (datos) => {
      autorizar(null, { soloDocente: true });
      const sala = almacen.crearSala(V.crearSala(datos));
      socket.join(`doc:${sala.id}`);
      log('sala_creada', { sala: sala.id.slice(0, 6) });
      return { sala, enlace: `${config.appUrl}/join/${sala.codigo}`, qr: `${config.appUrl}/qr/${sala.codigo}.svg`, clave: claveDe(sala.id) };
    });

    on('sala:listar', () => { autorizar(null, { soloDocente: true }); return { salas: almacen.listarSalas() }; });

    on('sala:seguir', (datos) => {
      const { salaId } = conSala(datos);
      autorizar(salaId);
      socket.join(`doc:${salaId}`);
      const sala = almacen.resumenSala(salaId);
      return { estado: almacen.estadoDocente(salaId), enlace: `${config.appUrl}/join/${sala.codigo}`, qr: `${config.appUrl}/qr/${sala.codigo}.svg` };
    });

    on('sala:clave', (datos) => {
      const { salaId } = conSala(datos);
      autorizar(salaId, { soloDocente: true });
      return { clave: claveDe(salaId) };
    });

    on('sala:revocarClaves', (datos) => {
      const { salaId } = conSala(datos);
      autorizar(salaId, { soloDocente: true });
      almacen.rotarClavePresentador(salaId);
      docentes.in(`pres:${salaId}`).disconnectSockets(true);
      return { clave: claveDe(salaId) };
    });

    on('encuesta:crear', (datos) => {
      const { salaId, resto } = conSala(datos);
      autorizar(salaId);
      const { encuesta, abrir, ...otros } = resto;
      if (Object.keys(otros).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      const def = V.definicionEncuesta(encuesta);
      let e = almacen.crearEncuesta(salaId, def);
      if (abrir === true) e = almacen.abrirEncuesta(salaId, e.id);
      log('encuesta_creada', { sala: salaId.slice(0, 6), opciones: def.opciones.length });
      return conEstado(salaId, { encuesta: e });
    });

    const accionEncuesta = (nombre, fn) => on(nombre, (datos) => {
      const { salaId, resto } = conSala(datos);
      autorizar(salaId);
      return conEstado(salaId, { encuesta: fn(salaId, V.soloId(resto, 'encuestaId')) });
    });
    accionEncuesta('encuesta:abrir', almacen.abrirEncuesta);
    accionEncuesta('encuesta:cerrar', almacen.cerrarEncuesta);
    accionEncuesta('encuesta:publicar', almacen.publicarResultados);
    accionEncuesta('encuesta:segundaRonda', almacen.segundaRonda);
    accionEncuesta('encuesta:extender', almacen.extenderVotacion);

    // La solución viaja SOLO aquí, desde quien la creó (presentación local o navegador del panel).
    // Validación y revelación ocurren en el mismo turno síncrono: nada se intercala entre ambas.
    on('encuesta:revelar', (datos) => {
      const { salaId, resto } = conSala(datos);
      autorizar(salaId);
      const { encuestaId, solucion, ...otros } = resto;
      if (Object.keys(otros).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      const eid = V.id(encuestaId, 'encuestaId');
      const e = almacen.revelarCorrecta(salaId, eid, V.solucion(solucion, almacen.encuestaDocente(salaId, eid)));
      log('encuesta_revelada', { sala: salaId.slice(0, 6) });
      return conEstado(salaId, { encuesta: e });
    });

    on('sala:ajustar', (datos) => {
      const { salaId, resto } = conSala(datos);
      autorizar(salaId);
      return conEstado(salaId, { ajustes: almacen.ajustarSala(salaId, V.ajustesSala(resto)) });
    });

    on('encuesta:retirar', (datos) => {
      const { salaId, resto } = conSala(datos);
      if (Object.keys(resto).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      autorizar(salaId);
      almacen.retirarEncuesta(salaId);
      return conEstado(salaId);
    });

    on('pregunta:moderar', (datos) => {
      const { salaId, resto } = conSala(datos);
      autorizar(salaId);
      const orden = V.moderacion(resto);
      const r = almacen.moderar(salaId, orden);
      if (orden.accion === 'bloquearAutor') {
        participantes.to(`p:${r.bloqueado}`).emit('bloqueado', {});
        participantes.in(`p:${r.bloqueado}`).disconnectSockets(true);
        return conEstado(salaId, { bloqueado: true });
      }
      return conEstado(salaId, { pregunta: r });
    });

    on('preguntas:ajustar', (datos) => {
      const { salaId, resto } = conSala(datos);
      autorizar(salaId);
      return conEstado(salaId, { ajustes: almacen.ajustarPreguntas(salaId, V.ajustesPreguntas(resto)) });
    });

    on('sala:finalizar', (datos) => {
      const { salaId, resto } = conSala(datos);
      if (Object.keys(resto).length) throw new V.ErrorValidacion('mensaje: campos no admitidos');
      autorizar(salaId, { soloDocente: true });
      cerrarSala(salaId, 'finalizada');
      almacen.finalizar(salaId);
      log('sala_finalizada', { sala: salaId.slice(0, 6) });
      return {};
    });
  });

  // ---------- Vencimiento automático y limpieza de memoria ----------
  const reloj = setInterval(() => {
    for (const id of almacen.purgar()) { cerrarSala(id, 'vencida'); log('sala_vencida', { sala: id.slice(0, 6) }); }
    for (const id of almacen.vencerVotaciones()) difundir(id);
    sesiones.purgar();
    for (const l of [limiteFallidos, limiteUniones, limiteConexionDocente, limiteEventos, limiteEventosDocente]) l.purgar();
  }, 15_000);
  reloj.unref();

  return { io, cerrar: () => {
    clearInterval(reloj);
    for (const t of temporizadores.values()) clearTimeout(t);
    temporizadores.clear();
    return new Promise((r) => io.close(() => r()));
  }, purgarAhora: () => {
    for (const id of almacen.purgar()) cerrarSala(id, 'vencida');
  }, vencerAhora: () => {
    for (const id of almacen.vencerVotaciones()) difundir(id);
  } };
}
