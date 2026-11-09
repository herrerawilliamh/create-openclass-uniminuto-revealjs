# Procedencia GitOps de Live: decisión y contrato de promoción

Fecha: 2026-10-27. Estado: diseño y verificador de candidatos implementados;
cadena de publicación/promoción y aceptación operativa pendientes. Sync permanece OFF.
Este documento sustituye la alternativa de construcción automática de GITOPS.md
únicamente para el futuro autosync. El Compose manual y el artefacto 0.2.0 no cambian.

## Diagnóstico y evidencia actual

- Rama local y PR #3: `release/openclass-live`, HEAD
  `51513b13168abd1e3cea061bb990cd0b3a070e29`; base del PR: `main`.
- Run `40553083592`: `completed/success`, mismo SHA (consulta `gh run view`).
- `gh api repos/herrerawilliamh/create-openclass-uniminuto-revealjs/branches/release/openclass-live/protection`
  devolvió HTTP 404 **Branch not protected**. No es evidencia de rama protegida.
- El endpoint de reglas efectivas `rules/branches/release%2Fopenclass-live`
  devolvió `[]`; tampoco hay rulesets efectivos que suplan esa protección.
- El entorno `openclass-live-release` respondió HTTP 404; no se acreditó una
  barrera de aprobación humana configurada para el workflow de release.
- La consulta REST de releases devolvió `[]`. No existe todavía release inmutable
  que pueda acreditar un lock o imagen aprobado.
- El workflow actual construye y exporta una imagen a un artifact temporal;
  no publica GHCR, no firma procedencia OCI ni produce un lock promocionado.
- Solo estaban modificados GRAPH_REPORT.md, graph.html y graph.json al iniciar;
  no se hicieron commits, push, merge, cambios en Dockhand ni accesos a VPS.

`LIVE_REVISION` es una declaración independiente del checkout. Una label que
repite esa variable no prueba el origen del contenido. El gate del payload
actual sigue siendo útil, pero no autoriza autosync.

## Gate 1: autoridad y referencias

Se elige **construir una vez en CI y promover por digest OCI**, sin `build:` en
la definición sincronizada. Se descarta reconstruir en Dockhand: no hay un hook
demostrado que inmovilice/verifique su checkout antes de cada build y promoción.

Hay tres identidades distintas:

| Identidad | Autoridad y comprobación |
|---|---|
| Código C | SHA completo al que resuelve la tag `openclass-live-vX.Y.Z`; CI manual del mismo C |
| Imagen D | Digest SHA-256 del manifiesto OCI de una plataforma; config K y capas verificadas |
| Promoción P | Commit revisado de rama estable que fija literalmente D, plataforma y lock aprobado |

P no es C: puede haber commits ajenos al servicio sin cambiar D. K es el image ID
de Docker, no D. Una tag OCI es solo un alias; nunca es autoridad de ejecución.

Proceso requerido, aún sin activar ni añadir permisos de publicación:

1. Proteger la rama estable `release/openclass-live` con PR/revisión del propietario,
   checks requeridos, sin force-push/borrado ni bypass ordinario. Aplicar rulesets
   también a tags `openclass-live-v*`, workflows y directorio de promoción. Exigir
   revisión del propietario para cambiar cualquiera de esas autoridades.
2. Crear tag aprobada en C. El workflow manual debe ejecutarse **desde esa tag**,
   comprobar `github.sha == checkout HEAD == tag^{commit}` y construir el contexto
   limpio, sin entradas sin seguimiento, una sola vez. El workflow actual permite
   checkout de otra ref: necesita ese cierre antes de producir attestations.
3. Ejecutar CI del C exacto; exportar imagen OCI y probar esa misma imagen.
   Tras aprobación del entorno `openclass-live-release` (revisor independiente,
   sin autoaprobación), publicar los mismos bytes en GHCR y firmar attestation
   SLSA/GitHub del digest D. No reconstruir en el job de aprobación/publicación.
   El workflow de build/firma debe estar revisado y sus Actions fijadas por SHA;
   impedir contexto de PR o runner no confiable. La firma prueba quién declaró
   el origen; la integridad del builder revisado es parte de la raíz de confianza.
4. Crear draft de release con `release-lock.json`, evidencia CI y sumas; publicar
   con **release immutability** habilitada previamente. Una tag protegida sola
   no vuelve inmutables los assets. La publicación humana o el entorno aprobado
   es la autorización; `immutable=true` por sí solo no prueba revisión humana.
5. El verificador comprueba release/asset firmados, tag → C, run manual exitoso
   de C, identidad del workflow firmante y fuente certificada C, todos los bytes
   OCI, plataforma y labels. Solo después emite candidato Compose por stdout.
6. Incorporar candidato + lock + evidencia en un PR de promoción P. El check
   obligatorio debe volver a verificar y comparar **el Compose efectivo** con el
   candidato exacto; rechazar `build:`, imágenes variables/tags, archivos Compose
   adicionales, overrides de imagen/plataforma, mounts de código o `command` que
   cambien la ejecución aprobada. Fusionar requiere autoridad separada.

Esquema del lock (valores de ejemplo, NO constituye una release válida):

```json
{
  "schema": 1,
  "version": "0.2.0",
  "tag": "openclass-live-v0.2.0",
  "sourceCommit": "<40 hex de C>",
  "source": "https://github.com/herrerawilliamh/create-openclass-uniminuto-revealjs",
  "imageRepository": "ghcr.io/herrerawilliamh/openclass-live",
  "manifestDigest": "sha256:<64 hex de D>",
  "configDigest": "sha256:<64 hex de K>",
  "ciRun": "<run manual exitoso del C exacto>",
  "platform": "linux/amd64"
}
```

El verificador admite manifiestos OCI de una plataforma (`linux/amd64` o
`linux/arm64`), no índices multiarch. Elegir la arquitectura real antes de
construir/aprobar; no resolverla silenciosamente durante la promoción.

Desde la raíz, con lock real descargado de la release y layout OCI de la misma
imagen (GH CLI compatible con release verify/verify-asset y attestation verify,
autenticación GitHub/GHCR de solo lectura):

```powershell
node services/openclass-live/scripts/procedencia-autosync.mjs <release-lock.json> <oci-layout>
```

El comando no despliega, publica ni modifica archivos. Emite Compose solo si
todas las comprobaciones pasan; errores de red, assets/firmas ausentes, campos
incorrectos o blobs incompletos terminan con código distinto de cero. No usar
redirección directamente sobre el Compose aprobado: capturar salida y comprobar
el exit code antes de escribir un candidato temporal y revisarlo.

La variable `LIVE_REVISION` no se usa en esta ruta: un valor obsoleto no cambia
imagen ni labels. Las labels vienen de la config OCI firmada, nunca de Compose.
Una diferencia entre labels y C se rechaza incluso si los hashes son coherentes.
La label no sustituye la attestation ni la comprobación del origen certificado.

## Gate 2: interacción con el Git stack existente

Destino propuesto: directorio dedicado
`services/openclass-live/deploy-approved/`, con `compose.yml` y lock literales,
creado solo cuando exista una release válida. Este trabajo NO crea un digest
ficticio ni cambia la ruta actual. No es un segundo stack.

En una operación autorizada posterior, el propietario debe apuntar **el Git stack
existente** al directorio aprobado y a la rama estable protegida; conservar
proyecto/servicio/container_name `openclass-live`, Traefik, red `web`, secretos y
resto de variables. Guardar rama/ruta puede desplegar: no hacerlo para explorar.

Opciones del diseño: Build images on deploy OFF, Force redeployment OFF,
auto-update de contenedores OFF. `pull_policy: always` obtiene el digest literal;
no busca una versión más reciente. No hay `build:` ni fallback a checkout local.
Webhook OFF. Scheduled Sync solo se habilitaría tras aceptación operativa y
autorización explícita futura. No se propone actualizar Dockhand en este trabajo.

Según el manual actual, Scheduled Sync detecta commits y filtra cambios en el
directorio Compose. Cambios ajenos a ese directorio se omiten; Compose recrea
solo configuraciones que cambian. La documentación actual no prueba lo que hace
la versión instalada: validar su compatibilidad en laboratorio, sin acceder al VPS.

Dockhand **no garantiza** aprobación humana, firma de release, correspondencia
C↔D, ausencia de bypass en GitHub, disponibilidad de GHCR ni rollback transaccional.
Esas propiedades recaen en release/promotion checks, protecciones y retención.
Docker valida contenido por digest; verificar ejecución requiere además cotejar
`container.Config.Image == imagen@D`, `container.Image == K`, plataforma, salud y
protocolo. `synced` no acredita que D se esté ejecutando.

No hay hook de procedencia dentro de Dockhand en esta solución. El bloqueo es
**antes de promover P**, y depende de que ningún actor pueda publicar directamente
una definición no verificada. Si no puede imponerse la protección sin bypass,
AUTOSYNC_PROVENANCE sigue FAIL. Un override local de imagen o Compose adicional
también invalida el contrato aunque el archivo Git sea correcto.

## Gate 3: validación y límites de la evidencia

Prueba ejecutable integrada automáticamente en el `npm test` existente:

```powershell
node --test services/openclass-live/tests/procedencia-autosync.test.mjs
node services/openclass-live/scripts/verificar-gitops.mjs
npm --prefix services/openclass-live test
```

| Caso | Resultado del contrato local | Evidencia externa todavía requerida |
|---|---|---|
| Release aprobada | Acepta fixture coherente, verifica argumentos de autoridad y conserva configuración | Release real inmutable, firma y aprobación del builder |
| Cambio Git ajeno al servicio | Candidato y D idénticos | Scheduled Sync de la versión instalada sin recreación |
| Commit no aprobado | Rechaza tag/C divergentes, CI de PR, release mutable o firma ausente | Protecciones y checks obligatorios reales |
| SHA de imagen incorrecto | Rechaza revisión OCI diferente aunque sus hashes sean válidos | Attestation real del builder revisado |
| LIVE_REVISION obsoleta | No participa en selección ni labels | Compose efectivo sin overrides de imagen |
| Imagen distinta | Rechaza sustitución de manifiesto, config o capa | Inspección del contenedor: referencia D e image ID K |
| Descarga/build fallido | Blob ausente o autoridad inaccesible abortan sin salida; ruta sin build | Pull fallido en laboratorio preserva el servicio previo; fallo CI no promueve P |
| Recuperación anterior | Revalidar lock anterior produce exactamente su candidato D/K | Recuperación Docker/health/protocolo en laboratorio |

Las fixtures de API/OCI son sintéticas: 8/8 no acredita firma real, pull, arranque,
Scheduled Sync ni rollback de contenedores. El adaptador CLI usa GH real; no se
ejecutó positivamente porque no existe release/image aprobada. No hay publicación
ni infraestructura activadas por estas pruebas.

Resultado local final: `GITOPS_PAYLOAD=PASS` (24 archivos); suite del servicio
**43/43 PASS**, incluidos los ocho casos nuevos. `git diff --check` sin errores.
Graphify actualizado mediante `graphify update .` (AST, sin llamadas LLM).

## Rollback y fallos cerrados

Conservar release anterior inmutable, lock, digest D/K, blobs OCI recuperables,
Compose efectivo y configuración privada. Política de retención GHCR: no borrar
digests promovidos; un digest es inmutable pero puede dejar de estar disponible.

Antes de promover, verificar disponibilidad de candidato y anterior. Ante fallo
de build/CI/verificación, no crear ni fusionar P. Ante fallo de pull no permitir
fallback a tags o reconstrucción. No asumir que Compose preserva automáticamente
el contenedor anterior ante todos los fallos: hay que demostrarlo en laboratorio.

Rollback Git: nuevo PR que restaura los archivos aprobados anteriores y su lock,
sin reset/force-push ni rebuild. Revalidar firma, C, D/K y configuración. Después
del sync, comprobar contenedor real y salud. Si Git o GHCR fallan, detener sync
y usar exclusivamente la imagen/cache OCI previamente verificada bajo un
procedimiento manual autorizado; si falta esa copia, declarar RECOVERY_REQUIRED.
Restaurar Git no basta para declarar recuperación del runtime. No prometer
rollback automático: Compose/Dockhand no son una transacción de aplicación.
Las salas en memoria se pierden con una recreación, incluso al volver a D anterior.

La conservación del único contenedor impide un reemplazo sin interrupción; la
promoción debe ocurrir fuera de clases/salas activas. No tocar otros servicios.

## Decisión al cierre de este trabajo

```text
AUTOSYNC_PROVENANCE=FAIL
RELEASE_IDENTITY=FAIL
IMAGE_INTEGRITY=FAIL
ROLLBACK=FAIL
CI=PASS
READY_FOR_AUTOSYNC=NO
```

CI=PASS corresponde al run 40553083592 del HEAD publicado, no a una ejecución
GitHub de estos archivos locales nuevos. Los tests locales se reportan aparte.
FAIL indica evidencia/cadena operativa incompleta, no un defecto demostrado del
algoritmo SHA-256. Faltan builder/publicador firmado, release real inmutable,
protección de rama/check de promoción efectivo y laboratorio de sync/pull/runtime/
recuperación. No se declara cerrado el bloqueo por disponer de un diseño o fixtures.

Fuentes primarias consultadas:

- [Manual Dockhand: Git integration, deploy options y comportamiento](https://dockhand.pro/manual/).
- [GitHub: releases inmutables](https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases).
- [GH CLI: attestation verify y límites de confianza del predicate](https://cli.github.com/manual/gh_attestation_verify).
- [GH CLI: release verify](https://cli.github.com/manual/gh_release_verify) y
  [verify-asset](https://cli.github.com/manual/gh_release_verify-asset).
