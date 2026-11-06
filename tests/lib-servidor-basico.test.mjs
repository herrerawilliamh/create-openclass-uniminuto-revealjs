import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { servir } from '../scripts/lib/servidor.mjs';

// Crea una raíz temporal con fixtures, arranca el servidor bajo /b/ y garantiza cerrar() y borrado.
async function conServidor(fn) {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'servidor-basico-'));
  let srv;
  try {
    await fs.writeFile(path.join(raiz, 'index.html'), '<h1>hola</h1>');
    await fs.writeFile(path.join(raiz, 'estilo.css'), 'body{color:red}');
    await fs.writeFile(path.join(raiz, 'datos.json'), '{"a":1}');
    await fs.writeFile(path.join(raiz, 'raro.xyz'), 'x');
    await fs.writeFile(path.join(raiz, 'binario.bin'), Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]));
    await fs.mkdir(path.join(raiz, 'sub'));
    await fs.writeFile(path.join(raiz, 'sub', 'index.html'), '<p>sub</p>');
    await fs.writeFile(path.join(raiz, 'otro.html'), '<p>fuera</p>');
    srv = await servir(raiz, { base: '/b/' });
    await fn(srv, raiz);
  } finally {
    if (srv) await srv.cerrar();
    await fs.rm(raiz, { recursive: true, force: true });
  }
}

const sinRedirigir = (url) => fetch(url, { redirect: 'manual' });

test('archivos bajo el prefijo: 200, contenido exacto y Content-Type para .html, .css y .json', async () => {
  await conServidor(async ({ url }) => {
    const html = await sinRedirigir(`${url}index.html`);
    assert.equal(html.status, 200);
    assert.equal(html.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(await html.text(), '<h1>hola</h1>');

    const css = await sinRedirigir(`${url}estilo.css`);
    assert.equal(css.status, 200);
    assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
    assert.equal(await css.text(), 'body{color:red}');

    const json = await sinRedirigir(`${url}datos.json`);
    assert.equal(json.status, 200);
    assert.equal(json.headers.get('content-type'), 'application/json');
    assert.equal(await json.text(), '{"a":1}');
  });
});

test('extensión desconocida: application/octet-stream', async () => {
  await conServidor(async ({ url }) => {
    const res = await sinRedirigir(`${url}raro.xyz`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/octet-stream');
    assert.equal(await res.text(), 'x');
  });
});

test('ruta fuera del prefijo: 404', async () => {
  await conServidor(async ({ url }) => {
    const origen = new URL(url).origin;
    const res = await sinRedirigir(`${origen}/otro.html`);
    assert.equal(res.status, 404);
    await res.text();
  });
});

test('archivo inexistente bajo el prefijo: 404', async () => {
  await conServidor(async ({ url }) => {
    const res = await sinRedirigir(`${url}no-existe.html`);
    assert.equal(res.status, 404);
    await res.text();
  });
});

test('URI mal formado: 400 y el servidor sigue respondiendo', async () => {
  await conServidor(async ({ url }) => {
    const origen = new URL(url).origin;
    const malo = await sinRedirigir(`${origen}/b/%E0%A4%A`);
    assert.equal(malo.status, 400);
    await malo.text();

    const despues = await sinRedirigir(`${url}index.html`);
    assert.equal(despues.status, 200);
    assert.equal(await despues.text(), '<h1>hola</h1>');
  });
});

test('carpeta sin barra final: 301 con Location terminada en /', async () => {
  await conServidor(async ({ url }) => {
    const res = await sinRedirigir(`${url}sub`);
    assert.equal(res.status, 301);
    assert.ok(res.headers.get('location').endsWith('/'), `Location: ${res.headers.get('location')}`);
    await res.text();
  });
});

test('carpeta con barra final: sirve su index.html', async () => {
  await conServidor(async ({ url }) => {
    const res = await sinRedirigir(`${url}sub/`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/html; charset=utf-8');
    assert.equal(await res.text(), '<p>sub</p>');
  });
});

test('Range: bytes=0-4 devuelve 206 con Content-Range y los 5 primeros bytes', async () => {
  await conServidor(async ({ url }) => {
    const res = await fetch(`${url}binario.bin`, { redirect: 'manual', headers: { Range: 'bytes=0-4' } });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range'), 'bytes 0-4/8');
    const cuerpo = Buffer.from(await res.arrayBuffer());
    assert.deepEqual([...cuerpo], [0, 1, 2, 3, 4]);
  });
});

test('solicitudes registra las rutas pedidas', async () => {
  await conServidor(async (srv) => {
    const { url, solicitudes } = srv;
    await (await sinRedirigir(`${url}index.html`)).text();
    await (await sinRedirigir(`${url}estilo.css`)).text();
    assert.ok(solicitudes.includes('/b/index.html'), JSON.stringify(solicitudes));
    assert.ok(solicitudes.includes('/b/estilo.css'), JSON.stringify(solicitudes));
  });
});

test('la url devuelta incluye el prefijo', async () => {
  await conServidor(async ({ url }) => {
    assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/b\/$/);
  });
});

test('cerrar() resuelve y después el puerto deja de responder', async () => {
  const raiz = await fs.mkdtemp(path.join(os.tmpdir(), 'servidor-basico-'));
  try {
    await fs.writeFile(path.join(raiz, 'index.html'), '<h1>hola</h1>');
    const srv = await servir(raiz, { base: '/b/' });
    const res = await sinRedirigir(`${srv.url}index.html`);
    assert.equal(res.status, 200);
    await res.text();

    await srv.cerrar();

    await assert.rejects(() => fetch(`${srv.url}index.html`), 'el puerto debería dejar de responder');
  } finally {
    await fs.rm(raiz, { recursive: true, force: true });
  }
});
