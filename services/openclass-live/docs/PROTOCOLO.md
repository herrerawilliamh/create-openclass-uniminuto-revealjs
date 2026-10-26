# OpenClass Live — protocolo Socket.IO

Socket.IO 4 (WebSocket con respaldo HTTP long-polling). Todos los eventos del cliente usan **acuse**:
`socket.emit(evento, datos, (r) => …)` con `r = { ok: true, … }` o `{ ok: false, error, mensaje }`.
Un evento sin función de acuse se ignora. El servidor es la única fuente de verdad: los resultados se calculan allí.

Códigos de error frecuentes: `validacion`, `frecuencia`, `sala_inexistente`, `sala_vencida`, `sala_llena`, `bloqueado`, `prohibido`, `clave`, `no_autenticado`, `no_activa`, `cerrada`, `ronda`, `otra_abierta`, `no_abierta`, `no_cerrada`, `revelada`, `sin_limite`, `limite_tiempo`, `preguntas_cerradas`, `limite_*`.

## Tiempo de votación

Una sola preferencia por sala: `sala.duracionVotacion` en segundos (`15`, `30` por omisión, `60`, `90`; `0` = sin límite).
Al abrir una ronda el servidor fija su vencimiento absoluto `cierra` (ms del reloj del servidor; `null` sin límite);
cambiar la preferencia solo afecta a las rondas siguientes. Cada `estado` incluye `servidor` (hora del servidor en ms)
para que los clientes cuenten hacia atrás sin depender del reloj del equipo: **el servidor no emite un mensaje por
segundo**. Al vencer, el servidor cierra la ronda una sola vez (`cierre: 'tiempo'`; `'docente'` si se cerró a mano o se
retiró) y difunde el estado; nunca publica resultados ni revela la respuesta. Toda lectura aplica los vencimientos
pendientes, así ninguna respuesta tardía entra aunque el temporizador se retrase. El estado es en memoria: un reinicio
del servicio pierde las salas (sin base de datos).

## Espacio `/participante` (estudiantes)

Handshake: `auth: { codigo: 'K7M2QP', alias?: '≤30', token?: '<token de reconexión>' }`; origen = `APP_URL`.
Una sala dura toda la clase (`ROOM_TTL_MINUTES`, 180 por omisión) y la presentación vuelve a usar su
código para cada encuesta; al conectarse, `sesion.estado` ya trae la encuesta abierta, si la hay
(entrada tardía). Código: 6 caracteres de `ALFABETO_CODIGO` (31 símbolos, sin 0/O ni 1/I/L: 31⁶ ≈ 8,9·10⁸ combinaciones). Posible
evolución, no implementada: 8–9 dígitos numéricos, más fáciles de dictar o escribir en un teclado
numérico (10⁸–10⁹ combinaciones); exigiría cambiar `codigoSala()` en `validar.mjs`, la ruta
`/qr/` y `/join/` de `http.mjs`, el generador de `salas.mjs` y sus pruebas.
Rechazos (`connect_error.message`): `origen`, `frecuencia`, `validacion`, `sala_inexistente`, `sala_vencida`, `sala_llena`, `bloqueado`.

| Dirección | Evento | Datos | Respuesta / efecto |
| --- | --- | --- | --- |
| S→C | `sesion` | `{ token, reconectado, estado }` | Guardar `token` para reconectarse. |
| S→C | `estado` | vista del participante | `servidor` (ms). Encuesta activa con `cierra` (ronda abierta) y **sin** `correctas`, `explicacion` ni `porcentajeCorrecto` hasta revelarlas; `rondas` (lista blanca: `numero`, `estado`, `respondientes`, `conteos`, `porcentajes`, `cierre`) solo tras publicar resultados; `porcentajeCorrecto` solo si además se reveló. |
| C→S | `estado:solicitar` | `{}` | `{ estado }` |
| C→S | `encuesta:responder` | `{ encuestaId, ronda, seleccion: [índices] }` | `{ respuesta }`. Reemplaza la respuesta previa de la misma ronda. |
| C→S | `pregunta:enviar` | `{ texto }` (3–280) | `{ pregunta: { id, estado } }` (`pendiente` con premoderación). |
| C→S | `pregunta:votar` | `{ preguntaId }` | `{ voto: { id, votos, votada } }` (alterna; no la propia). |
| S→C | `sala:cerrada` | `{ motivo: 'finalizada' \| 'vencida' }` | El servidor desconecta y borra los datos. |
| S→C | `bloqueado` | `{}` | El docente bloqueó al participante. |

No existen eventos de navegación ni de control docente en este espacio.

## Espacio `/docente` (panel y presentación local)

Handshake, dos modos:

- **Panel:** cookie `oclive_docente` (HttpOnly, firmada) obtenida con `POST /api/docente/login`; origen = `APP_URL`.
- **Presentador** (adaptador Reveal.js local): `auth: { clave }`, clave firmada ligada a **una** sala y a su versión; origen ∈ `PRESENTER_ORIGINS` o `APP_URL`.

Rechazos: `origen`, `frecuencia`, `no_autenticado`, `clave`.

| Evento | Datos | Rol | Respuesta |
| --- | --- | --- | --- |
| `sesion` (S→C) | `{ rol, salas }` o `{ rol: 'presentador', salaId, estado }` | — | — |
| `estado` (S→C) | estado docente de la sala seguida | — | `servidor` (ms), sala (con `duracionVotacion`), encuesta activa con rondas (`conteos`, `porcentajes`, `respondientes`, `cierra`, `cierre`), historial, preguntas (todas), proyectada. |
| `sala:crear` | `{ titulo?, preModeracion? }` | docente | `{ sala, enlace, qr, clave }` |
| `sala:listar` | `{}` | docente | `{ salas }` |
| `sala:seguir` | `{ salaId }` | ambos | `{ estado, enlace, qr }` |
| `sala:clave` | `{ salaId }` | docente | `{ clave }` |
| `sala:revocarClaves` | `{ salaId }` | docente | `{ clave }` nueva; desconecta presentadores. |
| `encuesta:crear` | `{ salaId, encuesta: { enunciado, codigo?, tipo, opciones }, abrir? }` | ambos | `{ encuesta }`. Incluir `correctas` o `explicacion` se rechaza (`validacion`): la solución no viaja al crear. |
| `encuesta:abrir` | `{ salaId, encuestaId }` | ambos | Abre la ronda 1. Solo una votación abierta por sala. |
| `encuesta:cerrar` | `{ salaId, encuestaId }` | ambos | «Cerrar ahora»: cierra la ronda actual (`no_abierta` si ya cerró). |
| `encuesta:extender` | `{ salaId, encuestaId }` | ambos | «+30 segundos» sobre la ronda abierta (`sin_limite` en salas sin límite; máximo 10 min desde ahora). |
| `sala:ajustar` | `{ salaId, duracionVotacion }` | ambos | Tiempo de votación de la sala para las rondas siguientes. |
| `encuesta:publicar` | `{ salaId, encuestaId }` | ambos | Los estudiantes ven la distribución (sin la correcta). |
| `encuesta:segundaRonda` | `{ salaId, encuestaId }` | ambos | Ronda 2 vacía con el tiempo vigente de la sala; no disponible tras revelar. |
| `encuesta:revelar` | `{ salaId, encuestaId, solucion: { correctas?, explicacion? } }` | ambos | Única entrada de la solución al servidor. Validada contra esa encuesta (índices, una sola en `unica`, al menos una de las dos) y aplicada en la misma operación síncrona. Errores: `no_activa` (no es la encuesta en pantalla o fue retirada), `no_cerrada`, `ya_revelada` (duplicado o carrera: la primera prevalece), `validacion`. |
| `encuesta:retirar` | `{ salaId }` | ambos | Quita la encuesta de las pantallas (queda en el historial). |
| `pregunta:moderar` | `{ salaId, preguntaId, accion }` | ambos | `aprobar`, `ocultar`, `respondida`, `proyectar`, `quitarProyeccion`, `bloquearAutor`. |
| `preguntas:ajustar` | `{ salaId, abiertas?, preModeracion? }` | ambos | Abrir/cerrar recepción; premoderación. |
| `sala:finalizar` | `{ salaId }` | docente | Avisa, desconecta y borra todo. |
| `sala:cerrada` (S→C) | `{ salaId, motivo }` | — | — |

Flujo de aprendizaje activo (Freeman): `crear/abrir` → respuestas individuales → cierre por tiempo o `cerrar` → `publicar` → discusión → `segundaRonda` → cierre → `revelar`.

Soluciones (v0.2): el servidor no conoce la correcta ni la explicación hasta `encuesta:revelar`. La presentación
local las conserva en su diapositiva y el panel, para una pregunta improvisada, en la pestaña que la creó
(`sessionStorage`: sobrevive a recargar, se pierde al cerrar la pestaña). Por eso no hay acierto
(`porcentajeCorrecto`) antes de revelar, ni siquiera en la vista docente; el panel remoto no puede revelar una
pregunta de la presentación (indica hacerlo desde «En vivo» o Build Tech). Tras revelar, las vistas incluyen
`correctas`, `explicacion` y `porcentajeCorrecto` por ronda. Un adaptador v0.1 (que envía la solución al crear)
no es compatible con este servidor.

## HTTP

| Ruta | Descripción |
| --- | --- |
| `GET /`, `GET /join/CODIGO` | Vista del estudiante. |
| `GET /docente/` | Panel docente. |
| `GET /qr/CODIGO.svg` | QR de `APP_URL/join/CODIGO` (recurso de origen cruzado, sin secretos). |
| `GET /healthz` | `{ "estado": "ok" }` |
| `GET /api/docente/sesion` | `{ autenticado, csrf? }` |
| `POST /api/docente/login` | JSON `{ password }`; mismo origen; 5 intentos por IP. |
| `POST /api/docente/logout` | Cabecera `X-OC-CSRF`; revoca la sesión. |
| `GET /socket.io/socket.io.min.js` | Cliente Socket.IO (lo carga el adaptador al conectar). |

Cualquier otra ruta responde 404: el servidor no tiene fondos, imágenes, Markdown ni presentaciones.

## Build Tech (puente local, no es parte de este protocolo)

Build Tech (vista privada del docente) no abre ningún socket: habla con la presentación dentro del
navegador por `window.postMessage` (mismo origen, ventana verificada, órdenes de una lista cerrada; ver
`template/src/plugins/puente.mjs`) y la presentación ejecuta las acciones con su única conexión de
presentador (`encuesta:*`, `encuesta:retirar`, `pregunta:moderar`, `sala:ajustar`). El servidor no
distingue si una acción se pulsó en el menú «En vivo» o en Build Tech; ni las notas ni el estado de Build
Tech llegan al servidor.
