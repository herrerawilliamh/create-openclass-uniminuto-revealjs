# Interact · PostgreSQL (operación)

Decisión y justificación: `ADR-0001-POSTGRESQL.md`. Copias y restauración: `RESPALDO-RESTAURACION.md`.

## Topología

```
              Internet ──HTTPS──► Traefik (red externa «web»)
                                        │
                                  openclass-live  ── DATABASE_URL (rol interact_app) ──┐
                                        │                                              │
   red interna «interact-db» (internal: true, sin salida a Internet, sin puertos publicados)
                                        │                                              │
   interact-db-preparar (admin) ─► interact-db (PostgreSQL 16) ◄── interact-migrar (rol migrador)
                                        ▲
                         interact-respaldo (rol respaldo, perfil «respaldo», bajo demanda)
```

- **Ningún puerto publicado** en el host (ni 3000 ni 5432). Solo los servicios de este stack están en `interact-db`.
- Volumen `interact-pgdata` (datos, `0700`, uid 70 de la imagen oficial). PostgreSQL corre sin root, con sistema de
  archivos de solo lectura salvo el volumen y `tmpfs`, `cap_drop: ALL`, `no-new-privileges`, límites de memoria, CPU
  y PIDs. Las páginas llevan sumas de verificación (`--data-checksums`) y las contraseñas usan `scram-sha-256`.
- `max_connections=40`. El pool del servicio es `DB_POOL_MAX` (10, máximo 50) y el rol de aplicación tiene
  `CONNECTION LIMIT 25`: hay margen para migraciones (3), respaldo (2) y administración.

## Arranque ordenado

1. `interact-db`: healthcheck `pg_isready`.
2. `interact-db-preparar` (solo perfil `postgres-dedicado`): crea o actualiza base, esquema y roles, y rota las
   contraseñas. Idempotente. Termina con código 0.
3. `interact-migrar`: aplica las migraciones pendientes con la credencial propietaria. Idempotente.
4. `openclass-live`: arranca solo si la migración terminó bien; **verifica** que el esquema esté al día (no lo
   altera) y espera hasta `DB_CONNECT_WAIT_SECONDS` (60 s en producción) a que la base responda.

Si la base cae con el servicio en marcha: `/healthz` responde 503 `{estado:"degradado"}`, la API responde 503
`{error:"no_disponible"}` con `Retry-After: 5` (sin host, usuario, SQL ni traza), los sockets del panel cuya
sesión no puede revalidarse se cortan (fallo cerrado), y al volver la base el pool reconecta solo.

## Credenciales y mínimo privilegio

| Variable | Rol | Quién la recibe | Permisos |
|---|---|---|---|
| `DATABASE_ADMIN_URL` / `POSTGRES_ADMIN_PASSWORD` | `postgres` (o el administrador del proveedor) | `interact-db`, `interact-db-preparar` | Todo. Solo prepara. |
| `DATABASE_MIGRATION_URL` | `interact_migrador` | `interact-migrar` | Propietario del esquema `interact` (DDL). |
| `DATABASE_URL` | `interact_app` | `openclass-live` | `SELECT/INSERT/UPDATE/DELETE` en las tablas; `esquema_migraciones` solo lectura; `auditoria` sin `UPDATE`. Sin DDL, sin `TRUNCATE`, sin `CONNECT` a la base `postgres`. |
| `DATABASE_BACKUP_URL` | `interact_respaldo` | `interact-respaldo` | Solo `SELECT`. |

- Todos los roles son `NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`, con `search_path=interact`.
  `REVOKE ALL ON SCHEMA public FROM PUBLIC` y `REVOKE ALL ON DATABASE interact FROM PUBLIC`.
- `npm run gen-env` genera las cuatro contraseñas (32 bytes, base64url) y las URL coherentes en `.env` (`chmod 600`,
  nunca en Git). Para rotar: cambiar la contraseña en `.env` (variable y URL) y volver a ejecutar
  `docker compose up -d`; `interact-db-preparar` aplica el cambio.
- `pg_dump`/`pg_restore` reciben la contraseña por `PGPASSWORD` (entorno del proceso hijo), nunca en la línea de órdenes.
- La configuración rechaza URL que no sean `postgres://`, contraseñas de ejemplo (`CAMBIAR`) en producción y
  esquemas no válidos. Ningún mensaje de error ni registro incluye la URL o la contraseña.

## Dos modos soportados (probados en Docker)

| | A · dedicado | B · administrado |
|---|---|---|
| `COMPOSE_PROFILES` | `postgres-dedicado` | `postgres-administrado` |
| Base | `interact-db` en la red **interna** `interact-db` (sin salida, sin puertos) | proveedor externo |
| Preparar roles | `interact-db-preparar` (automático) | una vez: `COMPOSE_PROFILES=postgres-preparar-administrado docker compose run --rm interact-db-preparar-administrado` (con la cuenta de administración del proveedor) |
| Migrar | `interact-migrar` (red `interact-db`) | `interact-migrar-administrado` (red `interact-salida`: DNS + salida, **sin puertos**) |
| Respaldar | `--profile respaldo-dedicado` → `interact-respaldo` | `--profile respaldo-administrado` → `interact-respaldo-administrado` |
| TLS | opcional | `DB_SSL=verificado` (cadena + nombre de host; `verify-full` en `pg_dump`) |

Exactamente **un** perfil de base. La base dedicada nunca se conecta a `interact-salida` ni a `web`. La aplicación
llega al proveedor por su red `web` (que ya tiene salida). Para una CA privada del proveedor: monte el archivo con
`DB_CA_HOST_FILE=/ruta/ca.pem` y use `DB_SSL_CA_FILE=/etc/interact/db-ca.pem` (se **añade** a la validación; no la
desactiva). Restrinja por IP en el proveedor al host del servicio y prefiera su PITR (ver `RESPALDO-RESTAURACION.md`).

**Alcance de la prueba del modo B** (`tests/docker-redes.test.mjs`, `INTERACT_TEST_DOCKER=1`): topología de ENSAYO con un
contenedor PostgreSQL 16 con TLS y CA propia, fuera de las redes del stack. Demuestra red, DNS, salida, TLS verificado
(rechazo por CA desconocida, por nombre distinto y por falta de TLS), migración, preparación de roles y respaldo. **No
está certificado contra ningún proveedor administrado concreto** (pooler, `CREATE DATABASE`, roles y límites propios).

## Variables

| Variable | Defecto | Notas |
|---|---|---|
| `DATABASE_URL` | — (obligatoria) | Credencial de la aplicación. |
| `DB_SCHEMA` | (`search_path` del rol) | Solo pruebas o instalaciones especiales. |
| `DB_MIGRATIONS` | `verificar` (producción) / `auto` | `auto` solo en desarrollo y pruebas. |
| `DB_SSL_CA_FILE` | — | Ruta de una CA propia (solo con `DB_SSL=verificado`); en Compose `/etc/interact/db-ca.pem`. |
| `DB_SSL` | `desactivado` | `requerido` (cifra sin validar) · `verificado` (cifra y valida; obligatorio fuera del host). |
| `DB_POOL_MAX` | 10 | 1–50. |
| `DB_CONNECT_WAIT_SECONDS` | 60 prod / 15 | Reintentos al arrancar. |
| `DB_STATEMENT_TIMEOUT_MS` | 10000 | Además, el rol de la aplicación tiene `statement_timeout=15s`. |

## Desarrollo y pruebas

Las pruebas usan PostgreSQL **real** (no hay base simulada ni en memoria). Cada prueba crea un esquema
`t_<pid>_<azar>` y lo borra al terminar; las de roles y restauración crean bases propias y las eliminan.

```bash
docker run -d --name interact-pg-test -e POSTGRES_USER=interact_test -e POSTGRES_PASSWORD=solo-pruebas-locales \
  -e POSTGRES_DB=interact_test -p 127.0.0.1:6543:5432 postgres:16.10-alpine
export INTERACT_TEST_DATABASE_URL=postgres://interact_test:solo-pruebas-locales@127.0.0.1:6543/interact_test
npm test && npm run test:navegador
```

La prueba de restauración necesita `pg_dump`/`pg_restore` de la versión 16 o posterior (`PG_BIN` o `PATH`). Sin
ellos se omite y lo indica; en CI es obligatoria (`INTERACT_TEST_REQUIRE_PG_TOOLS=1`). En Windows puede ejecutarse
en la imagen de herramientas:
`docker build --target herramientas -t openclass-live-herramientas:dev .` y
`docker run --rm -v "$PWD:/w" -w /w --network container:interact-pg-test -e INTERACT_TEST_DATABASE_URL=…@127.0.0.1:5432/… openclass-live-herramientas:dev node --test tests/respaldo-restauracion.test.mjs`.
