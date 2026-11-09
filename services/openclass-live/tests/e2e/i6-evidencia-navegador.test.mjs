/**
 * I6 — Evidencia de navegador: capturas reales del recorrido docente, accesibilidad medible e hipótesis H01–H08.
 *
 * No cambia código funcional. Usa una aplicación local, datos sintéticos y Chrome real (Node >= 22).
 *  - OPENCLASS_CAPTURAS=<dir>  : escribe las capturas del recorrido (solo estados realmente alcanzados).
 *  - OPENCLASS_I6_EVIDENCIA=<dir> : escribe evidencia-i6.json con las mediciones.
 * Las aserciones cubren únicamente invariantes comprobadas; las mediciones que pueden revelar hallazgos
 * se registran en el JSON y se interpretan en docs/VNEXT-I6-HIPOTESIS.md y docs/VNEXT-I6-ACCESIBILIDAD.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { io } from 'socket.io-client';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { crearApp } from '../../src/app.mjs';
import { hashPassword } from '../../src/auth.mjs';
import { leerConfig } from '../../src/config.mjs';

const PASSWORD = 'clave-sintetica-i6'; // dato de prueba local; nunca aparece en capturas
const CAPTURAS = process.env.OPENCLASS_CAPTURAS || '';
const EVIDENCIA = process.env.OPENCLASS_I6_EVIDENCIA || '';
if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
if (EVIDENCIA) mkdirSync(EVIDENCIA, { recursive: true });

const relojReal = Date.now.bind(Date);
let desfase = 0;
Date.now = () => relojReal() + desfase;

const datos = { capturas: [], contraste: {}, reflujo: {}, teclado: {}, regiones: {}, hipotesis: {} };
const guardarEvidencia = () => EVIDENCIA && writeFileSync(path.join(EVIDENCIA, 'evidencia-i6.json'), JSON.stringify(datos, null, 2));

/** Medidor de contraste dentro de la página (texto 1.4.3 y componentes 1.4.11). Solo colores sólidos o con alfa. */
const MEDIR_CONTRASTE = `(() => {
  const num = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const sobre = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const k = [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const razon = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const fondoDe = (el) => { const cadena = []; for (let e = el; e; e = e.parentElement) cadena.push(e);
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (const e of cadena.reverse()) { const c = num(getComputedStyle(e).backgroundColor); if (c && c.a > 0) base = sobre(c, base); }
    return base; };
  const visible = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0 && Number(s.opacity) > 0; };
  const texto = []; let min = 99;
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || el.closest('.solo-lector')) continue;
    const propio = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!propio) continue;
    const s = getComputedStyle(el); const fg = num(s.color); if (!fg) continue;
    const bg = fondoDe(el); const fgc = sobre(fg, bg); const r = razon(fgc, bg);
    const px = parseFloat(s.fontSize); const grande = px >= 24 || (px >= 18.66 && Number(s.fontWeight) >= 700);
    const umbral = grande ? 3 : 4.5; min = Math.min(min, r / umbral * 4.5);
    if (r < umbral) texto.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''), razon: +r.toFixed(2), umbral, texto: el.textContent.trim().slice(0, 40) });
  }
  const comp = [];
  for (const el of document.querySelectorAll('input:not([type=hidden]), textarea, select')) {
    if (!visible(el)) continue; const s = getComputedStyle(el);
    const borde = num(s.borderTopColor); const ancho = parseFloat(s.borderTopWidth);
    const fondoPadre = fondoDe(el.parentElement); const propio = sobre(num(s.backgroundColor) ?? { r: 0, g: 0, b: 0, a: 0 }, fondoPadre);
    if (!borde || !ancho) { comp.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '[' + (el.type || '') + ']', sinBorde: true }); continue; }
    comp.push({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '[' + (el.type || '') + ']', bordeVsFondoPadre: +razon(sobre(borde, fondoPadre), fondoPadre).toFixed(2), bordeVsCampo: +razon(sobre(borde, propio), propio).toFixed(2) });
  }
  const botones = [];
  for (const el of document.querySelectorAll('button')) {
    if (!visible(el)) continue; const s = getComputedStyle(el); const bg = fondoDe(el); const padre = fondoDe(el.parentElement);
    const borde = num(s.borderTopColor); const ancho = parseFloat(s.borderTopWidth);
    botones.push({ el: 'button' + (el.id ? '#' + el.id : ''), texto: el.textContent.trim().slice(0, 28), fondoVsPadre: +razon(bg, padre).toFixed(2), bordeVsPadre: borde && ancho ? +razon(sobre(borde, padre), padre).toFixed(2) : null });
  }
  return { fallosTexto: texto, componentes: comp, botones };
})()`;

/** Desbordamiento horizontal y objetivos táctiles/cursor (2.5.8: mínimo 24 CSS px). */
const MEDIR_REFLUJO = `(() => {
  const de = document.documentElement; const vw = de.clientWidth;
  const fuera = [];
  for (const el of document.body.querySelectorAll('*')) {
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden' || el.closest('.solo-lector')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (r.right > vw + 1 || r.left < -1) fuera.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' ' + Math.round(r.left) + '→' + Math.round(r.right));
  }
  const chicos = [];
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, summary')) {
    const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect(); if (!r.width) continue;
    if (r.width < 24 || r.height < 24) chicos.push((el.id || el.tagName.toLowerCase()) + ' ' + Math.round(r.width) + '×' + Math.round(r.height));
  }
  return { anchoVentana: vw, scrollWidth: de.scrollWidth, desborde: de.scrollWidth > vw + 1, elementosFuera: fuera.slice(0, 8), objetivosMenoresA24: chicos.slice(0, 8), cintaPegajosa: (() => { const c = document.querySelector('.cinta'); if (!c) return null; const r = c.getBoundingClientRect(); return { alto: Math.round(r.height), proporcionViewport: +(r.height / innerHeight).toFixed(2), position: getComputedStyle(c).position }; })() };
})()`;

const abrirSala = (pg, cod) => pg.evaluar(`[...document.querySelectorAll('#lista-salas li')].find((li) => li.textContent.includes('${cod}')).querySelector('button').click()`);

async function montar(t, extra = {}) {
  const env = { SESSION_SECRET: 'i6x'.repeat(20), ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), TEACHER_SESSION_HOURS: '1', TRUST_PROXY: 'false', ...extra };
  const sondeo = crearApp(leerConfig({ ...env, APP_URL: 'http://127.0.0.1:1' }), { log: () => {}, ahora: relojReal });
  const { port } = await sondeo.escuchar(0, '127.0.0.1');
  await sondeo.cerrar();
  const APP = `http://127.0.0.1:${port}`;
  const app = crearApp(leerConfig({ ...env, APP_URL: APP }), { log: () => {}, ahora: relojReal });
  await app.escuchar(port, '127.0.0.1');
  t.after(() => app.cerrar());
  const navegador = await abrirNavegador({ ancho: 1280, alto: 900 });
  t.after(() => navegador.cerrar());
  const abiertos = [];
  t.after(() => abiertos.forEach((s) => s.disconnect()));
  const visible = (id) => `!document.getElementById('${id}').classList.contains('oculto')`;
  const p = {
    APP, navegador, visible,
    async panelNuevo(ancho = 1280, alto = 900) {
      const panel = await navegador.pagina({ ancho, alto });
      await panel.evaluar(`window.confirm = () => true; window.alert = () => {};`).catch(() => {});
      return panel;
    },
    async entrar(panel) {
      await panel.ir(`${APP}/docente/`);
      await panel.esperarA(visible('vista-login'));
      await panel.evaluar(`document.getElementById('password').value = ${JSON.stringify(PASSWORD)}; document.getElementById('form-login').requestSubmit();`);
      await panel.esperarA(visible('vista-salas'));
      await panel.evaluar(`window.confirm = () => true; window.alert = () => {};`);
    },
    async estudianteSocket(codigo) {
      const s = io(`${APP}/participante`, { forceNew: true, reconnection: false, transports: ['websocket'], extraHeaders: { origin: APP }, auth: { codigo, alias: '', token: null } });
      abiertos.push(s);
      const sesion = await new Promise((ok, mal) => { s.once('sesion', ok); s.once('connect_error', mal); });
      s.sesionInicial = sesion;
      return s;
    },
  };
  return p;
}

test('recorrido docente con capturas reales y mediciones de accesibilidad', { timeout: 300_000 }, async (t) => {
  const m = await montar(t);
  const panel = await m.panelNuevo(1280, 900);
  const guardar = async (pagina, nombre, descripcion) => {
    if (!CAPTURAS) return;
    await pagina.send('Page.bringToFront'); // una pestaña en segundo plano no rasteriza
    writeFileSync(path.join(CAPTURAS, `${nombre}.png`), await pagina.captura());
    datos.capturas.push({ archivo: `${nombre}.png`, descripcion });
  };
  const medir = async (pagina, estado) => { datos.contraste[estado] = await pagina.evaluar(MEDIR_CONTRASTE); };
  const esperarTexto = (er) => panel.esperarA(`/${er}/.test(document.getElementById('panel-activa').textContent)`);

  // 1. Inicio de sesión (sin credenciales escritas)
  await panel.ir(`${m.APP}/docente/`);
  await panel.esperarA(m.visible('vista-login'));
  await guardar(panel, 'vnext-01-inicio-sesion', 'Inicio de sesión');
  await medir(panel, 'login');
  // Error de formulario (contraseña errónea): rol alert y foco
  await panel.evaluar(`document.getElementById('password').value = 'incorrecta-sintetica'; document.getElementById('form-login').requestSubmit();`);
  await panel.esperarA(`!document.getElementById('error-login').classList.contains('oculto')`);
  datos.hipotesis.errorLogin = await panel.evaluar(`({ texto: document.getElementById('error-login').textContent, rol: document.getElementById('error-login').getAttribute('role'), foco: document.activeElement.id, describedby: document.getElementById('password').getAttribute('aria-describedby') })`);
  await panel.evaluar(`document.getElementById('password').value = ''`);
  await m.entrar(panel);

  // 2. Lista de salas (vacía, luego con una sala)
  await panel.evaluar(`document.getElementById('titulo-sala').value = 'Plataformas de desarrollo · Semana 3 (datos sintéticos)'; document.getElementById('form-sala').requestSubmit();`);
  await panel.esperarA(`${m.visible('vista-sala')} && document.getElementById('codigo-sala').textContent.length === 6`);
  const codigo = await panel.evaluar(`document.getElementById('codigo-sala').textContent`);

  // Sala creada y QR
  await panel.viewport(1280, 1300);
  await panel.evaluar(`window.scrollTo(0, 0)`);
  await guardar(panel, 'vnext-03-sala-creada-qr', 'Sala creada con código, enlace y QR');
  await medir(panel, 'sala-sin-votacion');

  // Estudiantes sintéticos
  const alumnos = [];
  for (let i = 0; i < 4; i++) alumnos.push(await m.estudianteSocket(codigo));
  await panel.esperarA(`document.getElementById('m-conectados').textContent === '4'`);

  // Lista de salas con la sala abierta (volver)
  await panel.evaluar(`document.getElementById('btn-volver').click()`);
  await panel.esperarA(m.visible('vista-salas') + ` && document.querySelectorAll('#lista-salas li').length >= 1`);
  await panel.viewport(1280, 800);
  await guardar(panel, 'vnext-02-lista-salas', 'Lista de salas abiertas');
  await medir(panel, 'lista-salas');
  datos.hipotesis.salirAListaConservaSala = await panel.evaluar(`document.querySelectorAll('#lista-salas li').length`);
  // Volver a entrar a la sala desde la lista
  await abrirSala(panel, codigo);
  await panel.esperarA(m.visible('vista-sala'));
  await panel.viewport(1280, 1300);

  // 3. Pregunta improvisada (la clase sin curso Reveal.js preparado) con solución local
  await panel.evaluar(`(() => { document.getElementById('composer').open = true;
    document.getElementById('enunciado').value = '¿Qué método une un socket a una sala en Socket.IO?';
    const filas = document.getElementById('opciones').children;
    filas[0].querySelector('input[type=text]').value = 'socket.enter()'; filas[1].querySelector('input[type=text]').value = 'socket.join()';
    filas[1].querySelector('input[type=checkbox]').checked = true;
    document.getElementById('explicacion').value = 'socket.join agrega el socket a una room.'; })()`);
  await panel.evaluar(`document.getElementById('form-encuesta').requestSubmit()`);
  await panel.esperarA(`document.getElementById('btn-cerrar')`);

  // H01: regiones vivas. Observa mutaciones en las regiones vivas del panel mientras llegan votos.
  await panel.evaluar(`(() => { window.__muta = { total: 0, porRegion: {} };
    const regiones = [...document.querySelectorAll('[aria-live], [role=status], [role=alert]')];
    window.__regiones = regiones.map((r) => (r.id || r.className || r.tagName) + ':' + (r.getAttribute('aria-live') || r.getAttribute('role')));
    for (const r of regiones) new MutationObserver((l) => { const k = r.id || r.className || r.tagName; window.__muta.total += l.length; window.__muta.porRegion[k] = (window.__muta.porRegion[k] || 0) + l.length; })
      .observe(r, { childList: true, characterData: true, subtree: true }); })()`);
  await panel.evaluar(`window.__muta.total = 0; window.__muta.porRegion = {}`);

  // 4. Votación abierta
  await guardar(panel, 'vnext-04-votacion-abierta', 'Votación abierta (sin votos)');
  await medir(panel, 'votacion-abierta');
  assert.ok(await panel.evaluar(`!!document.getElementById('btn-cerrar')`), 'votación abierta en el panel');
  // Un estudiante que entra con la votación abierta recibe la encuesta en su sesión inicial
  const lector = await m.estudianteSocket(codigo);
  const idEnc = lector.sesionInicial?.estado?.encuesta?.id;
  assert.ok(idEnc, 'los estudiantes reciben la encuesta abierta');
  lector.disconnect();
  const responder = (s, seleccion) => new Promise((ok) => s.timeout(5000).emit('encuesta:responder', { encuestaId: idEnc, ronda: 1, seleccion }, (e, r) => ok(r ?? e)));
  const antesVotos = await panel.evaluar(`window.__muta.total`);
  const acuses = [await responder(alumnos[0], [1]), await responder(alumnos[1], [1]), await responder(alumnos[2], [0])];
  assert.ok(acuses.every((a) => a?.ok !== false && a?.respuesta), `votos aceptados: ${JSON.stringify(acuses)}`);
  await panel.esperarA(`/(^|[^0-9])3 *respuestas de/.test(document.getElementById('panel-activa').textContent)`);
  datos.regiones.panel = {
    regiones: await panel.evaluar(`window.__regiones`),
    mutacionesTrasTresVotos: (await panel.evaluar(`window.__muta`)).total - antesVotos,
    porRegion: (await panel.evaluar(`window.__muta`)).porRegion,
    liveEnPanelActiva: await panel.evaluar(`document.getElementById('panel-activa').getAttribute('aria-live')`),
  };
  await panel.viewport(1280, 1300);
  await guardar(panel, 'vnext-05-votacion-con-tendencias', 'Votación abierta con tendencias privadas');
  await medir(panel, 'votacion-con-votos');

  // Vista real del estudiante en un teléfono (390 px): votación abierta y respuesta registrada
  const estP = await m.navegador.pagina({ ancho: 390, alto: 844 });
  await estP.ir(`${m.APP}/join/${codigo}`);
  await estP.esperarA(`document.querySelectorAll('#panel-encuesta input').length >= 2`);
  await guardar(estP, 'vnext-s1-estudiante-votacion-abierta', 'Estudiante: votación abierta');
  await medir(estP, 'estudiante-votacion-abierta');
  datos.reflujoEstudiante = {};
  for (const [nombre, w, h] of [['320 (zoom 400 %)', 320, 256], ['640 (zoom 200 %)', 640, 512], ['390', 390, 844], ['768', 768, 1024], ['1440', 1440, 900]]) {
    await estP.viewport(w, h); await new Promise((r) => setTimeout(r, 250));
    datos.reflujoEstudiante[nombre] = await estP.evaluar(MEDIR_REFLUJO);
  }
  await estP.viewport(390, 844);
  await estP.evaluar(`document.querySelectorAll('#panel-encuesta input')[1].click()`);
  await estP.evaluar(`document.getElementById('btn-enviar').click()`);
  await estP.esperarA(`/registr/i.test(document.getElementById('panel-encuesta').textContent)`);
  await guardar(estP, 'vnext-s2-estudiante-respuesta-registrada', 'Estudiante: respuesta registrada');

  // Reflujo y zoom sobre este estado (200 % = 640 px, 400 % = 320 px) y anchos de referencia
  for (const [nombre, w, h] of [['320 (zoom 400 %)', 320, 256], ['390', 390, 844], ['640 (zoom 200 %)', 640, 512], ['768', 768, 1024], ['1024', 1024, 768], ['1440', 1440, 900]]) {
    await panel.viewport(w, h);
    await new Promise((r) => setTimeout(r, 250));
    datos.reflujo[nombre] = await panel.evaluar(MEDIR_REFLUJO);
  }
  await panel.viewport(1280, 1300);

  // Teclado: recorrido con Tab real, foco visible y trampa
  await panel.evaluar(`document.activeElement.blur(); window.scrollTo(0,0)`);
  const recorrido = []; let inicio = null; let trampa = true;
  for (let i = 0; i < 70; i++) {
    await panel.tecla('Tab', { code: 'Tab', keyCode: 9 });
    const f = await panel.evaluar(`(() => { const e = document.activeElement; if (!e || e === document.body) return { id: 'body' };
      const s = getComputedStyle(e); const r = e.getBoundingClientRect();
      return { id: e.id || (e.tagName.toLowerCase() + ':' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 24)),
        contorno: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, sombra: s.boxShadow !== 'none', visibleEnVentana: r.bottom > 0 && r.top < innerHeight }; })()`);
    recorrido.push(f);
    if (inicio === null) inicio = f.id; else if (f.id === inicio || f.id === 'body') { trampa = false; break; }
  }
  datos.teclado = {
    pasos: recorrido.length, volvioAlInicio: !trampa, primeros: recorrido.slice(0, 6).map((f) => f.id),
    sinIndicadorDeFoco: recorrido.filter((f) => f.id !== 'body' && !f.contorno && !f.sombra).map((f) => f.id),
    elementos: recorrido.map((f) => f.id),
  };
  await panel.evaluar(`document.activeElement.blur(); window.scrollTo(0,0)`);

  // Orden de lectura: orden del DOM de las secciones principales frente a su posición visual (columnas)
  datos.ordenLectura = await panel.evaluar(`[...document.querySelectorAll('main section[id], main aside section[id], main details[id]')].map((e) => e.id + '@' + Math.round(e.getBoundingClientRect().left) + ',' + Math.round(e.getBoundingClientRect().top))`);

  // 5. Votación cerrada
  await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
  await panel.esperarA(`document.getElementById('btn-publicar')`);
  await guardar(panel, 'vnext-06-votacion-cerrada', 'Votación cerrada, resultados aún solo para el docente');
  await medir(panel, 'votacion-cerrada');

  // 6. Resultados publicados (sin revelar la solución)
  await panel.evaluar(`document.getElementById('btn-publicar').click()`);
  await panel.esperarA(`document.getElementById('btn-ronda2')`);
  const visibleSolucion = await panel.evaluar(`/correcta|Correcta|✔/.test(document.getElementById('panel-activa').textContent) && !!document.getElementById('btn-revelar')`);
  await guardar(panel, 'vnext-07-resultados-publicados', 'Resultados publicados en teléfonos; la solución sigue privada');
  await medir(panel, 'resultados-publicados');
  datos.hipotesis.resultadosSinSolucionTrasPublicar = { botonRevelarDisponible: visibleSolucion };

  // 7. Segunda ronda
  await panel.evaluar(`document.getElementById('btn-ronda2').click()`);
  await panel.esperarA(`document.getElementById('btn-cerrar')`);
  await guardar(panel, 'vnext-08-segunda-ronda', 'Segunda ronda abierta');
  const responder2 = (s, seleccion) => new Promise((ok) => s.timeout(5000).emit('encuesta:responder', { encuestaId: idEnc, ronda: 2, seleccion }, (e, r) => ok(r ?? e)));
  await responder2(alumnos[0], [1]); await responder2(alumnos[1], [1]); await responder2(alumnos[2], [1]); await responder2(alumnos[3], [0]);
  await panel.evaluar(`document.getElementById('btn-cerrar').click()`);
  await panel.esperarA(`document.getElementById('btn-publicar')`);
  await panel.evaluar(`document.getElementById('btn-publicar').click()`);
  await panel.esperarA(`document.getElementById('btn-revelar')`);

  // 8. Solución revelada
  await panel.evaluar(`document.getElementById('btn-revelar').click()`);
  await panel.esperarA(`document.getElementById('btn-retirar') && !document.getElementById('btn-revelar')`);
  await estP.esperarA(`/agrega el socket a una room/.test(document.getElementById('panel-encuesta').textContent)`);
  await guardar(estP, 'vnext-s3-estudiante-solucion-revelada', 'Estudiante: solución y explicación reveladas');
  await guardar(panel, 'vnext-09-solucion-revelada', 'Solución y explicación reveladas con comparación de rondas');
  await medir(panel, 'solucion-revelada');

  // H07: retiro accidental — ¿hay confirmación o reapertura?
  datos.hipotesis.retiro = { botonesAntes: await panel.evaluar(`[...document.querySelectorAll('#panel-activa button')].map((b) => b.textContent.trim())`) };
  let confirmaciones = 0;
  await panel.evaluar(`window.__conf = 0; window.confirm = () => { window.__conf++; return true; }`);
  await panel.evaluar(`document.getElementById('btn-retirar').click()`);
  await panel.esperarA(`/Sin votación en curso/.test(document.getElementById('titulo-activa').textContent)`);
  confirmaciones = await panel.evaluar(`window.__conf`);
  await panel.evaluar(`document.getElementById('bloque-historial').open = true`);
  datos.hipotesis.retiro.confirmaciones = confirmaciones;
  datos.hipotesis.retiro.botonesDespues = await panel.evaluar(`[...document.querySelectorAll('#panel-activa button, #historial button')].map((b) => b.textContent.trim())`);
  datos.hipotesis.retiro.historial = await panel.evaluar(`document.getElementById('historial').textContent.trim().slice(0, 120)`);

  // 9. Preguntas moderadas (con revisión previa activada)
  await panel.evaluar(`document.getElementById('configuracion').open = true`);
  await panel.evaluar(`(() => { const a = document.getElementById('q-abiertas'); const b = document.getElementById('q-premod'); if (!a.checked) a.click(); if (!b.checked) b.click(); })()`);
  await new Promise((r) => setTimeout(r, 700));
  const secreto = 'Pregunta pendiente sintética sobre salas y namespaces';
  const recibidos = []; alumnos[2].on('estado', (e) => recibidos.push(JSON.stringify(e)));
  const vistoPorOtro = () => recibidos.some((x) => x.includes('namespaces'));
  await new Promise((ok) => alumnos[1].timeout(5000).emit('pregunta:enviar', { texto: secreto }, (e, r) => ok(r ?? e)));
  await panel.esperarA(`document.querySelectorAll('#lista-preguntas li').length >= 1`);
  await new Promise((r) => setTimeout(r, 800));
  // H03: privacidad de pendientes
  datos.hipotesis.preguntaPendiente = await panel.evaluar(`(() => { const t = document.querySelector('#lista-preguntas .texto-plano'); const s = getComputedStyle(t);
    return { velada: t.classList.contains('velo'), textoEnDom: t.textContent.length > 0, filtro: s.filter, color: s.color, ariaHidden: t.getAttribute('aria-hidden'), botonLeer: !!document.querySelector('#lista-preguntas [data-slot=leer]') }; })()`);
  datos.hipotesis.preguntaPendiente.visibleParaOtroEstudiante = vistoPorOtro();
  await panel.viewport(1280, 1300);
  await panel.evaluar(`document.getElementById('preguntas').scrollIntoView()`);
  await guardar(panel, 'vnext-10-pregunta-pendiente-velada', 'Pregunta pendiente velada (antes de moderar)');
  await medir(panel, 'pregunta-pendiente');
  await panel.evaluar(`document.querySelector('#lista-preguntas [data-slot=leer]')?.click()`);
  await panel.evaluar(`document.querySelector('#lista-preguntas [data-slot=aprobar]')?.click()`);
  await panel.esperarA(`!document.querySelector('#lista-preguntas [data-slot=aprobar]')`);
  await estP.evaluar(`document.getElementById('tab-preguntas').click()`);
  await estP.esperarA(`document.querySelectorAll('#panel-preguntas li').length >= 1`);
  await guardar(estP, 'vnext-s4-estudiante-preguntas', 'Estudiante: pestaña Preguntas con la pregunta aprobada');
  await panel.evaluar(`document.getElementById('preguntas').scrollIntoView()`);
  await guardar(panel, 'vnext-11-pregunta-moderada', 'Pregunta leída y aprobada por la persona docente');

  // Segunda pestaña: H02 — cierre de sesión y vencimiento entre pestañas
  const b = await m.panelNuevo(1280, 900);
  await b.ir(`${m.APP}/docente/`);
  await b.esperarA(m.visible('vista-salas'));
  await b.evaluar(`window.confirm = () => true; window.alert = () => {};`);
  await abrirSala(b, codigo);
  await b.esperarA(m.visible('vista-sala'));
  // A cierra sesión
  await panel.evaluar(`document.getElementById('btn-salir').click()`);
  await panel.esperarA(m.visible('vista-login'));
  datos.hipotesis.logoutEntrePestanas = { estadoInmediatoB: await b.evaluar(`document.getElementById('vista-login').classList.contains('oculto') ? 'sigue_autenticada_en_pantalla' : 'login'`) };
  // Estudiante cambia el estado; ¿B (con su socket ya abierto) lo sigue recibiendo?
  const antes = await b.evaluar(`document.getElementById('m-conectados')?.textContent`);
  const extra = await m.estudianteSocket(codigo);
  await new Promise((r) => setTimeout(r, 1000));
  const despues = await b.evaluar(`document.getElementById('m-conectados')?.textContent`);
  datos.hipotesis.logoutEntrePestanas.metricaAntes = antes; datos.hipotesis.logoutEntrePestanas.metricaDespues = despues;
  datos.hipotesis.logoutEntrePestanas.sigueRecibiendoEstado = antes !== despues;
  // B intenta una acción privilegiada
  await b.evaluar(`document.getElementById('btn-cerrar')?.click(); document.getElementById('premoderacion') && 0`);
  await b.evaluar(`(document.getElementById('q-abiertas') || {}).click?.()`);
  await new Promise((r) => setTimeout(r, 1200));
  datos.hipotesis.logoutEntrePestanas.vistaB_trasAccion = await b.evaluar(`['vista-login','vista-salas','vista-sala'].find((id) => !document.getElementById(id).classList.contains('oculto'))`);
  extra.disconnect();

  // Vencimiento de sesión sin acción de usuario (reloj de autenticación desplazado)
  await m.entrar(panel);
  await panel.evaluar(`document.getElementById('titulo-sala').value = 'Sala vencimiento'; document.getElementById('form-sala').requestSubmit();`);
  await panel.esperarA(`${m.visible('vista-sala')} && /Sala vencimiento/.test(document.getElementById('titulo-panel').textContent)`);
  const codigo2 = await panel.evaluar(`document.getElementById('codigo-sala').textContent`);
  await panel.esperarA(`document.getElementById('m-conectados').textContent === '0'`);
  desfase += 61 * 60_000; // la sesión docente (1 h) vence; la sala (3 h) sigue
  const antes2 = await panel.evaluar(`document.getElementById('m-conectados').textContent`);
  const alumnoTardio = await m.estudianteSocket(codigo2);
  await new Promise((r) => setTimeout(r, 1200));
  const despues2 = await panel.evaluar(`document.getElementById('m-conectados').textContent`);
  datos.hipotesis.sesionVencidaInactiva = { metricaAntes: antes2, metricaDespues: despues2, sigueRecibiendoEstado: antes2 !== despues2,
    vistaVisible: await panel.evaluar(`['vista-login','vista-salas','vista-sala'].find((id) => !document.getElementById(id).classList.contains('oculto'))`) };
  alumnoTardio.disconnect();

  // H08: retención de oclive:* en el navegador del estudiante tras finalizar/vencer la sala
  const est = await m.navegador.pagina({ ancho: 390, alto: 844 });
  await est.ir(`${m.APP}/join/${codigo2}`);
  await est.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto')`);
  datos.hipotesis.tokenLocal = { clavesAntes: await est.evaluar(`Object.keys(localStorage)`) };
  // Finalizar con una sesión docente nueva (la anterior venció: fue lo que verificamos arriba)
  // el reloj de autenticación NO se retrocede (los limitadores usan Date.now): se abre una sesión nueva
  await panel.ir(`${m.APP}/docente/`);
  await panel.esperarA(`${m.visible('vista-login')} || ${m.visible('vista-salas')}`);
  if (await panel.evaluar(m.visible('vista-login'))) await m.entrar(panel);
  await panel.evaluar(`window.confirm = () => true; window.alert = () => {};`);
  await abrirSala(panel, codigo2);
  await panel.esperarA(m.visible('vista-sala'));
  await panel.viewport(1280, 1300);
  await panel.evaluar(`document.getElementById('cierre').scrollIntoView()`);
  await guardar(panel, 'vnext-12-terminar-la-clase', 'Sección «Terminar la clase» antes de finalizar');
  await panel.evaluar(`document.getElementById('btn-finalizar').click()`);
  await panel.esperarA(m.visible('vista-salas'));
  await guardar(panel, 'vnext-13-sesion-finalizada', 'Panel tras finalizar la sala');
  await new Promise((r) => setTimeout(r, 1500));
  datos.hipotesis.tokenLocal.clavesTrasFinalizar = await est.evaluar(`Object.keys(localStorage)`);
  datos.hipotesis.tokenLocal.contenidoTrasFinalizar = await est.evaluar(`Object.fromEntries(Object.keys(localStorage).map((k) => [k, Object.keys(JSON.parse(localStorage.getItem(k) || '{}'))]))`);
  datos.hipotesis.tokenLocal.vistaEstudiante = await est.evaluar(`document.getElementById('vista-fin') && !document.getElementById('vista-fin').classList.contains('oculto') ? 'La sesión terminó' : 'otra'`);
  await guardar(est, 'vnext-14-estudiante-sesion-terminada', 'Vista del estudiante cuando la sala finaliza');

  await est.ir('about:blank'); // evita reintentos de unión contra la sala eliminada
  // H08 (caso estudiante desconectado): la página se cierra antes de que la sala termine.
  await panel.evaluar(`document.getElementById('titulo-sala').value = 'Sala sin conexión del estudiante'; document.getElementById('form-sala').requestSubmit();`);
  await panel.esperarA(`${m.visible('vista-sala')} && /Sala sin conexión/.test(document.getElementById('titulo-panel').textContent)`);
  const codigo3 = await panel.evaluar(`document.getElementById('codigo-sala').textContent`);
  const est3 = await m.navegador.pagina({ ancho: 390, alto: 844 });
  await est3.ir(`${m.APP}/join/${codigo3}`);
  await est3.esperarA(`!document.getElementById('vista-sala').classList.contains('oculto') || !document.getElementById('error-union').classList.contains('oculto')`);
  assert.ok(await est3.evaluar(`!document.getElementById('vista-sala').classList.contains('oculto')`), 'estudiante entra: ' + await est3.evaluar(`document.getElementById('error-union').textContent`));
  const claveEsperada = `oclive:${codigo3}`;
  assert.ok(await est3.evaluar(`localStorage.getItem(${JSON.stringify(claveEsperada)}) !== null`), 'token guardado al unirse');
  await est3.ir(`${m.APP}/`); // el estudiante se va a la pantalla de unión (sin socket): sin socket en esa sala
  await panel.evaluar(`document.getElementById('btn-finalizar').click()`);
  await panel.esperarA(m.visible('vista-salas'));
  await new Promise((r) => setTimeout(r, 800));
  datos.hipotesis.tokenLocal.estudianteDesconectado = {
    claveConservada: await est3.evaluar(`localStorage.getItem(${JSON.stringify(claveEsperada)}) !== null`),
    contenido: await est3.evaluar(`Object.keys(JSON.parse(localStorage.getItem(${JSON.stringify(claveEsperada)}) || '{}'))`),
  };
  await est3.ir(`${m.APP}/join/${codigo3}`);
  await new Promise((r) => setTimeout(r, 1500));
  datos.hipotesis.tokenLocal.estudianteDesconectado.claveTrasVolverASalaFinalizada = await est3.evaluar(`localStorage.getItem(${JSON.stringify(claveEsperada)}) !== null`);

  // Salud de la consola
  datos.erroresConsolaPanel = panel.errores.filter((e) => !/favicon|401 \(Unauthorized\).*\/api\/docente\/login/i.test(e));
  guardarEvidencia();
  assert.deepEqual(datos.erroresConsolaPanel, [], 'sin errores de consola en el panel');
});

test.after(() => guardarEvidencia());
