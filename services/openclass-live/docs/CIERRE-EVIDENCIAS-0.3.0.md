# Cierre de evidencias OpenClass Live 0.3.0 (candidato 9b33a72)

Candidato: `9b33a7203dd1151dc9b3b18549bc8bacd66dd5e4`. Estado: VERIFIED local; **no PROMOTABLE**.

## Evidencia de navegador
- Log: `C:\tmp\oc-release\e2e-grouped.log` (SHA-256 `9b1b15f4d74ff8454939294585fb5b849627d36308d2f6b26ba6cae79611701d`).
- `npm run test:navegador`: 25 pruebas, 25 pass, 0 fail, 0 skipped. Ejecutado a las 12:38, antes del commit
  candidato (12:39).
- `git diff 5c35888 9b33a72 -- src public Dockerfile` es vacío: el código ejecutado por el servicio es el mismo.
  Cambian solo versión, Compose, manifiesto, docs y tests de preparación. Evidencia válida; no se repitió.
- Límite: el log fue generado sobre árbol de trabajo previo al commit, sin SHA impreso. No es procedencia firmada.

## Identidad
- `releases/0.3.0.json.sourceBase` = `5c35888…` (integración). Es la base del payload, no el commit de release; es
  coherente con `PROMOCION-0.3.0.md` (la identidad final es el commit que contiene el manifiesto = 9b33a72).
  No se modificó: corregirlo exigiría regenerar el tarball y el hash.
- No existe imagen OCI construida del candidato. `LIVE_REVISION` es una variable libre: la label
  `org.opencontainers.image.revision` solo vale lo que se pase al build. Una imagen construida con `5c35888`
  no sería 0.3.0 (versión y Compose cambian en 9b33a72). Ninguna imagen representa hoy 9b33a72.
- `releases/0.2.0.json` intacto.

## Contrato por digest (AUTOSYNC-PROVENANCE.md)
Construir una vez en CI desde la tag, publicar los mismos bytes en GHCR tras aprobación, firmar attestation del
digest, lock `release-lock.json` en release inmutable, verificar con `scripts/procedencia-autosync.mjs`, PR de
promoción con Compose literal por digest. Brechas del workflow actual: no publica GHCR, no atestigua, Actions no
fijadas por SHA, entorno de aprobación posterior al build sin publicación. Ajuste aplicado aquí: el job manual
exige `GITHUB_REF == refs/tags/<tag>` y `GITHUB_SHA == HEAD`.
Pendiente (no ejecutado): job de publicación (`packages: write`, `id-token`, `attestations: write`) bajo
el entorno aprobado, con Actions fijadas por SHA.

## Controles requeridos en GitHub (verificables con `gh api`)
1. Protección/ruleset de `release/openclass-live` (PR, revisión del propietario, checks requeridos, sin force-push).
2. Ruleset de tags `openclass-live-v*` (sin borrar/mover) y de `.github/workflows/`.
3. Entorno `openclass-live-release` con revisor requerido distinto del autor (antes: 404).
4. Release immutability habilitada en el repositorio.
5. Permisos de GHCR/paquete `openclass-live` y política de workflow (`actions` fijadas, tokens mínimos).
6. Minutos de Actions disponibles (la memoria registra que no los había).

## Rollback
Procedimiento en `PROMOCION-0.3.0.md` §7 (Compose de rollback por ID de imagen anterior, `--no-build --pull never`).
Requieren ensayo: restauración de `previous.image.tar`, healthcheck, que Dockhand no re-dispare autosync,
coincidencia del Compose de rollback con la config real y las salas en memoria (se pierden; el rollback no las recupera).
Ningún ensayo se ejecutó (VPS/Dockhand fuera de alcance).
