# Graph Report - create-openclass-uniminuto-revealjs  (2026-11-10)

## Corpus Check
- 194 files · ~216,823 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 27 file(s) not represented in the graph (top: .css 12, (none) 10, .example 1)

## Summary
- 2446 nodes · 4340 edges · 151 communities (143 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 129 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1fcb03f5`
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
- validar.mjs
- vite.config.mjs
- Guía del docente — Crear OpenClass UNIMINUTO Reveal.js
- TEMÁTICA DE PRUEBA
- respaldo-restauracion.test.mjs
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
- integracion.test.mjs
- estudiante.mjs
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
- el
- docente.mjs
- openclass-live/package.json
- app.js
- scripts
- environment
- multimedia.mjs
- ref_node_path
- ref_node_child_process
- main.jsx
- openclass-live
- index.mjs
- cuentas.mjs
- ref_node_assert
- crearAlmacen
- Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0)
- live-navegador.test.mjs
- docker-compose.yml
- healthcheck
- OpenClass Suite — Documento maestro de producto, requisitos y evolución
- options
- verificar-gitops.mjs
- notas.mjs
- ref_node_url
- ref_node_crypto
- Recorrido A · Docente con curso Reveal.js preparado
- OpenClass Live
- Interact by WillEdTech — guía para la clase
- Procedencia GitOps de Live: decisión y contrato de promoción
- openclass-live/README.md
- stable-startup.test.mjs
- el
- I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos
- Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72)
- openclass-live
- I6-C — Verificación de las hipótesis H01–H08
- environment
- release_tag
- I6-D — Verificación de accesibilidad
- steps
- with
- with
- publish
- steps
- ligeras
- http.mjs
- labels
- crearSockets
- navegador
- Recorrido B · Docente sin curso Reveal.js preparado
- env
- docker-compose.gitops.yml
- healthcheck
- Promoción manual de OpenClass Live 0.3.0
- env
- publicar.mjs
- options
- preparar-roles.mjs
- stable-startup
- checks
- Interact 0.4.0 · Cierre de la migración a PostgreSQL (para auditoría Codex)
- Evidencias de cierre — Interact 0.4.0
- VNEXT-FUTURO.md
- postgresql.test.mjs
- build
- galeria.mjs
- approval
- interact-respaldo
- p2-auditoria.test.mjs
- navegador.test.mjs
- Marca: clasificación y condición de publicación (OpenClass Live 0.3.0)
- Manual del creador de OpenClass UNIMINUTO Reveal.js
- interact-migrar
- Promoción manual de OpenClass Live 0.2.0
- interact-migrar
- Notas de decisión técnica — Teacher Experience VNext
- interact-db
- Interact by WillEdTech 0.4.0 — identidades, invitaciones e historial
- Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada)
- cuenta.mjs
- db.mjs
- interact-db
- interact-db-preparar
- interact-db-preparar
- app.mjs
- postgres
- correo.mjs
- interact-db
- environment
- interact-db
- environment
- Interact · PostgreSQL (operación)
- Interact · Respaldo, restauración, RPO/RTO y PITR
- publicacion-seguridad.test.mjs
- docker-redes.test.mjs
- procedencia-autosync.mjs
- interact-db-preparar-administrado
- interact-migrar-administrado
- interact-db-preparar-administrado
- interact-migrar-administrado
- environment
- environment
- Interact · Confianza de proxy y red de entrada dedicada
- ref_node_assert
- protocolo-navegador.test.mjs
- workflow-yaml.mjs
- salas.mjs

## God Nodes (most connected - your core abstractions)
1. `montarBuildTech()` - 46 edges
2. `OpenClassLive()` - 46 edges
3. `abrirNavegador()` - 31 edges
4. `leerConfig()` - 29 edges
5. `openclass-live` - 25 edges
6. `environment` - 25 edges
7. `environment` - 25 edges
8. `openclass-live` - 24 edges
9. `OpenClassBuildTech()` - 24 edges
10. `TEMÁTICA DE PRUEBA` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Publication state (2026-10-21)` --references--> `main()`  [INFERRED]
  docs/AI-CONTEXT.md → services/openclass-live/scripts/publicacion-ci.mjs
- `Integración continua y publicación` --references--> `main()`  [INFERRED]
  docs/GUIA-DEL-CREADOR.md → services/openclass-live/scripts/publicacion-ci.mjs
- `0.1 Niveles de certeza` --references--> `main()`  [INFERRED]
  docs/OPENCLASS_REQUERIMIENTOS_MAESTROS.md → services/openclass-live/scripts/publicacion-ci.mjs
- `Compilar y publicar` --references--> `main()`  [INFERRED]
  template/README.md → services/openclass-live/scripts/publicacion-ci.mjs
- `Architecture and key files` --references--> `puedeMover()`  [INFERRED]
  docs/AI-CONTEXT.md → template/src/plugins/codigo.mjs

## Import Cycles
- None detected.

## Communities (151 total, 8 thin omitted)

### Community 0 - "generar-desde-config.mjs"
Cohesion: 0.11
Nodes (13): active, args, config, configPath, dryRun, erroresApertura(), forceWeek, invalidas (+5 more)

### Community 1 - "create-openclass-uniminuto-revealjs.mjs"
Cohesion: 0.10
Nodes (19): applyAssets(), ASSET_EXT, cfg, cfgPath, copy(), fail(), flags, gen (+11 more)

### Community 2 - "Pagina"
Cohesion: 0.11
Nodes (13): cerrar(), Conexion, esperar(), Pagina, Build Tech (puente local, no es parte de este protocolo), Espacio `/docente` (panel y presentación local), Espacio `/participante` (estudiantes), HTTP (+5 more)

### Community 3 - "template/package.json"
Cohesion: 0.10
Nodes (25): chart.js, @fontsource/atkinson-hyperlegible, @fontsource/merriweather-sans, mermaid, react-dom, reveal.js, @revealjs/react, dependencies (+17 more)

### Community 4 - "semana.mjs"
Cohesion: 0.12
Nodes (17): activity, args, byNumber, config, date, duration, fail(), forceContent (+9 more)

### Community 5 - "portada-pedagogica.test.mjs"
Cohesion: 0.05
Nodes (40): ACCESO, actividadDigital(), alternativa(), bin, CANALES, COLA, conEnlaces(), configurar() (+32 more)

### Community 6 - "scripts"
Cohesion: 0.05
Nodes (38): author, bin, create-openclass-uniminuto-revealjs, bugs, url, description, engines, node (+30 more)

### Community 7 - "validar.mjs"
Cohesion: 0.25
Nodes (20): ajustesPreguntas(), ajustesSala(), CODIGO, codigoSala(), crearSala(), definicionEncuesta(), DURACIONES_VOTACION, ErrorValidacion (+12 more)

### Community 8 - "vite.config.mjs"
Cohesion: 0.15
Nodes (13): Architecture and key files, vite, @vitejs/plugin-react, devDependencies, vite@^7.1.12, @vitejs/plugin-react@^5.0.0, activas(), CONFIG (+5 more)

### Community 9 - "Guía del docente — Crear OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.08
Nodes (22): 10. Actualizar el curso, 11. Problemas frecuentes, 12. Futuras funciones en vivo, 1. Flujo de trabajo, 2. Crear una semana, 2b. Diseñar la semana, 3. Estructura de una diapositiva, 4. Los 13 layouts (+14 more)

### Community 10 - "TEMÁTICA DE PRUEBA"
Cohesion: 0.08
Nodes (24): Actividad mediante iframe, Actividad práctica, Código desplazable (scroll), Código fuente, Código paginado, Diagrama Mermaid, Dos columnas, Dos títulos (+16 more)

### Community 11 - "respaldo-restauracion.test.mjs"
Cohesion: 0.25
Nodes (16): binario(), ejecutar(), entornoPg(), versionMayor(), existe(), limpiar(), respaldar(), DESTINO_SEGURO (+8 more)

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

### Community 28 - "integracion.test.mjs"
Cohesion: 0.13
Nodes (25): esperar(), evento(), HASH, iniciar(), ORIGEN, PASSWORD, pedir(), PRESENTADOR (+17 more)

### Community 29 - "estudiante.mjs"
Cohesion: 0.11
Nodes (34): crearCuenta(), MENSAJES_ERROR, buscarPregunta(), enviar(), mismas(), MS_ACUSE, ordenadas(), resolverVoto() (+26 more)

### Community 31 - "Presentacion.jsx"
Cohesion: 0.15
Nodes (16): auditarOverflow(), coste(), paginarMarkdown(), paginasCodigo(), paginasTexto(), separarDiapositivas(), sinId(), ajustarTextos() (+8 more)

### Community 32 - "Microactividad interactiva (5–10 minutos)"
Cohesion: 0.50
Nodes (3): Alternativas, Cambiar el tema, Microactividad interactiva (5–10 minutos)

### Community 35 - "publicacion-ci.mjs"
Cohesion: 0.15
Nodes (21): 1. Estado inicial y evidencia (2026-10-30), arg(), auditarEstructura(), auditarWorkflow(), blobsDe(), bytesPublicables(), comandosNormalizados(), composeCandidato() (+13 more)

### Community 36 - "OpenClassBuildTech"
Cohesion: 0.23
Nodes (19): Build Tech and PDF export (template, branch feat/openclass-live-teacher-ux-v0.2, uncommitted), OpenClassBuildTech(), abrirBuildTech(), abrirSelector(), alMensaje(), alternarRelojPublico(), cerrarSelector(), ejecutar() (+11 more)

### Community 37 - "OpenClassLive"
Cohesion: 0.09
Nodes (64): OpenClass Live (in development, not in the npm package), extraerEncuesta(), firmaEncuesta(), normal(), separarSolucion(), textoDe(), DURACIONES, el() (+56 more)

### Community 38 - "portal-academico.test.mjs"
Cohesion: 0.09
Nodes (20): capitulo(), leer(), root, texto(), archivos(), config(), construir(), manifiesto (+12 more)

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
Nodes (19): cfg, cfgRuta, curso, datos, esc(), html, pkg, raiz (+11 more)

### Community 43 - "el"
Cohesion: 0.23
Nodes (20): Tabla de trazabilidad (pantalla → HTML → CSS → JS → pruebas), barras(), comparar(), el(), enfocable(), formatoTiempo(), letra(), refrescarBarras() (+12 more)

### Community 44 - "docente.mjs"
Cohesion: 0.15
Nodes (35): Relación encuesta → navegación → preguntas → compartir → cierre, ESTADOS, accion(), api(), aviso(), avisoSala(), conectar(), configurarLogin() (+27 more)

### Community 45 - "openclass-live/package.json"
Cohesion: 0.06
Nodes (35): qrcode-generator, socket.io, yaml, author, dependencies, pg@8.23.1, qrcode-generator@2.0.4, socket.io@4.8.4 (+27 more)

### Community 46 - "app.js"
Cohesion: 0.53
Nodes (4): comprobar(), dibujar(), estado(), progreso()

### Community 47 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build:all, config, demo, dev, general, laboratorio, pages:build (+5 more)

### Community 48 - "environment"
Cohesion: 0.09
Nodes (22): ADMIN_PASSWORD_HASH, APP_URL, DATABASE_URL, DB_MIGRATIONS, DB_POOL_MAX, MAIL_FROM, MAIL_TRANSPORT, MAX_ROOM_PARTICIPANTS (+14 more)

### Community 49 - "multimedia.mjs"
Cohesion: 0.23
Nodes (15): avisar(), apiYoutube(), crearMultimedia(), describir(), ejecutar(), enlazar(), enlazarHtml5(), enlazarYoutube() (+7 more)

### Community 50 - "ref_node_path"
Cohesion: 0.13
Nodes (13): enviar(), servir(), TIPOS, ADMIN, npm(), prepararCurso(), RAIZ, config (+5 more)

### Community 51 - "ref_node_child_process"
Cohesion: 0.13
Nodes (14): compilar(), crearCurso(), DIAPOSITIVAS, npm(), RAIZ, recompilar(), YOUTUBE_ID, NOTAS_PRIVADAS (+6 more)

### Community 52 - "main.jsx"
Cohesion: 0.29
Nodes (6): react, el, Portal(), RECORRIDOS, recursos(), slug()

### Community 53 - "openclass-live"
Cohesion: 0.09
Nodes (22): context, dockerfile, build, cap_drop, container_name, cpus, expose, image (+14 more)

### Community 54 - "index.mjs"
Cohesion: 0.12
Nodes (14): OpenClassCodigo(), puedeMover(), TECLAS, cargarFase2(), FASE2, LIVE, cargarCss(), cargarPlugins() (+6 more)

### Community 55 - "cuentas.mjs"
Cohesion: 0.12
Nodes (18): email, crearCuentas(), consumir(), emitirToken(), inspeccionar(), EMAIL_HEREDADO, ErrorCuenta, falla() (+10 more)

### Community 56 - "ref_node_assert"
Cohesion: 0.11
Nodes (30): abrirNavegador(), CANDIDATOS, rutaChrome(), b64(), crearSesiones(), hashPassword(), memoria(), SCRYPT (+22 more)

### Community 57 - "crearAlmacen"
Cohesion: 0.13
Nodes (22): Aplicación (cuando se autorice), Defecto, Hotfix v0.1 — sin filtración del acierto antes de revelar, Parche, Verificación hecha (2026-10-26), crearAlmacen(), cerrarRonda(), eliminar() (+14 more)

### Community 58 - "Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0)"
Cohesion: 0.40
Nodes (4): Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0), Identidad oficial (decisión del propietario), Pendiente (no se improvisó), Qué cambia

### Community 59 - "live-navegador.test.mjs"
Cohesion: 0.25
Nodes (4): MARCADORES, npm(), prepararCurso(), RAIZ

### Community 60 - "docker-compose.yml"
Cohesion: 0.33
Nodes (6): internal, networks, interact-db, interact-salida, web, external

### Community 61 - "healthcheck"
Cohesion: 0.48
Nodes (7): interval, retries, start_period, test, timeout, healthcheck, healthcheck

### Community 62 - "OpenClass Suite — Documento maestro de producto, requisitos y evolución"
Cohesion: 0.08
Nodes (23): 0.1 Niveles de certeza, 0.2 Terminología, 0. Propósito y visión, 10. Decisiones y alternativas técnicas, 11. Plan incremental y criterios de salida, 12. Matriz transversal de compatibilidad y pruebas, 13.1 Decisiones propuestas (NO aprobadas por el propietario), 13. Preguntas abiertas que NO bloquean el inventario (+15 more)

### Community 63 - "options"
Cohesion: 0.17
Nodes (16): logging, logging, logging, logging, logging, driver, options, logging (+8 more)

### Community 64 - "verificar-gitops.mjs"
Cohesion: 0.05
Nodes (45): ADR-0001 · PostgreSQL como motor definitivo de persistencia de Interact, Atomicidad, Consecuencias, Contexto, Decisión, Límites de la implementación actual, Modelo de datos, Riesgos de la migración (+37 more)

### Community 65 - "notas.mjs"
Cohesion: 0.43
Nodes (7): ACCIONES_NOTA, bloque(), EN_LINEA, marcadorDe(), notasSeguras(), recorrer(), segmentos()

### Community 66 - "ref_node_url"
Cohesion: 0.10
Nodes (13): destino, fijarDuracion(), largoVint(), raiz, args, dist, r, raiz (+5 more)

### Community 67 - "ref_node_crypto"
Cohesion: 0.25
Nodes (12): firmarCopia(), generarClaves(), huellaClave(), sha256Archivo(), verificarAutenticidad(), verificarSuma(), ejecutar(), evaluarTap() (+4 more)

### Community 68 - "Recorrido A · Docente con curso Reveal.js preparado"
Cohesion: 0.20
Nodes (10): A1. Acceder al panel, A2. Crear la sala, A3. Compartir el QR o el código, A4. Conectar la presentación con su clave, A5. Iniciar la votación, A6. Cerrar, publicar resultados, discutir y repetir, A7. Revelar la explicación, A8. Finalizar la sesión (+2 more)

### Community 69 - "OpenClass Live"
Cohesion: 0.25
Nodes (8): Arquitectura, Desarrollo y pruebas locales, Despliegue en la VPS (WillEdTech), Interact by WillEdTech, Preparación y promoción de v0.3.0 (sustituye a la 0.2.0, que queda inmutable en `releases/0.2.0.json`), Privacidad y límites conocidos, Seguridad: resumen, Variables de entorno

### Community 70 - "Interact by WillEdTech — guía para la clase"
Cohesion: 0.22
Nodes (9): Build Tech: dirigir la clase desde el segundo monitor, Elija su recorrido, Exportar a PDF, Interact by WillEdTech — guía para la clase, Qué hace cada persona, Salir, revocar claves y finalizar, Si se pierde la conexión, Teclado y accesibilidad (+1 more)

### Community 71 - "Procedencia GitOps de Live: decisión y contrato de promoción"
Cohesion: 0.12
Nodes (15): Decisión al cierre de este trabajo, Diagnóstico y evidencia actual, Gate 1: autoridad y referencias, Gate 2: interacción con el Git stack existente, Gate 3: validación y límites de la evidencia, Procedencia GitOps de Live: decisión y contrato de promoción, Rollback y fallos cerrados, Bloqueo de auto-sync por procedencia (+7 more)

### Community 72 - "openclass-live/README.md"
Cohesion: 0.20
Nodes (4): OpenClass Live — preparación para una futura Zoom App, Principios que deben mantenerse, Qué faltaría, Qué se puede reutilizar

### Community 73 - "stable-startup.test.mjs"
Cohesion: 0.11
Nodes (12): HOST_ESCUCHA, ORIGEN_PRESENTADOR, PUERTO, start(), newer(), valid(), versionNotice(), checks (+4 more)

### Community 74 - "el"
Cohesion: 0.27
Nodes (12): mensajeHttp(), crearPanelCuenta(), cambiarEstado(), cargarAdmin(), cargarHistorial(), consulta(), eliminar(), revocar() (+4 more)

### Community 75 - "I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos"
Cohesion: 0.25
Nodes (7): Estado, Guion de tareas, I6-E — Aceptación pedagógica: guion para una persona docente sin conocimientos técnicos, Perfil de la persona evaluada, Preparación (la hace otra persona, no quien evalúa), Qué observar, Registro (completar al ejecutar la prueba)

### Community 76 - "Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72)"
Cohesion: 0.29
Nodes (6): Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72), Contrato por digest (AUTOSYNC-PROVENANCE.md), Controles requeridos en GitHub (verificables con `gh api`), Evidencia de navegador, Identidad, Rollback

### Community 77 - "openclass-live"
Cohesion: 0.10
Nodes (20): cap_drop, container_name, cpus, expose, image, init, labels, mem_limit (+12 more)

### Community 78 - "I6-C — Verificación de las hipótesis H01–H08"
Cohesion: 0.18
Nodes (10): Decisiones que requieren autorización adicional, H01 — Regiones ARIA durante una votación, H02 — Sesión vencida y revocación entre pestañas, H03 — Privacidad de preguntas pendientes, H04 — Reflow a 320 CSS px y zoom al 400 %, H05 — Contraste de componentes, H06 — Espacios disponibles para el QR en Reveal.js, H07 — Retiro accidental de resultados (+2 more)

### Community 79 - "environment"
Cohesion: 0.09
Nodes (22): ADMIN_PASSWORD_HASH, APP_URL, DATABASE_URL, DB_MIGRATIONS, DB_POOL_MAX, MAIL_FROM, MAIL_TRANSPORT, MAX_ROOM_PARTICIPANTS (+14 more)

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
Cohesion: 0.20
Nodes (10): publish, attestations, id-token, packages, if, name, needs, permissions (+2 more)

### Community 86 - "steps"
Cohesion: 0.40
Nodes (10): steps, steps, steps, steps, id, if, name, run (+2 more)

### Community 87 - "ligeras"
Cohesion: 0.29
Nodes (7): ligeras, name, runs-on, strategy, node, fail-fast, matrix

### Community 88 - "http.mjs"
Cohesion: 0.23
Nodes (13): COOKIE_DOCENTE, cookieDocente(), leerCookies(), crearManejadorHttp(), servirArchivo(), CSP, enviar(), leerJson() (+5 more)

### Community 89 - "labels"
Cohesion: 0.29
Nodes (7): context, dockerfile, labels, org.opencontainers.image.revision, org.opencontainers.image.source, org.opencontainers.image.version, build

### Community 90 - "crearSockets"
Cohesion: 0.13
Nodes (23): Corrección de seguridad H02 — sockets del panel con sesión cerrada o vencida, H02 — corrección final: autorización por destinatario (hallazgo P1 de Codex), H02 — corrección P1 de Codex: vencimiento efectivo (cookie frente a SID), base, panelVigente(), presentadorCompatible(), PROTOCOLO, ErrorSala (+15 more)

### Community 91 - "navegador"
Cohesion: 0.33
Nodes (6): CHROME_PATH, PAGES_BASE, navegador, env, name, runs-on

### Community 92 - "Recorrido B · Docente sin curso Reveal.js preparado"
Cohesion: 0.29
Nodes (7): B1. Acceder al panel, B2. Crear la sala, B3. Compartir el enlace, B4. Crear preguntas improvisadas, B5. Realizar votaciones y moderar preguntas, B6. Terminar la clase, Recorrido B · Docente sin curso Reveal.js preparado

### Community 93 - "env"
Cohesion: 0.11
Nodes (19): ADMIN_PASSWORD_HASH, APP_HOST, APP_URL, BACKUP_HOST_DIR, COMPOSE_PROFILES, DATABASE_ADMIN_URL, DATABASE_BACKUP_URL, DATABASE_MIGRATION_URL (+11 more)

### Community 94 - "docker-compose.gitops.yml"
Cohesion: 0.33
Nodes (6): internal, networks, interact-db, interact-salida, web, external

### Community 95 - "healthcheck"
Cohesion: 0.48
Nodes (7): interval, retries, start_period, test, timeout, healthcheck, healthcheck

### Community 96 - "Promoción manual de OpenClass Live 0.3.0"
Cohesion: 0.22
Nodes (9): 0. Alcance y estados, 1. Identidad y autoridad efectiva (propietario, VPS, Bash), 2. Ventana sin clase y respaldo privado, 3. Transferencia manual y verificación, 4. Extracción controlada y construcción, 5. Configuración efectiva sin regenerar secretos, 6. Promoción y verificación inmediata, 7. Rollback real si falla cualquier validación (+1 more)

### Community 97 - "env"
Cohesion: 0.40
Nodes (5): CONTENIDO, ESPERADO, OPENCLASS_EVIDENCIA, SALIDA, env

### Community 99 - "options"
Cohesion: 0.17
Nodes (16): logging, logging, logging, logging, logging, driver, options, logging (+8 more)

### Community 100 - "preparar-roles.mjs"
Cohesion: 0.29
Nodes (9): pg, conectar(), conectarComo(), DML, NIVELES, opcionesDesdeEntorno(), prepararRoles(), verificarExterno() (+1 more)

### Community 101 - "stable-startup"
Cohesion: 0.50
Nodes (4): stable-startup, name, runs-on, timeout-minutes

### Community 102 - "checks"
Cohesion: 0.20
Nodes (10): env, name, outputs, runs-on, timeout-minutes, INTERACT_TEST_DATABASE_URL, INTERACT_TEST_REQUIRE_PG_TOOLS, PG_BIN (+2 more)

### Community 103 - "Interact 0.4.0 · Cierre de la migración a PostgreSQL (para auditoría Codex)"
Cohesion: 0.40
Nodes (4): Fuera de alcance (deliberado), Interact 0.4.0 · Cierre de la migración a PostgreSQL (para auditoría Codex), Pruebas locales de la entrega PostgreSQL (16.10 real; históricas respecto a las correcciones posteriores, la CI sobre `c296fef` es la referencia vigente), Qué cambió

### Community 104 - "Evidencias de cierre — Interact 0.4.0"
Cohesion: 0.25
Nodes (7): Evidencias de cierre — Interact 0.4.0, Limitaciones conocidas / pendiente, Pruebas ejecutadas con SQLite (Node 22.23.1, Windows, Chrome real) — históricas, Pruebas locales históricas (previas a PostgreSQL), Resultados de CI sobre `c296fef` (GitHub Actions, PR #8), Revisión visual (Chrome, capturas en `INTERACT_CAPTURAS`), Seguridad: qué cubren las pruebas

### Community 106 - "postgresql.test.mjs"
Cohesion: 0.24
Nodes (11): nuevoEsquema(), urlPrueba(), ADMIN, adminPostgres(), baseEnEsquema(), clave(), conUsuario(), enBase() (+3 more)

### Community 107 - "build"
Cohesion: 0.12
Nodes (17): if, name, needs, outputs, permissions, runs-on, timeout-minutes, permissions (+9 more)

### Community 108 - "galeria.mjs"
Cohesion: 0.50
Nodes (8): comparar(), copiar(), crear(), dato(), ejemplo(), lista(), tarjeta(), vista()

### Community 109 - "approval"
Cohesion: 0.29
Nodes (7): environment, if, name, needs, permissions, runs-on, approval

### Community 110 - "interact-respaldo"
Cohesion: 0.05
Nodes (44): context, dockerfile, target, BACKUP_DIR, BACKUP_KEEP, DATABASE_BACKUP_URL, DB_SCHEMA, DB_SSL (+36 more)

### Community 111 - "p2-auditoria.test.mjs"
Cohesion: 0.46
Nodes (5): Revalidación de los P2 del dictamen anterior, crearConfianzaProxy(), ipCliente(), normalizarIp(), BASE

### Community 112 - "navegador.test.mjs"
Cohesion: 0.33
Nodes (4): CLASES, esperar(), IDS, irA()

### Community 113 - "Marca: clasificación y condición de publicación (OpenClass Live 0.3.0)"
Cohesion: 0.33
Nodes (5): Autorización del propietario, Clasificación, Historial, Marca: clasificación y condición de publicación (OpenClass Live 0.3.0), Metadatos internos

### Community 114 - "Manual del creador de OpenClass UNIMINUTO Reveal.js"
Cohesion: 0.17
Nodes (11): Actualización segura 1.2.0, Despliegue y funciones online, Distribución, Integración continua y publicación, Manual del creador de OpenClass UNIMINUTO Reveal.js, Objetivo, Opciones de CLI, Pruebas (+3 more)

### Community 115 - "interact-migrar"
Cohesion: 0.11
Nodes (18): interact-db-preparar, condition, cap_drop, command, depends_on, image, init, mem_limit (+10 more)

### Community 116 - "Promoción manual de OpenClass Live 0.2.0"
Cohesion: 0.22
Nodes (8): 1. Identidad y autoridad efectiva (propietario, VPS, Bash), 2. Ventana sin clase y respaldo privado, 3. Transferencia manual y verificación, 4. Extracción controlada y construcción, 5. Configuración efectiva sin regenerar secretos, 6. Promoción y verificación inmediata, 7. Rollback real si falla cualquier validación, Promoción manual de OpenClass Live 0.2.0

### Community 117 - "interact-migrar"
Cohesion: 0.12
Nodes (17): interact-db-preparar, condition, cap_drop, command, depends_on, image, init, mem_limit (+9 more)

### Community 118 - "Notas de decisión técnica — Teacher Experience VNext"
Cohesion: 0.14
Nodes (12): I0 — `preparacion-release.test.mjs:29` (commit 8b02f6e), I1 — OC-A02 atomicidad de encuestas (commit eebdc33), I2 — Recuperación y confiabilidad del panel (OC-A01, OC-A06, OC-A10, O-01, O-09), I3 — Foco, navegación y accesibilidad (OC-A03, OC-A04, OC-A07, O-02), I4 — Teacher Experience VNext (rediseño visual y de experiencia del panel docente), I4 — Trazabilidad Graphify del panel docente (cierre documental), I5 — Experiencia del estudiante (acuses, pestañas, selección), I6 — Cierre: guía docente, capturas, hipótesis, accesibilidad y aceptación (+4 more)

### Community 119 - "interact-db"
Cohesion: 0.10
Nodes (20): cap_drop, command, container_name, cpus, image, init, mem_limit, memswap_limit (+12 more)

### Community 120 - "Interact by WillEdTech 0.4.0 — identidades, invitaciones e historial"
Cohesion: 0.20
Nodes (10): Compatibilidad y migración desde 0.3.0, Correo (SMTP) — configuración pendiente, Flujo de invitación (implementado y probado), Historial y política de datos, Interact by WillEdTech 0.4.0 — identidades, invitaciones e historial, OpenClass local (vínculo temporal), Persistencia, Primer arranque: superusuario sin credenciales por defecto (+2 more)

### Community 121 - "Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada)"
Cohesion: 0.29
Nodes (6): Cadena en `.github/workflows/openclass-live.yml`, Identidad del candidato, Pendiente en GitHub (no simulado), Pruebas locales, Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada), `release-lock.json`

### Community 122 - "cuenta.mjs"
Cohesion: 0.33
Nodes (4): fin(), hash, ver(), VISTAS

### Community 124 - "db.mjs"
Cohesion: 0.22
Nodes (19): ejecutarMigraciones(), abrirBase(), compararHistorial(), configurarPool(), crearBase(), crearEsquemaSiFalta(), envolver(), ErrorBase (+11 more)

### Community 125 - "interact-db"
Cohesion: 0.10
Nodes (20): cap_drop, command, container_name, cpus, image, init, mem_limit, memswap_limit (+12 more)

### Community 126 - "interact-db-preparar"
Cohesion: 0.14
Nodes (14): cap_drop, command, image, init, mem_limit, networks, pids_limit, profiles (+6 more)

### Community 127 - "interact-db-preparar"
Cohesion: 0.15
Nodes (13): cap_drop, command, image, init, mem_limit, networks, pids_limit, profiles (+5 more)

### Community 128 - "app.mjs"
Cohesion: 0.20
Nodes (13): crearApp(), crearLog(), opcionesBase(), PUBLICO, crearFirmador(), crearCorreo(), crearSesionesDb(), comodin() (+5 more)

### Community 129 - "postgres"
Cohesion: 0.22
Nodes (9): services, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, env, image, options, ports (+1 more)

### Community 131 - "correo.mjs"
Cohesion: 0.14
Nodes (11): RFC-5321, RFC-5322, crearApiCuentas(), iguales(), sha(), construirMensaje(), conversar(), enlaces() (+3 more)

### Community 133 - "interact-db"
Cohesion: 0.18
Nodes (11): interact-db, interact-migrar, interact-migrar-administrado, condition, depends_on, required, condition, required (+3 more)

### Community 134 - "environment"
Cohesion: 0.29
Nodes (7): PGDATA, POSTGRES_DB, POSTGRES_INITDB_ARGS, POSTGRES_PASSWORD, POSTGRES_USER, TZ, environment

### Community 135 - "interact-db"
Cohesion: 0.18
Nodes (11): interact-db, interact-migrar, interact-migrar-administrado, condition, depends_on, required, condition, required (+3 more)

### Community 136 - "environment"
Cohesion: 0.29
Nodes (7): PGDATA, POSTGRES_DB, POSTGRES_INITDB_ARGS, POSTGRES_PASSWORD, POSTGRES_USER, TZ, environment

### Community 137 - "Interact · PostgreSQL (operación)"
Cohesion: 0.17
Nodes (10): PostgreSQL provisionado externamente (modo `externo`), Qué debe provisionar el administrador del servicio, Uso, Arranque ordenado, Credenciales y mínimo privilegio, Desarrollo y pruebas, Dos modos soportados (probados en Docker), Interact · PostgreSQL (operación) (+2 more)

### Community 138 - "Interact · Respaldo, restauración, RPO/RTO y PITR"
Cohesion: 0.29
Nodes (7): Autenticidad: manifiesto firmado (Ed25519), Interact · Respaldo, restauración, RPO/RTO y PITR, Qué se protege, Recuperación a un punto en el tiempo (evaluación; NO implementada), Respaldo (implementado), Restauración (implementada y probada; nunca sobre datos reales), RPO / RTO

### Community 139 - "publicacion-seguridad.test.mjs"
Cohesion: 0.15
Nodes (8): evidencia(), artefactos, bin, id, listar(), M, root, SOLUCIONARIOS

### Community 140 - "docker-redes.test.mjs"
Cohesion: 0.13
Nodes (20): ARCHIVOS_B, certs, claveAdmin, claves, compose(), crearCertificados(), docker(), enRed() (+12 more)

### Community 141 - "procedencia-autosync.mjs"
Cohesion: 0.35
Nodes (11): composePorDigest(), digest(), imageRepository, repository, validarLock(), verificarAutoridad(), verificarOci(), base (+3 more)

### Community 142 - "interact-db-preparar-administrado"
Cohesion: 0.13
Nodes (15): cap_drop, command, image, init, mem_limit, networks, pids_limit, profiles (+7 more)

### Community 143 - "interact-migrar-administrado"
Cohesion: 0.10
Nodes (19): cap_drop, command, image, init, mem_limit, networks, pids_limit, profiles (+11 more)

### Community 144 - "interact-db-preparar-administrado"
Cohesion: 0.11
Nodes (18): cap_drop, command, image, init, mem_limit, networks, pids_limit, profiles (+10 more)

### Community 145 - "interact-migrar-administrado"
Cohesion: 0.14
Nodes (14): cap_drop, command, image, init, mem_limit, networks, pids_limit, profiles (+6 more)

### Community 147 - "environment"
Cohesion: 0.24
Nodes (13): DATABASE_ADMIN_URL, DATABASE_MIGRATION_URL, DB_CONNECT_WAIT_SECONDS, DB_MODO_POSTGRES, DB_SSL, DB_SSL_CA_FILE, INTERACT_DB_APP_PASSWORD, INTERACT_DB_BACKUP_PASSWORD (+5 more)

### Community 148 - "environment"
Cohesion: 0.24
Nodes (13): DATABASE_ADMIN_URL, DATABASE_MIGRATION_URL, DB_CONNECT_WAIT_SECONDS, DB_MODO_POSTGRES, DB_SSL, DB_SSL_CA_FILE, INTERACT_DB_APP_PASSWORD, INTERACT_DB_BACKUP_PASSWORD (+5 more)

### Community 149 - "Interact · Confianza de proxy y red de entrada dedicada"
Cohesion: 0.29
Nodes (6): Evidencia, Interact · Confianza de proxy y red de entrada dedicada, Plan de cambio (para autorización separada), Preflight (solo lectura) antes de pedir autorización, Problema, Propuesta (NO aplicada: requiere autorización separada, no se toca la VPS)

### Community 151 - "ref_node_assert"
Cohesion: 0.15
Nodes (6): BASE, raiz, clave, docker(), IP, rafaga()

### Community 152 - "protocolo-navegador.test.mjs"
Cohesion: 0.29
Nodes (5): socket.io-client, compilarCurso(), npm(), RAIZ, SERVICIO

### Community 154 - "workflow-yaml.mjs"
Cohesion: 0.60
Nodes (4): parseWorkflowYaml(), recorrer(), validarEscapes(), yaml()

### Community 155 - "salas.mjs"
Cohesion: 0.33
Nodes (3): LIMITES_SALA, ALFABETO_CODIGO, DURACION_PREDETERMINADA

## Knowledge Gaps
- **2 isolated node(s):** `RFC-5322`, `RFC-5321`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1287 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `publicacion-ci.mjs` to `Procedencia GitOps de Live: decisión y contrato de promoción`, `vite.config.mjs`, `Guía del docente — Crear OpenClass UNIMINUTO Reveal.js`, `procedencia-autosync.mjs`, `Manual del creador de OpenClass UNIMINUTO Reveal.js`, `Promoción manual de OpenClass Live 0.2.0`, `OpenClass master: minimal AI context`, `OpenClass Suite — Documento maestro de producto, requisitos y evolución`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `montarBuildTech()` (e.g. with `sincronizarPrevias()` and `tictac()`) actually correct?**
  _`montarBuildTech()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `RFC-5322`, `RFC-5321` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `generar-desde-config.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Why does `crearAlmacen()` connect `crearAlmacen` to `app.mjs`, `ref_node_assert`, `salas.mjs`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `create-openclass-uniminuto-revealjs.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._
- **Why does `OpenClass Live — protocolo Socket.IO` connect `Pagina` to `postgresql.test.mjs`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._