/**
 * Formato canónico del artefacto de despliegue: USTAR (POSIX.1-1988) + gzip, escrito por este módulo.
 * No depende del `tar` del sistema (GNU/bsdtar producen cabeceras distintas).
 *  - Orden: rutas ordenadas por bytes (comparación de Buffer), sin entradas de directorio.
 *  - mtime = 0, uid/gid = 0, uname/gname = root, modo 0644 (archivos), sin pax ni extensiones.
 *  - Bloques finales: dos de ceros, relleno a múltiplo de 10240 (registro clásico).
 *  - gzip: nivel 9, MTIME = 0 y byte de sistema operativo fijado a 3 (Unix) para no depender del SO de Node.
 * El mismo árbol produce los mismos bytes con el mismo zlib; versiones distintas de zlib pueden variar el flujo deflate.
 */
import { gzipSync } from 'node:zlib';

const BLOQUE = 512;
const octal = (n, ancho) => Buffer.from(n.toString(8).padStart(ancho - 1, '0') + '\0', 'latin1');

function cabecera(ruta, tamano) {
  if (!/^[ -~]+$/.test(ruta)) throw new Error(`Ruta no ASCII imprimible en el paquete: ${ruta}`);
  let nombre = ruta, prefijo = '';
  if (ruta.length > 100) {
    const corte = ruta.slice(0, 156).lastIndexOf('/');
    if (corte < 1 || ruta.length - corte - 1 > 100) throw new Error(`Ruta demasiado larga para USTAR: ${ruta}`);
    prefijo = ruta.slice(0, corte); nombre = ruta.slice(corte + 1);
  }
  const h = Buffer.alloc(BLOQUE, 0);
  h.write(nombre, 0, 'latin1');
  octal(0o644, 8).copy(h, 100);
  octal(0, 8).copy(h, 108);
  octal(0, 8).copy(h, 116);
  octal(tamano, 12).copy(h, 124);
  octal(0, 12).copy(h, 136);
  h.fill(0x20, 148, 156); // checksum con espacios mientras se calcula
  h[156] = 0x30; // '0': archivo regular
  h.write('ustar\0', 257, 'latin1');
  h.write('00', 263, 'latin1');
  h.write('root', 265, 'latin1');
  h.write('root', 297, 'latin1');
  octal(0, 8).copy(h, 329);
  octal(0, 8).copy(h, 337);
  h.write(prefijo, 345, 'latin1');
  let suma = 0;
  for (const b of h) suma += b;
  h.write(suma.toString(8).padStart(6, '0') + '\0 ', 148, 'latin1');
  return h;
}

/** @param {{ruta: string, bytes: Buffer}[]} entradas */
export function construirTar(entradas) {
  const orden = [...entradas].sort((a, b) => Buffer.compare(Buffer.from(a.ruta), Buffer.from(b.ruta)));
  const partes = [];
  for (const { ruta, bytes } of orden) {
    partes.push(cabecera(ruta, bytes.length), bytes);
    const resto = bytes.length % BLOQUE;
    if (resto) partes.push(Buffer.alloc(BLOQUE - resto, 0));
  }
  partes.push(Buffer.alloc(BLOQUE * 2, 0));
  const total = partes.reduce((n, p) => n + p.length, 0);
  const relleno = (10240 - (total % 10240)) % 10240;
  if (relleno) partes.push(Buffer.alloc(relleno, 0));
  return Buffer.concat(partes);
}

export function comprimirDeterminista(tar) {
  const gz = Buffer.from(gzipSync(tar, { level: 9 }));
  gz.writeUInt32LE(0, 4); // MTIME
  gz[9] = 3; // OS = Unix
  return gz;
}
