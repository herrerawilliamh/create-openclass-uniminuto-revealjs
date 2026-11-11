/**
 * Interact: persistencia en PostgreSQL (cliente `pg`, pool de conexiones y consultas parametrizadas).
 * - Toda consulta lleva parámetros ($1, $2…): nunca se interpola texto del usuario en SQL.
 * - Migraciones versionadas (`src/migraciones/NNN-nombre.sql`), lineales, cada una en su transacción,
 *   serializadas con un bloqueo consultivo y con suma SHA-256 registrada: una migración aplicada no puede
 *   cambiar en silencio (la verificación falla y el servicio no arranca).
 * - En producción el servicio NO migra: solo comprueba que el esquema esté al día (`DB_MIGRATIONS=verificar`).
 *   Las migraciones las aplica `scripts/migrar.mjs` con la credencial de migraciones (propietaria del esquema);
 *   la credencial de la aplicación solo tiene SELECT/INSERT/UPDATE/DELETE (ver docs/POSTGRESQL.md).
 * - Errores seguros: si la base no está disponible se lanza `ErrorBase` sin URL, usuario ni contraseña.
 * Copias de seguridad: fuera del proceso, con pg_dump (scripts/respaldar.mjs y docs/RESPALDO-RESTAURACION.md).
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// bigint (int8): marcas de tiempo en ms y recuentos. Caben con holgura en 2^53, se entregan como Number.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

const MIGRACIONES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migraciones');
const BLOQUEO_MIGRACIONES = "hashtext('interact:migraciones')";
export const IDENTIFICADOR = /^[a-z_][a-z0-9_]{0,62}$/;

export class ErrorBase extends Error {
  constructor(codigo, mensaje, causa) { super(mensaje); this.name = 'ErrorBase'; this.codigo = codigo; if (causa?.code) this.causa = causa.code; }
}

/** Fallos de conexión o de disponibilidad del servidor (no de datos): la respuesta pública es 503. */
export function esErrorDisponibilidad(error) {
  if (error instanceof ErrorBase) return error.codigo === 'no_disponible';
  const c = String(error?.code ?? '');
  return ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'EPIPE'].includes(c)
    || /^(08|53|57P)/.test(c) // conexión, recursos insuficientes, servidor apagándose
    || /timeout exceeded when trying to connect|Connection terminated/i.test(String(error?.message ?? ''));
}

const sumaSql = (sql) => createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

export function listarMigraciones(dir = MIGRACIONES) {
  return readdirSync(dir).filter((f) => /^\d{3}-[a-z0-9-]+\.sql$/.test(f)).sort()
    .map((f) => {
      const sql = readFileSync(path.join(dir, f), 'utf8');
      return { version: Number(f.slice(0, 3)), nombre: f.slice(4, -4), sql, checksum: sumaSql(sql) };
    });
}

/** API mínima sobre un ejecutor de `pg` (pool o cliente de una transacción). */
function envolver(ejecutor) {
  return {
    q: async (sql, p = []) => (await ejecutor.query(sql, p)).rows,
    uno: async (sql, p = []) => (await ejecutor.query(sql, p)).rows[0] ?? null,
    exec: async (sql, p = []) => ({ changes: (await ejecutor.query(sql, p)).rowCount ?? 0 }),
  };
}

function configurarPool({ url, esquema, max, ssl, aplicacion, statementTimeoutMs, conexionTimeoutMs }) {
  if (!url) throw new ErrorBase('configuracion', 'DATABASE_URL no está definida.');
  if (esquema && !IDENTIFICADOR.test(esquema)) throw new ErrorBase('configuracion', 'DB_SCHEMA no es un identificador válido.');
  const opciones = [`-c statement_timeout=${Number(statementTimeoutMs)}`, '-c idle_in_transaction_session_timeout=30000'];
  if (esquema) opciones.push(`-c search_path=${esquema}`);
  return {
    connectionString: url, max, ssl, application_name: aplicacion,
    idleTimeoutMillis: 30_000, connectionTimeoutMillis: conexionTimeoutMs, options: opciones.join(' '),
  };
}

/**
 * Abre el pool y deja el esquema listo.
 * `migraciones`: 'auto' (desarrollo y pruebas: aplica las pendientes) | 'verificar' (producción: exige el esquema al día)
 *   | 'ninguna' (solo scripts/migrar.mjs, que migra explícitamente después).
 * `esperaMs`: tiempo total de reintento mientras PostgreSQL arranca (arranque ordenado).
 */
export async function abrirBase({
  url, esquema = null, max = 10, ssl = undefined, aplicacion = 'interact', migraciones = 'auto',
  esperaMs = 30_000, statementTimeoutMs = 10_000, conexionTimeoutMs = 5_000, alError = () => {},
} = {}) {
  const config = configurarPool({ url, esquema, max, ssl, aplicacion, statementTimeoutMs, conexionTimeoutMs });
  if (esquema && migraciones === 'auto') await crearEsquemaSiFalta({ ...config, options: undefined }, esquema, esperaMs);
  const pool = new pg.Pool(config);
  // Un cliente inactivo que pierde la conexión no debe tumbar el proceso; se informa sin datos sensibles.
  pool.on('error', (e) => alError(e));
  const base = crearBase(pool);
  try {
    await esperarDisponible(base, esperaMs);
    if (migraciones === 'auto') await migrar(base);
    else if (migraciones === 'verificar') await exigirEsquemaAlDia(base);
    else if (migraciones !== 'ninguna') throw new ErrorBase('configuracion', 'Modo de migraciones no válido.');
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }
  return base;
}

function crearBase(pool) {
  return {
    ...envolver(pool),
    pool,
    /** Ejecuta `fn(tx)` en una transacción. Dentro, `tx.tx(f)` reutiliza la misma transacción. */
    async tx(fn) {
      let cliente;
      try { cliente = await pool.connect(); } catch (e) { throw new ErrorBase('no_disponible', 'La base de datos no está disponible.', e); }
      const t = envolver(cliente);
      t.tx = (f) => f(t);
      try {
        await cliente.query('BEGIN');
        const r = await fn(t);
        await cliente.query('COMMIT');
        return r;
      } catch (error) {
        try { await cliente.query('ROLLBACK'); } catch { /* conexión perdida: PostgreSQL ya revirtió */ }
        throw error;
      } finally { cliente.release(); }
    },
    /** Cliente dedicado (bloqueos de sesión, migraciones). */
    async conCliente(fn) {
      let cliente;
      try { cliente = await pool.connect(); } catch (e) { throw new ErrorBase('no_disponible', 'La base de datos no está disponible.', e); }
      try { return await fn(cliente); } finally { cliente.release(); }
    },
    /** Comprobación ligera para /healthz. */
    async disponible() {
      try { await pool.query('SELECT 1'); return true; } catch { return false; }
    },
    cerrar: () => pool.end(),
  };
}

const pausa = (intento) => new Promise((r) => setTimeout(r, Math.min(2000, 200 * 2 ** intento)));

async function esperarDisponible(base, esperaMs) {
  const limite = Date.now() + esperaMs;
  for (let intento = 0; ; intento++) {
    try { await base.pool.query('SELECT 1'); return; } catch (error) {
      if (!esErrorDisponibilidad(error) || Date.now() >= limite) {
        // Nunca se propaga el mensaje original: puede incluir el host o el usuario.
        throw new ErrorBase(esErrorDisponibilidad(error) ? 'no_disponible' : 'conexion', 'No se pudo conectar con PostgreSQL.', error);
      }
      await pausa(intento);
    }
  }
}

async function crearEsquemaSiFalta(config, esquema, esperaMs) {
  const limite = Date.now() + esperaMs;
  for (let intento = 0; ; intento++) {
    const c = new pg.Client(config);
    try {
      await c.connect();
      await c.query(`CREATE SCHEMA IF NOT EXISTS ${esquema}`); // identificador ya validado con IDENTIFICADOR
      return;
    } catch (error) {
      // Dos arranques simultáneos: IF NOT EXISTS no es atómico en el catálogo; si otro lo creó, basta.
      if (error.code === '23505' || error.code === '42P06') return;
      if (!esErrorDisponibilidad(error)) throw new ErrorBase('conexion', 'No se pudo preparar el esquema en PostgreSQL.', error);
      if (!esErrorDisponibilidad(error) || Date.now() >= limite) throw new ErrorBase('no_disponible', 'No se pudo conectar con PostgreSQL.', error);
      await pausa(intento);
    } finally { await c.end().catch(() => {}); }
  }
}

const TABLA = `CREATE TABLE IF NOT EXISTS esquema_migraciones (
  version integer PRIMARY KEY CHECK (version > 0),
  nombre text NOT NULL,
  checksum text NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  aplicada timestamptz NOT NULL DEFAULT now()
)`;

async function leerAplicadas(cliente) {
  const existe = (await cliente.query("SELECT to_regclass('esquema_migraciones') IS NOT NULL AS hay")).rows[0].hay;
  if (!existe) return new Map();
  return new Map((await cliente.query('SELECT version, nombre, checksum FROM esquema_migraciones ORDER BY version')).rows.map((f) => [f.version, f]));
}

function compararHistorial(hechas, migraciones) {
  for (const [version, fila] of hechas) {
    const m = migraciones.find((x) => x.version === version);
    if (!m) throw new ErrorBase('esquema', `La base tiene la migración ${version} que este código no conoce (¿versión anterior del servicio?).`);
    if (m.checksum !== fila.checksum) throw new ErrorBase('esquema', `La migración ${version} cambió después de aplicarse: las migraciones son inmutables.`);
  }
}

/** Aplica las migraciones pendientes. Idempotente y segura ante ejecuciones concurrentes. Devuelve las versiones aplicadas. */
export async function migrar(base, migraciones = listarMigraciones()) {
  return base.conCliente(async (c) => {
    await c.query(`SELECT pg_advisory_lock(${BLOQUEO_MIGRACIONES})`);
    try {
      await c.query(TABLA);
      const hechas = await leerAplicadas(c);
      compararHistorial(hechas, migraciones);
      const maxima = Math.max(0, ...hechas.keys());
      const aplicadas = [];
      for (const m of migraciones) {
        if (hechas.has(m.version)) continue;
        if (m.version < maxima) throw new ErrorBase('esquema', `Migración ${m.version} intercalada antes de la ${maxima}: el historial debe ser lineal.`);
        await c.query('BEGIN');
        try {
          await c.query(m.sql);
          await c.query('INSERT INTO esquema_migraciones (version, nombre, checksum) VALUES ($1, $2, $3)', [m.version, m.nombre, m.checksum]);
          await c.query('COMMIT');
        } catch (error) { await c.query('ROLLBACK').catch(() => {}); throw error; }
        aplicadas.push(m.version);
      }
      return aplicadas;
    } finally {
      await c.query(`SELECT pg_advisory_unlock(${BLOQUEO_MIGRACIONES})`).catch(() => {});
    }
  });
}

/** Producción: el servicio no altera el esquema; exige que todas las migraciones conocidas estén aplicadas e íntegras. */
export async function exigirEsquemaAlDia(base, migraciones = listarMigraciones()) {
  const hechas = await base.conCliente(leerAplicadas);
  compararHistorial(hechas, migraciones);
  const pendientes = migraciones.filter((m) => !hechas.has(m.version)).map((m) => m.version);
  if (pendientes.length) throw new ErrorBase('esquema', `Migraciones pendientes (${pendientes.join(', ')}): ejecute «npm run migrar» con la credencial de migraciones.`);
}

export async function versionEsquema(base) {
  return (await base.uno('SELECT COALESCE(MAX(version), 0) AS v FROM esquema_migraciones')).v;
}

/** Integridad tras una restauración: filas huérfanas (que las FK deberían impedir) y restricciones sin validar. */
export async function verificarIntegridad(base) {
  const huerfanas = await base.uno(`SELECT
    (SELECT COUNT(*) FROM tokens t WHERE t.usuario_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = t.usuario_id))
  + (SELECT COUNT(*) FROM sesiones_cuenta s WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = s.usuario_id))
  + (SELECT COUNT(*) FROM salas_historial h WHERE NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.id = h.propietario_id))
  + (SELECT COUNT(*) FROM actividades_historial a WHERE NOT EXISTS (SELECT 1 FROM salas_historial h WHERE h.id = a.sala_id)) AS n`);
  const invalidas = await base.uno(`SELECT COUNT(*) AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = current_schema() AND NOT c.convalidated`);
  return { integra: huerfanas.n === 0 && invalidas.n === 0, violacionesFk: huerfanas.n, restriccionesSinValidar: invalidas.n };
}

/** Recuento por tabla: evidencia de restauración (no expone contenido). */
export const TABLAS = Object.freeze(['usuarios', 'tokens', 'sesiones_cuenta', 'auditoria', 'salas_historial', 'actividades_historial']);
export async function recuentos(base) {
  const r = {};
  for (const t of TABLAS) r[t] = (await base.uno(`SELECT COUNT(*) AS n FROM ${t}`)).n; // nombres fijos del código, no del usuario
  return r;
}
