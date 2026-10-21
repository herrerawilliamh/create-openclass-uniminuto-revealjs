import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const config = JSON.parse(readFileSync(resolve('openclass.config.json'), 'utf8'));
const short = String(config.course?.shortName || 'curso').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g,'');
const entries = { portal: resolve('index.html'), general: resolve('general/index.html'), demo: resolve('demo-layouts/index.html'), completa: resolve('demo-completa/index.html'), laboratorio: resolve('laboratorio/index.html'), guia: resolve('guia/index.html'), galeria: resolve('galeria/index.html') };
for (const n of config.generation?.activeWeeks || []) {
  if (!Number.isInteger(Number(n)) || Number(n) < 1 || Number(n) > 8) continue;
  const page = `semanas/${short}_semana${Number(n)}/index.html`;
  if (!existsSync(resolve(page))) throw new Error(`Falta ${page}. Ejecuta npm run config.`);
  entries[`semana${n}`] = resolve(page);
}

export default defineConfig({
  plugins: [react()],
  base: process.env.SITE_BASE || '/',
  build: { rollupOptions: { input: entries } },
  server: { port: 8600, strictPort: true },
});
