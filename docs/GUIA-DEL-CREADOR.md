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
| `npm test` | CLI, `--assets`, `--update-theme`, paginación (scroll/paginado/texto), demostración, fichas, microactividad |
| `npm run test:navegador` | Curso nuevo compilado con base de subcarpeta en Chrome real: 13 layouts, código, Mermaid, Chart, KaTeX, video, iframe, actividad, galería, guía, 3 resoluciones, PDF, errores |
| `npm run site:build` + `node --test tests/sitio.test.mjs` | Landing de GitHub Pages, enlaces internos, miniaturas, copiar y móvil |

## Publicación

- GitHub Pages: `.github/workflows/pages.yml` ejecuta `npm test` y `scripts/build-site.mjs`
  (landing en `/`, curso de demostración compilado en `/curso/`) y despliega `_site/`.
  GitHub Pages no crea cursos: la generación es local con npm.
- npm: comprobar `npm pack --dry-run`, probar el `.tgz` en una carpeta temporal (crear curso,
  instalar, `test:estructura`, `build:all`) y publicar con la cuenta del autor (`npm login` interactivo).

## Seguridad y organización

No modificar los proyectos Slidev ni `openclass-prueba-reveal` (referencia visual). No copiar
`node_modules`, `dist`, respaldos ni secretos dentro de `template/`. No publicar
`recursos-institucionales/` sin autorización escrita.

## Despliegue y funciones online

El sitio de cada curso es estático. Seminar/Poll/Questions requieren un servicio separado con
HTTPS/WSS, autenticación, salas y protección frente a abuso; Zoom es una fase futura.
