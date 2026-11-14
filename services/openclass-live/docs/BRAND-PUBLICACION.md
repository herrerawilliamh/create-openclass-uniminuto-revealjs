# Marca: clasificación y condición de publicación (Interact 0.4.4 con Brand 3.1.0)

`BRAND_PUBLICATION_AUTHORIZED=YES`, para todos los recursos listados de Brand 3.1.0. El propietario
declaró el 13 de noviembre de 2026 que puede distribuirlos públicamente. Ver `docs/BRANDING-0.3.0.md`.

## Clasificación
| Recurso | Clase | Titularidad | Redistribución pública |
|---|---|---|---|
| `public/assets/marca/willedtech.css` | marca privada | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/interact-marca.svg`, `interact-marca-negativo.svg` | marca privada (logotipos) | declarada por el propietario | autorizada (2026-11-13) |
| `public/favicon.svg` | marca privada (icono) | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/fuentes/*.woff2` | terceros, SIL OFL 1.1 | ver `fuentes/AVISOS.txt` | permitida con licencia y avisos |
| `public/assets/marca/interact-horizontal.svg` | marca privada (lockup) | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/interact-compacto.svg` | marca privada (lockup compacto) | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/willedtech-header.css` | marca privada (CSS) | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/willedtech-motion.css` | marca privada (CSS) | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/willedtech-isotipo-motion.svg` | marca privada (isotipo para movimiento) | declarada por el propietario | autorizada (2026-11-13) |
| `public/assets/marca/willedtech-view-transitions.css` | marca privada (CSS) | declarada por el propietario | autorizada (2026-11-13) |
| `scripts/brand-verify.mjs` | herramienta de marca (script) | declarada por el propietario | autorizada (2026-11-13) |

## Autorización del propietario
El 13 de noviembre de 2026 el propietario declaró expresamente que es titular de los derechos necesarios o cuenta con
autorización suficiente para distribuir públicamente todos los recursos de Brand 3.1.0 adoptados localmente,
y autorizó su inclusión en el repositorio público y en los artefactos de distribución de Interact by WillEdTech.

Esto es una declaración atribuida al propietario; no constituye una licencia transferida por un tercero ni una
certificación independiente de titularidad. **No** se autoriza publicar el repositorio privado de marca ni ningún otro
de sus recursos, que permanecen excluidos.

## Metadatos internos
`ORIGEN.json`, `BRANDING-0.3.0.md` y este documento ya no contienen el nombre del repositorio de origen, SHA ni
fechas de commit. Una prueba (`tests/marca-publicacion.test.mjs`) lo exige.

## Historial
La rama destinada a publicación no contiene los commits antiguos que citaban metadatos internos de la marca; esos
commits solo existen en una referencia local de recuperación, que no debe enviarse a ningún remoto. Antes de publicar,
verificar con `git log <rama> -i --grep` y `git grep` que no aparecen identificadores internos.
