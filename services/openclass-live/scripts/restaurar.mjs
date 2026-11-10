/**
 * Restauración VERIFICADA de una copia de pg_dump en una base de PRUEBA/RESTAURACIÓN (nunca sobre la base viva).
 *   DATABASE_RESTORE_URL=postgres://…@host:5432/interact_restauracion node scripts/restaurar.mjs --copia ruta.dump
 * Salvaguardas:
 * - El nombre de la base destino debe terminar en _restauracion, _prueba o _test; cualquier otro nombre exige
 *   `--confirmar-destino <nombre-exacto>` (decisión humana explícita, p. ej. una recuperación real planificada).
 * - La base destino debe estar VACÍA de tablas de Interact: no mezcla ni sobrescribe datos.
 * - Comprueba la suma «.sha256» antes de restaurar; restaura en una sola transacción (todo o nada).
 * - Después verifica: esquema al día (migraciones e sumas), integridad referencial y recuentos por tabla.
 * Salida: JSON { destino, version, integra, recuentos }. Nunca imprime la URL ni la contraseña.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirBase, recuentos, verificarIntegridad, versionEsquema } from '../src/db.mjs';
import { binario, ejecutar, entornoPg } from './pg-herramientas.mjs';

export const DESTINO_SEGURO = /_(restauracion|prueba|test)$/;

export async function restaurar({ url, copia, esquema = null, confirmarDestino = null, env = process.env }) {
  if (!url) throw new Error('DATABASE_RESTORE_URL es obligatoria.');
  if (!copia || !existsSync(copia)) throw new Error('--copia no existe.');
  if (esquema && !/^[a-z_][a-z0-9_]{0,62}$/.test(esquema)) throw new Error('DB_SCHEMA no válido.');
  const pgEnv = entornoPg(url, env);
  const destino = pgEnv.PGDATABASE;
  if (!DESTINO_SEGURO.test(destino) && confirmarDestino !== destino) {
    throw new Error(`La base destino «${destino}» no es de prueba/restauración. Use una base *_restauracion o confirme con --confirmar-destino ${destino}.`);
  }
  const suma = `${copia}.sha256`;
  if (existsSync(suma)) {
    const esperada = readFileSync(suma, 'utf8').trim().split(/\s+/)[0];
    const real = createHash('sha256').update(readFileSync(copia)).digest('hex');
    if (esperada !== real) throw new Error('La suma SHA-256 de la copia no coincide: archivo alterado o incompleto.');
  }

  // Destino vacío: ninguna tabla de Interact en el esquema de destino (ni en ningún esquema si no se indicó).
  const previa = await abrirBase({ url, esquema: null, max: 1, migraciones: 'ninguna', esperaMs: 15_000, aplicacion: 'interact-restaurar' });
  try {
    const ocupadas = await previa.uno(`SELECT COUNT(*) AS n FROM information_schema.tables
      WHERE table_name IN ('usuarios', 'tokens', 'esquema_migraciones') AND ($1::text IS NULL OR table_schema = $1)
        AND table_schema NOT IN ('pg_catalog', 'information_schema')`, [esquema]);
    if (ocupadas.n > 0) throw new Error('La base destino ya contiene tablas de Interact: la restauración solo se hace sobre una base vacía.');
  } finally { await previa.cerrar(); }

  const r = await ejecutar(binario('pg_restore', env),
    ['--exit-on-error', '--single-transaction', '--no-owner', '--no-privileges', `--dbname=${destino}`, copia], pgEnv);
  if (r.codigo !== 0) throw new Error(`pg_restore falló (código ${r.codigo}): ${String(r.errores).replace(/postgres(ql)?:\/\/\S+/g, '[url]').trim().split('\n').slice(-3).join(' | ')}`);

  // El servicio exigiría lo mismo al arrancar: migraciones conocidas e íntegras.
  const base = await abrirBase({ url, esquema, max: 2, migraciones: 'verificar', esperaMs: 15_000, aplicacion: 'interact-restaurar' });
  try {
    const integridad = await verificarIntegridad(base);
    return { destino, version: await versionEsquema(base), integra: integridad.integra, violacionesFk: integridad.violacionesFk, recuentos: await recuentos(base) };
  } finally { await base.cerrar(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const r = await restaurar({ url: process.env.DATABASE_RESTORE_URL, copia: arg('copia') && path.resolve(arg('copia')),
      esquema: process.env.DB_SCHEMA || null, confirmarDestino: arg('confirmar-destino') ?? null });
    process.stdout.write(`${JSON.stringify(r)}\n`);
    process.exitCode = r.integra ? 0 : 1;
  } catch (error) {
    process.stderr.write(`Restauración fallida: ${error.name === 'ErrorBase' || !error.code ? error.message : `PostgreSQL ${error.code}`}\n`);
    process.exit(1);
  }
}
