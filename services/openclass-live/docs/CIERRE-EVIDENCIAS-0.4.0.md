# Evidencias de cierre — Interact 0.4.0

Base: `release/openclass-live` @ `79e06b5b497b19b7a097040066d1e85d63c0ef77` (merge del PR #7, Interact 0.3.0).
Rama: `feat/interact-0.4.0-identidad` (PR #8). SHA auditado en CI: `c296fef0c212394eedfdf65d7985e4f8291569a2`.
Persistencia definitiva: **PostgreSQL 16** (ver `CIERRE-POSTGRESQL-0.4.0.md`); SQLite fue reemplazado en esta misma versión.
Manifiesto: `releases/0.4.0.json` (**60 archivos**, artefacto reproducible; regenerado con la migración a PostgreSQL).
`releases/0.2.0.json` y `0.3.0.json` no se tocaron.

## Resultados de CI sobre `c296fef` (GitHub Actions, PR #8)

| Flujo | Resultado |
|---|---|
| `OpenClass Live` · «Live release checks» (PostgreSQL 16 real, restauración obligatoria, gate Docker) | success (8 min 14 s) |
| `OpenClass Live` · build OCI, aprobación humana, publicación GHCR | omitidos (skipped) por diseño: no se publica |
| `Pruebas del generador (CI)` · Node 20.19.0 / 22 / 24, Chrome real, npm pack, arranque Windows | success |

## Pruebas locales históricas (previas a PostgreSQL)
Los resultados de la tabla siguiente se obtuvieron con la persistencia SQLite, antes de la migración; se conservan como
registro histórico. Las pruebas vigentes con PostgreSQL 16 están en `CIERRE-POSTGRESQL-0.4.0.md` y en la CI anterior.

### Pruebas ejecutadas con SQLite (Node 22.23.1, Windows, Chrome real) — históricas

| Suite | Resultado |
|---|---|
| `npm test` (servicio) | 105/105 — incluye 12 pruebas de cuentas/roles/persistencia/vínculo, 6 de correo y scripts, y las existentes |
| `tests/e2e/cuentas-navegador.test.mjs` (Chrome) | 2/2 — invitación→verificación→acceso→«Mis sesiones»→administración, 375 px sin desborde, foco y teclado, vínculo local |
| `tests/e2e/live-navegador.test.mjs` (Chrome, curso real + plugin con vínculo) | 1/1 (ejecutado a solas) |
| `tests/e2e/build-tech-navegador.test.mjs` (Chrome) | 1/1 (ejecutado a solas) |
| Resto de `test:navegador` (estudiante, panel, foco, soluciones, recuperación, marca accesible, protocolo, PDF, cuentas) | 26/26 en la ejecución final |
| Raíz: `npm test`, `test:docente`, `test:build-tech` | 46/46, 4/4, 7/7 |

Observaciones honestas:
- Una regresión real de esta versión la detectó `panel-soluciones-navegador` (tras cerrar sesión, el formulario no recordaba que había acceso heredado y exigía el correo); corregida y la suite vuelve a pasar.
- Una ejecución de `panel-foco-navegador` falló con `EBUSY` al abrir el perfil temporal de Chrome (Windows); pasó al repetirla.
- Al lanzar `live-navegador` y `build-tech-navegador` **juntos** fallaron (Build Tech: «Page is already being printed»;
  Live: `null.click`). Ambas pasan al ejecutarse a solas con el mismo código. No se investigó la causa; se atribuye a
  contención de recursos/Chrome entre ejecuciones consecutivas largas, no a esta versión, pero **no se comprobó contra 0.3.0**.
- Una ejecución de `npm test` bajo carga dio un fallo en «historial: filtros, CSV…» que no se reprodujo en 3
  ejecuciones posteriores ni en la suite completa (105/105). Sin causa identificada.
- El flujo del adaptador local (`template/src/plugins/live.mjs`: «Iniciar sesión con su cuenta» → «Iniciar clase»)
  está probado en servidor por HTTP (`vínculo con OpenClass local…`) y el plugin se carga sin regresiones en
  `live-navegador`, pero **no hay prueba de navegador que pulse esos botones**.

## Revisión visual (Chrome, capturas en `INTERACT_CAPTURAS`)
Acceso docente, cuenta/invitación, recuperación (móvil 375 px), «Mis sesiones», detalle, administración, «Todas las
sesiones» y vincular. Defectos hallados y corregidos: campos de correo/búsqueda/fecha sin el estilo de los demás
campos; el detalle mostraba el texto «null»; el aviso de administración se borraba al recargar la tabla.
Reutiliza `willedtech.css`, los logotipos y fuentes ya autorizados; no se publicó ningún recurso adicional de Brand.

## Seguridad: qué cubren las pruebas
Contraseñas scrypt; tokens de 32 bytes con SHA-256 en base; un solo uso atómico; vencimiento; revocación; límites de
intentos; respuestas idénticas para cuentas desconocidas (sin esperar el envío SMTP); recuperación que revoca
sesiones; suspensión que corta sockets; docente sin acceso a rutas de administración (403) ni a sesiones/salas
ajenas por HTTP o Socket.IO (`prohibido`/404); CSRF y mismo origen; CSV sin inyección de fórmulas; historial que
sobrevive al reinicio, salas `interrumpida`; base y respaldo verificados (con SQLite: `integrity_check`; vigente: pg_dump verificado y restauración probada); SMTP sin credenciales en claro.

## Limitaciones conocidas / pendiente
- **SMTP real sin configurar ni probado**: no se envió ningún correo real.
- ~~Migración a PostgreSQL no implementada~~: **implementada** (PostgreSQL 16); PITR con WAL evaluada y no implementada.
- `/api/vinculo/iniciar` admite hasta 200 vínculos pendientes (5 min): un cliente hostil con origen permitido podría
  agotarlos temporalmente; el aprobar exige sesión y código.
- El flujo `openclass-live.yml` conserva la etiqueta por defecto `openclass-live-v0.3.0`: la promoción de 0.4.0
  requiere su gate específico (no se publicó GHCR, ni autosync, ni Dockhand, ni VPS).
- Sin fusión del PR #8, release, GitOps ni despliegue.
- Auditoría independiente (Codex): pendiente sobre el SHA final de esta rama (`READY_FOR_CODEX`).
