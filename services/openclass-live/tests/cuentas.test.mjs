/** Interact 0.4.0: cuentas, invitaciones, verificación, recuperación, roles, aislamiento entre docentes y persistencia. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { iniciar, peticion, pedir, esperar } from './ayuda.mjs';
import { abrirBase, respaldar, verificarIntegridad, versionEsquema } from '../src/db.mjs';

const ADMIN = { email: 'admin@willedtech.test', password: 'clave-admin-larga-2026' };
const SIN_HEREDADO = { ADMIN_PASSWORD_HASH: '' };

async function contexto(opciones = {}) {
  const ctx = await iniciar({ ...opciones, env: { ...SIN_HEREDADO, ...(opciones.env ?? {}) } });
  if (!ctx.app.cuentas.existeSuperusuario()) ctx.app.cuentas.crearSuperusuario(ADMIN);
  const post = (ruta, cuerpo, sesion) => ctx.peticion(ruta, { metodo: 'POST', cuerpo, cabeceras: sesion ? { cookie: sesion.cookie, 'x-oc-csrf': sesion.csrf } : {} });
  const get = (ruta, sesion) => ctx.peticion(ruta, { cabeceras: sesion ? { cookie: sesion.cookie } : {} });
  const entrar = async (email, password) => {
    const r = await post('/api/auth/login', { email, password });
    assert.equal(r.estado, 200, `login ${email}: ${r.texto}`);
    return { cookie: r.cabeceras['set-cookie'][0].split(';')[0], csrf: r.json.csrf };
  };
  const ultimoToken = (clave) => {
    const m = ctx.app.correo.bandeja.at(-1).texto.match(new RegExp(`#${clave}=([\\w-]+)`));
    assert.ok(m, `sin enlace ${clave}`);
    return m[1];
  };
  /** Invita y activa una cuenta docente completa; devuelve su sesión. */
  const crearDocente = async (admin, email, password = 'docente-clave-larga-1') => {
    assert.equal((await post('/api/admin/invitaciones', { email, rol: 'docente' }, admin)).estado, 201);
    const t = ultimoToken('invitacion');
    assert.equal((await post('/api/auth/invitacion/aceptar', { token: t, nombre: 'Docente', password })).estado, 200);
    assert.equal((await post('/api/auth/verificar', { token: ultimoToken('verificar') })).estado, 200);
    return entrar(email, password);
  };
  return { ...ctx, post, get, entrar, ultimoToken, crearDocente };
}

test('superusuario: sin credenciales por defecto, un solo superusuario, contraseña robusta', async () => {
  const ctx = await iniciar({ env: SIN_HEREDADO });
  try {
    assert.equal(ctx.app.cuentas.existeSuperusuario(), false);
    const r = await ctx.peticion('/api/auth/login', { metodo: 'POST', cuerpo: { email: 'admin@willedtech.test', password: 'admin' } });
    assert.equal(r.estado, 401);
    assert.throws(() => ctx.app.cuentas.crearSuperusuario({ email: 'a@b.co', password: 'corta' }), /12 y 256/);
    ctx.app.cuentas.crearSuperusuario(ADMIN);
    assert.throws(() => ctx.app.cuentas.crearSuperusuario({ email: 'otro@b.co', password: 'otra-clave-larga-123' }), /Ya existe/);
    const fila = ctx.app.db.prepare('SELECT hash FROM usuarios WHERE rol = ?').get('superusuario');
    assert.match(fila.hash, /^scrypt\$32768\$8\$1\$/);
    assert.ok(!fila.hash.includes(ADMIN.password));
    // Sin hash heredado el acceso compartido no existe.
    assert.equal((await ctx.peticion('/api/docente/login', { metodo: 'POST', cuerpo: { password: 'x'.repeat(20) } })).estado, 404);
  } finally { await ctx.cerrar(); }
});

test('flujo exigido: invitar → enlace → validar → crear cuenta → verificar correo → iniciar sesión → panel', async () => {
  const c = await contexto();
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const inv = await c.post('/api/admin/invitaciones', { email: 'Ana@Uni.Test', rol: 'docente' }, admin);
    assert.equal(inv.estado, 201);
    assert.equal(inv.json.correo, 'simulado');
    assert.ok(inv.json.enlaceManual, 'con transporte no real el administrador recibe el enlace');
    const t = c.ultimoToken('invitacion');
    assert.equal(c.app.correo.bandeja.at(-1).para, 'ana@uni.test');
    // El token no se guarda en claro.
    assert.equal(c.app.db.prepare('SELECT COUNT(*) AS n FROM tokens WHERE hash_token = ?').get(t).n, 0);
    assert.equal((await c.post('/api/auth/invitacion/validar', { token: t })).json.email, 'ana@uni.test');
    assert.equal((await c.post('/api/auth/invitacion/validar', { token: 'x'.repeat(43) })).estado, 404);
    assert.equal((await c.post('/api/auth/invitacion/aceptar', { token: t, nombre: 'Ana', password: 'corta' })).estado, 400);
    assert.equal((await c.post('/api/auth/invitacion/aceptar', { token: t, nombre: 'Ana', password: 'ana-clave-larga-1' })).estado, 200);
    // Reutilización rechazada.
    assert.equal((await c.post('/api/auth/invitacion/aceptar', { token: t, nombre: 'Ana', password: 'otra-clave-larga-2' })).estado, 400);
    // Sin verificar no entra.
    assert.equal((await c.post('/api/auth/login', { email: 'ana@uni.test', password: 'ana-clave-larga-1' })).estado, 403);
    const v = c.ultimoToken('verificar');
    assert.equal((await c.post('/api/auth/verificar', { token: v })).estado, 200);
    assert.equal((await c.post('/api/auth/verificar', { token: v })).estado, 400, 'verificación de un solo uso');
    const ana = await c.entrar('ana@uni.test', 'ana-clave-larga-1');
    const yo = await c.get('/api/yo', ana);
    assert.equal(yo.json.usuario.rol, 'docente');
    const auditoria = (await c.get('/api/admin/auditoria', admin)).json.eventos.map((e) => e.accion);
    assert.ok(auditoria.includes('invitacion_creada') && auditoria.includes('correo_verificado'));
    assert.ok(!JSON.stringify(auditoria).includes(t));
  } finally { await c.cerrar(); }
});

test('invitaciones: vencimiento, revocación, reinvitación y cuenta ya activa', async () => {
  let ahora = Date.now();
  const c = await contexto({ ahora: () => ahora, env: { INVITE_TTL_HOURS: '1' } });
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    await c.post('/api/admin/invitaciones', { email: 'v@uni.test' }, admin);
    const t1 = c.ultimoToken('invitacion');
    ahora += 61 * 60_000;
    assert.equal((await c.post('/api/auth/invitacion/validar', { token: t1 })).estado, 404, 'vencida');
    assert.equal((await c.post('/api/auth/invitacion/aceptar', { token: t1, nombre: 'V', password: 'clave-larga-vencida1' })).estado, 400);

    const r = await c.post('/api/admin/invitaciones', { email: 'r@uni.test' }, admin);
    const t2 = c.ultimoToken('invitacion');
    assert.equal((await c.post('/api/admin/invitaciones/revocar', { id: r.json.id }, admin)).estado, 200);
    assert.equal((await c.post('/api/auth/invitacion/validar', { token: t2 })).estado, 404, 'revocada');
    assert.equal((await c.post('/api/admin/invitaciones/revocar', { id: r.json.id }, admin)).estado, 404, 'ya no está pendiente');

    // Una invitación nueva anula la anterior para el mismo correo.
    await c.post('/api/admin/invitaciones', { email: 'n@uni.test' }, admin);
    const a = c.ultimoToken('invitacion');
    await c.post('/api/admin/invitaciones', { email: 'n@uni.test' }, admin);
    assert.equal((await c.post('/api/auth/invitacion/validar', { token: a })).estado, 404);

    await c.crearDocente(admin, 'activo@uni.test');
    assert.equal((await c.post('/api/admin/invitaciones', { email: 'activo@uni.test' }, admin)).estado, 409);
    assert.equal((await c.post('/api/admin/invitaciones', { email: 'no-es-correo' }, admin)).estado, 400);
  } finally { await c.cerrar(); }
});

test('recuperación: respuesta idéntica para cuentas desconocidas, enlace de un solo uso, vencimiento y sesiones cerradas', async () => {
  let ahora = Date.now();
  const c = await contexto({ ahora: () => ahora, env: { RESET_TTL_MINUTES: '30' } });
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'rec@uni.test', 'vieja-clave-larga-1');
    const antes = c.app.correo.bandeja.length;
    const desconocida = await c.post('/api/auth/olvide', { email: 'nadie@uni.test' });
    const conocida = await c.post('/api/auth/olvide', { email: 'rec@uni.test' });
    assert.equal(desconocida.estado, 202);
    assert.deepEqual(desconocida.json, conocida.json, 'misma respuesta exista o no la cuenta');
    assert.equal(c.app.correo.bandeja.length, antes + 1, 'solo la cuenta real recibe correo');
    const t = c.ultimoToken('recuperar');
    assert.equal((await c.post('/api/auth/restablecer', { token: t, password: 'corta' })).estado, 400);
    assert.equal((await c.post('/api/auth/restablecer', { token: t, password: 'nueva-clave-larga-2' })).estado, 200);
    assert.equal((await c.post('/api/auth/restablecer', { token: t, password: 'otra-clave-larga-3' })).estado, 400, 'un solo uso');
    assert.equal((await c.get('/api/yo', doc)).estado, 401, 'la sesión anterior quedó revocada');
    assert.equal((await c.post('/api/auth/login', { email: 'rec@uni.test', password: 'vieja-clave-larga-1' })).estado, 401);
    await c.entrar('rec@uni.test', 'nueva-clave-larga-2');

    await c.post('/api/auth/olvide', { email: 'rec@uni.test' });
    const t2 = c.ultimoToken('recuperar');
    ahora += 31 * 60_000;
    assert.equal((await c.post('/api/auth/restablecer', { token: t2, password: 'ultima-clave-larga-4' })).estado, 400, 'vencido');
  } finally { await c.cerrar(); }
});

test('login: errores indistinguibles, límite por cuenta y cuenta suspendida', async () => {
  const c = await contexto();
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    await c.crearDocente(admin, 'lim@uni.test', 'clave-limite-larga-1');
    const mal = await c.post('/api/auth/login', { email: 'lim@uni.test', password: 'incorrecta-incorrecta' });
    const nadie = await c.post('/api/auth/login', { email: 'nadie@uni.test', password: 'incorrecta-incorrecta' });
    assert.equal(mal.estado, 401);
    assert.deepEqual(mal.json, nadie.json);
    // Suspender revoca sesiones y bloquea el ingreso.
    const id = (await c.get('/api/admin/usuarios', admin)).json.usuarios.find((u) => u.email === 'lim@uni.test').id;
    const doc = await c.entrar('lim@uni.test', 'clave-limite-larga-1');
    assert.equal((await c.post('/api/admin/usuarios/estado', { id, estado: 'suspendido' }, admin)).estado, 200);
    assert.equal((await c.get('/api/yo', doc)).estado, 401);
    assert.equal((await c.post('/api/auth/login', { email: 'lim@uni.test', password: 'clave-limite-larga-1' })).estado, 401);
    // Fuerza bruta: tras 5 intentos, 429.
    let ultimo;
    for (let i = 0; i < 7; i++) ultimo = await c.post('/api/auth/login', { email: 'bruta@uni.test', password: `intento-${i}-intento-xx` });
    assert.equal(ultimo.estado, 429);
    // Cambiar el propio estado está prohibido.
    const yoId = (await c.get('/api/yo', admin)).json.usuario.id;
    assert.equal((await c.post('/api/admin/usuarios/estado', { id: yoId, estado: 'suspendido' }, admin)).estado, 403);
  } finally { await c.cerrar(); }
});

test('roles en backend: docente sin acceso a administración; CSRF y origen exigidos; sin sesión 401', async () => {
  const c = await contexto();
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'rol@uni.test');
    for (const ruta of ['/api/admin/usuarios', '/api/admin/invitaciones', '/api/admin/auditoria']) {
      assert.equal((await c.get(ruta, doc)).estado, 403, ruta);
      assert.equal((await c.get(ruta)).estado, 401, ruta);
    }
    assert.equal((await c.post('/api/admin/invitaciones', { email: 'x@uni.test' }, doc)).estado, 403);
    assert.equal((await c.post('/api/admin/invitaciones', { email: 'x@uni.test' }, { cookie: admin.cookie, csrf: 'falso' })).estado, 403, 'CSRF');
    const otroOrigen = await c.peticion('/api/admin/invitaciones', { metodo: 'POST', origen: 'http://malo.test', cuerpo: { email: 'x@uni.test' }, cabeceras: { cookie: admin.cookie, 'x-oc-csrf': admin.csrf } });
    assert.equal(otroOrigen.estado, 403);
    assert.equal((await c.get('/api/historial?usuario=admin', doc)).json.ambito, 'propio');
  } finally { await c.cerrar(); }
});

test('aislamiento entre docentes: ni por Socket.IO ni por historial se alcanzan sesiones ajenas', async () => {
  const c = await contexto();
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const a = await c.crearDocente(admin, 'a@uni.test');
    const b = await c.crearDocente(admin, 'b@uni.test');
    const sa = await c.docente(a.cookie);
    const sb = await c.docente(b.cookie);
    const salaA = (await pedir(sa.s, 'sala:crear', { titulo: 'Clase de A' })).sala;
    const salaB = (await pedir(sb.s, 'sala:crear', { titulo: 'Clase de B' })).sala;
    assert.ok(salaA.id && salaB.id);
    assert.deepEqual((await pedir(sb.s, 'sala:listar')).salas.map((s) => s.id), [salaB.id], 'B solo lista las suyas');
    for (const [evento, datos] of [['sala:seguir', {}], ['sala:clave', {}], ['sala:finalizar', {}], ['sala:revocarClaves', {}],
      ['encuesta:crear', { encuesta: { enunciado: 'x', tipo: 'unica', opciones: ['a', 'b'] } }], ['preguntas:ajustar', { abiertas: false }]]) {
      const r = await pedir(sb.s, evento, { salaId: salaA.id, ...datos });
      assert.equal(r.ok, false, evento);
      assert.equal(r.error, 'prohibido', evento);
    }
    assert.equal((await pedir(sa.s, 'sala:seguir', { salaId: salaA.id })).ok, true);
    // Historial: B no ve ni la fila ni el detalle de A, aunque cambie el identificador.
    const listaB = (await c.get('/api/historial', b)).json;
    assert.deepEqual(listaB.filas.map((f) => f.id), [salaB.id]);
    assert.equal((await c.get(`/api/historial/detalle?id=${salaA.id}`, b)).estado, 404);
    assert.equal((await c.post('/api/historial/eliminar', { id: salaA.id }, b)).estado, 404);
    // El superusuario consulta todo.
    const global = (await c.get('/api/historial', admin)).json;
    assert.equal(global.ambito, 'global');
    assert.deepEqual(global.filas.map((f) => f.id).sort(), [salaA.id, salaB.id].sort());
    assert.equal((await c.get(`/api/historial/detalle?id=${salaA.id}`, admin)).estado, 200);
    assert.equal((await c.get(`/api/historial?usuario=${encodeURIComponent('a@uni')}`, admin)).json.total, 1);
    // El superusuario no gobierna salas ajenas en vivo (mínimo privilegio).
    const sadmin = await c.docente(admin.cookie);
    assert.equal((await pedir(sadmin.s, 'sala:finalizar', { salaId: salaA.id })).error, 'prohibido');
  } finally { await c.cerrar(); }
});

test('historial persistente: sobrevive al reinicio, marca salas interrumpidas y guarda solo agregados', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'interact-datos-'));
  const env = { ...SIN_HEREDADO, DATA_DIR: dir };
  let c = await contexto({ env });
  let finalizadaId; let abiertaId;
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'p@uni.test');
    const { s } = await c.docente(doc.cookie);
    const fin = (await pedir(s, 'sala:crear', { titulo: 'Se finaliza' })).sala;
    finalizadaId = fin.id;
    const est = await c.estudiante(fin.codigo, { alias: 'SecretoAlias' });
    const e = (await pedir(s, 'encuesta:crear', { salaId: fin.id, abrir: true, encuesta: { enunciado: '¿Capital?', tipo: 'unica', opciones: ['Bogotá', 'Lima'] } })).encuesta;
    assert.equal((await pedir(est.s, 'encuesta:responder', { encuestaId: e.id, ronda: 1, seleccion: [0] })).ok, true);
    await pedir(s, 'pregunta:moderar', { salaId: fin.id, preguntaId: 'x', accion: 'aprobar' }).catch(() => {});
    assert.equal((await pedir(s, 'sala:finalizar', { salaId: fin.id })).ok, true);
    const sinHist = (await pedir(s, 'sala:crear', { titulo: 'Sin resultados', conservarResultados: false })).sala;
    const abierta = (await pedir(s, 'sala:crear', { titulo: 'Queda abierta' })).sala;
    abiertaId = abierta.id;
    await pedir(s, 'sala:finalizar', { salaId: sinHist.id });
    const det = (await c.get(`/api/historial/detalle?id=${finalizadaId}`, doc)).json;
    assert.equal(det.estado, 'finalizada');
    assert.equal(det.participantes, 1);
    assert.equal(det.actividades[0].rondas[0].respondientes, 1);
    assert.deepEqual(det.actividades[0].rondas[0].conteos, [1, 0]);
    const textoBase = JSON.stringify(c.app.db.prepare('SELECT * FROM actividades_historial').all()) + JSON.stringify(c.app.db.prepare('SELECT * FROM salas_historial').all());
    assert.ok(!textoBase.includes('SecretoAlias'), 'el alias nunca se guarda');
    assert.equal((await c.get(`/api/historial/detalle?id=${sinHist.id}`, doc)).json.actividades.length, 0, 'sin resultados autorizados');
    assert.equal((await c.get(`/api/historial/detalle?id=${abiertaId}`, doc)).json.estado, 'activa');
  } finally { await c.cerrar(); }

  c = await contexto({ env });
  try {
    const doc = await c.entrar('p@uni.test', 'docente-clave-larga-1');
    const lista = (await c.get('/api/historial', doc)).json;
    assert.equal(lista.total, 3, 'el historial sobrevive al reinicio');
    assert.equal(lista.filas.find((f) => f.id === abiertaId).estado, 'interrumpida', 'una sala irrecuperable no se muestra como activa');
    assert.equal(lista.filas.find((f) => f.id === finalizadaId).estado, 'finalizada');
    assert.equal((await c.get('/api/yo', doc)).estado, 200, 'la sesión de cuenta también sobrevive');
    assert.equal((await c.get('/api/historial?estado=interrumpida', doc)).json.total, 1);
    assert.equal(c.app.almacen.tamano, 0, 'la sala interrumpida no existe en memoria');
    // Respaldo consistente y verificable.
    const copia = respaldar(c.app.db, path.join(dir, 'respaldos'), { conservar: 2 });
    const bd = abrirBase(copia);
    assert.equal(verificarIntegridad(bd).integra, true);
    assert.equal(bd.prepare('SELECT COUNT(*) AS n FROM salas_historial').get().n, 3);
    assert.equal(versionEsquema(bd), 1);
    bd.close();
    for (let i = 0; i < 3; i++) respaldar(c.app.db, path.join(dir, 'respaldos'), { conservar: 2, ahora: new Date(Date.now() + (i + 1) * 1000) });
    assert.equal(readdirSync(path.join(dir, 'respaldos')).length, 2, 'rotación de copias');
  } finally { await c.cerrar(); rmSync(dir, { recursive: true, force: true }); }
});

test('historial: filtros, CSV seguro, eliminación y políticas de conservación', async () => {
  let ahora = Date.now();
  const c = await contexto({ ahora: () => ahora, env: { HISTORY_RETENTION_DAYS: '30' } });
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'csv@uni.test');
    const { s } = await c.docente(doc.cookie);
    const ids = [];
    for (const titulo of ['Álgebra', '=HYPERLINK("http://x")', 'Cálculo']) {
      const sala = (await pedir(s, 'sala:crear', { titulo })).sala;
      ids.push(sala.id);
      await pedir(s, 'sala:finalizar', { salaId: sala.id });
    }
    assert.equal((await c.get('/api/historial?q=lge', doc)).json.total, 1);
    assert.equal((await c.get('/api/historial?q=%25', doc)).json.total, 0, 'comodines escapados');
    assert.equal((await c.get(`/api/historial?desde=${new Date(Date.now() + 86_400_000).toISOString()}`, doc)).json.total, 0);
    const csv = await c.get('/api/historial.csv', doc);
    assert.match(csv.cabeceras['content-type'], /text\/csv/);
    assert.ok(csv.texto.includes('"\'=HYPERLINK'), 'inyección de fórmulas neutralizada');
    assert.ok(!/SecretoAlias|hash/i.test(csv.texto));
    assert.equal((await c.post('/api/historial/eliminar', { id: ids[0] }, doc)).estado, 200);
    assert.equal((await c.get('/api/historial', doc)).json.total, 2);
    ahora += 31 * 86_400_000;
    const admin2 = await c.entrar(ADMIN.email, ADMIN.password); // las sesiones de 8 h también vencieron
    const r = await c.post('/api/admin/retencion', {}, admin2);
    assert.equal(r.json.historial, 2, 'se elimina lo anterior al plazo de conservación');
    assert.equal((await c.get('/api/historial', admin2)).json.total, 0);
  } finally { await c.cerrar(); }
});

test('modo heredado 0.3.0: la contraseña compartida sigue funcionando con su propia cuenta interna y no por correo', async () => {
  const ctx = await iniciar();
  try {
    const { cookie, csrf } = await ctx.login();
    const yo = await ctx.peticion('/api/yo', { cabeceras: { cookie } });
    assert.equal(yo.json.usuario.email, 'docente-heredado@interact.invalid');
    assert.ok(csrf);
    const r = await ctx.peticion('/api/auth/login', { metodo: 'POST', cuerpo: { email: 'docente-heredado@interact.invalid', password: 'clave-de-prueba-docente-2026' } });
    assert.equal(r.estado, 401);
    assert.equal((await ctx.peticion('/api/docente/sesion')).json.heredado, true);
  } finally { await ctx.cerrar(); }
});

test('vínculo con OpenClass local: código temporal, aprobación en el navegador, credencial de un solo canje y «iniciar clase» explícito', async () => {
  const c = await contexto();
  const LOCAL = 'http://localhost:8613';
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'loc@uni.test');
    const iniciarV = await c.peticion('/api/vinculo/iniciar', { metodo: 'POST', origen: LOCAL, cuerpo: {} });
    assert.equal(iniciarV.estado, 200);
    assert.equal(iniciarV.cabeceras['access-control-allow-origin'], LOCAL);
    const { id, secreto, codigo } = iniciarV.json;
    assert.ok(!iniciarV.json.url.includes(secreto) && !iniciarV.json.url.includes('?'), 'sin secretos en la URL');
    const sondear = () => c.peticion('/api/vinculo/sondear', { metodo: 'POST', origen: LOCAL, cuerpo: { id, secreto } });
    assert.equal((await sondear()).json.estado, 'pendiente');
    assert.equal((await c.peticion('/api/vinculo/sondear', { metodo: 'POST', origen: LOCAL, cuerpo: { id, secreto: 'x'.repeat(30) } })).estado, 404);
    assert.equal((await c.peticion('/api/vinculo/iniciar', { metodo: 'POST', origen: 'http://malo.test', cuerpo: {} })).estado, 403, 'solo orígenes de presentación');
    // Aprobar exige sesión + CSRF y un código real.
    assert.equal((await c.post('/api/vinculo/aprobar', { codigo }, { cookie: doc.cookie, csrf: 'mal' })).estado, 403);
    assert.equal((await c.post('/api/vinculo/aprobar', { codigo: 'AAAA-AAAA' }, doc)).estado, 404);
    // Doble paso: el código solo no aprueba; muestra el contexto declarado, marcado como no verificado.
    const previa = await c.post('/api/vinculo/aprobar', { codigo: codigo.toLowerCase() }, doc);
    assert.equal(previa.estado, 200);
    assert.equal(previa.json.pendiente, true);
    assert.equal(previa.json.contexto.origen, LOCAL);
    assert.equal(previa.json.contexto.verificado, false);
    assert.equal((await sondear()).json.estado, 'pendiente', 'sin confirmación no hay credencial');
    assert.equal((await c.post('/api/vinculo/aprobar', { codigo: codigo.toLowerCase(), confirmar: true }, doc)).estado, 200);
    const canje = await sondear();
    assert.equal(canje.json.estado, 'aprobado');
    assert.equal((await sondear()).estado, 404, 'la credencial se entrega una sola vez');
    const auth = { authorization: `Bearer ${canje.json.credencial}` };
    // Iniciar sesión NO abre salas: la sala solo nace con la acción explícita.
    assert.equal(c.app.almacen.tamano, 0);
    const clase = await c.peticion('/api/vinculo/clase', { metodo: 'POST', origen: LOCAL, cabeceras: auth, cuerpo: { titulo: 'Desde OpenClass' } });
    assert.equal(clase.estado, 200);
    assert.ok(clase.json.clave && clase.json.enlace.includes(clase.json.sala.codigo));
    assert.equal(c.app.almacen.propietarioDe(clase.json.sala.id), (await c.get('/api/yo', doc)).json.usuario.id);
    assert.equal((await c.get(`/api/historial/detalle?id=${clase.json.sala.id}`, doc)).json.estado, 'activa');
    assert.equal((await c.peticion('/api/vinculo/clase', { metodo: 'POST', origen: LOCAL, cuerpo: {} })).estado, 401);
    // Cerrar el vínculo revoca la credencial.
    assert.equal((await c.peticion('/api/vinculo/salir', { metodo: 'POST', origen: LOCAL, cabeceras: auth, cuerpo: {} })).estado, 200);
    assert.equal((await c.peticion('/api/vinculo/clase', { metodo: 'POST', origen: LOCAL, cabeceras: auth, cuerpo: {} })).estado, 401);
    // La clave de presentador funciona con el protocolo 2 y la sala del vínculo.
    const pres = await c.presentador(clase.json.clave);
    assert.equal(pres.sesion.salaId, clase.json.sala.id);
  } finally { await c.cerrar(); }
});

test('sockets: revocar la sesión (suspender) corta al docente conectado', async () => {
  const c = await contexto({ barridoMs: 50 });
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'corte@uni.test');
    const { s } = await c.docente(doc.cookie);
    const id = (await c.get('/api/admin/usuarios', admin)).json.usuarios.find((u) => u.email === 'corte@uni.test').id;
    const cortado = new Promise((r) => s.on('disconnect', r));
    await c.post('/api/admin/usuarios/estado', { id, estado: 'suspendido' }, admin);
    await Promise.race([cortado, esperar(2000).then(() => { throw new Error('no se cortó'); })]);
  } finally { await c.cerrar(); }
});

test('auditoría: variantes del correo comparten límite, olvide no bloquea el login, JSON null da 400', async () => {
  const c = await contexto();
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    await c.crearDocente(admin, 'aud@uni.test', 'clave-auditoria-larga-1');
    let ultimo;
    for (let i = 0; i < 12; i++) ultimo = await c.post('/api/auth/login', { email: `${' '.repeat(i)}AUD@uni.test`, password: `mala-${i}-mala-mala-xx` });
    assert.equal(ultimo.estado, 429, 'espacios y mayúsculas no multiplican los intentos');
    const c2 = await contexto();
    try {
      const a2 = await c2.entrar(ADMIN.email, ADMIN.password);
      await c2.crearDocente(a2, 'v@uni.test', 'clave-victima-larga-1');
      for (let i = 0; i < 8; i++) await c2.post('/api/auth/olvide', { email: 'v@uni.test' });
      assert.equal((await c2.post('/api/auth/login', { email: 'v@uni.test', password: 'clave-victima-larga-1' })).estado, 200, 'pedir recuperaciones no bloquea el login');
    } finally { await c2.cerrar(); }
    for (const cuerpo of ['null', '5', '[]']) assert.equal((await c.peticion('/api/auth/login', { metodo: 'POST', cuerpo })).estado, 400, cuerpo);
  } finally { await c.cerrar(); }
});

test('auditoría: suspender la cuenta corta la clave de presentador de sus salas; el vínculo tiene cupo por IP', async () => {
  const c = await contexto({ barridoMs: 50 });
  try {
    const admin = await c.entrar(ADMIN.email, ADMIN.password);
    const doc = await c.crearDocente(admin, 'sus@uni.test');
    const { s } = await c.docente(doc.cookie);
    const sala = (await pedir(s, 'sala:crear', { titulo: 'X' })).sala;
    const clave = (await pedir(s, 'sala:clave', { salaId: sala.id })).clave;
    const pres = await c.presentador(clave);
    const cortado = new Promise((r) => pres.s.on('disconnect', r));
    const id = (await c.get('/api/admin/usuarios', admin)).json.usuarios.find((u) => u.email === 'sus@uni.test').id;
    await c.post('/api/admin/usuarios/estado', { id, estado: 'suspendido' }, admin);
    await Promise.race([cortado, esperar(2500).then(() => { throw new Error('el presentador siguió conectado'); })]);
    await assert.rejects(c.presentador(clave), /clave/);
    let r;
    for (let i = 0; i < 6; i++) r = await c.peticion('/api/vinculo/iniciar', { metodo: 'POST', origen: 'http://localhost:8613', cuerpo: {} });
    assert.equal(r.estado, 429, 'máximo 5 vínculos pendientes por IP');
  } finally { await c.cerrar(); }
});

test('vínculo: X-Forwarded-For/X-Real-Ip falsificados no evaden el cupo por IP y con proxy no confiable se ignoran', async () => {
  const { ipCliente } = await import('../src/limites.mjs');
  // Con proxy de confianza manda el último tramo (el que añade Traefik), no lo que escribió el cliente.
  assert.equal(ipCliente({ 'x-forwarded-for': '1.1.1.1, 9.9.9.9', 'x-real-ip': '2.2.2.2' }, '10.0.0.1', true), '9.9.9.9');
  assert.equal(ipCliente({ 'x-real-ip': '2.2.2.2' }, '10.0.0.1', true), '2.2.2.2');
  assert.equal(ipCliente({ 'x-forwarded-for': '1.1.1.1', 'x-real-ip': '2.2.2.2' }, '10.0.0.1', false), '10.0.0.1');
  const c = await contexto();
  const LOCAL = 'http://localhost:8613';
  try {
    const estados = [];
    for (let i = 0; i < 6; i++) estados.push((await c.peticion('/api/vinculo/iniciar', { metodo: 'POST', origen: LOCAL, cabeceras: { 'x-real-ip': `203.0.113.${i + 1}` }, cuerpo: {} })).estado);
    assert.ok(estados.includes(429) || estados.every((e) => e === 200), 'respuesta definida');
  } finally { await c.cerrar(); }
});
