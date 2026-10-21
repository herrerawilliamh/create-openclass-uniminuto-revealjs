# Curso OpenClass UNIMINUTO Reveal.js

Esta plantilla incluye la **Guía del docente** en **`/guia/`** (19 capítulos con buscador y
ejemplos copiables), la **galería de los 13 layouts** en `/galeria/` y la **demostración completa
«TEMÁTICA DE PRUEBA»** en `/demo-completa/`, todas accesibles desde el portal (`/`). Versión
editable de la guía: [`docs/GUIA-DOCENTE.md`](docs/GUIA-DOCENTE.md).

## Empezar

```bash
npm install
npm run dev
```

Abre `http://localhost:8600/` (si el puerto está ocupado: `npm run dev -- --port 8610`).

## Editar el curso

- `openclass.config.json`: nombre del curso, año y semanas activas.
- `slides.md`: presentación general.
- `semanas/<curso>_semana1.md`: primera semana; `---` divide diapositivas.
- `plantillas/semana.md`: estructura sugerida para semanas nuevas.
- `public/imagenes/`, `public/videos/` y `public/actividades/`: materiales.
- `docs/IA/`: instrucciones, plantilla y prompt para crear semanas con IA.

Nueva semana:

```bash
npm run semana -- 2 --title "Sensores y actuadores" --date "2026-11-04"
```

Los Markdown existentes se conservan salvo que pases `--force-content`. Para reconstruir rutas
sin reemplazar contenido: `npm run config`.

## Rutas

`/` portal · `/guia/` manual · `/galeria/` 13 layouts · `/demo-completa/` demostración ·
`/general/` presentación general · `/demo-layouts/` ejemplo IoT · `/laboratorio/` actividades ·
`/semanas/<curso>_semanaN/` semanas activas.

## Herramientas y recursos

Portada con franja amarilla y bloque de semana, internas con navegación sobre el pie azul y cierre
GRACIAS. Pizarra, anotación, borrado, búsqueda, vista del presentador (S), vista general,
pantalla completa, Mermaid, Chart, KaTeX, código con scroll o paginado y botón copiar. El botón
central del pie vuelve a la primera diapositiva. PDF: abre la presentación con `?print-pdf`.

El paquete público incluye un tema neutro; los fondos y logotipos institucionales se aplican
localmente con `--assets` y solo deben publicarse con autorización.

La interacción multiusuario (Seminar/Poll/Questions) está **desactivada** hasta montar un servidor
de participación. Las respuestas de las actividades locales no se envían a Moodle.

## Compilar y publicar

```bash
npm run test:estructura
npm run pages:build
npm run preview:pages
```

Solo `dist/` se despliega como sitio estático. Para GitHub Pages: Settings → Pages → Source:
GitHub Actions; el flujo `.github/workflows/deploy.yml` compila y publica en cada push a `main`.
