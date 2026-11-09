/** Panel docente: mensajes y clasificación de fallos HTTP (módulo puro, sin DOM). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mensajeHttp, esTransitorio } from '../public/assets/comun.mjs';

test('mensajeHttp: cada fallo tiene un texto comprensible y distinto', () => {
  const casos = [
    [{ estado: 0, falla: 'red' }, /Sin conexión/],
    [{ estado: 0, falla: 'timeout' }, /tardó demasiado/],
    [{ estado: 401 }, /sesión venció/],
    [{ estado: 403 }, /rechazó la solicitud/],
    [{ estado: 429 }, /Demasiados intentos/],
    [{ estado: 500 }, /problema/],
    [{ estado: 503 }, /problema/],
    [{ estado: 418 }, /código 418/],
  ];
  for (const [fallo, patron] of casos) assert.match(mensajeHttp(fallo), patron, JSON.stringify(fallo));
  assert.equal(mensajeHttp({ estado: 401 }, 'login'), 'Contraseña incorrecta.');
  assert.notEqual(mensajeHttp({ estado: 403 }, 'login'), 'Contraseña incorrecta.', '403 no se presenta como contraseña errónea');
});

test('esTransitorio: red, tiempo, 429 y 5xx no prueban que la sesión terminó; 401/403 sí son definitivos', () => {
  for (const f of [{ estado: 0, falla: 'red' }, { estado: 0, falla: 'timeout' }, { estado: 429 }, { estado: 500 }, { estado: 502 }]) assert.equal(esTransitorio(f), true, JSON.stringify(f));
  for (const f of [{ estado: 200 }, { estado: 401 }, { estado: 403 }, { estado: 404 }]) assert.equal(esTransitorio(f), false, JSON.stringify(f));
});
