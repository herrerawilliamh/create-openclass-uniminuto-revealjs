/** Interact 0.4.0: adaptador de correo (SMTP real contra un servidor de prueba local) y scripts de operación. */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearCorreo, construirMensaje } from '../src/correo.mjs';
import { leerConfig } from '../src/config.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const BASE = { APP_URL: 'https://interact.test', SESSION_SECRET: 'z'.repeat(40) };

/** Servidor SMTP mínimo: guarda lo que recibe y responde como uno real (sin STARTTLS: solo bucle local). */
function servidorSmtp({ rechazarRcpt = false } = {}) {
  const recibido = { comandos: [], datos: '' };
  const srv = net.createServer((s) => {
    let enDatos = false; let buf = '';
    s.write('220 prueba ESMTP\r\n');
    s.on('data', (d) => {
      buf += d.toString();
      for (;;) {
        if (enDatos) {
          const i = buf.indexOf('\r\n.\r\n');
          if (i < 0) return;
          recibido.datos = buf.slice(0, i); buf = buf.slice(i + 5); enDatos = false; s.write('250 ok\r\n'); continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const l = buf.slice(0, i); buf = buf.slice(i + 2); recibido.comandos.push(l);
        if (/^EHLO/.test(l)) s.write('250 prueba\r\n');
        else if (/^MAIL/.test(l)) s.write('250 ok\r\n');
        else if (/^RCPT/.test(l)) s.write(rechazarRcpt ? '550 no\r\n' : '250 ok\r\n');
        else if (/^DATA/.test(l)) { s.write('354 siga\r\n'); enDatos = true; } else if (/^QUIT/.test(l)) s.end('221 adiós\r\n');
      }
    });
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, recibido, puerto: srv.address().port })));
}

test('configuración de correo: producción exige transporte explícito y no admite el de desarrollo', () => {
  const prod = { ...BASE, NODE_ENV: 'production', DATA_DIR: '/data' };
  assert.equal(leerConfig(prod).correo.transporte, 'desactivado');
  assert.throws(() => leerConfig({ ...prod, MAIL_TRANSPORT: 'desarrollo' }), /producción/);
  assert.throws(() => leerConfig({ ...prod, MAIL_TRANSPORT: 'smtp' }), /SMTP_HOST/);
  assert.throws(() => leerConfig({ ...BASE, NODE_ENV: 'production' }), /DATA_DIR/);
  assert.equal(leerConfig(BASE).correo.transporte, 'desarrollo');
  assert.equal(leerConfig(BASE).dataDir, null);
});

test('transportes sin entrega real no afirman haber enviado', async () => {
  const dev = crearCorreo(leerConfig(BASE));
  assert.deepEqual(await dev.enviar({ para: 'a@b.co', asunto: 'x', texto: 'y' }), { enviado: false, simulado: true });
  assert.equal(dev.bandeja.length, 1);
  const off = crearCorreo(leerConfig({ ...BASE, MAIL_TRANSPORT: 'desactivado' }));
  assert.deepEqual(await off.enviar({ para: 'a@b.co', asunto: 'x', texto: 'y' }), { enviado: false, simulado: false });
});

test('SMTP: entrega el mensaje codificado y rechaza cuando el servidor rechaza', async () => {
  const { srv, recibido, puerto } = await servidorSmtp();
  try {
    const correo = crearCorreo(leerConfig({ ...BASE, MAIL_TRANSPORT: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puerto), MAIL_FROM: 'Interact <no-responder@interact.test>' }));
    const r = await correo.enviar({ para: 'ana@uni.test', asunto: 'Invitación ñ', texto: 'Enlace: https://interact.test/cuenta/#invitacion=abc\n.punto' });
    assert.deepEqual(r, { enviado: true, simulado: false });
    assert.ok(recibido.comandos.includes('MAIL FROM:<no-responder@interact.test>'));
    assert.ok(recibido.comandos.includes('RCPT TO:<ana@uni.test>'));
    const cuerpo = Buffer.from(recibido.datos.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8');
    assert.match(cuerpo, /#invitacion=abc/);
    assert.match(recibido.datos, /Subject: =\?UTF-8\?B\?/);
  } finally { srv.close(); }
  const malo = await servidorSmtp({ rechazarRcpt: true });
  try {
    const correo = crearCorreo(leerConfig({ ...BASE, MAIL_TRANSPORT: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(malo.puerto), MAIL_FROM: 'a@interact.test' }));
    await assert.rejects(correo.enviar({ para: 'x@y.co', asunto: 'a', texto: 'b' }), /550|correo/);
  } finally { malo.srv.close(); }
});

test('SMTP: no envía credenciales por un canal sin cifrar', async () => {
  const { srv, recibido, puerto } = await servidorSmtp();
  try {
    const correo = crearCorreo(leerConfig({ ...BASE, MAIL_TRANSPORT: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(puerto), SMTP_USER: 'u', SMTP_PASSWORD: 'secreto-smtp', MAIL_FROM: 'a@interact.test' }));
    await assert.rejects(correo.enviar({ para: 'x@y.co', asunto: 'a', texto: 'b' }), /STARTTLS|correo/);
    assert.ok(!recibido.comandos.some((c) => /^AUTH/.test(c)));
  } finally { srv.close(); }
});

test('mensaje: las cabeceras no admiten inyección de saltos de línea', () => {
  const m = construirMensaje({ de: 'a@b.co', para: 'x@y.co\r\nBcc: robo@mal.test', asunto: 'hola\r\nBcc: z@z.co', texto: 't' });
  assert.ok(!/^Bcc:/m.test(m));
});

test('script init-superusuario: crea una sola vez, sin eco de la contraseña y sin valores por defecto', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'interact-init-'));
  const correr = (extra = []) => spawnSync(process.execPath, ['--no-warnings', path.join(raiz, 'scripts/init-superusuario.mjs'), '--email', 'root@uni.test', ...extra],
    { input: 'clave-super-larga-2026\n', encoding: 'utf8', env: { ...process.env, DATA_DIR: dir } });
  try {
    const sin = spawnSync(process.execPath, ['--no-warnings', path.join(raiz, 'scripts/init-superusuario.mjs'), '--email', 'root@uni.test'], { input: 'x', encoding: 'utf8', env: { ...process.env, DATA_DIR: '', DB_PATH: '' } });
    assert.notEqual(sin.status, 0);
    const a = correr();
    assert.equal(a.status, 0, a.stderr);
    assert.ok(!a.stdout.includes('clave-super') && !a.stderr.includes('clave-super'));
    assert.ok(existsSync(path.join(dir, 'interact.sqlite')));
    assert.notEqual(correr().status, 0, 'segunda ejecución rechazada');
    const r = spawnSync(process.execPath, ['--no-warnings', path.join(raiz, 'scripts/respaldar.mjs')], { encoding: 'utf8', env: { ...process.env, DATA_DIR: dir } });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(r.stdout).integra, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
