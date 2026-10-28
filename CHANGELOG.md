# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según
[SemVer](https://semver.org/lang/es/). Entre paréntesis, la suite que acredita cada punto.

## [1.3.0] — 2026-10-28

- **Inicio estable en Windows**: `Iniciar OpenClass.cmd` ejecuta el Vite instalado localmente sin invocar actualizaciones, instalación o recuperación automática. El arranque y navegación real de React/Reveal.js se aceptaron en Chrome y mediante doble clic en Windows; CI Windows verifica el contrato con Vite simulado.
- **Avisos de versión informativos**: `node scripts/openclass-start.mjs --check-version` permite consultar metadatos limitados de npm; los cursos nuevos contienen la versión del generador en `package.json` (`openclassGenerator`), separada de la versión académica. Sin procedencia o conexión, el aviso falla sin bloquear el arranque.
- **Seguridad**: el autoactualizador experimental no se distribuye y la instalación automática sigue bloqueada por una condición TOCTOU demostrada. No se promete migración ni rollback automático. La actualización existente con `--update-theme` es manual, requiere respaldo y revisión de personalizaciones (especialmente Live).
- **Compatibilidad**: conserva Live v0.2/protocolo 2, dependencias y contenido de los cursos existentes sin cambios automáticos. CI integra Windows, Node 20.19/22/24, Chrome real y manifiesto verificable de `npm pack`.

## [1.2.0] — 2026-10-27

Versión estable del generador: Build Tech, controles multimedia y exportación PDF; incluye el
adaptador Live v0.2, desactivado por defecto. El servicio Live se distribuye por separado y no
forma parte del paquete npm. El adaptador requiere protocolo v2: no activarlo con el servidor v0.1.
La aceptación manual inicial está completada; la revisión del PDF guardado sigue pendiente antes
de aprobar su entrega. La miniatura de video en Build Tech no actualiza los fotogramas y la demo
contiene preguntas ordinarias que no son encuestas Live.

Los cambios preparados como 1.1.0 se incorporan a esta publicación; 1.1.0 no se publicó en npm.

- Nuevo servicio `services/openclass-live/` (fuera de `files` del paquete): encuestas en dos rondas y
  preguntas moderadas en tiempo real con Socket.IO 4; los estudiantes entran con QR o código y nunca
  cargan la presentación; estado solo en memoria con vencimiento; Docker + Traefik para la VPS
  (`cd services/openclass-live && npm test`, `npm run test:navegador`).
- Plantilla: adaptador local `src/plugins/live.mjs` (botón «En vivo», tecla L), **apagado** por defecto
  en `fase2.mjs` (`LIVE.activa`); no hace ninguna petición hasta que el docente se conecta y solo envía
  la encuesta que abre (`npm run test:navegador` del servicio, Chrome real).
- Una clase = una sala = un QR: con la sala conectada (nunca antes), el adaptador integra el QR real y
  el código en la portada (junto a la franja amarilla), en la segunda diapositiva (bloque de
  participación sobre la banda temática) y en cada diapositiva con `.oc-live-encuesta` (QR compacto en
  una esquina libre calculada sin cubrir texto ni medios; se amplía con clic o tecla Q y se oculta por
  diapositiva). La capa de votación y resultados lleva el QR de la misma sala y acompaña a la
  diapositiva de su encuesta. Nada de esto entra en el PDF. Sin cambios de servidor (`npm run
  test:navegador` del servicio: A al inicio, B tarde, C con el QR de la pregunta 2, una sola sala,
  1920×1080, 1920×945 y 1536×730).
- Corrección: la carga heredada de Questions usaba `window.RevealQuestions`; el plugin vendorizado se
  registra como `window.RevealQnA`.
- UX docente v0.2 (requiere desplegar el servicio y actualizar `live.mjs`/`live.css` en cada curso):
  control «En vivo» en el pie azul (sin botón flotante; en la portada, icono en el hueco de
  «anterior») con conexión, participantes y cuenta regresiva; un único menú contextual (también al
  pulsar cualquier QR de la diapositiva, tecla L, Esc cierra) que solo ofrece las acciones del momento:
  «Conectar participación» con orientación breve y descartable → «Iniciar votación · 30 s» → «Cerrar
  ahora» / «+30 segundos» / «Proyectar tendencias» (desactivado por defecto, sin la correcta) →
  «Mostrar resultados» → «Discutir y repetir» o «Revelar explicación». Tiempo de votación global por
  sala (15/30/60/90 s, «Sin límite» avanzado; 30 s por defecto) aplicado a las rondas siguientes; el
  servidor fija el vencimiento absoluto, cierra una sola vez aunque el docente esté desconectado y
  nunca publica ni revela; los clientes cuentan con la hora del servidor (eventos nuevos
  `encuesta:extender` y `sala:ajustar`). Panel docente reordenado (sala → pregunta activa con
  temporizador y tendencias privadas actualizadas en el sitio → controles del momento → preguntas →
  «Crear pregunta improvisada», historial y «Configuración de la sesión» plegados), sin `alert()`.
  Cuenta regresiva en el teléfono. Las capas de resultados ya no cubren la banda institucional superior.
- **Build Tech** (plantilla, sin cambios de servidor): vista privada del docente en una ventana aparte,
  desde «Vista del presentador» (selector Build Tech / notas clásicas de Reveal.js) o tecla T. Notas
  `Notes:` vía `getSlideNotes()` analizadas con DOMParser y pintadas como texto (punto de lectura
  `[[n]]`, notas ancladas `[[#ancla]]` + `data-oc-nota`, acciones explícitas `[[#ancla:reproducir]]`),
  letra ±, «Solo notas», divisor redimensionable; vistas previas en modo `?receiver` sin Live, sin
  sonido y sin cargar iframes; hora, tiempo de clase (45/60/90/personalizado, pausa, reinicio con
  confirmación, solo aviso al terminar) y el temporizador global de votación, independientes; control de
  `<video>`/`<audio>` y de YouTube con la API IFrame oficial (`enablejsapi=1` al iniciar), «Control
  externo no disponible» para otros; En vivo completo (incluye retirar y moderar preguntas) por la misma
  conexión de la presentación; puente `postMessage` local con origen, ventana y lista cerrada de
  órdenes (`src/plugins/puente.mjs`); reloj público opcional. Las notas clásicas de Reveal.js ya no
  conectan sus vistas previas a la sala (`npm run test:build-tech`; Chrome:
  `services/openclass-live/tests/e2e/build-tech-navegador.test.mjs`).
- **Exportar a PDF**: botón de impresora en el pie azul (X 431–465; oculto en la portada) que abre
  `?print-pdf&oc-imprimir` en otra pestaña con el diálogo del navegador; una página 16:9 por diapositiva
  (`pdfSeparateFragments: false`, `pdfMaxPagesPerSlide: 1`), sin notas, soluciones, QR, controles ni
  capas; cada iframe se imprime como su título y su enlace (`npm run test:navegador`: 8 herramientas).
- **Seguridad v0.2 (auditoría de 46ed512)**: (1) la solución ya no sale al crear la encuesta: la
  presentación envía solo enunciado, código, tipo y opciones y conserva correctas y explicación hasta
  «Revelar explicación», que las transmite en el evento `encuesta:revelar` (validado contra la encuesta
  activa, con la votación cerrada, una sola vez y atómico); el servidor rechaza `correctas`/`explicacion`
  al crear. Las preguntas improvisadas del panel guardan su solución en la pestaña (`sessionStorage`).
  (2) Los estudiantes nunca reciben `porcentajeCorrecto` antes de revelar (resúmenes de ronda con lista
  blanca; distribución solo tras publicar). (3) La regla que oculta `.oc-live-encuesta
  .oc-live-explicacion` pasa a `theme.css` (siempre cargado): oculta en pantalla y en el PDF también con
  `LIVE.activa = false` (servicio `npm test`, `npm run test:navegador`: Live, Build Tech y
  `pdf-privacidad-navegador`). Hotfix mínimo del acierto para v0.1, preparado y sin desplegar:
  `services/openclass-live/hotfix/`.

## [1.1.0] — sin publicar

Compatible con cursos creados con 1.0.0: no cambia la estructura de `openclass.config.json` (el bloque
`weeks[].opening` es opcional) ni elimina layouts. Requisitos sin cambios: Node.js 20.19 o posterior.

### Generación semanal segura

- `npm run semana -- N` crea el Markdown y el lanzador HTML de la semana N y la añade a
  `generation.activeWeeks`; volver a ejecutarlo no sobrescribe contenido ya editado, conserva los
  campos personalizados de `course`, `generation`, la raíz y cada semana, y rechaza semanas fuera de
  `weeksTotal` sin modificar el curso (`npm test`, `tests/semana.test.mjs`).
- `--force-content` reemplaza solo el archivo de la semana indicada y solo cuando se pide; `npm run
  config` recupera lanzadores perdidos sin tocar el Markdown (`npm test`).

### Primera secuencia de cada semana

- **Portada (diapositiva 1):** el H1 muestra exactamente `course.fullName`, sin interpretar Markdown ni
  HTML, con saltos de línea y espacios tal como se escriben; número de semana y fecha fuera del H1. El
  texto renderizado cabe en el lienzo 1280×720 también con nombres largos (`npm run test:p2`,
  `npm run test:dom`, Chrome real).
- **Tema (diapositiva 2):** `centralTheme` con el layout de sección.
- **Activación digital (diapositiva 3):** pregunta y dinámica breve (1–3 min) para clases por Zoom o
  Teams, configurable en `weeks[].opening`, con cuatro modalidades: `respuesta-individual`,
  `discusion-parejas`, `hipotesis-grupal` y `propuesta-caso`. Cada modalidad muestra solo su
  instrucción, siempre con alternativa por chat u oral; sin `opening` se genera una pregunta individual
  de 2 minutos a partir del tema. Las diapositivas originales pasan a ser 4–9 sin cambios de contenido
  (SHA-256) y se conservan las Notes (`npm run test:p2`).

### Portal centrado en estudiantes

- Jerarquía: identidad del curso → «Comenzar aquí» → semanas publicadas (solo `activeWeeks`, en
  orden, con número, título y tema) → tres recorridos → recursos complementarios en un bloque
  secundario. Enlace de salto a las semanas, foco visible, sin scroll horizontal en escritorio ni móvil
  y aviso cuando no hay semanas activas (`npm run test:portal`, Chrome real).
- Tres recorridos pedagógicos complementarios (sincrónico por Zoom o Teams, asincrónico guiado y
  autónomo) con resultados equivalentes; se presentan como recorridos, no como modalidades
  académicas oficiales.

### Guía docente y prompt maestro

- Nuevo capítulo «Diseñar la semana» en la guía web (20 capítulos) y prompt maestro
  `docs/IA/PROMPT-CREAR-SEMANA.md` actualizado. Son **pautas documentadas** para el docente y la IA
  (`npm run test:docente`); el generador no las impone:
  - investigación académica con fuentes oficiales, académicas y actuales, marcando lo no
    comprobado como «PENDIENTE DE VERIFICAR»;
  - de cero a tres videos por semana, de 5 a 10 minutos, cada uno en su propia diapositiva;
  - «Ruta de la semana» como cuarta diapositiva, escrita por el docente.

### Guía del docente

- La barra superior de `/guia/` se reorganiza en varias líneas en pantallas de hasta 590 px: sin
  desplazamiento horizontal a 320, 390 y 768 px (`npm run test:navegador`).

### Publicación y privacidad

- `dist/` ya no contiene el Markdown, las Notes ni los metadatos de semanas inactivas, ni las claves de
  `openclass.config.json` fuera de la lista pública; al desactivar una semana y recompilar desaparece
  de todos los artefactos (`npm run test:seguridad`).
- Las Notes de una semana activa **son públicas**: viajan en el mismo artefacto que su contenido. Los
  solucionarios deben guardarse fuera de `public/` (p. ej. `docente/solucionarios/`), sin importarlos;
  todo lo que está en `public/` se publica. La guía indica añadir `docente/` a `.gitignore` en
  repositorios públicos.

### Desarrollo del generador

- Nuevas suites integradas como scripts npm y en GitHub Actions: `test:p2`, `test:docente`,
  `test:seguridad`, `test:dom`, `test:portal`, `test:sitio`, y los agregados `test:ligeras`,
  `test:chrome` y `test:release`.
- `ci.yml`: suites ligeras en Node 20.19, 22 y 24 y job obligatorio de Chrome real (DOM, portal,
  navegador y sitio). `pages.yml` despliega solo si pasa `ci.yml`.
- `release.yml`: publicación manual desde el tag `vX.Y.Z`, con la suite completa como requisito,
  npm Trusted Publishing (OIDC, sin tokens) y publicación *staged* que el propietario aprueba con 2FA.
  Instala y exige npm ≥ 11.15.0 (`npm stage publish`) y Node ≥ 22.14.0 antes de publicar.
- Pruebas de Chrome más robustas: el servidor estático corta las conexiones abiertas al cerrar y
  responde 400 ante URI mal formadas; las órdenes CDP tienen límite de tiempo y Chrome siempre se
  cierra, incluso si falla el arranque. `test:dom` nombra la fase bloqueada (`OPENCLASS_TRAZA=1`
  muestra cada fase en vivo).
- `publishConfig` fija acceso público y el registro oficial de npm.
- El paquete ya no incluye `docs/AI-CONTEXT.md` (contexto interno para asistentes de IA); añade
  `CHANGELOG.md`.

### Actualizar un curso existente

```bash
npx create-openclass-uniminuto-revealjs@1.1.0 <carpeta-del-curso> --update-theme
```

Actualiza la infraestructura con respaldo y conserva el Markdown y la configuración. Para la nueva
apertura de una semana ya elaborada, añade `weeks[].opening` y copia la diapositiva desde un curso
nuevo; `--force-content` reemplaza el archivo completo de la semana.

### Conocido

- `npm audit` sigue informando un aviso bajo en KaTeX (dependencia de Mermaid); la corrección exige
  Mermaid 12 (cambio mayor).

## [1.0.0] — 2026-10-21

- Primera versión pública: generador con 13 layouts, código con scroll o paginado, Mermaid, Chart,
  KaTeX, actividades, guía del docente, tema neutro público y sitio de GitHub Pages.
