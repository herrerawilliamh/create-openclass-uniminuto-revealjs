/**
 * Interact 0.4.0 en Chrome real: invitación → cuenta → verificación → inicio de sesión → panel personal,
 * «Mis sesiones», administración, aislamiento visible entre docentes, adaptación móvil, teclado y foco.
 * Las capturas se escriben en INTERACT_CAPTURAS (si se define) para la revisión visual.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearApp } from '../../src/app.mjs';
import { leerConfig } from '../../src/config.mjs';

const ADMIN = { email: 'admin@willedtech.test', password: 'clave-admin-larga-2026' };
const CAPTURAS = process.env.INTERACT_CAPTURAS;

async function montar(t) {
  const env = { SESSION_SECRET: 'cue'.repeat(20), TRUST_PROXY: 'false' };
  const sondeo = crearApp(leerConfig({ ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {} });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = crearApp(leerConfig({ ...env, APP_URL: APP }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());
  app.cuentas.crearSuperusuario(ADMIN);
  const navegador = await abrirNavegador({ ancho: 1280, alto: 900 });
  t.after(() => navegador.cerrar());
  return { app, APP, navegador };
}

const visible = (id) => `!document.getElementById('${id}').classList.contains('oculto')`;
async function capturar(pagina, nombre) {
  if (!CAPTURAS) return;
  mkdirSync(CAPTURAS, { recursive: true });
  writeFileSync(path.join(CAPTURAS, `${nombre}.png`), await pagina.captura());
}
const sinDesborde = (pagina) => pagina.evaluar('document.documentElement.scrollWidth <= window.innerWidth + 1');

test('flujo completo en navegador: invitación, verificación, acceso, historial y administración', async (t) => {
  const { app, APP, navegador } = await montar(t);
  const pagina = await navegador.pagina({ ancho: 1280, alto: 900 });
  const admin = app.cuentas.listarUsuarios()[0];

  // --- Invitación → crear cuenta ---
  const inv = app.cuentas.invitar({ actorId: admin.id, email: 'ana@uni.test', rol: 'docente' });
  await pagina.ir(`${APP}/cuenta/#invitacion=${inv.token}`);
  await pagina.esperarA(visible('v-invitacion'));
  assert.equal(await pagina.evaluar('location.hash'), '', 'el token se borra de la barra de direcciones');
  assert.match(await pagina.evaluar(`document.getElementById('inv-para').textContent`), /ana@uni\.test/);
  assert.equal(await pagina.evaluar(`document.activeElement.tagName`), 'H2', 'el foco pasa al título de la vista');
  await capturar(pagina, '01-cuenta-invitacion');
  // Contraseñas distintas → error accesible y foco en el campo.
  await pagina.evaluar(`document.getElementById('i-nombre').value = 'Ana Pérez'; document.getElementById('i-pass').value = 'ana-clave-larga-1'; document.getElementById('i-pass2').value = 'otra-distinta-123'; document.getElementById('f-invitacion').requestSubmit();`);
  await pagina.esperarA(visible('e-inv'));
  assert.equal(await pagina.evaluar(`document.getElementById('e-inv').getAttribute('role')`), 'alert');
  assert.equal(await pagina.evaluar('document.activeElement.id'), 'i-pass2');
  await pagina.evaluar(`document.getElementById('i-pass2').value = 'ana-clave-larga-1'; document.getElementById('f-invitacion').requestSubmit();`);
  await pagina.esperarA(visible('v-pendiente'));
  assert.equal(app.correo.bandeja.at(-1).para, 'ana@uni.test');

  // El enlace usado no sirve de nuevo (se sale primero: un cambio solo de fragmento no recarga la página).
  await pagina.ir('about:blank');
  await pagina.ir(`${APP}/cuenta/#invitacion=${inv.token}`);
  await pagina.esperarA(visible('v-fin'));
  assert.match(await pagina.evaluar(`document.getElementById('t-fin').textContent`), /no válida/);

  // --- Sin verificar no entra; verificar; entrar ---
  await pagina.ir(`${APP}/docente/`);
  await pagina.esperarA(visible('vista-login'));
  await capturar(pagina, '02-acceso');
  assert.equal(await pagina.evaluar(`document.getElementById('email').required`), true, 'sin acceso heredado el correo es obligatorio');
  const entrar = (email, pass) => pagina.evaluar(`document.getElementById('email').value = ${JSON.stringify(email)}; document.getElementById('password').value = ${JSON.stringify(pass)}; document.getElementById('form-login').requestSubmit();`);
  await entrar('ana@uni.test', 'ana-clave-larga-1');
  await pagina.esperarA(`document.getElementById('error-login').textContent.includes('verificado')`);
  const verificacion = app.correo.bandeja.at(-1).texto.match(/#verificar=([\w-]+)/)[1];
  await pagina.ir(`${APP}/cuenta/#verificar=${verificacion}`);
  await pagina.esperarA(`document.getElementById('t-ver').textContent === 'Correo confirmado'`);

  await pagina.ir(`${APP}/docente/`);
  await pagina.esperarA(visible('vista-login'));
  await entrar('ana@uni.test', 'incorrecta-incorrecta');
  await pagina.esperarA(`document.getElementById('error-login').textContent.includes('incorrectos')`);
  assert.equal(await pagina.evaluar(`document.getElementById('password').value`), '', 'la contraseña rechazada se borra');
  await entrar('ana@uni.test', 'ana-clave-larga-1');
  await pagina.esperarA(visible('vista-salas'));
  assert.match(await pagina.evaluar(`document.getElementById('chip-usuario').textContent`), /Ana Pérez · docente/);
  assert.equal(await pagina.evaluar(`document.getElementById('ir-admin').classList.contains('oculto')`), true, 'un docente no ve Administración');
  await pagina.evaluar(`window.confirm = () => true;`);

  // --- Crear y finalizar una sala; aparece en «Mis sesiones» ---
  await pagina.evaluar(`document.getElementById('titulo-sala').value = 'Semana 3'; document.getElementById('form-sala').requestSubmit();`);
  await pagina.esperarA(`${visible('vista-sala')} && document.getElementById('titulo-panel').textContent === 'Semana 3'`);
  await pagina.evaluar(`document.getElementById('btn-finalizar').click()`);
  await pagina.esperarA(visible('vista-salas'));
  await pagina.evaluar(`document.getElementById('ir-historial').click()`);
  await pagina.esperarA(`${visible('vista-historial')} && document.querySelectorAll('#tabla-historial tbody tr').length === 1 && document.querySelector('#tabla-historial tbody th').textContent === 'Semana 3'`);
  assert.equal(await pagina.evaluar(`document.getElementById('ir-historial').getAttribute('aria-current')`), 'page');
  await capturar(pagina, '03-mis-sesiones');
  await pagina.evaluar(`document.querySelector('#tabla-historial tbody button').click()`);
  await pagina.esperarA(visible('detalle-historial'));
  assert.equal(await pagina.evaluar('document.activeElement.id'), 'detalle-historial');
  assert.doesNotMatch(await pagina.evaluar(`document.getElementById('cuerpo-detalle').textContent`), /null|undefined/, 'el detalle no muestra valores vacíos como texto');
  await capturar(pagina, '04-detalle-sesion');

  // --- Móvil: sin desbordes horizontales ---
  await pagina.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 800, deviceScaleFactor: 2, mobile: true });
  assert.equal(await sinDesborde(pagina), true, 'Mis sesiones en 375 px');
  await capturar(pagina, '05-mis-sesiones-movil');
  await pagina.ir(`${APP}/cuenta/#olvide`);
  await pagina.esperarA(visible('v-olvide'));
  assert.equal(await sinDesborde(pagina), true, 'Cuenta en 375 px');
  await capturar(pagina, '06-recuperar-movil');
  await pagina.send('Emulation.clearDeviceMetricsOverride');

  // Ana cierra sesión (el navegador comparte cookies entre pestañas).
  await pagina.ir(`${APP}/docente/`);
  await pagina.esperarA(visible('vista-salas'));
  await pagina.evaluar(`document.getElementById('btn-salir').click()`);
  await pagina.esperarA(visible('vista-login'));
  assert.equal((await fetch(`${APP}/api/docente/sesion`)).status, 200);

  // --- Superusuario: administración e invitación desde la interfaz ---
  const adm = await navegador.pagina({ ancho: 1280, alto: 900 });
  await adm.ir(`${APP}/docente/`);
  await adm.esperarA(visible('vista-login'));
  await adm.evaluar(`document.getElementById('email').value = ${JSON.stringify(ADMIN.email)}; document.getElementById('password').value = ${JSON.stringify(ADMIN.password)}; document.getElementById('form-login').requestSubmit();`);
  await adm.esperarA(visible('vista-salas'));
  await adm.evaluar(`window.confirm = () => true;`);
  assert.match(await adm.evaluar(`document.getElementById('ir-historial').textContent`), /Todas las sesiones/);
  await adm.evaluar(`document.getElementById('ir-admin').click()`);
  await adm.esperarA(`${visible('vista-admin')} && document.querySelectorAll('#tabla-usuarios tr').length >= 2`);
  assert.match(await adm.evaluar(`document.getElementById('estado-correo').textContent`), /NO está configurado|SMTP/);
  await adm.evaluar(`document.getElementById('inv-email').value = 'beto@uni.test'; document.getElementById('form-invitar').requestSubmit();`);
  await adm.esperarA(visible('enlace-manual'));
  assert.match(await adm.evaluar(`document.getElementById('inv-enlace').value`), /\/cuenta\/#invitacion=/);
  assert.match(await adm.evaluar(`document.getElementById('aviso-admin').textContent`), /SIMULADO/, 'no se afirma un envío real');
  await capturar(adm, '07-administracion');
  await adm.evaluar(`document.getElementById('ir-historial').click()`);
  await adm.esperarA(`${visible('vista-historial')} && document.querySelectorAll('#tabla-historial tbody tr').length === 1`);
  assert.equal(await adm.evaluar(`document.getElementById('campo-usuario').classList.contains('oculto')`), false);
  await capturar(adm, '08-todas-las-sesiones');

  // --- Teclado: Tab llega de #email a #password y al botón; Escape no cierra nada ---
  const kb = await navegador.pagina({ ancho: 1280, alto: 900 });
  await kb.ir(`${APP}/docente/`);
  await kb.esperarA(visible('vista-salas'));
  await kb.evaluar(`document.getElementById('btn-salir').click()`);
  await kb.esperarA(visible('vista-login'));
  await kb.evaluar(`document.getElementById('email').focus()`);
  await kb.tecla('Tab', { code: 'Tab', keyCode: 9 });
  assert.equal(await kb.evaluar('document.activeElement.id'), 'password');
  const foco = await kb.evaluar(`getComputedStyle(document.activeElement).outlineStyle !== 'none' || getComputedStyle(document.activeElement).boxShadow !== 'none'`);
  assert.equal(foco, true, 'el foco es visible');
});

test('vincular: sin sesión pide iniciar sesión; con sesión aprueba el código sin abrir salas', async (t) => {
  const { app, APP, navegador } = await montar(t);
  const LOCAL = 'http://localhost:8613';
  const pagina = await navegador.pagina({ ancho: 1280, alto: 900 });
  await pagina.ir(`${APP}/vincular/`);
  await pagina.esperarA(visible('v-entrar'));
  await capturar(pagina, '09-vincular-sin-sesion');
  // La presentación local inicia el vínculo (aquí por HTTP, con su origen).
  const ini = await fetch(`${APP}/api/vinculo/iniciar`, { method: 'POST', headers: { origin: LOCAL, 'content-type': 'application/json' }, body: '{}' }).then((r) => r.json());
  await pagina.ir(`${APP}/docente/`);
  await pagina.esperarA(visible('vista-login'));
  await pagina.evaluar(`document.getElementById('email').value = ${JSON.stringify(ADMIN.email)}; document.getElementById('password').value = ${JSON.stringify(ADMIN.password)}; document.getElementById('form-login').requestSubmit();`);
  await pagina.esperarA(visible('vista-salas'));
  await pagina.ir(`${APP}/vincular/`);
  await pagina.esperarA(visible('v-codigo'));
  await pagina.evaluar(`document.getElementById('codigo').value = ${JSON.stringify(ini.codigo.replace('-', '').toLowerCase())}; document.getElementById('codigo').dispatchEvent(new Event('input')); document.getElementById('f-codigo').requestSubmit();`);
  await pagina.esperarA(visible('v-confirmar'));
  await pagina.evaluar(`document.getElementById('b-confirmar').click();`);
  await pagina.esperarA(visible('v-ok'));
  await capturar(pagina, '10-vincular-aprobado');
  const sondeo = await fetch(`${APP}/api/vinculo/sondear`, { method: 'POST', headers: { origin: LOCAL, 'content-type': 'application/json' }, body: JSON.stringify({ id: ini.id, secreto: ini.secreto }) }).then((r) => r.json());
  assert.equal(sondeo.estado, 'aprobado');
  assert.equal(app.almacen.tamano, 0, 'vincular no abre ninguna sala');
});
