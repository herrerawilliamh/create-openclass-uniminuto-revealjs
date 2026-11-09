# Interact by WillEdTech — guía para la clase

Interact permite que los estudiantes respondan votaciones y envíen preguntas desde su teléfono con un QR, un enlace o un código de seis caracteres. No ven ni descargan sus diapositivas, y no necesitan cuenta.

> Las capturas de esta guía son reales: salen de la aplicación funcionando en un equipo de prueba, con datos sintéticos (por eso la dirección es `127.0.0.1`). En clase verá la dirección de su servicio, por ejemplo `openclass-live.apps.willedtech.io`. No contienen contraseñas, claves de presentador ni datos de estudiantes.

## Qué hace cada persona

| Tarea | Quién |
|---|---|
| Entrar al panel, crear la sala, compartir el QR, votar, moderar preguntas, terminar la clase | **Usted, el docente** |
| Preparar o modificar un curso Reveal.js (escribir las preguntas en el Markdown, activar Interact en el curso, publicar o iniciar la presentación) | **Un responsable técnico o de soporte** |

Interact **no edita diapositivas**. Desde el panel no se crean, cambian ni publican cursos Reveal.js; si necesita una pregunta nueva dentro de la presentación, pídasela a quien prepara el curso. Lo que sí puede hacer usted en la clase, sin ayuda técnica, es crear **preguntas improvisadas** desde el panel.

## Elija su recorrido

- **Recorrido A — tiene un curso Reveal.js ya preparado** (alguien configuró el curso y le entregó la contraseña del panel): la presentación se conecta a la sala y las votaciones se inician desde el botón «En vivo» del pie de la presentación.
- **Recorrido B — no tiene un curso Reveal.js preparado**: toda la clase se conduce desde el panel, con preguntas improvisadas.

---

## Recorrido A · Docente con curso Reveal.js preparado

### A1. Acceder al panel

Abra `https://openclass-live.apps.willedtech.io/docente/` (mejor en otro monitor, una tableta o el teléfono; nunca en la ventana que comparte). Escriba la contraseña y pulse **Entrar**. Si no tiene contraseña, pídala a quien administra el servicio. Si la contraseña es incorrecta, el aviso «Contraseña incorrecta.» aparece junto al campo y el cursor vuelve a él.

![Inicio de sesión](capturas/vnext-01-inicio-sesion.png)

Verá **Sus clases**, con las salas abiertas y el formulario para abrir una nueva.

![Lista de salas](capturas/vnext-02-lista-salas.png)

### A2. Crear la sala

Escriba un título opcional (lo ven los estudiantes), deje marcada **Revisar las preguntas antes de publicarlas** si quiere aprobarlas usted, y pulse **Crear sala**. La sala dura 3 horas y luego se borra sola. Una clase = una sala = un QR.

### A3. Compartir el QR o el código

En **Compartir con la clase** están el código, el enlace (**Copiar enlace**) y el QR. Proyecte o comparta el QR; los estudiantes entran una vez y permanecen conectados. Quien llega tarde usa el mismo QR o código.

![Sala creada: código, enlace y QR](capturas/vnext-03-sala-creada-qr.png)

Cuando la presentación está conectada, el QR de la misma sala aparece también dentro de la portada, de la segunda diapositiva y de las diapositivas con pregunta (nunca antes de conectar):

![QR en la portada](capturas/12-presentacion-portada.png)

![QR compacto en una pregunta](capturas/14-presentacion-encuesta-qr.png)

Pulsar cualquiera de esos QR abre el menú «En vivo»; allí **Ampliar QR** (tecla **Q**) lo muestra grande. Nada de esto aparece en el PDF.

![QR ampliado sobre la presentación](capturas/03-presentacion-qr.png)

### A4. Conectar la presentación con su clave

Este paso se hace una vez por clase.

1. En el panel, pulse **Copiar clave de presentador**. Vale solo para esta sala; no la comparta con estudiantes.
2. En Zoom, comparta **solo la ventana de la presentación**, no la pantalla completa.
3. En la presentación pulse **● En vivo** (o la tecla **L**), pegue la clave y pulse **Conectar participación**. La primera vez verá una guía de tres pasos; **Entendido** la oculta (vuelve con **¿Cómo funciona?**).
4. Compruebe el punto verde del botón «En vivo».

![Menú «En vivo» antes de conectar](capturas/16-presentacion-conectar.png)

El panel **no detecta** si la presentación quedó conectada: se comprueba en la presentación. Mientras no se conecte, la presentación no envía nada a ningún servidor y funciona igual. Si el curso aún no tiene Interact activado, lo debe activar el responsable técnico (véase «Qué hace cada persona»).

### A5. Iniciar la votación

En la diapositiva con la pregunta: **● En vivo → Iniciar votación · 30 s**. Los estudiantes la ven al instante, con la cuenta regresiva.

![Estudiante: votación abierta](capturas/vnext-s1-estudiante-votacion-abierta.png)

![Estudiante: respuesta registrada](capturas/vnext-s2-estudiante-respuesta-registrada.png)

Durante la votación:

- La diapositiva queda visible; ninguna capa la tapa.
- **Cerrar ahora** termina antes; **+30 segundos** da más tiempo. Al llegar a cero, **el servidor cierra la votación**, aunque su computador se desconecte.
- En el panel, la tarjeta de la encuesta muestra el tiempo, las respuestas recibidas y las **tendencias en vivo** (solo para usted, sin marcar la correcta).

![Votación abierta en el panel](capturas/vnext-04-votacion-abierta.png)

![Votación con tendencias privadas](capturas/vnext-05-votacion-con-tendencias.png)

- **Proyectar tendencias** (en «En vivo») las muestra a todos; está desactivado por omisión y nunca incluye la respuesta correcta.

![Tendencias proyectadas a petición](capturas/18-presentacion-tendencias.png)

Cerrar **no publica resultados ni revela la respuesta**.

![Votación cerrada: los resultados siguen siendo solo suyos](capturas/vnext-06-votacion-cerrada.png)

![Votación finalizada en la presentación](capturas/19-presentacion-finalizada.png)

### A6. Cerrar, publicar resultados, discutir y repetir

Secuencia recomendada: **pregunta → respuesta individual → discusión en parejas → segunda respuesta → explicación**.

1. **Mostrar resultados** (en «En vivo»; el botón equivalente del panel se llama **Publicar en teléfonos**): las barras aparecen en los teléfonos, todavía **sin** la respuesta correcta. El panel solo las publica en los teléfonos; para proyectarlas use «Mostrar resultados» en la presentación.
2. **Discutir y repetir**: tras conversar en parejas, abre la segunda ronda con el mismo tiempo.
3. Cierre y publique la segunda ronda de la misma manera.

![Resultados publicados: la solución sigue privada](capturas/vnext-07-resultados-publicados.png)

![Segunda ronda](capturas/vnext-08-segunda-ronda.png)

![Resultados en la presentación](capturas/06-presentacion-resultados.png)

### A7. Revelar la explicación

Cuando termine la discusión pulse **Revelar explicación**: marca la respuesta correcta, muestra la explicación y compara la primera con la segunda ronda. Se pulsa donde está la solución: en la presentación («En vivo» o Build Tech) para las preguntas escritas en el Markdown. **El panel no conoce la solución de una pregunta de la presentación y lo indica**. El porcentaje de acierto aparece solo después de revelar.

![Solución revelada en el panel](capturas/vnext-09-solucion-revelada.png)

![Estudiante tras revelar](capturas/vnext-s3-estudiante-solucion-revelada.png)

**Retirar de las pantallas** deja la pregunta sin votación activa en las pantallas conectadas. **No pide confirmación y el panel no ofrece reabrirla**: úselo cuando termine con esa pregunta. La comparación de rondas queda en **Preguntas de esta sesión**. Después avance a la siguiente diapositiva: la sala, el QR, los participantes y el tiempo de votación se conservan.

### A8. Finalizar la sesión

Véase «Salir, revocar claves y finalizar» más abajo.

### Cómo se escriben las preguntas de la presentación (para quien prepara el curso)

Esto lo hace el responsable técnico, una sola vez, en el Markdown de la semana:

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
- La explicación no se ve en la diapositiva ni en el PDF (con Interact encendido o apagado): aparece solo cuando usted la revela.
- Al iniciar la votación salen del computador **solo** el enunciado, el código y las opciones; la correcta y la explicación se quedan allí hasta **Revelar explicación**. El resto de la presentación, las notas y las imágenes nunca salen.
- Activar Interact en un curso (`activa: true` dentro de `LIVE` en `src/plugins/fase2.mjs`) también corresponde al responsable técnico.

---

## Recorrido B · Docente sin curso Reveal.js preparado

No necesita presentación conectada: toda la clase se conduce desde el panel.

### B1. Acceder al panel
Igual que A1: **Entrar** con la contraseña que le dio quien administra el servicio.

### B2. Crear la sala
Igual que A2: título opcional y **Crear sala**.

### B3. Compartir el enlace
Pulse **Copiar enlace** y péguelo en el chat de la clase o en su plataforma, o proyecte el QR del panel. El código también sirve (`…/join/CÓDIGO`).

![Sala creada: enlace y QR](capturas/vnext-03-sala-creada-qr.png)

Ignore el bloque **Conectar la presentación**: requiere un curso preparado.

### B4. Crear preguntas improvisadas
Abra **Crear pregunta improvisada** (plegado): escriba el enunciado, un fragmento de código opcional, el tipo, las opciones y, si quiere, marque la correcta y escriba la explicación. Pulse **Abrir votación ahora** (o **Guardar para después**). La correcta y la explicación se guardan solo en esa pestaña del navegador (sobreviven a recargarla mientras siga en la misma sala; se pierden si la cierra, vuelve a «Otras salas», cierra sesión o la sesión vence antes de revelar). Si deja a medio escribir una pregunta improvisada, el panel pide confirmación antes de descartarla.

### B5. Realizar votaciones y moderar preguntas
- Votación: **Cerrar ahora** / **+30 segundos**, **Publicar en teléfonos**, **Discutir y repetir** y **Revelar explicación** (aquí sí funciona desde el panel, porque la solución se guardó en esta pestaña); **Retirar de las pantallas** al terminar.
- Preguntas de los estudiantes: las pendientes aparecen veladas (por si comparte la ventana). Use **Leer**, **Aprobar** (los estudiantes la ven), **Marcar respondida**, **Ocultar** o **Bloquear autor**. **Proyectar en la presentación** solo tiene efecto si hay una presentación conectada. «Recibir preguntas» y «Revisar antes de publicar» están en **Configuración de la sesión**.

![Pregunta pendiente velada](capturas/vnext-10-pregunta-pendiente-velada.png)

![Pregunta aprobada](capturas/vnext-11-pregunta-moderada.png)

![Estudiante: pestaña Preguntas](capturas/vnext-s4-estudiante-preguntas.png)

El velo es solo visual: ayuda si comparte la ventana por error, pero **no sustituye** no compartir el panel (su texto sigue disponible para lectores de pantalla).

### B6. Terminar la clase
**Finalizar sesión** (véase la sección siguiente).

---

## Salir, revocar claves y finalizar

La sección **Terminar la clase** del panel resume las salidas:

![Terminar la clase](capturas/vnext-12-terminar-la-clase.png)

| Acción (botón) | La sala | Soluciones guardadas en esta pestaña | Presentación conectada | Estudiantes |
|---|---|---|---|---|
| **← Otras salas** | Sigue abierta | Se borran | No cambia | No cambia |
| **Cerrar sesión** | Sigue abierta | Se borran | No cambia | No cambia |
| **Revocar claves de presentador** (pide confirmación) | Sigue abierta; su sesión continúa | No se tocan | Se desconecta; necesita una clave nueva | No cambia |
| **Finalizar sesión** (pide confirmación) | **Se elimina** con sus encuestas, respuestas y preguntas | Se borran | Se desconecta | Ven «La sesión terminó» |

- «Otras salas» y «Cerrar sesión» **no cierran la sala**: los estudiantes siguen conectados; vuelva desde **Sus clases → Abrir panel** (si cerró sesión, entre otra vez con la contraseña).
- Las soluciones de preguntas improvisadas se **pierden** al salir de la sala o cerrar sesión: si aún no reveló, tendrá que explicar de viva voz.
- Solo **Finalizar sesión** elimina los datos de la sala. Si no la finaliza, se borra sola a las 3 horas.

![Panel tras finalizar](capturas/vnext-13-sesion-finalizada.png)

![Estudiante: la sesión terminó](capturas/vnext-14-estudiante-sesion-terminada.png)

## Tiempo de votación (una preferencia para toda la sesión)

En el panel, **Configuración de la sesión**: 15, 30, 60 o 90 segundos; **Sin límite** está en «Opción avanzada». El cambio se aplica a las **próximas** votaciones; una votación en curso conserva su tiempo. La preferencia dura lo que dure la sala.

## Build Tech: dirigir la clase desde el segundo monitor

**Build Tech** es una ventana privada para su segundo monitor (o el mismo computador): nunca la comparta. Ábrala con el botón **Vista del presentador** del pie azul → **Build Tech**, o con la tecla **T**; arrástrela al otro monitor y comparta por Zoom solo la pestaña de la presentación. Las notas clásicas de Reveal.js (tecla **S**) siguen disponibles.

![Build Tech: notas con el punto de lectura, nota anclada y vistas previas](capturas/20-build-tech-notas.png)

- **Notas** (lo más grande): las `Notes:` de cada diapositiva, en letra grande (**A−/A+**), con el punto de lectura resaltado si usó `[[0]]`, `[[1]]`… y modo **Solo notas** (tecla **N**). Las notas ancladas (`[[#mapa]]` + `data-oc-nota="mapa"`) muestran un número sobre la miniatura privada; al pulsarlo se destaca su nota. Nada de esto aparece en la pantalla compartida.
- **Navegación**: **◀ Anterior / Siguiente ▶** (paso a paso, con fragmentos) y **|◀ / ▶|** (diapositiva completa); también ←, →, Espacio, AvPág y RePág. La presentación siempre manda: si cierra Build Tech, la clase sigue igual.
- **Tres relojes independientes**: la hora; el **tiempo de clase** (elija 45, 60, 90 o los minutos que quiera e **Iniciar**; **Pausar**, **Reanudar**, **Reiniciar…** con confirmación; al terminar solo avisa, la sala En vivo no se cierra); y el **tiempo de votación** (el global de la sala, 30 s por defecto). Cambiar de pregunta nunca reinicia el tiempo de clase. **Hora en la presentación** muestra, solo si la activa, una hora pequeña en la pantalla compartida.
- **Multimedia**: reproducir, pausar, reiniciar, posición, volumen y silencio del video o audio de la diapositiva, y de los videos de YouTube (API oficial). Suena solo la presentación; las miniaturas nunca reproducen. Si el navegador bloquea el sonido, pulse una vez sobre la presentación. Otros proveedores muestran «Control externo no disponible».

![Build Tech: control del video de la presentación](capturas/21-build-tech-video.png)

- **En vivo**: con la sala conectada en la presentación (la clave se pega allí, nunca en Build Tech), las mismas acciones del menú «En vivo»: iniciar la votación de la diapositiva, ver las tendencias A/B/C/D en privado, **+30 segundos**, **Cerrar ahora**, **Mostrar resultados**, **Discutir y repetir**, **Revelar explicación**, **Retirar encuesta**, ampliar el QR y moderar las preguntas de los estudiantes. Nada se proyecta sin que usted lo pulse.
- **Solución privada**: plegada; al abrirla ve la respuesta correcta y la explicación sin publicarlas.

![Build Tech durante una votación: tendencias privadas y acciones del momento](capturas/22-build-tech-votacion.png)

![La explicación revelada desde Build Tech, en la presentación compartida](capturas/23-presentacion-revelada-desde-build-tech.png)

Privacidad: Build Tech se comunica con la presentación solo dentro del navegador (misma computadora, mismo origen); no envía notas ni estado al servidor. Recuerde que las `Notes:` de un curso **publicado** en GitHub Pages viajan con sus diapositivas: Build Tech no las proyecta, pero no las vuelve secretas.

## Exportar a PDF

El botón de impresora **Exportar a PDF** del pie azul abre una pestaña con todas las diapositivas de la semana y el diálogo de impresión: elija **Guardar como PDF** (horizontal, «Gráficos de fondo» activado). El PDF lleva una página 16:9 por diapositiva, sin notas, soluciones, QR, controles ni capas de En vivo; cada video integrado aparece como su título y su enlace.

## Teclado y accesibilidad

- **L** abre o cierra «En vivo»; el foco va a la acción principal del momento. **Esc** lo cierra y devuelve el foco al botón.
- **Q** amplía o reduce el QR.
- **T** abre Build Tech; dentro de Build Tech: ← → navegan, **N** solo notas, **+ / −** letra, **L** lleva a En vivo.
- Tabulador recorre las acciones; Espacio e Intro las activan sin cambiar de diapositiva.

## Si se pierde la conexión

- **Un estudiante** (pantalla bloqueada, cambió de red): vuelve solo o recargando el mismo enlace; conserva su respuesta.
- **Su presentación**: se reconecta sola («Reconectando…» en el botón). Si recarga la página, recupera la sala y continúa donde quedó; una votación que venció mientras tanto aparece como **Votación finalizada**. Si dice que la clave no es válida o venció, copie una nueva desde el panel.
- **El panel**: recargue la página; vuelve a la sala abierta.
- **Si el servidor se reinició**, las salas abiertas se pierden (se guardan solo en memoria): cree una sala nueva y conecte de nuevo.
- La presentación funciona siempre aunque Interact no esté disponible.

Nota: la participación es anónima. El sistema evita votos duplicados por accidente, pero no puede garantizar un voto por persona si alguien usa varios dispositivos.
