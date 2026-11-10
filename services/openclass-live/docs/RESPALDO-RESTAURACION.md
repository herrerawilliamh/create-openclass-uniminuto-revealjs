# Interact · Respaldo, restauración, RPO/RTO y PITR

## Qué se protege

`usuarios` (hashes scrypt, roles, estado, verificación), `tokens` (solo SHA-256 de invitaciones, verificaciones y
recuperaciones, con su estado), `sesiones_cuenta` (SHA-256 del identificador de sesión: las sesiones sobreviven a la
restauración si `SESSION_SECRET` es el mismo), `auditoria`, `salas_historial`, `actividades_historial` y
`esquema_migraciones`. **Es dato personal** (Ley 1581): cifrado en reposo, acceso restringido y retención acotada.

`SESSION_SECRET` y las contraseñas de los roles **no** están en la copia. Se respaldan aparte, en el gestor de
secretos de la operación. Sin `SESSION_SECRET`, una restauración conserva las cuentas, pero las sesiones y las
claves de presentador abiertas dejan de valer, y hay que volver a iniciar sesión.

## Respaldo (implementado)

```bash
docker compose -f docker-compose.yml -f docker-compose.respaldo.yml --profile respaldo run --rm interact-respaldo
```

- `scripts/respaldar.mjs` con `pg_dump` 16 en formato personalizado (`--format=custom --compress=6`), con
  `--serializable-deferrable` (instantánea consistente sin bloquear escrituras) y la credencial de **solo lectura**.
- Se escribe `.parcial` y solo se renombra si `pg_dump` terminó bien. Después se calcula `.sha256` y se comprueba con
  `pg_restore --list` que el archivo es legible y contiene los datos de las seis tablas.
- Rotación: se conservan las `BACKUP_KEEP` (14) copias más recientes, cada una con su suma.
- **Almacenamiento independiente**: `BACKUP_HOST_DIR` es una carpeta del host **distinta del volumen de datos**. No
  basta con eso: debe replicarse fuera del host (otro proveedor u objeto con versionado e inmutabilidad), cifrada.
  Esa replicación es responsabilidad de la operación y no se automatiza aquí (no se modifica la VPS).
- Programación recomendada con cron del host: cada 6 h y antes de cada despliegue o migración.

## Restauración (implementada y probada; nunca sobre datos reales)

```bash
# 1) Base de destino NUEVA y VACÍA, con nombre terminado en _restauracion (o _prueba / _test)
docker compose exec interact-db psql -U postgres -c "CREATE DATABASE interact_simulacro_restauracion"
# 2) Restaurar y verificar (imagen de herramientas, en la red interna)
docker run --rm --network openclass-live_interact-db -v /home/openclass-live/respaldos:/respaldos:ro \
  -e DATABASE_RESTORE_URL='postgres://postgres:…@interact-db:5432/interact_simulacro_restauracion' -e DB_SCHEMA=interact \
  openclass-live-herramientas:0.4.0 node scripts/restaurar.mjs --copia /respaldos/interact-AAAAMMDDTHHMMSSZ.dump
```

Salvaguardas de `scripts/restaurar.mjs`:

1. Rechaza una base cuyo nombre no termine en `_restauracion`, `_prueba` o `_test`, salvo con
   `--confirmar-destino <nombre-exacto>` (decisión humana documentada para una recuperación real).
2. Rechaza una base que ya contenga tablas de Interact: no mezcla ni sobrescribe datos.
3. Comprueba la suma `.sha256`. Restaura en una sola transacción (`--single-transaction --exit-on-error`).
4. Verifica migraciones conocidas e íntegras, integridad referencial y restricciones validadas, y devuelve
   recuentos por tabla.

**Prueba automatizada** (`tests/respaldo-restauracion.test.mjs`, obligatoria en CI): crea datos a través del
servicio, respalda, restaura en una base `*_restauracion` y **arranca el servicio sobre la copia** en modo
producción. Comprueba el inicio de sesión con la contraseña original (hash protegido), los roles (superusuario y
docente), las invitaciones pendientes (el enlace sigue valiendo) y revocadas, la sesión persistente previa, el
historial con sus recuentos, la auditoría, y que siguen siendo posibles escrituras nuevas. También comprueba las
salvaguardas (destino no seguro, destino no vacío, copia alterada) y la rotación.

**Recuperación real** (procedimiento, sin automatizar): restaurar en `interact_restauracion`, validar, detener
`openclass-live`, renombrar las bases (`ALTER DATABASE interact RENAME TO interact_anterior_<fecha>;
ALTER DATABASE interact_restauracion RENAME TO interact;`), ejecutar `interact-db-preparar` (permisos) y arrancar.
La base anterior se conserva hasta confirmar el resultado.

## RPO / RTO

| Escenario | RPO (pérdida máxima) | RTO (tiempo hasta servicio) | Estado |
|---|---|---|---|
| Copias lógicas cada 6 h (recomendado) | ≤ 6 h | ≤ 1 h: 15 min de restauración y verificación (base de pocos MB) + arranque y comprobación | **Implementado** (falta la programación en el host) |
| Copia diaria | ≤ 24 h | ≤ 1 h | Implementado |
| PITR con archivado WAL | ≤ 5 min (`archive_timeout=300`) | ≤ 1 h | **No implementado: requisito de producción** |
| Pérdida del host completo | Igual que la copia replicada más reciente | ≤ 4 h (nuevo host + restauración) | Depende de la replicación externa |

Contexto: perder historial agregado es tolerable. Perder cuentas, invitaciones y auditoría lo es menos, pero se
reconstruye por invitación. Las salas en vivo no se respaldan: viven en memoria y se pierden con un reinicio (RPO
de la clase en curso = toda la clase).

## Recuperación a un punto en el tiempo (evaluación; NO implementada)

Requisito para producción institucional: **RPO ≤ 5 min**.

- **PostgreSQL administrado** (recomendado): activar la PITR del proveedor (retención de 7 a 14 días). No requiere
  cambios en Interact.
- **PostgreSQL dedicado**: `wal_level=replica`, `archive_mode=on`, `archive_timeout=300`, más una herramienta de
  archivado probada (pgBackRest o WAL-G) hacia almacenamiento de objetos externo y cifrado, con copias base
  semanales, y un simulacro trimestral de restauración a un instante. Implica un contenedor sidecar con
  credenciales del almacenamiento y la evaluación de su superficie de ataque. Queda fuera de 0.4.0 por alcance y
  porque requiere infraestructura fuera del repositorio.
- Mientras no exista, el RPO real es el de las copias lógicas (≤ 6 h si se programan).
