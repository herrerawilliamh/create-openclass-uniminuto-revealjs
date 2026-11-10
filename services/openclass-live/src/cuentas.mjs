/**
 * Interact: cuentas personales, invitaciones, verificación de correo, recuperación y sesiones revocables (PostgreSQL).
 * - Contraseñas: scrypt (auth.mjs). Tokens de un solo uso: 32 bytes aleatorios; en la base solo su SHA-256.
 * - Consumo atómico: un único `UPDATE … WHERE usado IS NULL AND revocado IS NULL AND vence > ahora RETURNING *`.
 *   PostgreSQL bloquea la fila: de dos peticiones simultáneas con el mismo token solo una obtiene la fila;
 *   la otra reevalúa el WHERE tras el bloqueo y no encuentra nada. Nunca hay dos efectos.
 * - Las operaciones con varios pasos (aceptar invitación, verificar, restablecer, suspender) van en una
 *   transacción: o se aplican completas con su auditoría o no se aplica nada.
 * - El hash scrypt se calcula ANTES de abrir la transacción (no se retiene una conexión durante el cálculo).
 * - Respuestas seguras: autenticar/recuperar no distinguen entre cuenta inexistente y contraseña errónea.
 */
import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verificarPassword } from './auth.mjs';

export class ErrorCuenta extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo; }
}
const falla = (codigo, mensaje) => { throw new ErrorCuenta(codigo, mensaje); };
const esUnicidad = (e) => e?.code === '23505';

export const ROLES = Object.freeze(['superusuario', 'docente']);
export const EMAIL_HEREDADO = 'docente-heredado@interact.invalid';
const HASH_INERTE = hashPassword('contrasena-inerte-no-valida');
const HORA = 3_600_000;

const nuevoId = () => randomBytes(12).toString('base64url');
const nuevoToken = () => randomBytes(32).toString('base64url');
const hashToken = (t) => createHash('sha256').update(String(t)).digest('base64url');

export function normalizarEmail(email) {
  const e = String(email ?? '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@<>()[\],;:"\\]+@[^\s@<>()[\],;:"\\]+\.[^\s@<>()[\],;:"\\.]{2,}$/.test(e)) falla('email', 'Correo electrónico no válido');
  return e;
}
function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) falla('password', 'La contraseña debe tener entre 12 y 256 caracteres.');
}
const nombreValido = (n) => String(n ?? '').normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
const tokenPlausible = (t) => typeof t === 'string' && t.length >= 20 && t.length <= 100;

const vistaUsuario = (u) => u && ({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, estado: u.estado,
  emailVerificado: Boolean(u.email_verificado), creado: u.creado, ultimoAcceso: u.ultimo_acceso });

const porEmail = (d, email) => d.uno('SELECT * FROM usuarios WHERE lower(email) = lower($1)', [email]);
const porId = (d, id) => d.uno('SELECT * FROM usuarios WHERE id = $1', [String(id ?? '')]);

export function crearCuentas(db, { ahora = Date.now, ttl = {} } = {}) {
  const T = { invitacion: (ttl.invitacionHoras ?? 72) * HORA, verificacion: (ttl.verificacionHoras ?? 48) * HORA,
    recuperacion: (ttl.recuperacionMin ?? 30) * 60_000 };

  const auditarEn = (d, actorId, accion, objetivo = '', detalle = '') => d.exec(
    'INSERT INTO auditoria (ts, actor_id, accion, objetivo, detalle) VALUES ($1, $2, $3, $4, $5)',
    [ahora(), actorId ?? null, accion, String(objetivo).slice(0, 300), String(detalle).slice(0, 300)]);

  async function emitirToken(d, tipo, { email, rol = null, usuarioId = null, creadoPor = null }) {
    const token = nuevoToken();
    const id = nuevoId();
    const t = ahora();
    await d.exec('INSERT INTO tokens (id, tipo, hash_token, email, rol, usuario_id, creado_por, creado, vence) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [id, tipo, hashToken(token), email, rol, usuarioId, creadoPor, t, t + T[tipo]]);
    return { id, token, vence: t + T[tipo] };
  }

  /** Consume un token vigente de ese tipo (una sola vez, atómico). Devuelve su fila o null. */
  function consumir(d, tipo, token) {
    if (!tokenPlausible(token)) return null;
    const t = ahora();
    return d.uno('UPDATE tokens SET usado = $1 WHERE hash_token = $2 AND tipo = $3 AND usado IS NULL AND revocado IS NULL AND vence > $1 RETURNING *',
      [t, hashToken(token), tipo]);
  }
  async function inspeccionar(tipo, token) {
    if (!tokenPlausible(token)) return null;
    return db.uno('SELECT * FROM tokens WHERE hash_token = $1 AND tipo = $2 AND usado IS NULL AND revocado IS NULL AND vence > $3', [hashToken(token), tipo, ahora()]);
  }
  const invalidarPendientes = (d, tipo, email) => d.exec('UPDATE tokens SET revocado = $1 WHERE tipo = $2 AND email = $3 AND usado IS NULL AND revocado IS NULL', [ahora(), tipo, email]);
  const revocarSesionesDe = (d, usuarioId) => d.exec('UPDATE sesiones_cuenta SET revocada = $1 WHERE usuario_id = $2 AND revocada IS NULL', [ahora(), usuarioId]);

  const api = {
    auditar: (actorId, accion, objetivo = '', detalle = '') => auditarEn(db, actorId, accion, objetivo, detalle),

    existeSuperusuario: async () => Boolean(await db.uno("SELECT 1 AS x FROM usuarios WHERE rol = 'superusuario' LIMIT 1")),

    /** Inicialización segura: solo si no hay superusuario; sin credenciales por defecto. Serializada con un bloqueo. */
    async crearSuperusuario({ email, password, nombre = '' }) {
      const e = normalizarEmail(email);
      validarPassword(password);
      const hash = hashPassword(password);
      return db.tx(async (t) => {
        await t.q("SELECT pg_advisory_xact_lock(hashtext('interact:superusuario'))");
        if (await t.uno("SELECT 1 AS x FROM usuarios WHERE rol = 'superusuario' LIMIT 1")) falla('ya_existe', 'Ya existe un superusuario.');
        if (await porEmail(t, e)) falla('ya_existe', 'Ese correo ya está registrado.');
        const id = nuevoId();
        await t.exec('INSERT INTO usuarios (id, email, nombre, rol, hash, estado, email_verificado, creado) VALUES ($1, $2, $3, $4, $5, $6, true, $7)',
          [id, e, nombreValido(nombre), 'superusuario', hash, 'activo', ahora()]);
        await auditarEn(t, null, 'superusuario_inicializado', id);
        return vistaUsuario(await porId(t, id));
      });
    },

    /** Cuenta interna del panel con contraseña compartida (modo heredado 0.3.0). No puede iniciar sesión por correo. */
    async usuarioHeredado() {
      await db.exec(`INSERT INTO usuarios (id, email, nombre, rol, hash, estado, email_verificado, creado)
        VALUES ('heredado', $1, 'Docente (acceso heredado)', 'docente', $2, 'activo', true, $3) ON CONFLICT DO NOTHING`, [EMAIL_HEREDADO, HASH_INERTE, ahora()]);
      return vistaUsuario(await porEmail(db, EMAIL_HEREDADO));
    },

    /** { usuario } | { error: 'credenciales' | 'no_verificado' | 'suspendido' }. Tiempo comparable si la cuenta no existe. */
    async autenticar(email, password) {
      let e;
      try { e = normalizarEmail(email); } catch { verificarPassword(String(password ?? ''), HASH_INERTE); return { error: 'credenciales' }; }
      const u = e === EMAIL_HEREDADO ? null : await porEmail(db, e);
      const ok = verificarPassword(typeof password === 'string' ? password : '', u?.hash ?? HASH_INERTE);
      if (!u || !ok) return { error: 'credenciales' };
      if (u.estado !== 'activo') return { error: 'suspendido' };
      if (!u.email_verificado) return { error: 'no_verificado' };
      const fila = await db.uno('UPDATE usuarios SET ultimo_acceso = $1 WHERE id = $2 RETURNING *', [ahora(), u.id]);
      return { usuario: vistaUsuario(fila) };
    },

    usuario: async (id) => vistaUsuario(await porId(db, id)),

    // ---------- Invitaciones (solo superusuario; el rol se comprueba en api-cuentas.mjs) ----------
    async invitar({ actorId, email, rol = 'docente' }) {
      const e = normalizarEmail(email);
      if (!ROLES.includes(rol)) falla('rol', 'Rol no válido');
      return db.tx(async (t) => {
        const existente = await porEmail(t, e);
        if (existente?.email_verificado) falla('ya_existe', 'Ese correo ya tiene una cuenta activa.');
        await invalidarPendientes(t, 'invitacion', e);
        const k = await emitirToken(t, 'invitacion', { email: e, rol, creadoPor: actorId });
        await auditarEn(t, actorId, 'invitacion_creada', e, rol);
        return { id: k.id, token: k.token, email: e, rol, vence: k.vence };
      });
    },
    async validarInvitacion(token) {
      const t = await inspeccionar('invitacion', token);
      return t ? { email: t.email, rol: t.rol, vence: t.vence } : null;
    },
    async aceptarInvitacion(token, { nombre, password }) {
      validarPassword(password);
      if (!tokenPlausible(token)) falla('token', 'La invitación no es válida o ya venció.');
      const hash = hashPassword(password);
      try {
        return await db.tx(async (t) => {
          const k = await consumir(t, 'invitacion', token);
          if (!k) falla('token', 'La invitación no es válida o ya venció.');
          const previo = await porEmail(t, k.email);
          if (previo?.email_verificado) falla('ya_existe', 'Ese correo ya tiene una cuenta activa.');
          let id;
          if (previo) {
            id = previo.id;
            await t.exec('UPDATE usuarios SET hash = $1, nombre = $2, rol = $3 WHERE id = $4', [hash, nombreValido(nombre), k.rol, id]);
          } else {
            id = nuevoId();
            await t.exec('INSERT INTO usuarios (id, email, nombre, rol, hash, estado, email_verificado, creado) VALUES ($1, $2, $3, $4, $5, $6, false, $7)',
              [id, k.email, nombreValido(nombre), k.rol, hash, 'activo', ahora()]);
          }
          await invalidarPendientes(t, 'verificacion', k.email);
          const v = await emitirToken(t, 'verificacion', { email: k.email, usuarioId: id });
          await auditarEn(t, id, 'invitacion_aceptada', k.email);
          return { usuario: vistaUsuario(await porId(t, id)), tokenVerificacion: v.token };
        });
      } catch (e) {
        // Dos aceptaciones simultáneas de invitaciones distintas para el mismo correo: gana una, la otra se revierte entera.
        if (esUnicidad(e)) falla('ya_existe', 'Ese correo ya tiene una cuenta.');
        throw e;
      }
    },
    async revocarInvitacion(id, actorId) {
      return db.tx(async (t) => {
        const r = await t.exec("UPDATE tokens SET revocado = $1 WHERE id = $2 AND tipo = 'invitacion' AND usado IS NULL AND revocado IS NULL", [ahora(), String(id ?? '')]);
        if (r.changes !== 1) falla('no_encontrada', 'La invitación no existe o ya no está pendiente.');
        await auditarEn(t, actorId, 'invitacion_revocada', id);
      });
    },
    async listarInvitaciones() {
      const t = ahora();
      return (await db.q("SELECT id, email, rol, creado, vence, usado, revocado FROM tokens WHERE tipo = 'invitacion' ORDER BY creado DESC, id LIMIT 200"))
        .map((f) => ({ id: f.id, email: f.email, rol: f.rol, creado: f.creado, vence: f.vence,
          estado: f.usado ? 'aceptada' : f.revocado ? 'revocada' : f.vence <= t ? 'vencida' : 'pendiente' }));
    },

    // ---------- Verificación de correo ----------
    async verificarCorreo(token) {
      return db.tx(async (t) => {
        const k = await consumir(t, 'verificacion', token);
        if (!k) falla('token', 'El enlace de verificación no es válido o ya venció.');
        const u = await t.uno('UPDATE usuarios SET email_verificado = true WHERE id = $1 RETURNING *', [k.usuario_id]);
        await auditarEn(t, k.usuario_id, 'correo_verificado', k.email);
        return vistaUsuario(u);
      });
    },
    /** Devuelve un token nuevo solo si hay una cuenta sin verificar; el llamador responde igual en cualquier caso. */
    async reemitirVerificacion(email) {
      let e; try { e = normalizarEmail(email); } catch { return null; }
      return db.tx(async (t) => {
        const u = await porEmail(t, e);
        if (!u || u.email_verificado || u.estado !== 'activo' || u.email === EMAIL_HEREDADO) return null;
        await invalidarPendientes(t, 'verificacion', e);
        return { email: e, token: (await emitirToken(t, 'verificacion', { email: e, usuarioId: u.id })).token };
      });
    },

    // ---------- Recuperación de contraseña ----------
    async solicitarRecuperacion(email) {
      let e; try { e = normalizarEmail(email); } catch { return null; }
      return db.tx(async (t) => {
        const u = await porEmail(t, e);
        if (!u || u.estado !== 'activo' || !u.email_verificado || u.email === EMAIL_HEREDADO) return null;
        await invalidarPendientes(t, 'recuperacion', e);
        await auditarEn(t, u.id, 'recuperacion_solicitada', e);
        return { email: e, token: (await emitirToken(t, 'recuperacion', { email: e, usuarioId: u.id })).token };
      });
    },
    validarRecuperacion: async (token) => Boolean(await inspeccionar('recuperacion', token)),
    async restablecerPassword(token, password) {
      validarPassword(password);
      if (!tokenPlausible(token)) falla('token', 'El enlace no es válido o ya venció.');
      const hash = hashPassword(password);
      return db.tx(async (t) => {
        const k = await consumir(t, 'recuperacion', token);
        if (!k) falla('token', 'El enlace no es válido o ya venció.');
        const u = await t.uno('UPDATE usuarios SET hash = $1, email_verificado = true WHERE id = $2 RETURNING *', [hash, k.usuario_id]);
        await revocarSesionesDe(t, k.usuario_id);
        await auditarEn(t, k.usuario_id, 'password_restablecida', k.email);
        return vistaUsuario(u);
      });
    },

    // ---------- Administración ----------
    listarUsuarios: async () => (await db.q('SELECT * FROM usuarios WHERE email <> $1 ORDER BY creado, id', [EMAIL_HEREDADO])).map(vistaUsuario),
    async cambiarEstado(id, estado, actorId) {
      if (!['activo', 'suspendido'].includes(estado)) falla('estado', 'Estado no válido');
      return db.tx(async (t) => {
        const u = await t.uno('SELECT * FROM usuarios WHERE id = $1 FOR UPDATE', [String(id ?? '')]);
        if (!u || u.email === EMAIL_HEREDADO) falla('no_encontrada', 'Usuario inexistente');
        if (id === actorId) falla('prohibido', 'No puede cambiar el estado de su propia cuenta.');
        const fila = await t.uno('UPDATE usuarios SET estado = $1 WHERE id = $2 RETURNING *', [estado, id]);
        if (estado === 'suspendido') await revocarSesionesDe(t, id);
        await auditarEn(t, actorId, estado === 'suspendido' ? 'usuario_suspendido' : 'usuario_reactivado', id);
        return vistaUsuario(fila);
      });
    },
    listarAuditoria: (limite = 200) => db.q(`SELECT a.id, a.ts, a.actor_id AS "actorId", u.email AS "actorEmail", a.accion, a.objetivo, a.detalle
      FROM auditoria a LEFT JOIN usuarios u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT $1`, [Math.min(Math.max(1, limite), 500)]),
    /** Elimina auditoría anterior al umbral y tokens/sesiones ya inútiles (política de conservación). */
    async purgar({ auditoriaDias = 730 } = {}) {
      const t = ahora();
      const a = (await db.exec('DELETE FROM auditoria WHERE ts < $1', [t - auditoriaDias * 86_400_000])).changes;
      const k = (await db.exec('DELETE FROM tokens WHERE vence < $1', [t - 7 * 86_400_000])).changes;
      const s = (await db.exec('DELETE FROM sesiones_cuenta WHERE vence < $1 OR (revocada IS NOT NULL AND revocada < $2)', [t, t - 86_400_000])).changes;
      return { auditoria: a, tokens: k, sesiones: s };
    },
  };
  return api;
}

/** Sesiones del panel respaldadas por la base: sobreviven a reinicios y se revocan por sesión o por usuario. */
export function crearSesionesDb(db, { ahora = Date.now } = {}) {
  const oyentes = [];
  const h = (sid) => createHash('sha256').update(String(sid)).digest('base64url');
  let heredado = null;
  const api = {
    alRevocar: (fn) => { oyentes.push(fn); },
    /** Sin `usuarioId` se usa la cuenta heredada (compatibilidad con la contraseña compartida de 0.3.0). */
    async crear(segundos, usuarioId = null, tipo = 'panel') {
      if (!usuarioId) {
        heredado ??= crearCuentas(db, { ahora }).usuarioHeredado().then((u) => u.id).catch((e) => { heredado = null; throw e; });
        usuarioId = await heredado;
      }
      const sid = randomBytes(18).toString('base64url');
      const t = ahora();
      await db.exec('INSERT INTO sesiones_cuenta (sid_hash, usuario_id, tipo, creada, vence) VALUES ($1, $2, $3, $4, $5)', [h(sid), usuarioId, tipo, t, t + segundos * 1000]);
      return sid;
    },
    /** Sesión viva Y cuenta activa. */
    valida: async (sid) => Boolean(await api.usuario(sid)),
    async usuario(sid) {
      if (typeof sid !== 'string' || !sid) return null;
      return db.uno(`SELECT u.id, u.email, u.nombre, u.rol FROM sesiones_cuenta s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.sid_hash = $1 AND s.revocada IS NULL AND s.vence > $2 AND u.estado = 'activo'`, [h(sid), ahora()]);
    },
    async revocar(sid) {
      if (typeof sid !== 'string' || !sid) return false;
      const t = ahora();
      const r = await db.exec('UPDATE sesiones_cuenta SET revocada = $1 WHERE sid_hash = $2 AND revocada IS NULL AND vence > $1', [t, h(sid)]);
      if (r.changes) for (const fn of oyentes) fn(sid);
      return r.changes > 0;
    },
    purgar: async () => { await db.exec('DELETE FROM sesiones_cuenta WHERE vence < $1', [ahora()]); },
  };
  return api;
}
