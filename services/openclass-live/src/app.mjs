/**
 * Interact: ensamblaje de la aplicación (HTTP + Socket.IO + almacén en memoria + base persistente).
 * Capas: salas.mjs (sesiones y votaciones, memoria), db.mjs/cuentas.mjs/historial.mjs (identidad e historial, SQLite),
 * correo.mjs (SMTP/desarrollo), auth.mjs (hash y tokens firmados), http.mjs y sockets.mjs (API), public/ (interfaces).
 * El adaptador Reveal.js vive en la plantilla del generador (template/src/plugins/live.mjs).
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearFirmador } from './auth.mjs';
import { crearCorreo } from './correo.mjs';
import { crearCuentas, crearSesionesDb } from './cuentas.mjs';
import { abrirBase, respaldar } from './db.mjs';
import { crearHistorial } from './historial.mjs';
import { cargarEstaticos, crearManejadorHttp } from './http.mjs';
import { crearLimitador } from './limites.mjs';
import { crearAlmacen } from './salas.mjs';
import { crearSockets } from './sockets.mjs';

const PUBLICO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Registro mínimo en JSON: solo eventos y contadores. Nunca IP, alias, respuestas ni textos. */
export function crearLog(salida = (linea) => process.stdout.write(`${linea}\n`)) {
  return (evento, datos = {}) => salida(JSON.stringify({ t: new Date().toISOString(), evento, ...datos }));
}

export function crearApp(config, { log = crearLog(), ahora, intervaloSesionesMs, db: dbExterna } = {}) {
  const firmador = crearFirmador(config.secreto);
  const db = dbExterna ?? abrirBase(config.dbRuta ?? (config.dataDir ? path.join(config.dataDir, 'interact.sqlite') : ':memory:'));
  const reloj = ahora ?? Date.now;
  const cuentas = crearCuentas(db, { ahora: reloj, ttl: { invitacionHoras: config.invitacionHoras, verificacionHoras: config.verificacionHoras, recuperacionMin: config.recuperacionMin } });
  const sesiones = crearSesionesDb(db, { ahora: reloj });
  const historial = crearHistorial(db, { ahora: reloj });
  const correo = crearCorreo(config, { log });
  const interrumpidas = historial.marcarInterrumpidas();
  if (interrumpidas) log('historial_interrumpidas', { salas: interrumpidas });

  const almacen = crearAlmacen({
    ttlMin: config.salaTtlMin, maxParticipantes: config.maxParticipantes, maxSalas: config.maxSalas, ahora,
    alCerrar: (resumen, motivo) => { if (resumen.propietarioId) historial.cerrar(resumen, motivo); },
  });
  const manejar = crearManejadorHttp({
    config, estaticos: cargarEstaticos(PUBLICO), firmador, sesiones, log, cuentas, historial, correo, almacen, db,
    limitadorLogin: crearLimitador({ capacidad: 5, porSegundo: 1 / 60 }),
    limitadorLoginGlobal: crearLimitador({ capacidad: 30, porSegundo: 0.1 }),
    limitadorCuenta: crearLimitador({ capacidad: 5, porSegundo: 1 / 60 }),
    limitadorTokens: crearLimitador({ capacidad: 60, porSegundo: 0.5 }),
  });
  const servidor = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, manejar);
  servidor.keepAliveTimeout = 65_000;
  const sockets = crearSockets(servidor, { config, almacen, firmador, sesiones, log, cuentas, historial, ...(ahora ? { ahora } : {}), ...(intervaloSesionesMs ? { intervaloSesionesMs } : {}) });

  // Mantenimiento: retención y copia de seguridad diaria (solo con base en disco).
  const mantenimiento = () => {
    try {
      const h = historial.purgar(config.historialDias);
      const c = cuentas.purgar({ auditoriaDias: config.auditoriaDias });
      if (h || c.auditoria) log('retencion_aplicada', { historial: h, auditoria: c.auditoria });
      if (config.dataDir) respaldar(db, path.join(config.dataDir, 'respaldos'), { conservar: config.respaldosConservar });
    } catch (error) { log('mantenimiento_fallido', { tipo: error.name }); }
  };
  const diario = setInterval(mantenimiento, 24 * 3600_000);
  diario.unref();

  return {
    servidor, almacen, sockets, firmador, sesiones, cuentas, historial, correo, db, mantenimiento,
    escuchar: (puerto = config.puerto, host = '0.0.0.0') => new Promise((r) => servidor.listen(puerto, host, () => { setTimeout(mantenimiento, 5000).unref(); r(servidor.address()); })),
    cerrar: async () => {
      clearInterval(diario);
      await sockets.cerrar();
      await new Promise((r) => servidor.close(() => r()));
      if (!dbExterna) { try { db.close(); } catch { /* ya cerrada */ } }
    },
  };
}
