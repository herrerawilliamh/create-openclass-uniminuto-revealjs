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
 * Modo (DB_MODO_POSTGRES): «administrado» (por omisión) solo toca recursos de Interact: nunca cambia privilegios de la
 * base de administración ni de ninguna base compartida, y respeta roles/base ya provisionados por el operador.
 * «dedicado» debe elegirse de forma explícita (lo hace el Compose del PostgreSQL propio) y exige SUPERUSER verificable.
 * «externo» (explícito) SOLO VERIFICA recursos que el administrador del servicio ya provisionó: no ejecuta CREATE/ALTER ROLE,
 * CREATE DATABASE, GRANT ni REVOKE, no rota contraseñas (las del entorno deben ser las vigentes) y no toca «postgres».
 * Informa todas las carencias a la vez, sin revelar credenciales. Ver docs/POSTGRES-EXTERNO.md.
 */
import pg from 'pg';
import { leerSsl } from '../src/config.mjs';
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
    modo: (env.DB_MODO_POSTGRES ?? 'administrado').toLowerCase(),
    limites: { migrador: 3, app: Number(env.DB_APP_CONNECTION_LIMIT ?? 25), respaldo: 2 },
  };
  o.ssl = leerSsl(env).ssl; // DB_SSL / DB_SSL_CA_FILE: imprescindible con un PostgreSQL administrado
  if (!['administrado', 'dedicado', 'externo'].includes(o.modo)) throw new Error('DB_MODO_POSTGRES debe ser «administrado», «dedicado» o «externo».');
  if (!o.adminUrl) throw new Error('DATABASE_ADMIN_URL es obligatoria.');
  for (const n of [o.base, o.esquema, ...Object.values(o.roles)]) if (!ID.test(n)) throw new Error(`Identificador no válido: ${n}`);
  for (const [k, v] of Object.entries(o.claves)) {
    if (typeof v !== 'string' || v.length < 24 || /CAMBIAR/i.test(v)) throw new Error(`Contraseña del rol ${k} ausente o débil (mínimo 24 caracteres aleatorios).`);
  }
  if (!Number.isInteger(o.limites.app) || o.limites.app < 2 || o.limites.app > 200) throw new Error('DB_APP_CONNECTION_LIMIT fuera de rango (2–200).');
  return o;
}

const conectar = async (url, base, ssl) => {
  const u = new URL(url);
  if (base) u.pathname = `/${base}`;
  const c = new pg.Client({ connectionString: u.toString(), ssl });
  await c.connect();
  return c;
};

const NIVELES = { migrador: 'migrador', app: 'aplicación', respaldo: 'respaldo' };
const DML = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'];

/** Conexión como un rol de Interact con su propia credencial (la de la configuración). Los errores se reducen a un código. */
async function conectarComo(o, rol, base) {
  const u = new URL(o.adminUrl);
  u.pathname = `/${base}`; u.username = o.roles[rol]; u.password = o.claves[rol];
  const c = new pg.Client({ connectionString: u.toString(), ssl: o.ssl });
  try { await c.connect(); } catch (e) {
    const causa = { '28P01': 'contraseña rechazada', '28000': 'autenticación rechazada', '3D000': 'la base no existe', '42501': 'sin permiso CONNECT' }[e.code] ?? `no conecta (${e.code ?? 'red/TLS'})`;
    throw new Error(causa);
  }
  return c;
}

/**
 * Modo «externo»: solo lectura. Verifica roles, base, esquema y permisos provisionados por el administrador del servicio.
 * No ejecuta ninguna sentencia que cambie roles, bases, esquemas ni privilegios. Lanza un error con TODAS las carencias.
 */
export async function verificarExterno(o) {
  const { base, esquema, roles: R } = o;
  const faltas = [];
  const conexiones = {};
  const ayuda = 'Pida al administrador del servicio que lo provisione (docs/POSTGRES-EXTERNO.md).';
  try {
    for (const k of Object.keys(NIVELES)) {
      try { conexiones[k] = await conectarComo(o, k, base); } catch (e) { faltas.push(`el rol ${R[k]} (${NIVELES[k]}) no puede operar en la base ${base}: ${e.message}`); }
    }
    const c = conexiones.migrador ?? conexiones.app ?? conexiones.respaldo;
    if (!c) throw new Error(`Verificación fallida (modo externo; no se modificó nada): ${faltas.join('; ')}. ${ayuda}`);
    const roles = (await c.query('SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = ANY($1)', [Object.values(R)])).rows;
    for (const k of Object.keys(NIVELES)) {
      const r = roles.find((x) => x.rolname === R[k]);
      if (!r) { faltas.push(`falta el rol ${R[k]}`); continue; }
      if (!r.rolcanlogin) faltas.push(`el rol ${R[k]} no tiene LOGIN`);
      const fuertes = ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'rolreplication', 'rolbypassrls'].filter((a) => r[a]);
      if (fuertes.length) faltas.push(`el rol ${R[k]} tiene atributos privilegiados no permitidos (${fuertes.map((a) => a.slice(3).toUpperCase()).join(', ')})`);
    }
    const sc = (await c.query('SELECT pg_get_userbyid(nspowner) AS dueno FROM pg_namespace WHERE nspname = $1', [esquema])).rows[0];
    if (!sc) faltas.push(`falta el esquema ${esquema} en la base ${base}`);
    else {
      if (sc.dueno !== R.migrador) faltas.push(`el esquema ${esquema} debe pertenecer a ${R.migrador}`);
      const p = async (sql, args) => (await c.query(sql, args)).rows[0].v;
      const esq = (rol, priv) => p('SELECT has_schema_privilege($1, $2, $3) AS v', [rol, esquema, priv]);
      if (!(await esq(R.migrador, 'CREATE'))) faltas.push(`${R.migrador} necesita CREATE en el esquema ${esquema}`);
      for (const k of ['app', 'respaldo']) {
        if (!(await esq(R[k], 'USAGE'))) faltas.push(`${R[k]} necesita USAGE en el esquema ${esquema}`);
        if (await esq(R[k], 'CREATE')) faltas.push(`${R[k]} no debe poder crear objetos en el esquema ${esquema}`);
        if (await p('SELECT has_database_privilege($1, $2, $3) AS v', [R[k], base, 'CREATE'])) faltas.push(`${R[k]} no debe tener CREATE en la base ${base}`);
      }
      // Privilegios por omisión del migrador: lo que cree nace con los permisos mínimos.
      const acl = (await c.query(
        `SELECT d.defaclobjtype AS t, a.privilege_type AS p, pg_get_userbyid(a.grantee) AS g
           FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
          WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = $1)
            AND d.defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = $2)`, [R.migrador, esquema])).rows;
      const tiene = (t, g, priv) => acl.some((x) => x.t === t && x.g === g && x.p === priv);
      for (const priv of DML) if (!tiene('r', R.app, priv)) faltas.push(`faltan privilegios por omisión de ${R.migrador}: ${priv} sobre tablas para ${R.app}`);
      if (!tiene('r', R.respaldo, 'SELECT')) faltas.push(`faltan privilegios por omisión de ${R.migrador}: SELECT sobre tablas para ${R.respaldo}`);
      if (!tiene('S', R.app, 'USAGE') || !tiene('S', R.app, 'SELECT')) faltas.push(`faltan privilegios por omisión de ${R.migrador}: USAGE y SELECT sobre secuencias para ${R.app}`);
      if (!tiene('S', R.respaldo, 'SELECT')) faltas.push(`faltan privilegios por omisión de ${R.migrador}: SELECT sobre secuencias para ${R.respaldo}`);
      for (const x of acl) if (x.g === R.respaldo && x.p !== 'SELECT') faltas.push(`${R.respaldo} tiene ${x.p} por omisión: solo debe poder leer`);
      // search_path por rol y base: sin él las migraciones crearían objetos fuera del esquema y la aplicación no los vería.
      const ajustes = (await c.query(
        `SELECT r.rolname, s.setconfig FROM pg_db_role_setting s JOIN pg_roles r ON r.oid = s.setrole JOIN pg_database d ON d.oid = s.setdatabase
          WHERE d.datname = $1 AND r.rolname = ANY($2)`, [base, Object.values(R)])).rows;
      for (const k of Object.keys(NIVELES)) {
        const cfg = ajustes.find((x) => x.rolname === R[k])?.setconfig ?? [];
        if (!cfg.some((v) => v.replace(/\s/g, '').replace(/"/g, '') === `search_path=${esquema}`)) faltas.push(`el rol ${R[k]} necesita search_path = ${esquema} en la base ${base} (ALTER ROLE … IN DATABASE … SET search_path)`);
      }
      // Objetos ya existentes en el esquema.
      const tablas = (await c.query("SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind IN ('r','p')", [esquema])).rows;
      for (const { relname } of tablas) {
        const q = `${esquema}.${relname}`;
        const ok = (rol, priv) => p('SELECT has_table_privilege($1, $2, $3) AS v', [rol, q, priv]);
        // `migrar` restringe a propósito DML en auditoria y esquema_migraciones: aquí solo se exige lectura.
        if (!(await ok(R.app, 'SELECT'))) faltas.push(`${R.app} necesita SELECT sobre ${q}`);
        if (!(await ok(R.respaldo, 'SELECT'))) faltas.push(`${R.respaldo} necesita SELECT sobre ${q}`);
        for (const priv of ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) if (await ok(R.respaldo, priv)) faltas.push(`${R.respaldo} no debe tener ${priv} sobre ${q}`);
        for (const priv of ['TRUNCATE', 'REFERENCES', 'TRIGGER']) if (await ok(R.app, priv)) faltas.push(`${R.app} no debe tener ${priv} sobre ${q}`);
      }
    }
  } finally { await Promise.all(Object.values(conexiones).map((x) => x.end().catch(() => {}))); }
  if (faltas.length) throw new Error(`Verificación fallida (modo externo; no se modificó nada): ${[...new Set(faltas)].join('; ')}. ${ayuda}`);
  return { base, esquema, roles: R, modo: 'externo', verificado: true };
}

export async function prepararRoles(o) {
  if (o.modo === 'externo') return verificarExterno(o);
  const { base, esquema, roles: R, claves, limites } = o;
  const admin = await conectar(o.adminUrl, undefined, o.ssl);
  try {
    const dedicado = o.modo === 'dedicado';
    const yo = (await admin.query('SELECT rolsuper, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user')).rows[0] ?? {};
    // El aislamiento de la base de mantenimiento solo existe si se eligió el modo dedicado y se verifica SUPERUSER.
    if (dedicado && !yo.rolsuper) throw new Error('El modo dedicado exige una cuenta de administración con SUPERUSER.');
    const puedeRoles = yo.rolsuper || yo.rolcreaterole;
    const sinPrivilegio = (que) => new Error(`La cuenta de administración no tiene privilegios para ${que}; pida al proveedor que lo provisione.`);
    for (const k of ['migrador', 'app', 'respaldo']) {
      const existe = (await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [R[k]])).rowCount === 1;
      if (!existe && !puedeRoles) throw sinPrivilegio(`crear el rol ${R[k]}`);
      if (existe && !puedeRoles) throw sinPrivilegio(`configurar el rol ${R[k]} (CREATEROLE)`);
      // Sin SUPERUSER, CREATEDB, CREATEROLE ni REPLICATION; contraseñas como literal escapado (no admiten $1).
      // Sin SUPERUSER, un administrador no puede tocar atributos que no posee (PostgreSQL 16): se usan los valores por
      // omisión de CREATE ROLE y se VERIFICA después que el rol no tiene privilegios.
      const nivel = yo.rolsuper ? 'LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS' : 'LOGIN';
      const atributos = `${nivel} CONNECTION LIMIT ${limites[k]} PASSWORD ${admin.escapeLiteral(claves[k])}`;
      await admin.query(`${existe ? 'ALTER' : 'CREATE'} ROLE ${R[k]} ${existe ? 'WITH ' : ''}${atributos}`);
    }
    const fuertes = await admin.query(
      'SELECT rolname FROM pg_roles WHERE rolname = ANY($1) AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)', [Object.values(R)]);
    if (fuertes.rowCount) throw new Error(`Los roles de Interact no deben tener atributos privilegiados: ${fuertes.rows.map((r) => r.rolname).join(', ')}.`);
    const hayBase = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [base])).rowCount === 1;
    if (!hayBase) {
      if (!yo.rolsuper && !yo.rolcreatedb) throw sinPrivilegio(`crear la base ${base}`);
      if (!yo.rolsuper) await admin.query(`GRANT ${R.migrador} TO CURRENT_USER`).catch(() => { throw sinPrivilegio(`crear la base ${base} con propietario ${R.migrador}`); });
      await admin.query(`CREATE DATABASE ${base} OWNER ${R.migrador} ENCODING 'UTF8' TEMPLATE template0`);
    }
    await admin.query(`REVOKE ALL ON DATABASE ${base} FROM PUBLIC`);
    // Solo servidor dedicado y elegido explícitamente: los roles de Interact no abren sesión en la base de mantenimiento.
    // Nunca se infiere del nombre de la URL: en un proveedor administrado esa base es compartida y no se toca.
    if (dedicado) await admin.query('REVOKE CONNECT ON DATABASE postgres FROM PUBLIC');
    await admin.query(`GRANT CONNECT, TEMPORARY ON DATABASE ${base} TO ${R.migrador}`);
    await admin.query(`GRANT CONNECT ON DATABASE ${base} TO ${R.app}, ${R.respaldo}`);
  } finally { await admin.end(); }

  const c = await conectar(o.adminUrl, base, o.ssl);
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
