import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CONFIG = resolve('openclass.config.json');
const leerConfig = () => JSON.parse(readFileSync(CONFIG, 'utf8'));
const corto = (config) => String(config.course?.shortName || 'curso').normalize('NFD')
  .replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g,'');
// Sin repetidos y en orden ascendente, como Portal.jsx y generar-desde-config.mjs: [3, 3] importaría dos veces s3.
const activas = (config) => [...new Set((config.generation?.activeWeeks || []).map(Number))]
  .filter((n) => Number.isInteger(n) && n >= 1 && n <= 8).sort((a, b) => a - b);

const config = leerConfig();
const short = corto(config);
const entries = { portal: resolve('index.html'), general: resolve('general/index.html'), demo: resolve('demo-layouts/index.html'), completa: resolve('demo-completa/index.html'), laboratorio: resolve('laboratorio/index.html'), guia: resolve('guia/index.html'), galeria: resolve('galeria/index.html') };
for (const n of activas(config)) {
  const page = `semanas/${short}_semana${n}/index.html`;
  if (!existsSync(resolve(page))) throw new Error(`Falta ${page}. Ejecuta npm run config.`);
  entries[`semana${n}`] = resolve(page);
}

// Proyección pública de openclass.config.json: lista explícita de los campos que lee Portal.jsx
// y solo las semanas activas. Cualquier otra clave (raíz, extra, weeks[] inactivas) no sale de aquí.
const texto = (v) => (typeof v === 'string' || typeof v === 'number') ? String(v) : undefined;
function configPublica(cfg) {
  const c = cfg.course || {}, n = activas(cfg);
  return {
    course: { shortName: texto(c.shortName), fullName: texto(c.fullName), description: texto(c.description), year: texto(c.year) },
    generation: { activeWeeks: n },
    weeks: (Array.isArray(cfg.weeks) ? cfg.weeks : []).filter((w) => n.includes(Number(w?.number)))
      .map((w) => ({ number: Number(w.number), title: texto(w.title), centralTheme: texto(w.centralTheme) })),
  };
}

// virtual:openclass-semanas → { número: Markdown } solo de generation.activeWeeks.
// El Markdown de semanas inactivas nunca se importa, así que no entra al bundle.
// virtual:openclass-config → configPublica(); el JSON original nunca se importa en el cliente.
const SEMANAS = 'virtual:openclass-semanas', CONFIG_PUBLICA = 'virtual:openclass-config';
const MODULOS = {
  [SEMANAS]() {
    const cfg = leerConfig(), s = corto(cfg);
    const md = activas(cfg).map((n) => [n, `/semanas/${s}_semana${n}.md`])
      .filter(([, f]) => existsSync(resolve(f.slice(1))));
    return md.map(([n, f]) => `import s${n} from ${JSON.stringify(f + '?raw')};`).join('\n')
      + `\nexport default { ${md.map(([n]) => `${n}: s${n}`).join(', ')} };\n`;
  },
  [CONFIG_PUBLICA]: () => `export default ${JSON.stringify(configPublica(leerConfig()))};\n`,
};
function contenidoPublico() {
  return {
    name: 'openclass-contenido-publico',
    resolveId: (id) => id in MODULOS ? '\0' + id : null,
    load: (id) => id.startsWith('\0') && id.slice(1) in MODULOS ? MODULOS[id.slice(1)]() : null,
    // En desarrollo, cambiar openclass.config.json o crear/borrar un Markdown recalcula los módulos sin reiniciar.
    configureServer(server) {
      server.watcher.on('all', (evento, archivo) => {
        const f = resolve(archivo);
        if (f !== CONFIG && !(evento !== 'change' && /[\\/]semanas[\\/][^\\/]+\.md$/.test(f))) return;
        const mods = Object.keys(MODULOS).map((id) => server.moduleGraph.getModuleById('\0' + id)).filter(Boolean);
        mods.forEach((m) => server.moduleGraph.invalidateModule(m));
        if (mods.length) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), contenidoPublico()],
  base: process.env.SITE_BASE || '/',
  build: { rollupOptions: { input: entries } },
  server: { port: 8600, strictPort: true },
});
