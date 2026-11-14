# Interact 0.4.7 — dominio, respaldo previo y migración por Dockhand/GitOps

Documento operativo. **Nada de esto se ejecuta desde el repositorio**: cada paso lo hace el operador en la VPS
(`vmi2534048`, stack `/home/apps/dockhand/stacks/VPS Principal/openclass-live`). Reglas: no reinstalar Traefik, Dockhand
ni CrowdSec; no borrar volúmenes ni bases; no añadir autenticación de Traefik a Dockhand; no publicar secretos.

## 1. Modelo de dominio
| Variable | Valor | Efecto |
|---|---|---|
| `APP_HOST` | `interact.apps.willedtech.io` | Router Traefik `openclass-live` (certificado ACME propio). |
| `APP_URL` | `https://interact.apps.willedtech.io` | Dominio canónico: enlaces `/join/…`, QR, correos (invitación, verificación, recuperación), origen CSRF/Socket.IO y cookie `Secure`. |
| `APP_HOST_ALT` | `openclass-live.apps.willedtech.io` (solo en transición) | Router `openclass-live-alt`, certificado ACME **independiente** (el del dominio anterior no se toca). |
| `APP_ALT_URLS` | `https://openclass-live.apps.willedtech.io` (solo en transición) | Orígenes adicionales aceptados por CSRF (`Origin`) y Socket.IO. Exige `https` en producción. |

Comportamiento verificado por pruebas (`tests/dominio-transicion.test.mjs`):
- Las peticiones con `Origin` del dominio anterior se aceptan durante la transición; cualquier otro origen da `403 origen`.
- Enlaces y QR se generan siempre con `APP_URL`.
- **Sesiones**: la cookie es *host-only* (sin `Domain`), por lo que **no viaja entre dominios**. Quien ya tiene sesión en el
  dominio anterior la conserva allí (el secreto de firma `SESSION_SECRET` no cambia); en el dominio nuevo debe iniciar sesión.
  Las salas activas y los enlaces/QR ya impresos con el dominio anterior siguen funcionando mientras `APP_HOST_ALT` exista.
- Invitaciones/recuperaciones ya enviadas con enlaces del dominio anterior siguen válidas (el token vive en el fragmento y
  se valida contra la base, no contra el host) mientras el dominio anterior esté activo.
- No cambiar `SESSION_SECRET` en esta versión (invalidaría sesiones y claves de sala).

## 2. Traefik / ACME (sin reinstalar nada)
Diagnóstico observado: DNS de ambos dominios → 194.163.168.99, pero el router activo solo tiene `Host(<dominio anterior>)`:
Traefik no tiene router ni certificado para el nombre nuevo y falla en TLS/SNI. El Compose 0.4.7 añade el router del nombre
nuevo con `tls.certresolver=myresolver` y deja el anterior en `openclass-live-alt`.
Requisitos en el Traefik existente (solo lectura/verificación): entrypoint `websecure`, resolvedor `myresolver` definido y
`acme.json` con permisos 600; el desafío (HTTP-01 por `web`/80 o TLS-ALPN-01 por 443) debe llegar a Traefik. Comprobar:
```bash
docker logs traefik 2>&1 | grep -i -E "acme|interact.apps.willedtech.io" | tail -20
echo | openssl s_client -connect interact.apps.willedtech.io:443 -servername interact.apps.willedtech.io 2>/dev/null | openssl x509 -noout -issuer -subject -dates
curl -sSI https://interact.apps.willedtech.io/healthz
```
Si hay límite de emisión (rate limit) de Let's Encrypt, esperar; **no** reinstalar Traefik ni borrar `acme.json`.

## 3. Respaldo ANTES de tocar nada (bloqueante)
Estado observado: `docker-compose.respaldo.yml` ausente del stack efectivo y `BACKUP_HOST_DIR` sin configurar; un archivo
presente no es un respaldo restaurable hasta haberlo restaurado. Procedimiento (detalle en `RESPALDO-RESTAURACION.md`):
1. Crear la carpeta fuera del volumen de PostgreSQL: `install -d -m 700 -o 1000 -g 1000 /home/openclass-live/respaldos`;
   en Dockhand definir `BACKUP_HOST_DIR=/home/openclass-live/respaldos` y asegurarse de que `DATABASE_BACKUP_URL` use el rol
   `interact_respaldo` (solo lectura).
2. Copiar `docker-compose.respaldo.yml` (viene en el paquete 0.4.7) junto al Compose efectivo y ejecutar
   `docker compose -f docker-compose.yml -f docker-compose.respaldo.yml --profile respaldo-dedicado run --rm interact-respaldo`
   (`pg_dump` consistente, `.sha256`, `pg_restore --list`).
3. Copia **externa independiente del servidor** (otro proveedor/objeto con versionado, cifrada); firmar el manifiesto fuera
   del host con `scripts/autenticidad-respaldo.mjs`.
4. **Ensayo de restauración aislado**: base nueva `interact_simulacro_restauracion` con `scripts/restaurar.mjs` (exige `.sha256`,
   firma y destino vacío); el ensayo debe terminar con migraciones íntegras y recuentos por tabla. Sin ensayo exitoso: **NO desplegar**.
5. Programar el respaldo (cron del host cada 6 h y antes de cada despliegue). Conservar el último respaldo anterior a 0.4.7.

## 4. Migración por Dockhand/GitOps (orden exacto)
1. (Local, hecho) Rama con 0.4.7 revisada; el operador publica y fija la revisión aprobada (SHA de 40 hex) → `LIVE_REVISION`.
2. Respaldo + ensayo de restauración (sección 3) **completos**.
3. En Dockhand, en las variables del stack: `APP_HOST=interact.apps.willedtech.io`, `APP_URL=https://interact.apps.willedtech.io`,
   `APP_HOST_ALT=<dominio anterior>`, `APP_ALT_URLS=https://<dominio anterior>`, `LIVE_REVISION=<sha>`. **Nunca** poner el
   dominio anterior en `APP_HOST` sin `APP_HOST_ALT`, ni quitar `APP_HOST_ALT` antes del paso 6.
4. Sincronizar el stack con `docker-compose.gitops.yml` (imagen `openclass-live:0.4.7-<sha>`, `pull_policy: never`: se construye
   localmente). Las migraciones corren antes (`interact-migrar`, sin cambios de esquema en 0.4.7).
5. Validar: `/healthz` en ambos dominios; HTTPS válido en el nuevo (`openssl s_client` arriba); inicio de sesión docente,
   crear sala, escanear QR, unión de un participante y WebSocket en el dominio nuevo; sesión previa del dominio anterior intacta.
6. Solo con HTTPS válido y validado en el nuevo dominio, después de un periodo acordado (p. ej. una semana lectiva), retirar
   `APP_HOST_ALT` y `APP_ALT_URLS` en una versión/sincronización posterior.

## 5. Reversión y condiciones de parada
**Detener (no continuar) si**: no hay respaldo verificado y ensayo de restauración; `docker compose config` falla;
`LIVE_REVISION` no es el SHA aprobado; el contenedor nuevo no queda `healthy`; HTTPS del dominio nuevo no valida y el
anterior deja de responder; aparecen errores `origen` masivos; fallan las migraciones.
**Reversión** (sin borrar volúmenes ni la base): en Dockhand restaurar la variable `LIVE_REVISION` y el Compose de 0.4.6
(la imagen `openclass-live:0.4.6-<sha>` sigue en el host: no se elimina), mantener `APP_HOST` anterior y quitar el router
nuevo. 0.4.7 no cambia el esquema ni los datos: no se requiere restaurar la base. Solo si una migración fallida dañó datos:
restaurar el respaldo **en una base nueva** con `restaurar.mjs` y apuntar la aplicación a ella tras validar.
