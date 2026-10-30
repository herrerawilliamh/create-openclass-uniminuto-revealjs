import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { start, ORIGEN_PRESENTADOR } from '../template/scripts/openclass-start.mjs';

const leer = (ruta) => fs.readFileSync(new URL(ruta, import.meta.url), 'utf8');
const origenesLive = (texto) => (texto.match(/^PRESENTER_ORIGINS=(.*)$/m)?.[1] ?? '').split(',');

test('el origen que abre el lanzador está autorizado por la configuración de Live', () => {
  assert.equal(ORIGEN_PRESENTADOR, 'http://localhost:8600');
  assert.ok(origenesLive(leer('../services/openclass-live/.env.example')).includes(ORIGEN_PRESENTADOR));
  assert.match(leer('../services/openclass-live/docker-compose.yml'), /PRESENTER_ORIGINS:[^\n]*http:\/\/localhost:8600/);
  assert.match(leer('../services/openclass-live/src/config.mjs'), /PRESENTER_ORIGINS \?\? '[^']*http:\/\/localhost:8600/);
});

for (const modo of ['dev', 'preview']) {
  test(`arranque ${modo}: abre localhost:8600, escucha solo en 127.0.0.1 y conserva puerto estricto`, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-origen-'));
    fs.mkdirSync(path.join(root, 'node_modules/vite/dist/node'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules/vite/dist/node/index.js'), '');
    let opciones;
    const servidor = { listen: async () => {}, printUrls() {} };
    const motor = { createServer: async (o) => (opciones = o, servidor), preview: async (o) => (opciones = o, servidor) };
    const salida = [];
    try {
      await start(root, modo === 'preview' ? ['--preview', '--route=/general/'] : [], { load: async () => motor, log: (m) => salida.push(m) });
      const cfg = opciones[modo === 'preview' ? 'preview' : 'server'];
      assert.equal(cfg.host, '127.0.0.1');
      assert.equal(cfg.port, 8600);
      assert.equal(cfg.strictPort, true);
      assert.equal(cfg.open, ORIGEN_PRESENTADOR + (modo === 'preview' ? '/general/' : '/'));
      assert.doesNotMatch(cfg.open, /127\.0\.0\.1/);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
}
