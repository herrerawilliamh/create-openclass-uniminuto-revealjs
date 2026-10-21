# OpenClass master: minimal AI context

## Start here
Read only this file at session start. Before source exploration, run `graphify query "<question>"`, `graphify explain "<node>"`, or `graphify path "<A>" "<B>"` from the master root. Both agents (Claude, Codex) use `graphify-out/graph.json`. Open only files identified by the graph; do not scan the whole repository or read all of GRAPH_REPORT.md at startup. After each functional change: verify, then `graphify update .`.

## Architecture and key files
- Master package: `package.json`, version `1.0.0`; Node >=20.19.0, ES modules. Public repo `herrerawilliamh/create-openclass-uniminuto-revealjs`, npm `create-openclass-uniminuto-revealjs`.
- CLI: `bin/create-openclass-uniminuto-revealjs.mjs`; copies `template/` into a new course, `--assets <dir>` overlays local images on `public/`, `--update-theme` updates a recognized course with backups.
- Template: React 19, Reveal.js 6, Vite 7; independent from Slidev.
- `template/src/main.jsx` entry; `Portal.jsx` course navigation (VER DEMOSTRACIÓN COMPLETA card, not a week).
- `template/src/Presentacion.jsx`: `data-presentation` → Markdown (`general`, `demo`, `laboratorio`, `completa`) or weekly file.
- `template/src/autoPaginar.mjs`: pagination; mode read ONLY from the `.slide:` attribute; `data-oc-paginate="code"` (16 lines, `data-oc-lines` 4–22) or `"auto"`; continuation slides drop the `id`.
- `template/src/plugins/codigo.mjs`: code layout SCROLL mode (default): copy button, focusable `<pre>`, wheel never navigates, keys scroll while `puedeMover()` (1 px probe) allows, otherwise blur so Reveal navigates; `data-prevent-swipe`. Registered before RevealHighlight.
- `template/src/plugins/index.mjs`: single plugin registry; exposes `window.OpenClass.deck` (used by tests).
- `template/src/theme.css`: institutional visual rules and layout classes; `html.reveal-print` rule restores multi-page PDF export.
- `template/galeria/layouts.mjs`: single source of the 13 layout cards (gallery page, Pages landing, tests).
- `template/demo-completa.md`: «TEMÁTICA DE PRUEBA», 24 base slides with ids, all 13 layouts.
- `template/public/actividades/microactividad/`: `datos.js` (edit), `logica.js` (pure, tested with vm), `app.js`, `estilos.css`.
- `template/docs/IA/`: INSTRUCCIONES-OPENCLASS, PLANTILLA-SEMANAL, PROMPT-CREAR-SEMANA.
- `site/` + `scripts/build-site.mjs` → `_site/` (landing + CLI-generated demo course at `/curso/`); `.github/workflows/pages.yml`.
- `scripts/lib/chrome.mjs` (dependency-free CDP client) and `scripts/lib/servidor.mjs` (static server with base).

## Generation routes
- `/` portal; `/general/`; `/guia/` (19 chapters); `/galeria/`; `/demo-completa/`; `/demo-layouts/` (IoT sample); `/laboratorio/`; `/semanas/<course>_semanaN/`.
- Media: `template/public/imagenes/`, `videos/`, `actividades/`, `galeria/` (13 WebP thumbnails, 10–21 KB).

## Thirteen existing layouts
`oc-l-cover`, `oc-l-section`, `oc-l-image-left`, `oc-l-image-right`, `oc-l-top-right`, `oc-l-top-left`, `oc-l-multimedia`, `oc-l-text`, `oc-l-objectives`, `oc-l-two-cols`, `oc-l-two-titles`, `oc-l-code`, `oc-l-closing`. Never invent other layout classes.

## Distribution decision (2026-10-21, confirmed by the user)
Hybrid model: public GitHub/Pages/npm ship a NEUTRAL theme (own design, `scripts/render-neutral-assets.mjs`, sources in `recursos-neutros/`) with the same file names and geometry. Institutional originals (logos, accreditation, 70 años, backgrounds, plane, favicon) and four IoT images of undocumented origin live only in local `recursos-institucionales/` (gitignored, outside npm `files`, ignored by Graphify) and are applied with `--assets`. Backup of the approved RC3 state: `.backups/rc3-pre-final-20261021/`.

## Publication state (2026-10-21)
- GitHub public `main`; Pages via `.github/workflows/pages.yml` at https://herrerawilliamh.github.io/create-openclass-uniminuto-revealjs/ (landing + `/curso/`).
- npm `create-openclass-uniminuto-revealjs@1.0.0`, dist-tag `latest`. npm uses staged publishing: publishing needs the maintainer's 2FA and approval (`npm stage approve` or npmjs.com → Staged Packages). A `0.0.0-stage` placeholder and an accidental `lastest` dist-tag exist.
- Known: `npm audit` low (KaTeX via Mermaid; fix requires Mermaid 12, semver major). Never use `npm audit fix --force`.

## Checks and graph maintenance
- `npm test` (17 tests); `npm run test:navegador` (fresh course, base `/prueba-openclass/`, Chrome); `npm run site:build` then `node --test tests/sitio.test.mjs`.
- Course-level: `npm run test:estructura`, `npm run build:all`.
- Windows: use long paths (realpath) for temp builds; 8.3 names break Vite's HTML proxy.
- After relevant changes: `graphify update .`; then verify the changed behavior and graph.
- ONE MUTATION -> ONE VERIFICATION -> NEXT GATE.

## Institutional and scope constraints
Preserve the approved composition: yellow cover strip, week/year block, accreditation box, blue footer toolbar, center start button, GRACIAS closing, fonts and colors. Never modify Slidev projects or `openclass-prueba-reveal`. Preserve authored Markdown unless replacement is explicitly requested. Never publish `recursos-institucionales/`. Local quiz answers are not sent to Moodle; Seminar/Poll/Questions remain OFF.
