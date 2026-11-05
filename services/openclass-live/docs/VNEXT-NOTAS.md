# Notas de decisión técnica — Teacher Experience VNext

Base auditada: `2006af3907026c5bf4997ca4890e484adc386ab9`. Copia aislada local, sin remoto.

## I0 — `preparacion-release.test.mjs:29` (commit 8b02f6e)
- Causa: en Windows, `tar` resuelve a GNU tar de Git for Windows, que interpreta `C:\…` como host remoto (`Cannot connect to C: resolve failed`, código 2). El paquete y el empaquetador son correctos.
- Cambio: el test lista el archivo con ruta relativa y `cwd: dir`. Empaquetador intacto.
- Prueba: `node --test tests/preparacion-release.test.mjs` 2/2.

## I1 — OC-A02 atomicidad de encuestas (commit eebdc33)
- Causa: `encuesta:crear` con `abrir:true` creaba la encuesta y luego fallaba en `abrirEncuesta` (`otra_abierta`), dejando una encuesta residual.
- Cambio: `crearEncuesta(salaId, def, { abrir })` valida (límite y votación abierta) antes de mutar; `sockets.mjs` lo invoca en una sola operación. Protocolo, eventos y acuses sin cambios.
- Archivos: `src/salas.mjs`, `src/sockets.mjs`, `tests/unidad.test.mjs`, `tests/integracion.test.mjs`.
- Pruebas: unidad + Socket.IO nuevas; `npm test` 36/37.
- Pendiente: `gitops-release.test.mjs` falla porque `releases/0.2.0.json` certifica el payload aprobado. Cualquier cambio en `src/` exige una versión nueva y su manifiesto; no se regeneró.
