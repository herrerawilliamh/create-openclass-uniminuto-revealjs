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
  const servidor = createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
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
      return createReadStream(archivo, { start: inicio, end: fin }).pipe(res);
    }
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
    createReadStream(archivo).pipe(res);
  });
  return new Promise((resolve) => servidor.listen(puerto, '127.0.0.1', () => {
    const { port } = servidor.address();
    resolve({ url: `http://127.0.0.1:${port}${prefijo}`, solicitudes, cerrar: () => new Promise((r) => servidor.close(r)) });
  }));
}
