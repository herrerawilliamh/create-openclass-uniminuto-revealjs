/**
 * Interact 0.4.0 sobre PostgreSQL REAL: migraciones, concurrencia, transacciones, consumo único de tokens,
 * revocación, permisos por rol (mínimo privilegio), aislamiento entre docentes, caída y recuperación de la base.
 * Requiere INTERACT_TEST_DATABASE_URL con un usuario capaz de crear bases y roles (servicio de pruebas o CI).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import pg from 'pg';
import { abrirBase, listarMigraciones, migrar, versionEsquema } from '../src/db.mjs';
import { crearCuentas, ErrorCuenta } from '../src/cuentas.mjs';
import { crearHistorial } from '../src/historial.mjs';
import { prepararRoles } from '../scripts/preparar-roles.mjs';
import { ejecutarMigraciones } from '../scripts/migrar.mjs';
import { borrarEsquema, conCliente, iniciar, nuevoEsquema, pedir, urlPrueba } from './ayuda.mjs';

const ADMIN = { email: 'admin@willedtech.test', password: 'clave-admin-larga-2026' };
const clave = () => randomBytes(24).toString('base64url');
const conUsuario = (usuario, password, base) => { const u = new URL(urlPrueba()); u.username = usuario; u.password = password; u.pathname = `/${base}`; return u.toString(); };

async function baseEnEsquema() {
  const esquema = nuevoEsquema();
  const base = await abrirBase({ url: urlPrueba(), esquema, max: 12, esperaMs: 5000 });
  return { esquema, base, cerrar: async () => { await base.cerrar(); await borrarEsquema(esquema); } };
}

test('migraciones: versionadas, repetibles, concurrentes y verificables (una migración aplicada no puede cambiar)', async () => {
  const esquema = nuevoEsquema();
  // Cuatro arranques simultáneos sobre un esquema vacío: el bloqueo consultivo serializa; una sola aplicación.
  const bases = await Promise.all([1, 2, 3, 4].map(() => abrirBase({ url: urlPrueba(), esquema, max: 2, esperaMs: 5000 })));
  try {
    const filas = await bases[0].q('SELECT version, nombre, checksum FROM esquema_migraciones');
    assert.equal(filas.length, listarMigraciones().length);
    assert.equal(await versionEsquema(bases[0]), 1);
    assert.deepEqual(await migrar(bases[0]), [], 'repetir no aplica nada');
    // Suma alterada: el servicio se niega a continuar.
    const alterada = listarMigraciones().map((m) => ({ ...m, checksum: 'f'.repeat(64) }));
    await assert.rejects(migrar(bases[0], alterada), /cambió después de aplicarse/);
    // Producción: con todo aplicado arranca en modo «verificar» sin tocar el esquema.
    const verif = await abrirBase({ url: urlPrueba(), esquema, max: 1, migraciones: 'verificar', esperaMs: 5000 });
    await verif.cerrar();
    // Esquema vacío en modo «verificar»: se niega (no crea tablas).
    await assert.rejects(abrirBase({ url: urlPrueba(), esquema: nuevoEsquema(), max: 1, migraciones: 'verificar', esperaMs: 2000 }), /pendientes|esquema/i);
    // Tipos: booleanos nativos, jsonb y unicidad del correo sin distinguir mayúsculas.
    const tipos = Object.fromEntries((await bases[0].q(`SELECT table_name || '.' || column_name AS c, data_type FROM information_schema.columns
      WHERE table_schema = $1 AND column_name IN ('email_verificado', 'opciones', 'rondas', 'creado', 'id')`, [esquema])).map((f) => [f.c, f.data_type]));
    assert.equal(tipos['usuarios.email_verificado'], 'boolean');
    assert.equal(tipos['actividades_historial.opciones'], 'jsonb');
    assert.equal(tipos['auditoria.id'], 'bigint');
    await bases[0].exec("INSERT INTO usuarios (id, email, rol, hash, creado) VALUES ('u1', 'ana@uni.test', 'docente', 'scrypt$x', 1)");
    await assert.rejects(bases[0].exec("INSERT INTO usuarios (id, email, rol, hash, creado) VALUES ('u2', 'ANA@uni.test', 'docente', 'scrypt$x', 1)"), (e) => e.code === '23514' || e.code === '23505');
    await assert.rejects(bases[0].exec("INSERT INTO usuarios (id, email, rol, hash, creado) VALUES ('u3', 'otra@uni.test', 'root', 'scrypt$x', 1)"), (e) => e.code === '23514');
  } finally {
    for (const b of bases) await b.cerrar();
    await borrarEsquema(esquema);
  }
});

test('tokens de un solo uso bajo concurrencia real: diez aceptaciones simultáneas producen una sola cuenta', async () => {
  const { base, cerrar } = await baseEnEsquema();
  try {
    const cuentas = crearCuentas(base);
    const su = await cuentas.crearSuperusuario(ADMIN);
    const inv = await cuentas.invitar({ actorId: su.id, email: 'carrera@uni.test' });
    const r = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => cuentas.aceptarInvitacion(inv.token, { nombre: `N${i}`, password: `clave-carrera-larga-${i}` })));
    const ok = r.filter((x) => x.status === 'fulfilled');
    assert.equal(ok.length, 1, 'exactamente una aceptación');
    for (const x of r.filter((y) => y.status === 'rejected')) assert.ok(x.reason instanceof ErrorCuenta && x.reason.codigo === 'token', String(x.reason));
    assert.equal((await base.uno("SELECT COUNT(*) AS n FROM usuarios WHERE email = 'carrera@uni.test'")).n, 1);
    // Verificación del correo: también una sola vez aunque lleguen dos clics a la vez.
    const v = ok[0].value.tokenVerificacion;
    const dobles = await Promise.allSettled([cuentas.verificarCorreo(v), cuentas.verificarCorreo(v), cuentas.verificarCorreo(v)]);
    assert.equal(dobles.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal((await base.uno("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'correo_verificado'")).n, 1, 'un único efecto auditado');
    // Recuperación: dos restablecimientos simultáneos con el mismo enlace → uno.
    const rec = await cuentas.solicitarRecuperacion('carrera@uni.test');
    const rs = await Promise.allSettled([cuentas.restablecerPassword(rec.token, 'nueva-clave-larga-a1'), cuentas.restablecerPassword(rec.token, 'nueva-clave-larga-b2')]);
    assert.equal(rs.filter((x) => x.status === 'fulfilled').length, 1);
  } finally { await cerrar(); }
});

test('revocación frente a aceptación simultáneas: nunca ambas; superusuario único aunque se inicialice en paralelo', async () => {
  const { base, cerrar } = await baseEnEsquema();
  try {
    const cuentas = crearCuentas(base);
    const sus = await Promise.allSettled(['a', 'b', 'c', 'd', 'e'].map((x) => cuentas.crearSuperusuario({ email: `${x}@root.test`, password: 'clave-super-larga-2026' })));
    assert.equal(sus.filter((x) => x.status === 'fulfilled').length, 1, 'un solo superusuario');
    const su = sus.find((x) => x.status === 'fulfilled').value;
    for (let i = 0; i < 10; i++) {
      const inv = await cuentas.invitar({ actorId: su.id, email: `rev${i}@uni.test` });
      const [acepta, revoca] = await Promise.allSettled([
        cuentas.aceptarInvitacion(inv.token, { nombre: 'R', password: 'clave-revocacion-larga' }),
        cuentas.revocarInvitacion(inv.id, su.id),
      ]);
      assert.equal([acepta, revoca].filter((x) => x.status === 'fulfilled').length, 1, `ronda ${i}: exactamente una gana`);
      const t = await base.uno('SELECT usado, revocado FROM tokens WHERE id = $1', [inv.id]);
      assert.ok((t.usado === null) !== (t.revocado === null), 'el token queda usado O revocado, nunca ambos');
      const cuenta = await base.uno('SELECT COUNT(*) AS n FROM usuarios WHERE email = $1', [`rev${i}@uni.test`]);
      assert.equal(cuenta.n, acepta.status === 'fulfilled' ? 1 : 0, 'sin cuenta huérfana tras una revocación ganadora');
    }
  } finally { await cerrar(); }
});

test('transacción atómica: si falla un paso intermedio, la invitación NO queda consumida ni la cuenta creada', async () => {
  const { esquema, base, cerrar } = await baseEnEsquema();
  try {
    const cuentas = crearCuentas(base);
    const su = await cuentas.crearSuperusuario(ADMIN);
    const inv = await cuentas.invitar({ actorId: su.id, email: 'atomica@uni.test' });
    // Fallo inyectado DENTRO de PostgreSQL al emitir el token de verificación (paso posterior al consumo).
    await conCliente(esquema, async (c) => {
      await c.query(`CREATE FUNCTION falla_verificacion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo inyectado'; END $$`);
      await c.query("CREATE TRIGGER t_falla BEFORE INSERT ON tokens FOR EACH ROW WHEN (NEW.tipo = 'verificacion') EXECUTE FUNCTION falla_verificacion()");
    });
    await assert.rejects(cuentas.aceptarInvitacion(inv.token, { nombre: 'A', password: 'clave-atomica-larga-1' }), /fallo inyectado/);
    assert.equal((await base.uno('SELECT usado FROM tokens WHERE id = $1', [inv.id])).usado, null, 'consumo revertido');
    assert.equal((await base.uno("SELECT COUNT(*) AS n FROM usuarios WHERE email = 'atomica@uni.test'")).n, 0, 'cuenta revertida');
    assert.equal((await base.uno("SELECT COUNT(*) AS n FROM auditoria WHERE accion = 'invitacion_aceptada'")).n, 0, 'auditoría revertida');
    await conCliente(esquema, (c) => c.query('DROP TRIGGER t_falla ON tokens'));
    const r = await cuentas.aceptarInvitacion(inv.token, { nombre: 'A', password: 'clave-atomica-larga-1' });
    assert.equal(r.usuario.email, 'atomica@uni.test', 'la misma invitación sigue siendo válida tras el fallo');
  } finally { await cerrar(); }
});

test('aislamiento entre docentes en la capa SQL: detalle, borrado y puntos de control llevan al propietario en la consulta', async () => {
  const { base, cerrar } = await baseEnEsquema();
  try {
    const cuentas = crearCuentas(base);
    const su = await cuentas.crearSuperusuario(ADMIN);
    const crear = async (email) => {
      const inv = await cuentas.invitar({ actorId: su.id, email });
      const { usuario } = await cuentas.aceptarInvitacion(inv.token, { nombre: email, password: 'clave-docente-larga-1' });
      return usuario.id;
    };
    const a = await crear('a@uni.test');
    const b = await crear('b@uni.test');
    const h = crearHistorial(base);
    const resumen = (propietarioId, titulo) => ({ id: 'sala-a', propietarioId, titulo, creada: 1, participantes: 3, preguntas: 0,
      actividades: [{ id: 'e1', orden: 0, enunciado: '¿?', tipo: 'unica', opciones: ['x', 'y'], rondas: [{ conteos: [2, 1] }], resultadosPublicados: true, correctaRevelada: false }] });
    await h.abrir(resumen(a, 'De A'));
    await h.cerrar(resumen(a, 'De A'), 'finalizada');
    assert.equal(await h.detalle('sala-a', { propietarioId: b }), null);
    assert.equal(await h.eliminar('sala-a', { propietarioId: b }), false);
    // Un punto de control con el mismo id y otro propietario no reasigna ni reescribe la sala.
    await h.checkpoint(resumen(b, 'Secuestrada'));
    const d = await h.detalle('sala-a', { propietarioId: a });
    assert.equal(d.titulo, 'De A');
    assert.equal(d.propietarioId, a);
    assert.deepEqual(d.actividades[0].rondas, [{ conteos: [2, 1] }], 'jsonb ida y vuelta');
    // Un punto de control tardío del propietario (capturado antes del cierre) no reabre la sala.
    await h.checkpoint({ ...resumen(a, 'De A'), titulo: 'Tardío' });
    const tras = await h.detalle('sala-a', { propietarioId: a });
    assert.equal(tras.estado, 'finalizada');
    assert.equal(tras.titulo, 'De A');
    // Y un cierre y un punto de control simultáneos terminan siempre en «finalizada».
    for (let i = 0; i < 5; i++) {
      const id = `carrera-${i}`;
      const r = { ...resumen(a, 'C'), id };
      await h.abrir(r);
      await Promise.all([h.checkpoint(r), h.cerrar(r, 'finalizada'), h.checkpoint(r)]);
      assert.equal((await h.detalle(id, { propietarioId: a })).estado, 'finalizada', `carrera ${i}`);
    }
    assert.equal((await h.listar({ propietarioId: b })).total, 0);
    assert.equal((await h.listar({ q: '%' })).total, 0, 'comodines escapados en ILIKE');
    assert.equal(await h.eliminar('sala-a', { propietarioId: a }), true);
  } finally { await cerrar(); }
});

test('mínimo privilegio: la aplicación no tiene DDL ni puede alterar migraciones o auditoría; el respaldo solo lee', async (t) => {
  const sufijo = randomBytes(4).toString('hex');
  const base = `interact_p2_${sufijo}_test`;
  const R = { migrador: `m_${sufijo}`, app: `a_${sufijo}`, respaldo: `r_${sufijo}` };
  const C = { migrador: clave(), app: clave(), respaldo: clave() };
  t.after(async () => {
    await conCliente(null, async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${base} WITH (FORCE)`);
      for (const r of Object.values(R)) await c.query(`DROP ROLE IF EXISTS ${r}`);
    });
  });
  await prepararRoles({ adminUrl: urlPrueba(), base, esquema: 'interact', roles: R, claves: C, limites: { migrador: 3, app: 10, respaldo: 2 } });
  // Repetible: una segunda preparación (rotación de contraseñas) no falla.
  C.app = clave();
  await prepararRoles({ adminUrl: urlPrueba(), base, esquema: 'interact', roles: R, claves: C, limites: { migrador: 3, app: 10, respaldo: 2 } });
  const mig = await ejecutarMigraciones({ DATABASE_MIGRATION_URL: conUsuario(R.migrador, C.migrador, base), DB_APP_ROLE: R.app });
  assert.deepEqual(mig.aplicadas, [1]);
  assert.equal(mig.permisosAjustados, true);
  assert.deepEqual((await ejecutarMigraciones({ DATABASE_MIGRATION_URL: conUsuario(R.migrador, C.migrador, base), DB_APP_ROLE: R.app })).aplicadas, [], 'idempotente');

  const conectar = async (rol) => { const c = new pg.Client({ connectionString: conUsuario(R[rol], C[rol], base) }); await c.connect(); return c; };
  const denegado = (p) => assert.rejects(p, (e) => e.code === '42501', 'permiso denegado (42501)');
  const app = await conectar('app');
  try {
    assert.equal((await app.query('SELECT current_schema() AS s')).rows[0].s, 'interact', 'search_path del rol');
    // La aplicación arranca en modo producción (verificar) con su credencial.
    const servicio = await abrirBase({ url: conUsuario(R.app, C.app, base), migraciones: 'verificar', max: 1, esperaMs: 3000 });
    await crearCuentas(servicio).crearSuperusuario(ADMIN);
    await servicio.cerrar();
    await denegado(app.query('CREATE TABLE intrusa (x int)'));
    await denegado(app.query('CREATE SCHEMA intruso'));
    await denegado(app.query('ALTER TABLE usuarios ADD COLUMN x int'));
    await denegado(app.query('DROP TABLE auditoria'));
    await denegado(app.query('TRUNCATE usuarios'));
    await denegado(app.query("INSERT INTO esquema_migraciones (version, nombre, checksum) VALUES (99, 'x', repeat('a', 64))"));
    await denegado(app.query('DELETE FROM esquema_migraciones'));
    await denegado(app.query("UPDATE auditoria SET accion = 'borrado'"));
    await denegado(app.query('SELECT * FROM pg_authid'));
    await denegado(app.query(`SET ROLE ${R.migrador}`));
    // Lo que sí necesita: DML de dominio, inserción y purga de auditoría.
    await app.query("INSERT INTO auditoria (ts, accion) VALUES (1, 'prueba')");
    assert.equal((await app.query('DELETE FROM auditoria WHERE ts = 1')).rowCount, 1);
    assert.equal((await app.query('SELECT COUNT(*)::int AS n FROM esquema_migraciones')).rows[0].n, 1, 'lectura del registro de migraciones');
  } finally { await app.end(); }
  const respaldo = await conectar('respaldo');
  try {
    assert.ok((await respaldo.query('SELECT COUNT(*) FROM usuarios')).rowCount === 1);
    await denegado(respaldo.query("INSERT INTO auditoria (ts, accion) VALUES (1, 'x')"));
    await denegado(respaldo.query('DELETE FROM usuarios'));
  } finally { await respaldo.end(); }
  // Credencial rotada: la contraseña anterior ya no entra.
  await assert.rejects((async () => { const c = new pg.Client({ connectionString: conUsuario(R.app, 'contrasena-anterior-invalida', base) }); await c.connect(); })(), (e) => e.code === '28P01');
});

/** Proxy TCP controlable entre la aplicación y PostgreSQL: simula una caída y un reinicio de la base. */
async function proxyPg() {
  const destino = new URL(urlPrueba());
  const sockets = new Set();
  let servidor = null;
  const abrir = (puerto = 0) => new Promise((r, rechazar) => {
    if (servidor) return r(servidor.address().port);
    servidor = net.createServer((c) => {
      const u = net.connect(Number(destino.port || 5432), destino.hostname);
      sockets.add(c); sockets.add(u);
      c.on('error', () => {}); u.on('error', () => {});
      c.on('close', () => u.destroy()); u.on('close', () => c.destroy());
      c.pipe(u).pipe(c);
    });
    servidor.once('error', rechazar);
    servidor.listen(puerto, '127.0.0.1', () => r(servidor.address().port));
  });
  const puerto = await abrir();
  const url = new URL(urlPrueba()); url.hostname = '127.0.0.1'; url.port = String(puerto);
  return {
    url: url.toString(),
    caer: () => new Promise((r) => {
      const s0 = servidor; servidor = null;
      for (const s of sockets) s.destroy();
      sockets.clear();
      s0.close(() => r());
    }),
    volver: () => abrir(puerto),
  };
}

test('caída y reinicio de PostgreSQL: errores seguros (503 sin detalles) y recuperación sin reiniciar el servicio', async () => {
  const p = await proxyPg();
  const ctx = await iniciar({ env: { DATABASE_URL: p.url, ADMIN_PASSWORD_HASH: '' } });
  try {
    await ctx.app.cuentas.crearSuperusuario(ADMIN);
    const login = await ctx.peticion('/api/auth/login', { metodo: 'POST', cuerpo: ADMIN });
    assert.equal(login.estado, 200);
    const cookie = login.cabeceras['set-cookie'][0].split(';')[0];
    assert.equal((await ctx.peticion('/healthz')).estado, 200);

    await p.caer();
    const salud = await ctx.peticion('/healthz');
    assert.equal(salud.estado, 503);
    assert.deepEqual(salud.json, { estado: 'degradado' });
    const yo = await ctx.peticion('/api/yo', { cabeceras: { cookie } });
    assert.equal(yo.estado, 503);
    assert.deepEqual(yo.json, { error: 'no_disponible' }, 'sin host, usuario, SQL ni traza');
    assert.equal(yo.cabeceras['retry-after'], '5');
    assert.ok(!ctx.lineas.join('\n').includes(new URL(urlPrueba()).password), 'el registro nunca contiene la contraseña');

    await p.volver();
    let estado = 0;
    for (let i = 0; i < 20 && estado !== 200; i++) { estado = (await ctx.peticion('/api/yo', { cabeceras: { cookie } })).estado; if (estado !== 200) await new Promise((r) => setTimeout(r, 150)); }
    assert.equal(estado, 200, 'la sesión persistida sigue válida tras el reinicio de la base');
    assert.equal((await ctx.peticion('/healthz')).estado, 200);
  } finally {
    await p.volver().catch(() => {});
    await ctx.cerrar();
    await p.caer();
  }
});

test('Socket.IO asíncrono: un evento del panel emitido al conectar (antes de «sesion») no se pierde', async () => {
  const ctx = await iniciar();
  try {
    const { cookie } = await ctx.login();
    for (let i = 0; i < 5; i++) {
      // emitWithAck se encola antes del «connect»: el servidor lo recibe mientras revalida la sesión en la base.
      const s = ctx.conectar('/docente', { cabeceras: { cookie } });
      const r = await pedir(s, 'sala:listar', {}, 4000);
      assert.equal(r.ok, true, `intento ${i}: ${r.mensaje ?? ''}`);
      s.disconnect();
    }
    // Con la sesión revocada, el mismo evento temprano se rechaza (la puerta falla cerrada).
    const s = ctx.conectar('/docente', { cabeceras: { cookie } });
    await ctx.app.sesiones.revocar(ctx.app.firmador.verificar(cookie.split('=')[1], 'docente').sid);
    const r = await pedir(s, 'sala:listar', {}, 4000).catch(() => ({ ok: false }));
    assert.equal(r.ok, false);
  } finally { await ctx.cerrar(); }
});

test('arranque sin base disponible: falla con un error genérico que no revela la URL ni la contraseña', async () => {
  const cerrado = await new Promise((r) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => r(port)); }); });
  const url = `postgres://interact_app:contrasena-muy-secreta-123@127.0.0.1:${cerrado}/interact`;
  await assert.rejects(abrirBase({ url, max: 1, esperaMs: 300 }), (e) => {
    assert.equal(e.name, 'ErrorBase');
    assert.equal(e.codigo, 'no_disponible');
    assert.ok(!e.message.includes('contrasena-muy-secreta') && !e.message.includes(String(cerrado)));
    return true;
  });
});
