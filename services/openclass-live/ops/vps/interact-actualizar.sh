#!/usr/bin/env bash
# Interact by WillEdTech — actualización controlada en la VPS (comando forzado de SSH; sin shell interactiva).
#   SSH_ORIGINAL_COMMAND = "deploy <sha-git-40> <sha256:digest>" | "rollback <sha-git-40> <sha256:digest>" | "check"
# No recibe ni escribe Compose. Archivos Compose efectivos, SIEMPRE en este orden y en todas las operaciones:
#   1. $STACK_DIR/docker-compose.yml  (plantilla del stack; NUNCA se modifica)
#   2. $STATE_DIR/override.yaml       (solo la imagen exacta <INTERACT_IMAGE_REPO>@<digest> del servicio de la app)
#   3. $STATE_DIR/domain.yaml         (dominio oficial: APP_URL, APP_ALT_URLS, routers Traefik; root-owned, solo lectura aquí)
# $STATE_DIR es root:<grupo-deploy> con modo 1770 (sticky): el usuario de despliegue escribe sus propios archivos de estado
# pero NO puede borrar, renombrar ni reemplazar domain.yaml (propiedad de root).
# Un solo despliegue a la vez (flock); nunca build, prune, down -v ni volúmenes; solo el servicio de la app (--no-deps):
# PostgreSQL y servicios de migración no se tocan.
set -euo pipefail
umask 077

STACK_DIR=${INTERACT_STACK_DIR:-/home/apps/dockhand/stacks/VPS Principal/openclass-live}
COMPOSE_NAME=${INTERACT_COMPOSE_FILE:-docker-compose.yml}
ENV_FILE=${INTERACT_ENV_FILE:-$STACK_DIR/.env}
STATE_DIR=${INTERACT_STATE_DIR:-/home/apps/dockhand/interact-deploy}
SERVICE=${INTERACT_SERVICE:-openclass-live}
DB_SERVICE=${INTERACT_DB_SERVICE:-interact-db}
IMAGE_REPO=${INTERACT_IMAGE_REPO:-ghcr.io/herrerawilliamh/openclass-live}
HEALTH_TRIES=${INTERACT_HEALTH_TRIES:-30}
HEALTH_SLEEP=${INTERACT_HEALTH_SLEEP:-5}
PUBLIC_URLS=${INTERACT_PUBLIC_URLS:-https://interact.apps.willedtech.io https://openclass-live.apps.willedtech.io}
EXPECTED_APP_URL=${INTERACT_EXPECTED_APP_URL:-https://interact.apps.willedtech.io}
TRUSTED_UIDS=${INTERACT_TRUSTED_UIDS:-0 $(id -u)}
# Autoridad de la configuración protegida (domain.yaml y el directorio de estado que lo contiene): SOLO root por defecto.
DOMAIN_UIDS=${INTERACT_DOMAIN_UIDS:-0}
CURRENT="$STACK_DIR/$COMPOSE_NAME"
OVERRIDE="$STATE_DIR/override.yaml"
DOMAIN="${INTERACT_DOMAIN_FILE:-$STATE_DIR/domain.yaml}"

[[ "$SERVICE" =~ ^[a-z0-9_-]+$ && "$DB_SERVICE" =~ ^[a-z0-9_-]+$ ]] || { echo "Servicio inválido" >&2; exit 64; }
[[ "$COMPOSE_NAME" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "Nombre de Compose inválido" >&2; exit 64; }
[[ "$EXPECTED_APP_URL" =~ ^https://[a-z0-9.-]+$ ]] || { echo "INTERACT_EXPECTED_APP_URL inválida" >&2; exit 64; }
[[ "$IMAGE_REPO" =~  ^ghcr\.io/[a-z0-9._-]+(/[a-z0-9._-]+)+$ ]] || { echo "Repositorio de imagen inválido" >&2; exit 64; }

mkdir -p "$STATE_DIR"
log() { printf '%s %s\n' "$(date -u +%FT%TZ)" "$*" | tee -a "$STATE_DIR/deploy.log" >&2; }
# Todas las operaciones usan el mismo directorio de proyecto (rutas relativas, env_file y montajes idénticos).
# Orden fijo: docker-compose.yml, override (opcional), domain.yaml.
dc() { local ov=$1; shift; local f=(-f "$CURRENT"); [ "$ov" = - ] || f+=(-f "$ov"); f+=(-f "$DOMAIN"); docker compose --project-name openclass-live --project-directory "$STACK_DIR" --env-file "$ENV_FILE" "${f[@]}" "$@"; }

# Archivo/directorio operativo: no symlink (archivos), propietario de confianza y sin escritura de grupo/otros.
confiable() {
  local p=$1 kind=$2 o m
  if [ "$kind" = f ]; then [ -f "$p" ] && [ ! -L "$p" ] || return 1; else [ -d "$p" ] || return 1; fi
  read -r o m < <(stat -c '%u %a' "$p") || return 1
  case " $TRUSTED_UIDS " in *" $o "*) ;; *) return 1 ;; esac
  (( (8#$m & 8#022) == 0 ))
}
# Directorio de estado: propietario = autoridad de dominio (root); sin escritura de otros; escritura de grupo solo con sticky,
# de modo que un archivo de root dentro no pueda ser borrado ni reemplazado por el usuario de despliegue.
estado_protegido() {
  local o m b
  [ -d "$STATE_DIR" ] && [ ! -L "$STATE_DIR" ] || return 1
  read -r o m < <(stat -c '%u %a' "$STATE_DIR") || return 1
  case " $DOMAIN_UIDS " in *" $o "*) ;; *) return 1 ;; esac
  b=$((8#$m))
  (( (b & 8#002) == 0 )) || return 1
  (( (b & 8#020) == 0 || (b & 8#1000) != 0 ))
}
dominio_protegido() {
  local o
  confiable "$DOMAIN" f || return 1
  o=$(stat -c %u "$DOMAIN")
  case " $DOMAIN_UIDS " in *" $o "*) ;; *) return 1 ;; esac
}
verificar_permisos() {
  local p
  confiable "$STACK_DIR" d || { echo "Directorio no confiable (propietario/permisos): $STACK_DIR" >&2; return 1; }
  estado_protegido || { echo "Directorio de estado no protegido (debe ser de root, sin escritura de otros y con sticky si el grupo escribe): $STATE_DIR" >&2; return 1; }
  dominio_protegido || { echo "domain.yaml no protegido (debe ser archivo regular de root, sin escritura de grupo/otros): $DOMAIN" >&2; return 1; }
  for p in "$CURRENT" "$ENV_FILE"; do confiable "$p" f || { echo "Archivo no confiable o ausente (propietario/permisos/symlink): $p" >&2; return 1; }; done
  for p in "$OVERRIDE" "$STATE_DIR/deployed.current" "$STATE_DIR/previous.override" "$STATE_DIR/previous.deployed"; do
    [ ! -e "$p" ] && [ ! -L "$p" ] || confiable "$p" f || { echo "Archivo de estado no confiable: $p" >&2; return 1; }
  done
}

salud_interna() {
  docker exec "$SERVICE" node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null
}
salud_publica() {
  local u
  for u in $PUBLIC_URLS; do
    [[ "$u" =~ ^https://[a-z0-9.-]+$ ]] || return 1
    curl --fail --silent --show-error --max-time 10 "$u/healthz" >/dev/null 2>&1 || return 1
  done
}
# Salud interna y pública (ambos dominios) con reintentos.
salud() {
  local i
  for i in $(seq 1 "$HEALTH_TRIES"); do
    if salud_interna && salud_publica; then return 0; fi
    sleep "$HEALTH_SLEEP"
  done
  return 1
}

# Modelo efectivo: el candidato solo puede diferir del base en la imagen de la app; dominio (APP_URL, APP_ALT_URLS,
# routers Traefik) y el resto de servicios idénticos; sin build; APP_URL oficial y presente en los routers.
validar_modelo() {
  local base_json=$1 cand_json=$2
  python3 -I -c '
import json, sys
svc, img, repo, url = sys.argv[1:5]
base = json.loads(sys.argv[5]).get("services", {})
s = json.loads(sys.argv[6]).get("services", {})
a = s.get(svc, {})
def fail(m): print(m, file=sys.stderr); sys.exit(65)
if a.get("image") != img or "build" in a: fail("El servicio %s no resulta en la imagen aprobada sin build" % svc)
if any(k != svc and str(v.get("image", "")).startswith(repo + "@") for k, v in s.items()):
    fail("Hay otros servicios con la imagen de la app (migracion/preparacion): requiere operacion explicita, no automatica")
strip = lambda d: {k: v for k, v in d.items() if k != "image"}
if svc not in base or strip(base[svc]) != strip(a) or {k: v for k, v in base.items() if k != svc} != {k: v for k, v in s.items() if k != svc}:
    fail("El candidato cambia algo distinto de la imagen de la app (dominio, Traefik u otros servicios)")
env = a.get("environment") or {}
if isinstance(env, list): env = dict(x.split("=", 1) for x in env if "=" in x)
if env.get("APP_URL") != url: fail("APP_URL efectiva (%s) no es la oficial (%s): falta domain.yaml o es incorrecto" % (env.get("APP_URL"), url))
host = url.split("://", 1)[1]
if host not in json.dumps(a.get("labels") or {}): fail("Los routers de Traefik no contienen el dominio oficial %s" % host)
' "$SERVICE" "$IMAGE_REPO@$DIGEST" "$IMAGE_REPO" "$EXPECTED_APP_URL" "$base_json" "$cand_json"
}

hash_db() {
  if dc "$1" config --services 2>/dev/null | grep -qx "$DB_SERVICE"; then dc "$1" config --hash "$DB_SERVICE"; else echo "sin-base-local"; fi
}

# El override vigente debe ser el que registra deployed.current (forma y digest) antes de reemplazarlo.
verificar_estado_previo() {
  local reg=${1:-}
  if [ -f "$OVERRIDE" ]; then
    local esperado="services:
  $SERVICE:
    image: "
    local c; c=$(cat "$OVERRIDE")
    [[ "$c" == "$esperado$IMAGE_REPO@sha256:"* && "$(printf '%s\n' "$c" | wc -l)" -eq 3 ]] || { echo "override.yaml existente con forma inesperada: no se sobrescribe" >&2; return 1; }
    local d=${c##*@}
    [[ "$d" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "override.yaml con digest inválido" >&2; return 1; }
    [ -z "$reg" ] || [ "${reg#* }" = "$d" ] || { echo "override.yaml ($d) no coincide con deployed.current ($reg): no se sobrescribe" >&2; return 1; }
  elif [ -n "$reg" ]; then
    echo "deployed.current existe pero falta override.yaml: estado inconsistente" >&2; return 1
  fi
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
if [ "$CMD" = check ]; then
  # Solo lectura: permisos, modelo efectivo con los tres archivos y deriva respecto a docker-compose.yml solo.
  [ -z "${SHA:-}" ] || { echo "check no admite argumentos" >&2; exit 64; }
  verificar_permisos || exit 66
  ov=-; [ -f "$OVERRIDE" ] && ov=$OVERRIDE
  EFF=$(dc "$ov" config --format json) || exit 65
  REG=$(cat "$STATE_DIR/deployed.current" 2>/dev/null || true)
  DIGEST=${REG#* }; [[ "$DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]] || DIGEST="sha256:$(printf '0%.0s' $(seq 64))"
  verificar_estado_previo "$REG" || exit 70
  python3 -I -c '
import json, sys
s = json.loads(sys.argv[1]).get("services", {}); a = s.get(sys.argv[2], {})
e = a.get("environment") or {}
print("imagen=%s\nAPP_URL=%s\nAPP_ALT_URLS=%s" % (a.get("image"), e.get("APP_URL"), e.get("APP_ALT_URLS")))
if e.get("APP_URL") != sys.argv[3]: sys.exit(65)
' "$EFF" "$SERVICE" "$EXPECTED_APP_URL" || exit 65
  # Deriva: lo que reproduciría un «compose up» SIN -f (Compose lee COMPOSE_FILE de $ENV_FILE) frente al modelo efectivo
  # completo (servicios, imagen, entorno, labels, redes, volúmenes).
  if grep -qE '^COMPOSE_FILE=' "$ENV_FILE" 2>/dev/null; then echo "COMPOSE_FILE=configurado-en-.env"; else echo "COMPOSE_FILE=AUSENTE-en-.env"; fi
  IMPL=$(docker compose --project-name openclass-live --project-directory "$STACK_DIR" --env-file "$ENV_FILE" config --format json 2>/dev/null || true)
  python3 -I -c '
import json, sys
try: impl = json.loads(sys.argv[1])
except Exception: print("compose-implicito=DERIVA (el modelo implícito no se pudo calcular)"); sys.exit(0)
eff = json.loads(sys.argv[2])
diffs = []
for k in sorted(set(impl) | set(eff)):
    if k == "name": continue
    if k == "services":
        for n in sorted(set(impl.get(k, {})) | set(eff.get(k, {}))):
            a, b = impl.get(k, {}).get(n), eff.get(k, {}).get(n)
            if a != b:
                keys = sorted({x for x in set(a or {}) | set(b or {}) if (a or {}).get(x) != (b or {}).get(x)}) or ["(servicio ausente)"]
                diffs.append("%s: %s" % (n, ",".join(keys)))
    elif impl.get(k) != eff.get(k): diffs.append(k)
if diffs: print("compose-implicito=DERIVA (un `compose up` sin -f diferiría del modelo vigente en: %s)" % "; ".join(diffs))
else: print("compose-implicito=ALINEADO (SOLO diagnóstico de Compose sin -f; NO prueba cómo invoca Dockhand: ver evidencia contenedor=)")
' "$IMPL" "$EFF"
  # Evidencia del contenedor REAL (lo que importa tras una acción de Dockhand): imagen en ejecución, APP_URL y router del contenedor.
  CIMG=$(docker inspect -f '{{.Config.Image}}' "$SERVICE" 2>/dev/null || echo desconocida)
  CURL=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$SERVICE" 2>/dev/null | sed -n 's/^APP_URL=//p' | head -1)
  CRT=$(docker inspect -f '{{json .Config.Labels}}' "$SERVICE" 2>/dev/null | grep -c "${EXPECTED_APP_URL#https://}" || true)
  echo "contenedor=imagen:$CIMG app_url:${CURL:-?} routers-con-dominio:$CRT"
  if [[ "$CIMG" == *"@$DIGEST" && "$CURL" == "$EXPECTED_APP_URL" && "$CRT" -ge 1 ]]; then echo "contenedor-evidencia=COINCIDE con deployed.current"; else echo "contenedor-evidencia=NO-COINCIDE (el contenedor no corresponde a deployed.current/dominio oficial)"; fi
  salud_interna && salud_publica && echo "salud=OK" || { echo "salud=FALLA" >&2; exit 1; }
  exit 0
fi
case "$CMD" in deploy|rollback) ;; *) echo "Comando no admitido" >&2; exit 64 ;; esac
[[ "${SHA:-}" =~ ^[0-9a-f]{40}$ ]] || { echo "SHA inválido" >&2; exit 64; }
[[ "${DIGEST:-}" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "Digest inválido" >&2; exit 64; }
verificar_permisos || exit 66

if [ "$CMD" = rollback ]; then
  # Compare-and-swap: solo revierte si lo desplegado sigue siendo exactamente lo que el llamante desplegó.
  [ "$(cat "$STATE_DIR/deployed.current" 2>/dev/null || true)" = "$SHA $DIGEST" ] || { log "ROLLBACK rechazado: lo desplegado no es $SHA $DIGEST"; exit 73; }
  restaurar
  exit $?
fi

NEW=$(mktemp "$STATE_DIR/candidate.XXXXXX")
trap 'rm -f "$NEW" "$NEW.tmp"' EXIT
printf 'services:\n  %s:\n    image: %s@%s\n' "$SERVICE" "$IMAGE_REPO" "$DIGEST" > "$NEW"

# Validar el modelo efectivo (docker-compose.yml + override + domain.yaml) frente al base (docker-compose.yml + [override vigente] + domain.yaml).
verificar_estado_previo "$(cat "$STATE_DIR/deployed.current" 2>/dev/null || true)" || exit 70
BASE_OV=-; [ -f "$OVERRIDE" ] && BASE_OV=$OVERRIDE
BASE_EFF=$(dc "$BASE_OV" config --format json) || exit 65
EFF=$(dc "$NEW" config --format json) || exit 65
validar_modelo "$BASE_EFF" "$EFF" || exit 65
[ "$(hash_db "$NEW")" = "$(hash_db "$BASE_OV")" ] || { echo "La definición de PostgreSQL cambiaría: abortado sin tocar nada" >&2; exit 65; }

PREV_IMAGE=$(docker inspect -f '{{.Config.Image}}' "$SERVICE" 2>/dev/null || echo desconocida)
log "DEPLOY inicio sha=$SHA digest=$DIGEST anterior=$PREV_IMAGE"
# Si el pull falla no se muta nada: el respaldo anterior queda intacto.
if ! dc "$NEW" pull "$SERVICE"; then log "FALLO pull (sin cambios)"; exit 1; fi

# Preservar el estado anterior justo antes de mutar.
if [ -f "$OVERRIDE" ]; then install -m 600 "$OVERRIDE" "$STATE_DIR/previous.override.tmp" && mv -f "$STATE_DIR/previous.override.tmp" "$STATE_DIR/previous.override"; else rm -f "$STATE_DIR/previous.override"; fi
if [ -f "$STATE_DIR/deployed.current" ]; then install -m 600 "$STATE_DIR/deployed.current" "$STATE_DIR/previous.deployed.tmp" && mv -f "$STATE_DIR/previous.deployed.tmp" "$STATE_DIR/previous.deployed"; else rm -f "$STATE_DIR/previous.deployed"; fi
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
