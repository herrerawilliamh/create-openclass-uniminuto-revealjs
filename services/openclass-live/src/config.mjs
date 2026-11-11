/**
 * OpenClass Live: configuración leída del entorno (.env en el despliegue).
 * Falla al arrancar si faltan secretos o si son débiles: nunca hay valores por defecto para ellos.
 */
import { readFileSync } from 'node:fs';
import { crearConfianzaProxy } from './limites.mjs';
const entero = (valor, defecto, min, max) => {
  if (valor === undefined || valor === '') return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Valor fuera de rango (${min}–${max}): ${valor}`);
  return n;
};

const lista = (valor) => String(valor ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/** Fuera de producción (pruebas) el único proxy implícito es el bucle local. En producción NO hay valor por defecto. */
const PROXY_LOCAL = '127.0.0.0/8,::1/128';

/**
 * Pares TCP cuyas cabeceras X-Forwarded-For se aceptan. En producción son OBLIGATORIOS y explícitos (la IP o subred
 * exacta del proxy de entrada, idealmente en una red dedicada Traefik–Interact); no se aceptan rangos genéricos
 * (todo Internet ni redes privadas completas), porque cualquier contenedor de esa red podría falsear su IP.
 */
export function leerProxy(env, produccion) {
  if (String(env.TRUST_PROXY ?? (produccion ? 'true' : 'false')) !== 'true') return false;
  const cidrs = lista(env.TRUSTED_PROXY_CIDRS ?? (produccion ? '' : PROXY_LOCAL));
  if (!cidrs.length) throw new Error('TRUST_PROXY=true exige TRUSTED_PROXY_CIDRS (IP/32 o subred exacta del proxy de entrada) o TRUST_PROXY=false.');
  if (produccion) {
    for (const c of cidrs) {
      const prefijo = Number(c.split('/')[1]);
      const v6 = c.includes(':');
      if (!Number.isInteger(prefijo) || prefijo < (v6 ? 64 : 24)) throw new Error(`TRUSTED_PROXY_CIDRS demasiado amplio para producción: ${c} (mínimo /24 en IPv4, /64 en IPv6).`);
    }
  }
  return crearConfianzaProxy(cidrs);
}

/** TLS hacia PostgreSQL (DB_SSL = desactivado | requerido | verificado; DB_SSL_CA_FILE = CA propia del proveedor). */
export function leerSsl(env) {
  const modoSsl = String(env.DB_SSL ?? 'desactivado');
  const ssl = { desactivado: false, requerido: { rejectUnauthorized: false }, verificado: { rejectUnauthorized: true } }[modoSsl];
  if (ssl === undefined) throw new Error('DB_SSL debe ser desactivado, requerido o verificado.');
  // CA propia del proveedor (opcional, solo con DB_SSL=verificado): se añade a la validación, no la desactiva.
  const rutaCa = String(env.DB_SSL_CA_FILE ?? '');
  if (rutaCa) {
    if (modoSsl !== 'verificado') throw new Error('DB_SSL_CA_FILE solo se admite con DB_SSL=verificado.');
    try { ssl.ca = readFileSync(rutaCa, 'utf8'); } catch { throw new Error('DB_SSL_CA_FILE no se puede leer.'); }
  }
  return { ssl, modoSsl };
}

/**
 * PostgreSQL. DATABASE_URL es obligatoria en todos los modos (no hay base en memoria) y nunca se registra.
 * Producción: el servicio no migra (DB_MIGRATIONS=verificar por defecto) y la URL debe ser la de la credencial
 * de la APLICACIÓN (sin DDL); las migraciones usan DATABASE_MIGRATION_URL en scripts/migrar.mjs.
 */
export function leerBase(env, produccion = env.NODE_ENV === 'production', variable = 'DATABASE_URL') {
  const url = String(env[variable] ?? '');
  if (!url) throw new Error(`${variable} es obligatoria (postgres://usuario:clave@host:5432/base). No la incluya en Git.`);
  let u;
  try { u = new URL(url); } catch { throw new Error(`${variable} no es una URL válida.`); }
  if (!['postgres:', 'postgresql:'].includes(u.protocol) || !u.hostname || u.pathname.length < 2) throw new Error(`${variable} debe tener la forma postgres://usuario:clave@host:5432/base.`);
  if (produccion && /CAMBIAR/i.test(decodeURIComponent(u.password))) throw new Error(`${variable} contiene una contraseña de ejemplo.`);
  const esquema = env.DB_SCHEMA ? String(env.DB_SCHEMA) : null;
  if (esquema && !/^[a-z_][a-z0-9_]{0,62}$/.test(esquema)) throw new Error('DB_SCHEMA debe ser un identificador en minúsculas.');
  const migraciones = String(env.DB_MIGRATIONS ?? (produccion ? 'verificar' : 'auto'));
  if (!['auto', 'verificar'].includes(migraciones)) throw new Error('DB_MIGRATIONS debe ser auto o verificar.');
  const { ssl, modoSsl } = leerSsl(env);
  return Object.freeze({
    url, esquema, migraciones, ssl, modoSsl,
    poolMax: entero(env.DB_POOL_MAX, 10, 1, 50),
    esperaMs: entero(env.DB_CONNECT_WAIT_SECONDS, produccion ? 60 : 15, 0, 300) * 1000,
    statementTimeoutMs: entero(env.DB_STATEMENT_TIMEOUT_MS, 10_000, 1000, 120_000),
  });
}

export function leerConfig(env = process.env) {
  const appUrl = String(env.APP_URL ?? '').replace(/\/+$/, '');
  if (!/^https?:\/\/[^/]+$/.test(appUrl)) throw new Error('APP_URL debe ser un origen, p. ej. https://openclass-live.apps.willedtech.io');

  const secreto = String(env.SESSION_SECRET ?? '');
  if (secreto.length < 32 || /CAMBIAR/i.test(secreto)) throw new Error('SESSION_SECRET ausente o débil (mínimo 32 caracteres aleatorios).');

  // Acceso heredado 0.3.0 (contraseña compartida): OPCIONAL. Sin él solo hay cuentas personales.
  const hash = String(env.ADMIN_PASSWORD_HASH ?? '');
  if (hash && !/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{40,}$/.test(hash)) {
    throw new Error('ADMIN_PASSWORD_HASH con formato inválido (usar npm run hash-password) o déjelo vacío.');
  }
  const produccion = env.NODE_ENV === 'production';
  const db = leerBase(env, produccion);

  const transporte = String(env.MAIL_TRANSPORT ?? (env.SMTP_HOST ? 'smtp' : produccion ? 'desactivado' : 'desarrollo'));
  if (!['smtp', 'desarrollo', 'desactivado'].includes(transporte)) throw new Error('MAIL_TRANSPORT debe ser smtp, desarrollo o desactivado.');
  if (produccion && transporte === 'desarrollo') throw new Error('MAIL_TRANSPORT=desarrollo no se admite en producción.');
  if (transporte === 'smtp' && (!env.SMTP_HOST || !env.MAIL_FROM)) throw new Error('MAIL_TRANSPORT=smtp requiere SMTP_HOST y MAIL_FROM.');
  const puertoSmtp = entero(env.SMTP_PORT, 587, 1, 65535);

  const presentadores = lista(env.PRESENTER_ORIGINS ?? 'http://localhost:8613,http://localhost:8600');
  for (const o of presentadores) {
    if (!/^https?:\/\/[^/]+$/.test(o)) throw new Error(`PRESENTER_ORIGINS contiene un origen inválido: ${o}`);
  }

  return Object.freeze({
    produccion,
    puerto: entero(env.PORT, 3000, 1, 65535),
    appUrl,
    secreto,
    hashDocente: hash,
    db,
    correo: Object.freeze({
      transporte, host: env.SMTP_HOST ?? '', puerto: puertoSmtp, seguro: puertoSmtp === 465 || String(env.SMTP_SECURE ?? '') === 'true',
      usuario: env.SMTP_USER ?? '', clave: env.SMTP_PASSWORD ?? '', de: env.MAIL_FROM ?? '',
      verificarCertificado: String(env.SMTP_TLS_VERIFY ?? 'true') !== 'false',
    }),
    invitacionHoras: entero(env.INVITE_TTL_HOURS, 72, 1, 720),
    verificacionHoras: entero(env.VERIFY_TTL_HOURS, 48, 1, 720),
    recuperacionMin: entero(env.RESET_TTL_MINUTES, 30, 5, 1440),
    historialDias: entero(env.HISTORY_RETENTION_DAYS, 365, 1, 3650),
    auditoriaDias: entero(env.AUDIT_RETENTION_DAYS, 730, 30, 3650),
    respaldosConservar: entero(env.BACKUP_KEEP, 7, 1, 90),
    cookieSegura: appUrl.startsWith('https://'),
    // P2 «confianza en proxy»: las cabeceras de reenvío solo cuentan si el par TCP está en TRUSTED_PROXY_CIDRS.
    confiarProxy: leerProxy(env, produccion),
    origenesPresentador: Object.freeze(presentadores),
    sesionDocenteHoras: entero(env.TEACHER_SESSION_HOURS, 8, 1, 24),
    salaTtlMin: entero(env.ROOM_TTL_MINUTES, 180, 5, 720),
    maxParticipantes: entero(env.MAX_ROOM_PARTICIPANTS, 150, 2, 1000),
    maxSalas: entero(env.MAX_ROOMS, 20, 1, 200),
  });
}
