#!/usr/bin/env bash
# Interact by WillEdTech — actualización controlada en la VPS (comando forzado de SSH; sin shell interactiva).
# Se instala UNA vez en la VPS y se enlaza con `command="..."` en authorized_keys (ver docs/DESPLIEGUE-AUTOMATICO.md).
#   SSH_ORIGINAL_COMMAND = "deploy <sha-git-40> <sha256:digest>"   + Compose candidato (por digest) por stdin
#                        | "rollback"
# Garantías: un solo despliegue a la vez (flock); solo imágenes GHCR por digest; nunca build, prune, down -v ni borrado
# de volúmenes; PostgreSQL no se recrea (se aborta si su definición cambia); healthcheck y rollback automático.
set -euo pipefail
umask 077

STACK_DIR=${INTERACT_STACK_DIR:-/home/apps/dockhand/stacks/VPS Principal/openclass-live}
COMPOSE_NAME=${INTERACT_COMPOSE_FILE:-compose.yaml}
ENV_FILE=${INTERACT_ENV_FILE:-$STACK_DIR/.env}
STATE_DIR=${INTERACT_STATE_DIR:-/home/apps/dockhand/interact-deploy}
SERVICE=${INTERACT_SERVICE:-openclass-live}
DB_SERVICE=${INTERACT_DB_SERVICE:-interact-db}
HEALTH_TRIES=${INTERACT_HEALTH_TRIES:-30}
HEALTH_SLEEP=${INTERACT_HEALTH_SLEEP:-5}
REPO_PREFIX=${INTERACT_IMAGE_PREFIX:-ghcr.io/herrerawilliamh/}
CURRENT="$STACK_DIR/$COMPOSE_NAME"

log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$STATE_DIR/deploy.log" >&2; }
dc() { local f=$1; shift; docker compose --project-name openclass-live --env-file "$ENV_FILE" -f "$f" "$@"; }

salud() {
  local i
  for i in $(seq 1 "$HEALTH_TRIES"); do
    if docker exec "$SERVICE" node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
      return 0
    fi
    sleep "$HEALTH_SLEEP"
  done
  return 1
}

# Hash de configuración de la base: si el nuevo Compose la cambiaría, se rechaza (no se recrea PostgreSQL).
hash_db() {
  local f=$1
  if dc "$f" config --services 2>/dev/null | grep -qx "$DB_SERVICE"; then dc "$f" config --hash "$DB_SERVICE"; else echo "sin-base-local"; fi
}

restaurar() {
  log "ROLLBACK: restaurando Compose anterior"
  install -m 600 "$STATE_DIR/previous.yaml" "$CURRENT.tmp" && mv -f "$CURRENT.tmp" "$CURRENT"
  dc "$CURRENT" up -d --no-build --pull never "$SERVICE"
  salud && log "ROLLBACK OK: $(cat "$STATE_DIR/previous.meta" 2>/dev/null || echo desconocido)" || { log "ROLLBACK SIN SALUD: intervención manual"; return 1; }
}

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/lock"
flock -n 9 || { echo "Otro despliegue en curso" >&2; exit 75; }

read -r CMD SHA DIGEST EXTRA <<<"${SSH_ORIGINAL_COMMAND:-${1:-}}"
[ -z "${EXTRA:-}" ] || { echo "Argumentos no admitidos" >&2; exit 64; }
[ -f "$CURRENT" ] || { echo "No existe $CURRENT" >&2; exit 66; }

case "$CMD" in
  rollback)
    [ -f "$STATE_DIR/previous.yaml" ] || { echo "Sin versión anterior registrada" >&2; exit 66; }
    restaurar
    exit $?
    ;;
  deploy) ;;
  *) echo "Comando no admitido" >&2; exit 64 ;;
esac

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA inválido" >&2; exit 64; }
[[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "Digest inválido" >&2; exit 64; }

NEW=$(mktemp "$STATE_DIR/candidate.XXXXXX")
trap 'rm -f "$NEW"' EXIT
head -c 1048576 > "$NEW"
grep -q "image: ${REPO_PREFIX}[a-z0-9._/-]*@${DIGEST}" "$NEW" || { echo "El Compose no referencia el digest aprobado en ${REPO_PREFIX}" >&2; exit 65; }
if grep -Eq '^\s+build:|:latest\b' "$NEW"; then echo "Compose con build o latest: rechazado" >&2; exit 65; fi
if grep -E 'image: ghcr\.io/' "$NEW" | grep -v "@sha256:" | grep -q .; then echo "Imagen GHCR sin digest" >&2; exit 65; fi

dc "$NEW" config --quiet
[ "$(hash_db "$NEW")" = "$(hash_db "$CURRENT")" ] || { echo "La definición de PostgreSQL cambiaría: abortado sin tocar nada" >&2; exit 65; }

PREV_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$SERVICE" 2>/dev/null || echo desconocida)
cp -p "$CURRENT" "$STATE_DIR/previous.yaml"
echo "$PREV_IMAGE" > "$STATE_DIR/previous.meta"
log "DEPLOY inicio sha=$SHA digest=$DIGEST anterior=$PREV_IMAGE"

if ! dc "$NEW" pull "$SERVICE"; then log "FALLO pull (sin cambios)"; exit 1; fi
install -m 600 "$NEW" "$CURRENT.tmp" && mv -f "$CURRENT.tmp" "$CURRENT"
if dc "$CURRENT" up -d --no-build --pull never "$SERVICE" && salud \
   && [[ "$(docker inspect -f '{{.Config.Image}}' "$SERVICE")" == *"@${DIGEST}" ]]; then
  printf '%s sha=%s digest=%s\n' "$(date -u +%FT%TZ)" "$SHA" "$DIGEST" > "$STATE_DIR/deployed.current"
  log "DEPLOY OK sha=$SHA digest=$DIGEST"
  exit 0
fi
log "DEPLOY FALLÓ sha=$SHA"
restaurar || true
exit 1
