/** Interact 0.4.0: adaptador de correo (SMTP real contra un servidor de prueba local) y scripts de operación. */
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearCorreo, construirMensaje } from '../src/correo.mjs';
import { leerConfig } from '../src/config.mjs';
import { borrarEsquema, conCliente, nuevoEsquema, urlPrueba } from './ayuda.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));
// La configuración no abre conexiones: una URL sintáctica basta para estas pruebas.
const BASE = { APP_URL: 'https://interact.test', SESSION_SECRET: 'z'.repeat(40), DATABASE_URL: 'postgres://interact_app:clave-sintetica@db.invalid:5432/interact' };

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
  const prod = { ...BASE, NODE_ENV: 'production' };
  assert.equal(leerConfig(prod).correo.transporte, 'desactivado');
  assert.throws(() => leerConfig({ ...prod, MAIL_TRANSPORT: 'desarrollo' }), /producción/);
  assert.throws(() => leerConfig({ ...prod, MAIL_TRANSPORT: 'smtp' }), /SMTP_HOST/);
  assert.equal(leerConfig(BASE).correo.transporte, 'desarrollo');
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

test('configuración PostgreSQL: URL obligatoria, sin valores de ejemplo, producción no migra', () => {
  const { DATABASE_URL: _u, ...sinUrl } = BASE;
  assert.throws(() => leerConfig(sinUrl), /DATABASE_URL es obligatoria/);
  assert.throws(() => leerConfig({ ...BASE, DATABASE_URL: 'mysql://a:b@h/x' }), /forma postgres:\/\//);
  assert.throws(() => leerConfig({ ...BASE, DATABASE_URL: 'postgres://u:CAMBIAR@h:5432/x', NODE_ENV: 'production' }), /ejemplo/);
  assert.throws(() => leerConfig({ ...BASE, DB_SCHEMA: 'Mal-Esquema' }), /DB_SCHEMA/);
  assert.throws(() => leerConfig({ ...BASE, DB_SSL: 'quizas' }), /DB_SSL/);
  assert.throws(() => leerConfig({ ...BASE, DB_POOL_MAX: '500' }), /fuera de rango/);
  const prod = leerConfig({ ...BASE, NODE_ENV: 'production' }).db;
  assert.equal(prod.migraciones, 'verificar', 'en producción el servicio solo verifica el esquema');
  assert.equal(prod.poolMax, 10);
  assert.equal(leerConfig(BASE).db.migraciones, 'auto');
  assert.deepEqual(leerConfig({ ...BASE, DB_SSL: 'verificado' }).db.ssl, { rejectUnauthorized: true });
  // Los mensajes de error nunca repiten la contraseña de la URL.
  try { leerConfig({ ...BASE, DATABASE_URL: 'postgres://u:CAMBIAR-secreto@h:5432/x', NODE_ENV: 'production' }); } catch (e) { assert.ok(!e.message.includes('secreto')); }
});

test('script init-superusuario: crea una sola vez, sin eco de la contraseña y sin valores por defecto (PostgreSQL)', async () => {
  const esquema = nuevoEsquema();
  const env = { ...process.env, DATABASE_URL: urlPrueba(), DB_SCHEMA: esquema, DB_MIGRATIONS: 'auto', INTERACT_SUPERUSER_PASSWORD: '' };
  const correr = (extra = {}) => spawnSync(process.execPath, ['--no-warnings', path.join(raiz, 'scripts/init-superusuario.mjs'), '--email', 'root@uni.test'],
    { input: 'clave-super-larga-2026\n', encoding: 'utf8', env: { ...env, ...extra } });
  try {
    const sin = correr({ DATABASE_URL: '' });
    assert.notEqual(sin.status, 0);
    assert.match(sin.stderr, /DATABASE_URL es obligatoria/);
    const a = correr();
    assert.equal(a.status, 0, a.stderr);
    assert.ok(!a.stdout.includes('clave-super') && !a.stderr.includes('clave-super'));
    const fila = await conCliente(esquema, (c) => c.query("SELECT email, rol, email_verificado, hash FROM usuarios WHERE rol = 'superusuario'"));
    assert.equal(fila.rowCount, 1);
    assert.equal(fila.rows[0].email, 'root@uni.test');
    assert.equal(fila.rows[0].email_verificado, true);
    assert.match(fila.rows[0].hash, /^scrypt\$32768\$/);
    assert.notEqual(correr().status, 0, 'segunda ejecución rechazada');
    // Producción: con el esquema migrado arranca; con migraciones pendientes se niega (no altera el esquema).
    const otro = nuevoEsquema();
    const r = correr({ DB_SCHEMA: otro, DB_MIGRATIONS: 'verificar' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /Migraciones pendientes|esquema/i);
    await borrarEsquema(otro);
  } finally { await borrarEsquema(esquema); }
});
