/**
 * Regresiones de estabilidad de chrome.mjs: arranque fallido, limpieza de perfiles, límite de reintentos y stderr acotado.
 * No requiere Chrome real: usa ejecutables sintéticos creados en un directorio temporal propio e inyectados de forma
 * explícita con la opción `ejecutable` (nunca mediante CHROME_PATH ni process.execPath).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador, rutaChrome } from '../../../../scripts/lib/chrome.mjs';

const POSIX = process.platform !== 'win32';

function perfilesChrome() {
  return readdirSync(os.tmpdir()).filter((n) => n.startsWith('oc-chrome-')).map((n) => path.join(os.tmpdir(), n));
}

/** Crea un ejecutable sintético (script de shell) en un directorio temporal exclusivo; devuelve ruta y limpieza. */
function sintetico(cuerpo) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'oc-falso-'));
  const ruta = path.join(dir, 'chrome-falso');
  writeFileSync(ruta, `#!/bin/sh\n${cuerpo}\n`);
  chmodSync(ruta, 0o755);
  return { ruta, dir, limpiar: () => rmSync(dir, { recursive: true, force: true }) };
}

test('rutaChrome rechaza rutas relativas, inexistentes o no ejecutables sin sustituirlas', { skip: !POSIX }, () => {
  assert.throws(() => rutaChrome('chrome'), /ejecutable indicado/);
  assert.throws(() => rutaChrome(path.join(os.tmpdir(), 'chrome-inexistente-prueba-046')), /ejecutable indicado/);
  const f = sintetico('exit 0');
  try {
    chmodSync(f.ruta, 0o644);
    assert.throws(() => rutaChrome(f.ruta), /ejecutable indicado/);
    assert.throws(() => rutaChrome(f.dir), /ejecutable indicado/, 'un directorio no es ejecutable válido');
  } finally { f.limpiar(); }
});

test('abrirNavegador lanza error claro cuando Chrome no existe y no deja perfiles', { timeout: 5000 }, async () => {
  const antes = new Set(perfilesChrome());
  await assert.rejects(
    () => abrirNavegador({ reintentos: 0, ejecutable: path.join(os.tmpdir(), 'chrome-inexistente-prueba-046') }),
    /ejecutable indicado/,
  );
  assert.deepEqual(perfilesChrome().filter((p) => !antes.has(p)), []);
});

test('abrirNavegador detecta salida inmediata, limpia el perfil y no filtra rutas ni secretos', { timeout: 20000, skip: !POSIX }, async () => {
  const f = sintetico('for a in "$@"; do echo "arg=$a" >&2; done; echo "password=hunter2 token: abc123" >&2; exit 3');
  const antes = new Set(perfilesChrome());
  try {
    const err = await abrirNavegador({ reintentos: 0, ejecutable: f.ruta }).then(() => null, (e) => e);
    assert.ok(err instanceof Error, 'debe lanzar error');
    assert.match(err.message, /Chrome terminó al iniciar \(código 3\)/);
    assert.ok(!err.message.includes('hunter2') && !err.message.includes('abc123'), 'no debe filtrar secretos');
    assert.ok(!err.message.includes('oc-chrome-'), 'no debe exponer la ruta del perfil temporal');
    assert.deepEqual(perfilesChrome().filter((p) => !antes.has(p)), [], 'no deben quedar perfiles huérfanos');
  } finally { f.limpiar(); }
});

test('abrirNavegador acota stderr abundante', { timeout: 20000, skip: !POSIX }, async () => {
  const f = sintetico('i=0; while [ $i -lt 3000 ]; do echo "ruido-linea-larga-$i-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" >&2; i=$((i+1)); done; exit 1');
  try {
    const err = await abrirNavegador({ reintentos: 0, ejecutable: f.ruta }).then(() => null, (e) => e);
    assert.ok(err instanceof Error);
    assert.ok(err.message.length < 700, `mensaje acotado, fue ${err.message.length}`);
  } finally { f.limpiar(); }
});

test('abrirNavegador no reintenta un ejecutable inexistente', { timeout: 5000 }, async () => {
  const inicio = Date.now();
  await assert.rejects(
    () => abrirNavegador({ reintentos: 2, ejecutable: path.join(os.tmpdir(), 'chrome-inexistente-prueba-046-b') }),
    /ejecutable indicado/,
  );
  assert.ok(Date.now() - inicio < 2000, 'no debe reintentar errores de ruta no encontrada');
});

test('abrirNavegador agota exactamente reintentos+1 intentos y propaga el error de arranque', { timeout: 30000, skip: !POSIX }, async () => {
  const marca = path.join(os.tmpdir(), `oc-intentos-${process.pid}-${Date.now()}`);
  const f = sintetico(`echo x >> "${marca}"; echo fallo >&2; exit 1`);
  const antes = new Set(perfilesChrome());
  try {
    const err = await abrirNavegador({ reintentos: 1, ejecutable: f.ruta }).then(() => null, (e) => e);
    assert.ok(err instanceof Error, 'debe lanzar error tras agotar reintentos');
    assert.match(err.message, /Chrome terminó al iniciar/);
    assert.equal(readFileSync(marca, 'utf8').trim().split('\n').length, 2, 'exactamente 2 intentos');
    assert.deepEqual(perfilesChrome().filter((p) => !antes.has(p)), [], 'sin perfiles huérfanos tras reintentar');
  } finally { f.limpiar(); rmSync(marca, { force: true }); }
});

test('abrirNavegador reintenta tras el primer fallo y propaga el error del último intento', { timeout: 30000, skip: !POSIX }, async () => {
  // El 1.er intento sale con código 1 y el 2.º con 7: se verifica que se reintentó y se propaga el último error.
  const marca = path.join(os.tmpdir(), `oc-recup-${process.pid}-${Date.now()}`);
  const f = sintetico(`echo x >> "${marca}"; n=$(wc -l < "${marca}"); [ "$n" -ge 2 ] && { echo "segundo" >&2; exit 7; }; exit 1`);
  try {
    const err = await abrirNavegador({ reintentos: 1, ejecutable: f.ruta }).then(() => null, (e) => e);
    assert.match(err.message, /código 7/, 'el error propagado es el del último intento');
    assert.ok(existsSync(marca));
  } finally { f.limpiar(); rmSync(marca, { force: true }); }
});
