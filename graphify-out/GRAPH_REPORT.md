# Graph Report - openclass-vnext  (2026-11-05)

## Corpus Check
- 123 files · ~125,495 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 23 file(s) not represented in the graph (top: (none) 10, .css 8, .example 1)

## Summary
- 1533 nodes · 2637 edges · 91 communities (84 shown, 7 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 76 edges (avg confidence: 0.88)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `309f9708`
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
- vista.mjs
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
- ref_node_url
- galeria.mjs
- validar.mjs
- OpenClass Live — guía para la clase
- Presentacion.jsx
- Microactividad interactiva (5–10 minutos)
- Prompt para crear una semana de OpenClass con IA
- vite.config.mjs
- OpenClassBuildTech
- OpenClassLive
- portal-academico.test.mjs
- publicar
- jobs
- buildtech.mjs
- contenido.test.mjs
- openclass-live
- docente.mjs
- openclass-live/package.json
- app.js
- scripts
- environment
- multimedia.mjs
- live-navegador.test.mjs
- ref_node_child_process
- verificar-gitops.mjs
- openclass-live
- index.mjs
- build-site.mjs
- ref_node_assert
- ref_node_child_process
- empaquetar-despliegue.mjs
- environment
- docker-compose.yml
- healthcheck
- release_tag
- options
- build
- steps
- crearAlmacen
- with
- chrome.mjs
- with
- ref_node_fs
- openclass-live.yml
- steps
- notas.mjs
- ligeras
- labels
- autoPaginar.mjs
- navegador
- approved
- env
- docker-compose.gitops.yml
- healthcheck
- env
- options
- Portal.jsx
- stable-startup
- checks
- sockets.mjs
- http.mjs
- scripts
- verificar-despliegue.mjs

## God Nodes (most connected - your core abstractions)
1. `montarBuildTech()` - 46 edges
2. `OpenClassLive()` - 42 edges
3. `OpenClassBuildTech()` - 24 edges
4. `TEMÁTICA DE PRUEBA` - 24 edges
5. `openclass-live` - 23 edges
6. `openclass-live` - 22 edges
7. `abrirNavegador()` - 21 edges
8. `crearAlmacen()` - 20 edges
9. `crearApp()` - 19 edges
10. `scripts` - 17 edges

## Surprising Connections (you probably didn't know these)
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs
- `Negociación de versión (v0.2)` --references--> `cerrar()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → scripts/lib/chrome.mjs
- `Build Tech and PDF export (template, branch feat/openclass-live-teacher-ux-v0.2, uncommitted)` --references--> `extraerEncuesta()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/encuesta.mjs
- `OpenClass Live (in development, not in the npm package)` --references--> `firmaEncuesta()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/encuesta.mjs
- `OpenClass Live (in development, not in the npm package)` --references--> `elegirHueco()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/live.mjs

## Import Cycles
- None detected.

## Communities (91 total, 7 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "ayuda.mjs"
Cohesion: 0.18
Nodes (17): esperar(), evento(), HASH, iniciar(), ORIGEN, PASSWORD, pedir(), peticion() (+9 more)

### Community 3 - "template/package.json"
Cohesion: 0.08
Nodes (30): chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react-dom, reveal.js, @revealjs/react, vite (+22 more)

### Community 4 - "semana.mjs"
Cohesion: 0.12
Nodes (17): activity, args, byNumber, config, date, duration, fail(), forceContent (+9 more)

### Community 5 - "portada-pedagogica.test.mjs"
Cohesion: 0.05
Nodes (40): ACCESO, actividadDigital(), alternativa(), bin, CANALES, COLA, conEnlaces(), configurar() (+32 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (38): author, bin, create-openclass-uniminuto-revealjs, bugs, url, description, engines, node (+30 more)

### Community 7 - "vista.mjs"
Cohesion: 0.22
Nodes (22): configurar(), DURACIONES_CLASE, duracionValida(), fase(), formatoReloj(), iniciar(), leerTiempo(), MAX_CLASE (+14 more)

### Community 8 - "Manual del creador de OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.17
Nodes (11): Actualización segura 1.2.0, Despliegue y funciones online, Distribución, Integración continua y publicación, Manual del creador de OpenClass UNIMINUTO Reveal.js, Objetivo, Opciones de CLI, Pruebas (+3 more)

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
Cohesion: 0.15
Nodes (18): CASOS, CORTA, dentro(), fase(), fmt(), LARGA, LIENZO, MEDIR() (+10 more)

### Community 23 - "montarBuildTech"
Cohesion: 0.21
Nodes (29): el(), montarBuildTech(), alternarSoloNotas(), anclasConNota(), aplicarPrefs(), avisar(), barras(), cambiarConexion() (+21 more)

### Community 24 - "[1.1.0] — sin publicar"
Cohesion: 0.07
Nodes (25): [1.0.0] — 2026-10-21, [1.1.0] — sin publicar, [1.2.0] — 2026-10-27, [1.3.0] — 2026-10-28, [1.3.1] — 2026-10-30, Actualizar un curso existente, Cambios, Conocido (+17 more)

### Community 25 - "Plantilla semanal para crear una OpenClass con IA"
Cohesion: 0.25
Nodes (7): Contenido, Datos generales, Interacción y evaluación, Material académico disponible, Observaciones pedagógicas, Plantilla semanal para crear una OpenClass con IA, Referencias

### Community 26 - "ref_node_url"
Cohesion: 0.15
Nodes (8): evidencia(), artefactos, bin, id, listar(), M, root, SOLUCIONARIOS

### Community 27 - "galeria.mjs"
Cohesion: 0.50
Nodes (8): comparar(), copiar(), crear(), dato(), ejemplo(), lista(), tarjeta(), vista()

### Community 28 - "validar.mjs"
Cohesion: 0.17
Nodes (23): LIMITES_SALA, ajustesPreguntas(), ajustesSala(), ALFABETO_CODIGO, CODIGO, codigoSala(), crearSala(), definicionEncuesta() (+15 more)

### Community 29 - "OpenClass Live — guía para la clase"
Cohesion: 0.04
Nodes (44): Bloqueo de auto-sync por procedencia, Definición que usará Dockhand, Dockhand 1.0.33: actualización previa y cambio controlado, Estado y alcance, Fuente aprobada y CI, GitOps de OpenClass Live: preparación local, promoción manual, Si el stack actual es Internal, Variables y secretos: conservar la instalación existente (+36 more)

### Community 31 - "Presentacion.jsx"
Cohesion: 0.13
Nodes (12): react, auditarOverflow(), el, ajustarTextos(), AJUSTES, escribirCurso(), FIJAS, numeroDiapositiva() (+4 more)

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "vite.config.mjs"
Cohesion: 0.06
Nodes (29): Architecture and key files, Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass master: minimal AI context, Publication state (2026-10-21), Start here (+21 more)

### Community 36 - "OpenClassBuildTech"
Cohesion: 0.25
Nodes (18): Build Tech and PDF export (template, branch feat/openclass-live-teacher-ux-v0.2, uncommitted), OpenClassBuildTech(), abrirBuildTech(), abrirSelector(), alMensaje(), alternarRelojPublico(), cerrarSelector(), ejecutar() (+10 more)

### Community 37 - "OpenClassLive"
Cohesion: 0.09
Nodes (56): firmaEncuesta(), separarSolucion(), DURACIONES, el(), elegirHueco(), formatoTiempo(), guardarClave(), HUECOS_CODIGO (+48 more)

### Community 38 - "portal-academico.test.mjs"
Cohesion: 0.16
Nodes (11): archivos(), config(), construir(), manifiesto, npm(), ok(), root, RUTAS (+3 more)

### Community 39 - "publicar"
Cohesion: 0.05
Nodes (37): concurrency, cancel-in-progress, group, description, required, type, VERSION, confirmar (+29 more)

### Community 40 - "jobs"
Cohesion: 0.17
Nodes (11): jobs, paquete, name, name, runs-on, permissions, contents, True (+3 more)

### Community 41 - "buildtech.mjs"
Cohesion: 0.12
Nodes (19): el(), enlaceImprimible(), iframesImprimibles(), modoImpresion(), modoPrevia(), neutralizarMedios(), extraerEncuesta(), normal() (+11 more)

### Community 42 - "contenido.test.mjs"
Cohesion: 0.13
Nodes (12): capturas, miniaturas, raiz, destino, fijarDuracion(), largoVint(), raiz, ERRORES_COMUNES (+4 more)

### Community 43 - "openclass-live"
Cohesion: 0.11
Nodes (19): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+11 more)

### Community 44 - "docente.mjs"
Cohesion: 0.07
Nodes (73): OpenClass Live (in development, not in the npm package), I0 — `preparacion-release.test.mjs:29` (commit 8b02f6e), I1 — OC-A02 atomicidad de encuestas (commit eebdc33), I2 — Recuperación y confiabilidad del panel (OC-A01, OC-A06, OC-A10, O-01, O-09), Notas de decisión técnica — Teacher Experience VNext, barras(), comparar(), crearCuenta() (+65 more)

### Community 45 - "openclass-live/package.json"
Cohesion: 0.12
Nodes (18): qrcode-generator, socket.io, socket.io-client, author, dependencies, qrcode-generator@2.0.4, socket.io@4.8.4, description (+10 more)

### Community 46 - "app.js"
Cohesion: 0.53
Nodes (4): comprobar(), dibujar(), estado(), progreso()

### Community 47 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build:all, config, demo, dev, general, laboratorio, pages:build (+5 more)

### Community 48 - "environment"
Cohesion: 0.15
Nodes (13): ADMIN_PASSWORD_HASH, APP_URL, MAX_ROOM_PARTICIPANTS, MAX_ROOMS, NODE_ENV, PORT, PRESENTER_ORIGINS, ROOM_TTL_MINUTES (+5 more)

### Community 49 - "multimedia.mjs"
Cohesion: 0.23
Nodes (15): avisar(), apiYoutube(), crearMultimedia(), describir(), ejecutar(), enlazar(), enlazarHtml5(), enlazarYoutube() (+7 more)

### Community 50 - "live-navegador.test.mjs"
Cohesion: 0.25
Nodes (4): MARCADORES, npm(), prepararCurso(), RAIZ

### Community 51 - "ref_node_child_process"
Cohesion: 0.13
Nodes (14): compilar(), crearCurso(), DIAPOSITIVAS, npm(), RAIZ, recompilar(), YOUTUBE_ID, NOTAS_PRIVADAS (+6 more)

### Community 52 - "verificar-gitops.mjs"
Cohesion: 0.18
Nodes (12): actual, archive, base, expected, json(), lock, pkg, read() (+4 more)

### Community 53 - "openclass-live"
Cohesion: 0.11
Nodes (18): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+10 more)

### Community 54 - "index.mjs"
Cohesion: 0.12
Nodes (14): OpenClassCodigo(), puedeMover(), TECLAS, cargarFase2(), FASE2, LIVE, cargarCss(), cargarPlugins() (+6 more)

### Community 55 - "build-site.mjs"
Cohesion: 0.17
Nodes (11): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+3 more)

### Community 56 - "ref_node_assert"
Cohesion: 0.12
Nodes (25): abrirNavegador(), CANDIDATOS, rutaChrome(), crearApp(), crearLog(), PUBLICO, b64(), crearFirmador() (+17 more)

### Community 57 - "ref_node_child_process"
Cohesion: 0.09
Nodes (15): args, dist, r, raiz, bin, root, capitulo(), leer() (+7 more)

### Community 58 - "empaquetar-despliegue.mjs"
Cohesion: 0.14
Nodes (12): ARCHIVOS, carpeta, lista, lock, r, raiz, salida, sinEnlaces() (+4 more)

### Community 59 - "environment"
Cohesion: 0.15
Nodes (13): ADMIN_PASSWORD_HASH, APP_URL, MAX_ROOM_PARTICIPANTS, MAX_ROOMS, NODE_ENV, PORT, PRESENTER_ORIGINS, ROOM_TTL_MINUTES (+5 more)

### Community 60 - "docker-compose.yml"
Cohesion: 0.33
Nodes (5): name, networks, web, services, external

### Community 61 - "healthcheck"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 62 - "release_tag"
Cohesion: 0.20
Nodes (10): release_tag, branches, default, description, required, type, True, pull_request (+2 more)

### Community 63 - "options"
Cohesion: 0.40
Nodes (5): driver, options, logging, max-file, max-size

### Community 64 - "build"
Cohesion: 0.67
Nodes (3): context, dockerfile, build

### Community 65 - "steps"
Cohesion: 0.39
Nodes (9): steps, steps, steps, steps, if, name, run, shell (+1 more)

### Community 66 - "crearAlmacen"
Cohesion: 0.13
Nodes (21): Aplicación (cuando se autorice), Defecto, Hotfix v0.1 — sin filtración del acierto antes de revelar, Parche, Verificación hecha (2026-10-26), crearAlmacen(), cerrarRonda(), eliminar() (+13 more)

### Community 67 - "with"
Cohesion: 0.22
Nodes (9): with, fetch-depth, if-no-files-found, name, node-version, path, persist-credentials, ref (+1 more)

### Community 68 - "chrome.mjs"
Cohesion: 0.13
Nodes (12): enviar(), servir(), TIPOS, compilarCurso(), npm(), RAIZ, SERVICIO, CLASES (+4 more)

### Community 69 - "with"
Cohesion: 0.25
Nodes (8): with, if-no-files-found, name, node-version, path, persist-credentials, ref, retention-days

### Community 70 - "ref_node_fs"
Cohesion: 0.09
Nodes (17): hash, plantilla, raiz, salida, HOST_ESCUCHA, ORIGEN_PRESENTADOR, PUERTO, start() (+9 more)

### Community 71 - "openclass-live.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 72 - "steps"
Cohesion: 0.29
Nodes (8): steps, steps, id, if, name, run, shell, uses

### Community 73 - "notas.mjs"
Cohesion: 0.31
Nodes (9): letra(), estado(), ACCIONES_NOTA, bloque(), EN_LINEA, marcadorDe(), notasSeguras(), recorrer() (+1 more)

### Community 74 - "ligeras"
Cohesion: 0.29
Nodes (7): ligeras, name, runs-on, strategy, node, fail-fast, matrix

### Community 75 - "labels"
Cohesion: 0.29
Nodes (7): context, dockerfile, labels, org.opencontainers.image.revision, org.opencontainers.image.source, org.opencontainers.image.version, build

### Community 76 - "autoPaginar.mjs"
Cohesion: 0.57
Nodes (6): coste(), paginarMarkdown(), paginasCodigo(), paginasTexto(), separarDiapositivas(), sinId()

### Community 77 - "navegador"
Cohesion: 0.33
Nodes (6): CHROME_PATH, PAGES_BASE, navegador, env, name, runs-on

### Community 78 - "approved"
Cohesion: 0.33
Nodes (6): environment, if, name, needs, runs-on, approved

### Community 79 - "env"
Cohesion: 0.33
Nodes (6): ADMIN_PASSWORD_HASH, APP_HOST, APP_URL, RELEASE_TAG, SESSION_SECRET, env

### Community 80 - "docker-compose.gitops.yml"
Cohesion: 0.33
Nodes (5): name, networks, web, services, external

### Community 81 - "healthcheck"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 82 - "env"
Cohesion: 0.40
Nodes (5): CONTENIDO, ESPERADO, OPENCLASS_EVIDENCIA, SALIDA, env

### Community 83 - "options"
Cohesion: 0.40
Nodes (5): driver, options, logging, max-file, max-size

### Community 84 - "Portal.jsx"
Cohesion: 0.60
Nodes (4): Portal(), RECORRIDOS, recursos(), slug()

### Community 85 - "stable-startup"
Cohesion: 0.50
Nodes (4): stable-startup, name, runs-on, timeout-minutes

### Community 86 - "checks"
Cohesion: 0.50
Nodes (4): name, runs-on, timeout-minutes, checks

### Community 87 - "sockets.mjs"
Cohesion: 0.24
Nodes (11): crearLimitador(), ipCliente(), presentadorCompatible(), ErrorSala, conSala(), crearSockets(), autorizar(), difundir() (+3 more)

### Community 88 - "http.mjs"
Cohesion: 0.23
Nodes (13): COOKIE_DOCENTE, cookieDocente(), leerCookies(), crearManejadorHttp(), servirArchivo(), CSP, enviar(), leerJson() (+5 more)

### Community 89 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, audit, dev, empaquetar, gen-env, hash-password, start, test (+2 more)

## Knowledge Gaps
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `codigoSala()` connect `validar.mjs` to `http.mjs`, `vite.config.mjs`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `montarBuildTech()` (e.g. with `sincronizarPrevias()` and `tictac()`) actually correct?**
  _`montarBuildTech()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `Espacio `/participante` (estudiantes)` connect `vite.config.mjs` to `validar.mjs`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `OpenClassLive()` (e.g. with `estadoBuildTech()` and `ordenBuildTech()`) actually correct?**
  _`OpenClassLive()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `template/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08387096774193549 - nodes in this community are weakly interconnected._