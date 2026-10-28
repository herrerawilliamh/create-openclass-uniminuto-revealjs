# OpenClass UNIMINUTO · Reveal.js

Generador npm de presentaciones docentes interactivas con **Reveal.js**: un comando crea un curso
completo con portal, hasta ocho semanas, 13 layouts con identidad visual, código con scroll o
paginado, Mermaid, Chart, fórmulas, actividades interactivas y una guía del docente integrada.
El docente escribe **Markdown**; no necesita saber React.

![Portada de la demostración «TEMÁTICA DE PRUEBA»](site/capturas/portada.webp)

- **Sitio y demostración:** https://herrerawilliamh.github.io/create-openclass-uniminuto-revealjs/
- **Demostración completa:** https://herrerawilliamh.github.io/create-openclass-uniminuto-revealjs/curso/demo-completa/
- **Galería de los 13 layouts:** https://herrerawilliamh.github.io/create-openclass-uniminuto-revealjs/curso/galeria/
- **Guía del docente:** https://herrerawilliamh.github.io/create-openclass-uniminuto-revealjs/curso/guia/
- **Paquete npm:** https://www.npmjs.com/package/create-openclass-uniminuto-revealjs

> Proyecto docente independiente de código abierto; no es un sitio oficial de UNIMINUTO. El
> paquete público usa un **tema neutro** con la misma composición. Los fondos y logotipos
> institucionales no se distribuyen: cada docente autorizado los aplica en su equipo con `--assets`.

## Requisitos

Versión del generador: **1.3.0**. Incluye arranque local seguro y avisos informativos de versión. Mantiene Build Tech (notas, relojes y controles multimedia),
exportación PDF y el adaptador Live v0.2 apagado por defecto. El servicio Live no se incluye en npm.
El adaptador exige protocolo v2: no activar ni actualizar Live en un curso que usa un servidor v0.1.
Para actualizar cursos, validar primero una copia privada y reconciliar `src/plugins/fase2.mjs`,
que `--update-theme` sobrescribe; conservar sus valores LIVE/FASE2 sin restaurar el módulo antiguo.

- [Node.js](https://nodejs.org/) **20.19 o posterior** (incluye npm). La CI (`.github/workflows/ci.yml`)
  está configurada para Node 20.19, 22 y 24; el estado real de cada ejecución se consulta en la
  pestaña *Actions* del repositorio.
- Un editor de texto (VS Code recomendado) y Chrome, Edge o Firefox.
- Novedades de cada versión: [CHANGELOG.md](CHANGELOG.md).

## Instalación y primer curso

```bash
npm create openclass-uniminuto-revealjs@latest mi-curso
cd mi-curso
npm install
npm run dev
```

Se abre el portal en `http://localhost:8600/` con: presentación general, semana 1, demostración
completa, galería de layouts, laboratorio y guía del docente.

Con los recursos institucionales (solo docentes autorizados, carpeta entregada por canal interno):

```bash
npm create openclass-uniminuto-revealjs@latest mi-curso -- --assets "RUTA/recursos-institucionales"
```

## Arranque local en Windows (cursos nuevos de 1.3.0)

Después de `npm install`, abre **`Iniciar OpenClass.cmd`** desde el Explorador.
Inicia Vite local en `127.0.0.1:8600` sin descargar ni instalar versiones.
También puedes ejecutar `node scripts/openclass-start.mjs` desde el curso.
El comando opcional `node scripts/openclass-start.mjs --check-version` consulta únicamente
metadatos de npm y muestra un aviso si existe una versión posterior; no instala nada.
Los cursos nuevos registran la versión del generador en `package.json` bajo
`openclassGenerator`; en cursos antiguos sin procedencia verificable el aviso
puede no estar disponible, pero el arranque no depende de él.

**No existe actualización automática de archivos ni rollback automático en 1.3.0.**
El motor experimental permanece bloqueado por una vulnerabilidad de rutas TOCTOU.
El lanzador no debe usarse para intentar migraciones.

## Actualizar manualmente un curso existente

```bash
npx create-openclass-uniminuto-revealjs@latest <carpeta-del-curso> --update-theme
```

Esta es una operación **manual y explícita**, distinta del aviso de versiones y del lanzador.
Actualiza la infraestructura (scripts, componentes, estilos, guía) y guarda una copia previa en
`respaldos/`; conserva el Markdown de las semanas y `openclass.config.json`. Las semanas ya
elaboradas no se regeneran: para la nueva apertura (diapositiva 3) añade `weeks[].opening` y copia la
diapositiva de un curso nuevo, o usa `npm run semana -- N --force-content`, que reemplaza el archivo
completo de la semana N.

## Comandos

En el generador:

| Comando | Efecto |
|---|---|
| `npm create openclass-uniminuto-revealjs@latest <carpeta>` | Crea un curso nuevo (la carpeta debe estar vacía o no existir) |
| `… <carpeta> -- --iot` | Nombre inicial «Introducción a Internet de las Cosas» |
| `… <carpeta> -- --install` | Crea e instala dependencias |
| `… <carpeta> -- --assets <dir>` | Copia imágenes locales (fondos/logotipos) sobre `public/` |
| `npx create-openclass-uniminuto-revealjs@latest <curso> --update-theme` | Actualiza la infraestructura de un curso existente con respaldo, conservando Markdown y configuración |

En un curso:

| Comando | Efecto |
|---|---|
| `npm run dev` | Servidor local con recarga en vivo |
| `npm run semana -- 2 --title "Tema"` | Crea/activa la semana 2 (conserva el Markdown existente) |
| `npm run config` | Regenera rutas de semanas desde `openclass.config.json` |
| `npm run test:estructura` | Verifica archivos obligatorios y semanas activas |
| `npm run build:all` | Compila el sitio estático en `dist/` |
| `npm run preview:pages` | Sirve `dist/` para revisarlo |

## Qué incluye cada curso

- **13 layouts:** portada, separador, resultados, imagen izquierda/derecha, título superior
  izquierdo/derecho, texto, dos columnas, dos títulos, multimedia, código y cierre GRACIAS.
- **Código:** modo scroll (predeterminado, con botón copiar y teclado seguro) y modo paginado
  (`data-oc-paginate="code"`).
- **Plugins:** Markdown, Highlight, Notes, Search, Zoom, KaTeX, Chalkboard, Custom Controls,
  Chart y Mermaid. Exportación PDF con `?print-pdf`.
- **Actividades:** microactividad de clasificación editable (`public/actividades/microactividad/`),
  quiz y laboratorio, dentro de iframes aislados.
- **IA:** `docs/IA/INSTRUCCIONES-OPENCLASS.md`, `PLANTILLA-SEMANAL.md` y `PROMPT-CREAR-SEMANA.md`.
- **Publicación:** flujo de GitHub Actions para GitHub Pages incluido en cada curso.

## Desarrollo del generador

```bash
npm test                    # controles basales: generador, paginación, demostración, galería, microactividad y semanas
npm run test:p2             # primera secuencia semanal: portada, tema y activación
npm run test:docente        # guía, prompt maestro y contrato distribuidos; contenido del paquete
npm run test:seguridad      # seguridad de publicación: nada privado llega a dist/
npm run test:ligeras        # las cuatro anteriores
npm run test:dom            # portada en el DOM, ocho casos en Chrome real
npm run test:portal         # portal del estudiante en Chrome real
npm run test:navegador      # crea un curso, lo compila con base de subcarpeta y lo prueba en Chrome real
npm run test:chrome         # las tres anteriores
npm run site:build          # construye _site/ (landing + curso de demostración) para GitHub Pages
npm run test:sitio          # landing y enlaces del sitio construido
npm run test:release        # todo lo anterior: condición para publicar
npm run galeria:capturas -- <dist-de-un-curso>   # regenera las capturas reales de la galería
npm run assets:neutros      # regenera el tema neutro y el video de demostración
```

Estructura: `bin/` (CLI), `template/` (curso que se copia), `site/` (landing de Pages),
`scripts/` (capturas, recursos, sitio y pruebas de navegador), `tests/`, `docs/` y
`graphify-out/` (grafo de conocimiento compartido por los asistentes de IA; ver `AGENTS.md`).

## Limitaciones conocidas

- KaTeX se descarga de un CDN: sin conexión, las fórmulas se muestran como texto.
- Las actividades son locales: no envían resultados a Moodle ni a otros servidores.
- Seminar, Poll y Questions (participación multiusuario) están incluidos pero desactivados.
- `npm audit` informa un aviso de severidad baja en KaTeX (dependencia interna de Mermaid); la
  corrección exige Mermaid 12 (cambio mayor) y se evaluará en una versión posterior. El contenido
  de las presentaciones lo escribe el docente, no usuarios externos.

## Licencia y créditos

Código del generador: [MIT](LICENSE) © 2026 William Herrera. Las dependencias conservan sus
licencias: [Reveal.js](https://revealjs.com/) (MIT), [reveal.js-plugins](https://github.com/rajgoel/reveal.js-plugins)
de Asvin Goel (MIT, en `template/public/vendor/`), [Mermaid](https://mermaid.js.org/) (MIT),
[Chart.js](https://www.chartjs.org/) (MIT), [KaTeX](https://katex.org/) (MIT), React (MIT), Vite (MIT)
y las fuentes Atkinson Hyperlegible y Merriweather Sans (SIL OFL). El tema neutro, las
ilustraciones y el video de demostración son obra original del proyecto (MIT). Las marcas y
logotipos institucionales no forman parte de este repositorio ni se relicencian.
