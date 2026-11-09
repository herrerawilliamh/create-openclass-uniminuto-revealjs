# I6-D — Verificación de accesibilidad

Base `cb36b98acf0ed64668478bab0649a17ab4558132`. Sin cambios de código funcional.

> **No se declara conformidad con WCAG 2.2 AA.** Lo que sigue es evidencia parcial: verificaciones automatizadas en Chrome y comprobaciones manuales de teclado y estructura. No hubo lector de pantalla, ni dispositivo iOS/Android, ni zoom real del navegador. Las combinaciones no ejecutadas figuran como **PENDIENTE**, nunca como PASS.

## 1. Qué se midió y cómo

Prueba: `tests/e2e/i6-evidencia-navegador.test.mjs` (Chrome headless por CDP, aplicación local, datos sintéticos). Datos brutos: `docs/evidencia-i6/evidencia-i6.json`. Reutilizada de I5: 24/24 casos de navegador (incluye las pestañas ARIA del estudiante, el foco del panel y la fiabilidad de envío); no se repitió porque I6 no toca archivos funcionales.

| Verificación | Método | Resultado (evidencia) | Estado |
|---|---|---|---|
| Teclado completo del panel | 20 pulsaciones reales de Tab en la sala con votación abierta | Recorre enlace de salto → Cerrar sesión → navegación de secciones → controles de la encuesta → formulario improvisado → Compartir → Configuración → Cierre y **vuelve al inicio**; sin trampas | PASS (panel, estado medido) |
| Foco visible | Estilo computado de cada elemento enfocado | Los 19 elementos enfocados tienen contorno de ≥ 2 px o sombra; ninguno sin indicador | PASS (presencia; contraste del anillo no medido) |
| Orden de lectura | Posición de cada sección frente al orden del DOM | DOM: encuesta, preguntas, improvisada, historial, luego Compartir, Configuración, Cierre; en pantalla, columna izquierda y después derecha (en móvil, apiladas en ese orden) | PASS (estructura); lectura real PENDIENTE |
| Formularios y errores | Envío con contraseña incorrecta | Aviso `role="alert"` «Contraseña incorrecta.», foco de vuelta al campo, `aria-describedby="error-login"` | PASS |
| Pestañas ARIA (estudiante) | Pruebas I5 (`estudiante-fiabilidad-navegador`) | `tablist/tab/tabpanel`, `tabindex` móvil, flechas, Inicio/Fin | PASS (evidencia de I5) |
| Anuncios de estado | Inventario de regiones y mutaciones | 8 regiones en el panel; `#panel-activa` (`polite`) mutó 6 veces con 3 votos | Anuncio real NO_VERIFICADO (H01) |
| Contraste de texto | Colores computados en 10 estados (9 panel, 1 estudiante) | 0 fallos de 4,5:1 (3:1 en texto grande) | PASS (fondos sólidos; degradados/imágenes no evaluados) |
| Contraste de componentes | Bordes y rellenos de campos y botones | Campos 6,29:1; botones secundarios 6,97:1; primarios 5,31:1 | PASS; casillas/radios nativos sin medir |
| Reflow a 320 CSS px | Viewport 320×256 (equivale al zoom 400 % de 1280×1024) | Sin desborde horizontal (panel y estudiante) | PASS (emulación) |
| Zoom 200 % | Viewport 640×512 | Sin desborde | PASS (emulación) |
| Pantallas 390, 768, 1024, 1440 px | Viewport emulado, panel y estudiante | Sin desborde horizontal ni elementos fuera de ventana; sin errores de consola | PASS |
| Tamaño de objetivos (2.5.8) | Elementos interactivos < 24×24 px | Casillas 22×22 px (premoderación, recepción, revisión; opciones correctas del formulario), radio «sin límite» 13×13 px, enlace inline 217×19 | Observación: sin evidencia para declarar fallo (las etiquetas son clicables y hay excepción para enlaces en línea); revisar |

Limitaciones: la emulación de viewport no aplica el espaciado de texto de 1.4.12 ni el zoom real del navegador; no se midieron títulos de sala de 80 caracteres; la medición de contraste ignora el anillo de foco frente a cada fondo.

## 2. Matriz de lectores de pantalla y dispositivos

Estado: **PENDIENTE** significa «no ejecutado, sin resultado». Ninguna fila está en PASS.

| Combinación | Estado | Qué debe comprobar quien la ejecute |
|---|---|---|
| Chrome + NVDA, Windows | **PENDIENTE** (NVDA no disponible en el entorno de I6) | Ver lista de casos |
| Safari + VoiceOver, iOS | **PENDIENTE** (sin dispositivo iOS) | Ver lista de casos |
| Chrome + TalkBack, Android | **PENDIENTE** (sin dispositivo Android) | Ver lista de casos |

Casos a ejecutar en cada combinación (anotar versión del lector/navegador/sistema, fecha, persona y resultado: PASS, FALLA o NO_APLICA, con observaciones):

| Caso | Panel docente | Vista del estudiante |
|---|---|---|
| 1. Entrar: etiqueta del campo, aviso de contraseña incorrecta | ✔ | — |
| 2. Crear sala: anuncio de la sala creada y localización del código y del QR (texto alternativo) | ✔ | — |
| 3. Votación abierta: ¿se anuncian tiempo y votos en exceso? (H01) | ✔ | ✔ |
| 4. Seleccionar y enviar respuesta: estado «Enviando…», «registrada» | — | ✔ |
| 5. Pestañas Encuesta/Preguntas: flechas, rol y selección | — | ✔ |
| 6. Cierre, publicación, segunda ronda y revelación: foco y anuncios | ✔ | ✔ |
| 7. Pregunta pendiente velada: ¿se lee el texto antes de «Leer»? (H03) | ✔ | — |
| 8. Moderación: Leer, Aprobar, Proyectar; foco tras aprobar | ✔ | — |
| 9. Terminar la clase: tabla de salidas, confirmaciones, aviso final | ✔ | ✔ («La sesión terminó») |
| 10. Zoom 200 % y 400 % reales; giro de pantalla (móvil) | ✔ | ✔ |

## 3. Hallazgos candidatos (sin convertir en defecto)

1. `aria-live` sobre toda la tarjeta de votación (H01): pendiente de lector de pantalla.
2. Velo de preguntas solo visual (H03): documentado en la guía.
3. Objetivos de 22 px en casillas (2.5.8): revisar si se agranda el área clicable; cambio de cliente no autorizado en I6.

## 4. Cómo repetir las mediciones

```bash
cd services/openclass-live
OPENCLASS_CAPTURAS=<carpeta> OPENCLASS_I6_EVIDENCIA=<carpeta> node --test tests/e2e/i6-evidencia-navegador.test.mjs
```

Requiere Node ≥ 22 y Chrome instalado. Sin las variables, solo ejecuta las comprobaciones.
