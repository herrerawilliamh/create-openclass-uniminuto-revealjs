# Microactividad interactiva (5–10 minutos)

Actividad de clasificación con validación, retroalimentación, resultado observable, reinicio,
cronómetro orientativo y accesibilidad por teclado y lector de pantalla. Funciona sin servidor
y dentro de un `iframe` con `sandbox="allow-scripts allow-forms"`.

| Archivo | Qué contiene | ¿Se edita? |
|---|---|---|
| `datos.js` | Título, objetivo, instrucciones, minutos, categorías y elementos | **Sí — para cambiar de tema** |
| `logica.js` | Validación, evaluación, resumen y mensajes (funciones puras) | Solo si cambia la regla de evaluación |
| `app.js` | Dibujo de la actividad, eventos y cronómetro | Rara vez |
| `estilos.css` | Colores y tipografía | Opcional |

## Cambiar el tema

1. Copia la carpeta completa con otro nombre, por ejemplo `public/actividades/clasificar-sensores/`.
2. Edita solo `datos.js`: entre 2 y 5 categorías y de 4 a 10 elementos con su explicación.
3. Inserta la actividad en una diapositiva multimedia:

```markdown
## Actividad: clasifica sensores
<!-- .slide: class="oc-demo oc-l-multimedia" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<iframe title="Clasificar sensores" src="{{BASE_URL}}actividades/clasificar-sensores/index.html" loading="lazy" sandbox="allow-scripts allow-forms" style="width:100%;height:100%;border:0"></iframe>
```

Si un dato es inválido (categoría inexistente, lista vacía), la actividad muestra el problema en
lugar de fallar en silencio. Con `barajar: true` en `datos.js` el orden cambia en cada carga.

## Alternativas

- **HTML local** (esta carpeta): sin servidor, ideal para microprácticas y autoevaluación.
- **Aplicación en un VPS**: cuando se necesitan cuentas, almacenamiento o resultados compartidos;
  se incrusta con `iframe` solo si el servidor lo permite (CSP `frame-ancestors`/`X-Frame-Options`).
- **Jupyter** (JupyterLite, Binder, Colab): para ejecutar código; suele abrirse en pestaña externa.
- **Simuladores externos** (PhET, Wokwi, GeoGebra): verificar licencia e incrustación permitida.
- **Video interactivo** (H5P u otros): requiere una plataforma que lo aloje.
- **Abrir en pestaña**: cuando un recurso bloquea el `iframe`, enlazarlo con `target="_blank"`.

La interacción multiusuario en tiempo real (Socket.IO, encuestas compartidas) no está activa.
