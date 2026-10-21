# Guía del docente — Crear OpenClass UNIMINUTO Reveal.js

**Manual ampliado:** abre `/guia/` en el portal del curso. La página web incluye índice, buscador, capítulos y ejemplos copiables. Este Markdown es su complemento editable.

## 1. Flujo de trabajo

**INSTALAR → CREAR CURSO → CONFIGURAR → CREAR SEMANAS → EDITAR → AÑADIR ACTIVIDADES → PRESENTAR → PUBLICAR**

```bash
npm create openclass-uniminuto-revealjs@latest mi-curso   # requiere Node.js 20.19+
cd mi-curso
npm install
npm run dev
```

Con recursos institucionales locales: `npm create openclass-uniminuto-revealjs@latest mi-curso -- --assets "RUTA/recursos-institucionales"`.

1. Abre `npm run dev -- --port 8610`, visita el portal y entra en `/guia/`.
2. Personaliza `openclass.config.json`: `course.fullName`, `course.description`, `course.year` y los objetos `weeks`.
3. Edita `slides.md` (general) y cada `semanas/<nombre>_semanaN.md` (contenido académico).
4. Abre `/galeria/` (vista previa real y código copiable de los 13 layouts), `/demo-completa/` (demostración «TEMÁTICA DE PRUEBA» con todos los recursos) y `/laboratorio/`.
5. Revisa la presentación de la semana y compila con `npm run pages:build`.

## 2. Crear una semana

```powershell
npm run semana -- 2 --title "Sensores y actuadores" --date "2026-11-04" --theme "Medición y control"
```

Edita el archivo generado en `semanas/`. El comando no reemplaza Markdown existente a menos que agregues `--force-content`. Puedes activar varias semanas de 1 a 8 y regenerar índices con `npm run config`.

## 3. Estructura de una diapositiva

```markdown
## Resultados de aprendizaje
<!-- .slide: class="oc-demo oc-l-objectives" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

1. Identificar sensores y actuadores.
2. Relacionar los datos y la conectividad.
3. Diseñar una aplicación sencilla.

Notes:
Explica un ejemplo cercano a la realidad de los estudiantes.

---
```

`---` separa slides. `Notes:` introduce anotaciones para la vista del presentador. La variable `{{BASE_URL}}` resuelve recursos tanto en dominio raíz como en GitHub Pages.

## 4. Los 13 layouts

| Clase | Uso |
|---|---|
| `oc-l-cover` | Portada con franja vertical amarilla y acreditación |
| `oc-l-section` | Separador con avión y banda |
| `oc-l-image-left` | Imagen izquierda y texto |
| `oc-l-image-right` | Imagen derecha y texto |
| `oc-l-top-right` | Imagen a la izquierda con viñetas |
| `oc-l-top-left` | Imagen a la derecha con viñetas |
| `oc-l-multimedia` | Vídeo, HTML interactivo, gráficos y Mermaid |
| `oc-l-text` | Texto y viñetas |
| `oc-l-objectives` | Resultados de aprendizaje |
| `oc-l-two-cols` | Tabla comparativa |
| `oc-l-two-titles` | Dos encabezados |
| `oc-l-code` | Código con scroll |
| `oc-l-closing` | Imagen final GRACIAS |

Copia los ejemplos desde `/galeria/` (botón COPIAR CÓDIGO) o desde `demo-completa.md` y cambia solo título, texto y rutas.

### Código: scroll o paginado

- **Scroll (predeterminado):** el programa completo en una diapositiva, con rueda, flechas, botón «Copiar código» y sin tapar el pie. Mientras quede recorrido, las flechas desplazan el código; en el borde, avanzan la presentación.
- **Paginado:** `data-oc-paginate="code"` en el comentario `.slide` divide el bloque en diapositivas de 16 líneas (`data-oc-lines="20"` para cambiarlo). Úsalo para exportar a PDF.

## 5. Imágenes y vídeo

Coloca imágenes en `public/imagenes/` y escribe `![Descripción]({{BASE_URL}}imagenes/archivo.png)`. Guarda vídeos en `public/videos/` y utiliza HTML `<video controls>` en un layout `oc-l-multimedia`.

**No modifiques los fondos** en `public/fondos/`. El paquete público trae un tema neutro con los mismos nombres; los recursos institucionales se aplican con `--assets` y solo se publican con autorización.

## 6. Actividades locales (iframe)

```html
<iframe title="Actividad" src="{{BASE_URL}}actividades/quiz-iot.html"
 loading="lazy" sandbox="allow-scripts allow-forms"
 style="width:100%;height:100%;border:0"></iframe>
```

La microactividad de `public/actividades/microactividad/` (clasificación con validación, retroalimentación, resultado y reinicio) se adapta a otro tema editando solo `datos.js` (ver su `LEEME.md`).

Estas actividades funcionan localmente. **No registran notas ni respuestas en Moodle**, ni constituyen encuestas compartidas. Una web externa puede bloquear `iframe`.

## 7. Mermaid, Chart y matemáticas

Mermaid usa bloques ` ```mermaid ` (consulta los ejemplos funcionando en `laboratorio.md`). Chart usa `<div class="oc-chart"><canvas data-chart="bar">` con CSV. LaTeX usa `$...$` o `$$...$$`; Math puede necesitar conexión para KaTeX según la configuración actual.

## 7b. Semanas con inteligencia artificial

Usa `docs/IA/INSTRUCCIONES-OPENCLASS.md` (contrato técnico), `docs/IA/PLANTILLA-SEMANAL.md` (datos de la semana) y `docs/IA/PROMPT-CREAR-SEMANA.md` (prompt listo para copiar). Revisa todo lo marcado como «PENDIENTE» antes de la clase.

## 8. Herramientas durante clase

| Acción | Control |
|---|---|
| Pizarra | Botón / `B` |
| Anotar | Botón / `C` |
| Borrar trazos actuales | Botón / `Supr` |
| Buscar | Botón / `Ctrl+Shift+F` |
| Vista del presentador | Botón / `S` |
| Vista general | Botón / `Esc` |
| Pantalla completa | Botón |
| Volver al inicio | Logotipo central del pie en internas |
| Volver al portal | Icono de casa en internas |

En portada no se muestran Home ni el botón de inicio. **PDF:** abre la presentación con `?print-pdf`, imprime con Ctrl+P, «Guardar como PDF», márgenes «Ninguno» y gráficos de fondo activados. Antes de clase prueba la persistencia de pizarra en ese navegador y la apertura de ventanas emergentes del presentador.

## 9. Validación y publicación

```powershell
npm run test:estructura
npm run pages:check
npm run pages:build
npm run preview:pages
```

Publica `dist/` en tu alojamiento. En GitHub Pages configura correctamente `SITE_BASE` para una ruta de repositorio. **`npm run publicar` ejecuta git push**: úsalo únicamente cuando quieras publicar un cambio revisado.

## 10. Actualizar el curso

Desde la carpeta que contiene el curso: `npx create-openclass-uniminuto-revealjs@latest <carpeta-curso> --update-theme` (añade `--assets <carpeta>` para reaplicar recursos locales). Este proceso respalda código previo y conserva Markdown y configuración, pero reemplaza infraestructura como CSS/React. Haz backup o commit Git primero.

## 11. Problemas frecuentes

- Puerto 8600 ocupado: `npm run dev -- --port 8610`.
- Carpeta de destino ocupada: crea otra carpeta; `--force` está bloqueado.
- Semana no visible: verifica `activeWeeks` y ejecuta `npm run config`.
- Iframe vacío: revisa permisos CSP/X-Frame-Options de la web origen.
- Matemáticas offline: revisa la carga de KaTeX CDN.
- Vulnerabilidades: inspecciona `npm audit`; no uses `npm audit fix --force` a ciegas.

## 12. Futuras funciones en vivo

Seminar, Poll y Questions están copiados pero **apagados**; necesitan servidor de participación con HTTPS/WSS, autenticación, salas, control de abuso y configuración de cliente. Zoom se considera una integración posterior, no parte activa de la plantilla distribuida.
