# OpenClass master: minimal AI context

## Start here
Read only this file at session start. Before source exploration, run `graphify query "<question>"`, `graphify explain "<node>"`, or `graphify path "<A>" "<B>"` from the master root. Both agents (Claude, Codex) use `graphify-out/graph.json`. Open only files identified by the graph; do not scan the whole repository or read all of GRAPH_REPORT.md at startup. After each functional change: verify, then `graphify update .`.

## Architecture and key files
- Master package: `package.json`, version `1.1.0` (release candidate, not yet published; see `CHANGELOG.md`); Node >=20.19.0, ES modules. Public repo `herrerawilliamh/create-openclass-uniminuto-revealjs`, npm `create-openclass-uniminuto-revealjs`.
- CLI: `bin/create-openclass-uniminuto-revealjs.mjs`; copies `template/` into a new course, `--assets <dir>` overlays local images on `public/`, `--update-theme` updates a recognized course with backups.
- Template: React 19, Reveal.js 6, Vite 7; independent from Slidev.
- `template/src/main.jsx` entry; `Portal.jsx` student-first portal (P3): course identity → «Comenzar aquí» (general, how to use, route) → `#ruta` published weeks (`ol.week-grid`, activeWeeks only, ascending, continuity line) → `#recorridos` three complementary paths (not official modalities) → `#recursos` secondary block (VER DEMOSTRACIÓN COMPLETA, galería, demo-layouts, laboratorio, guía). Skip link to `#ruta`.
- `template/src/Presentacion.jsx`: `data-presentation` → Markdown (`general`, `demo`, `laboratorio`, `completa`) or weekly file.
- `template/src/autoPaginar.mjs`: pagination; mode read ONLY from the `.slide:` attribute; `data-oc-paginate="code"` (16 lines, `data-oc-lines` 4–22) or `"auto"`; continuation slides drop the `id`.
- `template/src/plugins/codigo.mjs`: code layout SCROLL mode (default): copy button, focusable `<pre>`, wheel never navigates, keys scroll while `puedeMover()` (1 px probe) allows, otherwise blur so Reveal navigates; `data-prevent-swipe`. Registered before RevealHighlight.
- `template/src/plugins/index.mjs`: single plugin registry; exposes `window.OpenClass.deck` (used by tests).
- `template/vite.config.mjs`: `activas()` dedupes and sorts activeWeeks (duplicates broke `virtual:openclass-semanas`); `configPublica()` whitelist unchanged.
- `template/src/theme.css`: institutional visual rules and layout classes; `html.reveal-print` rule restores multi-page PDF export.
- `template/galeria/layouts.mjs`: single source of the 13 layout cards (gallery page, Pages landing, tests).
- `template/demo-completa.md`: «TEMÁTICA DE PRUEBA», 24 base slides with ids, all 13 layouts.
- `template/public/actividades/microactividad/`: `datos.js` (edit), `logica.js` (pure, tested with vm), `app.js`, `estilos.css`.
- Weekly decks: `scrollActivationWidth: null` (Reveal's automatic scroll view ≤ 435 px was clipped by `#app` and broke chalkboard); phones get the scaled 1280×720 slide view. Cover H1 font auto-fit minimum 26 px.
- `template/docs/IA/`: INSTRUCCIONES-OPENCLASS (technical contract: generated first sequence, source research, videos, public Notes vs private solutions), PLANTILLA-SEMANAL, PROMPT-CREAR-SEMANA (master pedagogical prompt: three learning paths, guiding case, progressive discovery, 4th slide «Ruta de la semana» authored, not generated). `--force-content` replaces the whole week N file: only before elaborating content.
- `site/` + `scripts/build-site.mjs` → `_site/` (landing + CLI-generated demo course at `/curso/`).
- Workflows: `ci.yml` (PR/manual/`workflow_call`; light suites on Node 20.19/22/24 + mandatory Chrome job), `pages.yml` (push `main`: calls `ci.yml`, then builds and deploys), `release.yml` (manual only, from tag `vX.Y.Z` on `main`, calls `ci.yml`, environment `npm-publish`, OIDC Trusted Publishing, installs/checks npm >=11.15.0 and Node >=22.14.0, `npm stage publish` → owner approves with 2FA). Pending owner setup (2026-10-24): GitHub environment `npm-publish` does not exist yet; npm Trusted Publisher not verified; `ci.yml` has never run on GitHub.
- `scripts/lib/chrome.mjs` (dependency-free CDP client; every CDP call has a timeout, `cerrar()` is idempotent and bounded) and `scripts/lib/servidor.mjs` (static server with base; `cerrar()` destroys open sockets, returns `{ forzadas }`, 400 on malformed URI). `test:dom` wraps each phase with a bounded timeout naming the blocked phase; `OPENCLASS_TRAZA=1` for live trace.

## Generation routes
- `/` portal; `/general/`; `/guia/` (20 chapters; `#pedagogia` «Diseñar la semana»: route of the week, weeks[].opening, Zoom/Teams, three paths, sources, 0–3 videos of 5–10 min, Notes public script, private solutions); `/galeria/`; `/demo-completa/`; `/demo-layouts/` (IoT sample); `/laboratorio/`; `/semanas/<course>_semanaN/`.
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
- Baseline `npm test` (28 tests); P2 `npm run test:p2` (28); P3 docs `npm run test:docente` (4, distributed docs + npm pack); security `npm run test:seguridad` (12); `npm run test:ligeras` = those four. Chrome (Node >= 22): `npm run test:dom` (8, all cases in one run, real text rects, evidence in `OPENCLASS_EVIDENCIA`), `npm run test:portal` (7, temp course, evidence + SHA-256 in `OPENCLASS_EVIDENCIA`), `npm run test:navegador` (11, fresh course, base `/prueba-openclass/`); `npm run test:chrome` = those three. `npm run site:build` then `npm run test:sitio`. `npm run test:release` = everything (release gate, same as CI).
- Course-level: `npm run test:estructura`, `npm run build:all`.
- Windows: use long paths (realpath) for temp builds; 8.3 names break Vite's HTML proxy.
- After relevant changes: `graphify update .`; then verify the changed behavior and graph.
- ONE MUTATION -> ONE VERIFICATION -> NEXT GATE.

## OpenClass Live (in development, not in the npm package)
- `services/openclass-live/`: Node 22 + Socket.IO 4.8.4 participation service (polls with two Freeman rounds, moderated questions). `src/salas.mjs` in-memory source of truth (no network deps, reusable by a future Zoom App); `validar.mjs` strict schemas; `auth.mjs` scrypt + HMAC tokens; `sockets.mjs` namespaces `/participante` and `/docente` (panel cookie or room-scoped presenter key); `public/` student and teacher UIs (CSP self, textContent only). Protocol: `docs/PROTOCOLO.md`; teacher guide with real screenshots: `docs/GUIA-DOCENTE.md`.
- Tests: `npm test` (23: unit + 40-client integration, auth, origins, limits, privacy of logs) and `npm run test:navegador` (Chrome: CLI temp course with LIVE on, panel + local deck + 2 mobile students, captures deck WebSocket frames). `npm run verificar -- <APP_URL>` HTTP/WSS checks after deploy.
- Deploy: `Dockerfile` (node:22.23.1-alpine pinned by digest), `docker-compose.yml` (network `web` external, Traefik labels, no host ports, read-only, non-root), `npm run empaquetar` → tarball for `/home/openclass-live/`. VPS deployment needs explicit authorization; secrets generated on the VPS.
- Template adapter: `template/src/plugins/live.mjs` + `live.css`, loaded only when `LIVE.activa` in `fase2.mjs` (default false). Slides mark polls with `.oc-live-encuesta`. No request to the service until the teacher connects. Legacy Seminar/Poll/Questions stay OFF (Seminar requires students to load the whole deck); Questions global is `RevealQnA`.

## Institutional and scope constraints
Preserve the approved composition: yellow cover strip, week/year block, accreditation box, blue footer toolbar, center start button, GRACIAS closing, fonts and colors. Never modify Slidev projects or `openclass-prueba-reveal`. Preserve authored Markdown unless replacement is explicitly requested. Never publish `recursos-institucionales/`. Local quiz answers are not sent to Moodle; Seminar/Poll/Questions and OpenClass Live remain OFF by default.
