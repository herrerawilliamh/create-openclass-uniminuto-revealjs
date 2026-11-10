/**
 * Integridad y autenticidad de copias: pruebas NEGATIVAS (ausencia, mal formado, otro archivo, alterada,
 * sustitución con comprobantes recalculados, firma de otra clave, manifiesto manipulado) y destinos.
 * Todos los rechazos ocurren ANTES de conectar a ninguna base, por eso la URL no necesita servidor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { firmarCopia, generarClaves, verificarAutenticidad, verificarSuma } from '../scripts/autenticidad-respaldo.mjs';
import { restaurar } from '../scripts/restaurar.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const URL_ENSAYO = 'postgres://u:p@127.0.0.1:1/interact_x_restauracion';
const URL_PROD = 'postgres://u:p@127.0.0.1:1/interact';

function escenario(t) {
  const dir = mkdtempSync(path.join(tmpdir(), 'interact-auten-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const copia = path.join(dir, 'interact-20260101T000000Z.dump');
  const contenido = Buffer.from('PGDMP-sintetico-contenido');
  writeFileSync(copia, contenido);
  writeFileSync(`${copia}.sha256`, `${sha(contenido)}  ${path.basename(copia)}\n`);
  const confiable = { privada: path.join(dir, 'conf.key'), publica: path.join(dir, 'conf.pub') };
  const ajena = { privada: path.join(dir, 'ajena.key'), publica: path.join(dir, 'ajena.pub') };
  generarClaves(confiable); generarClaves(ajena);
  return { dir, copia, contenido, confiable, ajena };
}

test('comprobante .sha256: ausente, mal formado, de otro archivo y alterada se rechazan', (t) => {
  const { copia, contenido } = escenario(t);
  assert.equal(verificarSuma(copia), sha(contenido));
  writeFileSync(`${copia}.sha256`, 'basura');
  assert.throws(() => verificarSuma(copia), /mal formado/);
  writeFileSync(`${copia}.sha256`, `${sha(contenido).toUpperCase()}  ${path.basename(copia)}\n`);
  assert.throws(() => verificarSuma(copia), /mal formado/, 'solo hexadecimal en minúsculas');
  writeFileSync(`${copia}.sha256`, `${sha(contenido)}  otro.dump\n`);
  assert.throws(() => verificarSuma(copia), /otro archivo/);
  writeFileSync(`${copia}.sha256`, `${sha('otra cosa')}  ${path.basename(copia)}\n`);
  assert.throws(() => verificarSuma(copia), /no coincide/);
  rmSync(`${copia}.sha256`);
  assert.throws(() => verificarSuma(copia), /Falta el comprobante/);
});

test('restaurar: sin .sha256 se rechaza explícitamente, también en bases de ensayo', async (t) => {
  const { copia } = escenario(t);
  rmSync(`${copia}.sha256`);
  await assert.rejects(restaurar({ url: URL_ENSAYO, copia }), /Falta el comprobante/);
});

test('autenticidad: firma válida, y rechazo de ausencia, clave ajena, manifiesto manipulado y sustitución', (t) => {
  const { copia, confiable, ajena, contenido } = escenario(t);
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: confiable.publica }), /Faltan el manifiesto/);
  firmarCopia({ copia, clavePrivada: confiable.privada });
  assert.equal(verificarAutenticidad({ copia, clavePublica: confiable.publica }).autentica, true);
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: ajena.publica }), /firma del manifiesto no es válida/, 'firmada por otra clave');
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: path.join(path.dirname(copia), 'no-existe.pub') }), /Falta la clave pública/);
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: confiable.publica, noAnteriorA: '2999-01-01T00:00:00Z' }), /anterior a la fecha mínima/);

  // Manifiesto manipulado (p. ej. cambiar el sha256): la firma deja de valer.
  const m = readFileSync(`${copia}.manifiesto.json`, 'utf8');
  writeFileSync(`${copia}.manifiesto.json`, m.replace(sha(contenido), sha('otro')));
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: confiable.publica }), /firma del manifiesto no es válida/);
  writeFileSync(`${copia}.manifiesto.json`, m);

  // SUSTITUCIÓN: el atacante cambia la copia y recalcula el .sha256 (la integridad sola no lo detecta)…
  const falsa = Buffer.from('PGDMP-sustituida');
  writeFileSync(copia, falsa);
  writeFileSync(`${copia}.sha256`, `${sha(falsa)}  ${path.basename(copia)}\n`);
  assert.equal(verificarSuma(copia), sha(falsa), 'la suma recalculada pasa la integridad…');
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: confiable.publica }), /sustituida o alterada/, '…pero no la autenticidad');
  // …y firmarla con su propia clave tampoco sirve: la clave de confianza es otra.
  const atacante = { privada: path.join(path.dirname(copia), 'atq.key'), publica: path.join(path.dirname(copia), 'atq.pub') };
  generarClaves(atacante); firmarCopia({ copia, clavePrivada: atacante.privada });
  assert.throws(() => verificarAutenticidad({ copia, clavePublica: confiable.publica }), /no es válida/);
});

test('autenticidad: el manifiesto de OTRA copia (renombrada) no vale', (t) => {
  const { copia, confiable, dir, contenido } = escenario(t);
  firmarCopia({ copia, clavePrivada: confiable.privada });
  const otra = path.join(dir, 'interact-20260102T000000Z.dump');
  writeFileSync(otra, contenido);
  writeFileSync(`${otra}.sha256`, `${sha(contenido)}  ${path.basename(otra)}\n`);
  writeFileSync(`${otra}.manifiesto.json`, readFileSync(`${copia}.manifiesto.json`));
  writeFileSync(`${otra}.firma`, readFileSync(`${copia}.firma`));
  assert.throws(() => verificarAutenticidad({ copia: otra, clavePublica: confiable.publica }), /otro archivo/);
});

test('restaurar: una base que no es de ensayo exige autenticidad; destinos no autorizados se rechazan', async (t) => {
  const { copia, confiable, ajena } = escenario(t);
  await assert.rejects(restaurar({ url: URL_PROD, copia }), /no es de prueba\/restauración/, 'destino no autorizado');
  await assert.rejects(restaurar({ url: URL_PROD, copia, confirmarDestino: 'interact' }), /exige verificar la autenticidad/, 'destino confirmado pero sin firma');
  firmarCopia({ copia, clavePrivada: confiable.privada });
  await assert.rejects(restaurar({ url: URL_PROD, copia, confirmarDestino: 'interact', clavePublica: ajena.publica }), /firma del manifiesto no es válida/);
  await assert.rejects(restaurar({ url: URL_ENSAYO, copia, clavePublica: ajena.publica }), /firma del manifiesto no es válida/, 'si se aporta clave, también en ensayo debe valer');
});
