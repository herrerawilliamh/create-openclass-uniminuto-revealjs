# Graph Report - create-openclass-uniminuto-revealjs  (2026-10-26)

## Corpus Check
- 103 files · ~115,051 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 22 file(s) not represented in the graph (top: (none) 10, .css 8, .example 1)

## Summary
- 1354 nodes · 2357 edges · 70 communities (64 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 70 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `604c77df`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generar-desde-config.mjs
- create-openclass-uniminuto-revealjs.mjs
- ayuda.mjs
- template/package.json
- semana.mjs
- portada-pedagogica.test.mjs
- scripts
- vite.config.mjs
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
- montarBuildTech
- [1.1.0] — sin publicar
- Plantilla semanal para crear una OpenClass con IA
- publicacion-seguridad.test.mjs
- galeria.mjs
- validar.mjs
- OpenClass Live — guía para la clase
- Despliegue en la VPS (WillEdTech)
- Microactividad interactiva (5–10 minutos)
- Prompt para crear una semana de OpenClass con IA
- Pagina
- OpenClass master: minimal AI context
- OpenClassLive
- portal-academico.test.mjs
- publicar
- with
- OpenClassBuildTech
- build-site.mjs
- http.mjs
- docente.mjs
- openclass-live/package.json
- app.js
- scripts
- environment
- OpenClass Live — preparación para una futura Zoom App
- live-navegador.test.mjs
- ref_node_child_process
- OpenClass Live — protocolo Socket.IO
- openclass-live
- Presentacion.jsx
- sockets.mjs
- ref_node_url
- ref_node_assert
- ref_node_path
- OpenClass Live
- docker-compose.yml
- healthcheck
- dependencies
- options
- build
- crearAlmacen
- app.mjs
- build-tech-navegador.test.mjs
- unidad.test.mjs
- ref_node_fs

## God Nodes (most connected - your core abstractions)
1. `montarBuildTech()` - 46 edges
2. `OpenClassLive()` - 42 edges
3. `OpenClassBuildTech()` - 24 edges
4. `TEMÁTICA DE PRUEBA` - 24 edges
5. `openclass-live` - 22 edges
6. `crearAlmacen()` - 20 edges
7. `abrirNavegador()` - 19 edges
8. `scripts` - 17 edges
9. `pintarClase()` - 17 edges
10. `crearApp()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Negociación de versión (v0.2)` --references--> `cerrar()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → scripts/lib/chrome.mjs
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs
- `Architecture and key files` --references--> `cerrar()`  [INFERRED]
  docs/AI-CONTEXT.md → scripts/lib/chrome.mjs
- `OpenClass Live (in development, not in the npm package)` --references--> `terminarSesion()`  [INFERRED]
  docs/AI-CONTEXT.md → services/openclass-live/public/assets/docente.mjs
- `OpenClass Live (in development, not in the npm package)` --references--> `dejarSala()`  [INFERRED]
  docs/AI-CONTEXT.md → services/openclass-live/public/assets/docente.mjs

## Import Cycles
- None detected.

## Communities (70 total, 6 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "ayuda.mjs"
Cohesion: 0.17
Nodes (18): PROTOCOLO, esperar(), evento(), HASH, iniciar(), ORIGEN, PASSWORD, pedir() (+10 more)

### Community 3 - "template/package.json"
Cohesion: 0.14
Nodes (13): @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, @revealjs/react, devDependencies, vite, @vitejs/plugin-react, name (+5 more)

### Community 4 - "semana.mjs"
Cohesion: 0.12
Nodes (17): activity, args, byNumber, config, date, duration, fail(), forceContent (+9 more)

### Community 5 - "portada-pedagogica.test.mjs"
Cohesion: 0.05
Nodes (40): ACCESO, actividadDigital(), alternativa(), bin, CANALES, COLA, conEnlaces(), configurar() (+32 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (38): author, bin, create-openclass-uniminuto-revealjs, bugs, url, description, engines, node (+30 more)

### Community 7 - "vite.config.mjs"
Cohesion: 0.18
Nodes (10): Architecture and key files, vite, @vitejs/plugin-react, activas(), CONFIG, configPublica(), entries, MODULOS (+2 more)

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
Nodes (5): add(), marca(), raiz, RECURSOS, svg()

### Community 22 - "portada-dom.test.mjs"
Cohesion: 0.16
Nodes (18): CASOS, CORTA, dentro(), fase(), fmt(), LARGA, LIENZO, MEDIR() (+10 more)

### Community 23 - "montarBuildTech"
Cohesion: 0.12
Nodes (51): configurar(), DURACIONES_CLASE, duracionValida(), fase(), formatoReloj(), iniciar(), leerTiempo(), MAX_CLASE (+43 more)

### Community 24 - "[1.1.0] — sin publicar"
Cohesion: 0.08
Nodes (22): [1.0.0] — 2026-10-21, [1.1.0] — sin publicar, Actualizar un curso existente, Cambios, Conocido, Desarrollo del generador, Generación semanal segura, Guía del docente (+14 more)

### Community 25 - "Plantilla semanal para crear una OpenClass con IA"
Cohesion: 0.25
Nodes (7): Contenido, Datos generales, Interacción y evaluación, Material académico disponible, Observaciones pedagógicas, Plantilla semanal para crear una OpenClass con IA, Referencias

### Community 26 - "publicacion-seguridad.test.mjs"
Cohesion: 0.15
Nodes (8): evidencia(), artefactos, bin, id, listar(), M, root, SOLUCIONARIOS

### Community 27 - "galeria.mjs"
Cohesion: 0.50
Nodes (8): comparar(), copiar(), crear(), dato(), ejemplo(), lista(), tarjeta(), vista()

### Community 28 - "validar.mjs"
Cohesion: 0.25
Nodes (20): ajustesPreguntas(), ajustesSala(), CODIGO, codigoSala(), crearSala(), definicionEncuesta(), DURACIONES_VOTACION, ErrorValidacion (+12 more)

### Community 29 - "OpenClass Live — guía para la clase"
Cohesion: 0.12
Nodes (16): 10. Cerrar la sesión, 11. Teclado y accesibilidad, 12. Si se pierde la conexión, 1. Iniciar OpenClass en su computador, 2. Abrir la sala en el panel docente, 3. Conectar la presentación (una vez por clase), 4. Una clase = una sala = un QR, 5. Escribir las preguntas (en el Markdown, una sola vez) (+8 more)

### Community 31 - "Despliegue en la VPS (WillEdTech)"
Cohesion: 0.15
Nodes (13): 1. Paquete (computador del docente o de desarrollo), 2. Verificación previa en la VPS (solo lectura), 3. Instalar archivos, 4. Secretos (se generan dentro de la VPS; nada se imprime), 5. Validar y levantar solo este stack, 6. Pruebas HTTP y WebSocket (desde fuera de la VPS), 7. Adoptar en Dockhand, Actualización (+5 more)

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "Pagina"
Cohesion: 0.19
Nodes (6): cerrar(), Conexion, esperar(), Pagina, adjuntarNueva(), esperar()

### Community 36 - "OpenClass master: minimal AI context"
Cohesion: 0.22
Nodes (8): Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass master: minimal AI context, Publication state (2026-10-21), Start here, Thirteen existing layouts

### Community 37 - "OpenClassLive"
Cohesion: 0.09
Nodes (60): OpenClass Live (in development, not in the npm package), extraerEncuesta(), firmaEncuesta(), normal(), separarSolucion(), textoDe(), DURACIONES, el() (+52 more)

### Community 38 - "portal-academico.test.mjs"
Cohesion: 0.16
Nodes (11): archivos(), config(), construir(), manifiesto, npm(), ok(), root, RUTAS (+3 more)

### Community 39 - "publicar"
Cohesion: 0.05
Nodes (37): concurrency, cancel-in-progress, group, description, required, type, VERSION, confirmar (+29 more)

### Community 40 - "with"
Cohesion: 0.05
Nodes (44): CHROME_PATH, CONTENIDO, ESPERADO, OPENCLASS_EVIDENCIA, PAGES_BASE, SALIDA, jobs, ligeras (+36 more)

### Community 41 - "OpenClassBuildTech"
Cohesion: 0.07
Nodes (58): Build Tech and PDF export (template, branch feat/openclass-live-teacher-ux-v0.2, uncommitted), el(), enlaceImprimible(), iframesImprimibles(), letra(), modoImpresion(), modoPrevia(), neutralizarMedios() (+50 more)

### Community 42 - "build-site.mjs"
Cohesion: 0.09
Nodes (19): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+11 more)

### Community 43 - "http.mjs"
Cohesion: 0.16
Nodes (19): leerOculto(), b64(), COOKIE_DOCENTE, cookieDocente(), hashPassword(), leerCookies(), memoria(), SCRYPT (+11 more)

### Community 44 - "docente.mjs"
Cohesion: 0.09
Nodes (64): barras(), comparar(), crearCuenta(), el(), ESTADOS, formatoTiempo(), letra(), MENSAJES_ERROR (+56 more)

### Community 45 - "openclass-live/package.json"
Cohesion: 0.06
Nodes (29): qrcode-generator, socket.io, socket.io-client, author, dependencies, qrcode-generator, socket.io, description (+21 more)

### Community 46 - "app.js"
Cohesion: 0.53
Nodes (4): comprobar(), dibujar(), estado(), progreso()

### Community 47 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build:all, config, demo, dev, general, laboratorio, pages:build (+5 more)

### Community 48 - "environment"
Cohesion: 0.15
Nodes (13): ADMIN_PASSWORD_HASH, APP_URL, MAX_ROOM_PARTICIPANTS, MAX_ROOMS, NODE_ENV, PORT, PRESENTER_ORIGINS, ROOM_TTL_MINUTES (+5 more)

### Community 49 - "OpenClass Live — preparación para una futura Zoom App"
Cohesion: 0.25
Nodes (4): OpenClass Live — preparación para una futura Zoom App, Principios que deben mantenerse, Qué faltaría, Qué se puede reutilizar

### Community 50 - "live-navegador.test.mjs"
Cohesion: 0.25
Nodes (4): MARCADORES, npm(), prepararCurso(), RAIZ

### Community 51 - "ref_node_child_process"
Cohesion: 0.19
Nodes (12): compilar(), crearCurso(), DIAPOSITIVAS, npm(), RAIZ, recompilar(), YOUTUBE_ID, inspeccionar() (+4 more)

### Community 52 - "OpenClass Live — protocolo Socket.IO"
Cohesion: 0.29
Nodes (7): Build Tech (puente local, no es parte de este protocolo), Espacio `/docente` (panel y presentación local), Espacio `/participante` (estudiantes), HTTP, Negociación de versión (v0.2), OpenClass Live — protocolo Socket.IO, Tiempo de votación

### Community 53 - "openclass-live"
Cohesion: 0.11
Nodes (18): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+10 more)

### Community 54 - "Presentacion.jsx"
Cohesion: 0.05
Nodes (39): chart.js, react, react-dom, reveal.js, auditarOverflow(), coste(), paginarMarkdown(), paginasCodigo() (+31 more)

### Community 55 - "sockets.mjs"
Cohesion: 0.24
Nodes (11): crearLimitador(), ipCliente(), presentadorCompatible(), ErrorSala, conSala(), crearSockets(), autorizar(), difundir() (+3 more)

### Community 56 - "ref_node_url"
Cohesion: 0.40
Nodes (4): destino, fijarDuracion(), largoVint(), raiz

### Community 57 - "ref_node_assert"
Cohesion: 0.12
Nodes (12): raiz, bin, root, capitulo(), leer(), root, texto(), bin (+4 more)

### Community 58 - "ref_node_path"
Cohesion: 0.10
Nodes (16): ARCHIVOS, carpeta, lista, r, raiz, salida, suma, tar (+8 more)

### Community 59 - "OpenClass Live"
Cohesion: 0.33
Nodes (6): Arquitectura, Desarrollo y pruebas locales, OpenClass Live, Privacidad y límites conocidos, Seguridad: resumen, Variables de entorno

### Community 60 - "docker-compose.yml"
Cohesion: 0.33
Nodes (5): name, networks, web, services, external

### Community 61 - "healthcheck"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 62 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react, react-dom, reveal.js (+1 more)

### Community 63 - "options"
Cohesion: 0.40
Nodes (5): driver, options, logging, max-file, max-size

### Community 64 - "build"
Cohesion: 0.67
Nodes (3): context, dockerfile, build

### Community 66 - "crearAlmacen"
Cohesion: 0.15
Nodes (19): Aplicación (cuando se autorice), Defecto, Hotfix v0.1 — sin filtración del acierto antes de revelar, Parche, Verificación hecha (2026-10-26), crearAlmacen(), cerrarRonda(), eliminar() (+11 more)

### Community 67 - "app.mjs"
Cohesion: 0.18
Nodes (13): crearApp(), crearLog(), PUBLICO, crearFirmador(), crearSesiones(), entero(), leerConfig(), lista() (+5 more)

### Community 68 - "build-tech-navegador.test.mjs"
Cohesion: 0.10
Nodes (17): abrirNavegador(), CANDIDATOS, rutaChrome(), enviar(), servir(), TIPOS, NOTAS_PRIVADAS, prepararCurso() (+9 more)

### Community 69 - "unidad.test.mjs"
Cohesion: 0.22
Nodes (6): LIMITES_SALA, ALFABETO_CODIGO, DURACION_PREDETERMINADA, nuevo(), reloj(), SOLUCION

### Community 70 - "ref_node_fs"
Cohesion: 0.20
Nodes (5): args, dist, r, raiz, checks

## Knowledge Gaps
- **585 isolated node(s):** `root`, `template`, `input`, `flags`, `positional` (+580 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 694 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scripts` connect `scripts` to `template/package.json`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `montarBuildTech()` (e.g. with `sincronizarPrevias()` and `tictac()`) actually correct?**
  _`montarBuildTech()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `root`, `template`, `input` to the rest of the system?**
  _585 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `montarBuildTech()` connect `montarBuildTech` to `OpenClassBuildTech`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `OpenClassLive()` (e.g. with `estadoBuildTech()` and `ordenBuildTech()`) actually correct?**
  _`OpenClassLive()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._