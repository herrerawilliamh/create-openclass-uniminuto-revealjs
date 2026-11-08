# Graph Report - openclass-vnext  (2026-11-08)

## Corpus Check
- 134 files · ~148,206 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 24 file(s) not represented in the graph (top: (none) 10, .css 9, .example 1)

## Summary
- 1628 nodes · 2874 edges · 98 communities (92 shown, 6 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 101 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f5eb8d9a`
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
- live-navegador.test.mjs
- verificar-gitops.mjs
- validar.mjs
- openclass-live/README.md
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
- ref_node_fs
- openclass-live
- docente.mjs
- openclass-live/package.json
- app.js
- scripts
- environment
- multimedia.mjs
- autoPaginar.mjs
- ref_node_child_process
- empaquetar-despliegue.mjs
- openclass-live
- index.mjs
- build-site.mjs
- ref_node_assert
- ref_node_child_process
- estudiante.mjs
- environment
- docker-compose.yml
- healthcheck
- release_tag
- options
- build
- steps
- crearAlmacen
- with
- I6-C — Verificación de las hipótesis H01–H08
- with
- ref_node_fs
- openclass-live.yml
- steps
- notas.mjs
- ligeras
- labels
- Recorrido A · Docente con curso Reveal.js preparado
- navegador
- approved
- env
- docker-compose.gitops.yml
- healthcheck
- env
- options
- main.jsx
- stable-startup
- checks
- seguir
- OpenClass Live — guía para la clase
- I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos
- GitOps de OpenClass Live: preparación local, promoción manual
- Promoción manual de OpenClass Live 0.2.0
- OpenClass Live
- Recorrido B · Docente sin curso Reveal.js preparado
- I6-D — Verificación de accesibilidad
- Notas de decisión técnica — Teacher Experience VNext
- publicacion-seguridad.test.mjs
- envio.mjs

## God Nodes (most connected - your core abstractions)
1. `montarBuildTech()` - 46 edges
2. `OpenClassLive()` - 42 edges
3. `abrirNavegador()` - 27 edges
4. `crearApp()` - 25 edges
5. `OpenClassBuildTech()` - 24 edges
6. `TEMÁTICA DE PRUEBA` - 24 edges
7. `openclass-live` - 23 edges
8. `openclass-live` - 22 edges
9. `leerConfig()` - 22 edges
10. `crearSockets()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs
- `Negociación de versión (v0.2)` --references--> `cerrar()`  [INFERRED]
  services/openclass-live/docs/PROTOCOLO.md → scripts/lib/chrome.mjs
- `OpenClass Live (in development, not in the npm package)` --references--> `terminarSesion()`  [INFERRED]
  docs/AI-CONTEXT.md → services/openclass-live/public/assets/docente.mjs
- `OpenClass Live (in development, not in the npm package)` --references--> `dejarSala()`  [INFERRED]
  docs/AI-CONTEXT.md → services/openclass-live/public/assets/docente.mjs
- `Build Tech and PDF export (template, branch feat/openclass-live-teacher-ux-v0.2, uncommitted)` --references--> `extraerEncuesta()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/encuesta.mjs

## Import Cycles
- None detected.

## Communities (98 total, 6 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "ayuda.mjs"
Cohesion: 0.16
Nodes (19): esperar(), evento(), iniciar(), pedir(), PRESENTADOR, rechazo(), V2, contarEstados() (+11 more)

### Community 3 - "template/package.json"
Cohesion: 0.09
Nodes (29): chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react-dom, reveal.js, @revealjs/react, vite (+21 more)

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

### Community 26 - "live-navegador.test.mjs"
Cohesion: 0.25
Nodes (4): MARCADORES, npm(), prepararCurso(), RAIZ

### Community 27 - "verificar-gitops.mjs"
Cohesion: 0.18
Nodes (12): actual, archive, base, expected, json(), lock, pkg, read() (+4 more)

### Community 28 - "validar.mjs"
Cohesion: 0.06
Nodes (59): Corrección de seguridad H02 — sockets del panel con sesión cerrada o vencida, H02 — corrección final: autorización por destinatario (hallazgo P1 de Codex), H02 — corrección P1 de Codex: vencimiento efectivo (cookie frente a SID), base, COOKIE_DOCENTE, cookieDocente(), leerCookies(), panelVigente() (+51 more)

### Community 29 - "openclass-live/README.md"
Cohesion: 0.22
Nodes (4): OpenClass Live — preparación para una futura Zoom App, Principios que deben mantenerse, Qué faltaría, Qué se puede reutilizar

### Community 31 - "Presentacion.jsx"
Cohesion: 0.17
Nodes (10): auditarOverflow(), ajustarTextos(), AJUSTES, escribirCurso(), FIJAS, numeroDiapositiva(), Presentacion(), PREVIA (+2 more)

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "vite.config.mjs"
Cohesion: 0.06
Nodes (29): Architecture and key files, Checks and graph maintenance, Distribution decision (2026-10-21, confirmed by the user), Generation routes, Institutional and scope constraints, OpenClass master: minimal AI context, Publication state (2026-10-21), Start here (+21 more)

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

### Community 42 - "ref_node_fs"
Cohesion: 0.08
Nodes (22): capturas, miniaturas, raiz, CANDIDATOS, rutaChrome(), enviar(), servir(), TIPOS (+14 more)

### Community 43 - "openclass-live"
Cohesion: 0.11
Nodes (19): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+11 more)

### Community 44 - "docente.mjs"
Cohesion: 0.14
Nodes (33): I2 — Recuperación y confiabilidad del panel (OC-A01, OC-A06, OC-A10, O-01, O-09), Tabla de trazabilidad (pantalla → HTML → CSS → JS → pruebas), barras(), comparar(), crearCuenta(), el(), ESTADOS, esTransitorio() (+25 more)

### Community 45 - "openclass-live/package.json"
Cohesion: 0.08
Nodes (27): qrcode-generator, socket.io, author, dependencies, qrcode-generator@2.0.4, socket.io@4.8.4, description, devDependencies (+19 more)

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

### Community 50 - "autoPaginar.mjs"
Cohesion: 0.57
Nodes (6): coste(), paginarMarkdown(), paginasCodigo(), paginasTexto(), separarDiapositivas(), sinId()

### Community 51 - "ref_node_child_process"
Cohesion: 0.13
Nodes (14): compilar(), crearCurso(), DIAPOSITIVAS, npm(), RAIZ, recompilar(), YOUTUBE_ID, NOTAS_PRIVADAS (+6 more)

### Community 52 - "empaquetar-despliegue.mjs"
Cohesion: 0.14
Nodes (12): ARCHIVOS, carpeta, lista, lock, r, raiz, salida, sinEnlaces() (+4 more)

### Community 53 - "openclass-live"
Cohesion: 0.11
Nodes (18): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+10 more)

### Community 54 - "index.mjs"
Cohesion: 0.12
Nodes (14): OpenClassCodigo(), puedeMover(), TECLAS, cargarFase2(), FASE2, LIVE, cargarCss(), cargarPlugins() (+6 more)

### Community 55 - "build-site.mjs"
Cohesion: 0.09
Nodes (25): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+17 more)

### Community 56 - "ref_node_assert"
Cohesion: 0.10
Nodes (33): socket.io-client, abrirNavegador(), crearApp(), crearLog(), PUBLICO, b64(), crearFirmador(), crearSesiones() (+25 more)

### Community 57 - "ref_node_child_process"
Cohesion: 0.13
Nodes (11): bin, root, capitulo(), leer(), root, texto(), bin, curso() (+3 more)

### Community 58 - "estudiante.mjs"
Cohesion: 0.17
Nodes (24): enviar(), aviso(), borrar(), CLAVE(), conexion(), cuenta, descartarPregunta(), enlazar() (+16 more)

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

### Community 68 - "I6-C — Verificación de las hipótesis H01–H08"
Cohesion: 0.18
Nodes (10): Decisiones que requieren autorización adicional, H01 — Regiones ARIA durante una votación, H02 — Sesión vencida y revocación entre pestañas, H03 — Privacidad de preguntas pendientes, H04 — Reflow a 320 CSS px y zoom al 400 %, H05 — Contraste de componentes, H06 — Espacios disponibles para el QR en Reveal.js, H07 — Retiro accidental de resultados (+2 more)

### Community 69 - "with"
Cohesion: 0.25
Nodes (8): with, if-no-files-found, name, node-version, path, persist-credentials, ref, retention-days

### Community 70 - "ref_node_fs"
Cohesion: 0.09
Nodes (16): args, dist, r, raiz, HOST_ESCUCHA, ORIGEN_PRESENTADOR, PUERTO, start() (+8 more)

### Community 71 - "openclass-live.yml"
Cohesion: 0.25
Nodes (7): concurrency, cancel-in-progress, group, jobs, name, permissions, contents

### Community 72 - "steps"
Cohesion: 0.29
Nodes (8): steps, steps, id, if, name, run, shell, uses

### Community 73 - "notas.mjs"
Cohesion: 0.43
Nodes (7): ACCIONES_NOTA, bloque(), EN_LINEA, marcadorDe(), notasSeguras(), recorrer(), segmentos()

### Community 74 - "ligeras"
Cohesion: 0.29
Nodes (7): ligeras, name, runs-on, strategy, node, fail-fast, matrix

### Community 75 - "labels"
Cohesion: 0.29
Nodes (7): context, dockerfile, labels, org.opencontainers.image.revision, org.opencontainers.image.source, org.opencontainers.image.version, build

### Community 76 - "Recorrido A · Docente con curso Reveal.js preparado"
Cohesion: 0.20
Nodes (10): A1. Acceder al panel, A2. Crear la sala, A3. Compartir el QR o el código, A4. Conectar la presentación con su clave, A5. Iniciar la votación, A6. Cerrar, publicar resultados, discutir y repetir, A7. Revelar la explicación, A8. Finalizar la sesión (+2 more)

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

### Community 84 - "main.jsx"
Cohesion: 0.25
Nodes (7): react, react@^19.2.0, el, Portal(), RECORRIDOS, recursos(), slug()

### Community 85 - "stable-startup"
Cohesion: 0.50
Nodes (4): stable-startup, name, runs-on, timeout-minutes

### Community 86 - "checks"
Cohesion: 0.50
Nodes (4): name, runs-on, timeout-minutes, checks

### Community 87 - "seguir"
Cohesion: 0.21
Nodes (23): Relación encuesta → navegación → preguntas → compartir → cierre, aviso(), avisoSala(), conectar(), dejarSala(), emitir(), filaOpcion(), guardarEncuesta() (+15 more)

### Community 88 - "OpenClass Live — guía para la clase"
Cohesion: 0.22
Nodes (9): Build Tech: dirigir la clase desde el segundo monitor, Elija su recorrido, Exportar a PDF, OpenClass Live — guía para la clase, Qué hace cada persona, Salir, revocar claves y finalizar, Si se pierde la conexión, Teclado y accesibilidad (+1 more)

### Community 89 - "I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos"
Cohesion: 0.25
Nodes (7): Estado, Guion de tareas, I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos, Perfil de la persona evaluada, Preparación (la hace otra persona, no quien evalúa), Qué observar, Registro (completar al ejecutar la prueba)

### Community 90 - "GitOps de OpenClass Live: preparación local, promoción manual"
Cohesion: 0.25
Nodes (8): Bloqueo de auto-sync por procedencia, Definición que usará Dockhand, Dockhand 1.0.33: actualización previa y cambio controlado, Estado y alcance, Fuente aprobada y CI, GitOps de OpenClass Live: preparación local, promoción manual, Si el stack actual es Internal, Variables y secretos: conservar la instalación existente

### Community 91 - "Promoción manual de OpenClass Live 0.2.0"
Cohesion: 0.25
Nodes (8): 1. Identidad y autoridad efectiva (propietario, VPS, Bash), 2. Ventana sin clase y respaldo privado, 3. Transferencia manual y verificación, 4. Extracción controlada y construcción, 5. Configuración efectiva sin regenerar secretos, 6. Promoción y verificación inmediata, 7. Rollback real si falla cualquier validación, Promoción manual de OpenClass Live 0.2.0

### Community 92 - "OpenClass Live"
Cohesion: 0.25
Nodes (8): Arquitectura, Desarrollo y pruebas locales, Despliegue en la VPS (WillEdTech), OpenClass Live, Preparación y promoción de v0.2.0, Privacidad y límites conocidos, Seguridad: resumen, Variables de entorno

### Community 93 - "Recorrido B · Docente sin curso Reveal.js preparado"
Cohesion: 0.29
Nodes (7): B1. Acceder al panel, B2. Crear la sala, B3. Compartir el enlace, B4. Crear preguntas improvisadas, B5. Realizar votaciones y moderar preguntas, B6. Terminar la clase, Recorrido B · Docente sin curso Reveal.js preparado

### Community 94 - "I6-D — Verificación de accesibilidad"
Cohesion: 0.33
Nodes (5): 1. Qué se midió y cómo, 2. Matriz de lectores de pantalla y dispositivos, 3. Hallazgos candidatos (sin convertir en defecto), 4. Cómo repetir las mediciones, I6-D — Verificación de accesibilidad

### Community 95 - "Notas de decisión técnica — Teacher Experience VNext"
Cohesion: 0.15
Nodes (12): I0 — `preparacion-release.test.mjs:29` (commit 8b02f6e), I1 — OC-A02 atomicidad de encuestas (commit eebdc33), I3 — Foco, navegación y accesibilidad (OC-A03, OC-A04, OC-A07, O-02), I4 — Teacher Experience VNext (rediseño visual y de experiencia del panel docente), I4 — Trazabilidad Graphify del panel docente (cierre documental), I5 — Experiencia del estudiante (acuses, pestañas, selección), I6 — Cierre: guía docente, capturas, hipótesis, accesibilidad y aceptación, Limitaciones reales (+4 more)

### Community 96 - "publicacion-seguridad.test.mjs"
Cohesion: 0.11
Nodes (12): hash, plantilla, raiz, salida, evidencia(), artefactos, bin, id (+4 more)

### Community 97 - "envio.mjs"
Cohesion: 0.36
Nodes (6): buscarPregunta(), mismas(), MS_ACUSE, ordenadas(), resolverVoto(), resolverIncertidumbre()

## Knowledge Gaps
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `codigoSala()` connect `validar.mjs` to `vite.config.mjs`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `montarBuildTech()` (e.g. with `sincronizarPrevias()` and `tictac()`) actually correct?**
  _`montarBuildTech()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `Espacio `/participante` (estudiantes)` connect `vite.config.mjs` to `validar.mjs`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `OpenClassLive()` (e.g. with `estadoBuildTech()` and `ordenBuildTech()`) actually correct?**
  _`OpenClassLive()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Should `template/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08735632183908046 - nodes in this community are weakly interconnected._