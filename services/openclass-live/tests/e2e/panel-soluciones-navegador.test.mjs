/**
 * Panel docente en Chrome real (Node >= 22): ciclo de vida de las soluciones de preguntas improvisadas.
 * Sin presentación ni estudiantes: solo el panel contra el servicio en 127.0.0.1.
 *  - recargar la misma pestaña con la sala activa conserva la solución (y «Revelar explicación»);
 *  - finalizar la sala la borra de memoria y de sessionStorage;
 *  - una sala nueva no hereda soluciones y una entrada de una sala que ya no existe se descarta al cargar;
 *  - cerrar sesión borra soluciones y campos privados a medio escribir;
 *  - solo se borra la clave propia (otras claves de sessionStorage siguen) y el panel se sirve con COOP.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearApp } from '../../src/app.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';

const PASSWORD = 'clave-e2e-panel-soluciones';
const CLAVE = 'openclass-live:soluciones';
const EXPLICACION = 'EXPLICACION-IMPROVISADA-PRIVADA';

test('panel docente: las soluciones improvisadas no sobreviven a la sala ni a la sesión', { timeout: 180_000 }, async (t) => {
  const sondeo = crearApp(leerConfig({ APP_URL: 'http://127.0.0.1:1', SESSION_SECRET: 'x'.repeat(48), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD) }), { log: () => {} });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = crearApp(leerConfig({ APP_URL: APP, SESSION_SECRET: 'e2e'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), TRUST_PROXY: 'false' }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());

  // window.opener: el panel se aísla de quien lo abra (COOP) y sus enlaces salen con noopener.
  const r = await fetch(`${APP}/docente/`);
  assert.equal(r.headers.get('cross-origin-opener-policy'), 'same-origin');
  assert.match(await r.text(), /id="enlace" target="_blank" rel="noopener noreferrer"/);

  const navegador = await abrirNavegador({ ancho: 1366, alto: 900 });
  t.after(() => navegador.cerrar());
  const panel = await navegador.pagina({ ancho: 1366, alto: 900 });
  const almacen = async () => JSON.parse(await panel.evaluar(`sessionStorage.getItem(${JSON.stringify(CLAVE)}) ?? 'null'`));
  const sustitutos = () => panel.evaluar(`window.confirm = () => true; window.alert = () => {};`);
  const entrar = async () => {
    await panel.esperarA(`!document.getElementById('vista-login').classList.contains('oculto')`);
    await panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(PASSWORD)}; document.getElementById('form-login').requestSubmit();`);
    await panel.esperarA(`!document.getElementById('vista-salas').classList.contains('oculto')`);
    await sustitutos();
  };
  const crearSala = async (titulo) => {
    await panel.evaluar(`document.getElementById('titulo-sala').value = ${JSON.stringify(titulo)}; document.getElementById('form-sala').requestSubmit();`);
    await panel.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto') && document.getElementById('titulo-panel').textContent === ${JSON.stringify(titulo)}`);
    return panel.evaluar(`location.hash.slice('#sala='.length)`);
  };
  const improvisar = (enunciado, abrir) => panel.evaluar(`(() => { document.getElementById('composer').open = true;
    document.getElementById('enunciado').value = ${JSON.stringify(enunciado)};
    const filas = document.getElementById('opciones').children;
    filas[0].querySelector('input[type=text]').value = 'Primera'; filas[1].querySelector('input[type=text]').value = 'Segunda';
    filas[1].querySelector('input[type=checkbox]').checked = true;
    document.getElementById('explicacion').value = ${JSON.stringify(EXPLICACION)};
    ${abrir ? `document.getElementById('form-encuesta').requestSubmit()` : `document.getElementById('btn-guardar').click()`}; })()`);

  await panel.ir(`${APP}/docente/`);
  await panel.evaluar(`sessionStorage.setItem('otra-app:dato', 'conservar')`);
  await entrar();

  // ---------- Sala 1: recargar la misma pestaña conserva la solución ----------
  const sala1 = await crearSala('Sala uno');
  await improvisar('¿Primera improvisada?', true);
  await panel.esperarA(`document.getElementById('btn-cerrar')`);
  let guardado = await almacen();
  assert.equal(Object.keys(guardado).length, 1);
  assert.deepEqual(Object.values(guardado)[0], { salaId: sala1, correctas: [1], explicacion: EXPLICACION }, 'la solución recuerda su sala');
  await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
  await panel.esperarA(`document.getElementById('btn-publicar')`);
  await panel.evaluar(`document.getElementById('btn-publicar').click()`);
  await panel.esperarA(`document.getElementById('btn-revelar')`);
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(`document.getElementById('btn-revelar')`);
  assert.deepEqual(await almacen(), guardado, 'recargar con la sesión activa conserva la solución');
  await sustitutos();

  // ---------- Finalizar la sala la borra ----------
  await panel.evaluar(`document.getElementById('btn-finalizar').click()`);
  await panel.esperarA(`!document.getElementById('vista-salas').classList.contains('oculto')`);
  assert.equal(await almacen(), null, 'finalizar borra la clave propia');
  assert.equal(await panel.evaluar(`sessionStorage.getItem('otra-app:dato')`), 'conservar', 'sin sessionStorage.clear()');

  // ---------- Sala 2: sin residuos; una entrada de una sala inexistente se descarta al cargar ----------
  const sala2 = await crearSala('Sala dos');
  assert.equal(await almacen(), null, 'la sala nueva no hereda soluciones');
  assert.doesNotMatch(await panel.evaluar(`document.getElementById('panel-activa').textContent`), /EXPLICACION/);
  await improvisar('¿Segunda improvisada?', false);
  await panel.esperarA(`document.querySelectorAll('#historial .chip.lista').length === 1`);
  guardado = await almacen();
  assert.equal(Object.values(guardado)[0].salaId, sala2);
  await panel.evaluar(`sessionStorage.setItem(${JSON.stringify(CLAVE)}, JSON.stringify({ ...JSON.parse(sessionStorage.getItem(${JSON.stringify(CLAVE)})),
    fantasma: { salaId: 'sala-que-ya-no-existe', correctas: [0], explicacion: 'RESIDUO' }, viejo: { correctas: [0], explicacion: 'FORMATO-ANTERIOR' } }))`);
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto')`);
  await panel.esperarA(`!(sessionStorage.getItem(${JSON.stringify(CLAVE)}) ?? '').includes('RESIDUO')`);
  assert.deepEqual(await almacen(), guardado, 'solo queda la solución de la sala vigente');
  await sustitutos();

  // ---------- Cerrar sesión borra soluciones y campos privados a medio escribir ----------
  await panel.evaluar(`(() => { document.getElementById('composer').open = true; document.getElementById('explicacion').value = 'BORRADOR-PRIVADO';
    document.getElementById('opciones').children[0].querySelector('input[type=checkbox]').checked = true; })()`);
  await panel.evaluar(`document.getElementById('btn-salir').click()`);
  await panel.esperarA(`!document.getElementById('vista-login').classList.contains('oculto')`);
  assert.equal(await almacen(), null, 'cerrar sesión borra la clave propia');
  assert.equal(await panel.evaluar(`document.getElementById('explicacion').value`), '', 'el borrador privado se limpia');
  assert.equal(await panel.evaluar(`[...document.querySelectorAll('#opciones input[type=checkbox]')].some((c) => c.checked)`), false, 'ninguna correcta marcada');
  assert.doesNotMatch(await panel.evaluar(`document.body.innerText`), /EXPLICACION|BORRADOR/);
  assert.equal(await panel.evaluar(`sessionStorage.getItem('otra-app:dato')`), 'conservar');

  // Volver a entrar: la sala 2 sigue abierta, pero su solución ya no está en esta pestaña.
  await entrar();
  assert.equal(await almacen(), null, 'una sesión nueva empieza sin soluciones');
  await panel.evaluar(`[...document.querySelectorAll('#lista-salas button')].find((b) => b.textContent === 'Abrir panel').click()`);
  await panel.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto')`);
  assert.equal(await almacen(), null);
  assert.equal(sala1 === sala2, false);
});
