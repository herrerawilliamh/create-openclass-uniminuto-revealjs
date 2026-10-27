# Hotfix v0.1 — sin filtración del acierto antes de revelar

**Estado: preparado, NO desplegado.** Desplegarlo requiere autorización expresa del propietario.

## Defecto

En OpenClass Live v0.1 (commits `a8b9c29` y `37c15cd`; `src/salas.mjs` idéntico en ambos y en
`despliegue/openclass-live-0.1.0/`), al **publicar resultados** sin revelar la respuesta, cada ronda que
recibían los estudiantes incluía `porcentajeCorrecto`. Con una sola respuesta propia (p. ej. B) y ese
porcentaje, el estudiante deduce cuál es la correcta antes de que el docente la revele.

## Parche

`v0.1-sin-filtracion-acierto.patch` (mínimo, sin funcionalidades nuevas):

- `src/salas.mjs`: los resúmenes de ronda para estudiantes pasan por `resumenParticipante()`, que quita
  `porcentajeCorrecto` mientras `correctaRevelada` sea `false`. El docente conserva su acierto privado;
  tras revelar, el estudiante recibe el acierto como antes.
- `tests/unidad.test.mjs`: sonda de regresión (respuesta B, resultados publicados, sin revelar → ni
  `porcentajeCorrecto`, ni `correctas`, ni `explicacion`).

No cambia el protocolo, los eventos ni los clientes (`public/`): el cliente v0.1 ya trata
`porcentajeCorrecto` como opcional.

Nota: este parche solo corrige el acierto. En v0.1 el servidor sigue recibiendo la solución al crear la
encuesta; eso se corrige en v0.2 (la solución viaja únicamente con `encuesta:revelar`) y requiere el
adaptador de Reveal.js v0.2, por eso no forma parte del hotfix.

## Verificación hecha (2026-10-26)

- Árbol de `37c15cd`: la sonda falla sin el parche (`sin acierto, correcta ni explicación`) y la suite
  completa pasa con él: `npm test` → 26/26.
- `git apply --check` limpio sobre `a8b9c29`.
- Aplicado sobre una copia de `despliegue/openclass-live-0.1.0/` (solo `src/`), el módulo carga.
- R3 (mismo día): las líneas de contexto vacías ya no llevan el espacio inicial (`git apply` las acepta
  como contexto vacío), así que `git diff --check` queda limpio sin `--unidiff-zero` ni cambiar el alcance.
  Sobre `git archive` de `a8b9c29` y de `37c15cd` (mismo `salas.mjs`, blob `2c62060`): `git apply` limpio,
  suite 25/25 antes y 26/26 después; solo con la prueba del parche (sin la corrección) la sonda falla.

## Aplicación (cuando se autorice)

Desde la raíz del repositorio, sobre una rama basada en el commit desplegado:

```bash
git apply services/openclass-live/hotfix/v0.1-sin-filtracion-acierto.patch
```

Sobre el paquete desplegado (contiene `src/` pero no `tests/`), desde su carpeta:

```bash
git apply -p3 --include='src/*' /ruta/v0.1-sin-filtracion-acierto.patch
```

Después: `npm test` (en el árbol con pruebas), reconstruir la imagen y `npm run verificar -- <APP_URL>`.
Las salas abiertas se pierden al reiniciar el contenedor: aplicarlo fuera del horario de clase.
