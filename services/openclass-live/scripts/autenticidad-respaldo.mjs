/**
 * Integridad y AUTENTICIDAD de las copias de seguridad.
 * - Integridad: «<copia>.sha256» (formato estricto «<64 hex>  <nombre-de-la-copia>») debe existir y coincidir.
 *   Por sí sola NO prueba el origen: quien altera la copia también puede recalcular la suma.
 * - Autenticidad: «<copia>.manifiesto.json» + «<copia>.firma» (Ed25519 desprendida). La CLAVE PÚBLICA de confianza
 *   se entrega aparte (--clave-publica / INTERACT_BACKUP_PUBLIC_KEY_FILE) desde un almacén que NO es el de las copias.
 *   La clave PRIVADA nunca está en Git, en las copias ni en las imágenes: la firma se hace fuera del host de
 *   producción (equipo del operador / HSM / gestor de secretos) con `node scripts/autenticidad-respaldo.mjs firmar`.
 * Uso:
 *   node scripts/autenticidad-respaldo.mjs generar-claves --privada ruta/privada.pem --publica ruta/publica.pem
 *   node scripts/autenticidad-respaldo.mjs firmar --copia interact-….dump --clave-privada ruta/privada.pem
 */
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SUMA = /^([0-9a-f]{64}) {2}([^\s/\\]+)\n?$/;

export const sha256Archivo = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');
export const huellaClave = (publica) => createHash('sha256').update(publica.export({ type: 'spki', format: 'der' })).digest('hex');

/** Comprueba el «.sha256» de la copia. Su AUSENCIA, formato inválido o desajuste son rechazos explícitos. */
export function verificarSuma(copia) {
  const ruta = `${copia}.sha256`;
  if (!existsSync(ruta)) throw new Error('Falta el comprobante «.sha256» de la copia: se rechaza la restauración.');
  const m = SUMA.exec(readFileSync(ruta, 'utf8'));
  if (!m) throw new Error('El comprobante «.sha256» está mal formado (se espera «<sha256>  <nombre>»).');
  if (m[2] !== path.basename(copia)) throw new Error('El comprobante «.sha256» corresponde a otro archivo.');
  const real = sha256Archivo(copia);
  if (m[1] !== real) throw new Error('La suma SHA-256 de la copia no coincide: archivo alterado o incompleto.');
  return real;
}

export function generarClaves({ privada, publica }) {
  if (existsSync(privada) || existsSync(publica)) throw new Error('No se sobrescriben claves existentes.');
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  writeFileSync(privada, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600, flag: 'wx' });
  writeFileSync(publica, publicKey.export({ type: 'spki', format: 'pem' }), { mode: 0o644, flag: 'wx' });
  return { huella: huellaClave(publicKey) };
}

/** Firma el manifiesto de una copia (se ejecuta FUERA de producción, con la clave privada del operador). */
export function firmarCopia({ copia, clavePrivada, ahora = new Date() }) {
  const sha256 = verificarSuma(copia);
  const privada = createPrivateKey(readFileSync(clavePrivada));
  const publica = createPublicKey(privada);
  const manifiesto = JSON.stringify({
    formato: 'interact-respaldo-manifiesto/1', archivo: path.basename(copia), sha256, bytes: statSync(copia).size,
    firmadoEn: ahora.toISOString(), clave: huellaClave(publica),
  });
  writeFileSync(`${copia}.manifiesto.json`, manifiesto, { mode: 0o600 });
  writeFileSync(`${copia}.firma`, `${sign(null, Buffer.from(manifiesto), privada).toString('base64')}\n`, { mode: 0o600 });
  return { manifiesto: `${copia}.manifiesto.json`, clave: huellaClave(publica) };
}

/**
 * Verifica la firma con la clave pública de confianza (aportada aparte) y que el manifiesto describa ESTA copia.
 * Devuelve { autentica: true, clave, firmadoEn }; cualquier otra cosa lanza.
 */
export function verificarAutenticidad({ copia, clavePublica, noAnteriorA = null }) {
  if (!clavePublica || !existsSync(clavePublica)) throw new Error('Falta la clave pública de confianza para verificar la autenticidad.');
  const mRuta = `${copia}.manifiesto.json`; const fRuta = `${copia}.firma`;
  if (!existsSync(mRuta) || !existsSync(fRuta)) throw new Error('Faltan el manifiesto firmado o la firma de la copia.');
  let publica;
  try { publica = createPublicKey(readFileSync(clavePublica)); } catch { throw new Error('La clave pública de confianza no es válida.'); }
  if (publica.asymmetricKeyType !== 'ed25519') throw new Error('La clave pública debe ser Ed25519.');
  const bruto = readFileSync(mRuta);
  const firma = Buffer.from(readFileSync(fRuta, 'utf8').trim(), 'base64');
  if (firma.length !== 64 || !verify(null, bruto, publica, firma)) throw new Error('La firma del manifiesto no es válida para la clave de confianza.');
  let m;
  try { m = JSON.parse(bruto.toString('utf8')); } catch { throw new Error('Manifiesto ilegible.'); }
  if (m.formato !== 'interact-respaldo-manifiesto/1' || m.clave !== huellaClave(publica)) throw new Error('El manifiesto no corresponde a la clave de confianza.');
  if (m.archivo !== path.basename(copia)) throw new Error('El manifiesto firmado describe otro archivo.');
  if (m.bytes !== statSync(copia).size || m.sha256 !== sha256Archivo(copia)) throw new Error('La copia no coincide con el manifiesto firmado (sustituida o alterada).');
  if (noAnteriorA && !(Date.parse(m.firmadoEn) >= Date.parse(noAnteriorA))) throw new Error('La copia firmada es anterior a la fecha mínima exigida (posible reposición de una copia antigua).');
  return { autentica: true, clave: m.clave, firmadoEn: m.firmadoEn };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
  try {
    const orden = process.argv[2];
    if (orden === 'generar-claves') console.log(JSON.stringify(generarClaves({ privada: path.resolve(arg('privada')), publica: path.resolve(arg('publica')) })));
    else if (orden === 'firmar') console.log(JSON.stringify(firmarCopia({ copia: path.resolve(arg('copia')), clavePrivada: path.resolve(arg('clave-privada')) })));
    else throw new Error('Uso: generar-claves | firmar');
  } catch (e) { process.stderr.write(`${e.message}\n`); process.exit(1); }
}
