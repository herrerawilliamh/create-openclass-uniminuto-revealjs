# Despliegue automático de Interact (0.4.7+)

Estado: **preparado, NO habilitado ni probado contra la VPS**. Se activa solo tras la configuración inicial y el ensayo de abajo.

## Cadena
1. PR → `release/openclass-live` con CI (`OpenClass Live`, job `checks`).
2. **Push a `release/openclass-live`** (el merge del PR; la rama debe estar protegida y exigir PR + `Live release checks`) dispara `OpenClass Live`: `checks` → build único → `approval` (entorno `openclass-live-release`) → publicación GHCR por digest (alias informativo `sha-<commit>`, nunca se sobrescribe una tag histórica) → attestation. La ruta manual (tag `openclass-live-vX.Y.Z` + `workflow_dispatch`) sigue vigente. Para un flujo sin clic humano, deje el entorno `openclass-live-release` sin revisores requeridos; con revisores, la aprobación es el último gate.
3. `OpenClass Live Deploy` (`.github/workflows/openclass-live-deploy.yml`) se dispara al terminar con éxito esa publicación (o a mano con `run_id`). Verifica: ejecución exitosa; si fue push, que el SHA sea la punta vigente de `release/openclass-live` (un commit antiguo no revierte uno nuevo); si fue tag, que apunte al SHA y esté en release; además sumas del paquete, digest del lock, attestation. **Nunca construye.**
4. Envía por SSH (clave dedicada, comando forzado) solo `deploy <sha> <digest>`; **no envía Compose**. La VPS no acepta Compose externo.
5. La VPS (`ops/vps/interact-actualizar.sh`): flock → permisos/propiedad → valida SHA/digest y el estado previo → genera un *override* con solo `image: <INTERACT_IMAGE_REPO>@<digest>` → valida el modelo efectivo (docker-compose.yml + override + domain.yaml; solo cambia la imagen, dominio/Traefik intactos, sin `build`, sin otros servicios con la imagen de la app, PostgreSQL sin cambios) → `pull` (si falla, nada cambia) → conserva el estado anterior → `up -d --no-deps --no-build --pull never <app>` → `/healthz` interno y público (ambos dominios) + imagen en ejecución. Si falla: rollback automático.
6. El runner comprueba `/healthz` público; si falla, ejecuta `rollback <sha> <digest>`, que **solo** actúa si lo desplegado sigue siendo exactamente ese SHA/digest (compare-and-swap); si otra actualización ocurrió, se rechaza (exit 73).
Registro: `deploy.log` y `deployed.current` en el directorio de estado de la VPS, y resumen del job (tag, SHA, digest).

No toca volúmenes, no recrea PostgreSQL, no usa `prune`/`down -v`, no usa Watchtower, no actúa sobre otros stacks. La imagen anterior permanece en Docker.

## Modelo efectivo en la VPS (0.4.8 operativa)
Stack `/home/apps/dockhand/stacks/VPS Principal/openclass-live`; estado `/home/apps/dockhand/interact-deploy`. Todas las operaciones Compose del script usan, **en este orden**: `docker-compose.yml` (stack, nunca se modifica) → `override.yaml` (solo `image: ghcr.io/herrerawilliamh/openclass-live@sha256:…`) → `domain.yaml` (dominio oficial: `APP_URL`, `APP_ALT_URLS`, routers Traefik; root-owned, solo lectura para el script). El directorio de estado es `root:interact-deploy` modo `1770` (sticky): el usuario de despliegue crea/reemplaza **sus** archivos (`override.yaml`, `deployed.current`, `lock`, `deploy.log`) pero no puede borrar, renombrar ni reemplazar `domain.yaml`. Antes de actuar el script exige que el candidato difiera del modelo vigente **solo** en la imagen de la app (dominio y demás servicios idénticos), `APP_URL` = `https://interact.apps.willedtech.io` (`INTERACT_EXPECTED_APP_URL`), dominio presente en los routers, sin `build`, hash de PostgreSQL igual. Salud interna y pública en **ambos** dominios (`INTERACT_PUBLIC_URLS`). Rechaza (exit 66) archivos con symlink, propietario fuera de `INTERACT_TRUSTED_UIDS` (por defecto root y el usuario que ejecuta) o escritura de grupo/otros; y exige que el directorio de estado y `domain.yaml` pertenezcan a `INTERACT_DOMAIN_UIDS` (por defecto solo root), que el directorio no sea escribible por «otros» y que la escritura de grupo exista solo con sticky; rechaza (exit 70) un `override.yaml` con forma inesperada o que no coincide con `deployed.current`. Comando de solo lectura: `check` (permisos, modelo efectivo, salud y si un `compose up` sin `-f` —lo que haría Dockhand— reproduciría el modelo efectivo completo: servicios, imagen, entorno y routers; `dockhand-solo=ALINEADO|DERIVA` con las claves que difieren).

## Dockhand: autoridad única (procedimiento definitivo)
- Autoridad de despliegue = **este flujo** (script en la VPS). Dockhand queda como visor/inventario: **auto-sync, build y actualizaciones automáticas desactivados** para este stack (no se asume ninguna función de Dockhand: se comprueba con `check`).
- Persistencia sin alineación manual posterior (configuración inicial única, paso 3b de abajo): en el `.env` **local** del stack se fija `COMPOSE_FILE=docker-compose.yml:/home/apps/dockhand/interact-deploy/override.yaml:/home/apps/dockhand/interact-deploy/domain.yaml`. Docker Compose lee `COMPOSE_FILE` del `.env` del proyecto, de modo que cualquier `compose up` **sin `-f`** (redespliegue, reinicio de Dockhand, sincronización de Git que no pise `.env`) usa los tres archivos en el orden correcto. `override.yaml`, `domain.yaml` y `deployed.current` viven fuera del directorio del stack, así que una sincronización no los toca; el script nunca modifica `docker-compose.yml`, por lo que las promociones no exigen tocar Git ni Dockhand. Precondición: `override.yaml` debe existir (ya existe en 0.4.8; el script no lo borra salvo que el estado previo no tuviera override).
- Verificación concreta, sin producción desde Crew44: `ssh interact-deploy@VPS check` imprime `COMPOSE_FILE=configurado-en-.env` y `dockhand-solo=ALINEADO` (modelo implícito idéntico al efectivo).
- **NO VERIFICADO (puerta del ensayo, paso 6)**: si Dockhand invoca Compose con `-f` explícito o reescribe el `.env`, `COMPOSE_FILE` se ignora/pierde y `check` mostrará `DERIVA`. En ese caso no active `INTERACT_AUTODEPLOY`; alternativa documentada: dejar a Dockhand sin permiso de «redeploy» para este stack, o (solo si hace falta) llevar a Git un `docker-compose.yml` ya alineado. Ninguna de las dos se aplica automáticamente.

## Configuración inicial única (ejecutar en la VPS como root; nada de esto lo ejecuta Crew44)
```bash
set -euo pipefail
STACK='/home/apps/dockhand/stacks/VPS Principal/openclass-live'
STATE=/home/apps/dockhand/interact-deploy
# 1) Script root-owned (copiar desde el repo; revisar su contenido antes)
install -o root -g root -m 0755 interact-actualizar.sh /usr/local/sbin/interact-actualizar
# 2) Usuario dedicado (no reemplaza cuentas existentes), sin contraseña, sin shell interactiva fuera del comando forzado
id interact-deploy >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash --password '!' interact-deploy
# Acceso a Docker (equivale a root sobre el host: ver restricciones abajo)
usermod -aG docker interact-deploy
# 3) Lectura del stack y escritura SOLO en el estado
setfacl -m u:interact-deploy:rX "$STACK" "$STACK/docker-compose.yml" "$STACK/.env"
# STATE: root:interact-deploy 1770 (sticky). domain.yaml de root dentro de él NO puede ser borrado/reemplazado por el usuario.
chown root:interact-deploy "$STATE" && chmod 1770 "$STATE"
chown root:root "$STATE/domain.yaml" && chmod 644 "$STATE/domain.yaml"
for f in override.yaml deployed.current previous.override previous.deployed lock deploy.log; do
  if [ -e "$STATE/$f" ]; then chown interact-deploy:interact-deploy "$STATE/$f" && chmod 600 "$STATE/$f"; fi
done
# 3b) Persistencia para Dockhand: COMPOSE_FILE en el .env LOCAL del stack (una sola vez; no entra en Git)
grep -q '^COMPOSE_FILE=' "$STACK/.env" || printf 'COMPOSE_FILE=docker-compose.yml:%s/override.yaml:%s/domain.yaml\n' "$STATE" "$STATE" >> "$STACK/.env"
# 4) Clave Ed25519 NUEVA (la privada va solo a GitHub; borrar la copia local tras cargarla)
install -d -m 700 /root/interact-deploy-key
ssh-keygen -t ed25519 -N '' -C interact-deploy -f /root/interact-deploy-key/id_ed25519
# 5) Comando forzado y restricciones (restrict = sin pty, forwarding ni agente)
install -d -o interact-deploy -g interact-deploy -m 700 /home/interact-deploy/.ssh
printf 'command="/usr/local/sbin/interact-actualizar",restrict %s\n' "$(cat /root/interact-deploy-key/id_ed25519.pub)" \
  > /home/interact-deploy/.ssh/authorized_keys
chown interact-deploy:interact-deploy /home/interact-deploy/.ssh/authorized_keys && chmod 600 /home/interact-deploy/.ssh/authorized_keys
# 6) Huella del host para INTERACT_DEPLOY_KNOWN_HOSTS (verificar la huella por otro canal)
ssh-keyscan -t ed25519 localhost 2>/dev/null | sed 's/^localhost/VPS_HOST_O_IP/'   # ajustar al host real
# 7) GHCR si el paquete es privado: docker login ghcr.io como interact-deploy con PAT read:packages
```
Comprobaciones (deben cumplirse antes del primer despliegue):
```bash
sudo -u interact-deploy test -r "$STACK/docker-compose.yml" && sudo -u interact-deploy test -r "$STACK/.env"
sudo -u interact-deploy test ! -w "$STACK/docker-compose.yml" && sudo -u interact-deploy test ! -w "$STATE/domain.yaml"
sudo -u interact-deploy test -w "$STATE"
# el directorio es escribible por el grupo, así que lo decisivo es que NO pueda borrar/renombrar domain.yaml (sticky + propiedad de root)
[ "$(stat -c '%U:%G %a' "$STATE")" = 'root:interact-deploy 1770' ]
if sudo -u interact-deploy mv "$STATE/domain.yaml" "$STATE/domain.yaml.x" 2>/dev/null; then mv "$STATE/domain.yaml.x" "$STATE/domain.yaml"; echo 'FALLA: el usuario pudo renombrar domain.yaml'; false; fi
if sudo -u interact-deploy rm -f "$STATE/domain.yaml" 2>/dev/null && [ ! -e "$STATE/domain.yaml" ]; then echo 'FALLA: el usuario pudo borrar domain.yaml (restaurar desde copia)'; false; fi
[ "$(stat -c '%U %a' "$STATE/domain.yaml")" = 'root 644' ]
stat -c '%U:%G %a %n' /usr/local/sbin/interact-actualizar "$STATE"/*      # script root 755; domain.yaml root 644
sshd -T -C user=interact-deploy | grep -Ei 'allowtcpforwarding|permitttyuser|passwordauthentication'
# desde otra máquina con la clave: un comando arbitrario es rechazado (exit 64) y 'check' funciona
ssh -i KEY -o IdentitiesOnly=yes interact-deploy@VPS "id"        # esperado: 'Comando no admitido'
ssh -i KEY -o IdentitiesOnly=yes interact-deploy@VPS "check"     # esperado: APP_URL oficial, salud=OK
```
Restricciones: pertenecer al grupo `docker` **no elimina** el riesgo (quien controle esa clave o ese usuario puede escalar a root); por eso la clave solo admite el comando forzado con `restrict`, el script es root-owned e inmutable para el usuario, valida SHA/digest/comando con expresiones estrictas, no acepta Compose externo, y la clave es exclusiva y rotable (`authorized_keys` + secreto). Opcional más estricto: prefijo `from="IPs de GitHub"` (rangos cambiantes: no recomendado) o ejecutar el script vía `sudo` con regla única en sudoers sin pertenecer a `docker` (no probado aquí). El usuario no puede modificar, borrar ni renombrar `docker-compose.yml` ni `domain.yaml` (comprobado arriba: propiedad de root + directorio sticky; el script, además, rechaza el estado si el directorio o el archivo dejan de ser de root), pero sí escribe `override.yaml`: por eso el script valida su forma y digest en cada ejecución. **Límite real**: quien obtenga una shell con `docker` (no con esta clave restringida) equivale a root y puede alterar todo; esta separación protege contra errores, contra el propio flujo automatizado y contra un comando forzado manipulado, no contra root.

## Configuración de GitHub
- Environment `interact-production` (revisores requeridos; la aprobación humana de publicación sigue en `openclass-live-release`, intacta).
- Secretos del Environment: `INTERACT_DEPLOY_SSH_KEY` (privada de `/root/interact-deploy-key/id_ed25519`), `INTERACT_DEPLOY_KNOWN_HOSTS` (línea del paso 6 con host real).
- Variables: `INTERACT_DEPLOY_HOST`, `INTERACT_DEPLOY_USER` (`interact-deploy`), `INTERACT_PUBLIC_URL` (`https://interact.apps.willedtech.io`), `INTERACT_AUTODEPLOY` = `false` (o sin definir) hasta verificar el ensayo.
```bash
gh api -X PUT repos/herrerawilliamh/create-openclass-uniminuto-revealjs/environments/interact-production
gh secret set INTERACT_DEPLOY_SSH_KEY --env interact-production < /root/interact-deploy-key/id_ed25519
gh secret set INTERACT_DEPLOY_KNOWN_HOSTS --env interact-production --body "$KH"
gh variable set INTERACT_DEPLOY_HOST --body HOST; gh variable set INTERACT_DEPLOY_USER --body interact-deploy
gh variable set INTERACT_PUBLIC_URL --body https://interact.apps.willedtech.io
gh variable set INTERACT_AUTODEPLOY --body false     # activar a 'true' solo tras el ensayo
shred -u /root/interact-deploy-key/id_ed25519 || rm -f /root/interact-deploy-key/id_ed25519
```
(`vars.*` se leen a nivel repositorio o Environment; defina las variables donde prefiera, de forma consistente.)

## Incorporar el workflow a `main` (aislado; `workflow_run` exige el archivo en la rama por defecto)
```bash
git fetch origin main
git switch -c ci/interact-deploy-workflow origin/main        # sin worktrees ni clones
git checkout <rama-fix> -- .github/workflows/openclass-live-deploy.yml
git diff --cached --stat                                      # SOLO ese archivo
git commit -m "ci(interact): workflow de despliegue (inactivo hasta INTERACT_AUTODEPLOY=true)"
# PR a main (revisión humana); no incluye generador npm, template/ ni graphify-out/
```
El workflow referencia por nombre `OpenClass Live`; ese flujo y `ops/vps/interact-actualizar.sh` residen en la rama de release. Hasta que `OpenClass Live` esté también en `main`, solo el disparo manual (`workflow_dispatch` con `run_id`) es utilizable; la ejecución manual y la automática requieren `github.ref == main`.

## Ensayo (primer despliegue real) y verificación previa
1. `ssh interact-deploy@VPS check` → `APP_URL` oficial, `salud=OK`, nota `dockhand-solo`.
2. Con `INTERACT_AUTODEPLOY=false`: Actions → *OpenClass Live Deploy* → Run workflow con el `run_id` de la publicación aprobada (misma imagen 0.4.8 o la siguiente aprobada). Se ejecutan: verificación de origen, paquete, attestation, `check`, `deploy`, healthz público, registro en el resumen (tag, SHA, digest).
3. En la VPS: `cat $STATE/deployed.current` (SHA y digest), `tail $STATE/deploy.log`, `docker compose -p openclass-live --project-directory "$STACK" --env-file "$STACK/.env" -f "$STACK/docker-compose.yml" -f "$STATE/override.yaml" -f "$STATE/domain.yaml" config | grep -E 'APP_URL|image:'`, `docker ps` (PostgreSQL con el mismo `Created`/uptime).
4. Ensayo de rollback: repetir con un digest anterior aprobado, o `ssh interact-deploy@VPS "rollback <sha> <digest>"` con lo vigente.
5. Dockhand (puerta obligatoria antes de activar el paso 6): reiniciar Dockhand, forzar una sincronización y, si procede, un redespliegue desde su interfaz; luego `check` debe seguir mostrando `COMPOSE_FILE=configurado-en-.env` y `dockhand-solo=ALINEADO`, y `docker inspect` debe mostrar el mismo digest. Si muestra `DERIVA`, siga la alternativa de la sección Dockhand y no active el autodespliegue.
6. Solo entonces `gh variable set INTERACT_AUTODEPLOY --body true`.

## Rollback
- Automático: fallo de pull/up/healthz en la VPS o de `/healthz` público.
- Manual inmediato: `ssh interact-deploy@VPS "rollback <sha> <digest>"` con el SHA/digest actualmente desplegado (ver `deployed.current`); restaura el override anterior y comprueba salud.
- Base de datos: los rollbacks de imagen no revierten migraciones; usar el procedimiento de `RESPALDO-RESTAURACION.md`.

## Estado de la cadena automática
La cadena merge aprobado en release → CI → build único → aprobación → GHCR por digest → despliegue está **implementada y verificada estáticamente y con pruebas conductuales de identidad** (`publicacion-ci.test.mjs`, `despliegue-automatico.test.mjs`). **NO_VERIFICADO**: ejecución real en GitHub Actions, GHCR, la VPS y Dockhand. El workflow de deploy debe existir en `main` para que `workflow_run` lo dispare, y `INTERACT_AUTODEPLOY=true` solo se activa tras comprobar los accesos. La attestation/Release por tag del flujo Autosync histórico no aplica a imágenes publicadas por push; este despliegue verifica attestation por digest.
