/**
 * Copia de seguridad lógica de PostgreSQL (pg_dump, formato personalizado) con verificación y rotación.
 *   DATABASE_BACKUP_URL=postgres://interact_respaldo:…@interact-db:5432/interact \
 *   BACKUP_DIR=/respaldos node scripts/respaldar.mjs [--conservar 7]
 * - Usa la credencial de RESPALDO (solo SELECT). pg_dump toma una instantánea consistente (una transacción
 *   REPEATABLE READ): no detiene el servicio ni bloquea escrituras.
 * - Escribe primero «.parcial» y solo renombra si pg_dump terminó bien; añade «.sha256» y comprueba que
 *   pg_restore puede leer el archivo y que contiene todas las tablas de Interact.
 * - La copia contiene cuentas (hashes scrypt), sesiones, invitaciones, auditoría e historial: es DATO PERSONAL.
 *   Permisos 600; debe copiarse fuera del host (almacenamiento independiente) y cifrada en reposo.
 * Salida: JSON { copia, sha256, bytes, tablas, verificada }. Nunca imprime la URL ni la contraseña.
 */
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLAS } from '../src/db.mjs';
import { binario, ejecutar, entornoPg } from './pg-herramientas.mjs';

const PATRON = /^interact-\d{8}T\d{6}Z(?:-\d+)?\.dump$/;

export async function respaldar({ url, dir, conservar = 7, esquema = null, ahora = new Date(), env = process.env }) {
  if (!url) throw new Error('DATABASE_BACKUP_URL es obligatoria.');
  if (!dir) throw new Error('BACKUP_DIR es obligatorio.');
  if (!Number.isInteger(conservar) || conservar < 1 || conservar > 365) throw new Error('--conservar fuera de rango (1–365).');
  if (esquema && !/^[a-z_][a-z0-9_]{0,62}$/.test(esquema)) throw new Error('DB_SCHEMA no válido.');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  let destino = path.join(dir, `interact-${sello}.dump`);
  for (let n = 1; existe(destino); n++) destino = path.join(dir, `interact-${sello}-${n}.dump`);
  const parcial = `${destino}.parcial`;

  const pgEnv = entornoPg(url, env);
  const args = ['--format=custom', '--compress=6', '--no-owner', '--no-privileges', '--serializable-deferrable', `--file=${parcial}`];
  if (esquema) args.push(`--schema=${esquema}`);
  const r = await ejecutar(binario('pg_dump', env), args, pgEnv);
  if (r.codigo !== 0) { rmSync(parcial, { force: true }); throw new Error(`pg_dump falló (código ${r.codigo}): ${limpiar(r.errores)}`); }
  try { chmodSync(parcial, 0o600); } catch { /* Windows */ }

  // Verificación: el archivo es legible por pg_restore y contiene los datos de cada tabla.
  const lista = await ejecutar(binario('pg_restore', env), ['--list', parcial], pgEnv);
  if (lista.codigo !== 0) { rmSync(parcial, { force: true }); throw new Error('La copia no es legible por pg_restore.'); }
  const faltan = TABLAS.filter((t) => !new RegExp(`TABLE DATA \\S+ ${t} `).test(lista.salida));
  if (faltan.length) { rmSync(parcial, { force: true }); throw new Error(`La copia no contiene datos de: ${faltan.join(', ')}`); }

  renameSync(parcial, destino);
  const sha256 = createHash('sha256').update(readFileSync(destino)).digest('hex');
  writeFileSync(`${destino}.sha256`, `${sha256}  ${path.basename(destino)}\n`, { mode: 0o600 });

  const copias = readdirSync(dir).filter((f) => PATRON.test(f))
    // «…Z» ordena antes que «…Z-1»: el sufijo de colisión es la copia más nueva y no debe borrarse primero.
    .sort((a, b) => (a.replace(/\.dump$/, '') < b.replace(/\.dump$/, '') ? -1 : 1));
  for (const vieja of copias.slice(0, Math.max(0, copias.length - conservar))) {
    rmSync(path.join(dir, vieja), { force: true });
    rmSync(path.join(dir, `${vieja}.sha256`), { force: true });
  }
  return { copia: destino, sha256, bytes: statSync(destino).size, tablas: TABLAS.length, verificada: true };
}

const existe = (p) => { try { statSync(p); return true; } catch { return false; } };
// Los mensajes de pg_dump pueden citar host/usuario; nunca contienen la contraseña (va en PGPASSWORD).
const limpiar = (t) => String(t).replace(/postgres(ql)?:\/\/\S+/g, '[url]').trim().split('\n').slice(-3).join(' | ');

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const r = await respaldar({ url: process.env.DATABASE_BACKUP_URL, dir: process.env.BACKUP_DIR,
      conservar: Number(arg('conservar') ?? process.env.BACKUP_KEEP ?? 7), esquema: process.env.DB_SCHEMA || null });
    process.stdout.write(`${JSON.stringify(r)}\n`);
  } catch (error) {
    process.stderr.write(`Respaldo fallido: ${error.message}\n`);
    process.exit(1);
  }
}
