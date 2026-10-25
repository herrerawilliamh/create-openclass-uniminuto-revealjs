# OpenClass Live — protocolo Socket.IO

Socket.IO 4 (WebSocket con respaldo HTTP long-polling). Todos los eventos del cliente usan **acuse**:
`socket.emit(evento, datos, (r) => …)` con `r = { ok: true, … }` o `{ ok: false, error, mensaje }`.
Un evento sin función de acuse se ignora. El servidor es la única fuente de verdad: los resultados se calculan allí.

Códigos de error frecuentes: `validacion`, `frecuencia`, `sala_inexistente`, `sala_vencida`, `sala_llena`, `bloqueado`, `prohibido`, `clave`, `no_autenticado`, `no_activa`, `cerrada`, `ronda`, `otra_abierta`, `no_cerrada`, `revelada`, `preguntas_cerradas`, `limite_*`.

## Espacio `/participante` (estudiantes)

Handshake: `auth: { codigo: 'K7M2QP', alias?: '≤30', token?: '<token de reconexión>' }`; origen = `APP_URL`.
Rechazos (`connect_error.message`): `origen`, `frecuencia`, `validacion`, `sala_inexistente`, `sala_vencida`, `sala_llena`, `bloqueado`.

| Dirección | Evento | Datos | Respuesta / efecto |
| --- | --- | --- | --- |
| S→C | `sesion` | `{ token, reconectado, estado }` | Guardar `token` para reconectarse. |
| S→C | `estado` | vista del participante | Encuesta activa **sin** `correctas` ni `explicacion` hasta revelarlas; `rondas` solo tras publicar resultados. |
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
| `estado` (S→C) | estado docente de la sala seguida | — | Sala, encuesta activa con rondas, historial, preguntas (todas), proyectada. |
| `sala:crear` | `{ titulo?, preModeracion? }` | docente | `{ sala, enlace, qr, clave }` |
| `sala:listar` | `{}` | docente | `{ salas }` |
| `sala:seguir` | `{ salaId }` | ambos | `{ estado, enlace, qr }` |
| `sala:clave` | `{ salaId }` | docente | `{ clave }` |
| `sala:revocarClaves` | `{ salaId }` | docente | `{ clave }` nueva; desconecta presentadores. |
| `encuesta:crear` | `{ salaId, encuesta: { enunciado, codigo?, tipo, opciones, correctas?, explicacion? }, abrir? }` | ambos | `{ encuesta }` |
| `encuesta:abrir` | `{ salaId, encuestaId }` | ambos | Abre la ronda 1. Solo una votación abierta por sala. |
| `encuesta:cerrar` | `{ salaId, encuestaId }` | ambos | Cierra la ronda actual. |
| `encuesta:publicar` | `{ salaId, encuestaId }` | ambos | Los estudiantes ven la distribución (sin la correcta). |
| `encuesta:segundaRonda` | `{ salaId, encuestaId }` | ambos | Ronda 2 vacía; no disponible tras revelar. |
| `encuesta:revelar` | `{ salaId, encuestaId }` | ambos | Con la votación cerrada: correctas + explicación a todos. |
| `encuesta:retirar` | `{ salaId }` | ambos | Quita la encuesta de las pantallas (queda en el historial). |
| `pregunta:moderar` | `{ salaId, preguntaId, accion }` | ambos | `aprobar`, `ocultar`, `respondida`, `proyectar`, `quitarProyeccion`, `bloquearAutor`. |
| `preguntas:ajustar` | `{ salaId, abiertas?, preModeracion? }` | ambos | Abrir/cerrar recepción; premoderación. |
| `sala:finalizar` | `{ salaId }` | docente | Avisa, desconecta y borra todo. |
| `sala:cerrada` (S→C) | `{ salaId, motivo }` | — | — |

Flujo de aprendizaje activo (Freeman): `crear/abrir` → respuestas individuales → `cerrar` → (`publicar`) → discusión → `segundaRonda` → `cerrar` → `revelar`. Las vistas incluyen `porcentajeCorrecto` por ronda cuando hay respuesta correcta.

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
