import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { leerConfig } from '../src/config.mjs';
import { origenAdmitido } from '../src/sockets.mjs';

const base = { APP_URL: 'https://interact.apps.willedtech.io', SESSION_SECRET: 'synthetic-domain-transition-secret-0123456789', DATABASE_URL: 'postgres://u:p@localhost:5432/interact', NODE_ENV: 'test' };
const leer = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('APP_ALT_URLS: dominio canónico primero, alternos validados y sin duplicados', () => {
  const c = leerConfig({ ...base, APP_ALT_URLS: 'https://openclass-live.apps.willedtech.io/, https://interact.apps.willedtech.io' });
  assert.deepEqual([...c.origenesApp], ['https://interact.apps.willedtech.io', 'https://openclass-live.apps.willedtech.io']);
  assert.equal(c.appUrl, 'https://interact.apps.willedtech.io');
  assert.deepEqual([...leerConfig(base).origenesApp], [base.APP_URL]);
  assert.throws(() => leerConfig({ ...base, APP_ALT_URLS: 'https://x.test/ruta' }), /APP_ALT_URLS/);
  assert.throws(() => leerConfig({ ...base, NODE_ENV: 'production', APP_ALT_URLS: 'http://x.test' }), /https/);
});

test('origen: solo canónico y alternos; cualquier otro se rechaza', () => {
  const c = leerConfig({ ...base, APP_ALT_URLS: 'https://openclass-live.apps.willedtech.io' });
  assert.equal(origenAdmitido({ origin: 'https://openclass-live.apps.willedtech.io' }, c.origenesApp), true);
  assert.equal(origenAdmitido({ origin: 'https://interact.apps.willedtech.io' }, c.origenesApp), true);
  assert.equal(origenAdmitido({ origin: 'https://evil.example' }, c.origenesApp), false);
});

test('Compose: router nuevo y router alterno independientes con myresolver; GitOps coherente', () => {
  for (const f of ['docker-compose.yml', 'docker-compose.gitops.yml']) {
    const y = leer(f);
    assert.match(y, /routers\.openclass-live\.rule=Host\(`\$\{APP_HOST:\?/);
    assert.match(y, /routers\.openclass-live-alt\.rule=Host\(`\$\{APP_HOST_ALT:-\$\{APP_HOST\}\}`\)/);
    assert.match(y, /routers\.openclass-live-alt\.tls\.certresolver=myresolver/);
    assert.match(y, /APP_ALT_URLS: \$\{APP_ALT_URLS:-\}/);
  }
  assert.match(leer('.env.example'), /APP_HOST=interact\.apps\.willedtech\.io/);
});
