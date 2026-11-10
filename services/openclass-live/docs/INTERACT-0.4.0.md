# Interact by WillEdTech 0.4.0 — identidades, invitaciones e historial

Esta versión añade cuentas personales, invitaciones verificables, historial persistente y un panel de
superusuario, sin cambiar la participación estudiantil anónima por QR ni el protocolo 2 con OpenClass local.

## Roles

| Rol | Puede | No puede |
|---|---|---|
| **Superusuario** | Invitar, suspender/reactivar cuentas, ver el historial global, auditoría, aplicar la política de conservación. | Gobernar en vivo salas ajenas (mínimo privilegio: solo las suyas). |
| **Docente** | Crear y gobernar **sus** salas; ver/exportar/eliminar **su** historial. | Ver o tocar sesiones ajenas aunque cambie identificadores (la consulta incluye al propietario). |
| **Presentador** | Permisos temporales ligados a UNA sala (clave firmada, versión revocable). Sin cambios. | Nada fuera de su sala; no crea ni finaliza salas. |
| **Estudiante** | Participar por QR/código, sin cuenta. Sin cambios. | Cualquier acción docente. |

La autorización se aplica en el backend (HTTP y Socket.IO), no solo ocultando controles: `autorizar()` en
`sockets.mjs` compara el propietario de la sala con la cuenta del socket en **cada** evento; `api-cuentas.mjs`
exige sesión, rol y CSRF por ruta.

## Primer arranque: superusuario sin credenciales por defecto

```bash
docker exec -it <contenedor> node scripts/init-superusuario.mjs --email usted@dominio --nombre "Su nombre"
```

La contraseña (≥ 12 caracteres) se pide sin eco o se lee de la entrada estándar / `INTERACT_SUPERUSER_PASSWORD`.
El script se niega si ya existe un superusuario. Sin superusuario, nadie entra (el acceso heredado es opcional y
está desactivado por omisión).

## Flujo de invitación (implementado y probado)

1. El superusuario crea la invitación (`POST /api/admin/invitaciones`): token aleatorio de 32 bytes, de un solo
   uso, vence a las `INVITE_TTL_HOURS` (72 h). Solo se guarda su SHA-256.
2. Se envía `…/cuenta/#invitacion=TOKEN` (fragmento: no llega al servidor en la petición de la página, no queda en
   registros ni en `Referer`; la página lo borra de la barra de direcciones).
3. La persona valida y crea su cuenta (nombre + contraseña ≥ 12). La cuenta queda **sin verificar**.
4. Se envía un segundo enlace `…#verificar=TOKEN` (`VERIFY_TTL_HOURS`, 48 h). Sin verificar no se puede entrar.
5. Inicia sesión → panel personal.

Revocación (`/api/admin/invitaciones/revocar`), vencimiento, rechazo de reutilización (consumo atómico
`UPDATE … WHERE usado IS NULL`), invitación nueva anula la anterior del mismo correo.
Recuperación: `/cuenta/#olvide` → enlace de un solo uso (`RESET_TTL_MINUTES`, 30 min); al restablecer se
**revocan todas las sesiones**. Las respuestas de «olvidé mi contraseña» y reenvío de verificación son idénticas
exista o no la cuenta; el login devuelve el mismo 401 para cuenta inexistente, contraseña errónea o cuenta
suspendida (con tiempo de cálculo comparable).

Límites: login 5 intentos por cuenta (correo normalizado; recarga 1/min; olvide/reenviar tienen cubetas aparte, así no se puede bloquear a un tercero pidiendo recuperaciones); endpoints `/api/auth/*` por IP (ráfaga 60, 0,5/s); el login heredado conserva 5/min por IP + 30 globales. Quien conozca el correo de otra persona puede agotar su cubeta de login con intentos fallidos (bloqueo temporal de 1 min por ficha): riesgo aceptado y mitigado por el límite por IP.
Suspender una cuenta revoca sus sesiones y deja sin efecto las claves de presentador de sus salas; restablecer la contraseña revoca sesiones pero no rota esas claves (vencen con la sala).

## Correo (SMTP) — configuración pendiente

`MAIL_TRANSPORT` = `desactivado` (por omisión en producción) | `smtp` | `desarrollo` (solo pruebas; prohibido en
producción). Variables: `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS / 465 TLS), `SMTP_USER`, `SMTP_PASSWORD`,
`MAIL_FROM`, `SMTP_TLS_VERIFY`. Sin secretos en Git. El cliente SMTP rechaza enviar credenciales sin TLS.

**Estado actual: no hay proveedor SMTP configurado; no se ha enviado ningún correo real.** Con transporte no real,
la API responde `correo: simulado|desactivado|fallido` y el administrador recibe `enlaceManual` para entregarlo por
otro medio. La interfaz dice «correo SIMULADO / NO configurado»; nunca afirma un envío que no ocurrió.
La verificación del correo **sigue siendo obligatoria**: con SMTP desactivado una cuenta nueva no puede iniciar sesión
hasta que el administrador entregue el `enlaceManual` por un canal que él considere fiable. No existe ningún atajo
(variable, bandera ni ruta) que marque una cuenta como verificada sin el token.

## Vínculo con OpenClass local — modelo de confianza
- El código (8 caracteres, 5 min) por sí solo no concede nada: al introducirlo, la página `/vincular/` muestra el
  **contexto declarado** por quien lo pidió (origen, antigüedad y red aproximada con el último tramo oculto), rotulado
  como no verificado, y exige confirmar «Sí, soy yo». Alguien que consiga que otra persona escriba su código no obtiene
  la cuenta sin esa confirmación; el origen proviene de la cabecera `Origin` (un cliente no navegador puede falsearla).
- Cupos: 200 vínculos pendientes en total y 5 por IP; el límite por IP se aplica a iniciar, sondear y aprobar.
- IP del cliente (solo para límites y cupos, nunca para autorizar): las cabeceras de reenvío cuentan **solo si la
  conexión TCP llega desde un proxy de confianza explícito** (`TRUST_PROXY=true` y par dentro de `TRUSTED_PROXY_CIDRS`).
  En producción `TRUSTED_PROXY_CIDRS` es **obligatorio y sin valor por defecto**: vacío o con rangos genéricos
  (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, prefijo menor que /24) el servicio **no arranca**. Se usa el
  **último** tramo de `X-Forwarded-For` (lo añade el proxy); `X-Real-Ip` **no se usa nunca** (no hay garantía de que
  el proxy la sanee). Desde cualquier otro par se ignoran y se usa la dirección del par. Sigue siendo necesario que
  solo Traefik pueda alcanzar el puerto 3000: ver `PROXY-ENTRADA.md` (red de entrada dedicada, cambio pendiente de
  autorización separada). Pruebas: `tests/p2-auditoria.test.mjs` y `tests/docker-proxy.test.mjs`.

Probado contra un servidor SMTP local de prueba (`tests/correo.test.mjs`); falta una prueba contra el proveedor real.

## Persistencia

**PostgreSQL 16** es el motor oficial (decisión: `ADR-0001-POSTGRESQL.md`; operación: `POSTGRESQL.md`). Cliente
`pg` con pool y consultas parametrizadas. Base dedicada en el Compose (`interact-db`, red interna sin puertos
publicados) o PostgreSQL administrado por configuración. Cuatro credenciales separadas: administración,
migraciones (DDL), aplicación (solo DML) y respaldo (solo lectura).

Migraciones versionadas en `src/migraciones/NNN-nombre.sql`, registradas con su SHA-256 en `esquema_migraciones`,
lineales, transaccionales y serializadas con un bloqueo consultivo. En producción el servicio solo **verifica** el
esquema; migra `interact-migrar` (`scripts/migrar.mjs`) antes de que arranque. Tokens, invitaciones, verificación,
recuperación, suspensión y revocación son atómicos (un `UPDATE … RETURNING` por consumo y una transacción por
operación compuesta).

**Copias de seguridad y restauración**: `pg_dump` verificado y rotado (perfil `respaldo`) y restauración
automatizada solo hacia bases `*_restauracion` vacías. Detalle, RPO/RTO y la evaluación de PITR en
`RESPALDO-RESTAURACION.md`. Las copias contienen hashes de contraseñas e historial: son dato personal.

No hay base en memoria: desarrollo y pruebas usan un PostgreSQL real (`INTERACT_TEST_DATABASE_URL`).

## Historial y política de datos

Se guarda: propietario, título, fechas, estado, nº de participantes y de preguntas, y por actividad enunciado,
opciones y **recuentos agregados por ronda**. **No** se guarda: alias, tokens, respuestas individuales, texto de
preguntas de estudiantes, notas privadas, soluciones sin revelar (ni reveladas: solo el indicador), código de
ejemplo, diapositivas ni IP. Con «Conservar resultados» desactivado al crear la sala, solo quedan metadatos.

- Estados: `activa`, `finalizada`, `vencida`, `interrumpida`. Las salas viven en memoria: tras un reinicio **no se
  recuperan**; las `activa` pasan a `interrumpida` al arrancar (con el último punto de control, cada ≤ 60 s) y
  nunca se muestran como activas.
- Conservación: historial `HISTORY_RETENTION_DAYS` (365), auditoría `AUDIT_RETENTION_DAYS` (730); purga diaria y
  bajo demanda (superusuario). El propietario puede eliminar sus sesiones cerradas; el superusuario cualquiera.
- Exportación CSV de lo mismo que la lista (alcance propio o global), con neutralización de inyección de fórmulas.
- Auditoría: invitaciones creadas/revocadas/aceptadas, verificación, recuperación, suspensiones, exportaciones,
  eliminaciones, vínculos locales y retención. Nunca incluye tokens ni contraseñas.

## OpenClass local (vínculo temporal)

«Iniciar sesión» e «Iniciar clase» son pasos distintos; nada abre una sala sin pulsar «Iniciar clase».

1. La presentación (origen en `PRESENTER_ORIGINS`) pide `POST /api/vinculo/iniciar` y recibe un código de 8
   caracteres (5 min, un solo uso) y un secreto de sondeo que nunca sale de la presentación.
2. Abre `…/vincular/` en el **navegador del sistema** (sin tokens en la URL). La persona inicia sesión allí y
   escribe el código; `POST /api/vinculo/aprobar` exige sesión + CSRF.
3. La presentación sondea `…/sondear` y recibe **una sola vez** una credencial firmada de 8 h, revocable
   (`/api/vinculo/salir`), guardada solo en memoria. Nunca se envían contraseñas a la presentación.
4. «Iniciar clase» → `POST /api/vinculo/clase` crea la sala **a nombre de la cuenta** y devuelve la clave de
   presentador del protocolo 2 (sin cambios). Se mantiene el modo anterior de pegar la clave desde el panel.

## Compatibilidad y migración desde 0.3.0

- `ADMIN_PASSWORD_HASH` pasó a opcional: si se define, la contraseña compartida sigue funcionando como cuenta
  interna `docente-heredado@interact.invalid` (sin correo; su historial existe pero es de esa cuenta). Recomendado:
  dejarlo vacío y usar cuentas.
- Nuevo en el despliegue: PostgreSQL (servicios `interact-db`, `interact-db-preparar` e `interact-migrar`; volumen
  `interact-pgdata`; variables `DATABASE_*`, `POSTGRES_ADMIN_PASSWORD` e `INTERACT_DB_*`), `TRUSTED_PROXY_CIDRS` y
  variables de correo. `gen-env` genera todas las contraseñas y ya no pide la contraseña compartida.
- La imagen necesita Node ≥ 22.13 (la base fijada es 22.23.1).
- Protocolo 2, QR, moderación, encuestas, reconexión y revelación controlada: sin cambios.
