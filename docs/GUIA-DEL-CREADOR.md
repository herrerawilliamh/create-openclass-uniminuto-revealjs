# Manual del creador de OpenClass UNIMINUTO Reveal.js

## Objetivo

Generar un proyecto **nuevo** y autónomo para impartir OpenClass de hasta 8 semanas. Cada curso
incluye guía web (`/guia/`), galería de layouts (`/galeria/`), demostración completa
(`/demo-completa/`), laboratorio, microactividad, archivos para IA (`docs/IA/`) y flujo de
GitHub Pages.

## Distribución

- Paquete npm: `create-openclass-uniminuto-revealjs` (binario del mismo nombre). Este generador no es Slidev.
- `bin/create-openclass-uniminuto-revealjs.mjs` copia `template/` y genera la configuración inicial.
- **Modelo híbrido de recursos:** el paquete y el repositorio públicos llevan un tema neutro propio
  con los mismos nombres de archivo y la misma geometría que los recursos institucionales. Los
  originales se conservan solo en local (`recursos-institucionales/`, excluido de Git y npm) y se
  aplican con `--assets`.

## Uso básico

```bash
npm create openclass-uniminuto-revealjs@latest mi-curso
cd mi-curso
npm install
npm run dev
```

Desde el código fuente: `node bin/create-openclass-uniminuto-revealjs.mjs ../mi-curso --assets recursos-institucionales`.

## Opciones de CLI

| Flag | Efecto |
|---|---|
| `--help` | Ayuda y ejemplos. |
| `--iot` | Datos iniciales del curso IoT. |
| `--install` | Ejecuta `npm install` tras la creación. |
| `--assets <dir>` | Copia imágenes (png, jpg, webp, svg, gif, ico) desde `<dir>/public` o `<dir>` sobre `public/`. Nunca copia código. |
| `--update-theme` | Actualiza código/estilos de un curso reconocido con respaldo en `respaldos/`, conservando Markdown y configuración. Admite `--assets`. |
| `--force` | Bloqueado intencionalmente. |

Con `npm create`, las opciones van después de `--`: `npm create openclass-uniminuto-revealjs@latest mi-curso -- --assets dir`.

## Regenerar recursos públicos

```bash
npm run assets:neutros                       # tema neutro (SVG en recursos-neutros/) y video WebM con duración
npm run galeria:capturas -- <dist-del-curso> # 13 miniaturas reales (640×360 WebP) + capturas del sitio
```

## Pruebas

| Comando | Qué valida |
|---|---|
| `npm test` | Controles basales (28): CLI, `--assets`, `--update-theme`, paginación (scroll/paginado/texto), demostración, fichas, microactividad, `npm run semana` |
| `npm run test:p2` | Primera secuencia semanal (28): portada con `course.fullName`, tema central, activación y modalidades de participación |
| `npm run test:docente` | Documentación P3 (4): guía web de 20 capítulos, prompt maestro y contrato distribuidos; contenido del paquete npm |
| `npm run test:seguridad` | Seguridad de publicación (12): configuración privada y semanas inactivas fuera de `dist/`, solucionarios fuera de `public/`, Notes públicas |
| `npm run test:dom` | Portada en el DOM (8, en una sola ejecución): nombre literal y desbordamientos del texto real en portada, tema y activación; deja capturas si falla |
| `npm run test:portal` | Portal del estudiante (7): jerarquía, solo semanas activas, tres recorridos, enlaces, teclado, escritorio y móvil |
| `npm run test:navegador` | Navegador (11): curso nuevo compilado con base de subcarpeta en Chrome real: 13 layouts, código, Mermaid, Chart, KaTeX, video, iframe, actividad, galería, guía, 3 resoluciones, PDF, errores |
| `npm run site:build` + `npm run test:sitio` | Landing de GitHub Pages, enlaces internos, miniaturas, copiar y móvil |
| `npm run test:ligeras` / `test:chrome` / `test:release` | Agregados: sin navegador / Chrome real / todo, incluido el sitio |

Las suites de Chrome usan `CHROME_PATH` si Chrome o Edge no están en la ruta habitual y requieren
Node 22 o posterior (WebSocket global); las ligeras funcionan desde Node 20.19.

## Integración continua y publicación

- `.github/workflows/ci.yml` (pull requests, manual o reutilizado): suites ligeras en Node 20.19, 22 y
  24, y un job obligatorio de Chrome real (DOM, portal, navegador, `site:build` y sitio). No publica.
- `.github/workflows/pages.yml` (push a `main`): ejecuta `ci.yml` completo; solo si pasa, construye
  `_site/` (landing en `/`, curso de demostración en `/curso/`) y lo despliega en GitHub Pages.
  GitHub Pages no crea cursos: la generación es local con npm.
- `.github/workflows/release.yml` (solo manual): publica en npm sin tokens mediante Trusted Publishing
  (OIDC). Pasos del propietario:
  1. Verificar el candidato: `npm run test:release`, `npm pack` y prueba del `.tgz` en una carpeta
     temporal (crear curso, `npm install`, `npm run semana`, `test:estructura`, `build:all`).
  2. Crear y subir el tag `vX.Y.Z` del commit de `main` cuyo `package.json` tiene esa versión.
  3. Actions → «Publicar en npm» → *Use workflow from* = el tag; `version` = `X.Y.Z`; `confirmar` =
     `PUBLICAR`. El workflow rechaza ramas, tags fuera de `main` y versiones distintas o ya publicadas.
  4. Se ejecuta `ci.yml` completo y después el job del entorno `npm-publish` (con revisores obligatorios).
  5. `npm stage publish` deja la versión *staged*; se hace pública al aprobarla con 2FA:
     `npm stage approve <id>` o npmjs.com.
- Configuración única en npmjs.com (paquete → Settings → Trusted Publisher → GitHub Actions):
  usuario `herrerawilliamh`, repositorio `create-openclass-uniminuto-revealjs`, workflow
  `release.yml`, entorno `npm-publish`. Recomendado después: «Require two-factor authentication and
  disallow tokens». En GitHub: Settings → Environments → `npm-publish` con revisores obligatorios y
  restricción a tags `v*`.
- Requisitos: Node ≥ 22.14.0 (Trusted Publishing) y npm ≥ 11.15.0 (`npm stage publish`); el workflow
  usa Node 24, instala npm `>=11.15.0 <12` y comprueba ambas versiones antes de publicar. Además,
  runners alojados por GitHub y repositorio público (procedencia automática).

## Seguridad y organización

No modificar los proyectos Slidev ni `openclass-prueba-reveal` (referencia visual). No copiar
`node_modules`, `dist`, respaldos ni secretos dentro de `template/`. No publicar
`recursos-institucionales/` sin autorización escrita.

## Despliegue y funciones online

El sitio de cada curso es estático. Seminar/Poll/Questions requieren un servicio separado con
HTTPS/WSS, autenticación, salas y protección frente a abuso; Zoom es una fase futura.
