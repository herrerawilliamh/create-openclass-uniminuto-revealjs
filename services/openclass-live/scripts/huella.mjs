/**
 * Huella SHA-256 canónica de un archivo del servicio (compartida por generar-manifiesto y verificar-gitops).
 *  - Binarios (.woff2, .woff, imágenes…): bytes originales, sin decodificar ni normalizar (igual que `binary` en .gitattributes).
 *  - Texto: única normalización documentada, CRLF → LF (`* text=auto eol=lf`), porque Git almacena LF.
 */
import { createHash } from 'node:crypto';

const BINARIOS = /\.(woff2?|png|jpe?g|webp|gif|ico|webm|mp4|ttf|otf|eot|pdf|gz|tgz)$/i;
export const esBinario = (ruta) => BINARIOS.test(ruta);
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** `bytes` es un Buffer leído sin codificación. */
export function huellaGit(ruta, bytes) {
  if (!Buffer.isBuffer(bytes)) throw new TypeError('huellaGit requiere un Buffer');
  if (esBinario(ruta)) return sha256(bytes);
  return sha256(Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')));
}
