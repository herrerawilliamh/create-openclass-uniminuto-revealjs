/**
 * Utilidades para invocar pg_dump / pg_restore sin exponer credenciales:
 * - la contraseña viaja en PGPASSWORD (entorno del proceso hijo), nunca en la línea de órdenes (visible en `ps`);
 * - sin shell (spawn con argumentos), sin interpolación de rutas;
 * - PG_BIN permite fijar la carpeta de los binarios (deben ser de una versión ≥ a la del servidor).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

export function entornoPg(url, base = process.env) {
  let u;
  try { u = new URL(url); } catch { throw new Error('URL de PostgreSQL no válida.'); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol)) throw new Error('URL de PostgreSQL no válida.');
  const env = {
    PATH: base.PATH ?? base.Path ?? '', SystemRoot: base.SystemRoot, // mínimo para ejecutar en Linux y Windows
    PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password), PGDATABASE: decodeURIComponent(u.pathname.slice(1)),
    PGCONNECT_TIMEOUT: '10', PGAPPNAME: 'interact-respaldo',
  };
  // DB_SSL (el mismo vocabulario que el servicio) manda sobre ?sslmode: verificado = verify-full (cadena + nombre de host).
  const porModo = { requerido: 'require', verificado: 'verify-full' }[base.DB_SSL ?? ''];
  const sslmode = porModo ?? u.searchParams.get('sslmode') ?? base.PGSSLMODE;
  if (sslmode) env.PGSSLMODE = sslmode;
  if (base.DB_SSL_CA_FILE) env.PGSSLROOTCERT = base.DB_SSL_CA_FILE;
  return Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined));
}

export const binario = (nombre, env = process.env) => (env.PG_BIN ? path.join(env.PG_BIN, nombre) : nombre);

/** Ejecuta y devuelve { codigo, salida, errores }. Los errores se recortan: pueden citar el host, nunca la contraseña. */
export function ejecutar(bin, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    const out = []; const err = [];
    p.stdout.on('data', (d) => out.push(d));
    p.stderr.on('data', (d) => err.push(d));
    p.on('error', (e) => reject(Object.assign(new Error(`No se pudo ejecutar ${path.basename(bin)} (¿instalado? defina PG_BIN).`), { code: e.code })));
    p.on('close', (codigo) => resolve({ codigo, salida: Buffer.concat(out).toString('utf8'), errores: Buffer.concat(err).toString('utf8').slice(0, 2000) }));
  });
}

/** Versión mayor de un binario de PostgreSQL (pg_dump --version → 16). */
export async function versionMayor(bin, env) {
  const r = await ejecutar(bin, ['--version'], env);
  const m = /(\d+)(?:\.\d+)?/.exec(r.salida);
  return m ? Number(m[1]) : null;
}
