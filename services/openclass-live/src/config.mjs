/**
 * OpenClass Live: configuración leída del entorno (.env en el despliegue).
 * Falla al arrancar si faltan secretos o si son débiles: nunca hay valores por defecto para ellos.
 */
const entero = (valor, defecto, min, max) => {
  if (valor === undefined || valor === '') return defecto;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Valor fuera de rango (${min}–${max}): ${valor}`);
  return n;
};

const lista = (valor) => String(valor ?? '').split(',').map((s) => s.trim()).filter(Boolean);

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
  // Fuera de producción, sin DATA_DIR la base vive en memoria (desarrollo y pruebas): no persiste.
  const dataDir = env.DATA_DIR === undefined && !produccion ? null : String(env.DATA_DIR ?? '');
  if (dataDir === '') throw new Error('DATA_DIR es obligatorio en producción (volumen persistente fuera del contenedor, p. ej. /data).');

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
    dataDir,
    dbRuta: env.DB_PATH ? String(env.DB_PATH) : null,
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
    confiarProxy: String(env.TRUST_PROXY ?? 'true') === 'true',
    origenesPresentador: Object.freeze(presentadores),
    sesionDocenteHoras: entero(env.TEACHER_SESSION_HOURS, 8, 1, 24),
    salaTtlMin: entero(env.ROOM_TTL_MINUTES, 180, 5, 720),
    maxParticipantes: entero(env.MAX_ROOM_PARTICIPANTS, 150, 2, 1000),
    maxSalas: entero(env.MAX_ROOMS, 20, 1, 200),
  });
}
