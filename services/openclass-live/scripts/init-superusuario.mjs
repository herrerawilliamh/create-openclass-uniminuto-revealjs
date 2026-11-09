/**
 * Inicialización segura del superusuario (sin credenciales por defecto).
 *   node scripts/init-superusuario.mjs --email usted@dominio [--nombre "Nombre"]
 * La contraseña (mínimo 12 caracteres) se lee de la entrada estándar (sin eco si es un terminal) o, en
 * automatizaciones, de INTERACT_SUPERUSER_PASSWORD. Nunca se imprime. Falla si ya existe un superusuario.
 * Usa DATA_DIR / DB_PATH como el servicio.
 */
import path from 'node:path';
import { abrirBase } from '../src/db.mjs';
import { crearCuentas, ErrorCuenta } from '../src/cuentas.mjs';

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const email = arg('email');
if (!email) { process.stderr.write('Uso: init-superusuario.mjs --email correo [--nombre "Nombre"]\n'); process.exit(2); }

async function leerPassword() {
  if (process.env.INTERACT_SUPERUSER_PASSWORD) return process.env.INTERACT_SUPERUSER_PASSWORD;
  if (!process.stdin.isTTY) {
    let t = ''; for await (const p of process.stdin) t += p;
    return t.replace(/\r?\n$/, '');
  }
  process.stderr.write('Contraseña (mínimo 12 caracteres, sin eco): ');
  process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding('utf8');
  return new Promise((resolver) => {
    let t = '';
    process.stdin.on('data', (c) => {
      for (const ch of c) {
        if (ch === '\r' || ch === '\n') { process.stdin.setRawMode(false); process.stdin.pause(); process.stderr.write('\n'); return resolver(t); }
        if (ch === '\u0003') process.exit(130);
        if (ch === '\u007f') t = t.slice(0, -1); else t += ch;
      }
    });
  });
}

const dataDir = process.env.DATA_DIR;
const ruta = process.env.DB_PATH || (dataDir ? path.join(dataDir, 'interact.sqlite') : null);
if (!ruta) { process.stderr.write('Defina DATA_DIR (o DB_PATH) para localizar la base.\n'); process.exit(2); }

const db = abrirBase(ruta);
try {
  const u = crearCuentas(db).crearSuperusuario({ email, password: await leerPassword(), nombre: arg('nombre') ?? '' });
  process.stderr.write(`Superusuario creado: ${u.email}\n`);
} catch (error) {
  if (error instanceof ErrorCuenta) { process.stderr.write(`${error.message}\n`); process.exit(1); }
  throw error;
} finally { db.close(); }
