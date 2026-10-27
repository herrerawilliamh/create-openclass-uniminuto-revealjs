/**
 * Genera ADMIN_PASSWORD_HASH (scrypt) leyendo la contraseña por stdin, sin eco ni historial del shell.
 *   npm run hash-password            (pide la contraseña dos veces)
 *   printf '%s' "$PASS" | npm run --silent hash-password   (no interactivo)
 */
import { hashPassword } from '../src/auth.mjs';

async function leerOculto(pregunta) {
  if (!process.stdin.isTTY) {
    let datos = '';
    for await (const parte of process.stdin) datos += parte;
    return datos.replace(/\r?\n$/, '');
  }
  process.stderr.write(pregunta);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let texto = '';
  return new Promise((resolve) => {
    process.stdin.on('data', function leer(buf) {
      for (const ch of buf.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.off('data', leer);
          process.stderr.write('\n'); return resolve(texto);
        }
        if (ch === '\u0003') process.exit(130);
        if (ch === '\u007f') texto = texto.slice(0, -1); else texto += ch;
      }
    });
  });
}

const a = await leerOculto('Contraseña docente (mínimo 12 caracteres): ');
if (process.stdin.isTTY) {
  const b = await leerOculto('Repita la contraseña: ');
  if (a !== b) { process.stderr.write('Las contraseñas no coinciden.\n'); process.exit(1); }
}
try {
  process.stdout.write(`${hashPassword(a)}\n`);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
