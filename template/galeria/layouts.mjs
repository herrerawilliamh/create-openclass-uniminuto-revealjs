/**
 * OpenClass: ficha de cada uno de los 13 layouts (fuente única para /galeria/, la guía y el sitio).
 * `diapositiva` es el id de su ejemplo en demo-completa.md; `vista` es la captura real en
 * public/galeria/ (generada con scripts/capture-gallery.mjs del repositorio del generador).
 */
const FONDO = 'data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover"';
const NOTAS = 'Escribe «Notes:» en una línea propia al final de la diapositiva; todo lo que sigue solo aparece en la vista del presentador (tecla S).';
const SIN_IMAGEN = 'Este layout no está pensado para imágenes de contenido; usa un layout de imagen o multimedia.';
const SIN_MULTIMEDIA = 'Para video, iframe, Mermaid o Chart usa el layout multimedia (oc-l-multimedia).';
const ERRORES_COMUNES = [
  'Olvidar la línea en blanco antes y después de «---» que separa diapositivas.',
  'Escribir mal la clase CSS (por ejemplo oc-l-imageleft en lugar de oc-l-image-left).',
];

export const LAYOUTS = [
  {
    id: 'cover', clase: 'oc-l-cover', numero: '01', nombre: 'Portada institucional', diapositiva: 'portada',
    objetivo: 'Abrir la sesión con el título del tema, la semana y la fecha.',
    markdown: `# Título de la sesión
<!-- .slide: class="oc-demo oc-l-cover" data-background-image="{{BASE_URL}}fondos/slide-01-portada.png" data-background-size="cover" -->

**SEMANA 1**

OCTUBRE 22, 2026

Notes:
Saludo y propósito de la sesión.`,
    parametros: ['Título (encabezado #)', 'Primer párrafo en negrita: semana o etiqueta', 'Segundo párrafo: fecha o subtítulo'],
    imagenes: 'La franja amarilla, la banda azul y el sello forman parte del fondo slide-01-portada.png; no se añaden imágenes en el Markdown.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Título de hasta unos 40 caracteres (3 líneas). Semana y fecha en una línea cada una.',
    errores: ['Usar ## en lugar de # para el título.', 'Agregar listas o imágenes: la portada solo admite título y dos párrafos.'],
  },
  {
    id: 'section', clase: 'oc-l-section', numero: '02', nombre: 'Separador de unidad', diapositiva: 'separador',
    objetivo: 'Anunciar un bloque temático nuevo y marcar una pausa visual.',
    markdown: `## Nombre de la unidad
<!-- .slide: class="oc-demo oc-l-section" ${FONDO} -->

<div class="oc-section-plane"><img src="{{BASE_URL}}imagenes/avion.png" alt="" /></div>`,
    parametros: ['Título de la unidad (##)', 'El avión decorativo es opcional (bloque oc-section-plane)'],
    imagenes: 'Solo el avión decorativo; su texto alternativo va vacío porque no aporta información.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Título breve, de 1 a 6 palabras (máximo 2 líneas).',
    errores: ['Agregar párrafos o listas: el separador no tiene área de contenido.', ...ERRORES_COMUNES.slice(1)],
  },
  {
    id: 'image-left', clase: 'oc-l-image-left', numero: '03', nombre: 'Imagen a la izquierda', diapositiva: 'imagen-izquierda',
    objetivo: 'Explicar con un esquema o fotografía que guía la lectura de la lista.',
    markdown: `## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-image-left" ${FONDO} -->

![Descripción de la imagen]({{BASE_URL}}imagenes/mi-imagen.png)

- Primera idea.
- Segunda idea.
- Tercera idea.`,
    parametros: ['Título', 'Ruta y texto alternativo de la imagen', 'De 3 a 6 viñetas'],
    imagenes: 'Copia el archivo en public/imagenes/ y escríbelo como ![texto alternativo]({{BASE_URL}}imagenes/archivo.png). Se ajusta a 455 × 556 px sin recortarse.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Hasta 6 viñetas de una o dos líneas. Con 4 o menos, la letra se amplía.',
    errores: ['Poner la lista antes de la imagen.', 'Usar rutas absolutas del equipo (C:\\...) en lugar de {{BASE_URL}}imagenes/.', ...ERRORES_COMUNES],
  },
  {
    id: 'image-right', clase: 'oc-l-image-right', numero: '04', nombre: 'Imagen a la derecha', diapositiva: 'imagen-derecha',
    objetivo: 'Presentar primero la idea y después el apoyo visual.',
    markdown: `## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-image-right" ${FONDO} -->

![Descripción de la imagen]({{BASE_URL}}imagenes/mi-imagen.png)

- Primera idea.
- Segunda idea.
- Tercera idea.`,
    parametros: ['Título', 'Ruta y texto alternativo de la imagen', 'De 3 a 6 viñetas'],
    imagenes: 'Igual que imagen a la izquierda: public/imagenes/ y {{BASE_URL}}imagenes/archivo.png.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Hasta 6 viñetas de una o dos líneas.',
    errores: ['Dejar el texto alternativo vacío en imágenes con información.', ...ERRORES_COMUNES],
  },
  {
    id: 'top-right', clase: 'oc-l-top-right', numero: '05', nombre: 'Título superior derecho', diapositiva: 'titulo-derecho',
    objetivo: 'Abrir con un caso, escenario o personaje visual y comentarlo a la derecha.',
    markdown: `## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-top-right" ${FONDO} -->

![Descripción de la imagen]({{BASE_URL}}imagenes/mi-imagen.png)

- Primera idea.
- Segunda idea.
- Tercera idea.`,
    parametros: ['Título', 'Imagen (columna izquierda)', 'Lista (columna derecha)'],
    imagenes: 'Imagen en public/imagenes/; se muestra en la columna izquierda.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Hasta 6 viñetas. Con 4 o menos, la letra se amplía.',
    errores: ['Confundirlo con imagen a la derecha: aquí la imagen queda a la izquierda.', ...ERRORES_COMUNES],
  },
  {
    id: 'top-left', clase: 'oc-l-top-left', numero: '06', nombre: 'Título superior izquierdo', diapositiva: 'titulo-izquierdo',
    objetivo: 'Presentar datos o resultados: la lista bajo el título y la evidencia a la derecha.',
    markdown: `## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-top-left" ${FONDO} -->

![Descripción de la imagen]({{BASE_URL}}imagenes/mi-imagen.png)

- Primera idea.
- Segunda idea.
- Tercera idea.`,
    parametros: ['Título', 'Imagen (columna derecha)', 'Lista (columna izquierda)'],
    imagenes: 'Imagen en public/imagenes/; se muestra en la columna derecha.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Hasta 6 viñetas de una o dos líneas.',
    errores: ['Escribir la imagen después de la lista.', ...ERRORES_COMUNES],
  },
  {
    id: 'multimedia', clase: 'oc-l-multimedia', numero: '07', nombre: 'Multimedia', diapositiva: 'video', captura: 'mermaid',
    objetivo: 'Mostrar un video, una actividad, un simulador, un diagrama Mermaid o un gráfico a pantalla completa.',
    markdown: `## Título del recurso
<!-- .slide: class="oc-demo oc-l-multimedia" ${FONDO} -->

<video controls preload="metadata" src="{{BASE_URL}}videos/mi-video.webm"><track kind="captions" src="{{BASE_URL}}videos/mi-video.vtt" srclang="es" label="Español" default></video>`,
    parametros: ['Un único elemento: <video>, <iframe>, bloque ```mermaid o <div class="oc-chart">', 'Título del recurso'],
    imagenes: 'Para una imagen grande, prefiere un layout de imagen; aquí el área es para recursos interactivos.',
    multimedia: 'Video local en public/videos/ con <video controls>; YouTube/Vimeo con <iframe src="URL de inserción">; actividades con <iframe src="{{BASE_URL}}actividades/…" sandbox="allow-scripts allow-forms">. Verifica que el sitio externo permita incrustarse.',
    notas: NOTAS,
    limites: 'Un solo recurso por diapositiva; ocupa 1196 × 566 px del lienzo.',
    errores: ['Poner texto adicional junto al recurso: queda tapado.', 'Usar un iframe de un sitio que bloquea la incrustación (verás un recuadro vacío).', ...ERRORES_COMUNES.slice(1)],
  },
  {
    id: 'text', clase: 'oc-l-text', numero: '08', nombre: 'Texto desarrollado', diapositiva: 'texto',
    objetivo: 'Desarrollar una idea central con viñetas, fórmulas o una pregunta de repaso.',
    markdown: `## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-text" ${FONDO} -->

Idea central destacada en el primer párrafo.

- Desarrollo de la idea.
- Ejemplo o aplicación.
- Pregunta para el grupo. <!-- .element: class="fragment fade-in" -->`,
    parametros: ['Primer párrafo (se destaca)', 'Viñetas', 'Fragmentos con <!-- .element: class="fragment" -->', 'data-oc-paginate="auto" para textos largos'],
    imagenes: SIN_IMAGEN,
    multimedia: 'Admite fórmulas KaTeX ($$ … $$) y código en línea.',
    notas: NOTAS,
    limites: 'Un párrafo y hasta 6 viñetas. Más contenido: agrega data-oc-paginate="auto" al atributo .slide.',
    errores: ['Reducir la letra con estilos propios en lugar de dividir el contenido.', ...ERRORES_COMUNES],
  },
  {
    id: 'objectives', clase: 'oc-l-objectives', numero: '09', nombre: 'Resultados de aprendizaje', diapositiva: 'resultados',
    objetivo: 'Declarar los resultados esperados o los pasos de una actividad práctica.',
    markdown: `## Resultados de aprendizaje
<!-- .slide: class="oc-demo oc-l-objectives" ${FONDO} -->

1. Explicar …
2. Aplicar …
3. Evaluar …`,
    parametros: ['Lista numerada (1., 2., 3.)', 'Párrafo introductorio opcional'],
    imagenes: SIN_IMAGEN, multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'De 3 a 6 elementos, redactados con verbos observables.',
    errores: ['Usar verbos no evaluables como «conocer» o «entender».', ...ERRORES_COMUNES],
  },
  {
    id: 'two-cols', clase: 'oc-l-two-cols', numero: '10', nombre: 'Dos columnas', diapositiva: 'dos-columnas',
    objetivo: 'Organizar información paralela o una tabla breve.',
    markdown: `## Título de la diapositiva
<!-- .slide: class="oc-demo oc-l-two-cols" ${FONDO} -->

| Columna A | Columna B |
|:---|:---|
| Dato 1 | Dato 1 |
| Dato 2 | Dato 2 |`,
    parametros: ['Encabezados de la tabla (cabeceras azules)', 'Filas', 'Admite 3 o 4 columnas para tablas de información'],
    imagenes: SIN_IMAGEN, multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Hasta 6 filas de celdas breves; la letra no se reduce automáticamente.',
    errores: ['Olvidar la fila separadora |:---|:---|.', 'Celdas con párrafos largos que desbordan el área.', ...ERRORES_COMUNES.slice(1)],
  },
  {
    id: 'two-titles', clase: 'oc-l-two-titles', numero: '11', nombre: 'Dos títulos', diapositiva: 'dos-titulos',
    objetivo: 'Comparar dos conceptos, enfoques o soluciones, cada uno con su título.',
    markdown: `## Comparación
<!-- .slide: class="oc-demo oc-l-two-titles" ${FONDO} -->

| Enfoque A | Enfoque B |
|:---|:---|
| Característica | Característica |
| Ventaja | Ventaja |`,
    parametros: ['Dos encabezados (los títulos de cada lado)', 'Filas comparables'],
    imagenes: SIN_IMAGEN, multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'Hasta 6 filas; mantener la misma cantidad de ideas por lado.',
    errores: ['Comparar elementos que no son equivalentes fila a fila.', ...ERRORES_COMUNES],
  },
  {
    id: 'code', clase: 'oc-l-code', numero: '13', nombre: 'Código fuente', diapositiva: 'codigo-scroll',
    objetivo: 'Mostrar programas con resaltado de sintaxis, scroll o paginación y botón copiar.',
    markdown: `## Título del programa
<!-- .slide: class="oc-demo oc-l-code" ${FONDO} -->

\`\`\`python
def saludo(nombre):
    return f"Hola, {nombre}"

print(saludo("grupo"))
\`\`\``,
    parametros: ['Lenguaje del bloque (python, javascript, java, c, sql…)', 'Modo scroll: predeterminado', 'Modo paginado: data-oc-paginate="code" (16 líneas; data-oc-lines="20" para cambiarlo)', 'Resaltado por pasos: ```python [1-2|4]'],
    imagenes: SIN_IMAGEN,
    multimedia: 'Para ejecutar el código, enlaza un entorno externo (Jupyter, Wokwi, Replit) en una diapositiva multimedia.',
    notas: NOTAS,
    limites: 'Scroll: sin límite de líneas (≈22 visibles). Paginado: 16 líneas por diapositiva. Un bloque por diapositiva.',
    errores: ['Olvidar cerrar el bloque con ```.', 'Usar el modo scroll para exportar a PDF: el PDF solo muestra lo visible; usa data-oc-paginate="code".', ...ERRORES_COMUNES.slice(1)],
  },
  {
    id: 'closing', clase: 'oc-l-closing', numero: '12', nombre: 'Cierre institucional', diapositiva: 'cierre',
    objetivo: 'Cerrar la sesión con el mensaje GRACIAS.',
    markdown: `# ¡Gracias!
<!-- .slide: class="oc-demo oc-l-closing" data-background-image="{{BASE_URL}}fondos/slide-06-cierre.png" data-background-size="cover" -->`,
    parametros: ['Solo el título (accesible para lectores de pantalla y vista general)'],
    imagenes: 'El mensaje GRACIAS forma parte del fondo slide-06-cierre.png.',
    multimedia: SIN_MULTIMEDIA, notas: NOTAS,
    limites: 'No muestra contenido visible además del fondo.',
    errores: ['Agregar texto esperando que se vea: el cierre lo oculta a propósito.'],
  },
];
