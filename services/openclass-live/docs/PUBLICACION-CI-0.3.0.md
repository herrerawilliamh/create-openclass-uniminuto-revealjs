# Publicación CI/GHCR de OpenClass Live 0.3.0 (preparada, no ejecutada)

Estado: preparado localmente. **Nada se ha publicado, etiquetado ni ejecutado en GitHub.** Sync, webhooks y
Scheduled Sync siguen OFF; la VPS no se tocó. Complementa `AUTOSYNC-PROVENANCE.md` y `GITOPS.md`; el manifiesto
histórico `releases/0.2.0.json` no cambió (hay una prueba que fija su hash).

## Identidad del candidato

`9b33a72` ya **no** es la identidad efectiva de publicación: este trabajo añade commits (workflow, scripts, tests,
docs). La tag `openclass-live-v0.3.0` debe crearse sobre el commit final aprobado (FINAL_SHA del informe) y ese
mismo commit debe ser la punta de `release/openclass-live`. El payload ejecutable (`src`, `public`, `Dockerfile`)
no cambió respecto de 9b33a72 (`verificar-gitops.mjs` sigue en PASS); aun así, la imagen se construye del commit final.

## Cadena en `.github/workflows/openclass-live.yml`

| Job | Permisos | Qué hace |
|---|---|---|
| `checks` (PR y manual) | `contents: read` | Identidad (solo manual), contrato del workflow, payload, tests, navegador, `compose config`. Sin credenciales, sin build. |
| `build` (solo manual) | `contents: read` | `git archive` del commit → **un solo** `buildx build` (base Node por digest, BuildKit por digest) → tar OCI de un manifiesto/plataforma → `release-lock.json` → humo sobre ese mismo tar → artifact con `SHA256SUMS`. |
| `approval` (solo manual) | `{}` | Entorno `openclass-live-release` con revisor requerido. Sin código ni credenciales. |
| `publish` (solo manual y ref `refs/tags/openclass-live-v*`) | `packages`, `id-token`, `attestations: write` | Descarga el artifact, verifica hash del tar, lock y layout, copia los **mismos bytes** a GHCR (`skopeo --preserve-digests`), los descarga por digest, vuelve a verificar y compara blobs con lo construido, atestigua el digest, emite Compose candidato. No reconstruye. |

Controles: todas las Actions por SHA completo (checkout 11bd719 v4.2.2, setup-node 49933ea v4.4.0,
upload-artifact ea165f8 v4.6.2, download-artifact d3f86a1 v4.3.0, attest-build-provenance e8998f9 v2.4.0,
setup-buildx e468171 v3.11.1; BuildKit v0.23.2 `sha256:ddd1ca44…`). Los SHA se resolvieron por `gh api` el
2026-11-08; **el propietario debe revisarlos** antes de aceptar el workflow. Sin `pull_request_target` ni secretos
en tests; `persist-credentials: false` en todos los checkout; el token de escritura existe solo en `publish`.
`scripts/publicacion-ci.mjs workflow` audita estas reglas y corre en `checks` y en `npm test`.

Una label OCI no prueba procedencia: `verificarOci` exige que la revisión del config coincida con el lock **y** la
verificación posterior (`gh attestation verify`, ver `procedencia-autosync.mjs`) ata el digest al workflow y al commit.

## `release-lock.json`

Esquema 1 de `AUTOSYNC-PROVENANCE.md` más `evidence` (obligatorio): `workflow`, `runAttempt`, `ociArchiveSha256`
(hash del tar aprobado) y `payloadSha256` (manifiesto `releases/<v>.json`). `sourceCommit`, `manifestDigest`,
`configDigest`, `platform` y `ciRun` provienen del build, no de variables libres. Se genera en `build` y se
entrega en el artifact `openclass-live-release-<sha>` junto a `docker-compose.candidate.yml` (digest literal,
sin `build:` ni `latest`). **Adjuntarlo a la release inmutable es manual** (el workflow no tiene `contents: write`).

## Pruebas locales

`tests/publicacion-ci.test.mjs` (8): contrato del workflow, 12 mutaciones (Action móvil, permisos, credenciales en
tests, rebuild, `pull_request_target`, publish sin aprobación/tag, `latest`, falta de comparación), identidad
(PR, rama, tag/versión/ref/SHA/HEAD/rama divergentes), layout→lock→OCI, multiarch/label falsa/blob sustituido,
tar no aprobado, publicado≠construido, Compose por digest, CLI y hash de 0.2.0. Las fixtures OCI son sintéticas.

## Pendiente en GitHub (no simulado)

1. Entorno `openclass-live-release` con revisor requerido distinto del autor (antes: 404).
2. Ruleset/protección de `release/openclass-live`; ruleset de tags `openclass-live-v*` y de `.github/workflows/`.
3. Release immutability habilitada en el repositorio.
4. Paquete GHCR `openclass-live`: primera publicación, vínculo al repositorio, visibilidad y acceso de lectura
   para el consumidor; política de retención (no borrar digests promovidos).
5. Minutos de Actions disponibles; `skopeo` y Docker ≥ 25 (`docker load` de archivos OCI) en `ubuntu-24.04`.
6. Primera ejecución real: confirmar `rewrite-timestamp`, humo del contenedor, `skopeo copy` de layout OCI y
   `gh attestation verify oci://…` con `procedencia-autosync.mjs`. Estas piezas **no** se han ejecutado.
