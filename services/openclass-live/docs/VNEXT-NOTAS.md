# Notas de decisión técnica — Teacher Experience VNext

Base auditada: `2006af3907026c5bf4997ca4890e484adc386ab9`. Copia aislada local, sin remoto.

## I0 — `preparacion-release.test.mjs:29` (commit 8b02f6e)
- Causa: en Windows, `tar` resuelve a GNU tar de Git for Windows, que interpreta `C:\…` como host remoto (`Cannot connect to C: resolve failed`, código 2). El paquete y el empaquetador son correctos.
- Cambio: el test lista el archivo con ruta relativa y `cwd: dir`. Empaquetador intacto.
- Prueba: `node --test tests/preparacion-release.test.mjs` 2/2.

## I1 — OC-A02 atomicidad de encuestas (commit eebdc33)
- Causa: `encuesta:crear` con `abrir:true` creaba la encuesta y luego fallaba en `abrirEncuesta` (`otra_abierta`), dejando una encuesta residual.
- Cambio: `crearEncuesta(salaId, def, { abrir })` valida (límite y votación abierta) antes de mutar; `sockets.mjs` lo invoca en una sola operación. Protocolo, eventos y acuses sin cambios.
- Archivos: `src/salas.mjs`, `src/sockets.mjs`, `tests/unidad.test.mjs`, `tests/integracion.test.mjs`.
- Pruebas: unidad + Socket.IO nuevas; `npm test` 36/37.
- Pendiente: `gitops-release.test.mjs` falla porque `releases/0.2.0.json` certifica el payload aprobado. Cualquier cambio en `src/` exige una versión nueva y su manifiesto; no se regeneró.

## I2 — Recuperación y confiabilidad del panel (OC-A01, OC-A06, OC-A10, O-01, O-09)
Los textos originales de los hallazgos no están en la copia aislada; el alcance se tomó del encargo. Solo cambia el cliente del panel (`public/assets/docente.mjs`, `comun.mjs`, `docente/index.html`). Sin cambios en autenticación, cookies, CSRF ni protocolo Socket.IO.
- `api()` nunca rechaza: red y tiempo agotado (10 s) → `{ estado: 0, falla }`. `mensajeHttp()`/`esTransitorio()` (en `comun.mjs`, puras y probadas) traducen red, timeout, 401, 403, 429 y 5xx. Transitorio = red, timeout, 429, 5xx.
- `emitir()` marca `transitorio: true` cuando no hay socket o el acuse no llega; así ningún llamador confunde «sin respuesta» con «la sala ya no existe».
- Acceso: botón «Entrando…» con `aria-busy`, siempre reutilizable; foco vuelve a la contraseña; la contraseña se borra solo si fue rechazada (401/403), no ante fallos pasajeros. Si la conexión en vivo falla tras el acceso se avisa.
- Comprobación de sesión al abrir: solo `200 sin autenticar`, 401 y 403 limpian lo privado; ante red/429/5xx se conservan soluciones y borradores y aparece «Reintentar conexión».
- Salir: el estado local se limpia siempre; solo con HTTP 200 se omite el aviso. Si falla, el aviso dice que NO se pudo confirmar el cierre en el servidor (el servidor responde 200 incluso sin sesión, así que 200 es la única confirmación).
- «Copiar enlace»: «Enlace copiado.» solo si `writeText` resolvió; si falla o no existe el API, el enlace queda seleccionado con instrucción de Ctrl+C.
- Recepción/moderación de preguntas y tiempo de votación: ante rechazo o timeout la casilla vuelve a `estado.sala` (valor confirmado) y se explica.
- `sala:seguir`: un timeout o desconexión ya no llama a `dejarSala()`; conserva soluciones y borrador, avisa y reintenta (3 veces, 2/4/6 s) además del reintento natural en cada `sesion`. Solo `sala_inexistente`/`sala_vencida` (o la sala ausente de la lista) limpian, con el aviso «La sala ya no está disponible…». Ciclo de vida de limpieza sin cambios (revelar, salir, sesión vencida, cambiar/dejar sala, fin/vencimiento).
- Pruebas: `tests/interfaz.test.mjs` (2) y `tests/e2e/panel-recuperacion-navegador.test.mjs` (7, Chrome real; fallos simulados en el cliente con fetch/acuses). Regresión: `panel-contexto` y `panel-soluciones` verdes (una ejecución de panel-contexto falló con `EBUSY` en el perfil temporal de Chrome en Windows; reejecutada sola pasa).
- Gate GitOps: sigue fallando solo por el manifiesto histórico `releases/0.2.0.json` (el payload `public/` cambió). Sin regenerar.

## I3 — Foco, navegación y accesibilidad (OC-A03, OC-A04, OC-A07, O-02)
Solo cliente (`comun.mjs`, `docente.mjs`, `estudiante.mjs`); sin cambios de protocolo ni de selectores existentes (ids `btn-cerrar`, `btn-publicar`, `btn-ronda2`, `btn-revelar`, `btn-retirar`, `.opciones`, `#opciones input[type=text|checkbox]`, etc.).
- **DESIGN-BRIEF.md no existe en la copia aislada** (ni en `/c/tmp` ni en el repo); el mapa de foco se infirió de la regla ya documentada («el foco va a la acción principal del momento») y queda como hallazgo abierto para confirmar con Codex:
  cerrar → «Mostrar resultados»; publicar → «Discutir y repetir» (ronda 1) o «Revelar explicación» (ronda 2 / con solución local); repetir → «Cerrar ahora»; revelar → «Retirar de las pantallas»; retirar → encabezado de la tarjeta (`#titulo-activa`, `tabindex=-1`).
  Regla común: solo si el foco estaba dentro de la tarjeta; si su control sigue existiendo, se queda; un foco fuera (p. ej. el formulario improvisado) no se mueve.
- `sincronizarLista()` (comun.mjs): reconciliación por clave. Un elemento sin cambios conserva su nodo y foco; uno cambiado se reemplaza y el foco pasa al control de su mismo `data-slot` (proyectar↔quitar, ocultar↔restaurar) o, si desapareció (p. ej. «Aprobar»), al siguiente de la misma pregunta; los apoyos se actualizan en el sitio. El orden por apoyos del servidor NO se reaplica con foco dentro o puntero encima (lo nuevo va al final) y se aplica al salir (`focusout`/`mouseleave`). Usada en preguntas del docente, historial del docente y preguntas del estudiante.
- Estudiante: la tarjeta de la encuesta se rehace solo si cambia `estado.encuesta` (firma JSON); si se rehace, el foco vuelve a la misma opción/botón «Enviar» o, si ya no admite foco (votación cerrada), al enunciado. Los apoyos y preguntas nuevas ya no la tocan.
- Opciones improvisadas: «Opción A», «Respuesta correcta de A», «Quitar opción A» (se reasignan al quitar); al quitar, el foco pasa a la opción que ocupa su lugar.
- Pruebas: `tests/e2e/panel-foco-navegador.test.mjs` (5, Chrome con estudiantes Socket.IO reales). Suite del servicio: 38/39 (solo el gate GitOps); navegador 19/19.
- Gate GitOps: falla igual en la base `309f970` (verificado), por `releases/0.2.0.json`; no es una regresión.

## I4 — Teacher Experience VNext (rediseño visual y de experiencia del panel docente)
Base `cfa0ef1b6c2407f6ccffa8ad0106987ba68c9ea5`. Solo cliente: `public/docente/index.html`, `public/assets/docente.css` (nuevo, `style-src 'self'`), `public/assets/docente.mjs`. Sin cambios de autenticación, CSRF, CSP, protocolo 2 ni contratos del servidor. HTML/CSS/JS nativos, sin dependencias.
- Artefactos recuperados de la misión Hermes `openclass-live-20261105-081638` (`%LOCALAPPDATA%\hermes\missions\...`): DESIGN-BRIEF.md, CLAUDE-DESIGN.md, CODEX-AUDIT.md y teacher-experience-vnext.html. Se reutilizó la maqueta (cinta, hoja, «Quién ve qué», tokens); no se rehízo la propuesta. Nota: el DESIGN-BRIEF.md recuperado se refiere a la base `2006af3`, anterior a I0–I3; solo se tomaron decisiones coherentes con el código actual.
- Orden: pregunta activa → tiempo → participación → acción principal → tendencias privadas → «Quién ve qué ahora». QR, enlace y conexión de la presentación pasan a la columna secundaria «Compartir con la clase» (después en el DOM y en el orden de tabulación; en móvil quedan tras preguntas).
- Cinta con código de sala y navegación real por anclas (Encuesta, Preguntas con contador de pendientes, Compartir, Cierre); visible solo dentro de una sala. Enlace «Saltar al contenido».
- «Mostrar resultados» del panel pasa a «Publicar en teléfonos» (mismo `btn-publicar` y evento); la presentación conserva «Mostrar resultados» en «En vivo». Cada paso explica su alcance (nota bajo los botones) y «Quién ve qué» solo afirma lo que el panel sabe: la presentación se declara «no detectable desde aquí». Ninguna capacidad nueva ni botón sin comportamiento.
- Cierre: sección «Terminar la clase» con tabla de salidas (Otras salas, Cerrar sesión, Finalizar) y los mismos botones (`btn-revocar`, `btn-finalizar`); se mantiene `confirm()` nativo (no se cambió el flujo de confirmación).
- Estados: «Cargando salas…» mientras se pide la lista; vacío con instrucción; avisos con borde además de color.
- Paleta: #5464BF (cinta, acción principal), #B3B3B3 (reservada, no usada como texto), #F2E205 (foco/contador, texto #20263D 11,1:1), #F27405 → variante #8A4300 para texto (6,56:1). Texto de acción secundaria #4352A8 (6,97:1 sobre blanco); blanco sobre #5464BF 5,31:1. Objetivo táctil 44 px.
- Test actualizado: `live-navegador` buscaba `.closest('.tarjeta')` (ahora `.hoja`); selector `'.hoja, .tarjeta'`.
- Verificación: `npm test` 38/39 (solo gate GitOps); e2e Chrome: panel-foco 5, panel-contexto 2, panel-recuperacion 7, panel-soluciones 1, live 1, protocolo 1, todos OK. Chrome real a 390/768/1024/1440 px antes/después: sin desbordamiento horizontal ni errores de consola (evidencia en `C:\tmp\openclass-i4-evidencia\`). No se afirma conformidad WCAG: no se probó con lector de pantalla ni zoom 400 %.
- Gate GitOps: sigue fallando igual que en la base (verificado con `git stash`), por `releases/0.2.0.json`. No editado.
