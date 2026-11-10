/**
 * Interact: ensamblaje de la aplicación (HTTP + Socket.IO + almacén en memoria + base persistente).
 * Capas: salas.mjs (sesiones y votaciones, memoria), db.mjs/cuentas.mjs/historial.mjs (identidad e historial, PostgreSQL),
 * correo.mjs (SMTP/desarrollo), auth.mjs (hash y tokens firmados), http.mjs y sockets.mjs (API), public/ (interfaces).
 * El adaptador Reveal.js vive en la plantilla del generador (template/src/plugins/live.mjs).
 * Las copias de seguridad NO viven en este proceso: las hace pg_dump fuera del contenedor (docs/RESPALDO-RESTAURACION.md).
 */
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearFirmador } from './auth.mjs';
import { crearCorreo } from './correo.mjs';
import { crearCuentas, crearSesionesDb } from './cuentas.mjs';
import { abrirBase } from './db.mjs';
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

/** Opciones del pool a partir de la configuración validada (config.mjs). */
export const opcionesBase = (config, log) => ({
  url: config.db.url, esquema: config.db.esquema, max: config.db.poolMax, ssl: config.db.ssl,
  migraciones: config.db.migraciones, esperaMs: config.db.esperaMs, statementTimeoutMs: config.db.statementTimeoutMs,
  aplicacion: 'interact', alError: (e) => log('base_cliente_error', { codigo: String(e?.code ?? '').slice(0, 8) }),
});

export async function crearApp(config, { log = crearLog(), ahora, intervaloSesionesMs, db: dbExterna } = {}) {
  const firmador = crearFirmador(config.secreto);
  const db = dbExterna ?? await abrirBase(opcionesBase(config, log));
  const reloj = ahora ?? Date.now;
  const cuentas = crearCuentas(db, { ahora: reloj, ttl: { invitacionHoras: config.invitacionHoras, verificacionHoras: config.verificacionHoras, recuperacionMin: config.recuperacionMin } });
  const sesiones = crearSesionesDb(db, { ahora: reloj });
  const historial = crearHistorial(db, { ahora: reloj });
  const correo = crearCorreo(config, { log });
  const interrumpidas = await historial.marcarInterrumpidas();
  if (interrumpidas) log('historial_interrumpidas', { salas: interrumpidas });

  // Escrituras de cierre en curso: el cierre ordenado del servicio las espera antes de cerrar el pool.
  const pendientes = new Set();
  const persistir = (promesa) => {
    const p = promesa.catch((error) => log('historial_cierre_fallido', { tipo: error.name })).finally(() => pendientes.delete(p));
    pendientes.add(p);
    return p;
  };
  const almacen = crearAlmacen({
    ttlMin: config.salaTtlMin, maxParticipantes: config.maxParticipantes, maxSalas: config.maxSalas, ahora,
    alCerrar: (resumen, motivo) => { if (resumen.propietarioId) persistir(historial.cerrar(resumen, motivo)); },
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

  // Mantenimiento diario: política de conservación (historial, auditoría, tokens y sesiones vencidas).
  const mantenimiento = async () => {
    try {
      const h = await historial.purgar(config.historialDias);
      const c = await cuentas.purgar({ auditoriaDias: config.auditoriaDias });
      if (h || c.auditoria) log('retencion_aplicada', { historial: h, auditoria: c.auditoria });
    } catch (error) { log('mantenimiento_fallido', { tipo: error.name }); }
  };
  const diario = setInterval(mantenimiento, 24 * 3600_000);
  diario.unref();

  return {
    servidor, almacen, sockets, firmador, sesiones, cuentas, historial, correo, db, mantenimiento,
    /** Espera a que terminen las escrituras de historial ya iniciadas (cierres de sala). */
    persistido: () => Promise.allSettled([...pendientes]),
    escuchar: (puerto = config.puerto, host = '0.0.0.0') => new Promise((r) => servidor.listen(puerto, host, () => { setTimeout(mantenimiento, 5000).unref(); r(servidor.address()); })),
    cerrar: async () => {
      clearInterval(diario);
      await sockets.cerrar();
      await new Promise((r) => servidor.close(() => r()));
      await Promise.allSettled([...pendientes]);
      if (!dbExterna) { try { await db.cerrar(); } catch { /* ya cerrada */ } }
    },
  };
}
