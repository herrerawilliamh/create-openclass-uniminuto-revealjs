#!/usr/bin/env bash
# Interact by WillEdTech — actualización controlada en la VPS (comando forzado de SSH; sin shell interactiva).
#   SSH_ORIGINAL_COMMAND = "deploy <sha-git-40> <sha256:digest>" | "rollback <sha-git-40> <sha256:digest>"
# No recibe ni escribe Compose: el Compose del stack (plantilla local confiable, gestionada por Git/Dockhand) NUNCA se
# modifica. Lo único que cambia es un override en STATE_DIR con la imagen exacta del servicio de la app
# (<INTERACT_IMAGE_REPO>@<digest>). Un solo despliegue a la vez (flock); nunca build, prune, down -v ni volúmenes;
# solo el servicio de la app (--no-deps): PostgreSQL y servicios de migración no se tocan.
set -euo pipefail
umask 077

STACK_DIR=${INTERACT_STACK_DIR:-/home/apps/dockhand/stacks/VPS Principal/openclass-live}
COMPOSE_NAME=${INTERACT_COMPOSE_FILE:-compose.yaml}
ENV_FILE=${INTERACT_ENV_FILE:-$STACK_DIR/.env}
STATE_DIR=${INTERACT_STATE_DIR:-/home/apps/dockhand/interact-deploy}
SERVICE=${INTERACT_SERVICE:-openclass-live}
DB_SERVICE=${INTERACT_DB_SERVICE:-interact-db}
IMAGE_REPO=${INTERACT_IMAGE_REPO:-ghcr.io/herrerawilliamh/openclass-live}
HEALTH_TRIES=${INTERACT_HEALTH_TRIES:-30}
HEALTH_SLEEP=${INTERACT_HEALTH_SLEEP:-5}
CURRENT="$STACK_DIR/$COMPOSE_NAME"
OVERRIDE="$STATE_DIR/override.yaml"

[[ "$SERVICE" =~ ^[a-z0-9_-]+$ && "$DB_SERVICE" =~ ^[a-z0-9_-]+$ ]] || { echo "Servicio inválido" >&2; exit 64; }
[[ "$IMAGE_REPO" =~ ^ghcr\.io/[a-z0-9._-]+(/[a-z0-9._-]+)+$ ]] || { echo "Repositorio de imagen inválido" >&2; exit 64; }

mkdir -p "$STATE_DIR"
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$STATE_DIR/deploy.log" >&2; }
# Todas las operaciones usan el mismo directorio de proyecto (rutas relativas, env_file y montajes idénticos).
dc() { local ov=$1; shift; local f=(-f "$CURRENT"); [ "$ov" = - ] || f+=(-f "$ov"); docker compose --project-name openclass-live --project-directory "$STACK_DIR" --env-file "$ENV_FILE" "${f[@]}" "$@"; }

salud() {
  local i
  for i in $(seq 1 "$HEALTH_TRIES"); do
    if docker exec "$SERVICE" node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then return 0; fi
    sleep "$HEALTH_SLEEP"
  done
  return 1
}

hash_db() {
  if dc "$1" config --services 2>/dev/null | grep -qx "$DB_SERVICE"; then dc "$1" config --hash "$DB_SERVICE"; else echo "sin-base-local"; fi
}

# Restaura el estado previo (override y registro) y reinicia SOLO la app. Requiere el lock.
restaurar() {
  log "ROLLBACK: restaurando estado anterior ($(cat "$STATE_DIR/previous.deployed" 2>/dev/null || echo base-del-stack))"
  if [ -f "$STATE_DIR/previous.override" ]; then install -m 600 "$STATE_DIR/previous.override" "$OVERRIDE.tmp" && mv -f "$OVERRIDE.tmp" "$OVERRIDE"
  else rm -f "$OVERRIDE"; fi
  if [ -f "$STATE_DIR/previous.deployed" ]; then install -m 600 "$STATE_DIR/previous.deployed" "$STATE_DIR/deployed.current"; else rm -f "$STATE_DIR/deployed.current"; fi
  local ov=-; [ -f "$OVERRIDE" ] && ov=$OVERRIDE
  dc "$ov" up -d --no-deps --no-build --pull never "$SERVICE"
  if salud; then log "ROLLBACK OK"; else log "ROLLBACK SIN SALUD: intervención manual"; return 1; fi
}

exec 9>"$STATE_DIR/lock"
flock -n 9 || { echo "Otro despliegue en curso" >&2; exit 75; }

read -r CMD SHA DIGEST EXTRA <<<"${SSH_ORIGINAL_COMMAND:-${1:-}}"
[ -z "${EXTRA:-}" ] || { echo "Argumentos no admitidos" >&2; exit 64; }
case "$CMD" in deploy|rollback) ;; *) echo "Comando no admitido" >&2; exit 64 ;; esac
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA inválido" >&2; exit 64; }
[[ "${DIGEST:-}" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "Digest inválido" >&2; exit 64; }
[ -f "$CURRENT" ] || { echo "No existe $CURRENT" >&2; exit 66; }

if [ "$CMD" = rollback ]; then
  # Compare-and-swap: solo revierte si lo desplegado sigue siendo exactamente lo que el llamante desplegó.
  [ "$(cat "$STATE_DIR/deployed.current" 2>/dev/null || true)" = "$SHA $DIGEST" ] || { log "ROLLBACK rechazado: lo desplegado no es $SHA $DIGEST"; exit 73; }
  restaurar
  exit $?
fi

NEW=$(mktemp "$STATE_DIR/candidate.XXXXXX")
trap 'rm -f "$NEW" "$NEW.tmp"' EXIT
printf 'services:\n  %s:\n    image: %s@%s\n' "$SERVICE" "$IMAGE_REPO" "$DIGEST" > "$NEW"

# Validar el modelo efectivo (plantilla local + override): imagen exacta, sin build, sin otros servicios con esta imagen.
EFF=$(dc "$NEW" config --format json)
python3 -I -c '
import json, sys
svc, img, repo = sys.argv[1:4]
s = json.load(sys.stdin).get("services", {})
a = s.get(svc, {})
if a.get("image") != img or "build" in a:
    print("El servicio %s no resulta en la imagen aprobada sin build" % svc, file=sys.stderr); sys.exit(65)
if any(k != svc and str(v.get("image", "")).startswith(repo + "@") for k, v in s.items()):
    print("Hay otros servicios con la imagen de la app (migracion/preparacion): requiere operacion explicita, no automatica", file=sys.stderr); sys.exit(65)
' "$SERVICE" "$IMAGE_REPO@$DIGEST" "$IMAGE_REPO" <<<"$EFF" || exit 65
[ "$(hash_db "$NEW")" = "$(hash_db -)" ] || { echo "La definición de PostgreSQL cambiaría: abortado sin tocar nada" >&2; exit 65; }

PREV_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$SERVICE" 2>/dev/null || echo desconocida)
log "DEPLOY inicio sha=$SHA digest=$DIGEST anterior=$PREV_IMAGE"
# Si el pull falla no se muta nada: el respaldo anterior queda intacto.
if ! dc "$NEW" pull "$SERVICE"; then log "FALLO pull (sin cambios)"; exit 1; fi

# Preservar el estado anterior justo antes de mutar.
if [ -f "$OVERRIDE" ]; then cp -p "$OVERRIDE" "$STATE_DIR/previous.override"; else rm -f "$STATE_DIR/previous.override"; fi
if [ -f "$STATE_DIR/deployed.current" ]; then cp -p "$STATE_DIR/deployed.current" "$STATE_DIR/previous.deployed"; else rm -f "$STATE_DIR/previous.deployed"; fi
install -m 600 "$NEW" "$OVERRIDE.tmp" && mv -f "$OVERRIDE.tmp" "$OVERRIDE"
if dc "$OVERRIDE" up -d --no-deps --no-build --pull never "$SERVICE" && salud \
   && [[ "$(docker inspect -f '{{.Config.Image}}' "$SERVICE")" == *"@${DIGEST}" ]]; then
  printf '%s %s\n' "$SHA" "$DIGEST" > "$STATE_DIR/deployed.current"
  log "DEPLOY OK sha=$SHA digest=$DIGEST"
  exit 0
fi
log "DEPLOY FALLÓ sha=$SHA"
restaurar || true
exit 1
