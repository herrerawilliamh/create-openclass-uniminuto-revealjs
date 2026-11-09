/**
 * Interact: base de datos SQLite persistente (módulo integrado `node:sqlite`, sin dependencias nativas).
 * - Migraciones versionadas (`src/migraciones/NNN-nombre.sql`), aplicadas en orden y dentro de una transacción.
 * - WAL (con rutas reales), claves foráneas activas y espera ante bloqueos.
 * - Copias de seguridad consistentes con `VACUUM INTO` (rotación por cantidad).
 * Toda la persistencia pasa por funciones del dominio: pasar a PostgreSQL implica reescribir solo esta capa
 * y las consultas de cuentas.mjs / historial.mjs, no el dominio de salas.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRACIONES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migraciones');

export function listarMigraciones(dir = MIGRACIONES) {
  return readdirSync(dir).filter((f) => /^\d{3}-[a-z0-9-]+\.sql$/.test(f)).sort()
    .map((f) => ({ version: Number(f.slice(0, 3)), nombre: f.slice(4, -4), sql: readFileSync(path.join(dir, f), 'utf8') }));
}

export function transaccion(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try { const r = fn(); db.exec('COMMIT'); return r; } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function migrar(db, migraciones = listarMigraciones()) {
  db.exec('CREATE TABLE IF NOT EXISTS migraciones (version INTEGER PRIMARY KEY, nombre TEXT NOT NULL, aplicada INTEGER NOT NULL)');
  const hechas = new Set(db.prepare('SELECT version FROM migraciones').all().map((f) => f.version));
  const maxima = Math.max(0, ...hechas);
  const aplicadas = [];
  for (const m of migraciones) {
    if (hechas.has(m.version)) continue;
    if (m.version < maxima) throw new Error(`Migración ${m.version} intercalada antes de la ${maxima}: el historial debe ser lineal.`);
    transaccion(db, () => {
      db.exec(m.sql);
      db.prepare('INSERT INTO migraciones (version, nombre, aplicada) VALUES (?, ?, ?)').run(m.version, m.nombre, Date.now());
    });
    aplicadas.push(m.version);
  }
  return aplicadas;
}

/** Abre (y crea) la base. `ruta` = ':memory:' solo en pruebas. */
export function abrirBase(ruta) {
  const enMemoria = ruta === ':memory:';
  if (!enMemoria) mkdirSync(path.dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  if (!enMemoria) db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  migrar(db);
  return db;
}

export function versionEsquema(db) {
  return db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM migraciones').get().v;
}

export function verificarIntegridad(db) {
  const ok = db.prepare('PRAGMA integrity_check').get();
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  return { integra: Object.values(ok)[0] === 'ok' && fk.length === 0, violacionesFk: fk.length };
}

/** Copia consistente en caliente. Conserva las `conservar` más recientes. Devuelve la ruta creada. */
export function respaldar(db, dirDestino, { conservar = 7, ahora = new Date() } = {}) {
  mkdirSync(dirDestino, { recursive: true });
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let destino = path.join(dirDestino, `interact-${sello}.sqlite`);
  for (let n = 1; statSyncSeguro(destino); n++) destino = path.join(dirDestino, `interact-${sello}-${n}.sqlite`);
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  const copias = readdirSync(dirDestino).filter((f) => /^interact-.*\.sqlite$/.test(f)).sort();
  for (const vieja of copias.slice(0, Math.max(0, copias.length - conservar))) rmSync(path.join(dirDestino, vieja), { force: true });
  return destino;
}
const statSyncSeguro = (p) => { try { return statSync(p); } catch { return null; } };
