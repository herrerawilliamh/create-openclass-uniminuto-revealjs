/**
 * Copia de seguridad consistente en caliente de la base (VACUUM INTO) y verificación de integridad.
 *   node scripts/respaldar.mjs [--destino carpeta] [--conservar 7]
 * Por omisión: $DATA_DIR/respaldos. La copia NO contiene secretos del entorno, pero sí cuentas (hashes) e
 * historial: trátela como dato personal. Restaurar = detener el servicio y reemplazar interact.sqlite por la copia.
 */
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { abrirBase, respaldar, verificarIntegridad } from '../src/db.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const dataDir = process.env.DATA_DIR;
const ruta = process.env.DB_PATH || (dataDir ? path.join(dataDir, 'interact.sqlite') : null);
if (!ruta) { process.stderr.write('Defina DATA_DIR (o DB_PATH).\n'); process.exit(2); }

const db = abrirBase(ruta);
try {
  const destino = respaldar(db, arg('destino') ?? path.join(dataDir ?? path.dirname(ruta), 'respaldos'), { conservar: Number(arg('conservar') ?? 7) });
  const copia = new DatabaseSync(destino, { readOnly: true });
  const r = verificarIntegridad(copia);
  copia.close();
  process.stdout.write(`${JSON.stringify({ copia: destino, integra: r.integra })}\n`);
  process.exit(r.integra ? 0 : 1);
} finally { db.close(); }
