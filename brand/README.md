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
1. Añádelo como submódulo:
   `git submodule add https://github.com/willedtech/brand brand`
2. Copia `brand/AGENTS.md` a la raíz del repo (y como `CLAUDE.md`), para que los agentes lo lean solos.
3. En `tailwind.config.js` del proyecto escribe:
   `presets: [require('./brand/tokens/tailwind.config.js')]`

Para actualizar todas las apps a la vez, cambia este repo y luego, en cada app, ejecuta `git submodule update --remote brand`.

Si el repo es público, también puedes cargar los archivos por CDN, sin copiarlos:
`https://cdn.jsdelivr.net/gh/willedtech/brand@main/logo/willedtech-isotipo.svg`
