# WillEdTech · Guía de marca v3

> Fuente única de verdad para personas y asistentes de IA. Si una herramienta, un repo o un modelo
> genera algo visual para WillEdTech, debe seguir este archivo. Ante una duda, gana este archivo.

## 1. El isotipo

La **W** es el distintivo de la marca y nunca se redibuja: se usa `logo/willedtech-isotipo.svg`.

| Propiedad | Valor |
|---|---|
| Retícula | 810 × 810 |
| Corte superior | línea recta que sube a **20,3°** de izquierda a derecha (`y = 448 − 0,3706·x`) |
| Trazos de la W | diagonales a **22,8°** de la vertical. **Son exclusivos de la W.** |
| Esquinas | solo las dos inferiores, radio **70** |
| Versiones | positiva (W negra), negativa (W blanca) y *badge* (cuadrado completo con la W calada) |

### Logo con nombre
- `logo/willedtech-horizontal.svg` · `logo/willedtech-vertical.svg`
- Con lema: `logo/willedtech-horizontal-lema.svg` · `logo/willedtech-vertical-lema.svg`
- Lema, siempre en dos líneas: **Buscando transformar la educación** / **Explorando tecnologías innovadoras**
- Cada archivo tiene su variante `-negativo.svg` para fondos oscuros. Los textos ya están convertidos a trazos.

### Reglas de uso
- **Área de protección:** alrededor del logo, deja libre al menos el 25 % de la altura del isotipo.
- **Tamaño mínimo:** 16 px el isotipo solo; 24 px de alto los lockups horizontales.
- **Color:** el isotipo va en tinta (`#0C0E15`), blanco o violeta `#5464BF`. Nunca en amarillo ni naranja.
- **No hacer:** deformar, rotar, añadir sombras o degradados, o cambiar el ángulo del corte.

## 2. Productos y sub-marcas

### Nombres
- La regla es **WillEdTech + un nombre funcional en inglés**, que diga qué hace la herramienta.
- En texto, el nombre **siempre lleva "WillEdTech" delante**: *WillEdTech Learning*, nunca *Learning* a secas. Los nombres son palabras genéricas y solo se pueden posicionar y proteger junto a la marca.
- En los lockups gráficos, la W o el texto "by WillEdTech" cumplen esa función.
- Las rutas y repos técnicos (`lti-provider`, `services/openclass-live`) pueden conservar sus nombres históricos; lo que ve el usuario usa el nombre del producto.

### Monogramas
Cada producto se representa con **una letra construida como la W** y **un punto de color**.

| Producto | Letra | Color del punto | Descriptor | Carpeta |
|---|---|---|---|---|
| WillEdTech Learning | L | Violeta `#5464BF` | Aprendizaje en tu LMS · LTI 1.3 | `products/learning/` |
| WillEdTech Platform Studio | S | Amarillo `#F2E205`, con aro de tinta | Generador de contenido | `products/platform-studio/` |
| WillEdTech Interact | I con remates | Naranja `#F27405` | Interacción en vivo con tu audiencia | `products/interact/` |

- La **I** se dibuja con remates arriba y abajo, como una viga: el bloque de la W con dos muescas laterales a media altura, que dejan un fuste de 235 en el centro.
- La versión de i minúscula, solo el asta, se descartó: rompe la silueta cuadrada de la familia.

En cada carpeta hay estos archivos, todos con su variante `-negativo`:
- `*-marca.svg`: solo el monograma.
- `*-solo.svg`: monograma, nombre y descriptor.
- `*-horizontal.svg`: W, divisor, monograma, nombre y "by WillEdTech".
- `*-vertical.svg`: monograma y nombre arriba; abajo, un divisor y la W con "WillEdTech".
- `*-app.svg`: icono de app de 1024 px sobre violeta-950 `#121137`.

### Receta para un producto nuevo
Sigue estos pasos sin inventar formas nuevas:
1. Parte del **bloque base**: el cuadrado de 810 con el corte de 20,3° arriba y radio 70 en las dos esquinas inferiores.
2. Elige la inicial del producto y vacía el bloque **solo con rectángulos verticales y horizontales**. Los fustes miden **235** de ancho y la base nace en **y = 585**. Si una contraforma debe tocar el corte, su borde superior va paralelo a él.
3. **Nada de diagonales internas.** La diagonal de 22,8° pertenece solo a la W.
4. Añade **un círculo de radio 88** en el color del producto, en el vacío más grande de la letra. Es el único elemento de color.
5. El color del punto sale de la paleta y no repite el de otro producto (`tokens/tailwind.config.js`). Si sobre fondo claro queda por debajo de 3:1, ponle un aro de 16 en `currentColor`, como en Studio.
6. Comprueba que se lee a 16 px y que no se confunde con la L, la S ni la I.
7. Registra el producto en la tabla de arriba y en `tokens/tokens.json`.

## 3. Color

**Canon de marca:**
- Primarios: Blanco `#FFFFFF`, Negro `#000000`, Violeta `#5464BF`.
- Secundarios: Gris `#B3B3B3`, Amarillo `#F2E205`, Naranja `#F27405`.

En interfaces se usan **solo los tokens** de `tokens/tailwind.config.js`:
- Semánticos: `canvas`, `surface`, `ink`, `line`, `primary`, `secondary`, `accent`, `success`, `warning`, `error`, `info`.
- Escalas 50-950 de `violet`, `yellow`, `orange` y `neutral`.

La paleta por defecto de Tailwind está desactivada a propósito. Prohibido usar `indigo`, `blue-500`, `red-500` o HEX sueltos fuera de esta guía.

- El amarillo nunca va como texto sobre blanco: úsalo como relleno con texto `violet-950` encima.
- Los estados (éxito, aviso, error) siempre se acompañan de icono o texto, nunca solo de color.

## 4. Tipografía
- **Títulos:** Merriweather Sans 800, con interletrado de −0,02em.
- **Texto:** Atkinson Hyperlegible 400 y 700.
- **Lectura accesible:** OpenDyslexic, con `data-font="accessible"` o la clase `.readable`.
- Las fuentes se cargan desde Google Fonts o Fontsource. Las URL están en la cabecera de `tokens/tailwind.config.js`.

## 5. Recursos visuales de la interfaz
- **Radios asimétricos:** `rounded-asym`, `rounded-asym-sm` y similares, con proporción 1:3.
- **Sombras:** `shadow-asym`, con la luz desde arriba a la izquierda.
- **Fondos:** `bg-cut`, que repite el corte del isotipo, y `bg-mesh`, como ambiente de página.
- **Componentes:** `.glass` y `.marker` (barra de texto del manual).
- **Modo oscuro:** `class="dark"` o `data-theme="dark"`. Los tokens cambian solos.

## 6. Cómo implementarlo
- **Proyectos con Tailwind:** `presets: [require('./brand/tokens/tailwind.config.js')]`.
- **Proyectos sin Tailwind:** importa `tokens/willedtech.css` y usa `rgb(var(--wt-primary))`.
- **Logos en HTML:** inserta el SVG en línea. Los trazos usan `currentColor`, así que basta con `class="text-ink"` para que hereden el color del modo claro u oscuro.
- **Favicon:** `logo/favicon.svg` se adapta solo al modo oscuro. En PWA usa `products/<app>/<app>-app.svg`.
