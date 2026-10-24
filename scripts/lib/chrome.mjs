/**
 * Cliente mínimo de Chrome DevTools Protocol (sin dependencias): Chrome/Edge headless para
 * rasterizar recursos, capturar la galería y ejecutar pruebas de navegador reales.
 * Requiere Node >= 22 (WebSocket global).
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CANDIDATOS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export function rutaChrome() {
  const ruta = CANDIDATOS.find((c) => existsSync(c));
  if (!ruta) throw new Error('No se encontró Chrome/Edge. Define CHROME_PATH.');
  return ruta;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Ninguna orden CDP puede quedar pendiente para siempre: un Chrome colgado o cerrado se convierte en error.
const LIMITE_CDP = Number(process.env.OPENCLASS_CDP_TIMEOUT) || 60000;

class Conexion {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pendientes = new Map(); this.oyentes = new Set();
    ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (msg.id && this.pendientes.has(msg.id)) {
        const { resolve, reject } = this.pendientes.get(msg.id);
        this.pendientes.delete(msg.id);
        msg.error ? reject(new Error(`${msg.error.message} ${msg.error.data || ''}`)) : resolve(msg.result);
      } else for (const fn of this.oyentes) fn(msg);
    });
    ws.addEventListener('close', () => {
      for (const { reject, method } of this.pendientes.values()) reject(new Error(`CDP: conexión cerrada durante ${method}`));
      this.pendientes.clear();
    });
  }
  send(method, params = {}, sessionId, { timeout = LIMITE_CDP } = {}) {
    if (this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error(`CDP: conexión cerrada antes de ${method}`));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const reloj = setTimeout(() => {
        this.pendientes.delete(id);
        reject(new Error(`CDP: ${method} sin respuesta en ${timeout} ms`));
      }, timeout);
      const fin = (fn) => (v) => { clearTimeout(reloj); fn(v); };
      this.pendientes.set(id, { resolve: fin(resolve), reject: fin(reject), method });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });
  }
}

export class Pagina {
  constructor(cdp, sessionId) {
    this.cdp = cdp; this.sessionId = sessionId; this.consola = []; this.errores = [];
    cdp.oyentes.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.consoleAPICalled') {
        this.consola.push({ tipo: msg.params.type, texto: msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
      } else if (msg.method === 'Runtime.exceptionThrown') {
        this.errores.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
        this.errores.push(`${msg.params.entry.text} ${msg.params.entry.url || ''}`.trim());
      }
    });
  }
  send(method, params) { return this.cdp.send(method, params, this.sessionId); }
  async viewport(width, height, deviceScaleFactor = 1) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor, mobile: false });
  }
  async ir(url, { espera = 'load', timeout = 30000 } = {}) {
    await this.send('Page.navigate', { url });
    const limite = Date.now() + timeout;
    while (Date.now() < limite) {
      const estado = await this.evaluar('document.readyState').catch(() => '');
      if (estado === 'complete' || (espera === 'dom' && estado === 'interactive')) return;
      await esperar(100);
    }
    throw new Error(`Tiempo agotado cargando ${url}`);
  }
  async evaluar(expresion) {
    const r = await this.send('Runtime.evaluate', { expression: expresion, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  }
  async esperarA(expresion, { timeout = 20000, intervalo = 150 } = {}) {
    const limite = Date.now() + timeout;
    while (Date.now() < limite) {
      // Los objetos (nodos, instancias) no se serializan: basta con saber que existen.
      const v = await this.evaluar(`(() => { const v = (${expresion}); return v && typeof v === 'object' ? true : v; })()`).catch(() => false);
      if (v) return v;
      await esperar(intervalo);
    }
    throw new Error(`Condición no cumplida: ${expresion}`);
  }
  async captura({ formato = 'png', calidad, clip } = {}) {
    const r = await this.send('Page.captureScreenshot', {
      format: formato, ...(calidad && { quality: calidad }), ...(clip && { clip: { ...clip, scale: clip.scale ?? 1 } }),
      captureBeyondViewport: false,
    });
    return Buffer.from(r.data, 'base64');
  }
  async tecla(key, { code = key, keyCode, texto } = {}) {
    const base = { key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
    await this.send('Input.dispatchKeyEvent', { type: texto ? 'keyDown' : 'rawKeyDown', ...base, ...(texto && { text: texto }) });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
  async rueda(x, y, deltaY, deltaX = 0) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX, deltaY });
  }
  async clic(x, y) {
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    }
  }
}

export async function abrirNavegador({ ancho = 1920, alto = 1080 } = {}) {
  const perfil = mkdtempSync(path.join(os.tmpdir(), 'oc-chrome-'));
  const proc = spawn(rutaChrome(), [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars',
    '--disable-extensions', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
    `--window-size=${ancho},${alto}`, 'about:blank',
  ], { stdio: 'ignore' });
  const salida = new Promise((r) => proc.once('exit', r));
  let ws, cdp, cerrado = false;
  // Cierre idempotente y acotado: Browser.close, después kill si el proceso sigue vivo; el perfil se borra al final.
  async function cerrar() {
    if (cerrado) return;
    cerrado = true;
    if (ws?.readyState === WebSocket.OPEN) {
      try { await (cdp ?? new Conexion(ws)).send('Browser.close', {}, undefined, { timeout: 5000 }); } catch { /* ya cerrado */ }
      ws.close();
    }
    const vivo = proc.exitCode === null && proc.signalCode === null;
    if (vivo && await Promise.race([salida.then(() => false), esperar(3000).then(() => true)])) {
      proc.kill();
      await Promise.race([salida, esperar(3000)]);
    }
    await esperar(300);
    try { rmSync(perfil, { recursive: true, force: true }); } catch { /* bloqueo temporal en Windows */ }
  }
  try {
    const archivo = path.join(perfil, 'DevToolsActivePort');
    let puerto;
    for (let i = 0; i < 300 && !puerto; i++) {
      if (proc.exitCode !== null) throw new Error(`Chrome terminó al iniciar (código ${proc.exitCode})`);
      puerto = existsSync(archivo) && readFileSync(archivo, 'utf8').split('\n')[0].trim();
      if (!puerto) await esperar(50);
    }
    if (!puerto) throw new Error('Chrome no publicó DevToolsActivePort en 15 s');
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${puerto}/json/version`, { signal: AbortSignal.timeout(10000) })).json();
    ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const reloj = setTimeout(() => reject(new Error('CDP: WebSocket sin abrir en 10 s')), 10000);
      ws.onopen = () => { clearTimeout(reloj); resolve(); };
      ws.onerror = (e) => { clearTimeout(reloj); reject(e.error || new Error('CDP: error del WebSocket')); };
    });
    cdp = new Conexion(ws);
  } catch (e) { await cerrar(); throw e; }
  return {
    pid: proc.pid,
    async pagina({ ancho: w = ancho, alto: h = alto, escala = 1 } = {}) {
      const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
      const p = new Pagina(cdp, sessionId);
      p.targetId = targetId;
      await p.send('Page.enable'); await p.send('Runtime.enable'); await p.send('Log.enable');
      await p.viewport(w, h, escala);
      return p;
    },
    cerrar,
  };
}
