/**
 * OpenClass Live: ensamblaje de la aplicación (HTTP + Socket.IO + almacén en memoria).
 * Separación por capas: salas.mjs (sesiones y votaciones), auth.mjs (autenticación), http.mjs y
 * sockets.mjs (API de participación), public/ (interfaces docente y estudiante). El adaptador Reveal.js
 * vive en la plantilla del generador (template/src/plugins/live.mjs) y solo habla con /docente.
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearFirmador, crearSesiones } from './auth.mjs';
import { cargarEstaticos, crearManejadorHttp } from './http.mjs';
import { crearLimitador } from './limites.mjs';
import { crearAlmacen } from './salas.mjs';
import { crearSockets } from './sockets.mjs';

const PUBLICO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** Registro mínimo en JSON: solo eventos y contadores. Nunca IP, alias, respuestas ni textos. */
export function crearLog(salida = (linea) => process.stdout.write(`${linea}\n`)) {
  return (evento, datos = {}) => salida(JSON.stringify({ t: new Date().toISOString(), evento, ...datos }));
}

export function crearApp(config, { log = crearLog(), ahora } = {}) {
  const firmador = crearFirmador(config.secreto);
  const sesiones = crearSesiones();
  const almacen = crearAlmacen({ ttlMin: config.salaTtlMin, maxParticipantes: config.maxParticipantes, maxSalas: config.maxSalas, ahora });
  const manejar = crearManejadorHttp({
    config, estaticos: cargarEstaticos(PUBLICO), firmador, sesiones, log,
    limitadorLogin: crearLimitador({ capacidad: 5, porSegundo: 1 / 60 }),
    limitadorLoginGlobal: crearLimitador({ capacidad: 30, porSegundo: 0.1 }),
  });
  const servidor = createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, manejar);
  servidor.keepAliveTimeout = 65_000;
  const sockets = crearSockets(servidor, { config, almacen, firmador, sesiones, log, ...(ahora ? { ahora } : {}) });

  return {
    servidor, almacen, sockets, firmador, sesiones,
    escuchar: (puerto = config.puerto, host = '0.0.0.0') => new Promise((r) => servidor.listen(puerto, host, () => r(servidor.address()))),
    cerrar: async () => { await sockets.cerrar(); await new Promise((r) => servidor.close(() => r())); },
  };
}
