# Contrato técnico de OpenClass para asistentes de IA

Este documento es para ChatGPT, Claude, Codex u otra IA que vaya a escribir o revisar una
presentación semanal de este curso. Léelo completo antes de producir Markdown.
**Reutiliza lo que existe. No inventes clases CSS, plugins, rutas ni comandos.**

## 1. Arquitectura real

- Proyecto Vite + React 19 + Reveal.js 6. El docente solo edita **Markdown** y `openclass.config.json`.
- `openclass.config.json`: nombre del curso (`course.shortName`, `course.fullName`, `course.year`),
  semanas activas (`generation.activeWeeks`, de 1 a 8) y metadatos por semana (`weeks[]`).
- `semanas/<curso>_semanaN.md`: la presentación de la semana N (lo que normalmente escribirás).
- `slides.md`: presentación general del curso. `demo-completa.md`: referencia con todos los recursos.
- `plantillas/semana.md`: plantilla con la que se crean semanas nuevas.
- `public/imagenes/`, `public/videos/`, `public/actividades/`, `public/descargas/`: recursos.
- `src/` contiene el motor y el tema: **no lo modifiques** para una semana.
- Rutas publicadas: `/` portal, `/semanas/<curso>_semanaN/`, `/guia/`, `/galeria/`, `/demo-completa/`.

## 2. Sintaxis Markdown de una diapositiva

```markdown
## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

Contenido.

Notes:
Notas para el docente.
```

Reglas obligatorias:

1. Las diapositivas se separan con una línea `---` **rodeada de líneas en blanco**.
2. Línea 1: título (`#` solo en portada y cierre; `##` en el resto).
3. Línea 2: el comentario `<!-- .slide: ... -->` con `class="oc-demo <layout>"` y el fondo.
4. Usa siempre `{{BASE_URL}}` antes de rutas de `public/` (la aplicación lo sustituye).
5. `Notes:` en una línea propia; todo lo que sigue es nota del presentador.
6. Fragmentos (aparición progresiva): `- texto <!-- .element: class="fragment fade-in" -->`.

Fondos válidos: `fondos/slide-01-portada.png` (solo portada), `fondos/slide-05-template.png`
(todas las internas y el separador) y `fondos/slide-06-cierre.png` (solo cierre).

## 3. Los 13 layouts (clases existentes, no hay otras)

| Clase | Uso | Contenido admitido |
|---|---|---|
| `oc-l-cover` | Portada | `#` nombre del curso, párrafo en negrita (semana) y párrafo (título · fecha); en las semanas lo genera la configuración (ver abajo) |
| `oc-l-section` | Separador de unidad | `##` título breve + `<div class="oc-section-plane"><img src="{{BASE_URL}}imagenes/avion.png" alt="" /></div>` |
| `oc-l-objectives` | Resultados / pasos | Párrafo opcional + lista numerada de 3 a 6 elementos |
| `oc-l-text` | Texto desarrollado | Primer párrafo destacado + hasta 6 viñetas; fórmulas |
| `oc-l-image-left` | Imagen izquierda + lista derecha | Imagen Markdown primero, luego 3–6 viñetas |
| `oc-l-image-right` | Lista izquierda + imagen derecha | Igual estructura que image-left |
| `oc-l-top-right` | Imagen izquierda + lista derecha | Igual estructura |
| `oc-l-top-left` | Lista izquierda + imagen derecha | Igual estructura |
| `oc-l-two-cols` | Dos columnas / tabla | Tabla Markdown (2–4 columnas, ≤ 6 filas) |
| `oc-l-two-titles` | Comparación | Tabla Markdown de 2 columnas con encabezados |
| `oc-l-multimedia` | Recurso a pantalla completa | Un único `<video>`, `<iframe>`, bloque `mermaid` o `<div class="oc-chart">` |
| `oc-l-code` | Código | Un bloque de código con lenguaje |
| `oc-l-closing` | Cierre GRACIAS | Solo el título `#` (el fondo contiene el mensaje) |

Una presentación semanal empieza con `oc-l-cover` y termina con `oc-l-closing`.

### Primera secuencia de cada semana (generada)

`npm run semana -- N` crea las tres primeras diapositivas desde `openclass.config.json`. Consérvalas
en este orden y escribe tu contenido a partir de la cuarta:

1. **Portada** (`oc-l-cover`): `#` = `course.fullName` exacto (el motor lo muestra como texto
   literal y reduce la letra si es largo; lo ideal sigue siendo ≤ 40 caracteres), `**SEMANA N**` y
   `weeks[].title · weeks[].date` (sin fecha, solo el título).
2. **Tema central** (`oc-l-section`): `##` = `weeks[].centralTheme`.
3. **Activación** (`oc-l-text`): rompehielos, dinámica o reto de 1 a 3 minutos definido en
   `weeks[].opening` = `{ "question", "participation", "durationMinutes" }`.
   - `participation`: `respuesta-individual`, `discusion-parejas`, `hipotesis-grupal` o `propuesta-caso`;
     el generador redacta la instrucción para Zoom o Teams con su alternativa (chat u oral).
   - `durationMinutes`: número entre 1 y 3. `question`: texto sin enlaces ni etiquetas.
   - Sin `opening`, la pregunta es «¿Qué sabes ya sobre …?» con el `centralTheme` (individual, 2 minutos).

La cuarta diapositiva, escrita por el autor, es la «Ruta de la semana» (`oc-l-text`): qué se
aprenderá, relación con las semanas anteriores, conceptos y problemas, cómo participar en cada
recorrido, qué podrá demostrar el estudiante y que la presentación queda publicada en el portal.

Para cambiar las tres generadas, edita la configuración y ejecuta
`npm run semana -- N --force-content`: reemplaza el archivo completo de la semana N (también las
diapositivas desde la cuarta) y no toca las demás semanas. Úsalo solo antes de elaborar el
contenido; después, edita a mano la diapositiva correspondiente. Sin `--force-content`, el Markdown
que ya existe no se toca.

## 4. Imágenes

- Guárdalas en `public/imagenes/` con nombres sin espacios ni tildes: `sensor-dht22.png`.
- Sintaxis: `![Descripción útil para lectores de pantalla]({{BASE_URL}}imagenes/sensor-dht22.png)`.
- Solo en los layouts de imagen (caja de 455 × 556 px, sin recorte). Una imagen por diapositiva.
- No uses imágenes con derechos dudosos. Si propones una imagen que no existe, márcala como
  `PENDIENTE: imagen de ...` en las notas y no la enlaces.

## 5. Recursos externos y multimedia

- Video local: `<video controls preload="metadata" src="{{BASE_URL}}videos/archivo.webm"><track kind="captions" src="{{BASE_URL}}videos/archivo.vtt" srclang="es" label="Español" default></video>`.
- YouTube/Vimeo: `<iframe title="..." src="https://www.youtube-nocookie.com/embed/ID" allowfullscreen style="width:100%;height:100%;border:0"></iframe>`.
- Actividad local: `<iframe title="..." src="{{BASE_URL}}actividades/carpeta/index.html" loading="lazy" sandbox="allow-scripts allow-forms" style="width:100%;height:100%;border:0"></iframe>`.
- Muchos sitios bloquean el `iframe` (CSP/X-Frame-Options). Si no lo has comprobado, ofrece un
  enlace normal y marca la verificación como pendiente.
- **Nunca inventes URLs, IDs de video, DOI ni bibliografía.** Solo cita recursos que el docente
  haya entregado o que hayas verificado, e indica cómo los verificaste.

### Investigación de fuentes

- Si tienes acceso a internet, búscalas: es lo esperado para actualizar y contrastar el contenido.
- Prioriza fuentes oficiales (documentación del fabricante, normas, organismos), académicas
  (artículos revisados por pares, libros universitarios) y actuales; indica la fecha o la versión.
- Verifica cada enlace (abre y responde), la versión del software o de la norma que citas y cada
  afirmación técnica o dato. Lo que no puedas verificar va como «PENDIENTE DE VERIFICAR» en las Notes.

### Videos

- De 0 a 3 videos por semana, de 5 a 10 minutos cada uno, preferiblemente en español.
- Un video por diapositiva (`oc-l-multimedia`), vinculado al concepto que se está tratando.
- Antes de proponerlo, verifica título, duración, canal, idioma, disponibilidad y URL; anótalos en
  las Notes de esa diapositiva junto con el minuto de interés si no se ve completo.
- Diseña la secuencia: pregunta antes del video, qué observar mientras se reproduce y una actividad
  de recuperación después (pregunta, síntesis o aplicación).
- Indica en las Notes una alternativa si el video no está disponible (resumen, imagen, lectura u
  otro video verificado).
- La reproducción no ocupa la sesión: la suma de videos debe dejar la mayor parte del tiempo para
  explicación, práctica y evaluación; un video largo se asigna al recorrido asincrónico.

## 6. Notas del presentador

Cada diapositiva de contenido debería tener `Notes:` con: propósito, pregunta guía, tiempo
estimado y transición. El docente las ve con la tecla **S** (vista del presentador).

- Mantén la profundidad docente: explicación académica del concepto, ejemplos adicionales,
  errores frecuentes y cómo abordarlos. Las Notes no son un resumen de la diapositiva.
- **Las Notes publicadas son accesibles**: viajan en el mismo archivo que la diapositiva y
  cualquiera puede leerlas en el sitio publicado. No pongas en ellas respuestas de evaluaciones,
  solucionarios ni datos personales.
- Los solucionarios privados van fuera de `public/` (por ejemplo, `docente/solucionarios/`) y no se
  importan ni se enlazan desde el Markdown ni desde `src/`: así no llegan a `dist/`. Todo lo que
  está en `public/` se publica aunque ninguna página lo enlace. Si el repositorio del curso es
  público, añade `docente/` a `.gitignore` o guarda los solucionarios fuera del repositorio.

## 7. Tablas

Tabla Markdown estándar con fila separadora `|:---|:---|`. Celdas breves; el tema no reduce la
letra. Más de 6 filas: divide en dos diapositivas.

## 8. Código (dos modos)

- **Scroll (predeterminado)**: el programa completo queda en una diapositiva con barras de
  desplazamiento, botón «Copiar código» y teclado seguro. Úsalo para programas de cualquier tamaño.
- **Paginado**: agrega `data-oc-paginate="code"` al comentario `.slide` para dividir en
  diapositivas de 16 líneas (`data-oc-lines="20"` para cambiarlo, entre 4 y 22). Úsalo si la
  presentación se exportará a PDF.
- Resaltado por pasos: escribe el lenguaje seguido de los rangos, por ejemplo `python [1-3|5-8]`.
- Un bloque de código por diapositiva; indica siempre el lenguaje.

## 9. Mermaid

En `oc-l-multimedia`, un bloque de código con lenguaje `mermaid` (flowchart, sequenceDiagram,
mindmap, timeline…). Máximo ~10 nodos para que sea legible.

## 10. Chart

En `oc-l-multimedia`:

```html
<div class="oc-chart"><canvas data-chart="bar">
<!-- { "options": { "plugins": { "legend": { "position": "bottom" } } } } -->
Serie,Etiqueta 1,Etiqueta 2,Etiqueta 3
Valores A,10,20,30
</canvas></div>
```

Tipos: `bar`, `line`, `pie`, `doughnut`, `radar`. Usa solo datos reales entregados por el docente.

## 11. Fórmulas

KaTeX: `$$ ... $$` en bloque y `$ ... $` en línea, en `oc-l-text`. Requiere conexión (CDN).

## 12. Actividades

- Reutiliza `public/actividades/microactividad/` copiando la carpeta y editando **solo**
  `datos.js` (categorías y elementos con explicación). Ver su `LEEME.md`.
- Cuestionario y laboratorio existentes: `actividades/quiz-iot.html`, `actividades/laboratorio-sensores.html`.
- Las actividades son locales: no envían notas a Moodle ni a otros servidores. No afirmes lo contrario.
- La interacción multiusuario (Socket.IO, encuestas compartidas) **no está activa**.

## 13. Paginación de texto

Si una diapositiva `oc-l-text` u `oc-l-objectives` necesita más contenido, agrega
`data-oc-paginate="auto"`: se crean continuaciones con el mismo título. Es preferible dividir el
contenido con criterio pedagógico antes que depender de la paginación.

## 14. Restricciones institucionales

- No modifiques fondos, logotipos, colores, tipografías ni `src/theme.css`.
- No agregues estilos en línea para cambiar tamaños de letra, márgenes o colores del tema.
- No incluyas datos personales de estudiantes.
- Los recursos institucionales se aplican localmente con `--assets`; no los publiques.

## 15. Validación (si tienes acceso al proyecto)

```bash
npm run test:estructura     # archivos y semanas activas
npm run build:all           # compila todas las páginas; debe terminar sin errores
npm run dev                 # revisa visualmente en http://localhost:8600/
```

En el navegador, la consola muestra `[OpenClass] Auditoría geométrica…: sin excesos detectados`
o la lista de diapositivas con contenido que desborda. Reporta lo que ejecutaste y su resultado
real; si no pudiste ejecutar algo, dilo.
