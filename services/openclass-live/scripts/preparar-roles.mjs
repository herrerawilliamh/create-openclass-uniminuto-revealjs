/**
 * Prepara la base y los roles de Interact en PostgreSQL con mínimo privilegio. Idempotente: puede repetirse
 * (y así rota las contraseñas de los roles). Se ejecuta con la credencial de ADMINISTRACIÓN, que no la usa
 * nadie más:
 *   DATABASE_ADMIN_URL=postgres://postgres:…@interact-db:5432/postgres node scripts/preparar-roles.mjs
 * Roles (nombres por omisión; DB_*_ROLE los cambia):
 *   interact_migrador  propietario del esquema: DDL. Solo lo usa scripts/migrar.mjs.
 *   interact_app       la aplicación: SELECT/INSERT/UPDATE/DELETE en las tablas del esquema, nada de DDL.
 *   interact_respaldo  copias de seguridad: solo SELECT.
 * Contraseñas: INTERACT_DB_MIGRATOR_PASSWORD, INTERACT_DB_APP_PASSWORD, INTERACT_DB_BACKUP_PASSWORD (≥ 24 caracteres).
 * Nunca se imprimen. Con PostgreSQL administrado, ejecute este script con la cuenta de administración del proveedor.
 */
import pg from 'pg';
import { fileURLToPath } from 'node:url';

const ID = /^[a-z_][a-z0-9_]{0,62}$/;

export function opcionesDesdeEntorno(env = process.env) {
  const o = {
    adminUrl: env.DATABASE_ADMIN_URL,
    base: env.DB_NAME ?? 'interact',
    esquema: env.DB_SCHEMA ?? 'interact',
    roles: {
      migrador: env.DB_MIGRATOR_ROLE ?? 'interact_migrador',
      app: env.DB_APP_ROLE ?? 'interact_app',
      respaldo: env.DB_BACKUP_ROLE ?? 'interact_respaldo',
    },
    claves: { migrador: env.INTERACT_DB_MIGRATOR_PASSWORD, app: env.INTERACT_DB_APP_PASSWORD, respaldo: env.INTERACT_DB_BACKUP_PASSWORD },
    limites: { migrador: 3, app: Number(env.DB_APP_CONNECTION_LIMIT ?? 25), respaldo: 2 },
  };
  if (!o.adminUrl) throw new Error('DATABASE_ADMIN_URL es obligatoria.');
  for (const n of [o.base, o.esquema, ...Object.values(o.roles)]) if (!ID.test(n)) throw new Error(`Identificador no válido: ${n}`);
  for (const [k, v] of Object.entries(o.claves)) {
    if (typeof v !== 'string' || v.length < 24 || /CAMBIAR/i.test(v)) throw new Error(`Contraseña del rol ${k} ausente o débil (mínimo 24 caracteres aleatorios).`);
  }
  if (!Number.isInteger(o.limites.app) || o.limites.app < 2 || o.limites.app > 200) throw new Error('DB_APP_CONNECTION_LIMIT fuera de rango (2–200).');
  return o;
}

const conectar = async (url, base) => {
  const u = new URL(url);
  if (base) u.pathname = `/${base}`;
  const c = new pg.Client({ connectionString: u.toString() });
  await c.connect();
  return c;
};

export async function prepararRoles(o) {
  const { base, esquema, roles: R, claves, limites } = o;
  const admin = await conectar(o.adminUrl);
  try {
    for (const k of ['migrador', 'app', 'respaldo']) {
      const existe = (await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [R[k]])).rowCount === 1;
      // Sin SUPERUSER, CREATEDB, CREATEROLE ni REPLICATION; contraseñas como literal escapado (no admiten $1).
      const atributos = `LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT ${limites[k]} PASSWORD ${admin.escapeLiteral(claves[k])}`;
      await admin.query(`${existe ? 'ALTER' : 'CREATE'} ROLE ${R[k]} ${existe ? 'WITH ' : ''}${atributos}`);
    }
    const hayBase = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [base])).rowCount === 1;
    if (!hayBase) await admin.query(`CREATE DATABASE ${base} OWNER ${R.migrador} ENCODING 'UTF8' TEMPLATE template0`);
    await admin.query(`REVOKE ALL ON DATABASE ${base} FROM PUBLIC`);
    // Servidor dedicado: los roles de Interact no pueden abrir sesión en la base de mantenimiento.
    // (Con un proveedor administrado la base de administración tiene otro nombre y no se toca.)
    if (new URL(o.adminUrl).pathname === '/postgres' && o.aislarBaseAdmin !== false) {
      await admin.query('REVOKE CONNECT ON DATABASE postgres FROM PUBLIC');
    }
    await admin.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${base} TO ${R.migrador}`);
    await admin.query(`GRANT CONNECT ON DATABASE ${base} TO ${R.app}, ${R.respaldo}`);
  } finally { await admin.end(); }

  const c = await conectar(o.adminUrl, base);
  try {
    await c.query('BEGIN');
    await c.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
    await c.query(`CREATE SCHEMA IF NOT EXISTS ${esquema} AUTHORIZATION ${R.migrador}`);
    await c.query(`ALTER SCHEMA ${esquema} OWNER TO ${R.migrador}`);
    await c.query(`REVOKE ALL ON SCHEMA ${esquema} FROM PUBLIC`);
    await c.query(`GRANT USAGE ON SCHEMA ${esquema} TO ${R.app}, ${R.respaldo}`);
    // Lo que el migrador cree en el esquema nace ya con los permisos mínimos de cada rol.
    await c.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${R.migrador} IN SCHEMA ${esquema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${R.app}`);
    await c.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${R.migrador} IN SCHEMA ${esquema} GRANT USAGE, SELECT ON SEQUENCES TO ${R.app}`);
    await c.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${R.migrador} IN SCHEMA ${esquema} GRANT SELECT ON TABLES TO ${R.respaldo}`);
    await c.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${R.migrador} IN SCHEMA ${esquema} GRANT SELECT ON SEQUENCES TO ${R.respaldo}`);
    for (const r of Object.values(R)) await c.query(`ALTER ROLE ${r} IN DATABASE ${base} SET search_path = ${esquema}`);
    await c.query(`ALTER ROLE ${R.app} IN DATABASE ${base} SET statement_timeout = '15s'`);
    await c.query(`ALTER ROLE ${R.app} IN DATABASE ${base} SET idle_in_transaction_session_timeout = '30s'`);
    await c.query('COMMIT');
  } catch (error) { await c.query('ROLLBACK').catch(() => {}); throw error; } finally { await c.end(); }
  return { base, esquema, roles: R };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const r = await prepararRoles(opcionesDesdeEntorno());
    process.stdout.write(`${JSON.stringify({ preparado: true, ...r })}\n`);
  } catch (error) {
    // Mensaje propio o código de PostgreSQL; nunca la URL ni las contraseñas.
    process.stderr.write(`Preparación fallida: ${error.code ? `PostgreSQL ${error.code}` : error.message}\n`);
    process.exit(1);
  }
}
