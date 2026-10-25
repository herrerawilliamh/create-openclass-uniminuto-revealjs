# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según
[SemVer](https://semver.org/lang/es/). Entre paréntesis, la suite que acredita cada punto.

## [Sin versión] — OpenClass Live (en desarrollo)

No se publica en npm hasta aprobar el adaptador local; no altera la versión del paquete.

- Nuevo servicio `services/openclass-live/` (fuera de `files` del paquete): encuestas en dos rondas y
  preguntas moderadas en tiempo real con Socket.IO 4; los estudiantes entran con QR o código y nunca
  cargan la presentación; estado solo en memoria con vencimiento; Docker + Traefik para la VPS
  (`cd services/openclass-live && npm test`, `npm run test:navegador`).
- Plantilla: adaptador local `src/plugins/live.mjs` (botón «En vivo», tecla L), **apagado** por defecto
  en `fase2.mjs` (`LIVE.activa`); no hace ninguna petición hasta que el docente se conecta y solo envía
  la encuesta que abre (`npm run test:navegador` del servicio, Chrome real).
- Corrección: la carga heredada de Questions usaba `window.RevealQuestions`; el plugin vendorizado se
  registra como `window.RevealQnA`.

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
