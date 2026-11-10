# ADR-0001 · PostgreSQL como motor definitivo de persistencia de Interact

- **Estado**: aceptada (Interact 0.4.0, PR #8). Sustituye la persistencia SQLite del mismo PR antes de su publicación.
- **Fecha**: 2026-11-09.
- **Alcance**: identidad (cuentas, roles, invitaciones, verificación, recuperación, sesiones persistentes, vínculo
  local), auditoría e historial agregado. **No** cambia el dominio en memoria de salas, votaciones y preguntas,
  ni la participación anónima de estudiantes, ni el protocolo 2 de OpenClass.

## Contexto

La primera implementación de 0.4.0 usaba SQLite integrada (`node:sqlite`) en un volumen local. Funcionaba para un
único contenedor, pero:

1. **Un solo escritor y un solo nodo.** SQLite en un volumen exige que exactamente un proceso abra el archivo. No
   permite réplicas del servicio, un PostgreSQL administrado ni separar base y aplicación en hosts distintos.
2. **Sin separación de credenciales.** Cualquier proceso con acceso al archivo tiene todos los permisos: no hay rol
   de aplicación sin DDL, ni rol de respaldo de solo lectura, ni rol de migraciones.
3. **Respaldos acoplados al proceso.** `VACUUM INTO` se ejecutaba dentro del servicio y escribía en el mismo volumen
   que los datos. No es almacenamiento independiente ni admite recuperación a un punto en el tiempo.
4. **Concurrencia implícita.** La atomicidad de los tokens dependía de que la API de SQLite fuera síncrona (un solo
   hilo). Con varias instancias, esa garantía desaparece.
5. **Crecimiento institucional.** Más docentes, retención de 1 a 2 años de auditoría e historial y una posible
   integración con sistemas de la institución piden un servidor de base de datos con operación conocida (copias,
   monitoreo, conexiones, roles), ofrecido también como servicio administrado.

## Decisión

PostgreSQL (versión mayor **16**, imagen `postgres:16.10-alpine` fijada por digest) es el motor oficial a partir de
0.4.0. **No** se mantiene un sistema dual SQLite/PostgreSQL.

- Cliente: **`pg` 8.23.1** (node-postgres): mantenido, sin dependencias nativas, con pool, consultas parametrizadas,
  `RETURNING`, transacciones explícitas y TLS. Se descartaron Prisma, Knex y otros ORM porque añaden una capa de
  generación o un DSL para unas 60 consultas que ya existen y están auditadas. `postgres` (porsager) también era
  viable; se eligió `pg` por madurez y porque su API de pool y cliente se corresponde 1:1 con transacciones manuales.
- Toda consulta usa parámetros `$n`. Los únicos identificadores interpolados son nombres de esquema y rol, validados
  con `^[a-z_][a-z0-9_]{0,62}$`, y nombres fijos del código.
- El dominio pasa a ser asíncrono (`await` en HTTP, Socket.IO y scripts). La revalidación de sesión por destinatario
  (H02) consulta la base en cada envío y **falla cerrada** si la base no responde.
- Migraciones versionadas en `src/migraciones/NNN-*.sql`: lineales, cada una en su transacción, serializadas con
  `pg_advisory_lock` y registradas con su SHA-256 en `esquema_migraciones`. Una migración ya aplicada que cambie
  impide el arranque. En producción el servicio **no migra**: solo verifica (`DB_MIGRATIONS=verificar`); migra
  `scripts/migrar.mjs` con la credencial propietaria del esquema.
- Cuatro credenciales: administración (prepara la base y los roles), migraciones (propietaria y con DDL),
  aplicación (solo DML) y respaldo (solo `SELECT`). Detalle en `docs/POSTGRESQL.md`.
- Copias con `pg_dump` en formato personalizado, verificadas y rotadas por un trabajo aparte (perfil `respaldo`),
  y restauración automatizada solo hacia bases `*_restauracion` vacías. Detalle en `docs/RESPALDO-RESTAURACION.md`.

### Modelo de datos

| Aspecto | Decisión | Motivo |
|---|---|---|
| Identificadores | `text` aleatorio (base64url de 12 bytes) | Se conservan los de 0.4.0; no son secuenciales ni adivinables |
| Auditoría | `bigint GENERATED ALWAYS AS IDENTITY` | Orden total de eventos; sin `UPDATE` para la aplicación |
| Fechas | `bigint`, milisegundos UTC, `CHECK (>= 0)` | El dominio usa un reloj inyectable (pruebas deterministas de vencimiento) y la API ya entrega milisegundos. Cambiar a `timestamptz` alteraría el contrato de la API sin beneficio funcional; queda como migración futura posible |
| Correos | minúsculas obligatorias (`CHECK`) e índice único sobre `lower(email)` | Unicidad sin distinguir mayúsculas, sin depender de la extensión `citext` (no siempre disponible en PostgreSQL administrado) |
| Booleanos | `boolean` | Sustituye a los `INTEGER 0/1` de SQLite |
| Datos estructurados | `jsonb` con `CHECK (jsonb_typeof(...) = 'array')` | Opciones y rondas del historial |
| Integridad | FK con `ON DELETE CASCADE` o `SET NULL`; `CHECK` de dominio (roles, estados, longitudes, coherencia de tokens) | La base rechaza estados imposibles aunque falle el código |
| Índices | Parciales para tokens pendientes, sesiones vivas y salas activas | Consultas calientes acotadas |

### Atomicidad

- **Consumo de token**: un único `UPDATE … WHERE usado IS NULL AND revocado IS NULL AND vence > $1 RETURNING *`.
  PostgreSQL bloquea la fila; la segunda transacción reevalúa el `WHERE` y no obtiene nada.
- **Aceptar invitación, verificar, restablecer, suspender, revocar e invitar**: cada uno en una transacción con su
  auditoría. Si falla un paso intermedio, nada queda aplicado (probado inyectando un fallo dentro de PostgreSQL).
- **Superusuario único**: `pg_advisory_xact_lock` dentro de la transacción de inicialización.
- **Historial**: el `upsert` no puede reasignar una sala a otro propietario (`ON CONFLICT … WHERE propietario_id = EXCLUDED.propietario_id`).

## Límites de la implementación actual

- **Salas en memoria.** Votaciones y preguntas siguen en el proceso: un reinicio marca las salas como
  `interrumpida`. Con PostgreSQL ya es posible tener varias instancias de la identidad, pero **no** varias instancias
  del servicio de salas: eso exigiría un adaptador de Socket.IO compartido y un estado de sala distribuido (fuera de alcance).
- **Vínculos locales pendientes** (código de 5 min) en memoria; un reinicio los anula, lo cual es inocuo.
- **Límites de frecuencia** en memoria y por instancia.
- **Fechas en milisegundos** (`bigint`) en lugar de `timestamptz`.
- **Sin PITR implementada**: los respaldos lógicos dan un RPO de horas. El archivado WAL es un requisito de
  producción evaluado en `docs/RESPALDO-RESTAURACION.md`, no una función entregada.
- **Sin migración de datos SQLite → PostgreSQL.** Ver «Riesgos».

## Riesgos de la migración

| Riesgo | Evaluación | Mitigación |
|---|---|---|
| Datos existentes en SQLite | 0.4.0 no se ha publicado ni promovido (sin GHCR ni GitOps; las versiones previas no tienen base de datos). En este repositorio no hay archivos `.sqlite`. **No se puede verificar desde aquí** si alguien desplegó a mano una imagen 0.4.0 previa con un volumen `interact-data`. | No se borra ningún volumen; el Compose 0.4.0 ya no monta `interact-data`, que queda intacto. Si existiera con datos, se requeriría un exportador puntual (no incluido) antes de retirarlo. |
| Paso síncrono → asíncrono | Las garantías de concurrencia ya no vienen gratis. | Revisión de todos los llamadores; pruebas de carrera reales (diez aceptaciones simultáneas, revocación frente a aceptación, migraciones simultáneas). |
| Base no disponible | Antes, el archivo local siempre estaba. | Espera con reintentos al arrancar, `/healthz` en 503, API en 503 con `Retry-After` y sin detalles, revalidación de sockets que falla cerrada, prueba de caída y recuperación con un proxy TCP. |
| Credenciales en variables de entorno | Igual que `SESSION_SECRET`. | Cada contenedor recibe solo la suya; `.env` no se versiona; la contraseña nunca va en argv de `pg_dump`. Docker secrets queda como mejora. |
| Alpine y `pg_dump` | El cliente de Alpine (16.x) debe ser ≥ al servidor. | Ambos son de la versión mayor 16; la prueba de restauración compara versiones y en CI es obligatoria. |
| Publicación y GitOps | El Compose tiene ahora tres usos de la imagen del servicio. | `composePorDigest` y `derivarGitops` reescriben todas las referencias; pruebas actualizadas. |

## Consecuencias

- El despliegue necesita PostgreSQL: el servicio `interact-db` del Compose (perfil `postgres-dedicado`) o un
  proveedor administrado (`DB_SSL=verificado`).
- Las pruebas usan un PostgreSQL real (`INTERACT_TEST_DATABASE_URL`), con un esquema aislado por prueba; CI añade
  PostgreSQL 16 como servicio y el cliente 16 para la prueba de restauración.
- `node:sqlite` y `DATA_DIR` desaparecen del código de ejecución.
