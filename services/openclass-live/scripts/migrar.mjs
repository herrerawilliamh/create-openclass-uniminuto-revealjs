/**
 * Aplica las migraciones pendientes con la credencial de MIGRACIONES (propietaria del esquema).
 *   DATABASE_MIGRATION_URL=postgres://interact_migrador:…@interact-db:5432/interact node scripts/migrar.mjs
 * Idempotente y segura ante ejecuciones simultáneas (bloqueo consultivo en db.mjs). Después ajusta los permisos
 * que los privilegios por defecto no expresan (DB_APP_ROLE, por omisión interact_app):
 *   - el registro de migraciones es de solo lectura para la aplicación;
 *   - la auditoría es de solo inserción para la aplicación (además de la purga por antigüedad: DELETE).
 * Salida: JSON con las versiones aplicadas y la versión resultante. Nunca imprime la URL.
 */
import { fileURLToPath } from 'node:url';
import { abrirBase, migrar, versionEsquema } from '../src/db.mjs';
import { leerBase } from '../src/config.mjs';

export async function ejecutarMigraciones(env = process.env) {
  const cfg = leerBase({ ...env, DB_MIGRATIONS: 'verificar' }, false, 'DATABASE_MIGRATION_URL');
  const rolApp = env.DB_APP_ROLE ?? 'interact_app';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(rolApp)) throw new Error('DB_APP_ROLE no es un identificador válido.');
  // `migraciones: 'auto'` abre el pool y migra dentro de abrirBase; aquí se hace explícito para informar lo aplicado.
  const base = await abrirBase({ url: cfg.url, esquema: cfg.esquema, ssl: cfg.ssl, max: 2, esperaMs: cfg.esperaMs, migraciones: 'ninguna', aplicacion: 'interact-migrar' });
  try {
    const aplicadas = await migrar(base);
    const existeRol = await base.uno('SELECT 1 AS x FROM pg_roles WHERE rolname = $1', [rolApp]);
    if (existeRol) {
      await base.exec(`REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON esquema_migraciones FROM ${rolApp}`);
      await base.exec(`GRANT SELECT ON esquema_migraciones TO ${rolApp}`);
      await base.exec(`REVOKE UPDATE, TRUNCATE ON auditoria FROM ${rolApp}`);
    }
    return { aplicadas, version: await versionEsquema(base), permisosAjustados: Boolean(existeRol) };
  } finally { await base.cerrar(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.stdout.write(`${JSON.stringify(await ejecutarMigraciones())}\n`);
  } catch (error) {
    process.stderr.write(`Migración fallida: ${error.name === 'ErrorBase' || !error.code ? error.message : `PostgreSQL ${error.code}`}\n`);
    process.exit(1);
  }
}
