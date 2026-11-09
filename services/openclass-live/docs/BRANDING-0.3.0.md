# Adaptación a WillEdTech Brand v3 (OpenClass Live 0.3.0)

Procedencia: recursos privados de marca WillEdTech (tokens CSS, dos logotipos Interact y el favicon), copiados
por lectura de API sin clonar. No se publican identificadores internos del repositorio de origen (nombre, SHA,
fechas) en este repositorio. `public/assets/marca/ORIGEN.json` clasifica cada recurso.

**Estado de publicación: `BRAND_PUBLICATION_AUTHORIZED=YES`** (solo los cuatro recursos indicados). El propietario
declaró el 8 de noviembre de 2026 que puede distribuirlos públicamente; el resto del kit de marca sigue privado y
excluido. Ver `docs/BRAND-PUBLICACION.md`.

## Qué cambia
- Nombre visible: **Interact by WillEdTech** (regla de nombres de BRAND.md §2). El servicio, la ruta
  `services/openclass-live`, la imagen Docker y el protocolo conservan su nombre técnico.
- Tokens: `assets/marca/willedtech.css` (copia con una corrección de CSS, ver `ORIGEN.json`) alimenta `estilos.css` y `docente.css`; ya no hay HEX sueltos de marca.
- Logo: monograma «I» de Interact (versión negativa sobre la barra violeta) y favicon `interact-app.svg`.
- Títulos en la tipografía de títulos de la marca (peso 800, −0,02em) y texto en la de lectura.
- Estados: avisos con borde/icono además del color; «sin conexión» con ⚠ y texto.

## Pendiente (no se improvisó)
- **Fuentes**: autoalojadas (Fontsource latin, OFL 1.1) en `public/assets/marca/fuentes/`; el empaquetador admite `.woff2`.

## Identidad oficial (decisión del propietario)
Nombre comercial: **Interact by WillEdTech**; titular de la marca: WillEdTech. Interact es independiente de UNIMINUTO, que no es propietario ni proveedor del producto. OpenClass sigue siendo el sistema de presentaciones y cursos; Interact se integra con OpenClass y con otras soluciones. Se conservan los identificadores técnicos `openclass-live` y la versión 0.3.0, el dominio, las rutas, el contenedor, la red Docker y Traefik hasta una migración independiente.
