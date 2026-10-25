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

  const hash = String(env.ADMIN_PASSWORD_HASH ?? '');
  if (!/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9_-]{16,}\$[A-Za-z0-9_-]{40,}$/.test(hash)) {
    throw new Error('ADMIN_PASSWORD_HASH ausente o con formato inválido (usar npm run hash-password).');
  }

  const presentadores = lista(env.PRESENTER_ORIGINS ?? 'http://localhost:8613,http://localhost:8600');
  for (const o of presentadores) {
    if (!/^https?:\/\/[^/]+$/.test(o)) throw new Error(`PRESENTER_ORIGINS contiene un origen inválido: ${o}`);
  }

  return Object.freeze({
    produccion: env.NODE_ENV === 'production',
    puerto: entero(env.PORT, 3000, 1, 65535),
    appUrl,
    secreto,
    hashDocente: hash,
    cookieSegura: appUrl.startsWith('https://'),
    confiarProxy: String(env.TRUST_PROXY ?? 'true') === 'true',
    origenesPresentador: Object.freeze(presentadores),
    sesionDocenteHoras: entero(env.TEACHER_SESSION_HOURS, 8, 1, 24),
    salaTtlMin: entero(env.ROOM_TTL_MINUTES, 180, 5, 720),
    maxParticipantes: entero(env.MAX_ROOM_PARTICIPANTS, 150, 2, 1000),
    maxSalas: entero(env.MAX_ROOMS, 20, 1, 200),
  });
}
