# Marca: clasificación y condición de publicación (OpenClass Live 0.3.0)

`BRAND_PUBLICATION_AUTHORIZED=YES`, limitado a los cuatro recursos de la tabla siguiente.

## Clasificación
| Recurso | Clase | Titularidad | Redistribución pública |
|---|---|---|---|
| `public/assets/marca/willedtech.css` | marca privada | declarada por el propietario | autorizada (2026-11-08) |
| `public/assets/marca/interact-marca.svg`, `interact-marca-negativo.svg` | marca privada (logotipos) | declarada por el propietario | autorizada (2026-11-08) |
| `public/favicon.svg` | marca privada (icono) | declarada por el propietario | autorizada (2026-11-08) |
| `public/assets/marca/fuentes/*.woff2` | terceros, SIL OFL 1.1 | ver `fuentes/AVISOS.txt` | permitida con licencia y avisos |

No se interpreta la presencia de un recurso en un repositorio privado como permiso de redistribución.

## Autorización del propietario
El 8 de noviembre de 2026 el propietario declaró expresamente que es titular de los derechos necesarios o cuenta con
autorización suficiente para distribuir públicamente `willedtech.css`, los dos logotipos Interact y `public/favicon.svg`,
y autorizó su inclusión en el repositorio público y en los artefactos de distribución de OpenClass Live.

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
