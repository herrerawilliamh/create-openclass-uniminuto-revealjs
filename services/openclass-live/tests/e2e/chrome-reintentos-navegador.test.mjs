/**
 * Regresiones de estabilidad de chrome.mjs: arranque fallido, limpieza de perfiles y límite de reintentos.
 * No requiere Chrome real: usa Node.js como binario falso (sale con error al recibir flags de Chrome).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';

/** Captura los perfiles temporales de chrome antes y después de una operación. */
function perfilesChrome() {
  return readdirSync(os.tmpdir()).filter((n) => n.startsWith('oc-chrome-')).map((n) => path.join(os.tmpdir(), n));
}

test('abrirNavegador lanza error claro cuando Chrome no existe', { timeout: 5000 }, async () => {
  const original = process.env.CHROME_PATH;
  process.env.CHROME_PATH = path.join(os.tmpdir(), 'chrome-inexistente-prueba-046');
  try {
    await assert.rejects(
      () => abrirNavegador({ reintentos: 0 }),
      /No se encontró Chrome\/Edge/,
    );
  } finally {
    if (original === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = original;
  }
});

test('abrirNavegador detecta salida inmediata de Chrome y limpia el perfil', { timeout: 20000 }, async () => {
  // Node.js como binario falso: no reconoce --headless=new y sale con código de error.
  const original = process.env.CHROME_PATH;
  process.env.CHROME_PATH = process.execPath;
  const antesPerfiles = new Set(perfilesChrome());
  try {
    const err = await abrirNavegador({ reintentos: 0 }).then(() => null, (e) => e);
    assert.ok(err instanceof Error, 'debe lanzar error');
    assert.match(err.message, /Chrome terminó al iniciar|no publicó DevToolsActivePort/);
    // El perfil temporal se limpia después del fallo.
    const nuevosPerfiles = perfilesChrome().filter((p) => !antesPerfiles.has(p));
    assert.equal(nuevosPerfiles.length, 0, `no deben quedar perfiles huérfanos: ${nuevosPerfiles.join(', ')}`);
  } finally {
    if (original === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = original;
  }
});

test('abrirNavegador no reintenta errores de Chrome no encontrado', { timeout: 5000 }, async () => {
  const original = process.env.CHROME_PATH;
  process.env.CHROME_PATH = path.join(os.tmpdir(), 'chrome-inexistente-prueba-046-b');
  const inicio = Date.now();
  try {
    await assert.rejects(() => abrirNavegador({ reintentos: 2 }), /No se encontró Chrome\/Edge/);
    // No retries → elapsed time should be very short
    assert.ok(Date.now() - inicio < 2000, 'no debe reintentar errores de ruta no encontrada');
  } finally {
    if (original === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = original;
  }
});

test('abrirNavegador agota reintentos y propaga el error de arranque', { timeout: 60000 }, async () => {
  // Node.js como binario falso: falla en todos los intentos.
  const original = process.env.CHROME_PATH;
  process.env.CHROME_PATH = process.execPath;
  try {
    const err = await abrirNavegador({ reintentos: 1 }).then(() => null, (e) => e);
    assert.ok(err instanceof Error, 'debe lanzar error tras agotar reintentos');
    assert.match(err.message, /Chrome terminó al iniciar|no publicó DevToolsActivePort/);
  } finally {
    if (original === undefined) delete process.env.CHROME_PATH;
    else process.env.CHROME_PATH = original;
  }
});
