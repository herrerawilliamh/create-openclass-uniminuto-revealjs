# Graph Report - create-openclass-uniminuto-revealjs  (2026-10-21)

## Corpus Check
- 51 files · ~31,569 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 6, .css 4, .template 1)

## Summary
- 461 nodes · 577 edges · 32 communities (25 shown, 7 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- generar-desde-config.mjs
- create-openclass-uniminuto-revealjs.mjs
- index.mjs
- template/package.json
- semana.mjs
- Presentacion.jsx
- package.json
- build-site.mjs
- Manual del creador de OpenClass UNIMINUTO Reveal.js
- Guía del docente — Crear OpenClass UNIMINUTO Reveal.js
- TEMÁTICA DE PRUEBA
- publicar.mjs
- Internet de las cosas
- OpenClass master: minimal AI context
- Laboratorio interactivo de OpenClass
- OpenClass — {{TITULO}}
- OpenClass — Presentación general
- AGENTS.md
- CLAUDE.md
- contenido.test.mjs
- Contrato técnico de OpenClass para asistentes de IA
- render-neutral-assets.mjs
- ref_node_fs
- Pagina
- OpenClass UNIMINUTO · Reveal.js
- Plantilla semanal para crear una OpenClass con IA
- dependencies
- app.js
- Microactividad interactiva (5–10 minutos)
- Prompt para crear una semana de OpenClass con IA

## God Nodes (most connected - your core abstractions)
1. `TEMÁTICA DE PRUEBA` - 24 edges
2. `Contrato técnico de OpenClass para asistentes de IA` - 16 edges
3. `Internet de las cosas` - 14 edges
4. `Guía del docente — Crear OpenClass UNIMINUTO Reveal.js` - 14 edges
5. `scripts` - 13 edges
6. `Pagina` - 11 edges
7. `cargarPlugins()` - 11 edges
8. `Manual del creador de OpenClass UNIMINUTO Reveal.js` - 10 edges
9. `abrirNavegador()` - 9 edges
10. `OpenClass UNIMINUTO · Reveal.js` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs
- `Presentacion()` --indirect_call--> `auditarOverflow()`  [INFERRED]
  template/src/Presentacion.jsx → template/src/autoPaginar.mjs
- `Presentacion()` --calls--> `cargarPlugins()`  [EXTRACTED]
  template/src/Presentacion.jsx → template/src/plugins/index.mjs
- `cargarPlugins()` --indirect_call--> `OpenClassCodigo()`  [INFERRED]
  template/src/plugins/index.mjs → template/src/plugins/codigo.mjs
- `cargarPlugins()` --indirect_call--> `OpenClassMermaid()`  [INFERRED]
  template/src/plugins/index.mjs → template/src/plugins/mermaid.mjs

## Import Cycles
- None detected.

## Communities (32 total, 7 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.15
Nodes (9): active, args, config, configPath, dryRun, overwriteWeeks, short, template (+1 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "index.mjs"
Cohesion: 0.12
Nodes (14): chart.js, reveal.js, OpenClassCodigo(), TECLAS, cargarFase2(), FASE2, cargarCss(), cargarPlugins() (+6 more)

### Community 3 - "template/package.json"
Cohesion: 0.06
Nodes (30): @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, vite, @vitejs/plugin-react, devDependencies, vite, @vitejs/plugin-react (+22 more)

### Community 4 - "semana.mjs"
Cohesion: 0.12
Nodes (17): activity, args, byNumber, config, date, duration, fail(), forceContent (+9 more)

### Community 5 - "Presentacion.jsx"
Cohesion: 0.12
Nodes (18): react, react-dom, @revealjs/react, auditarOverflow(), coste(), paginarMarkdown(), paginasCodigo(), paginasTexto() (+10 more)

### Community 6 - "package.json"
Cohesion: 0.08
Nodes (25): author, bin, create-openclass-uniminuto-revealjs, bugs, url, description, engines, node (+17 more)

### Community 7 - "build-site.mjs"
Cohesion: 0.17
Nodes (11): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+3 more)

### Community 8 - "Manual del creador de OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.18
Nodes (10): Despliegue y funciones online, Distribución, Manual del creador de OpenClass UNIMINUTO Reveal.js, Objetivo, Opciones de CLI, Pruebas, Publicación, Regenerar recursos públicos (+2 more)

### Community 9 - "Guía del docente — Crear OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.09
Nodes (21): 10. Actualizar el curso, 11. Problemas frecuentes, 12. Futuras funciones en vivo, 1. Flujo de trabajo, 2. Crear una semana, 3. Estructura de una diapositiva, 4. Los 13 layouts, 5. Imágenes y vídeo (+13 more)

### Community 10 - "TEMÁTICA DE PRUEBA"
Cohesion: 0.08
Nodes (24): Actividad mediante iframe, Actividad práctica, Código desplazable (scroll), Código fuente, Código paginado, Diagrama Mermaid, Dos columnas, Dos títulos (+16 more)

### Community 12 - "Internet de las cosas"
Cohesion: 0.13
Nodes (14): Arquitectura básica de IoT, Conceptos clave y aplicaciones, Código: semáforo ambiental con ESP32, De un dato físico a una decisión digital, Demostración de contenido extenso, Generalidades de IoT, Internet de las cosas, IoT como ecosistema conectado (+6 more)

### Community 13 - "OpenClass master: minimal AI context"
Cohesion: 0.20
Nodes (9): Architecture and key files, Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass master: minimal AI context, Start here, Thirteen existing layouts (+1 more)

### Community 14 - "Laboratorio interactivo de OpenClass"
Cohesion: 0.22
Nodes (8): Actividad 1 — Sensores y actuadores, Actividad 2 — Preguntas de IoT, Diagrama con Mermaid, Fórmulas con KaTeX, ¡Gracias!, Gráfico con Chart.js, Laboratorio interactivo de OpenClass, Simuladores y páginas web

### Community 15 - "OpenClass — {{TITULO}}"
Cohesion: 0.22
Nodes (8): Actividad práctica, Cierre y próximos pasos, ¡Gracias!, Ideas principales, OpenClass — {{TITULO}}, Pregunta de repaso, Resultados de aprendizaje, {{TEMA}}

### Community 16 - "OpenClass — Presentación general"
Cohesion: 0.33
Nodes (5): Bienvenidos al curso, ¡Gracias!, OpenClass — Presentación general, Organización de la OpenClass, ¿Qué aprenderemos?

### Community 19 - "contenido.test.mjs"
Cohesion: 0.17
Nodes (15): comparar(), copiar(), crear(), dato(), ejemplo(), lista(), tarjeta(), vista() (+7 more)

### Community 20 - "Contrato técnico de OpenClass para asistentes de IA"
Cohesion: 0.12
Nodes (16): 10. Chart, 11. Fórmulas, 12. Actividades, 13. Paginación de texto, 14. Restricciones institucionales, 15. Validación (si tienes acceso al proyecto), 1. Arquitectura real, 2. Sintaxis Markdown de una diapositiva (+8 more)

### Community 21 - "render-neutral-assets.mjs"
Cohesion: 0.14
Nodes (4): add(), raiz, RECURSOS, svg()

### Community 22 - "ref_node_fs"
Cohesion: 0.06
Nodes (29): capturas, miniaturas, raiz, abrirNavegador(), CANDIDATOS, Conexion, esperar(), rutaChrome() (+21 more)

### Community 24 - "OpenClass UNIMINUTO · Reveal.js"
Cohesion: 0.22
Nodes (8): Comandos, Desarrollo del generador, Instalación y primer curso, Licencia y créditos, Limitaciones conocidas, OpenClass UNIMINUTO · Reveal.js, Qué incluye cada curso, Requisitos

### Community 25 - "Plantilla semanal para crear una OpenClass con IA"
Cohesion: 0.25
Nodes (7): Contenido, Datos generales, Interacción y evaluación, Material académico disponible, Observaciones pedagógicas, Plantilla semanal para crear una OpenClass con IA, Referencias

### Community 26 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react, react-dom, reveal.js (+1 more)

### Community 29 - "app.js"
Cohesion: 0.53
Nodes (4): comprobar(), dibujar(), estado(), progreso()

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

## Knowledge Gaps
- **1 isolated node(s):** `mermaid`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 312 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `paginarMarkdown()` connect `Presentacion.jsx` to `contenido.test.mjs`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `mermaid` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `index.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12318840579710146 - nodes in this community are weakly interconnected._
- **Should `template/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.06451612903225806 - nodes in this community are weakly interconnected._
- **Should `semana.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._
- **Should `Presentacion.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1164021164021164 - nodes in this community are weakly interconnected._