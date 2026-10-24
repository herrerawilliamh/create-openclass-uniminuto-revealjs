/**
 * Servidor estático mínimo que imita GitHub Pages: sirve `raiz` bajo el prefijo `base`
 * (p. ej. /create-openclass-uniminuto-revealjs/), resuelve carpetas a index.html y responde 404.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.webm': 'video/webm', '.mp4': 'video/mp4',
  '.vtt': 'text/vtt; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

export function servir(raiz, { base = '/', puerto = 0 } = {}) {
  const prefijo = base.endsWith('/') ? base : `${base}/`;
  const solicitudes = [];
  // Chrome mantiene conexiones keep-alive y flujos de vídeo por rangos: server.close() solo espera, no los corta.
  const sockets = new Set(), enCurso = new Set();
  const servidor = createServer((req, res) => {
    enCurso.add(res);
    res.once('close', () => enCurso.delete(res));
    let url;
    // Un URI mal formado (p. ej. %BASE_URL% sin resolver) respondía con una excepción que tumbaba el proceso.
    try { url = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end('400'); }
    solicitudes.push(url);
    if (!url.startsWith(prefijo) && `${url}/` !== prefijo) { res.writeHead(404); return res.end('404'); }
    let archivo = path.join(raiz, url.slice(prefijo.length));
    if (!archivo.startsWith(path.resolve(raiz))) { res.writeHead(403); return res.end(); }
    if (existsSync(archivo) && statSync(archivo).isDirectory()) {
      if (!url.endsWith('/')) { res.writeHead(301, { Location: `${url}/` }); return res.end(); }
      archivo = path.join(archivo, 'index.html');
    }
    if (!existsSync(archivo)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('404'); }
    const { size } = statSync(archivo);
    const tipo = TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream';
    const rango = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
    if (rango) {
      const inicio = Number(rango[1] || 0), fin = rango[2] ? Number(rango[2]) : size - 1;
      res.writeHead(206, { 'Content-Type': tipo, 'Content-Range': `bytes ${inicio}-${fin}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': fin - inicio + 1 });
      return enviar(createReadStream(archivo, { start: inicio, end: fin }), res);
    }
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    enviar(createReadStream(archivo), res);
  });
  servidor.on('connection', (s) => { sockets.add(s); s.once('close', () => sockets.delete(s)); });
  /**
   * Cierra el servidor y corta todas las conexiones abiertas; nunca espera más de `limite` ms.
   * Resuelve con `forzadas`: conexiones con respuesta en curso que close() por sí solo habría esperado.
   */
  const cerrar = ({ limite = 5000 } = {}) => new Promise((resolve, reject) => {
    const reloj = setTimeout(() => reject(new Error(`servidor: cierre bloqueado ${limite} ms con ${sockets.size} conexiones`)), limite);
    // Respuestas sin terminar: close() por sí solo esperaría a que el cliente las consumiera o abandonara.
    const forzadas = enCurso.size;
    servidor.close(() => { clearTimeout(reloj); resolve({ forzadas }); });
    servidor.closeAllConnections?.();
    for (const s of sockets) s.destroy();
  });
  return new Promise((resolve, reject) => {
    servidor.once('error', reject);
    servidor.listen(puerto, '127.0.0.1', () => {
      const { port } = servidor.address();
      resolve({ url: `http://127.0.0.1:${port}${prefijo}`, solicitudes, cerrar });
    });
  });
}

// Un error de lectura o un cliente que corta el flujo destruye la respuesta en lugar de dejarla abierta.
function enviar(flujo, res) {
  flujo.on('error', () => res.destroy());
  res.on('close', () => flujo.destroy());
  flujo.pipe(res);
}
