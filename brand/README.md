# willedtech-brand

Kit de marca de WillEdTech: isotipo, logos con nombre, sub-marcas de producto, tokens de diseño y la guía que siguen las personas y las IAs.

```
BRAND.md      ← guía completa (léela primero)
AGENTS.md     ← instrucciones cortas para agentes de código (copia también como CLAUDE.md)
logo/         ← isotipo, badge, horizontal, vertical, con y sin lema, favicon
products/     ← lti-provider, openclass-live, jarvis-pediatria, studio
tokens/       ← tailwind.config.js (preset), willedtech.css, tokens.json
index.html    ← muestrario visual de todo el sistema
```

## Usarlo en un repo
Este repo es **privado**. Para que el despliegue y la integración continua no necesiten credenciales, cada app lleva una **copia** del kit en su carpeta `brand/`, y este repo es la fuente oficial.

1. Copia la carpeta del kit a `brand/` en la raíz de la app.
2. Copia `brand/AGENTS.md` a la raíz de la app (y como `CLAUDE.md`), o agrega su sección a las instrucciones que ya existan.
3. En el `tailwind.config.js` de la app escribe:
   `presets: [require('./brand/tokens/tailwind.config.js')]`

**Para actualizar la marca:** cambia este repo y luego vuelve a copiar `brand/` en cada app. Hoy las apps son `lti-provider`, `willedtech-platform-studio` y `create-openclass-uniminuto-revealjs` (servicio OpenClass Live).

## Regenerar las marcas
`tools/` contiene los scripts en Python que construyen los monogramas y los lockups desde la geometría de la W:
- Necesitan `shapely` y `fonttools`.
- Las fuentes salen de `npm i @fontsource/merriweather-sans @fontsource/atkinson-hyperlegible`.
- Para un producto nuevo, agrégalo a `PRODUCTS` en `tools/marks.py`, siguiendo la receta de `BRAND.md`, y ejecuta `python3 tools/build.py`.
