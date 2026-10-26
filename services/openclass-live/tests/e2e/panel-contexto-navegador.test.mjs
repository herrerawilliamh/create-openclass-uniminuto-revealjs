/**
 * Panel docente en Chrome real (Node >= 22): las soluciones improvisadas no sobreviven a una sesión
 * vencida ni a un cambio de sala. Sin presentación ni estudiantes: solo el panel contra el servicio.
 *  - sesión vencida en el servidor (reloj de autenticación adelantado; las salas siguen con el real):
 *    al recargar (HTTP) y al emitir una acción (acuse `no_autenticado`), el acceso aparece con la
 *    memoria, la clave propia de sessionStorage y el formulario ya limpios;
 *  - volver a «Salas» y cambiar entre dos salas vigentes no recupera soluciones de la sala abandonada;
 *  - un borrador sin guardar pide confirmación: cancelar conserva el contexto, aceptar lo limpia;
 *  - recargar en la misma sala conserva la solución; otras claves de sessionStorage siguen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearApp } from '../../src/app.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';

const PASSWORD = 'clave-e2e-panel-contexto';
const CLAVE = 'openclass-live:soluciones';
const EXPLICACION = 'EXPLICACION-PRIVADA-CONTEXTO';

// Solo la autenticación lee Date.now (tokens y sesiones); las salas usan `ahora` con el reloj real.
const relojReal = Date.now.bind(Date);
let desfase = 0;
Date.now = () => relojReal() + desfase;
const vencerSesion = () => { desfase += 61 * 60_000; }; // TEACHER_SESSION_HOURS=1

async function montar(t) {
  const env = { SESSION_SECRET: 'ctx'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), TEACHER_SESSION_HOURS: '1', TRUST_PROXY: 'false' };
  const sondeo = crearApp(leerConfig({ ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {}, ahora: relojReal });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = crearApp(leerConfig({ ...env, APP_URL: APP }), { log: () => {}, ahora: relojReal });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());

  const navegador = await abrirNavegador({ ancho: 1366, alto: 900 });
  t.after(() => navegador.cerrar());
  const panel = await navegador.pagina({ ancho: 1366, alto: 900 });
  // Estado en el instante en que aparece el acceso (también tras recargar).
  await panel.send('Page.addScriptToEvaluateOnNewDocument', { source: `document.addEventListener('DOMContentLoaded', () => {
    const login = document.getElementById('vista-login');
    window.__alLogin = [];
    new MutationObserver(() => { if (!login.classList.contains('oculto')) window.__alLogin.push({
      guardado: sessionStorage.getItem(${JSON.stringify(CLAVE)}), explicacion: document.getElementById('explicacion').value,
      enunciado: document.getElementById('enunciado').value, marcadas: document.querySelectorAll('#opciones input:checked').length,
      privado: /EXPLICACION|BORRADOR/.test(document.body.innerText) }); }).observe(login, { attributes: true, attributeFilter: ['class'] });
  });` });

  const visible = (id) => `!document.getElementById('${id}').classList.contains('oculto')`;
  const p = {
    APP, panel, visible,
    almacen: async () => JSON.parse(await panel.evaluar(`sessionStorage.getItem(${JSON.stringify(CLAVE)}) ?? 'null'`)),
    // confirm() simulado: registra el mensaje y responde lo que diga window.__responder.
    sustitutos: () => panel.evaluar(`window.__confirmes = []; window.__responder = true;
      window.confirm = (m) => { window.__confirmes.push(m); return window.__responder; }; window.alert = () => {};`),
    async entrar() {
      await panel.esperarA(visible('vista-login'));
      await panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(PASSWORD)}; document.getElementById('form-login').requestSubmit();`);
      await panel.esperarA(visible('vista-salas'));
      await p.sustitutos();
    },
    async crearSala(titulo) {
      await panel.evaluar(`document.getElementById('titulo-sala').value = ${JSON.stringify(titulo)}; document.getElementById('form-sala').requestSubmit();`);
      await panel.esperarA(`${visible('vista-sala')} && document.getElementById('titulo-panel').textContent === ${JSON.stringify(titulo)}`);
      return panel.evaluar(`location.hash.slice('#sala='.length)`);
    },
    async abrirSala(titulo) {
      await panel.esperarA(`[...document.querySelectorAll('#lista-salas li')].some((li) => li.textContent.includes(${JSON.stringify(titulo)}))`);
      await panel.evaluar(`[...document.querySelectorAll('#lista-salas li')].find((li) => li.textContent.includes(${JSON.stringify(titulo)})).querySelector('button').click()`);
      await panel.esperarA(`${visible('vista-sala')} && document.getElementById('titulo-panel').textContent === ${JSON.stringify(titulo)}`);
    },
    escribir: (enunciado) => panel.evaluar(`(() => { document.getElementById('composer').open = true;
      document.getElementById('enunciado').value = ${JSON.stringify(enunciado)};
      const filas = document.getElementById('opciones').children;
      filas[0].querySelector('input[type=text]').value = 'Primera'; filas[1].querySelector('input[type=text]').value = 'Segunda';
      filas[1].querySelector('input[type=checkbox]').checked = true;
      document.getElementById('codigo').value = 'print(42)';
      document.getElementById('explicacion').value = ${JSON.stringify(EXPLICACION)}; })()`),
    /** Pregunta improvisada con solución, votación cerrada y resultados mostrados: «Revelar» disponible. */
    async preparada(enunciado) {
      await p.escribir(enunciado);
      await panel.evaluar(`document.getElementById('form-encuesta').requestSubmit()`);
      await panel.esperarA(`document.getElementById('btn-cerrar')`);
      await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
      await panel.esperarA(`document.getElementById('btn-publicar')`);
      await panel.evaluar(`document.getElementById('btn-publicar').click()`);
      await panel.esperarA(`document.getElementById('btn-revelar')`);
    },
    formularioVacio: () => panel.evaluar(`['enunciado', 'codigo', 'explicacion'].every((id) => document.getElementById(id).value === '')
      && [...document.querySelectorAll('#opciones input[type=text]')].every((i) => i.value === '')
      && document.querySelectorAll('#opciones input:checked').length === 0 && document.getElementById('opciones').children.length === 4`),
    /** La sala abierta no muestra ninguna solución local: ni «Revelar», ni explicación, ni correcta marcada. */
    async sinSolucionLocal() {
      await panel.esperarA(`document.getElementById('revelar-en-presentacion')`);
      assert.equal(await panel.evaluar(`Boolean(document.getElementById('btn-revelar'))`), false, 'sin «Revelar explicación»');
      assert.equal(await panel.evaluar(`document.querySelectorAll('#panel-activa .correcta').length`), 0, 'ninguna barra marcada como correcta');
      assert.doesNotMatch(await panel.evaluar(`document.body.innerText`), /EXPLICACION|Explicación preparada/);
    },
  };
  return p;
}

test('panel docente: una sesión vencida limpia memoria, almacenamiento y formulario antes del acceso', { timeout: 180_000 }, async (t) => {
  const { APP, panel, visible, almacen, entrar, crearSala, abrirSala, escribir, preparada, formularioVacio, sinSolucionLocal } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await panel.evaluar(`sessionStorage.setItem('otra-app:dato', 'conservar')`);
  await entrar();

  // ---------- Ruta HTTP: recargar con la sesión vencida ----------
  await crearSala('Sala vencida');
  await preparada('¿Vence por recarga?');
  assert.equal(Object.keys(await almacen()).length, 1);
  await escribir('BORRADOR-PRIVADO a medio escribir');
  vencerSesion();
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(visible('vista-login'));
  assert.deepEqual(await panel.evaluar(`window.__alLogin[0]`),
    { guardado: null, explicacion: '', enunciado: '', marcadas: 0, privado: false }, 'el acceso aparece ya limpio');
  assert.equal(await almacen(), null, 'sin la clave propia');
  assert.equal(await formularioVacio(), true);
  assert.equal(await panel.evaluar(`sessionStorage.getItem('otra-app:dato')`), 'conservar', 'solo la clave propia');
  // Iniciar de nuevo: la sala sigue abierta pero la solución anterior no vuelve (ni de memoria ni de almacenamiento).
  await entrar();
  await abrirSala('Sala vencida');
  await sinSolucionLocal();
  assert.equal(await almacen(), null);

  // ---------- Ruta Socket.IO: una acción con la sesión vencida (acuse no_autenticado) ----------
  await preparada('¿Vence por acción?');
  assert.equal(Object.keys(await almacen()).length, 1);
  await escribir('BORRADOR-PRIVADO otra vez');
  await panel.evaluar(`window.__alLogin = []`);
  vencerSesion();
  await panel.evaluar(`document.getElementById('btn-retirar').click()`);
  await panel.esperarA(visible('vista-login'));
  assert.deepEqual(await panel.evaluar(`window.__alLogin[0]`),
    { guardado: null, explicacion: '', enunciado: '', marcadas: 0, privado: false }, 'el acceso aparece ya limpio');
  assert.equal(await panel.evaluar(`location.hash`), '');
  assert.equal(await formularioVacio(), true);
  await entrar();
  await abrirSala('Sala vencida');
  await sinSolucionLocal();
  assert.equal(await almacen(), null);
  assert.equal(await panel.evaluar(`sessionStorage.getItem('otra-app:dato')`), 'conservar');
});

test('panel docente: cambiar de sala no arrastra soluciones ni borradores; recargar en la misma sala las conserva', { timeout: 180_000 }, async (t) => {
  const { APP, panel, visible, almacen, sustitutos, entrar, crearSala, abrirSala, escribir, preparada, formularioVacio, sinSolucionLocal } = await montar(t);
  const volver = async () => {
    await panel.evaluar(`document.getElementById('btn-volver').click()`);
    await panel.esperarA(visible('vista-salas'));
  };
  await panel.ir(`${APP}/docente/`);
  await panel.evaluar(`sessionStorage.setItem('otra-app:dato', 'conservar')`);
  await entrar();

  // ---------- Recarga legítima en la misma sala: la solución sigue y se puede revelar ----------
  const salaA = await crearSala('Sala A');
  await preparada('¿Pregunta de la sala A?');
  const deA = await almacen();
  assert.equal(Object.values(deA)[0].salaId, salaA);
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(`document.getElementById('btn-revelar')`);
  assert.deepEqual(await almacen(), deA, 'recargar en la misma sala conserva la solución');
  assert.match(await panel.evaluar(`document.getElementById('panel-activa').textContent`), /Explicación preparada/);
  await sustitutos();

  // ---------- Sala A con solución → «Salas» → sala B: sin residuos ----------
  await volver();
  assert.equal(await almacen(), null, 'volver a «Salas» borra la solución de la sala abandonada');
  assert.equal(await panel.evaluar(`location.hash`), '');
  assert.equal(await panel.evaluar(`document.getElementById('panel-activa').childElementCount`), 0, 'la tarjeta activa no queda en el DOM');
  assert.doesNotMatch(await panel.evaluar(`document.documentElement.innerHTML`), /EXPLICACION/, 'ni rastro en el DOM oculto');
  const salaB = await crearSala('Sala B');
  assert.equal(await almacen(), null, 'la sala B no hereda soluciones');
  assert.equal(await formularioVacio(), true);
  assert.doesNotMatch(await panel.evaluar(`document.body.innerText`), /EXPLICACION|Pregunta de la sala A/);

  // ---------- Dos salas vigentes: ir y volver no recupera la solución abandonada ----------
  await preparada('¿Pregunta de la sala B?');
  assert.equal(Object.values(await almacen())[0].salaId, salaB);
  await volver();
  assert.equal(await almacen(), null);
  await abrirSala('Sala A');
  await sinSolucionLocal();
  assert.equal(await almacen(), null, 'la solución abandonada de A no vuelve');
  await volver();
  await abrirSala('Sala B');
  await sinSolucionLocal();

  // ---------- Borrador sin guardar: cancelar conserva el contexto; aceptar lo limpia ----------
  await preparada('¿Otra de la sala B?');
  const deB = await almacen();
  await escribir('BORRADOR-PRIVADO sin guardar');
  await panel.evaluar(`window.__responder = false; window.__confirmes = []`);
  await panel.evaluar(`document.getElementById('btn-volver').click()`);
  assert.equal(await panel.evaluar(`window.__confirmes.length`), 1, 'pide confirmación');
  assert.match(await panel.evaluar(`window.__confirmes[0]`), /sin guardar/);
  assert.equal(await panel.evaluar(visible('vista-sala')), true, 'cancelar se queda en la sala');
  assert.equal(await panel.evaluar(`location.hash`), `#sala=${salaB}`);
  assert.deepEqual(await almacen(), deB, 'cancelar conserva la solución de la sala');
  assert.equal(await panel.evaluar(`document.getElementById('explicacion').value`), EXPLICACION, 'cancelar conserva el borrador');
  assert.equal(await panel.evaluar(`document.querySelectorAll('#opciones input:checked').length`), 1);
  assert.equal(await panel.evaluar(`Boolean(document.getElementById('btn-revelar'))`), true);
  // «Cerrar sesión» con borrador: también pregunta y cancelar no cierra nada.
  await panel.evaluar(`document.getElementById('btn-salir').click()`);
  assert.equal(await panel.evaluar(`window.__confirmes.length`), 2);
  assert.equal(await panel.evaluar(visible('vista-sala')), true);
  assert.equal(await panel.evaluar(`fetch('/api/docente/sesion').then((r) => r.json()).then((d) => d.autenticado)`), true, 'la sesión sigue abierta');
  assert.deepEqual(await almacen(), deB);
  await panel.evaluar(`window.__responder = true`);
  await volver();
  assert.equal(await panel.evaluar(`window.__confirmes.length`), 3);
  assert.equal(await almacen(), null, 'aceptar descarta la solución de la sala abandonada');
  assert.equal(await formularioVacio(), true, 'aceptar reinicia el formulario (correctas, código, explicación)');
  // Sin borrador no hay pregunta.
  await abrirSala('Sala A');
  await volver();
  assert.equal(await panel.evaluar(`window.__confirmes.length`), 3, 'sin borrador no pregunta');

  // ---------- Revelación explícita desde el panel ----------
  await abrirSala('Sala A');
  await preparada('¿Se revela en A?');
  await panel.evaluar(`document.getElementById('btn-revelar').click()`);
  await panel.esperarA(`document.getElementById('panel-activa').textContent.includes('Respuesta revelada')`);
  assert.equal(await almacen(), null, 'tras revelar, la copia local se descarta');
  assert.match(await panel.evaluar(`document.getElementById('panel-activa').textContent`), new RegExp(EXPLICACION), 'la explicación revelada llega del servidor');
  assert.equal(await panel.evaluar(`sessionStorage.getItem('otra-app:dato')`), 'conservar', 'solo la clave propia');
});
