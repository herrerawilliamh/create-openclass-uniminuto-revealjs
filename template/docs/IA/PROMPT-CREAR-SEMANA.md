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
3. Investiga los conceptos: si tienes acceso a internet, busca y contrasta fuentes oficiales,
   académicas y actuales; verifica enlaces, versiones y afirmaciones como indica la sección
   «Investigación de fuentes» del contrato técnico. Lo no verificado queda «PENDIENTE DE VERIFICAR».
4. Identifica o redacta los resultados de aprendizaje (verbos observables) a partir del material.
   Si el docente los entregó, consérvalos literalmente.
5. Conserva la primera secuencia generada, en este orden: portada del curso, tema central y
   activación (rompehielos, dinámica o reto de 1 a 3 minutos). Si propones otra activación,
   entrégala como bloque weeks[].opening para openclass.config.json, no como diapositiva editada.
   La cuarta diapositiva es la «Ruta de la semana» (oc-l-text): qué se aprenderá, cómo se relaciona
   con las semanas anteriores, qué conceptos y problemas se abordarán (el caso conductor), cómo
   participar en cada recorrido, qué podrá demostrar el estudiante al finalizar y que la
   presentación queda publicada en el portal para consultarla después. Usa solo los resultados de
   aprendizaje del punto 4; no inventes resultados institucionales.
6. Organiza el contenido de la semana alrededor de un caso conductor: conceptos conectados entre
   sí y con el caso, demostraciones, microactividades, práctica integradora cuando corresponda,
   evaluación formativa y transferencia a otro contexto. Vincula explícitamente con lo trabajado
   en la semana anterior y anticipa la siguiente.
7. Presenta cada concepto a partir de un problema o ejemplo y con descubrimiento progresivo
   (preguntas, fragmentos); después formaliza los fundamentos (definición, modelo, fórmula,
   procedimiento) para asegurar la comprensión.
8. Diseña tres recorridos didácticos con los mismos resultados de aprendizaje, evidencias
   equivalentes y continuidad semanal:
   - Sincrónico por Zoom o Teams.
   - Asincrónico guiado (secuencia de pasos, recursos y entregas con fecha).
   - Autónomo o de conectividad limitada (materiales livianos o descargables, sin depender de
     video ni de conexión continua).
   Son recorridos didácticos dentro del mismo curso, no modalidades académicas oficiales: no los
   presentes como modalidades acreditadas. Resúmelos en una diapositiva oc-l-two-cols (tabla de
   tres columnas, ≤ 6 filas) e indica la evidencia de cada uno.
9. Indica minutos estimados por bloque para la sesión sincrónica de la duración indicada.
10. Construye todas las diapositivas necesarias en un único archivo Markdown para
    semanas/<curso>_semanaN.md: las tres generadas, separadores por unidad, contenido y cierre
    (oc-l-closing). La extensión debe corresponder al contenido: evita diapositivas saturadas
    (máx. 6 viñetas) y también desarrollos superficiales; divide los temas densos en varias
    diapositivas.
11. Incorpora preguntas orientadoras al inicio y en las transiciones (puedes revelar respuestas
    con fragmentos).
12. Integra ejemplos concretos y, cuando aplique, código (modo scroll o data-oc-paginate="code"),
    tablas, Mermaid, Chart con datos reales o fórmulas.
13. Videos: de 0 a 3 por semana, de 5 a 10 minutos cada uno, preferiblemente en español, uno por
    diapositiva y vinculado al concepto tratado. Verifica título, duración, canal, idioma,
    disponibilidad y URL; plantea una pregunta antes, qué observar y una actividad de
    recuperación después, y una alternativa si no está disponible. Los videos no deben ocupar
    la sesión: la mayor parte del tiempo es explicación, práctica y evaluación.
14. Recomienda otros recursos multimedia SOLO si son comprobables: usa los enlaces entregados por
    el docente o enlaces que hayas verificado; indica cómo los verificaste. Si no puedes
    verificar, escribe «PENDIENTE DE VERIFICAR» en las notas y no lo incrustes.
15. Incluye una microactividad práctica de 5 a 10 minutos. Si es de clasificación, entrega además
    el contenido de un datos.js para public/actividades/<nombre>/ basado en la microactividad
    existente (categorías, elementos y explicaciones).
16. Incorpora evaluación formativa (pregunta de repaso, ticket de salida o cuestionario breve).
17. Crea un cierre con síntesis, transferencia, tarea o próximos pasos (enlace con la semana
    siguiente) y la diapositiva oc-l-closing.
18. Escribe Notes como guion docente público en cada diapositiva de contenido (propósito, pregunta
    guía, tiempo, transición) con profundidad docente: explicación académica, ejemplos adicionales
    y errores frecuentes. Las Notes publicadas son accesibles: no incluyas respuestas de
    evaluaciones ni solucionarios.
    Entrega los solucionarios en un archivo aparte para docente/solucionarios/ (fuera de public/,
    sin importarlo ni enlazarlo).
19. Verifica la compatibilidad del Markdown: separadores --- con líneas en blanco, una clase de
    layout por diapositiva, rutas con {{BASE_URL}}, un solo recurso por diapositiva multimedia,
    bloques de código cerrados.
20. Si tienes acceso al proyecto, ejecuta npm run test:estructura y npm run build:all y revisa la
    consola del navegador (auditoría geométrica). No afirmes resultados que no hayas obtenido.
21. Termina con un reporte breve:
    - Qué comprobaste y cómo (comandos y resultado real).
    - Fuentes consultadas (con fecha de consulta y versión) y videos verificados (título, canal,
      duración, idioma, URL).
    - Qué requiere revisión docente (datos, enlaces, imágenes PENDIENTES, criterios de evaluación).
    - Material académico que faltó.

Prohibido: inventar bibliografía, enlaces, IDs de video, datos estadísticos, resultados de
pruebas o afirmaciones sobre integración con Moodle u otras plataformas; presentar los recorridos
como modalidades oficiales; poner solucionarios en Notes o en public/.
```

---

## Después de recibir la respuesta

1. Si la IA propuso un bloque `opening`, cópialo primero en `weeks[]` de `openclass.config.json`.
2. Crea la semana con `npm run semana -- N --title "Título"`. Si su Markdown ya existía y aún no
   tiene contenido elaborado, añade `--force-content` para aplicar el nuevo `opening`: reemplaza el
   archivo completo de la semana N. Si ya tiene contenido elaborado, no lo uses; edita a mano la
   diapositiva «Activación» con la misma estructura.
3. Guarda el Markdown en `semanas/<curso>_semanaN.md`, conservando las tres primeras diapositivas
   generadas y pegando desde la cuarta («Ruta de la semana») la respuesta de la IA.
4. Copia las imágenes indicadas a `public/imagenes/` y la actividad a `public/actividades/`; los
   solucionarios, a `docente/solucionarios/`.
5. Ejecuta `npm run dev`, recorre la presentación y revisa la consola.
6. Abre cada enlace y video propuesto y atiende cada punto «PENDIENTE» antes de la clase.

Guía completa del diseño semanal (apertura, recorridos, videos, Notes y solucionarios): capítulo
«Diseñar la semana» en `/guia/#pedagogia`.
