/**
 * Revalidación de los P2 del dictamen Codex en la arquitectura definitiva (PostgreSQL):
 *  P2-1 confianza en proxy y cabeceras: X-Forwarded-For / X-Real-Ip solo valen si el PAR TCP es un proxy de
 *       confianza (TRUSTED_PROXY_CIDRS) y si el valor es una IP válida.
 *  P2-3 cupos del vínculo local 5 por IP / 200 globales, comprobados de forma determinista (sin «o bien… o bien»).
 * P2-2 (permisos y aislamiento en PostgreSQL) está en postgresql.test.mjs y P2-4 (restauración) en
 * respaldo-restauracion.test.mjs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { crearConfianzaProxy, ipCliente, normalizarIp } from '../src/limites.mjs';
import { leerConfig } from '../src/config.mjs';
import { iniciar } from './ayuda.mjs';

const LOCAL = 'http://localhost:8613';
const BASE = { APP_URL: 'https://interact.test', SESSION_SECRET: 'z'.repeat(40), DATABASE_URL: 'postgres://u:clave-sintetica@db.invalid:5432/interact' };

test('P2-1: las cabeceras de reenvío solo cuentan desde un proxy de confianza y con una IP válida', () => {
  const traefik = crearConfianzaProxy(['172.18.0.0/16', 'fd00::/8']);
  const h = { 'x-forwarded-for': '1.1.1.1, 9.9.9.9', 'x-real-ip': '2.2.2.2' };
  assert.equal(ipCliente(h, '172.18.0.5', traefik), '9.9.9.9', 'desde Traefik manda el último tramo');
  assert.equal(ipCliente(h, '::ffff:172.18.0.5', traefik), '9.9.9.9', 'IPv4 mapeada en IPv6');
  assert.equal(ipCliente(h, 'fd00::1', traefik), '9.9.9.9');
  assert.equal(ipCliente(h, '203.0.113.7', traefik), '203.0.113.7', 'un par ajeno no puede elegir su IP');
  assert.equal(ipCliente(h, '172.19.0.5', traefik), '172.19.0.5', 'otra red Docker no es el proxy');
  assert.equal(ipCliente({ 'x-forwarded-for': 'no-es-ip', 'x-real-ip': '2.2.2.2' }, '172.18.0.5', traefik), '2.2.2.2');
  assert.equal(ipCliente({ 'x-forwarded-for': '1.1.1.1, 9.9.9.9 x', 'x-real-ip': 'basura' }, '172.18.0.5', traefik), '172.18.0.5', 'valor inválido → par');
  assert.equal(ipCliente({ 'x-forwarded-for': '1.1.1.1, 999.1.1.1' }, '172.18.0.5', traefik), '172.18.0.5');
  assert.equal(ipCliente(h, '10.0.0.1', false), '10.0.0.1', 'TRUST_PROXY=false ignora todo');
  assert.equal(normalizarIp('[2001:db8::1]'), '2001:db8::1');
  assert.throws(() => crearConfianzaProxy(['10.0.0.0/33']), /inválida/);
  assert.throws(() => crearConfianzaProxy(['traefik']), /inválida/);
  assert.throws(() => leerConfig({ ...BASE, TRUST_PROXY: 'true', TRUSTED_PROXY_CIDRS: '172.18.0.0/16,mal' }), /TRUSTED_PROXY_CIDRS/);
  // Fuera de producción el proxy no es de confianza salvo que se declare; en producción sí (detrás de Traefik).
  assert.equal(leerConfig(BASE).confiarProxy, false);
  assert.equal(typeof leerConfig({ ...BASE, NODE_ENV: 'production' }).confiarProxy, 'function');
  assert.equal(leerConfig({ ...BASE, NODE_ENV: 'production' }).confiarProxy('8.8.8.8'), false, 'una IP pública nunca es «el proxy»');
});

const iniciarVinculo = (c, ip) => c.peticion('/api/vinculo/iniciar', { metodo: 'POST', origen: LOCAL, cuerpo: {},
  cabeceras: ip ? { 'x-forwarded-for': ip } : {} }).then((r) => r.estado);

test('P2-1 (HTTP): un cliente que no es el proxy no evade el cupo por IP falsificando X-Forwarded-For', async () => {
  // Proxy de confianza en otra red: el par 127.0.0.1 NO lo es, así que sus cabeceras se ignoran.
  const c = await iniciar({ env: { TRUST_PROXY: 'true', TRUSTED_PROXY_CIDRS: '10.99.0.0/16' } });
  try {
    const estados = [];
    for (let i = 1; i <= 6; i++) estados.push(await iniciarVinculo(c, `203.0.113.${i}`));
    assert.deepEqual(estados, [200, 200, 200, 200, 200, 429], 'seis IP inventadas cuentan como la misma: la sexta se rechaza');
  } finally { await c.cerrar(); }
});

test('P2-3: cupos deterministas del vínculo — 5 pendientes por IP y 200 globales', async () => {
  // El par de prueba (127.0.0.1) hace de proxy de confianza: cada X-Forwarded-For es un cliente distinto.
  const c = await iniciar({ env: { TRUST_PROXY: 'true', TRUSTED_PROXY_CIDRS: '127.0.0.0/8,::1/128' } });
  try {
    // Por IP: exactamente cinco aceptados y el sexto rechazado; otra IP no se ve afectada.
    const porIp = [];
    for (let i = 0; i < 6; i++) porIp.push(await iniciarVinculo(c, '198.51.100.1'));
    assert.deepEqual(porIp, [200, 200, 200, 200, 200, 429]);
    assert.equal(await iniciarVinculo(c, '198.51.100.2'), 200);
    // Global: con 6 pendientes, faltan 194 para llegar a 200 (una por IP distinta). El 201.º se rechaza.
    let aceptados = 6;
    for (let i = 0; aceptados < 200; i++) {
      const estado = await iniciarVinculo(c, `10.${Math.floor(i / 250)}.${i % 250}.7`);
      assert.equal(estado, 200, `vínculo ${aceptados + 1} dentro del cupo global`);
      aceptados++;
    }
    assert.equal(aceptados, 200);
    assert.equal(await iniciarVinculo(c, '192.0.2.250'), 429, 'el vínculo 201 supera el cupo global aunque su IP sea nueva');
    assert.equal(await iniciarVinculo(c, '192.0.2.251'), 429, 'y sigue rechazado mientras haya 200 pendientes');
  } finally { await c.cerrar(); }
});
