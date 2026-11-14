# Despliegue automático de Interact (0.4.7+)

Estado: **preparado, NO habilitado ni probado contra la VPS**. Se activa solo tras la configuración única de abajo.

## Cadena
1. PR → `release/openclass-live` con CI (`OpenClass Live`, job `checks`).
2. Tag `openclass-live-vX.Y.Z` y `workflow_dispatch` de `OpenClass Live` (build único, aprobación humana, publicación GHCR por digest, attestation).
3. `OpenClass Live Deploy` (`.github/workflows/openclass-live-deploy.yml`) se dispara al terminar con éxito esa publicación (o a mano con `run_id`). Verifica: ejecución exitosa desde tag, commit en `release/openclass-live`, sumas del paquete, digest del lock, attestation. **Nunca construye.**
4. Envía por SSH (clave dedicada, comando forzado) solo `deploy <sha> <digest>`; **no envía Compose**. La VPS no acepta Compose externo.
5. La VPS (`ops/vps/interact-actualizar.sh`): flock → valida SHA/digest → genera un *override* en el directorio de estado con solo `image: <INTERACT_IMAGE_REPO>@<digest>` del servicio de la app → valida el modelo efectivo (`docker compose config --format json`, mismo `--project-directory`): imagen exacta, sin `build`, sin otros servicios con la imagen de la app (migración/preparación → operación explícita, se aborta), PostgreSQL sin cambios → `pull` (si falla, nada cambia) → conserva el estado anterior → `up -d --no-deps --no-build --pull never <app>` → `/healthz` interno + imagen en ejecución. Si falla: rollback automático.
6. El runner comprueba `/healthz` público; si falla, ejecuta `rollback <sha> <digest>`, que **solo** actúa si lo desplegado sigue siendo exactamente ese SHA/digest (compare-and-swap); si otra actualización ocurrió, se rechaza (exit 73).
Registro: `deploy.log` y `deployed.current` en el directorio de estado de la VPS, y resumen del job (tag, SHA, digest).

No toca volúmenes, no recrea PostgreSQL, no usa `prune`/`down -v`, no usa Watchtower, no actúa sobre otros stacks. La imagen anterior permanece en Docker.

## Configuración única (manual; no automatizada ni verificada)
VPS:
1. Instalar `ops/vps/interact-actualizar.sh` en una ruta root-owned (p. ej. `/usr/local/sbin/interact-actualizar`, modo 0755).
2. Usuario dedicado `interact-deploy` (grupo docker; sin contraseña). Clave Ed25519 **nueva** solo para esto. En su `authorized_keys`:
   `command="/usr/local/sbin/interact-actualizar",restrict ssh-ed25519 AAAA… interact-deploy`
3. Confirmar el nombre real del Compose del stack (`INTERACT_COMPOSE_FILE`), el `.env` y `INTERACT_IMAGE_REPO`. El usuario necesita **lectura** del stack (Compose y `.env`) y **escritura solo** en `INTERACT_STATE_DIR` (override, estado, log); no se escribe en el directorio del stack ni se renombra nada allí. El Compose del stack debe usar la imagen por digest, sin `build`.
3b. Autoridad única (Dockhand): el Compose del stack es la plantilla de Git; el script solo añade el override de imagen del servicio de la app. Desactivar en Dockhand el build, el auto-sync y las actualizaciones automáticas de ese stack, y no redesplegarlo desde Dockhand sin el override (volvería a la imagen base de Git): las versiones nuevas se promueven por este flujo y la imagen base de Git se actualiza por PR. **No verificado**: confirmar el comportamiento real de Dockhand antes de habilitar.
4. `docker login ghcr.io` con un PAT **read:packages** si el paquete es privado.
5. Primera vez: aplicar a mano la migración de hostname en dos fases (`DOMINIO-Y-DESPLIEGUE-0.4.7.md`) y dejar el stack ya en el Compose por digest.
GitHub:
- Environment `interact-production` (revisores requeridos recomendados).
- Secretos: `INTERACT_DEPLOY_SSH_KEY`, `INTERACT_DEPLOY_KNOWN_HOSTS` (huella de host fijada; sin TOFU).
- Variables: `INTERACT_DEPLOY_HOST`, `INTERACT_DEPLOY_USER`, `INTERACT_PUBLIC_URL` (`https://interact.apps.willedtech.io`), y por último `INTERACT_AUTODEPLOY=true`.
- Nota: `workflow_run` solo funciona con el archivo en la rama por defecto (`main`).

## Rollback
- Automático: fallo de pull/up/healthz en la VPS o de `/healthz` público.
- Manual inmediato: `ssh interact-deploy@VPS "rollback <sha> <digest>"` con el SHA/digest actualmente desplegado (ver `deployed.current`); restaura el override anterior y comprueba salud.
- Base de datos: los rollbacks de imagen no revierten migraciones; usar el procedimiento de `RESPALDO-RESTAURACION.md`.

## Pendiente explícito
El disparador sigue siendo tag + aprobación humana de publicación (contrato auditado de `openclass-live.yml`); **no existe aún** la cadena automática "merge aprobado en release → publicación → despliegue". Requiere decisión de Partner/Auditor sobre el contrato de publicación; no se declara cumplido.
