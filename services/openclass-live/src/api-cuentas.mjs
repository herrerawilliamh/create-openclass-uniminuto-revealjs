/**
 * Interact: API de cuentas, invitaciones, historial, administración y vínculo con OpenClass local.
 * Se monta desde http.mjs, que le presta sus utilidades (`util`). Toda ruta de cambio de estado exige
 * mismo origen; las que usan la cookie del panel exigen además CSRF; el rol se comprueba aquí (backend).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { enlaces, plantillas } from './correo.mjs';
import { ErrorCuenta } from './cuentas.mjs';
import { ErrorSala } from './salas.mjs';
import * as V from './validar.mjs';

const TEXTO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VINCULO_MS = 5 * 60_000;
const SESION_VINCULO_H = 8;
const sha = (t) => createHash('sha256').update(String(t)).digest('base64url');
const iguales = (a, b) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

export function crearApiCuentas({ config, firmador, sesiones, cuentas, historial, correo, almacen, log, limitadorCuenta, limitadorTokens, util }) {
  const { enviar, leerJson, mismoOrigen, sesionDesdeCookie, ipCliente } = util;
  const url = enlaces(config.appUrl);
  const claveCuenta = (prefijo, email) => `${prefijo}:${createHash('sha256').update(String(email).trim().toLowerCase()).digest('base64url')}`;
  const vinculos = new Map(); // id → { codigoHash, secretoHash, vence, usuarioId|null, entregado }

  const ts = (ms) => new Date(ms).toISOString();
  async function mandar(tipo, para, token, extra = {}) {
    const vence = { invitacion: config.invitacionHoras * 3600_000, verificacion: config.verificacionHoras * 3600_000, recuperacion: config.recuperacionMin * 60_000 }[tipo];
    const m = plantillas[tipo]({ enlace: url[tipo](token), venceTexto: ts(Date.now() + vence), ...extra });
    try {
      const r = await correo.enviar({ para, ...m });
      return r.enviado ? 'enviado' : r.simulado ? 'simulado' : 'desactivado';
    } catch { return 'fallido'; }
  }
  /** Cuenta que firma la petición: cookie + CSRF para POST. Devuelve { usuario, sid } o responde el error y devuelve null. */
  async function requerirSesion(req, res, { csrf = false, rol = null } = {}) {
    const s = await sesionDesdeCookie(req.headers.cookie);
    if (!s?.usuario) { enviar(res, 401, { error: 'no_autenticado' }); return null; }
    if (csrf && req.headers['x-oc-csrf'] !== firmador.csrf(s.sid)) { enviar(res, 403, { error: 'csrf' }); return null; }
    if (rol && s.usuario.rol !== rol) { enviar(res, 403, { error: 'prohibido' }); return null; }
    return s;
  }
  const exigirOrigen = (req, res) => (mismoOrigen(req) ? true : (enviar(res, 403, { error: 'origen' }), false));
  const limitarIp = (req, res) => {
    const ip = ipCliente(req);
    if (limitadorTokens.permitir(ip)) return true;
    enviar(res, 429, { error: 'demasiados_intentos' }, undefined, { 'Retry-After': '30' });
    return false;
  };
  const errorCuenta = (res, e) => {
    if (!(e instanceof ErrorCuenta)) throw e;
    const estado = { token: 400, email: 400, password: 400, rol: 400, estado: 400, ya_existe: 409, no_encontrada: 404, prohibido: 403 }[e.codigo] ?? 400;
    return enviar(res, estado, { error: e.codigo === 'token' ? 'token_invalido' : e.codigo, mensaje: e.message });
  };
  const textoCorto = (v, n = 254) => (typeof v === 'string' && v.length <= n ? v : '');
  const fecha = (v) => { const n = Date.parse(String(v ?? '')); return Number.isFinite(n) ? n : undefined; };

  // ---------- Vínculo con la aplicación local (CORS solo para orígenes de presentación) ----------
  const origenLocal = (req) => (config.origenesPresentador.includes(req.headers.origin) ? req.headers.origin : null);
  const cors = (req) => {
    const o = origenLocal(req);
    return o ? { 'Access-Control-Allow-Origin': o, Vary: 'Origin' } : {};
  };
  /** Red aproximada del solicitante (último tramo oculto): contexto orientativo, no identidad. */
  const enmascarar = (ip) => String(ip ?? '').replace(/(\d+\.\d+)\.\d+\.\d+$/, '$1.x.x').replace(/(:[0-9a-f]*){2,}$/i, ':…');
  function purgarVinculos() { const t = Date.now(); for (const [id, v] of vinculos) if (v.vence <= t) vinculos.delete(id); }
  async function bearer(req) {
    const m = /^Bearer (.{20,400})$/.exec(String(req.headers.authorization ?? ''));
    const d = m && firmador.verificar(m[1], 'vinculo');
    const u = d && await sesiones.usuario(d.sid);
    return u ? { usuario: u, sid: d.sid } : null;
  }

  return async function manejar(req, res, ruta, consulta) {
    const m = req.method;

    // ===== Preflight del vínculo =====
    if (m === 'OPTIONS' && ruta.startsWith('/api/vinculo/')) {
      if (!origenLocal(req)) return enviar(res, 403, { error: 'origen' }), true;
      enviar(res, 204, '', 'text/plain', { ...cors(req), 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' });
      return true;
    }

    // ===== Lecturas con sesión =====
    if (m === 'GET') {
      if (ruta === '/api/yo') {
        const s = await requerirSesion(req, res); if (!s) return true;
        enviar(res, 200, { usuario: s.usuario, csrf: firmador.csrf(s.sid) });
        return true;
      }
      if (ruta === '/api/historial' || ruta === '/api/historial.csv') {
        const s = await requerirSesion(req, res); if (!s) return true;
        const admin = s.usuario.rol === 'superusuario';
        const filtros = { propietarioId: admin ? undefined : s.usuario.id, q: textoCorto(consulta.get('q'), 80), estado: textoCorto(consulta.get('estado'), 20),
          desde: fecha(consulta.get('desde')), hasta: fecha(consulta.get('hasta')), ...(admin ? { usuario: textoCorto(consulta.get('usuario'), 80) } : {}) };
        if (ruta === '/api/historial.csv') {
          await cuentas.auditar(s.usuario.id, 'historial_exportado', admin ? 'global' : 'propio');
          enviar(res, 200, await historial.csv(filtros), 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="interact-sesiones.csv"' });
          return true;
        }
        const pagina = Math.max(0, Number.parseInt(consulta.get('desplazamiento') ?? '0', 10) || 0);
        enviar(res, 200, { ...(await historial.listar({ ...filtros, limite: 50, desplazamiento: pagina })), ambito: admin ? 'global' : 'propio' });
        return true;
      }
      if (ruta === '/api/historial/detalle') {
        const s = await requerirSesion(req, res); if (!s) return true;
        // Un docente solo ve lo propio: la consulta incluye el propietario, no depende del identificador.
        const d = await historial.detalle(textoCorto(consulta.get('id'), 64), { propietarioId: s.usuario.rol === 'superusuario' ? null : s.usuario.id });
        enviar(res, d ? 200 : 404, d ?? { error: 'no_encontrado' });
        return true;
      }
      if (ruta.startsWith('/api/admin/')) {
        const s = await requerirSesion(req, res, { rol: 'superusuario' }); if (!s) return true;
        if (ruta === '/api/admin/usuarios') enviar(res, 200, { usuarios: await cuentas.listarUsuarios() });
        else if (ruta === '/api/admin/invitaciones') enviar(res, 200, { invitaciones: await cuentas.listarInvitaciones(), correo: { transporte: correo.transporte, real: correo.real } });
        else if (ruta === '/api/admin/auditoria') enviar(res, 200, { eventos: await cuentas.listarAuditoria() });
        else enviar(res, 404, { error: 'no_encontrado' });
        return true;
      }
      return false;
    }

    if (m !== 'POST') return false;

    // ===== Vínculo (no usa la cookie del panel salvo «aprobar») =====
    if (ruta === '/api/vinculo/iniciar' || ruta === '/api/vinculo/sondear' || ruta === '/api/vinculo/clase' || ruta === '/api/vinculo/salir') {
      const origen = origenLocal(req);
      if (!origen) return enviar(res, 403, { error: 'origen' }), true;
      const extra = cors(req);
      const out = (estado, cuerpo) => enviar(res, estado, cuerpo, undefined, extra);
      if (!limitarIp(req, res)) return true;
      purgarVinculos();
      const cuerpo = await leerJson(req);

      if (ruta === '/api/vinculo/iniciar') {
        const ipV = ipCliente(req);
        if (vinculos.size >= 200 || [...vinculos.values()].filter((v) => v.ip === ipV).length >= 5) return out(429, { error: 'demasiados_intentos' }), true; // cupo global y por IP
        const id = randomBytes(9).toString('base64url');
        const secreto = randomBytes(24).toString('base64url');
        let codigo = '';
        for (let i = 0; i < 8; i++) codigo += TEXTO_CODIGO[randomBytes(1)[0] % TEXTO_CODIGO.length];
        vinculos.set(id, { ip: ipV, origen, creado: Date.now(), codigoHash: sha(codigo), secretoHash: sha(secreto), vence: Date.now() + VINCULO_MS, usuarioId: null, entregado: false });
        // El navegador del sistema abre /vincular/ SIN token en la URL: la persona escribe el código que ve en la presentación.
        out(200, { id, secreto, codigo: `${codigo.slice(0, 4)}-${codigo.slice(4)}`, url: `${config.appUrl}/vincular/`, venceEn: VINCULO_MS / 1000 });
        return true;
      }
      if (ruta === '/api/vinculo/sondear') {
        const v = vinculos.get(textoCorto(cuerpo.id, 40));
        if (!v || !iguales(v.secretoHash, sha(textoCorto(cuerpo.secreto, 100)))) return out(404, { error: 'vinculo_invalido' }), true;
        if (v.vence <= Date.now()) { vinculos.delete(cuerpo.id); return out(410, { error: 'vencido' }), true; }
        if (!v.usuarioId) return out(200, { estado: 'pendiente' }), true;
        vinculos.delete(cuerpo.id); // se entrega una sola vez
        const u = await cuentas.usuario(v.usuarioId);
        // Una cuenta suspendida entre la aprobación y el sondeo no recibe credencial.
        if (!u || u.estado !== 'activo') return out(403, { error: 'prohibido' }), true;
        const sid = await sesiones.crear(SESION_VINCULO_H * 3600, v.usuarioId, 'vinculo');
        await cuentas.auditar(v.usuarioId, 'vinculo_local_creado');
        out(200, { estado: 'aprobado', credencial: firmador.firmar({ t: 'vinculo', sid }, SESION_VINCULO_H * 3600), usuario: { nombre: u.nombre, email: u.email, rol: u.rol } });
        return true;
      }
      const b = await bearer(req);
      if (!b) return out(401, { error: 'no_autenticado' }), true;
      if (ruta === '/api/vinculo/salir') { await sesiones.revocar(b.sid); out(200, { ok: true }); return true; }
      // «Iniciar clase»: acción explícita, separada de «Iniciar sesión». Nunca ocurre sola.
      try {
        const datos = V.crearSala({ titulo: cuerpo.titulo, preModeracion: cuerpo.preModeracion, conservarResultados: cuerpo.conservarResultados });
        const sala = almacen.crearSala({ ...datos, propietarioId: b.usuario.id });
        // Sin bloquear la clase: si la base falla, el punto de control periódico registra la sala después.
        await historial.abrir(almacen.resumenPersistible(sala.id)).catch((error) => log('historial_alta_fallida', { tipo: error.name }));
        const clave = firmador.firmar({ t: 'presentador', s: sala.id, v: sala.versionPresentador }, Math.max(60, Math.floor((sala.vence - Date.now()) / 1000)));
        log('sala_creada', { sala: sala.id.slice(0, 6), via: 'vinculo' });
        out(200, { sala, enlace: `${config.appUrl}/join/${sala.codigo}`, qr: `${config.appUrl}/qr/${sala.codigo}.svg`, clave });
      } catch (e) {
        if (e instanceof ErrorSala) return out(409, { error: e.codigo, mensaje: e.message }), true;
        if (e instanceof V.ErrorValidacion) return out(400, { error: 'validacion', mensaje: e.message }), true;
        throw e;
      }
      return true;
    }

    // ===== Resto: mismo origen exacto =====
    if (!ruta.startsWith('/api/auth/') && !ruta.startsWith('/api/admin/') && !ruta.startsWith('/api/historial/') && ruta !== '/api/vinculo/aprobar') return false;
    if (!exigirOrigen(req, res)) return true;

    // ----- Públicas -----
    if (ruta.startsWith('/api/auth/') && ruta !== '/api/auth/logout') {
      if (!limitarIp(req, res)) return true;
      const c = await leerJson(req);

      if (ruta === '/api/auth/login') {
        const email = textoCorto(c.email);
        const clave = claveCuenta('login', email); // variantes con espacios o mayúsculas comparten cubeta; olvide/reenviar no la gastan
        if (!limitadorCuenta.permitir(clave)) { log('login_limitado'); return enviar(res, 429, { error: 'demasiados_intentos' }, undefined, { 'Retry-After': '60' }), true; }
        const r = await cuentas.autenticar(email, c.password);
        if (r.error === 'credenciales' || r.error === 'suspendido') {
          log('login_fallido');
          // Mismo mensaje para cuenta inexistente, contraseña errónea o cuenta suspendida.
          return enviar(res, 401, { error: 'credenciales' }), true;
        }
        if (r.error === 'no_verificado') return enviar(res, 403, { error: 'no_verificado' }), true;
        limitadorCuenta.olvidar(clave);
        const segundos = config.sesionDocenteHoras * 3600;
        const sid = await sesiones.crear(segundos, r.usuario.id);
        log('login_ok', { cuenta: true });
        return enviar(res, 200, { autenticado: true, csrf: firmador.csrf(sid), usuario: { id: r.usuario.id, nombre: r.usuario.nombre, email: r.usuario.email, rol: r.usuario.rol } }, undefined,
          { 'Set-Cookie': util.cookieSesion(firmador.firmar({ t: 'docente', sid }, segundos), segundos) }), true;
      }
      if (ruta === '/api/auth/invitacion/validar') {
        const i = await cuentas.validarInvitacion(c.token);
        return enviar(res, i ? 200 : 404, i ? { email: i.email, rol: i.rol } : { error: 'token_invalido' }), true;
      }
      if (ruta === '/api/auth/invitacion/aceptar') {
        try {
          const r = await cuentas.aceptarInvitacion(c.token, { nombre: c.nombre, password: c.password });
          const estado = await mandar('verificacion', r.usuario.email, r.tokenVerificacion);
          return enviar(res, 200, { ok: true, correo: estado, email: r.usuario.email }), true;
        } catch (e) { return errorCuenta(res, e), true; }
      }
      if (ruta === '/api/auth/verificar') {
        try { await cuentas.verificarCorreo(c.token); return enviar(res, 200, { ok: true }), true; } catch (e) { return errorCuenta(res, e), true; }
      }
      if (ruta === '/api/auth/verificacion/reenviar' || ruta === '/api/auth/olvide') {
        const email = textoCorto(c.email);
        const clave = claveCuenta(ruta.endsWith('reenviar') ? 'reenviar' : 'olvide', email);
        if (limitadorCuenta.permitir(clave)) {
          const esVerif = ruta.endsWith('reenviar');
          const t = await (esVerif ? cuentas.reemitirVerificacion(email) : cuentas.solicitarRecuperacion(email));
          if (t) mandar(esVerif ? 'verificacion' : 'recuperacion', t.email, t.token); // sin await: la latencia SMTP no revela si la cuenta existe
        }
        // Respuesta idéntica exista o no la cuenta (y también si se limitó): no revela cuentas.
        return enviar(res, 202, { ok: true, mensaje: 'Si la dirección corresponde a una cuenta, recibirá un correo con las instrucciones.' }), true;
      }
      if (ruta === '/api/auth/restablecer/validar') {
        const ok = await cuentas.validarRecuperacion(c.token);
        return enviar(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'token_invalido' }), true;
      }
      if (ruta === '/api/auth/restablecer') {
        try { await cuentas.restablecerPassword(c.token, c.password); return enviar(res, 200, { ok: true }), true; } catch (e) { return errorCuenta(res, e), true; }
      }
      return enviar(res, 404, { error: 'no_encontrado' }), true;
    }

    // ----- Con sesión + CSRF -----
    if (ruta === '/api/vinculo/aprobar') {
      const s = await requerirSesion(req, res, { csrf: true }); if (!s) return true;
      if (!limitarIp(req, res)) return true;
      const c = await leerJson(req);
      const codigo = textoCorto(c.codigo, 12).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      purgarVinculos();
      const h = sha(codigo);
      const v = [...vinculos.values()].find((x) => !x.usuarioId && iguales(x.codigoHash, h));
      if (!codigo || !v) return enviar(res, 404, { error: 'codigo_invalido' }), true;
      // Doble paso: el código por sí solo no concede nada. Se muestra el contexto declarado por quien lo pidió
      // (origen y hora; la red solo si el proxy es de confianza) y la persona debe confirmar. Nada de esto acredita identidad.
      if (c.confirmar !== true) {
        return enviar(res, 200, { pendiente: true, contexto: { origen: v.origen, hace: Math.max(0, Math.round((Date.now() - v.creado) / 1000)), red: enmascarar(v.ip), verificado: false } }), true;
      }
      v.usuarioId = s.usuario.id;
      await cuentas.auditar(s.usuario.id, 'vinculo_local_aprobado', `origen=${v.origen}`);
      return enviar(res, 200, { ok: true }), true;
    }
    if (ruta === '/api/historial/eliminar') {
      const s = await requerirSesion(req, res, { csrf: true }); if (!s) return true;
      const c = await leerJson(req);
      const ok = await historial.eliminar(textoCorto(c.id, 64), { propietarioId: s.usuario.rol === 'superusuario' ? null : s.usuario.id });
      if (ok) await cuentas.auditar(s.usuario.id, 'historial_eliminado', textoCorto(c.id, 64));
      return enviar(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'no_encontrado' }), true;
    }
    if (ruta.startsWith('/api/admin/')) {
      const s = await requerirSesion(req, res, { csrf: true, rol: 'superusuario' }); if (!s) return true;
      const c = await leerJson(req);
      try {
        if (ruta === '/api/admin/invitaciones') {
          const i = await cuentas.invitar({ actorId: s.usuario.id, email: c.email, rol: c.rol ?? 'docente' });
          const estado = await mandar('invitacion', i.email, i.token, { rol: i.rol });
          // Si el correo no salió de verdad, el administrador recibe el enlace para entregarlo por otro medio.
          const manual = estado === 'enviado' ? {} : { enlaceManual: url.invitacion(i.token) };
          return enviar(res, 201, { id: i.id, email: i.email, rol: i.rol, vence: i.vence, correo: estado, ...manual }), true;
        }
        if (ruta === '/api/admin/invitaciones/revocar') { await cuentas.revocarInvitacion(textoCorto(c.id, 40), s.usuario.id); return enviar(res, 200, { ok: true }), true; }
        if (ruta === '/api/admin/usuarios/estado') { return enviar(res, 200, { usuario: await cuentas.cambiarEstado(textoCorto(c.id, 40), c.estado, s.usuario.id) }), true; }
        if (ruta === '/api/admin/retencion') {
          const h = await historial.purgar(config.historialDias);
          const k = await cuentas.purgar({ auditoriaDias: config.auditoriaDias });
          await cuentas.auditar(s.usuario.id, 'retencion_aplicada', '', `historial=${h}`);
          return enviar(res, 200, { historial: h, ...k }), true;
        }
      } catch (e) { return errorCuenta(res, e), true; }
    }
    return false;
  };
}
