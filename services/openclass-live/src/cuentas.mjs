/**
 * Interact: cuentas personales, invitaciones, verificación de correo, recuperación y sesiones revocables.
 * - Contraseñas: scrypt (auth.mjs). Tokens de un solo uso: 32 bytes aleatorios; en la base solo su SHA-256.
 * - Consumo atómico: `UPDATE ... WHERE usado IS NULL AND revocado IS NULL AND vence > ahora` (cambios = 1),
 *   de modo que una reutilización o una carrera entre dos peticiones nunca produce dos efectos.
 * - Respuestas seguras: autenticar/recuperar no distinguen entre cuenta inexistente y contraseña errónea.
 */
import { createHash, randomBytes } from 'node:crypto';
import { hashPassword, verificarPassword } from './auth.mjs';
import { transaccion } from './db.mjs';

export class ErrorCuenta extends Error {
  constructor(codigo, mensaje) { super(mensaje); this.codigo = codigo; }
}
const falla = (codigo, mensaje) => { throw new ErrorCuenta(codigo, mensaje); };

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

const vistaUsuario = (u) => u && ({ id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, estado: u.estado,
  emailVerificado: Boolean(u.email_verificado), creado: u.creado, ultimoAcceso: u.ultimo_acceso });

export function crearCuentas(db, { ahora = Date.now, ttl = {} } = {}) {
  const T = { invitacion: (ttl.invitacionHoras ?? 72) * HORA, verificacion: (ttl.verificacionHoras ?? 48) * HORA,
    recuperacion: (ttl.recuperacionMin ?? 30) * 60_000 };
  const q = (sql) => db.prepare(sql);

  function auditar(actorId, accion, objetivo = '', detalle = '') {
    q('INSERT INTO auditoria (ts, actor_id, accion, objetivo, detalle) VALUES (?, ?, ?, ?, ?)').run(ahora(), actorId ?? null, accion, objetivo, String(detalle).slice(0, 300));
  }

  const porEmail = (email) => q('SELECT * FROM usuarios WHERE email = ?').get(email);
  const porId = (id) => q('SELECT * FROM usuarios WHERE id = ?').get(id);

  function emitirToken(tipo, { email, rol = null, usuarioId = null, creadoPor = null }) {
    const token = nuevoToken();
    const id = nuevoId();
    const t = ahora();
    q('INSERT INTO tokens (id, tipo, hash_token, email, rol, usuario_id, creado_por, creado, vence) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, tipo, hashToken(token), email, rol, usuarioId, creadoPor, t, t + T[tipo]);
    return { id, token, vence: t + T[tipo] };
  }

  /** Consume un token vigente de ese tipo (una sola vez). Devuelve su fila o null. */
  function consumir(tipo, token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const h = hashToken(token);
    const t = ahora();
    const r = q('UPDATE tokens SET usado = ? WHERE hash_token = ? AND tipo = ? AND usado IS NULL AND revocado IS NULL AND vence > ?').run(t, h, tipo, t);
    return r.changes === 1 ? q('SELECT * FROM tokens WHERE hash_token = ?').get(h) : null;
  }
  function inspeccionar(tipo, token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    return q('SELECT * FROM tokens WHERE hash_token = ? AND tipo = ? AND usado IS NULL AND revocado IS NULL AND vence > ?').get(hashToken(token), tipo, ahora()) ?? null;
  }
  const invalidarPendientes = (tipo, email) => q('UPDATE tokens SET revocado = ? WHERE tipo = ? AND email = ? AND usado IS NULL AND revocado IS NULL').run(ahora(), tipo, email);

  const api = {
    auditar,

    existeSuperusuario: () => Boolean(q("SELECT 1 AS x FROM usuarios WHERE rol = 'superusuario' LIMIT 1").get()),

    /** Inicialización segura: solo si no hay superusuario; sin credenciales por defecto. */
    crearSuperusuario({ email, password, nombre = '' }) {
      const e = normalizarEmail(email);
      validarPassword(password);
      return transaccion(db, () => {
        if (api.existeSuperusuario()) falla('ya_existe', 'Ya existe un superusuario.');
        if (porEmail(e)) falla('ya_existe', 'Ese correo ya está registrado.');
        const id = nuevoId();
        q('INSERT INTO usuarios (id, email, nombre, rol, hash, estado, email_verificado, creado) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
          .run(id, e, nombreValido(nombre), 'superusuario', hashPassword(password), 'activo', ahora());
        auditar(null, 'superusuario_inicializado', id);
        return vistaUsuario(porId(id));
      });
    },

    /** Cuenta interna del panel con contraseña compartida (modo heredado 0.3.0). No puede iniciar sesión por correo. */
    usuarioHeredado() {
      let u = porEmail(EMAIL_HEREDADO);
      if (!u) {
        q('INSERT INTO usuarios (id, email, nombre, rol, hash, estado, email_verificado, creado) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
          .run('heredado', EMAIL_HEREDADO, 'Docente (acceso heredado)', 'docente', HASH_INERTE, 'activo', ahora());
        u = porEmail(EMAIL_HEREDADO);
      }
      return vistaUsuario(u);
    },

    /** { usuario } | { error: 'credenciales' | 'no_verificado' | 'suspendido' }. Tiempo comparable si la cuenta no existe. */
    autenticar(email, password) {
      let e;
      try { e = normalizarEmail(email); } catch { verificarPassword(String(password ?? ''), HASH_INERTE); return { error: 'credenciales' }; }
      const u = e === EMAIL_HEREDADO ? null : porEmail(e);
      const ok = verificarPassword(typeof password === 'string' ? password : '', u?.hash ?? HASH_INERTE);
      if (!u || !ok) return { error: 'credenciales' };
      if (u.estado !== 'activo') return { error: 'suspendido' };
      if (!u.email_verificado) return { error: 'no_verificado' };
      q('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?').run(ahora(), u.id);
      return { usuario: vistaUsuario(porId(u.id)) };
    },

    usuario: (id) => vistaUsuario(porId(id)),

    // ---------- Invitaciones (solo superusuario) ----------
    invitar({ actorId, email, rol = 'docente' }) {
      const e = normalizarEmail(email);
      if (!ROLES.includes(rol)) falla('rol', 'Rol no válido');
      const existente = porEmail(e);
      if (existente?.email_verificado) falla('ya_existe', 'Ese correo ya tiene una cuenta activa.');
      invalidarPendientes('invitacion', e);
      const t = emitirToken('invitacion', { email: e, rol, creadoPor: actorId });
      auditar(actorId, 'invitacion_creada', e, rol);
      return { id: t.id, token: t.token, email: e, rol, vence: t.vence };
    },
    validarInvitacion(token) {
      const t = inspeccionar('invitacion', token);
      return t ? { email: t.email, rol: t.rol, vence: t.vence } : null;
    },
    aceptarInvitacion(token, { nombre, password }) {
      validarPassword(password);
      return transaccion(db, () => {
        const t = consumir('invitacion', token);
        if (!t) falla('token', 'La invitación no es válida o ya venció.');
        const previo = porEmail(t.email);
        if (previo?.email_verificado) falla('ya_existe', 'Ese correo ya tiene una cuenta activa.');
        const hash = hashPassword(password);
        let id;
        if (previo) { id = previo.id; q('UPDATE usuarios SET hash = ?, nombre = ?, rol = ? WHERE id = ?').run(hash, nombreValido(nombre), t.rol, id); } else {
          id = nuevoId();
          q('INSERT INTO usuarios (id, email, nombre, rol, hash, estado, email_verificado, creado) VALUES (?, ?, ?, ?, ?, ?, 0, ?)')
            .run(id, t.email, nombreValido(nombre), t.rol, hash, 'activo', ahora());
        }
        invalidarPendientes('verificacion', t.email);
        const v = emitirToken('verificacion', { email: t.email, usuarioId: id });
        auditar(id, 'invitacion_aceptada', t.email);
        return { usuario: vistaUsuario(porId(id)), tokenVerificacion: v.token };
      });
    },
    revocarInvitacion(id, actorId) {
      const r = q("UPDATE tokens SET revocado = ? WHERE id = ? AND tipo = 'invitacion' AND usado IS NULL AND revocado IS NULL").run(ahora(), id);
      if (r.changes !== 1) falla('no_encontrada', 'La invitación no existe o ya no está pendiente.');
      auditar(actorId, 'invitacion_revocada', id);
    },
    listarInvitaciones() {
      const t = ahora();
      return q("SELECT id, email, rol, creado, vence, usado, revocado FROM tokens WHERE tipo = 'invitacion' ORDER BY creado DESC LIMIT 200").all()
        .map((f) => ({ id: f.id, email: f.email, rol: f.rol, creado: f.creado, vence: f.vence,
          estado: f.usado ? 'aceptada' : f.revocado ? 'revocada' : f.vence <= t ? 'vencida' : 'pendiente' }));
    },

    // ---------- Verificación de correo ----------
    verificarCorreo(token) {
      return transaccion(db, () => {
        const t = consumir('verificacion', token);
        if (!t) falla('token', 'El enlace de verificación no es válido o ya venció.');
        q('UPDATE usuarios SET email_verificado = 1 WHERE id = ?').run(t.usuario_id);
        auditar(t.usuario_id, 'correo_verificado', t.email);
        return vistaUsuario(porId(t.usuario_id));
      });
    },
    /** Devuelve un token nuevo solo si hay una cuenta sin verificar; el llamador responde igual en cualquier caso. */
    reemitirVerificacion(email) {
      let e; try { e = normalizarEmail(email); } catch { return null; }
      const u = porEmail(e);
      if (!u || u.email_verificado || u.estado !== 'activo' || u.email === EMAIL_HEREDADO) return null;
      invalidarPendientes('verificacion', e);
      return { email: e, token: emitirToken('verificacion', { email: e, usuarioId: u.id }).token };
    },

    // ---------- Recuperación de contraseña ----------
    solicitarRecuperacion(email) {
      let e; try { e = normalizarEmail(email); } catch { return null; }
      const u = porEmail(e);
      if (!u || u.estado !== 'activo' || !u.email_verificado || u.email === EMAIL_HEREDADO) return null;
      invalidarPendientes('recuperacion', e);
      auditar(u.id, 'recuperacion_solicitada', e);
      return { email: e, token: emitirToken('recuperacion', { email: e, usuarioId: u.id }).token };
    },
    validarRecuperacion: (token) => Boolean(inspeccionar('recuperacion', token)),
    restablecerPassword(token, password) {
      validarPassword(password);
      return transaccion(db, () => {
        const t = consumir('recuperacion', token);
        if (!t) falla('token', 'El enlace no es válido o ya venció.');
        q('UPDATE usuarios SET hash = ?, email_verificado = 1 WHERE id = ?').run(hashPassword(password), t.usuario_id);
        q('UPDATE sesiones_cuenta SET revocada = ? WHERE usuario_id = ? AND revocada IS NULL').run(ahora(), t.usuario_id);
        auditar(t.usuario_id, 'password_restablecida', t.email);
        return vistaUsuario(porId(t.usuario_id));
      });
    },

    // ---------- Administración ----------
    listarUsuarios: () => q('SELECT * FROM usuarios WHERE email <> ? ORDER BY creado').all(EMAIL_HEREDADO).map(vistaUsuario),
    cambiarEstado(id, estado, actorId) {
      if (!['activo', 'suspendido'].includes(estado)) falla('estado', 'Estado no válido');
      const u = porId(id);
      if (!u || u.email === EMAIL_HEREDADO) falla('no_encontrada', 'Usuario inexistente');
      if (id === actorId) falla('prohibido', 'No puede cambiar el estado de su propia cuenta.');
      q('UPDATE usuarios SET estado = ? WHERE id = ?').run(estado, id);
      if (estado === 'suspendido') q('UPDATE sesiones_cuenta SET revocada = ? WHERE usuario_id = ? AND revocada IS NULL').run(ahora(), id);
      auditar(actorId, estado === 'suspendido' ? 'usuario_suspendido' : 'usuario_reactivado', id);
      return vistaUsuario(porId(id));
    },
    listarAuditoria: (limite = 200) => q('SELECT a.id, a.ts, a.actor_id AS actorId, u.email AS actorEmail, a.accion, a.objetivo, a.detalle FROM auditoria a LEFT JOIN usuarios u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT ?').all(limite),
    /** Elimina auditoría anterior al umbral y tokens/sesiones ya inútiles (política de conservación). */
    purgar({ auditoriaDias = 730 } = {}) {
      const t = ahora();
      const a = q('DELETE FROM auditoria WHERE ts < ?').run(t - auditoriaDias * 86_400_000).changes;
      const k = q('DELETE FROM tokens WHERE vence < ?').run(t - 7 * 86_400_000).changes;
      const s = q('DELETE FROM sesiones_cuenta WHERE vence < ? OR (revocada IS NOT NULL AND revocada < ?)').run(t, t - 86_400_000).changes;
      return { auditoria: a, tokens: k, sesiones: s };
    },
  };
  return api;
}

/** Sesiones del panel respaldadas por la base: sobreviven a reinicios y se revocan por sesión o por usuario. */
export function crearSesionesDb(db, { ahora = Date.now } = {}) {
  const oyentes = [];
  const q = (sql) => db.prepare(sql);
  const h = (sid) => createHash('sha256').update(String(sid)).digest('base64url');
  let heredado = null;
  return {
    alRevocar: (fn) => { oyentes.push(fn); },
    /** Sin `usuarioId` se usa la cuenta heredada (compatibilidad con la contraseña compartida de 0.3.0). */
    crear(segundos, usuarioId = null, tipo = 'panel') {
      if (!usuarioId) {
        heredado ??= crearCuentas(db, { ahora }).usuarioHeredado().id;
        usuarioId = heredado;
      }
      const sid = randomBytes(18).toString('base64url');
      q('INSERT INTO sesiones_cuenta (sid_hash, usuario_id, tipo, creada, vence) VALUES (?, ?, ?, ?, ?)').run(h(sid), usuarioId, tipo, ahora(), ahora() + segundos * 1000);
      return sid;
    },
    /** Sesión viva Y cuenta activa. */
    valida(sid) { return Boolean(this.usuario(sid)); },
    usuario(sid) {
      if (typeof sid !== 'string' || !sid) return null;
      return q(`SELECT u.id, u.email, u.nombre, u.rol FROM sesiones_cuenta s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.sid_hash = ? AND s.revocada IS NULL AND s.vence > ? AND u.estado = 'activo'`).get(h(sid), ahora()) ?? null;
    },
    revocar(sid) {
      const r = q('UPDATE sesiones_cuenta SET revocada = ? WHERE sid_hash = ? AND revocada IS NULL AND vence > ?').run(ahora(), h(sid), ahora());
      if (r.changes) for (const fn of oyentes) fn(sid);
      return r.changes > 0;
    },
    purgar() { q('DELETE FROM sesiones_cuenta WHERE vence < ?').run(ahora()); },
  };
}
