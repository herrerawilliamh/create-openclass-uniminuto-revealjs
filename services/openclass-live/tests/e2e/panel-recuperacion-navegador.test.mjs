/**
 * Panel docente en Chrome real (Node >= 22): recuperación ante fallos (I2).
 * Los fallos se simulan en el cliente (fetch y acuses de Socket.IO) sin tocar contratos ni el servidor:
 *  - acceso: red, timeout implícito, 401/403/429/5xx → mensaje comprensible, botón y campo reutilizables;
 *  - comprobación de sesión al abrir con 5xx: no borra soluciones ni borradores y ofrece reintentar;
 *  - salir con fallo HTTP: limpia lo local y no afirma que el servidor cerró la sesión;
 *  - «Copiar enlace»: confirma solo si el portapapeles aceptó; si no, deja el enlace seleccionado;
 *  - recepción/moderación de preguntas rechazada: la casilla vuelve al valor confirmado;
 *  - `sala:seguir` sin respuesta (reconexión y recarga): conserva soluciones y borrador y se recupera;
 *  - sala inexistente: aviso comprensible y limpieza.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearAppPrueba, entornoPg } from '../ayuda.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';

const PASSWORD = 'clave-e2e-panel-recuperacion';
const CLAVE = 'openclass-live:soluciones';
const EXPLICACION = 'EXPLICACION-PRIVADA-RECUPERACION';

// Simulador de fallos: configuración en sessionStorage 't:cfg' (sobrevive a recargar la pestaña).
const SIMULADOR = `(() => {
  const cfg = () => { try { return JSON.parse(sessionStorage.getItem('t:cfg')) ?? {}; } catch { return {}; } };
  const f = window.fetch.bind(window);
  window.fetch = (url, o) => {
    const regla = (cfg().http ?? {})[String(url)];
    if (regla === 'red') return Promise.reject(new TypeError('Failed to fetch'));
    if (regla) return Promise.resolve(new Response('{}', { status: regla, headers: { 'content-type': 'application/json' } }));
    return f(url, o);
  };
  let real;
  Object.defineProperty(window, 'io', { configurable: true, get: () => real, set: (v) => {
    real = (...a) => {
      const s = v(...a); window.__sock = s;
      const original = s.timeout.bind(s);
      s.timeout = (ms) => { const q = original(ms); return { emit: (ev, d, cb) => {
        const modo = (cfg().ev ?? {})[ev];
        if (modo === 'timeout') setTimeout(() => cb(new Error('timeout')), 20);
        else if (modo === 'rechazo') setTimeout(() => cb(null, { ok: false, error: 'rechazado', mensaje: 'Rechazado por el servidor' }), 20);
        else q.emit(ev, d, cb);
      } }; };
      return s;
    };
    Object.assign(real, v);
  } });
})();`;

async function montar(t) {
  const env = { SESSION_SECRET: 'rec'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), TRUST_PROXY: 'false' };
  const sondeo = await crearAppPrueba(leerConfig({ ...entornoPg(),  ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {} });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = await crearAppPrueba(leerConfig({ ...entornoPg(),  ...env, APP_URL: APP }), { log: () => {} });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());
  const navegador = await abrirNavegador({ ancho: 1366, alto: 900 });
  t.after(() => navegador.cerrar());
  const panel = await navegador.pagina({ ancho: 1366, alto: 900 });
  await panel.send('Page.addScriptToEvaluateOnNewDocument', { source: SIMULADOR });

  const visible = (id) => `!document.getElementById('${id}').classList.contains('oculto')`;
  const texto = (id) => panel.evaluar(`document.getElementById('${id}').textContent`);
  const cfg = (c) => panel.evaluar(`sessionStorage.setItem('t:cfg', ${JSON.stringify(JSON.stringify(c))})`);
  const p = {
    APP, panel, visible, texto, cfg,
    almacen: async () => JSON.parse(await panel.evaluar(`sessionStorage.getItem(${JSON.stringify(CLAVE)}) ?? 'null'`)),
    confirmar: () => panel.evaluar(`window.confirm = () => true; window.alert = () => {};`),
    enviarLogin: (password = PASSWORD) => panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(password)}; document.getElementById('form-login').requestSubmit();`),
    async entrar() {
      await panel.esperarA(visible('vista-login'));
      await p.enviarLogin();
      await panel.esperarA(visible('vista-salas'));
      await p.confirmar();
    },
    async crearSala(titulo) {
      await panel.evaluar(`document.getElementById('titulo-sala').value = ${JSON.stringify(titulo)}; document.getElementById('form-sala').requestSubmit();`);
      await panel.esperarA(`${visible('vista-sala')} && document.getElementById('titulo-panel').textContent === ${JSON.stringify(titulo)}`);
      return panel.evaluar(`location.hash.slice('#sala='.length)`);
    },
    escribir: (enunciado) => panel.evaluar(`(() => { document.getElementById('composer').open = true;
      document.getElementById('enunciado').value = ${JSON.stringify(enunciado)};
      const filas = document.getElementById('opciones').children;
      filas[0].querySelector('input[type=text]').value = 'Primera'; filas[1].querySelector('input[type=text]').value = 'Segunda';
      filas[1].querySelector('input[type=checkbox]').checked = true;
      document.getElementById('explicacion').value = ${JSON.stringify(EXPLICACION)}; })()`),
    async preparada(enunciado) {
      await p.escribir(enunciado);
      await panel.evaluar(`document.getElementById('form-encuesta').requestSubmit()`);
      await panel.esperarA(`document.getElementById('btn-cerrar')`);
      await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
      await panel.esperarA(`document.getElementById('btn-publicar')`);
      await panel.evaluar(`document.getElementById('btn-publicar').click()`);
      await panel.esperarA(`document.getElementById('btn-revelar')`);
    },
  };
  return p;
}

test('acceso: cada fallo HTTP muestra un mensaje comprensible y el formulario sigue utilizable', { timeout: 120_000 }, async (t) => {
  const { APP, panel, visible, texto, cfg, enviarLogin } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await panel.esperarA(visible('vista-login'));
  const casos = [['red', /Sin conexión/], [500, /problema/], [429, /Demasiados intentos/], [403, /rechazó la solicitud/], [401, /Contraseña incorrecta/]];
  for (const [regla, patron] of casos) {
    await cfg({ http: { '/api/docente/login': regla } });
    await enviarLogin();
    await panel.esperarA(`document.getElementById('error-login').textContent !== ''`);
    assert.match(await texto('error-login'), patron, `regla ${regla}`);
    assert.equal(await panel.evaluar(`document.getElementById('btn-login').disabled`), false, 'el botón vuelve a estar disponible');
    assert.equal(await panel.evaluar(`document.getElementById('btn-login').textContent`), 'Entrar');
    assert.equal(await panel.evaluar(`document.getElementById('btn-login').hasAttribute('aria-busy')`), false);
    assert.equal(await panel.evaluar(`document.activeElement.id`), 'password', 'el foco vuelve al campo de contraseña');
    assert.equal(await panel.evaluar(`document.getElementById('password').value`), regla === 401 || regla === 403 ? '' : PASSWORD,
      'rechazo: se borra; fallo pasajero: se conserva para reintentar');
  }
  // Tras todos los fallos, el mismo formulario entra con éxito.
  await cfg({});
  await enviarLogin();
  await panel.esperarA(visible('vista-salas'));
  assert.equal(await panel.evaluar(`document.getElementById('error-login').textContent`), '');
});

test('abrir con la comprobación de sesión caída (5xx) conserva soluciones locales y ofrece reintentar', { timeout: 120_000 }, async (t) => {
  const { APP, panel, visible, texto, cfg, almacen, entrar, crearSala, preparada } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await entrar();
  await crearSala('Sala resiliente');
  await preparada('¿Sobrevive a un 503?');
  const antes = await almacen();
  assert.equal(Object.keys(antes).length, 1);
  await cfg({ http: { '/api/docente/sesion': 503 } });
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(`${visible('vista-login')} && ${visible('btn-reintentar')}`);
  assert.match(await texto('error-login'), /no se ha borrado/);
  assert.deepEqual(await almacen(), antes, 'la solución privada sigue en sessionStorage');
  // El servicio vuelve: reintentar reanuda la sala y la solución sigue disponible.
  await cfg({});
  await panel.evaluar(`document.getElementById('btn-reintentar').click()`);
  await panel.esperarA(`document.getElementById('btn-revelar')`);
  assert.deepEqual(await almacen(), antes);
  // Una respuesta que SÍ dice «no hay sesión» (401) sigue limpiando.
  await cfg({ http: { '/api/docente/sesion': 401 } });
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(visible('vista-login'));
  assert.equal(await almacen(), null, 'una sesión rechazada limpia lo privado');
});

test('salir: limpia lo local aunque falle el HTTP y no afirma que el servidor cerró la sesión', { timeout: 120_000 }, async (t) => {
  const { APP, panel, visible, texto, cfg, almacen, entrar, crearSala, preparada, escribir, confirmar } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await entrar();
  for (const regla of ['red', 500]) {
    await crearSala(`Sala de salida ${regla}`);
    await preparada('¿Salir con fallo?');
    await escribir('BORRADOR-PRIVADO');
    await cfg({ http: { '/api/docente/logout': regla } });
    await panel.evaluar(`document.getElementById('btn-salir').click()`);
    await panel.esperarA(visible('vista-login'));
    assert.equal(await almacen(), null, `regla ${regla}: sin soluciones locales`);
    assert.equal(await panel.evaluar(`document.getElementById('enunciado').value`), '', 'sin borrador');
    const aviso = await texto('error-login');
    assert.match(aviso, /NO se pudo confirmar/, 'no se afirma que el servidor cerró la sesión');
    assert.doesNotMatch(aviso, /sesión (fue )?cerrada correctamente/);
    // La sesión del servidor sigue viva (el logout nunca llegó): volver a entrar funciona para repetir.
    await cfg({});
    await panel.ir(`${APP}/docente/`);
    await panel.esperarA(visible('vista-salas')); // la cookie sigue válida: el panel reanuda
    await confirmar();
  }
  // Salida normal: sin aviso de fallo.
  await cfg({});
  await panel.evaluar(`document.getElementById('btn-salir').click()`);
  await panel.esperarA(visible('vista-login'));
  assert.equal(await texto('error-login'), '');
});

test('«Copiar enlace» confirma solo si el portapapeles aceptó; si falla deja el enlace seleccionado', { timeout: 120_000 }, async (t) => {
  const { APP, panel, texto, entrar, crearSala } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await entrar();
  await crearSala('Sala de enlace');
  const enlace = await texto('enlace');
  assert.match(enlace, /\/join\/[A-Z0-9]{6}$/);

  await panel.evaluar(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: (t) => { window.__copiado = t; return Promise.resolve(); } } })`);
  await panel.evaluar(`document.getElementById('btn-copiar').click()`);
  await panel.esperarA(`document.getElementById('aviso-enlace').textContent === 'Enlace copiado.'`);
  assert.equal(await panel.evaluar(`window.__copiado`), enlace);

  await panel.evaluar(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new DOMException('denegado', 'NotAllowedError')) } })`);
  await panel.evaluar(`document.getElementById('btn-copiar').click()`);
  await panel.esperarA(`/No se pudo copiar/.test(document.getElementById('aviso-enlace').textContent)`);
  assert.doesNotMatch(await texto('aviso-enlace'), /Enlace copiado/, 'no se confirma una copia que no ocurrió');
  assert.equal(await panel.evaluar(`getSelection().toString()`), enlace, 'el enlace queda seleccionado para Ctrl+C');

  await panel.evaluar(`Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })`);
  await panel.evaluar(`document.getElementById('btn-copiar').click()`);
  await panel.esperarA(`/No se pudo copiar/.test(document.getElementById('aviso-enlace').textContent)`);
});

test('recepción y moderación de preguntas: si el servidor rechaza o no responde, la casilla vuelve al valor confirmado', { timeout: 120_000 }, async (t) => {
  const { APP, panel, cfg, entrar, crearSala, texto } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await entrar();
  await crearSala('Sala de ajustes');
  await panel.evaluar(`document.getElementById('configuracion').open = true`);
  const valor = (id) => panel.evaluar(`document.getElementById('${id}').checked`);
  const abiertas0 = await valor('q-abiertas'), premod0 = await valor('q-premod');
  for (const modo of ['rechazo', 'timeout']) {
    await cfg({ ev: { 'preguntas:ajustar': modo } });
    for (const id of ['q-abiertas', 'q-premod']) {
      await panel.evaluar(`document.getElementById('${id}').click()`);
      await panel.esperarA(`/no se aplicó/.test(document.getElementById('aviso-sala').textContent)`, { timeout: 15000 });
      assert.equal(await valor(id), id === 'q-abiertas' ? abiertas0 : premod0, `${modo}: ${id} vuelve al valor confirmado`);
      await panel.evaluar(`document.getElementById('aviso-sala').textContent = ''`);
    }
  }
  // Con el servidor respondiendo, el cambio se aplica y se conserva.
  await cfg({});
  await panel.evaluar(`document.getElementById('q-abiertas').click()`);
  await panel.esperarA(`document.getElementById('q-abiertas').checked === ${!abiertas0}`);
  await new Promise((r) => setTimeout(r, 400));
  assert.equal(await valor('q-abiertas'), !abiertas0);
  assert.equal(await texto('aviso-sala'), '');
});

test('sala:seguir sin respuesta (reconexión y recarga) conserva soluciones y borrador; se recupera sola', { timeout: 180_000 }, async (t) => {
  const { APP, panel, visible, texto, cfg, almacen, entrar, crearSala, preparada, escribir } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await entrar();
  const salaId = await crearSala('Sala inestable');
  await preparada('¿Qué pasa si el servidor no responde?');
  const antes = await almacen();
  assert.equal(Object.keys(antes).length, 1);
  await escribir('BORRADOR-QUE-NO-DEBE-PERDERSE');

  // ---------- Reconexión con `sala:seguir` sin respuesta ----------
  await cfg({ ev: { 'sala:seguir': 'timeout' } });
  await panel.evaluar(`(window.__sock.io.engine.close(), 1)`);
  await panel.esperarA(`/Sin respuesta al reanudar/.test(document.getElementById('aviso-sala').textContent)`, { timeout: 20000 });
  assert.deepEqual(await almacen(), antes, 'la solución sigue');
  assert.equal(await panel.evaluar(`document.getElementById('enunciado').value`), 'BORRADOR-QUE-NO-DEBE-PERDERSE', 'el borrador sigue');
  assert.equal(await panel.evaluar(visible('vista-sala')), true, 'la sala sigue a la vista');
  assert.equal(await panel.evaluar(`location.hash`), `#sala=${salaId}`);
  await cfg({});
  await panel.esperarA(`document.getElementById('aviso-sala').textContent === ''`, { timeout: 20000 }); // el reintento tuvo éxito
  assert.deepEqual(await almacen(), antes);
  assert.equal(await panel.evaluar(`document.getElementById('enunciado').value`), 'BORRADOR-QUE-NO-DEBE-PERDERSE');

  // ---------- Recarga con `sala:seguir` sin respuesta: la solución se conserva y se reanuda después ----------
  await cfg({ ev: { 'sala:seguir': 'timeout' } });
  await panel.evaluar(`location.reload()`);
  await panel.esperarA(`${visible('vista-salas')} && /No hubo respuesta/.test(document.getElementById('aviso-salas').textContent)`, { timeout: 30000 });
  assert.deepEqual(await almacen(), antes, 'la recarga con timeout no borra la solución');
  assert.equal(await panel.evaluar(`location.hash`), `#sala=${salaId}`, 'la ruta de la sala se conserva');
  await cfg({});
  await panel.esperarA(`document.getElementById('btn-revelar')`, { timeout: 30000 });
  assert.deepEqual(await almacen(), antes);
  assert.match(await panel.evaluar(`document.getElementById('panel-activa').textContent`), /Explicación preparada/);
  assert.match(await texto('titulo-panel'), /Sala inestable/);
});

test('sala desaparecida: aviso comprensible y limpieza de lo privado', { timeout: 120_000 }, async (t) => {
  const { APP, panel, visible, texto, almacen, entrar, crearSala, preparada } = await montar(t);
  await panel.ir(`${APP}/docente/`);
  await entrar();
  await crearSala('Sala que se pierde');
  await preparada('¿Y si la sala desaparece?');
  assert.equal(Object.keys(await almacen()).length, 1);
  // El enlace de una sala que ya no existe (venció o finalizó mientras la pestaña estaba cerrada).
  await panel.evaluar(`history.replaceState(null, '', '/docente/#sala=SalaQueNoExiste123'); location.reload()`);
  await panel.esperarA(`${visible('vista-salas')} && /ya no está disponible/.test(document.getElementById('aviso-salas').textContent)`, { timeout: 30000 });
  assert.match(await texto('aviso-salas'), /finalizó o venció/);
  assert.equal(await panel.evaluar(`location.hash`), '');
  assert.equal(await almacen(), null, 'la solución de una sala que ya no figura se descarta');
});
