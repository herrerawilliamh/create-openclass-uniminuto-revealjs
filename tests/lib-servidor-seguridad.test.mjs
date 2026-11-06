import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { get } from 'node:http';
import { servir } from '../scripts/lib/servidor.mjs';

const contenido = '0123456789abcdef';

async function preparar(t, { relativa = false } = {}) {
  const temporal = await fs.mkdtemp(path.join(os.tmpdir(), 'openclass-servidor-'));
  const directorioAnterior = process.cwd();
  let servidor;
  t.after(async () => {
    try { await servidor?.cerrar(); } finally {
      if (relativa) process.chdir(directorioAnterior);
      await fs.rm(temporal, { recursive: true, force: true });
    }
  });
  const raiz = path.join(temporal, 'raiz');
  await fs.mkdir(raiz);
  await fs.mkdir(path.join(temporal, 'raiz-secreta'));
  await fs.writeFile(path.join(raiz, 'datos.txt'), contenido);
  await fs.writeFile(path.join(temporal, 'raiz-secreta', 's.txt'), 'secreto de carpeta hermana');
  await fs.writeFile(path.join(temporal, 'fuera.txt'), 'secreto fuera de la raíz');
  if (relativa) process.chdir(temporal);
  servidor = await servir(relativa ? 'raiz' : raiz, { base: '/b/', puerto: 0 });
  return servidor;
}

function solicitar(servidor, ruta = '/b/datos.txt', headers = {}) {
  return new Promise((resolve, reject) => {
    // Conserva la ruta codificada y usa únicamente la interfaz de bucle local.
    const req = get({ hostname: '127.0.0.1', port: new URL(servidor.url).port, path: ruta, headers }, (res) => {
      const partes = [];
      res.on('data', (parte) => partes.push(parte));
      res.on('error', reject);
      res.on('end', () => resolve({ estado: res.statusCode, headers: res.headers, cuerpo: Buffer.concat(partes).toString() }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error('Solicitud sin respuesta')));
  });
}

test('la carpeta hermana con prefijo común devuelve 403 sin exponer contenido', async (t) => {
  const servidor = await preparar(t);
  const respuesta = await solicitar(servidor, '/b/..%2Fraiz-secreta%2Fs.txt');
  assert.equal(respuesta.estado, 403);
  assert.equal(respuesta.cuerpo, '');
});

test('../ codificado hacia fuera de la raíz devuelve 403', async (t) => {
  const servidor = await preparar(t);
  const respuesta = await solicitar(servidor, '/b/%2e%2e%2Ffuera.txt');
  assert.equal(respuesta.estado, 403);
  assert.equal(respuesta.cuerpo, '');
});

test('una raíz relativa sirve archivos y bloquea la carpeta hermana', async (t) => {
  const servidor = await preparar(t, { relativa: true });
  const valida = await solicitar(servidor);
  assert.equal(valida.estado, 200);
  assert.equal(valida.cuerpo, contenido);
  const fuera = await solicitar(servidor, '/b/..%2Fraiz-secreta%2Fs.txt');
  assert.equal(fuera.estado, 403);
  assert.equal(fuera.cuerpo, '');
});

test('un rango invertido devuelve 416 y el servidor sigue respondiendo', async (t) => {
  const servidor = await preparar(t);
  const respuesta = await solicitar(servidor, undefined, { Range: 'bytes=10-5' });
  assert.equal(respuesta.estado, 416);
  assert.equal(respuesta.headers['content-range'], `bytes */${contenido.length}`);
  const siguiente = await solicitar(servidor);
  assert.equal(siguiente.estado, 200);
  assert.equal(siguiente.cuerpo, contenido);
});

test('un rango con inicio igual o mayor al tamaño devuelve 416', async (t) => {
  const servidor = await preparar(t);
  for (const inicio of [contenido.length, contenido.length + 10]) {
    const respuesta = await solicitar(servidor, undefined, { Range: `bytes=${inicio}-` });
    assert.equal(respuesta.estado, 416);
    assert.equal(respuesta.headers['content-range'], `bytes */${contenido.length}`);
  }
});

test('un rango con fin mayor al tamaño devuelve 206 limitado', async (t) => {
  const servidor = await preparar(t);
  const respuesta = await solicitar(servidor, undefined, { Range: 'bytes=10-99' });
  assert.equal(respuesta.estado, 206);
  assert.equal(respuesta.headers['content-range'], `bytes 10-15/${contenido.length}`);
  assert.equal(respuesta.headers['content-length'], '6');
  assert.equal(respuesta.cuerpo, contenido.slice(10));
});

test('un rango válido devuelve 206 con el contenido exacto', async (t) => {
  const servidor = await preparar(t);
  const respuesta = await solicitar(servidor, undefined, { Range: 'bytes=2-5' });
  assert.equal(respuesta.estado, 206);
  assert.equal(respuesta.headers['content-range'], `bytes 2-5/${contenido.length}`);
  assert.equal(respuesta.headers['content-length'], '4');
  assert.equal(respuesta.cuerpo, '2345');
});
