# Despliegue automático de Interact (0.4.7+)

Estado: **preparado, NO habilitado ni probado contra la VPS**. Se activa solo tras la configuración única de abajo.

## Cadena
1. PR → `release/openclass-live` con CI (`OpenClass Live`, job `checks`).
2. Tag `openclass-live-vX.Y.Z` y `workflow_dispatch` de `OpenClass Live` (build único, aprobación humana, publicación GHCR por digest, attestation).
3. `OpenClass Live Deploy` (`.github/workflows/openclass-live-deploy.yml`) se dispara al terminar con éxito esa publicación (o a mano con `run_id`). Verifica: ejecución exitosa desde tag, commit en `release/openclass-live`, sumas del paquete, digest del lock, attestation. **Nunca construye.**
4. Envía por SSH (clave dedicada, comando forzado) el Compose candidato (todo por `@sha256`) a `ops/vps/interact-actualizar.sh`.
5. La VPS: flock (un despliegue a la vez) → valida digest/ausencia de `build` y `latest` → aborta si cambiaría la definición de `interact-db` → `pull` → reemplaza el Compose del stack (Dockhand lo lee del mismo archivo; una sola fuente de verdad) → `up -d --no-build --pull never openclass-live` → `/healthz` interno y comprobación de la imagen en ejecución. Si falla: rollback automático al Compose anterior.
6. El runner comprueba `/healthz` público; si falla, ejecuta `rollback`.
Registro: `deploy.log` y `deployed.current` en el directorio de estado de la VPS, y resumen del job (tag, SHA, digest).

No toca volúmenes, no recrea PostgreSQL, no usa `prune`/`down -v`, no usa Watchtower, no actúa sobre otros stacks. La imagen anterior permanece en Docker.

## Configuración única (manual; no automatizada ni verificada)
VPS:
1. Instalar `ops/vps/interact-actualizar.sh` en una ruta root-owned (p. ej. `/usr/local/sbin/interact-actualizar`, modo 0755).
2. Usuario dedicado `interact-deploy` (grupo docker; sin contraseña). Clave Ed25519 **nueva** solo para esto. En su `authorized_keys`:
   `command="/usr/local/sbin/interact-actualizar",restrict ssh-ed25519 AAAA… interact-deploy`
3. Confirmar el nombre real del Compose del stack (`INTERACT_COMPOSE_FILE`, por defecto `compose.yaml`) y el `.env` en `/home/apps/dockhand/stacks/VPS Principal/openclass-live`. Dar al usuario escritura solo en ese Compose y en el directorio de estado (`INTERACT_STATE_DIR`).
4. `docker login ghcr.io` con un PAT **read:packages** si el paquete es privado.
5. Primera vez: aplicar a mano la migración de hostname en dos fases (`DOMINIO-Y-DESPLIEGUE-0.4.7.md`) y dejar el stack ya en el Compose por digest.
GitHub:
- Environment `interact-production` (revisores requeridos recomendados).
- Secretos: `INTERACT_DEPLOY_SSH_KEY`, `INTERACT_DEPLOY_KNOWN_HOSTS` (huella de host fijada; sin TOFU).
- Variables: `INTERACT_DEPLOY_HOST`, `INTERACT_DEPLOY_USER`, `INTERACT_PUBLIC_URL` (`https://interact.apps.willedtech.io`), y por último `INTERACT_AUTODEPLOY=true`.
- Nota: `workflow_run` solo funciona con el archivo en la rama por defecto (`main`).

## Rollback
- Automático: fallo de pull/up/healthz en la VPS o de `/healthz` público.
- Manual inmediato: `ssh interact-deploy@VPS rollback` (restaura el Compose anterior y comprueba salud), o Dockhand con `previous.yaml`.
- Base de datos: los rollbacks de imagen no revierten migraciones; usar el procedimiento de `RESPALDO-RESTAURACION.md`.

## Limitaciones
El disparador sigue siendo tag + aprobación humana de publicación (contrato auditado de `openclass-live.yml`); no hay despliegue por simple merge.
