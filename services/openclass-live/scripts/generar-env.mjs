/**
 * Crea un .env con secretos aleatorios a partir de .env.example (no sobrescribe uno existente).
 *   npm run gen-env                       → genera SESSION_SECRET (el superusuario se crea aparte)
 *   OPENCLASS_ENV_DESTINO=/ruta/.env npm run gen-env
 * Escribe el archivo con permisos 600 y NO imprime ningún secreto.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const destino = process.env.OPENCLASS_ENV_DESTINO || path.join(raiz, '.env');
if (existsSync(destino)) { process.stderr.write(`Ya existe ${destino}: no se sobrescribe.\n`); process.exit(1); }


const plantilla = readFileSync(path.join(raiz, '.env.example'), 'utf8');
const salida = plantilla
  .replace(/^SESSION_SECRET=.*$/m, () => `SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
writeFileSync(destino, salida, { mode: 0o600 });
try { chmodSync(destino, 0o600); } catch { /* Windows */ }
process.stderr.write(`Creado ${destino} (permisos 600). Revise APP_HOST/APP_URL antes de desplegar.\n`);
