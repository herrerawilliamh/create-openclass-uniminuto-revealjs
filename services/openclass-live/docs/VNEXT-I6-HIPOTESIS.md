# I6-C — Verificación de las hipótesis H01–H08

Origen: tabla «Hipótesis H01 a H08» del `DESIGN-BRIEF.md` de la misión Hermes `openclass-live-20261105-081638` (recuperado de `%LOCALAPPDATA%\hermes\missions\…`). Ese documento las declara «no defectos demostrados». Aquí se conserva ese estatus: **ninguna se convierte en defecto sin evidencia**, y las decisiones que cambiarían código o backend quedan como pendientes de autorización (véase al final).

Base: `cb36b98acf0ed64668478bab0649a17ab4558132` (I0–I5 aprobados). I6 no cambia código funcional.

Prueba común: `tests/e2e/i6-evidencia-navegador.test.mjs` (Chrome real, aplicación local, datos sintéticos, estudiantes por Socket.IO y una página de estudiante a 390 px). Mediciones brutas en `docs/evidencia-i6/evidencia-i6.json`. Las páginas se midieron a 320, 390, 640, 768, 1024 y 1440 px CSS.

Leyenda: **CONFIRMADA** = la evidencia muestra lo que la hipótesis afirma; **DESCARTADA** = la evidencia la contradice; **NO_VERIFICADA** = falta el medio de prueba. Confirmar un hecho no equivale a declarar un defecto.

| ID | Resultado | Resumen |
|---|---|---|
| H01 | NO_VERIFICADA | Precondición estructural confirmada; falta lector de pantalla. |
| H02 | CONFIRMADA | El panel con la sesión cerrada o vencida sigue recibiendo estado. |
| H03 | CONFIRMADA (parcial) | El velo es visual; el servidor no expone las pendientes a otros estudiantes. |
| H04 | CONFIRMADA (estado medido) | Sin desborde horizontal a 320 px; cinta no pegajosa a 320 px. |
| H05 | DESCARTADA (campos y botones) | Los bordes miden 6,29:1 y 6,97:1, no 1,35:1. Casillas nativas sin medir. |
| H06 | NO_VERIFICADA | No hay captura del caso «sin hueco»; hay evidencia previa de colocación. |
| H07 | CONFIRMADA | Retirar no pide confirmación y el panel no ofrece reabrir. |
| H08 | CONFIRMADA | El token local sobrevive si el estudiante no estaba conectado al terminar la sala. |

## H01 — Regiones ARIA durante una votación
- **Hipótesis**: limitar las regiones vivas a mensajes de transición.
- **Evidencia**: el panel declara 8 regiones (`conexion`, `error-login`, `aviso-salas`, `aviso-sala`, `panel-activa`, `error-encuesta`, `aviso-enlace`, `aviso-clave`). `#panel-activa` es `aria-live="polite"` y contiene tiempo, respuestas y tendencias. Un `MutationObserver` sobre las regiones registró **6 mutaciones en `#panel-activa` tras 3 votos** (dos por voto). En el estudiante, `#panel-encuesta` es `aria-live="polite"` y contiene toda la tarjeta; I3 hace que solo se rehaga cuando cambia la encuesta (no se midió de nuevo aquí).
- **Prueba**: observador de mutaciones en Chrome, 3 votos reales por Socket.IO.
- **Resultado**: **NO_VERIFICADA**. Que una región viva se modifique en cada voto es condición necesaria para anuncios repetidos, pero lo que NVDA o VoiceOver realmente anuncian no se midió (no hay lector de pantalla disponible en este entorno).
- **Riesgo pendiente**: posible exceso de anuncios en el panel durante votaciones concurridas. Sin evidencia de que ocurra.
- **Recomendación**: probar con NVDA + Chrome y VoiceOver (matriz en `VNEXT-I6-ACCESIBILIDAD.md`). Solo si se confirma ruido, valorar mover `aria-live` a una línea de estado breve. Es un cambio funcional: requiere autorización (D-I6-1).

## H02 — Sesión vencida y revocación entre pestañas
- **Hipótesis**: se documenta; una solución puede requerir backend (D9 del brief).
- **Evidencia**:
  1. Pestaña A cierra sesión; la pestaña B, que ya estaba dentro de la sala, siguió mostrando la sala y **siguió recibiendo estado** (conectados 5 → 6 al entrar un estudiante). En su siguiente acción privilegiada, B pasó a la pantalla de acceso (el servidor rechazó la acción y la I2 limpia lo privado).
  2. Con el reloj de autenticación adelantado 61 min (sesión de 1 h vencida; la sala dura 3 h), el panel abierto siguió en la sala y **siguió recibiendo estado** (0 → 1 conectados).
- **Prueba**: `i6-evidencia-navegador` (dos pestañas del mismo navegador; el reloj se adelanta con `Date.now` dentro del proceso de prueba, sin retroceder, porque los limitadores lo usan).
- **Resultado**: **CONFIRMADA** como comportamiento: el socket autenticado del panel no se corta al cerrar sesión ni al vencer la sesión; las acciones sí exigen sesión válida.
- **Riesgo pendiente**: una pestaña olvidada en un equipo compartido sigue mostrando datos de la sala (conteos, texto de preguntas) hasta su siguiente acción o recarga. La simulación de reloj no reproduce un vencimiento real de 8 h; el comportamiento del servidor en ese caso es el mismo código.
- **Recomendación**: no cambiar nada ahora. Cortar los sockets del panel al cerrar sesión o vencer es un cambio de backend (D9, D-I6-2): requiere autorización, nueva versión y nuevo manifiesto GitOps.

## H03 — Privacidad de preguntas pendientes
- **Hipótesis**: el velo no se trata como barrera; propuesta: no insertar el texto hasta «Leer» (D5).
- **Evidencia**: la pregunta pendiente aparece en el panel con clase `velo` y `filter: blur(5px)`; el texto **está en el DOM**, sin `aria-hidden`, y el botón **Leer** lo desvela. Un segundo estudiante conectado **no recibió** el texto en ningún `estado` mientras la pregunta estaba pendiente.
- **Prueba**: `i6-evidencia-navegador` (pregunta enviada por un estudiante con la revisión previa activa; segundo estudiante escuchando `estado`). Captura `vnext-10-pregunta-pendiente-velada.png`.
- **Resultado**: **CONFIRMADA (parcial)**: (a) el velo es solo visual — un lector de pantalla o quien inspeccione el DOM puede leer el texto; (b) hacia otros estudiantes, la pendiente no sale del servidor. La legibilidad con zoom y la lectura por lector de pantalla no se probaron; la presentación conectada tampoco (cubierto por las pruebas de integración de proyección, no por I6).
- **Riesgo pendiente**: bajo si no se comparte el panel; la guía lo dice y ya no promete que el velo sea una barrera.
- **Recomendación**: documentar (hecho). No insertar el texto hasta «Leer» cambia comportamiento y una prueba existente (`.velo`): decisión D5 (D-I6-3).

## H04 — Reflow a 320 CSS px y zoom al 400 %
- **Hipótesis**: cinta con envoltura; pegajosa solo con altura suficiente.
- **Evidencia** (panel, sala con votación y votos): sin desborde horizontal a 320 (zoom 400 % de 1280 px), 390, 640 (zoom 200 %), 768, 1024 y 1440 px; `scrollWidth` igual al ancho de ventana y ningún elemento fuera de ella. A 320 px la cinta pasa a `position: static` (206 px, 81 % de una ventana de 256 px de alto); a 390 px es pegajosa y ocupa 22 % del alto; a 640 px, 30 %. El estudiante tampoco desborda a 320, 390, 640, 768 y 1440 px.
- **Prueba**: emulación de viewport de Chrome (equivale en píxeles CSS al zoom del navegador, pero **no** es zoom real del navegador ni aplica el espaciado de texto de 1.4.12).
- **Resultado**: **CONFIRMADA** para el estado medido: el reflow funciona y la cinta no se pega cuando ocuparía casi toda la ventana.
- **Riesgo pendiente**: no se midieron títulos de 80 caracteres sin espacios, teclado virtual móvil ni zoom real; las vistas de acceso y de lista se midieron solo en el recorrido a 1280 px (contraste y objetivos), no a 320 px.
- **Recomendación**: repetir en un dispositivo real (matriz del documento de accesibilidad). Sin cambios de código.

## H05 — Contraste de componentes
- **Hipótesis**: el borde de campo debería usar `--grafito`; el brief calculaba 1,35:1 para el borde del diseño anterior.
- **Evidencia**: en el código actual, el borde de `input`, `textarea` y `select` mide **6,29:1** contra su fondo; los botones secundarios, **6,97:1**; el relleno de los primarios, 5,31:1; «Finalizar sesión», 6,57:1; el botón blanco sobre la cinta, 5,31:1. En 9 estados del panel y 1 del estudiante, **0 fallos de contraste de texto** (4,5:1 normal, 3:1 grande), con fondo sólido o translúcido (no se evalúan degradados ni imágenes de fondo).
- **Prueba**: medición en Chrome de colores computados (fórmula WCAG).
- **Resultado**: **DESCARTADA** para campos y botones: el 1,35:1 pertenecía al estado previo a I4. **NO_VERIFICADA** para las casillas y radios nativos (sin borde CSS; dependen del navegador) y para el contraste del anillo de foco (deducido de sus colores `#20263D` sobre claro, no medido contra cada fondo).
- **Riesgo pendiente**: bajo. Casillas nativas: revisar con alto contraste de Windows.
- **Recomendación**: ninguna acción de código.

## H06 — Espacios disponibles para el QR en Reveal.js
- **Hipótesis**: fuera del alcance visual del panel; no repetir la promesa documental; capturar el caso `oc-live-p-sin-hueco`.
- **Evidencia disponible (previa, no repetida en I6)**: `live-navegador.test.mjs` (verde en I5) comprueba el QR junto a la pregunta sin solapes a 1920×1080, 1920×945 y 1536×730 con `elegirHueco()`. **No** hay captura del caso sin hueco (QR reducido a la «ficha» con solo el código).
- **Resultado**: **NO_VERIFICADA** en I6: forzar «sin hueco» exige construir un curso con una diapositiva saturada; no se hizo para no ampliar el alcance ni tocar la plantilla. La guía dice «si no hay espacio, solo el código», que es lo que el código declara, pero esa rama no tiene captura.
- **Riesgo pendiente**: una diapositiva muy cargada podría quedar sin QR visible; el código sí aparece.
- **Recomendación**: pedir al responsable técnico que revise visualmente las diapositivas de pregunta con mucho contenido antes de la clase (ya reflejado en «Qué hace cada persona»). Test de captura del caso: propuesta futura (D-I6-4).

## H07 — Retiro accidental de resultados
- **Hipótesis**: advertir al retirar; no añadir reapertura (exigiría cambio funcional).
- **Evidencia**: «Retirar de las pantallas» se ejecuta al primer clic: **0 confirmaciones** (`confirm()` no se invocó) y, después, ningún botón del panel (ni del historial) permite reabrir. El historial conserva la pregunta con la comparación de rondas («R1: 3 resp., 66.7 % acierto · R2: 4 resp., 75 % acierto»), de modo que los números no se pierden.
- **Prueba**: `i6-evidencia-navegador` (clic en el botón con `window.confirm` contado).
- **Resultado**: **CONFIRMADA**: no hay confirmación ni reapertura desde el panel.
- **Riesgo pendiente**: moderado en clase (un clic involuntario retira la pregunta de las pantallas); los datos persisten en el historial. La guía lo advierte.
- **Recomendación**: pedir confirmación solo en el cliente es un cambio acotado, pero cambia comportamiento y pruebas existentes (`panel-foco` mueve el foco tras retirar): requiere autorización (D-I6-5). La reapertura queda descartada por el brief.

## H08 — Retención de tokens locales en salas vencidas
- **Hipótesis**: sin cambio ahora, salvo revisar la frase «sin datos personales» si el alias se queda.
- **Evidencia**: la clave `oclive:CÓDIGO` en `localStorage` contiene solo `token`. Con el estudiante **conectado** cuando la sala termina, la clave se borra. Con el estudiante **desconectado** (página cerrada), la clave **permanece**; se borra la próxima vez que abre ese código y el servicio responde que la sala ya no existe.
- **Prueba**: `i6-evidencia-navegador` (dos salas finalizadas, una con el estudiante conectado y otra no). No se probó el vencimiento por 3 h (mismo camino de código que finalizar para el estudiante).
- **Resultado**: **CONFIRMADA**: hay retención residual de un token de sala ya inexistente en el navegador del estudiante.
- **Riesgo pendiente**: bajo: el token pertenece a una sala eliminada y no contiene datos personales (el alias, si existe, no se guarda en esa clave según la medición). Quedaría revisar el texto de privacidad si en el futuro se guarda el alias.
- **Recomendación**: sin cambios ahora. Una limpieza proactiva de claves `oclive:*` antiguas sería un comportamiento nuevo (D-I6-6).

## Decisiones que requieren autorización adicional

| Id | Decisión | Origen | Efecto si se aprueba |
|---|---|---|---|
| D-I6-1 | Mover `aria-live` del panel a una línea de estado | H01 | Cambio de cliente; solo si NVDA/VO confirman ruido. |
| D-I6-2 | Cortar sockets del panel al cerrar sesión o vencer | H02 / D9 | Cambio de backend: versión nueva y manifiesto GitOps. |
| D-I6-3 | No insertar texto pendiente hasta «Leer» | H03 / D5 | Cambio de cliente y de una prueba existente. |
| D-I6-4 | Prueba/captura del caso QR «sin hueco» | H06 | Pruebas nuevas con curso de plantilla. |
| D-I6-5 | Confirmación al retirar | H07 | Cambio de cliente; ajustar `panel-foco`. |
| D-I6-6 | Limpieza proactiva de `oclive:*` caducadas | H08 | Comportamiento nuevo en el estudiante. |
