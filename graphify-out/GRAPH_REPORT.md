# Graph Report - create-openclass-uniminuto-revealjs  (2026-11-08)

## Corpus Check
- 156 files · ~170,521 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 26 file(s) not represented in the graph (top: .css 11, (none) 10, .example 1)

## Summary
- 1804 nodes · 3207 edges · 117 communities (109 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e3daff8d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- generar-desde-config.mjs
- create-openclass-uniminuto-revealjs.mjs
- Pagina
- template/package.json
- semana.mjs
- portada-pedagogica.test.mjs
- scripts
- crearSockets
- vite.config.mjs
- Guía del docente — Crear OpenClass UNIMINUTO Reveal.js
- TEMÁTICA DE PRUEBA
- crearAlmacen
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
- OpenClass master: minimal AI context
- vista.mjs
- ayuda.mjs
- OpenClass Live — guía para la clase
- Presentacion.jsx
- Microactividad interactiva (5–10 minutos)
- Prompt para crear una semana de OpenClass con IA
- publicacion-ci.mjs
- OpenClassBuildTech
- OpenClassLive
- portal-academico.test.mjs
- publicar
- jobs
- buildtech.mjs
- build-site.mjs
- verificar-gitops.mjs
- docente.mjs
- openclass-live/package.json
- app.js
- scripts
- environment
- multimedia.mjs
- ref_node_fs
- build-tech-navegador.test.mjs
- main.jsx
- openclass-live
- index.mjs
- workflow-yaml.mjs
- chrome.mjs
- semana.test.mjs
- Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0)
- chrome.mjs
- docker-compose.yml
- healthcheck
- OpenClass Suite — Documento maestro de producto, requisitos y evolución
- options
- build
- notas.mjs
- empaquetar-despliegue.mjs
- autoPaginar.mjs
- Recorrido A · Docente con curso Reveal.js preparado
- OpenClass Live
- Manual del creador de OpenClass UNIMINUTO Reveal.js
- Procedencia GitOps de Live: decisión y contrato de promoción
- openclass-live/README.md
- ref_node_fs
- live-navegador.test.mjs
- I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos
- Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72)
- openclass-live
- Recorrido B · Docente sin curso Reveal.js preparado
- environment
- release_tag
- I6-D — Verificación de accesibilidad
- steps
- with
- with
- publish
- steps
- ligeras
- ref_node_url
- labels
- validar.mjs
- navegador
- http.mjs
- env
- docker-compose.gitops.yml
- healthcheck
- Promoción manual de OpenClass Live 0.3.0
- env
- publicar.mjs
- options
- procedencia-autosync.mjs
- stable-startup
- checks
- ref_node_url
- OpenClass Live — protocolo Socket.IO
- VNEXT-FUTURO.md
- I6-C — Verificación de las hipótesis H01–H08
- build
- permissions
- approval
- GitOps de OpenClass Live: preparación local, promoción manual
- Promoción manual de OpenClass Live 0.2.0
- Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada)
- Marca: clasificación y condición de publicación (OpenClass Live 0.3.0)
- salas.mjs
- Hotfix v0.1 — sin filtración del acierto antes de revelar
- verificar-despliegue.mjs

## God Nodes (most connected - your core abstractions)
1. `montarBuildTech()` - 46 edges
2. `OpenClassLive()` - 42 edges
3. `abrirNavegador()` - 28 edges
4. `crearApp()` - 25 edges
5. `OpenClassBuildTech()` - 24 edges
6. `TEMÁTICA DE PRUEBA` - 24 edges
7. `openclass-live` - 23 edges
8. `openclass-live` - 22 edges
9. `leerConfig()` - 22 edges
10. `crearSockets()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Negociación de versión (v0.2)` --references--> `cerrar()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → scripts/lib/chrome.mjs
- `Publication state (2026-10-21)` --references--> `main()`  [INFERRED]
  docs/AI-CONTEXT.md → services/openclass-live/scripts/publicacion-ci.mjs
- `Integración continua y publicación` --references--> `main()`  [INFERRED]
  docs/GUIA-DEL-CREADOR.md → services/openclass-live/scripts/publicacion-ci.mjs
- `0.1 Niveles de certeza` --references--> `main()`  [INFERRED]
  docs/OPENCLASS_REQUERIMIENTOS_MAESTROS.md → services/openclass-live/scripts/publicacion-ci.mjs
- `1. Estado inicial y evidencia (2026-10-30)` --references--> `main()`  [INFERRED]
  docs/OPENCLASS_REQUERIMIENTOS_MAESTROS.md → services/openclass-live/scripts/publicacion-ci.mjs

## Import Cycles
- None detected.

## Communities (117 total, 8 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "Pagina"
Cohesion: 0.28
Nodes (3): Pagina, adjuntarNueva(), esperar()

### Community 3 - "template/package.json"
Cohesion: 0.10
Nodes (24): chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react-dom, reveal.js, @revealjs/react, dependencies (+16 more)

### Community 4 - "semana.mjs"
Cohesion: 0.12
Nodes (17): activity, args, byNumber, config, date, duration, fail(), forceContent (+9 more)

### Community 5 - "portada-pedagogica.test.mjs"
Cohesion: 0.05
Nodes (40): ACCESO, actividadDigital(), alternativa(), bin, CANALES, COLA, conEnlaces(), configurar() (+32 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (38): author, bin, create-openclass-uniminuto-revealjs, bugs, url, description, engines, node (+30 more)

### Community 7 - "crearSockets"
Cohesion: 0.18
Nodes (20): Corrección de seguridad H02 — sockets del panel con sesión cerrada o vencida, H02 — corrección final: autorización por destinatario (hallazgo P1 de Codex), H02 — corrección P1 de Codex: vencimiento efectivo (cookie frente a SID), panelVigente(), presentadorCompatible(), PROTOCOLO, ErrorSala, conSala() (+12 more)

### Community 8 - "vite.config.mjs"
Cohesion: 0.15
Nodes (13): Architecture and key files, vite, @vitejs/plugin-react, devDependencies, vite@^7.1.12, @vitejs/plugin-react@^5.0.0, activas(), CONFIG (+5 more)

### Community 9 - "Guía del docente — Crear OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.08
Nodes (22): 10. Actualizar el curso, 11. Problemas frecuentes, 12. Futuras funciones en vivo, 1. Flujo de trabajo, 2. Crear una semana, 2b. Diseñar la semana, 3. Estructura de una diapositiva, 4. Los 13 layouts (+14 more)

### Community 10 - "TEMÁTICA DE PRUEBA"
Cohesion: 0.08
Nodes (24): Actividad mediante iframe, Actividad práctica, Código desplazable (scroll), Código fuente, Código paginado, Diagrama Mermaid, Dos columnas, Dos títulos (+16 more)

### Community 11 - "crearAlmacen"
Cohesion: 0.19
Nodes (17): Parche, crearAlmacen(), cerrarRonda(), eliminar(), estadoEncuesta(), generarCodigo(), participante(), resumenParticipante() (+9 more)

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

### Community 26 - "OpenClass master: minimal AI context"
Cohesion: 0.22
Nodes (8): Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass master: minimal AI context, Publication state (2026-10-21), Start here, Thirteen existing layouts

### Community 27 - "vista.mjs"
Cohesion: 0.22
Nodes (22): configurar(), DURACIONES_CLASE, duracionValida(), fase(), formatoReloj(), iniciar(), leerTiempo(), MAX_CLASE (+14 more)

### Community 28 - "ayuda.mjs"
Cohesion: 0.11
Nodes (29): socket.io-client, esperar(), evento(), HASH, iniciar(), ORIGEN, PASSWORD, pedir() (+21 more)

### Community 29 - "OpenClass Live — guía para la clase"
Cohesion: 0.22
Nodes (9): Build Tech: dirigir la clase desde el segundo monitor, Elija su recorrido, Exportar a PDF, OpenClass Live — guía para la clase, Qué hace cada persona, Salir, revocar claves y finalizar, Si se pierde la conexión, Teclado y accesibilidad (+1 more)

### Community 31 - "Presentacion.jsx"
Cohesion: 0.17
Nodes (10): auditarOverflow(), ajustarTextos(), AJUSTES, escribirCurso(), FIJAS, numeroDiapositiva(), Presentacion(), PREVIA (+2 more)

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "publicacion-ci.mjs"
Cohesion: 0.16
Nodes (20): arg(), auditarEstructura(), auditarWorkflow(), blobsDe(), bytesPublicables(), comandosNormalizados(), composeCandidato(), crearLock() (+12 more)

### Community 36 - "OpenClassBuildTech"
Cohesion: 0.23
Nodes (19): Build Tech and PDF export (template, branch feat/openclass-live-teacher-ux-v0.2, uncommitted), OpenClassBuildTech(), abrirBuildTech(), abrirSelector(), alMensaje(), alternarRelojPublico(), cerrarSelector(), ejecutar() (+11 more)

### Community 37 - "OpenClassLive"
Cohesion: 0.09
Nodes (60): OpenClass Live (in development, not in the npm package), extraerEncuesta(), firmaEncuesta(), normal(), separarSolucion(), textoDe(), DURACIONES, el() (+52 more)

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
Cohesion: 0.14
Nodes (17): el(), enlaceImprimible(), iframesImprimibles(), letra(), modoImpresion(), modoPrevia(), neutralizarMedios(), DURACIONES (+9 more)

### Community 42 - "build-site.mjs"
Cohesion: 0.09
Nodes (25): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+17 more)

### Community 43 - "verificar-gitops.mjs"
Cohesion: 0.10
Nodes (23): archivo, carpeta, destino, files, manifiesto, pkg, raiz, esBinario() (+15 more)

### Community 44 - "docente.mjs"
Cohesion: 0.05
Nodes (98): I0 — `preparacion-release.test.mjs:29` (commit 8b02f6e), I1 — OC-A02 atomicidad de encuestas (commit eebdc33), I2 — Recuperación y confiabilidad del panel (OC-A01, OC-A06, OC-A10, O-01, O-09), I3 — Foco, navegación y accesibilidad (OC-A03, OC-A04, OC-A07, O-02), I4 — Teacher Experience VNext (rediseño visual y de experiencia del panel docente), I4 — Trazabilidad Graphify del panel docente (cierre documental), I5 — Experiencia del estudiante (acuses, pestañas, selección), I6 — Cierre: guía docente, capturas, hipótesis, accesibilidad y aceptación (+90 more)

### Community 45 - "openclass-live/package.json"
Cohesion: 0.07
Nodes (29): qrcode-generator, socket.io, yaml, author, dependencies, qrcode-generator@2.0.4, socket.io@4.8.4, description (+21 more)

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

### Community 50 - "ref_node_fs"
Cohesion: 0.10
Nodes (17): enviar(), servir(), TIPOS, raiz, checks, bin, root, capitulo() (+9 more)

### Community 51 - "build-tech-navegador.test.mjs"
Cohesion: 0.13
Nodes (14): compilar(), crearCurso(), DIAPOSITIVAS, npm(), RAIZ, recompilar(), YOUTUBE_ID, NOTAS_PRIVADAS (+6 more)

### Community 52 - "main.jsx"
Cohesion: 0.25
Nodes (7): react, react@^19.2.0, el, Portal(), RECORRIDOS, recursos(), slug()

### Community 53 - "openclass-live"
Cohesion: 0.11
Nodes (18): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+10 more)

### Community 54 - "index.mjs"
Cohesion: 0.12
Nodes (14): OpenClassCodigo(), puedeMover(), TECLAS, cargarFase2(), FASE2, LIVE, cargarCss(), cargarPlugins() (+6 more)

### Community 55 - "workflow-yaml.mjs"
Cohesion: 0.60
Nodes (4): parseWorkflowYaml(), recorrer(), validarEscapes(), yaml()

### Community 56 - "chrome.mjs"
Cohesion: 0.12
Nodes (26): crearApp(), crearLog(), PUBLICO, b64(), crearFirmador(), crearSesiones(), hashPassword(), memoria() (+18 more)

### Community 57 - "semana.test.mjs"
Cohesion: 0.24
Nodes (6): leer(), bin, curso(), readCfg(), root, tmp()

### Community 58 - "Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0)"
Cohesion: 0.50
Nodes (3): Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0), Pendiente (no se improvisó), Qué cambia

### Community 59 - "chrome.mjs"
Cohesion: 0.15
Nodes (13): capturas, miniaturas, raiz, abrirNavegador(), cerrar(), CANDIDATOS, Conexion, esperar() (+5 more)

### Community 60 - "docker-compose.yml"
Cohesion: 0.33
Nodes (5): name, networks, web, services, external

### Community 61 - "healthcheck"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 62 - "OpenClass Suite — Documento maestro de producto, requisitos y evolución"
Cohesion: 0.08
Nodes (24): 0.1 Niveles de certeza, 0.2 Terminología, 0. Propósito y visión, 10. Decisiones y alternativas técnicas, 11. Plan incremental y criterios de salida, 12. Matriz transversal de compatibilidad y pruebas, 13.1 Decisiones propuestas (NO aprobadas por el propietario), 13. Preguntas abiertas que NO bloquean el inventario (+16 more)

### Community 63 - "options"
Cohesion: 0.40
Nodes (5): driver, options, logging, max-file, max-size

### Community 64 - "build"
Cohesion: 0.67
Nodes (3): context, dockerfile, build

### Community 65 - "notas.mjs"
Cohesion: 0.43
Nodes (7): ACCIONES_NOTA, bloque(), EN_LINEA, marcadorDe(), notasSeguras(), recorrer(), segmentos()

### Community 66 - "empaquetar-despliegue.mjs"
Cohesion: 0.14
Nodes (15): ARCHIVOS, carpeta, lista, lock, raiz, salida, sinEnlaces(), suma (+7 more)

### Community 67 - "autoPaginar.mjs"
Cohesion: 0.57
Nodes (6): coste(), paginarMarkdown(), paginasCodigo(), paginasTexto(), separarDiapositivas(), sinId()

### Community 68 - "Recorrido A · Docente con curso Reveal.js preparado"
Cohesion: 0.20
Nodes (10): A1. Acceder al panel, A2. Crear la sala, A3. Compartir el QR o el código, A4. Conectar la presentación con su clave, A5. Iniciar la votación, A6. Cerrar, publicar resultados, discutir y repetir, A7. Revelar la explicación, A8. Finalizar la sesión (+2 more)

### Community 69 - "OpenClass Live"
Cohesion: 0.25
Nodes (8): Arquitectura, Desarrollo y pruebas locales, Despliegue en la VPS (WillEdTech), OpenClass Live, Preparación y promoción de v0.3.0 (sustituye a la 0.2.0, que queda inmutable en `releases/0.2.0.json`), Privacidad y límites conocidos, Seguridad: resumen, Variables de entorno

### Community 70 - "Manual del creador de OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.17
Nodes (11): Actualización segura 1.2.0, Despliegue y funciones online, Distribución, Integración continua y publicación, Manual del creador de OpenClass UNIMINUTO Reveal.js, Objetivo, Opciones de CLI, Pruebas (+3 more)

### Community 71 - "Procedencia GitOps de Live: decisión y contrato de promoción"
Cohesion: 0.22
Nodes (7): Decisión al cierre de este trabajo, Diagnóstico y evidencia actual, Gate 1: autoridad y referencias, Gate 2: interacción con el Git stack existente, Gate 3: validación y límites de la evidencia, Procedencia GitOps de Live: decisión y contrato de promoción, Rollback y fallos cerrados

### Community 72 - "openclass-live/README.md"
Cohesion: 0.25
Nodes (4): OpenClass Live — preparación para una futura Zoom App, Principios que deben mantenerse, Qué faltaría, Qué se puede reutilizar

### Community 73 - "ref_node_fs"
Cohesion: 0.12
Nodes (12): HOST_ESCUCHA, ORIGEN_PRESENTADOR, PUERTO, start(), newer(), valid(), versionNotice(), config (+4 more)

### Community 74 - "live-navegador.test.mjs"
Cohesion: 0.25
Nodes (4): MARCADORES, npm(), prepararCurso(), RAIZ

### Community 75 - "I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos"
Cohesion: 0.25
Nodes (7): Estado, Guion de tareas, I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos, Perfil de la persona evaluada, Preparación (la hace otra persona, no quien evalúa), Qué observar, Registro (completar al ejecutar la prueba)

### Community 76 - "Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72)"
Cohesion: 0.29
Nodes (6): Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72), Contrato por digest (AUTOSYNC-PROVENANCE.md), Controles requeridos en GitHub (verificables con `gh api`), Evidencia de navegador, Identidad, Rollback

### Community 77 - "openclass-live"
Cohesion: 0.11
Nodes (19): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+11 more)

### Community 78 - "Recorrido B · Docente sin curso Reveal.js preparado"
Cohesion: 0.29
Nodes (7): B1. Acceder al panel, B2. Crear la sala, B3. Compartir el enlace, B4. Crear preguntas improvisadas, B5. Realizar votaciones y moderar preguntas, B6. Terminar la clase, Recorrido B · Docente sin curso Reveal.js preparado

### Community 79 - "environment"
Cohesion: 0.15
Nodes (13): ADMIN_PASSWORD_HASH, APP_URL, MAX_ROOM_PARTICIPANTS, MAX_ROOMS, NODE_ENV, PORT, PRESENTER_ORIGINS, ROOM_TTL_MINUTES (+5 more)

### Community 80 - "release_tag"
Cohesion: 0.20
Nodes (10): release_tag, branches, default, description, required, type, True, pull_request (+2 more)

### Community 81 - "I6-D — Verificación de accesibilidad"
Cohesion: 0.33
Nodes (5): 1. Qué se midió y cómo, 2. Matriz de lectores de pantalla y dispositivos, 3. Hallazgos candidatos (sin convertir en defecto), 4. Cómo repetir las mediciones, I6-D — Verificación de accesibilidad

### Community 82 - "steps"
Cohesion: 0.39
Nodes (9): steps, steps, steps, steps, if, name, run, shell (+1 more)

### Community 83 - "with"
Cohesion: 0.12
Nodes (16): with, driver-opts, fetch-depth, if-no-files-found, name, node-version, password, path (+8 more)

### Community 84 - "with"
Cohesion: 0.25
Nodes (8): with, if-no-files-found, name, node-version, path, persist-credentials, ref, retention-days

### Community 85 - "publish"
Cohesion: 0.17
Nodes (11): concurrency, cancel-in-progress, group, jobs, publish, name, if, name (+3 more)

### Community 86 - "steps"
Cohesion: 0.40
Nodes (10): steps, steps, steps, steps, id, if, name, run (+2 more)

### Community 87 - "ligeras"
Cohesion: 0.29
Nodes (7): ligeras, name, runs-on, strategy, node, fail-fast, matrix

### Community 88 - "ref_node_url"
Cohesion: 0.15
Nodes (8): evidencia(), artefactos, bin, id, listar(), M, root, SOLUCIONARIOS

### Community 89 - "labels"
Cohesion: 0.29
Nodes (7): context, dockerfile, labels, org.opencontainers.image.revision, org.opencontainers.image.source, org.opencontainers.image.version, build

### Community 90 - "validar.mjs"
Cohesion: 0.26
Nodes (19): ajustesPreguntas(), ajustesSala(), CODIGO, crearSala(), definicionEncuesta(), DURACIONES_VOTACION, ErrorValidacion, falla() (+11 more)

### Community 91 - "navegador"
Cohesion: 0.33
Nodes (6): CHROME_PATH, PAGES_BASE, navegador, env, name, runs-on

### Community 92 - "http.mjs"
Cohesion: 0.21
Nodes (15): COOKIE_DOCENTE, cookieDocente(), leerCookies(), crearManejadorHttp(), servirArchivo(), CSP, enviar(), leerJson() (+7 more)

### Community 93 - "env"
Cohesion: 0.22
Nodes (9): ADMIN_PASSWORD_HASH, APP_HOST, APP_URL, LIVE_REVISION, RELEASE_TAG, SESSION_SECRET, SYNTHETIC_SECRET, TESTED_SHA (+1 more)

### Community 94 - "docker-compose.gitops.yml"
Cohesion: 0.33
Nodes (5): name, networks, web, services, external

### Community 95 - "healthcheck"
Cohesion: 0.33
Nodes (6): interval, retries, start_period, test, timeout, healthcheck

### Community 96 - "Promoción manual de OpenClass Live 0.3.0"
Cohesion: 0.22
Nodes (9): 0. Alcance y estados, 1. Identidad y autoridad efectiva (propietario, VPS, Bash), 2. Ventana sin clase y respaldo privado, 3. Transferencia manual y verificación, 4. Extracción controlada y construcción, 5. Configuración efectiva sin regenerar secretos, 6. Promoción y verificación inmediata, 7. Rollback real si falla cualquier validación (+1 more)

### Community 97 - "env"
Cohesion: 0.40
Nodes (5): CONTENIDO, ESPERADO, OPENCLASS_EVIDENCIA, SALIDA, env

### Community 99 - "options"
Cohesion: 0.40
Nodes (5): driver, options, logging, max-file, max-size

### Community 100 - "procedencia-autosync.mjs"
Cohesion: 0.35
Nodes (11): composePorDigest(), digest(), imageRepository, repository, validarLock(), verificarAutoridad(), verificarOci(), base (+3 more)

### Community 101 - "stable-startup"
Cohesion: 0.50
Nodes (4): stable-startup, name, runs-on, timeout-minutes

### Community 102 - "checks"
Cohesion: 0.33
Nodes (6): name, outputs, runs-on, timeout-minutes, checks, sha

### Community 103 - "ref_node_url"
Cohesion: 0.15
Nodes (8): args, dist, r, raiz, hash, plantilla, raiz, salida

### Community 104 - "OpenClass Live — protocolo Socket.IO"
Cohesion: 0.25
Nodes (7): Build Tech (puente local, no es parte de este protocolo), Espacio `/docente` (panel y presentación local), Espacio `/participante` (estudiantes), HTTP, Negociación de versión (v0.2), OpenClass Live — protocolo Socket.IO, Tiempo de votación

### Community 106 - "I6-C — Verificación de las hipótesis H01–H08"
Cohesion: 0.18
Nodes (10): Decisiones que requieren autorización adicional, H01 — Regiones ARIA durante una votación, H02 — Sesión vencida y revocación entre pestañas, H03 — Privacidad de preguntas pendientes, H04 — Reflow a 320 CSS px y zoom al 400 %, H05 — Contraste de componentes, H06 — Espacios disponibles para el QR en Reveal.js, H07 — Retiro accidental de resultados (+2 more)

### Community 107 - "build"
Cohesion: 0.25
Nodes (8): if, name, needs, outputs, runs-on, timeout-minutes, build, manifest_digest

### Community 108 - "permissions"
Cohesion: 0.25
Nodes (8): permissions, permissions, permissions, attestations, contents, id-token, packages, permissions

### Community 109 - "approval"
Cohesion: 0.29
Nodes (7): environment, if, name, needs, permissions, runs-on, approval

### Community 110 - "GitOps de OpenClass Live: preparación local, promoción manual"
Cohesion: 0.25
Nodes (8): Bloqueo de auto-sync por procedencia, Definición que usará Dockhand, Dockhand 1.0.33: actualización previa y cambio controlado, Estado y alcance, Fuente aprobada y CI, GitOps de OpenClass Live: preparación local, promoción manual, Si el stack actual es Internal, Variables y secretos: conservar la instalación existente

### Community 111 - "Promoción manual de OpenClass Live 0.2.0"
Cohesion: 0.22
Nodes (8): 1. Identidad y autoridad efectiva (propietario, VPS, Bash), 2. Ventana sin clase y respaldo privado, 3. Transferencia manual y verificación, 4. Extracción controlada y construcción, 5. Configuración efectiva sin regenerar secretos, 6. Promoción y verificación inmediata, 7. Rollback real si falla cualquier validación, Promoción manual de OpenClass Live 0.2.0

### Community 112 - "Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada)"
Cohesion: 0.29
Nodes (6): Cadena en `.github/workflows/openclass-live.yml`, Identidad del candidato, Pendiente en GitHub (no simulado), Pruebas locales, Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada), `release-lock.json`

### Community 113 - "Marca: clasificación y condición de publicación (OpenClass Live 0.3.0)"
Cohesion: 0.33
Nodes (5): Clasificación, Decisión humana pendiente, Historial local, Marca: clasificación y condición de publicación (OpenClass Live 0.3.0), Metadatos internos

### Community 114 - "salas.mjs"
Cohesion: 0.33
Nodes (3): LIMITES_SALA, ALFABETO_CODIGO, DURACION_PREDETERMINADA

### Community 115 - "Hotfix v0.1 — sin filtración del acierto antes de revelar"
Cohesion: 0.40
Nodes (4): Aplicación (cuando se autorice), Defecto, Hotfix v0.1 — sin filtración del acierto antes de revelar, Verificación hecha (2026-10-26)

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `publicacion-ci.mjs` to `procedencia-autosync.mjs`, `Manual del creador de OpenClass UNIMINUTO Reveal.js`, `Procedencia GitOps de Live: decisión y contrato de promoción`, `vite.config.mjs`, `Guía del docente — Crear OpenClass UNIMINUTO Reveal.js`, `GitOps de OpenClass Live: preparación local, promoción manual`, `Promoción manual de OpenClass Live 0.2.0`, `OpenClass master: minimal AI context`, `OpenClass Suite — Documento maestro de producto, requisitos y evolución`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `montarBuildTech()` (e.g. with `sincronizarPrevias()` and `tictac()`) actually correct?**
  _`montarBuildTech()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `codigoSala()` connect `http.mjs` to `OpenClass Live — protocolo Socket.IO`, `validar.mjs`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `OpenClassLive()` (e.g. with `estadoBuildTech()` and `ordenBuildTech()`) actually correct?**
  _`OpenClassLive()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `template/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.10333333333333333 - nodes in this community are weakly interconnected._