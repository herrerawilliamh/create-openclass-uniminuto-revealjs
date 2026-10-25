# Graph Report - create-openclass-uniminuto-revealjs  (2026-10-25)

## Corpus Check
- 85 files · ~77,971 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 19 file(s) not represented in the graph (top: (none) 10, .css 6, .example 1)

## Summary
- 1092 nodes · 1611 edges · 60 communities (54 shown, 6 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6c7b819`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generar-desde-config.mjs
- create-openclass-uniminuto-revealjs.mjs
- ayuda.mjs
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
- sockets.mjs
- [1.1.0] — sin publicar
- Plantilla semanal para crear una OpenClass con IA
- publicacion-seguridad.test.mjs
- Presentacion.jsx
- ref_node_child_process
- OpenClass Live — guía para la clase
- Pagina
- Microactividad interactiva (5–10 minutos)
- Prompt para crear una semana de OpenClass con IA
- vite.config.mjs
- main.jsx
- index.mjs
- portal-academico.test.mjs
- publicar
- steps
- ref_node_fs
- navegador.test.mjs
- http.mjs
- docente.mjs
- openclass-live/package.json
- validar.mjs
- scripts
- dependencies
- unidad.test.mjs
- ref_node_url
- crearAlmacen
- app.mjs
- openclass-live
- index.mjs
- live-navegador.test.mjs
- leerConfig
- semana.test.mjs
- ref_node_child_process
- autoPaginar.mjs

## God Nodes (most connected - your core abstractions)
1. `TEMÁTICA DE PRUEBA` - 24 edges
2. `openclass-live` - 22 edges
3. `scripts` - 16 edges
4. `crearAlmacen()` - 16 edges
5. `Contrato técnico de OpenClass para asistentes de IA` - 16 edges
6. `Guía del docente — Crear OpenClass UNIMINUTO Reveal.js` - 15 edges
7. `Internet de las cosas` - 14 edges
8. `abrirNavegador()` - 13 edges
9. `el()` - 13 edges
10. `crearManejadorHttp()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs
- `Architecture and key files` --references--> `cerrar()`  [INFERRED]
  docs/AI-CONTEXT.md → scripts/lib/chrome.mjs
- `Espacio `/participante` (estudiantes)` --references--> `estado()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → template/public/actividades/microactividad/app.js
- `Espacio `/docente` (panel y presentación local)` --references--> `cerrar()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → scripts/lib/chrome.mjs
- `Espacio `/docente` (panel y presentación local)` --references--> `estado()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → template/public/actividades/microactividad/app.js

## Import Cycles
- None detected.

## Communities (60 total, 6 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "ayuda.mjs"
Cohesion: 0.21
Nodes (15): esperar(), evento(), HASH, iniciar(), ORIGEN, PASSWORD, pedir(), peticion() (+7 more)

### Community 3 - "template/package.json"
Cohesion: 0.14
Nodes (13): @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, @revealjs/react, devDependencies, vite, @vitejs/plugin-react, name (+5 more)

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
Nodes (25): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+17 more)

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
Cohesion: 0.16
Nodes (18): CASOS, CORTA, dentro(), fase(), fmt(), LARGA, LIENZO, MEDIR() (+10 more)

### Community 23 - "sockets.mjs"
Cohesion: 0.27
Nodes (8): crearLimitador(), ipCliente(), ErrorSala, conSala(), crearSockets(), autorizar(), errorDe(), origenAdmitido()

### Community 24 - "[1.1.0] — sin publicar"
Cohesion: 0.08
Nodes (22): [1.0.0] — 2026-10-21, [1.1.0] — sin publicar, Actualizar un curso existente, Cambios, Conocido, Desarrollo del generador, Generación semanal segura, Guía del docente (+14 more)

### Community 25 - "Plantilla semanal para crear una OpenClass con IA"
Cohesion: 0.25
Nodes (7): Contenido, Datos generales, Interacción y evaluación, Material académico disponible, Observaciones pedagógicas, Plantilla semanal para crear una OpenClass con IA, Referencias

### Community 26 - "publicacion-seguridad.test.mjs"
Cohesion: 0.15
Nodes (8): evidencia(), artefactos, bin, id, listar(), M, root, SOLUCIONARIOS

### Community 27 - "Presentacion.jsx"
Cohesion: 0.20
Nodes (8): auditarOverflow(), ajustarTextos(), AJUSTES, escribirCurso(), FIJAS, numeroDiapositiva(), Presentacion(), protegerCurso()

### Community 28 - "ref_node_child_process"
Cohesion: 0.13
Nodes (10): args, dist, r, raiz, raiz, bin, root, capitulo() (+2 more)

### Community 29 - "OpenClass Live — guía para la clase"
Cohesion: 0.05
Nodes (36): 10. Cerrar la sesión, 11. Si se pierde la conexión, 1. Iniciar OpenClass en su computador, 2. Entrar al panel docente, 3. Abrir una sala, 4. Mostrar el QR durante Zoom, 5. Preparar una encuesta, 6. Iniciar la votación (+28 more)

### Community 31 - "Pagina"
Cohesion: 0.12
Nodes (12): cerrar(), Conexion, esperar(), Pagina, Espacio `/docente` (panel y presentación local), Espacio `/participante` (estudiantes), HTTP, OpenClass Live — protocolo Socket.IO (+4 more)

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "vite.config.mjs"
Cohesion: 0.09
Nodes (19): Architecture and key files, Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass Live (in development, not in the npm package), OpenClass master: minimal AI context, Publication state (2026-10-21) (+11 more)

### Community 36 - "main.jsx"
Cohesion: 0.25
Nodes (7): react, react-dom, el, Portal(), RECORRIDOS, recursos(), slug()

### Community 37 - "index.mjs"
Cohesion: 0.28
Nodes (15): el(), extraerEncuesta(), guardarClave(), letra(), OpenClassLive(), abrirEncuestaActual(), actualizar(), alternarPanel() (+7 more)

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
Cohesion: 0.29
Nodes (4): checks, config, required, short

### Community 42 - "navegador.test.mjs"
Cohesion: 0.33
Nodes (4): CLASES, esperar(), IDS, irA()

### Community 43 - "http.mjs"
Cohesion: 0.16
Nodes (19): leerOculto(), b64(), COOKIE_DOCENTE, cookieDocente(), hashPassword(), leerCookies(), memoria(), SCRYPT (+11 more)

### Community 44 - "docente.mjs"
Cohesion: 0.12
Nodes (42): barras(), comparar(), el(), ESTADOS, letra(), MENSAJES_ERROR, textoConCodigo(), accion() (+34 more)

### Community 45 - "openclass-live/package.json"
Cohesion: 0.06
Nodes (29): qrcode-generator, socket.io, socket.io-client, author, dependencies, qrcode-generator, socket.io, description (+21 more)

### Community 46 - "validar.mjs"
Cohesion: 0.29
Nodes (17): ajustesPreguntas(), CODIGO, codigoSala(), crearSala(), definicionEncuesta(), ErrorValidacion, falla(), id() (+9 more)

### Community 47 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build:all, config, demo, dev, general, laboratorio, pages:build (+5 more)

### Community 48 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react, react-dom, reveal.js (+1 more)

### Community 49 - "unidad.test.mjs"
Cohesion: 0.28
Nodes (4): LIMITES_SALA, ALFABETO_CODIGO, nuevo(), reloj()

### Community 50 - "ref_node_url"
Cohesion: 0.40
Nodes (4): destino, fijarDuracion(), largoVint(), raiz

### Community 51 - "crearAlmacen"
Cohesion: 0.29
Nodes (10): crearAlmacen(), eliminar(), estadoEncuesta(), generarCodigo(), participante(), resumenRonda(), sala(), vistaEncuestaDocente() (+2 more)

### Community 52 - "app.mjs"
Cohesion: 0.43
Nodes (5): crearApp(), PUBLICO, crearFirmador(), crearSesiones(), cargarEstaticos()

### Community 53 - "openclass-live"
Cohesion: 0.05
Nodes (38): context, dockerfile, interval, retries, start_period, test, timeout, driver (+30 more)

### Community 54 - "index.mjs"
Cohesion: 0.11
Nodes (16): chart.js, reveal.js, OpenClassCodigo(), puedeMover(), TECLAS, cargarFase2(), FASE2, LIVE (+8 more)

### Community 55 - "live-navegador.test.mjs"
Cohesion: 0.13
Nodes (14): capturas, miniaturas, raiz, abrirNavegador(), CANDIDATOS, rutaChrome(), enviar(), servir() (+6 more)

### Community 56 - "leerConfig"
Cohesion: 0.36
Nodes (6): crearLog(), entero(), leerConfig(), lista(), app, log

### Community 57 - "semana.test.mjs"
Cohesion: 0.24
Nodes (6): leer(), bin, curso(), readCfg(), root, tmp()

### Community 58 - "ref_node_child_process"
Cohesion: 0.12
Nodes (13): ARCHIVOS, carpeta, lista, r, raiz, salida, suma, tar (+5 more)

### Community 59 - "autoPaginar.mjs"
Cohesion: 0.57
Nodes (6): coste(), paginarMarkdown(), paginasCodigo(), paginasTexto(), separarDiapositivas(), sinId()

## Knowledge Gaps
- **1 isolated node(s):** `mermaid`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 637 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cerrar()` connect `Pagina` to `vite.config.mjs`, `live-navegador.test.mjs`?**
  _High betweenness centrality (0.075) - this node is a cross-community bridge._
- **What connects `mermaid` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `codigo()` connect `docente.mjs` to `build-site.mjs`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `template/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `semana.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.12280701754385964 - nodes in this community are weakly interconnected._