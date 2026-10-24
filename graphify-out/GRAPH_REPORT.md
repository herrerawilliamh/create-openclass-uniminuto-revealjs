# Graph Report - create-openclass-uniminuto-revealjs  (2026-10-24)

## Corpus Check
- 62 files · ~53,043 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 7, .css 4, .template 1)

## Summary
- 779 nodes · 1015 edges · 43 communities (36 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `44f16678`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generar-desde-config.mjs
- create-openclass-uniminuto-revealjs.mjs
- Presentacion.jsx
- template/package.json
- semana.mjs
- portada-pedagogica.test.mjs
- package.json
- build-site.mjs
- Manual del creador de OpenClass UNIMINUTO Reveal.js
- Guía del docente — Crear OpenClass UNIMINUTO Reveal.js
- TEMÁTICA DE PRUEBA
- publicar.mjs
- Internet de las cosas
- pages.yml
- Laboratorio interactivo de OpenClass
- {{CURSO}}
- OpenClass — Presentación general
- AGENTS.md
- CLAUDE.md
- deploy.yml
- Contrato técnico de OpenClass para asistentes de IA
- render-neutral-assets.mjs
- portada-dom.test.mjs
- ref_node_url
- [1.1.0] — sin publicar
- Plantilla semanal para crear una OpenClass con IA
- publicacion-seguridad.test.mjs
- test-navegador.mjs
- semana.test.mjs
- app.js
- Pagina
- Microactividad interactiva (5–10 minutos)
- Prompt para crear una semana de OpenClass con IA
- vite.config.mjs
- navegador.test.mjs
- index.mjs
- portal-academico.test.mjs
- publicar
- steps
- ref_node_fs
- chrome.mjs

## God Nodes (most connected - your core abstractions)
1. `TEMÁTICA DE PRUEBA` - 24 edges
2. `scripts` - 16 edges
3. `Contrato técnico de OpenClass para asistentes de IA` - 16 edges
4. `Guía del docente — Crear OpenClass UNIMINUTO Reveal.js` - 15 edges
5. `Internet de las cosas` - 14 edges
6. `scripts` - 13 edges
7. `abrirNavegador()` - 12 edges
8. `Pagina` - 11 edges
9. `cargarPlugins()` - 11 edges
10. `with` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs
- `Architecture and key files` --references--> `cerrar()`  [INFERRED]
  docs/AI-CONTEXT.md → scripts/lib/chrome.mjs
- `Architecture and key files` --references--> `activas()`  [INFERRED]
  docs/AI-CONTEXT.md → template/vite.config.mjs
- `Architecture and key files` --references--> `configPublica()`  [INFERRED]
  docs/AI-CONTEXT.md → template/vite.config.mjs
- `portada()` --calls--> `servir()`  [EXTRACTED]
  tests/portada-dom.test.mjs → scripts/lib/servidor.mjs

## Import Cycles
- None detected.

## Communities (43 total, 7 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "Presentacion.jsx"
Cohesion: 0.11
Nodes (20): react, auditarOverflow(), coste(), paginarMarkdown(), paginasCodigo(), paginasTexto(), separarDiapositivas(), sinId() (+12 more)

### Community 3 - "template/package.json"
Cohesion: 0.06
Nodes (40): chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react-dom, reveal.js, @revealjs/react, vite (+32 more)

### Community 4 - "semana.mjs"
Cohesion: 0.12
Nodes (17): activity, args, byNumber, config, date, duration, fail(), forceContent (+9 more)

### Community 5 - "portada-pedagogica.test.mjs"
Cohesion: 0.05
Nodes (40): ACCESO, actividadDigital(), alternativa(), bin, CANALES, COLA, conEnlaces(), configurar() (+32 more)

### Community 6 - "package.json"
Cohesion: 0.05
Nodes (37): author, bin, create-openclass-uniminuto-revealjs, bugs, url, description, engines, node (+29 more)

### Community 7 - "build-site.mjs"
Cohesion: 0.09
Nodes (26): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+18 more)

### Community 8 - "Manual del creador de OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.18
Nodes (10): Despliegue y funciones online, Distribución, Integración continua y publicación, Manual del creador de OpenClass UNIMINUTO Reveal.js, Objetivo, Opciones de CLI, Pruebas, Regenerar recursos públicos (+2 more)

### Community 9 - "Guía del docente — Crear OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.08
Nodes (22): 10. Actualizar el curso, 11. Problemas frecuentes, 12. Futuras funciones en vivo, 1. Flujo de trabajo, 2. Crear una semana, 2b. Diseñar la semana, 3. Estructura de una diapositiva, 4. Los 13 layouts (+14 more)

### Community 10 - "TEMÁTICA DE PRUEBA"
Cohesion: 0.08
Nodes (24): Actividad mediante iframe, Actividad práctica, Código desplazable (scroll), Código fuente, Código paginado, Diagrama Mermaid, Dos columnas, Dos títulos (+16 more)

### Community 12 - "Internet de las cosas"
Cohesion: 0.13
Nodes (14): Arquitectura básica de IoT, Conceptos clave y aplicaciones, Código: semáforo ambiental con ESP32, De un dato físico a una decisión digital, Demostración de contenido extenso, Generalidades de IoT, Internet de las cosas, IoT como ecosistema conectado (+6 more)

### Community 13 - "pages.yml"
Cohesion: 0.06
Nodes (35): env, needs, runs-on, steps, concurrency, cancel-in-progress, group, environment (+27 more)

### Community 14 - "Laboratorio interactivo de OpenClass"
Cohesion: 0.22
Nodes (8): Actividad 1 — Sensores y actuadores, Actividad 2 — Preguntas de IoT, Diagrama con Mermaid, Fórmulas con KaTeX, ¡Gracias!, Gráfico con Chart.js, Laboratorio interactivo de OpenClass, Simuladores y páginas web

### Community 15 - "{{CURSO}}"
Cohesion: 0.20
Nodes (9): Activación, Actividad práctica, Cierre y próximos pasos, {{CURSO}}, ¡Gracias!, Ideas principales, Pregunta de repaso, Resultados de aprendizaje (+1 more)

### Community 16 - "OpenClass — Presentación general"
Cohesion: 0.33
Nodes (5): Bienvenidos al curso, ¡Gracias!, OpenClass — Presentación general, Organización de la OpenClass, ¿Qué aprenderemos?

### Community 19 - "deploy.yml"
Cohesion: 0.06
Nodes (32): env, runs-on, steps, concurrency, cancel-in-progress, group, environment, needs (+24 more)

### Community 20 - "Contrato técnico de OpenClass para asistentes de IA"
Cohesion: 0.10
Nodes (19): 10. Chart, 11. Fórmulas, 12. Actividades, 13. Paginación de texto, 14. Restricciones institucionales, 15. Validación (si tienes acceso al proyecto), 1. Arquitectura real, 2. Sintaxis Markdown de una diapositiva (+11 more)

### Community 21 - "render-neutral-assets.mjs"
Cohesion: 0.14
Nodes (4): add(), raiz, RECURSOS, svg()

### Community 22 - "portada-dom.test.mjs"
Cohesion: 0.15
Nodes (18): CASOS, CORTA, dentro(), fase(), fmt(), LARGA, LIENZO, MEDIR() (+10 more)

### Community 23 - "ref_node_url"
Cohesion: 0.22
Nodes (6): capturas, miniaturas, raiz, enviar(), servir(), TIPOS

### Community 24 - "[1.1.0] — sin publicar"
Cohesion: 0.09
Nodes (21): [1.0.0] — 2026-10-21, [1.1.0] — sin publicar, Actualizar un curso existente, Cambios, Conocido, Desarrollo del generador, Generación semanal segura, Guía del docente (+13 more)

### Community 25 - "Plantilla semanal para crear una OpenClass con IA"
Cohesion: 0.25
Nodes (7): Contenido, Datos generales, Interacción y evaluación, Material académico disponible, Observaciones pedagógicas, Plantilla semanal para crear una OpenClass con IA, Referencias

### Community 26 - "publicacion-seguridad.test.mjs"
Cohesion: 0.15
Nodes (8): evidencia(), artefactos, bin, id, listar(), M, root, SOLUCIONARIOS

### Community 27 - "test-navegador.mjs"
Cohesion: 0.25
Nodes (4): args, dist, r, raiz

### Community 28 - "semana.test.mjs"
Cohesion: 0.22
Nodes (6): leer(), bin, curso(), readCfg(), root, tmp()

### Community 29 - "app.js"
Cohesion: 0.53
Nodes (4): comprobar(), dibujar(), estado(), progreso()

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "vite.config.mjs"
Cohesion: 0.11
Nodes (16): Architecture and key files, Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass master: minimal AI context, Publication state (2026-10-21), Start here (+8 more)

### Community 36 - "navegador.test.mjs"
Cohesion: 0.33
Nodes (4): CLASES, esperar(), IDS, irA()

### Community 37 - "index.mjs"
Cohesion: 0.13
Nodes (13): OpenClassCodigo(), puedeMover(), TECLAS, cargarFase2(), FASE2, cargarCss(), cargarPlugins(), cargarScript() (+5 more)

### Community 38 - "portal-academico.test.mjs"
Cohesion: 0.16
Nodes (11): archivos(), config(), construir(), manifiesto, npm(), ok(), root, RUTAS (+3 more)

### Community 39 - "publicar"
Cohesion: 0.05
Nodes (37): concurrency, cancel-in-progress, group, description, required, type, VERSION, confirmar (+29 more)

### Community 40 - "steps"
Cohesion: 0.05
Nodes (44): CHROME_PATH, CONTENIDO, ESPERADO, OPENCLASS_EVIDENCIA, PAGES_BASE, SALIDA, jobs, ligeras (+36 more)

### Community 41 - "ref_node_fs"
Cohesion: 0.13
Nodes (10): checks, config, required, short, bin, root, capitulo(), root (+2 more)

### Community 42 - "chrome.mjs"
Cohesion: 0.22
Nodes (10): abrirNavegador(), cerrar(), CANDIDATOS, Conexion, esperar(), rutaChrome(), destino, fijarDuracion() (+2 more)

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `paginarMarkdown()` connect `Presentacion.jsx` to `build-site.mjs`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `@vitejs/plugin-react` connect `template/package.json` to `vite.config.mjs`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Why does `vite` connect `template/package.json` to `vite.config.mjs`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Presentacion.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10752688172043011 - nodes in this community are weakly interconnected._
- **Should `template/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05975609756097561 - nodes in this community are weakly interconnected._