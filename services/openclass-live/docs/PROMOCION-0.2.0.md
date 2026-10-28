# Promoción manual de OpenClass Live 0.2.0

Preparado sobre `main` aprobado `8f58229ed787228445d36a8ec444e4d46d27f6c2`.
Servicio 0.2.0, protocolo 2, generador npm 1.2.0. Este documento no acredita
el estado de la VPS: todos los comandos remotos los ejecuta exclusivamente el propietario.
No publicar npm. No modificar el curso original, Traefik, la red `web` ni otros stacks.
Ejecutar cada bloque, verificar el resultado y detenerse ante cualquier error.

## 1. Identidad y autoridad efectiva (propietario, VPS, Bash)

No activar Scheduled sync, webhook ni Force redeployment. Antes de cualquier cambio,
revisar en Dockhand si `openclass-live` existe, su tipo (local/adoptado o Git), proyecto,
archivo Compose, variables, ref Git y automatismos. Los labels orientan; no sustituyen
la inspección del stack en Dockhand. No imprimir `docker inspect` completo ni `compose config`.

```bash
set -euo pipefail
umask 077
LIVE_CONTAINER=openclass-live
docker inspect "$LIVE_CONTAINER" --format 'id={{.Id}} image={{.Image}} project={{index .Config.Labels "com.docker.compose.project"}} service={{index .Config.Labels "com.docker.compose.service"}} workdir={{index .Config.Labels "com.docker.compose.project.working_dir"}} files={{index .Config.Labels "com.docker.compose.project.config_files"}}'
docker ps -a --filter name=^/openclass-live$ --format '{{.Names}} {{.Image}} {{.Status}}'
docker network inspect web --format '{{.Name}} {{.Driver}}'
LIVE_PROJECT=$(docker inspect "$LIVE_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.project"}}')
test "$LIVE_PROJECT" = openclass-live
test "$(docker inspect "$LIVE_CONTAINER" --format '{{index .Config.Labels "com.docker.compose.service"}}')" = openclass-live
```

Si no existe el contenedor o cambian esas identidades, detenerse: este plan actualiza una
instalación existente. No crear un servicio paralelo.

**Decisión obligatoria antes de continuar:**

- Local/adoptado: usar la ruta Compose siguiente, con el proyecto existente. Registrar en
  Dockhand la ruta del Compose efectivo que se prepara aquí; impedir que otra definición
  vuelva a aplicarse. Mantener los automatismos desactivados.
- Git: no superponer un despliegue local a un stack que conserva autoridad Git. El propietario
  debe pasar su gestión a la definición local aprobada conservando proyecto y contenedor,
  o fijar un commit inmutable que contenga exactamente los archivos aprobados. Nunca una
  rama móvil ni la antigua `feat/openclass-live-v0.1.0`. Para la ruta Git, comparar los hashes
  de cada archivo de ejecución con el tarball, preservar variables del stack y respaldar
  su definición/ref anterior; el build context debe ser `services/openclass-live/`.
  Validar/exportar privadamente el Compose efectivo de ese checkout y continuar con los
  mismos controles de imagen, configuración y rollback. La promoción desde la interfaz
  debe afectar solo este servicio. Si Dockhand no permite fijar esa autoridad o garantizar
  ese alcance, **detenerse**, sin usar Force redeployment ni Create/Deploy alternativo.

La publicación autorizada se revisa en el PR de release/openclass-live; comprobar su SHA y CI. La ruta Git queda condicionada
a que el propietario disponga de esa revisión aprobada; la ruta local requiere haber
resuelto previamente la autoridad de Dockhand. Una actualización automática posterior
no puede quedar apuntando al código anterior.

## 2. Ventana sin clase y respaldo privado

Entrar al panel docente y comprobar con los docentes que no hay sesiones de clase activas,
ni una votación ni participantes conectados. Finalizar las salas de prueba desde el panel.
No existe un contador público de salas por diseño. La confirmación humana es obligatoria:
reiniciar elimina todo el estado en memoria, que el rollback tampoco recupera.

En la misma sesión Bash, identificar los archivos reales del paso 1. El ejemplo supone
la instalación local `/home/openclass-live/docker-compose.yml` con `.env` allí.
Si usa otros archivos, overrides, perfiles o variables Dockhand, ajustar `LIVE_DC` para
reproducir **todos** ellos antes de exportar. Nunca sustituirlos por `.env.example`.

```bash
LIVE_ROOT=/home/openclass-live
test -d "$LIVE_ROOT"
LIVE_BACKUP=/home/openclass-live-backups/$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$LIVE_BACKUP"
chmod 700 /home/openclass-live-backups "$LIVE_BACKUP"
cp -a "$LIVE_ROOT" "$LIVE_BACKUP/installation"
LIVE_DC=(docker compose --project-directory "$LIVE_ROOT" -p "$LIVE_PROJECT" --env-file "$LIVE_ROOT/.env" -f "$LIVE_ROOT/docker-compose.yml")
"${LIVE_DC[@]}" config --quiet
"${LIVE_DC[@]}" config --format json > "$LIVE_BACKUP/previous.compose.json"
chmod 600 "$LIVE_BACKUP/previous.compose.json"
docker inspect "$LIVE_CONTAINER" --format '{{.Image}}' > "$LIVE_BACKUP/previous.image-id"
docker inspect "$LIVE_CONTAINER" --format '{{.Id}}' > "$LIVE_BACKUP/previous.container-id"
LIVE_OLD_IMAGE=$(cat "$LIVE_BACKUP/previous.image-id")
docker image tag "$LIVE_OLD_IMAGE" "openclass-live:rollback-$(basename "$LIVE_BACKUP")"
docker image save "$LIVE_OLD_IMAGE" -o "$LIVE_BACKUP/previous.image.tar"
chmod 600 "$LIVE_BACKUP/previous.image.tar"
```

Para Git, respaldar además en ese directorio privado el ref, Compose y variables exportadas
por Dockhand, sin mostrarlas en consola. El Compose resuelto debe provenir de las variables
reales del stack, no de una nueva configuración ni de valores por defecto. Si no se pueden
exportar o reproducir, detenerse. El respaldo contiene secretos: nunca subirlo a Git ni adjuntarlo.

## 3. Transferencia manual y verificación

En el computador local, revisar `despliegue/SHA256SUMS`. El propietario transfiere por su
medio habitual únicamente `openclass-live-0.2.0.tar.gz` y `SHA256SUMS` a
`/home/openclass-live-incoming/0.2.0/`. Codex no ejecuta esa transferencia.

El propietario crea primero el directorio desde su terminal VPS:

```bash
install -d -m 700 /home/openclass-live-incoming/0.2.0
```

Luego, desde PowerShell local, usando su destino SSH real ya autorizado:

```powershell
$LiveSshTarget = Read-Host 'Destino SSH del propietario (usuario@host)'
$LiveDist = 'D:\OpenClass\Reveal.js\create-openclass-uniminuto-revealjs\services\openclass-live\despliegue'
scp "$LiveDist\openclass-live-0.2.0.tar.gz" "$LiveDist\SHA256SUMS" "${LiveSshTarget}:/home/openclass-live-incoming/0.2.0/"
if ($LASTEXITCODE -ne 0) { throw 'Transferencia fallida: detenerse' }
```

Propietario, VPS:

```bash
LIVE_INCOMING=/home/openclass-live-incoming/0.2.0
cd "$LIVE_INCOMING"
test "$(wc -l < SHA256SUMS)" -eq 1
grep -Eq '^[0-9a-f]{64}  openclass-live-0\.2\.0\.tar\.gz$' SHA256SUMS
sha256sum -c SHA256SUMS
```

Comparar también el SHA con el entregado por Codex por un canal independiente del tarball.

## 4. Extracción controlada y construcción

Python 3 se usa solo para validar y extraer archivos regulares de la lista blanca.
El directorio de release debe ser nuevo; no sobrescribir la instalación ni su `.env`.

```bash
LIVE_RELEASE=/home/openclass-live-releases/0.2.0
export LIVE_RELEASE LIVE_INCOMING
python3 - <<'PY'
import os, pathlib, tarfile, json
dest = pathlib.Path(os.environ['LIVE_RELEASE'])
archive = pathlib.Path(os.environ['LIVE_INCOMING'])/'openclass-live-0.2.0.tar.gz'
allowed = {'docker-compose.yml','Dockerfile','.dockerignore','.env.example','package.json','package-lock.json','scripts/hash-password.mjs'}
with tarfile.open(archive, 'r:gz') as t:
    members = t.getmembers()
    seen = set()
    for m in members:
        p = pathlib.PurePosixPath(m.name)
        assert p.parts[0] == 'openclass-live-0.2.0' and not p.is_absolute() and '..' not in p.parts
        relative = pathlib.PurePosixPath(*p.parts[1:]).as_posix()
        assert m.isfile() and relative not in seen
        assert relative in allowed or (p.parts[1] in ('src','public') and p.suffix in ('.mjs','.html','.css','.svg'))
        seen.add(relative)
    assert allowed <= seen
    dest.mkdir(parents=True, exist_ok=False)
    for m in members:
        target = dest.joinpath(*pathlib.PurePosixPath(m.name).parts[1:])
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(t.extractfile(m).read())
        target.chmod(0o644)
    # COPY conserva permisos: el usuario node debe poder recorrer src/ y public/.
    for directory in dest.rglob('*'):
        if directory.is_dir(): directory.chmod(0o755)
p = json.loads((dest/'package.json').read_text())
l = json.loads((dest/'package-lock.json').read_text())
assert p['version'] == l['version'] == l['packages']['']['version'] == '0.2.0'
assert 'image: openclass-live:0.2.0' in (dest/'docker-compose.yml').read_text()
print('WHITELIST_AND_VERSIONS_OK')
PY
docker build --tag openclass-live:0.2.0 "$LIVE_RELEASE"
docker image inspect openclass-live:0.2.0 --format '{{.Id}}' > "$LIVE_BACKUP/new.image-id"
LIVE_NEW_IMAGE=$(cat "$LIVE_BACKUP/new.image-id")
```

## 5. Configuración efectiva sin regenerar secretos

La configuración efectiva anterior conserva red, labels, mounts, orígenes, límites y todos
los parámetros reales. Solo se cambia la imagen y se elimina `build` para impedir una
reconstrucción accidental del código antiguo. Se usa el ID inmutable recién construido.
No imprimir el JSON: contiene secretos resueltos. No sobrescribir `.env`.

```bash
export LIVE_BACKUP LIVE_NEW_IMAGE
python3 - <<'PY'
import json, os, pathlib
b = pathlib.Path(os.environ['LIVE_BACKUP'])
old = json.loads((b/'previous.compose.json').read_text())
assert set(old['services']) == {'openclass-live'}, 'Stack inesperado: detenerse'
previous = json.loads(json.dumps(old))
previous['services']['openclass-live']['image'] = (b/'previous.image-id').read_text().strip()
previous['services']['openclass-live'].pop('build', None)
(b/'rollback.compose.json').write_text(json.dumps(previous))
new = json.loads(json.dumps(old))
s = new['services']['openclass-live']
s['image'] = os.environ['LIVE_NEW_IMAGE']
s.pop('build', None)
assert s['environment'] == old['services']['openclass-live']['environment']
(b/'approved.compose.json').write_text(json.dumps(new))
print('CONFIG_PRESERVED')
PY
chmod 600 "$LIVE_BACKUP/approved.compose.json" "$LIVE_BACKUP/rollback.compose.json"
LIVE_APPROVED=(docker compose --project-directory "$LIVE_ROOT" -p "$LIVE_PROJECT" -f "$LIVE_BACKUP/approved.compose.json")
"${LIVE_APPROVED[@]}" config --quiet
```

Antes de continuar, verificar que Dockhand gestiona esta definición aprobada (o su equivalente
Git fijado y verificado) y conserva su configuración privada. No dejar su ruta apuntando al
Compose antiguo. Conservar el Compose de rollback fuera de cualquier checkout automático.

## 6. Promoción y verificación inmediata

Volver a confirmar ausencia de clases. No usar `down`, no crear otro proyecto.

```bash
"${LIVE_APPROVED[@]}" up -d --no-deps --no-build --pull never openclass-live
test "$(docker inspect "$LIVE_CONTAINER" --format '{{.Image}}')" = "$LIVE_NEW_IMAGE"
for attempt in $(seq 1 24); do
  LIVE_HEALTH=$(docker inspect "$LIVE_CONTAINER" --format '{{.State.Health.Status}}')
  test "$LIVE_HEALTH" != unhealthy || break
  test "$LIVE_HEALTH" != healthy || break
  sleep 5
done
test "$LIVE_HEALTH" = healthy
test "$(docker ps --filter name=^/openclass-live$ --format '{{.ID}}' | wc -l)" -eq 1
docker exec "$LIVE_CONTAINER" node --input-type=module -e "import p from './package.json' with {type:'json'}; import {PROTOCOLO} from './src/protocolo.mjs'; if(p.version!=='0.2.0'||PROTOCOLO.version!==2) process.exit(1); console.log('VERSION_PROTOCOL_OK')"
curl --fail --silent --show-error https://openclass-live.apps.willedtech.io/healthz
```

Desde el computador externo del propietario (Bash, con dependencias del servicio instaladas):

```bash
cd services/openclass-live
npm run verificar -- https://openclass-live.apps.willedtech.io
read -rsp 'Contraseña docente existente: ' OCLIVE_PASSWORD; echo
export OCLIVE_PASSWORD
npm run verificar -- https://openclass-live.apps.willedtech.io
unset OCLIVE_PASSWORD
```

El primer comando comprueba HTTP/HTTPS, WSS, cabeceras, rutas prohibidas y rechazo de
adaptadores antiguos; el segundo comprueba protocolo 2, autenticación, sala, voto y borrado.
Usar la contraseña existente. No pegarla como argumento ni activar `set -x`.

Desde un navegador externo y un teléfono con datos móviles: abrir el panel, iniciar sesión,
crear una sala, conectar la presentación compatible v2, unir al participante por QR, iniciar
votación de 30 segundos, votar, desconectar docente y confirmar cierre por servidor.
Publicar resultados y comprobar que no aparece la solución hasta revelar explícitamente;
repetir/revelar y finalizar la sala. La prueba usa una presentación de prueba, no modifica
el curso original. Registrar aceptación humana por separado; no se presume realizada.

## 7. Rollback real si falla cualquier validación

Detener la promoción. En Dockhand restaurar la autoridad anterior (ref/definición y variables
respaldadas) sin disparar un build ni automatismos; apuntar al Compose de rollback con imagen
anterior por ID. Si la interfaz no permite esa restauración, mantener bloqueado el stack Git
y ejecutar la ruta Compose con el mismo proyecto. Nunca dejar dos autoridades activas.

```bash
test -f "$LIVE_BACKUP/rollback.compose.json"
LIVE_OLD_IMAGE=$(cat "$LIVE_BACKUP/previous.image-id")
docker image inspect "$LIVE_OLD_IMAGE" >/dev/null 2>&1 || docker image load -i "$LIVE_BACKUP/previous.image.tar" >/dev/null
LIVE_ROLLBACK=(docker compose --project-directory "$LIVE_ROOT" -p "$LIVE_PROJECT" -f "$LIVE_BACKUP/rollback.compose.json")
"${LIVE_ROLLBACK[@]}" config --quiet
"${LIVE_ROLLBACK[@]}" up -d --no-deps --no-build --pull never openclass-live
test "$(docker inspect "$LIVE_CONTAINER" --format '{{.Image}}')" = "$LIVE_OLD_IMAGE"
for attempt in $(seq 1 24); do
  LIVE_HEALTH=$(docker inspect "$LIVE_CONTAINER" --format '{{.State.Health.Status}}')
  test "$LIVE_HEALTH" != unhealthy || break
  test "$LIVE_HEALTH" != healthy || break
  sleep 5
done
test "$LIVE_HEALTH" = healthy
curl --fail --silent --show-error https://openclass-live.apps.willedtech.io/healthz
```

La configuración anterior y sus secretos se conservan en `previous.compose.json` y la copia
privada de instalación; el rollback usa exactamente esa configuración con imagen anterior.
Restituir archivos modificados por el propietario desde el respaldo si corresponde, sin borrar
la instalación ni usar `rm -rf`. Si la versión anterior era 0.1, usar su cliente/verificador
compatible y mantener el adaptador v2 desconectado. Verificar panel y participante externo.
No regenerar secretos, limpiar imágenes, borrar respaldos ni ejecutar `docker system prune`.
