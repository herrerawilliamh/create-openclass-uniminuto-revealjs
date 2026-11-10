/**
 * GATE 3 / P2-4: respaldo y restauración OPERATIVA completa con pg_dump / pg_restore reales.
 * Se respalda un esquema con datos de todos los tipos, se restaura en una base *_restauracion nueva y vacía
 * (nunca sobre datos reales) y se arranca el servicio sobre la copia restaurada para comprobar que funcionan:
 * contraseñas protegidas (login), roles, invitaciones pendientes y revocadas, sesiones persistentes,
 * historial y auditoría. También las salvaguardas: destino no seguro, destino no vacío, copia alterada y rotación.
 * Requiere pg_dump/pg_restore ≥ versión del servidor (PG_BIN o PATH). En CI es obligatorio
 * (INTERACT_TEST_REQUIRE_PG_TOOLS=1); en local, sin herramientas, la prueba se omite y lo dice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { respaldar } from '../scripts/respaldar.mjs';
import { firmarCopia, generarClaves } from '../scripts/autenticidad-respaldo.mjs';
import { restaurar } from '../scripts/restaurar.mjs';
import { binario, ejecutar, versionMayor } from '../scripts/pg-herramientas.mjs';
import { recuentos } from '../src/db.mjs';
import { borrarEsquema, conCliente, iniciar, nuevoEsquema, pedir, urlPrueba } from './ayuda.mjs';

const ADMIN = { email: 'admin@willedtech.test', password: 'clave-admin-larga-2026' };
const SECRETO = `secreto-de-prueba-${randomBytes(16).toString('hex')}`;

async function herramientas() {
  try {
    const servidor = await conCliente(null, async (c) => Number((await c.query('SHOW server_version_num')).rows[0].server_version_num.slice(0, -4)));
    const dump = await versionMayor(binario('pg_dump'), process.env);
    const restore = await versionMayor(binario('pg_restore'), process.env);
    if (!dump || !restore) return { ok: false, motivo: 'pg_dump/pg_restore no encontrados' };
    if (dump < servidor) return { ok: false, motivo: `pg_dump ${dump} es anterior al servidor ${servidor}` };
    return { ok: true };
  } catch (e) { return { ok: false, motivo: e.message }; }
}
const disponibles = await herramientas();
const exigir = process.env.INTERACT_TEST_REQUIRE_PG_TOOLS === '1';
const opciones = !disponibles.ok && !exigir ? { skip: `sin herramientas de PostgreSQL: ${disponibles.motivo}` } : {};

test('herramientas de respaldo presentes donde se exigen (CI)', { skip: !exigir }, () => {
  assert.ok(disponibles.ok, disponibles.motivo);
});

test('restauración operativa completa: cuentas, contraseñas, roles, invitaciones, sesiones, historial y auditoría', opciones, async (t) => {
  const esquema = nuevoEsquema();
  const dir = mkdtempSync(path.join(tmpdir(), 'interact-respaldo-'));
  const destinoBase = `interact_${randomBytes(4).toString('hex')}_restauracion`;
  const urlDestino = (() => { const u = new URL(urlPrueba()); u.pathname = `/${destinoBase}`; return u.toString(); })();
  t.after(async () => {
    rmSync(dir, { recursive: true, force: true });
    await borrarEsquema(esquema).catch(() => {});
    await conCliente(null, (c) => c.query(`DROP DATABASE IF EXISTS ${destinoBase} WITH (FORCE)`));
    await conCliente(null, (c) => c.query(`DROP DATABASE IF EXISTS ${destinoBase.replace('_restauracion', 'b_restauracion')} WITH (FORCE)`));
  });

  // ---------- 1. Datos de origen (a través del servicio, como en uso real) ----------
  const env = { ADMIN_PASSWORD_HASH: '', SESSION_SECRET: SECRETO };
  const origen = await iniciar({ env, esquema, conservarEsquema: true });
  let cookieDocente; let tokenPendiente; let salaId; let antes;
  try {
    await origen.app.cuentas.crearSuperusuario(ADMIN);
    const post = (ruta, cuerpo, s) => origen.peticion(ruta, { metodo: 'POST', cuerpo, cabeceras: s ? { cookie: s.cookie, 'x-oc-csrf': s.csrf } : {} });
    const entrar = async (email, password) => {
      const r = await post('/api/auth/login', { email, password });
      assert.equal(r.estado, 200, r.texto);
      return { cookie: r.cabeceras['set-cookie'][0].split(';')[0], csrf: r.json.csrf };
    };
    const token = (k) => origen.app.correo.bandeja.at(-1).texto.match(new RegExp(`#${k}=([\\w-]+)`))[1];
    const admin = await entrar(ADMIN.email, ADMIN.password);
    assert.equal((await post('/api/admin/invitaciones', { email: 'docente@uni.test', rol: 'docente' }, admin)).estado, 201);
    assert.equal((await post('/api/auth/invitacion/aceptar', { token: token('invitacion'), nombre: 'Docente', password: 'clave-docente-larga-1' })).estado, 200);
    assert.equal((await post('/api/auth/verificar', { token: token('verificar') })).estado, 200);
    const docente = await entrar('docente@uni.test', 'clave-docente-larga-1');
    cookieDocente = docente.cookie;
    // Invitación pendiente (para validar tras restaurar) y otra revocada.
    await post('/api/admin/invitaciones', { email: 'pendiente@uni.test', rol: 'docente' }, admin);
    tokenPendiente = token('invitacion');
    const rev = await post('/api/admin/invitaciones', { email: 'revocada@uni.test', rol: 'superusuario' }, admin);
    assert.equal((await post('/api/admin/invitaciones/revocar', { id: rev.json.id }, admin)).estado, 200);
    // Historial con resultados agregados.
    const { s } = await origen.docente(docente.cookie);
    const sala = (await pedir(s, 'sala:crear', { titulo: 'Clase respaldada' })).sala;
    salaId = sala.id;
    const est = await origen.estudiante(sala.codigo, { alias: 'Alias' });
    const e = (await pedir(s, 'encuesta:crear', { salaId, abrir: true, encuesta: { enunciado: '¿2+2?', tipo: 'unica', opciones: ['4', '5'] } })).encuesta;
    assert.equal((await pedir(est.s, 'encuesta:responder', { encuestaId: e.id, ronda: 1, seleccion: [0] })).ok, true);
    assert.equal((await pedir(s, 'sala:finalizar', { salaId })).ok, true);
    await origen.app.persistido(); // el cierre de la sala se escribe de forma asíncrona
    antes = await recuentos(origen.app.db);
    for (const [tabla, n] of Object.entries(antes)) assert.ok(n > 0, `la tabla ${tabla} debe tener datos de origen`);
  } finally { await origen.cerrar(); }

  // ---------- 2. Respaldo con la herramienta oficial ----------
  const r = await respaldar({ url: urlPrueba(), dir, esquema, conservar: 2 });
  assert.equal(r.verificada, true);
  assert.match(path.basename(r.copia), /^interact-\d{8}T\d{6}Z\.dump$/);
  assert.ok(r.bytes > 1000);
  assert.ok(readFileSync(`${r.copia}.sha256`, 'utf8').startsWith(r.sha256));
  assert.ok(!readFileSync(r.copia).includes(Buffer.from('clave-docente-larga-1')), 'la copia no contiene contraseñas en claro');

  // ---------- 3. Salvaguardas antes de restaurar ----------
  // Nombre de producción («interact»): se rechaza ANTES de conectar, sin confirmación humana explícita.
  const vivo = (() => { const u = new URL(urlPrueba()); u.pathname = '/interact'; return u.toString(); })();
  await assert.rejects(restaurar({ url: vivo, copia: r.copia, esquema }), /no es de prueba\/restauración/, 'nunca sobre la base viva sin confirmación');
  // Y una base de prueba con datos (la de origen) tampoco: la restauración no mezcla ni sobrescribe.
  await assert.rejects(restaurar({ url: urlPrueba(), copia: r.copia, esquema }), /ya contiene tablas/);
  await conCliente(null, (c) => c.query(`CREATE DATABASE ${destinoBase}`));
  const alterada = path.join(dir, 'alterada.dump');
  writeFileSync(alterada, Buffer.concat([readFileSync(r.copia), Buffer.from('x')]));
  writeFileSync(`${alterada}.sha256`, readFileSync(`${r.copia}.sha256`, 'utf8').replace(path.basename(r.copia), 'alterada.dump'));
  await assert.rejects(restaurar({ url: urlDestino, copia: alterada, esquema }), /SHA-256/);

  // ---------- 4. Restauración en base vacía y verificación ----------
  const res = await restaurar({ url: urlDestino, copia: r.copia, esquema });
  assert.equal(res.integra, true);
  assert.equal(res.autenticidad, 'no-verificada');
  assert.equal(res.confiable, false, 'sin firma verificada la restauración NO es de producción confiable');
  assert.equal(res.version, 1);
  assert.deepEqual(res.recuentos, antes, 'mismas filas en todas las tablas');
  await assert.rejects(restaurar({ url: urlDestino, copia: r.copia, esquema }), /ya contiene tablas/, 'nunca mezcla datos');

  // ---------- 4b. Restauración AUTÉNTICA: manifiesto firmado con una clave cuya parte pública se entrega aparte ----------
  const claves = { privada: path.join(dir, 'ext-privada.pem'), publica: path.join(dir, 'ext-publica.pem') };
  generarClaves(claves);
  firmarCopia({ copia: r.copia, clavePrivada: claves.privada });
  const destino2 = destinoBase.replace('_restauracion', 'b_restauracion');
  const urlDestino2 = (() => { const u = new URL(urlDestino); u.pathname = `/${destino2}`; return u.toString(); })();
  await conCliente(null, (c) => c.query(`CREATE DATABASE ${destino2}`));
  const res2 = await restaurar({ url: urlDestino2, copia: r.copia, esquema, clavePublica: claves.publica });
  assert.equal(res2.autenticidad, 'verificada');
  assert.equal(res2.confiable, true);
  assert.deepEqual(res2.recuentos, antes);

  // ---------- 5. El servicio arranca sobre la copia (modo producción: solo verifica el esquema) ----------
  const restaurado = await iniciar({ env: { ...env, DATABASE_URL: urlDestino, DB_MIGRATIONS: 'verificar' }, esquema, conservarEsquema: true });
  try {
    const login = await restaurado.peticion('/api/auth/login', { metodo: 'POST', cuerpo: { email: 'docente@uni.test', password: 'clave-docente-larga-1' } });
    assert.equal(login.estado, 200, 'la contraseña protegida (scrypt) sigue validando');
    assert.equal((await restaurado.peticion('/api/auth/login', { metodo: 'POST', cuerpo: { email: 'docente@uni.test', password: 'otra-clave-equivocada' } })).estado, 401);
    const yo = await restaurado.peticion('/api/yo', { cabeceras: { cookie: cookieDocente } });
    assert.equal(yo.estado, 200, 'la sesión persistente de antes del respaldo sigue vigente');
    assert.equal(yo.json.usuario.rol, 'docente', 'rol recuperado');
    const adminLogin = await restaurado.peticion('/api/auth/login', { metodo: 'POST', cuerpo: ADMIN });
    const adminCookie = adminLogin.cabeceras['set-cookie'][0].split(';')[0];
    assert.equal((await restaurado.peticion('/api/admin/usuarios', { cabeceras: { cookie: adminCookie } })).estado, 200, 'el superusuario conserva su rol');
    assert.equal((await restaurado.peticion('/api/admin/usuarios', { cabeceras: { cookie: cookieDocente } })).estado, 403, 'el docente sigue sin administración');
    const invs = (await restaurado.peticion('/api/admin/invitaciones', { cabeceras: { cookie: adminCookie } })).json.invitaciones;
    assert.equal(invs.find((i) => i.email === 'pendiente@uni.test').estado, 'pendiente');
    assert.equal(invs.find((i) => i.email === 'revocada@uni.test').estado, 'revocada');
    assert.equal((await restaurado.peticion('/api/auth/invitacion/validar', { metodo: 'POST', cuerpo: { token: tokenPendiente } })).estado, 200, 'el enlace pendiente sigue funcionando');
    const det = await restaurado.peticion(`/api/historial/detalle?id=${salaId}`, { cabeceras: { cookie: cookieDocente } });
    assert.equal(det.json.estado, 'finalizada');
    assert.deepEqual(det.json.actividades[0].rondas[0].conteos, [1, 0]);
    const eventos = (await restaurado.peticion('/api/admin/auditoria', { cabeceras: { cookie: adminCookie } })).json.eventos.map((x) => x.accion);
    for (const a of ['superusuario_inicializado', 'invitacion_creada', 'invitacion_aceptada', 'correo_verificado', 'invitacion_revocada']) assert.ok(eventos.includes(a), `auditoría: ${a}`);
    // La identidad sigue en marcha: nuevas escrituras sobre la copia (secuencias restauradas).
    assert.equal((await restaurado.peticion('/api/auth/olvide', { metodo: 'POST', cuerpo: { email: 'docente@uni.test' } })).estado, 202);
  } finally { await restaurado.cerrar(); }

  // ---------- 6. Rotación: se conservan las N copias más recientes (con su .sha256) ----------
  for (let i = 1; i <= 3; i++) await respaldar({ url: urlPrueba(), dir, esquema, conservar: 2, ahora: new Date(Date.now() + i * 1000) });
  const copias = readdirSync(dir).filter((f) => /^interact-.*\.dump$/.test(f));
  assert.equal(copias.length, 2);
  for (const c of copias) assert.ok(readdirSync(dir).includes(`${c}.sha256`));
});

test('respaldo: errores claros sin credenciales en el mensaje', opciones, async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'interact-respaldo-'));
  try {
    // Rol inexistente (la imagen oficial confía en 127.0.0.1 dentro de su propia red: una clave errónea no bastaría).
    const mala = (() => { const u = new URL(urlPrueba()); u.username = 'rol_inexistente_respaldo'; u.password = 'contrasena-erronea-secreta'; return u.toString(); })();
    await assert.rejects(respaldar({ url: mala, dir }), (e) => {
      assert.match(e.message, /pg_dump falló/);
      assert.ok(!e.message.includes('contrasena-erronea-secreta'));
      return true;
    });
    assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith('.parcial') || f.endsWith('.dump')), [], 'sin copias a medias');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Comprobación mínima de la invocación: la contraseña nunca va en argv (visible con ps).
test('herramientas: la contraseña viaja en PGPASSWORD, no en la línea de órdenes', async () => {
  const { entornoPg } = await import('../scripts/pg-herramientas.mjs');
  const env = entornoPg('postgres://u:p%40ss@h:5433/base?sslmode=require', {});
  assert.deepEqual({ h: env.PGHOST, p: env.PGPORT, u: env.PGUSER, w: env.PGPASSWORD, d: env.PGDATABASE, s: env.PGSSLMODE },
    { h: 'h', p: '5433', u: 'u', w: 'p@ss', d: 'base', s: 'require' });
  // El hijo recibe la contraseña solo por entorno: su argv no la contiene.
  const r = await ejecutar(process.execPath, ['-e', 'console.log(JSON.stringify({ argv: process.argv.slice(1), pw: process.env.PGPASSWORD }))'], { ...process.env, ...env });
  assert.equal(r.codigo, 0);
  const visto = JSON.parse(r.salida);
  assert.equal(visto.pw, 'p@ss');
  assert.ok(!JSON.stringify(visto.argv).includes('p@ss'));
});
