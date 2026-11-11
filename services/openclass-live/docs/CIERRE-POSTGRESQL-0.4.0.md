# Interact 0.4.0 · Cierre de la migración a PostgreSQL (para auditoría Codex)

Base auditada previamente: `dc4f305abe7210e626eb4739478ac8e4386aca03` (PR #8). Código validado en CI sobre `c296fef0c212394eedfdf65d7985e4f8291569a2` (todo en verde; manifiesto `releases/0.4.0.json` de 60 archivos).
Esta entrega reemplaza la persistencia
SQLite por PostgreSQL 16 en la misma versión 0.4.0. Decisión: `ADR-0001-POSTGRESQL.md`. Operación: `POSTGRESQL.md`.
Copias: `RESPALDO-RESTAURACION.md`.

## Qué cambió

| Área | Cambio |
|---|---|
| Persistencia | `src/db.mjs` reescrito sobre `pg` 8.23.1: pool, parámetros `$n`, transacciones, espera de arranque, errores sin credenciales, migraciones con SHA-256 y bloqueo consultivo. `node:sqlite` eliminado. |
| Esquema | `001-esquema-inicial.sql` (PostgreSQL ≥ 16): FK, `CHECK` de dominio, correo único sin distinguir mayúsculas, `boolean`, `jsonb` y `bigint` identidad; índices parciales. Sustituye a `001-cuentas-historial.sql` (SQLite, nunca publicada). |
| Dominio | `cuentas.mjs` e `historial.mjs` asíncronos. Consumo de tokens con `UPDATE … RETURNING`; operaciones compuestas en transacción; superusuario único con `pg_advisory_xact_lock`; el `upsert` del historial no reasigna propietario ni reabre salas cerradas. |
| Llamadores | `http.mjs`, `api-cuentas.mjs`, `sockets.mjs`, `auth.mjs`, `app.mjs`, `server.mjs` y scripts con `await`. Socket.IO: manejadores registrados en el mismo turno y revalidación como puerta; destinatarios fijados antes de esperar; fallo cerrado. |
| Seguridad | Cuatro roles (administración, migrador, aplicación, respaldo), red interna `interact-db`, sin puertos publicados, PostgreSQL sin root y de solo lectura, `scram-sha-256`, `--data-checksums`. |
| Proxy (P2-1) | `TRUSTED_PROXY_CIDRS`: las cabeceras de reenvío solo cuentan desde un par de confianza y con una IP válida. |
| Respaldo | `respaldar.mjs` (pg_dump verificado y rotado), `restaurar.mjs` (solo bases `*_restauracion` vacías y verificadas), `docker-compose.respaldo.yml`, imagen `--target herramientas`. |
| Compose / GitOps | `docker-compose.yml` con `interact-db`, `interact-db-preparar`, `interact-migrar` y la aplicación; `compose-gitops.mjs` como única derivación; `composePorDigest` cubre los tres usos de la imagen. |
| CI | Servicio PostgreSQL 16 (mismo digest), cliente 16 y restauración obligatoria; el humo del build migra y arranca contra PostgreSQL real. |

## Revalidación de los P2 del dictamen anterior

| P2 | Estado | Evidencia |
|---|---|---|
| 1. Confianza en proxy y cabeceras | Resuelto | `src/limites.mjs` (`crearConfianzaProxy`, `normalizarIp`) y `tests/p2-auditoria.test.mjs`: par ajeno ignorado, IP inválida descartada, IPv4 mapeada, CIDR inválido rechazado al arrancar, falsificación por HTTP sin efecto. |
| 2. Permisos y aislamiento en PostgreSQL | Resuelto | `tests/postgresql.test.mjs` «mínimo privilegio» (la aplicación no tiene DDL, `TRUNCATE`, escritura en migraciones, `UPDATE` de auditoría, `pg_authid` ni `SET ROLE`; el respaldo solo lee; la rotación invalida la contraseña anterior) y «aislamiento entre docentes en la capa SQL». En el stack: sin puertos publicados, red `internal`, cada contenedor con su única credencial, `pgdata` 0700 uid 70, un contenedor ajeno no alcanza la base y la aplicación no conecta a la base `postgres`. |
| 3. Cupos 5/200 deterministas | Resuelto | `tests/p2-auditoria.test.mjs`: exactamente 5 por IP (el 6.º recibe 429), otra IP sigue admitida, exactamente 200 globales (el 201.º recibe 429 con IP nueva). Sin aserciones condicionales. |
| 4. Restauración operativa completa | Resuelto | `tests/respaldo-restauracion.test.mjs` (obligatoria en CI): pg_dump → base `*_restauracion` → el servicio arranca sobre la copia y se comprueban login, roles, invitaciones pendientes y revocadas, sesión previa, historial, auditoría y escrituras nuevas, además de las salvaguardas y la rotación. |

## Pruebas locales de la entrega PostgreSQL (16.10 real; históricas respecto a las correcciones posteriores, la CI sobre `c296fef` es la referencia vigente)

| Suite | Entorno | Resultado |
|---|---|---|
| `npm test` (unidad, integración, PostgreSQL, P2, respaldo) | Linux (`node:22.23.1-alpine` + `pg_dump` 16.15, `INTERACT_TEST_REQUIRE_PG_TOOLS=1`) | 124/124, 0 omitidas |
| `npm test` | Windows 11 (Node 22.23.1) | 121 superadas, 3 omitidas (sin `pg_dump` local; en CI son obligatorias) |
| `npm run test:navegador` (Chrome, incluye inicio de sesión y «Iniciar clase» explícito y el protocolo 2 frente a v0.1) | Windows 11 + Chrome | 29/29 |
| Stack Compose real (proyecto aislado) | Docker Desktop | preparar → migrar → servicio sano, superusuario, login, respaldo, simulacro de restauración, reinicio de la base |
| Empaquetado reproducible | Windows y Linux | mismo `archiveSha256` que `releases/0.4.0.json` |
| `publicacion-ci.mjs workflow`, `npm audit --omit=dev` | — | PASS · 0 vulnerabilidades |

## Fuera de alcance (deliberado)

No se fusionó, no se publicó en GHCR, no se activó GitOps ni se tocó la VPS, Dockhand, Traefik u otros stacks. PITR
con WAL: evaluada, no implementada. `releases/0.2.0.json` y `0.3.0.json` sin cambios.
