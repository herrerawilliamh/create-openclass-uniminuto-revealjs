# Marca: clasificación y condición de publicación (OpenClass Live 0.3.0)

`BRAND_PUBLICATION_AUTHORIZED=NO`. Este documento distingue lo técnico (resuelto) de la autorización humana (pendiente).

## Clasificación
| Recurso | Clase | Titularidad | Redistribución pública |
|---|---|---|---|
| `public/assets/marca/willedtech.css` | marca privada | por confirmar por el propietario | no autorizada |
| `public/assets/marca/interact-marca.svg`, `interact-marca-negativo.svg` | marca privada (logotipos) | por confirmar | no autorizada |
| `public/favicon.svg` | marca privada (icono) | por confirmar | no autorizada |
| `public/assets/marca/fuentes/*.woff2` | terceros, SIL OFL 1.1 | ver `fuentes/AVISOS.txt` | permitida con licencia y avisos |

No se interpreta la presencia de un recurso en un repositorio privado como permiso de redistribución.

## Decisión humana pendiente
El propietario debe declarar por escrito (a) la titularidad de los cuatro recursos de marca y (b) si autoriza su
publicación en el repositorio público y en artefactos. Hasta entonces no se declara publicable este release ni se
ejecuta push, PR, tag ni release que incluya estos recursos o su historial.

## Metadatos internos
`ORIGEN.json`, `BRANDING-0.3.0.md` y este documento ya no contienen el nombre del repositorio de origen, SHA ni
fechas de commit. Una prueba (`tests/marca-publicacion.test.mjs`) lo exige.

## Historial local
Los commits locales `2f2bd3b` y `b9c6726` (y sus mensajes) contienen los recursos de marca y los metadatos internos
anteriores. Ninguno está en un remoto. Para no enviar ese historial a un repositorio público, hay dos vías; ninguna se
ha ejecutado:

1. **Sin autorización de marca** (estado actual): reescribir los commits locales que introducen o mencionan la marca
   (`2f2bd3b`, `b9c6726` y los commits de esta remediación) para que el historial público parta de una versión con
   los recursos sustituidos por equivalentes propios o neutros, y los mensajes sin metadatos internos. Opciones:
   `git rebase -i` (no disponible en este entorno) o reconstruir la rama con `git commit-tree` sobre el árbol
   corregido. **Requiere autorización previa del propietario porque reescribe commits locales.**
2. **Con autorización expresa**: cambiar `BRAND_PUBLICATION_AUTHORIZED` a `SI` registrando titular, fecha y
   alcance; aun así, reescribir los mensajes de commit que citan el repositorio de origen.

En ambos casos conviene verificar con `git log --all -S"<identificador interno>"` antes de cualquier push.
