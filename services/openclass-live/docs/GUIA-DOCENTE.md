# OpenClass Live — guía para la clase

Sus diapositivas siguen en su computador. Los estudiantes responden desde el teléfono con un QR o un código; no ven ni descargan la presentación.

> Las capturas son reales, tomadas del servicio funcionando en un equipo de prueba (por eso la dirección es `127.0.0.1`). En clase verá `openclass-live.apps.willedtech.io`.

## Antes de la primera clase (una sola vez)

En su curso, abra `src/plugins/fase2.mjs` y cambie `activa: false` por `activa: true` dentro de `LIVE`:

```js
export const LIVE = {
  activa: true,
  servidor: 'https://openclass-live.apps.willedtech.io',
};
```

Aparecerá un botón discreto **● En vivo** en la esquina superior derecha de la presentación (atajo: tecla **L**). Mientras no se conecte, la presentación no envía nada a ningún servidor.

## 1. Iniciar OpenClass en su computador

En la carpeta del curso: `npm run dev` y abra la semana como siempre (`http://localhost:8613/...` o el puerto configurado en su curso). No use túneles ni publique la presentación.

## 2. Entrar al panel docente

Abra `https://openclass-live.apps.willedtech.io/docente/` (mejor en otro monitor, una tableta o el teléfono) y escriba la contraseña docente.

![Acceso al panel](capturas/01-panel-acceso.png)

## 3. Abrir una sala

Escriba un título (opcional) y pulse **Crear sala**. Deje marcada «Revisar las preguntas antes de publicarlas». La sala dura 3 horas y luego se borra sola.

![Sala creada: código, QR y clave de presentador](capturas/02-panel-sala.png)

Pulse **Copiar clave de presentador**. Esa clave solo sirve para esta sala; no la comparta con estudiantes. Si cree que alguien la vio, pulse **Revocar claves** y copie una nueva.

## 4. Mostrar el QR durante Zoom

1. En Zoom, comparta **solo la ventana de la presentación** (no la pantalla completa: así el panel docente nunca se ve).
2. En la presentación pulse **● En vivo** (o **L**), pegue la clave y pulse **Conectar**.
3. Pulse **Mostrar QR**. Los estudiantes escanean o escriben el código en `openclass-live.apps.willedtech.io`.

![QR sobre la presentación](capturas/03-presentacion-qr.png)

Pulse **Ocultar QR** para seguir con la clase.

## 5. Preparar una encuesta

**Opción A — en la diapositiva** (queda lista para cada clase). En el Markdown de la semana:

```html
<div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
<p class="oc-live-enunciado">¿Qué método une un socket a una sala en Socket.IO?</p>
<ol class="oc-live-opciones">
<li>socket.enter()</li>
<li>socket.join()</li>
<li>io.attach()</li>
</ol>
<div class="oc-live-explicacion">socket.join agrega el socket a una room.<pre><code>socket.join("sala");</code></pre></div>
</div>
```

- `data-tipo="multiple"` permite varias respuestas; `data-correctas="A,C"` marca varias.
- La explicación no se ve en la diapositiva: aparece solo cuando usted la revela.
- Al abrir la votación, **solo** este bloque sale de su computador; el resto de la presentación, las notas y las imágenes no.

**Opción B — en el panel docente:** formulario «Nueva encuesta» (enunciado, código opcional, opciones, correcta opcional, explicación). Use ``` para escribir código en la explicación; nunca se ejecuta.

## 6. Iniciar la votación

En la diapositiva de la encuesta: **● En vivo → Abrir encuesta de esta diapositiva** (o **Guardar y abrir votación** en el panel). Los estudiantes la ven al instante:

![Vista del estudiante](capturas/04-estudiante-encuesta.png)

Mientras está abierta, la pantalla compartida muestra solo cuántas respuestas van, no la distribución, para no influir en la respuesta individual. Los estudiantes pueden cambiar su respuesta hasta que usted cierre.

![Respuesta registrada](capturas/05-estudiante-registrada.png)

## 7. Consultar resultados

**Cerrar votación** → **Publicar resultados** (los estudiantes ven la distribución, todavía sin la respuesta correcta) → **Mostrar en pantalla**.

En el panel ve además respuestas válidas, conectados, porcentajes y el porcentaje de acierto (solo usted).

## 8. Repetir la votación (aprendizaje activo)

Secuencia recomendada: **pregunta → respuesta individual → discusión en parejas → segunda respuesta → explicación**.

Tras la discusión pulse **Segunda ronda**. Al cerrar, pulse **Revelar respuesta**: se marca la correcta, aparece la explicación y la comparación con la primera ronda.

![Resultados en la presentación](capturas/06-presentacion-resultados.png)

![Comparación de rondas en el panel](capturas/08-panel-comparacion.png)

Los estudiantes ven si acertaron y la explicación:

![Estudiante tras revelar](capturas/07-estudiante-revelada.png)

**Retirar** quita la encuesta de los teléfonos; queda en «Encuestas de la sesión».

## 9. Responder preguntas

Los estudiantes escriben en la pestaña **Preguntas**. Con la revisión activada, nadie más las ve hasta que usted las apruebe, y nunca aparecen en la presentación por sí solas.

![Pregunta enviada por un estudiante](capturas/09-estudiante-pregunta.png)

En el panel, las pendientes aparecen veladas (por si comparte esa ventana): **Leer**, **Aprobar**, **Proyectar en la presentación**, **Marcar respondida**, **Ocultar** o **Bloquear autor** (oculta sus preguntas y lo desconecta). Desmarque «Recibir preguntas» para cerrar la recepción.

![Moderación en el panel](capturas/10-panel-preguntas.png)

La pregunta proyectada aparece como una banda sobre la diapositiva; el texto se muestra tal cual, sin interpretar HTML:

![Pregunta proyectada](capturas/11-presentacion-pregunta.png)

## 10. Cerrar la sesión

Al terminar: **Finalizar sesión** en el panel. Se borran del servidor encuestas, respuestas y preguntas; los estudiantes ven «La sesión terminó». En la presentación, **Desconectar**.

## 11. Si se pierde la conexión

- **Un estudiante** (pantalla bloqueada, cambió de red): vuelve solo o recargando el mismo enlace; conserva su respuesta.
- **Su presentación**: se reconecta sola. Si dice «Clave inválida, revocada o vencida», copie una clave nueva desde el panel.
- **El panel**: recargue la página; vuelve a la sala abierta.
- **Si el servidor se reinició**, las salas abiertas se pierden: cree una sala nueva y muestre el QR de nuevo.
- La presentación funciona siempre aunque OpenClass Live no esté disponible.

Nota: la participación es anónima. El sistema evita votos duplicados por accidente, pero no puede garantizar un voto por persona si alguien usa varios dispositivos.
