# Prompt para crear una semana de OpenClass con IA

Copia el bloque siguiente en ChatGPT, Claude, Codex u otra IA. Adjunta (o pega) también
`docs/IA/INSTRUCCIONES-OPENCLASS.md`, la `PLANTILLA-SEMANAL.md` completada y los documentos de
la semana. Si la IA trabaja dentro del proyecto (Codex, Claude Code), basta con indicarle las rutas.

---

```text
Actúa como diseñador instruccional y autor de presentaciones OpenClass (Reveal.js).

1. Lee primero docs/IA/INSTRUCCIONES-OPENCLASS.md y respétalo como contrato técnico: usa solo
   los 13 layouts existentes, la sintaxis indicada y {{BASE_URL}} en las rutas. No inventes
   clases CSS, plugins, rutas ni comandos.
2. Analiza el material semanal adjunto y la PLANTILLA-SEMANAL completada. Trabaja con datos
   parciales; enumera al final lo que falte.
3. Identifica o redacta los resultados de aprendizaje (verbos observables) a partir del material.
   Si el docente los entregó, consérvalos literalmente.
4. Organiza una secuencia pedagógica para la duración indicada: activación, explicación con
   ejemplos, práctica, evaluación formativa y cierre. Indica minutos estimados por bloque.
5. Construye todas las diapositivas necesarias en un único archivo Markdown para
   semanas/<curso>_semanaN.md: portada (oc-l-cover), separadores por unidad, contenido y cierre
   (oc-l-closing). La extensión debe corresponder al contenido: evita diapositivas saturadas
   (máx. 6 viñetas) y también desarrollos superficiales; divide los temas densos en varias
   diapositivas.
6. Incorpora preguntas orientadoras al inicio y en las transiciones (puedes revelar respuestas
   con fragmentos).
7. Integra ejemplos concretos y, cuando aplique, código (modo scroll o data-oc-paginate="code"),
   tablas, Mermaid, Chart con datos reales o fórmulas.
8. Recomienda recursos multimedia SOLO si son comprobables: usa los enlaces entregados por el
   docente o enlaces que hayas verificado; indica cómo los verificaste. Si no puedes verificar,
   escribe «PENDIENTE DE VERIFICAR» en las notas y no lo incrustes.
9. Incluye una microactividad práctica de 5 a 10 minutos. Si es de clasificación, entrega además
   el contenido de un datos.js para public/actividades/<nombre>/ basado en la microactividad
   existente (categorías, elementos y explicaciones).
10. Incorpora evaluación formativa (pregunta de repaso, ticket de salida o cuestionario breve).
11. Crea un cierre con síntesis, tarea o próximos pasos y la diapositiva oc-l-closing.
12. Escribe Notes: en cada diapositiva de contenido (propósito, pregunta guía, tiempo, transición).
13. Verifica la compatibilidad del Markdown: separadores --- con líneas en blanco, una clase de
    layout por diapositiva, rutas con {{BASE_URL}}, un solo recurso por diapositiva multimedia,
    bloques de código cerrados.
14. Si tienes acceso al proyecto, ejecuta npm run test:estructura y npm run build:all y revisa la
    consola del navegador (auditoría geométrica). No afirmes resultados que no hayas obtenido.
15. Termina con un reporte breve:
    - Qué comprobaste y cómo (comandos y resultado real).
    - Qué requiere revisión docente (datos, enlaces, imágenes PENDIENTES, criterios de evaluación).
    - Material académico que faltó.

Prohibido: inventar bibliografía, enlaces, IDs de video, datos estadísticos, resultados de
pruebas o afirmaciones sobre integración con Moodle u otras plataformas.
```

---

## Después de recibir la respuesta

1. Guarda el Markdown en `semanas/<curso>_semanaN.md` (crea la semana antes con
   `npm run semana -- N --title "Título"`).
2. Copia las imágenes indicadas a `public/imagenes/` y la actividad a `public/actividades/`.
3. Ejecuta `npm run dev`, recorre la presentación y revisa la consola.
4. Atiende cada punto «PENDIENTE» antes de la clase.
