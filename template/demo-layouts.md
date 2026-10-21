# Internet de las cosas
<!-- .slide: class="oc-demo oc-l-cover" data-background-image="{{BASE_URL}}fondos/slide-01-portada.png" data-background-size="cover" -->

**SEMANA 1**

AGOSTO 27, 2026

Notes:
Presentar el curso y explicar la estructura del taller. Evitar leer literalmente el título.

---

## Generalidades de IoT
<!-- .slide: class="oc-demo oc-l-section" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<div class="oc-section-plane"><img src="{{BASE_URL}}imagenes/avion.png" alt="" /></div>



Notes:
Separador que anuncia el nuevo bloque conceptual.

---

## ¿Qué es Internet de las cosas?
<!-- .slide: class="oc-demo oc-l-image-left" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

![Ecosistema de dispositivos conectados]({{BASE_URL}}imagenes/layout-demo-iot-ecosistema.jpg)

- Dispositivos físicos con sensores y actuadores.
- Captura de información del entorno.
- Conectividad para transferir datos.
- Procesamiento y decisiones automáticas.

Notes:
Relacionar la imagen con sensores, comunicaciones y datos.

---

## Arquitectura básica de IoT
<!-- .slide: class="oc-demo oc-l-image-right" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

![Capas de una arquitectura IoT]({{BASE_URL}}imagenes/layout-demo-iot-arquitectura.jpg)

- **Percepción:** sensores y actuadores.
- **Control local:** ESP32 o dispositivo embebido.
- **Conectividad:** Wi-Fi, Zigbee y LoRaWAN.
- **Servicios:** servidores, nube y aplicaciones.

---

## Microcontroladores y sistemas embebidos
<!-- .slide: class="oc-demo oc-l-top-right" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

![Ejemplo de microcontrolador ESP32]({{BASE_URL}}imagenes/layout-demo-iot-esp32.jpg)

- ESP32 integra procesamiento y conectividad.
- MicroPython simplifica el prototipado.
- Los sensores proporcionan datos físicos.
- Los actuadores transforman decisiones en acciones.

---

## Práctica de simulación
<!-- .slide: class="oc-demo oc-l-top-left" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

![Proyecto de IoT simulado en Wokwi]({{BASE_URL}}imagenes/layout-demo-iot-wokwi.jpg)

- Crear el circuito virtual en Wokwi.
- Incorporar ESP32 y un sensor DHT22.
- Conectar tres indicadores LED.
- Ejecutar y comprobar el programa.

---

## IoT como ecosistema conectado
<!-- .slide: class="oc-demo oc-l-multimedia" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

<div class="oc-media-demo"><strong>Espacio para vídeo o demostración</strong><p>Ejemplo: insertar un vídeo del curso, un simulador o un <em>iframe</em> autorizado.</p><p class="oc-media-tip">La presentación reserva el área central completa y no recorta el reproductor.</p></div>

Notes:
Si se usa una fuente externa, probar conexión y permisos del navegador antes de la OpenClass.

---

## Conceptos clave y aplicaciones
<!-- .slide: class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

Los sistemas IoT combinan componentes físicos, conectividad y plataformas digitales.

- Edge computing permite decisiones cerca del origen de los datos.
- Fog computing incorpora procesamiento distribuido en la red local.
- Cloud computing centraliza almacenamiento y analítica.
- La seguridad protege dispositivos, redes, servicios y datos.

---

## Objetivos de aprendizaje
<!-- .slide: class="oc-demo oc-l-objectives" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

1. Comprender las capas de un sistema IoT.
2. Reconocer el funcionamiento de sensores y actuadores.
3. Identificar las principales opciones de conectividad.
4. Diseñar un prototipo con ESP32 y MicroPython.
5. Probar la lógica en un simulador.
6. Explicar la importancia de la seguridad en IoT.

---

## De un dato físico a una decisión digital
<!-- .slide: class="oc-demo oc-l-two-cols" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

| Entrada | Salida |
|:---|:---|
| Temperatura | Alerta ambiental |
| Humedad | Registro histórico |
| Movimiento | Activación de actuador |
| Luz | Automatización |
| Vibración | Predicción de falla |

---

## Sensores y actuadores
<!-- .slide: class="oc-demo oc-l-two-titles" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" -->

| Sensores | Actuadores |
|:---|:---|
| Capturan magnitudes físicas | Ejecutan acciones |
| Temperatura y humedad | Encender un LED |
| Luz y movimiento | Activar un motor |
| Distancia y presión | Abrir una válvula |
| Generan lecturas | Materializan decisiones |

---

## Código: semáforo ambiental con ESP32
<!-- .slide: class="oc-demo oc-l-code" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" data-oc-paginate="code" -->

```python
from machine import Pin
from time import sleep
import dht

sensor = dht.DHT22(Pin(15))
verde = Pin(18, Pin.OUT)
amarillo = Pin(19, Pin.OUT)
rojo = Pin(21, Pin.OUT)

def apagar():
    verde.off()
    amarillo.off()
    rojo.off()

def clasificar(t, h):
    if t >= 30 or h >= 80:
        return 'ALERTA'
    if t >= 26 or h >= 65:
        return 'PRECAUCION'
    return 'NORMAL'

while True:
    sensor.measure()
    t = sensor.temperature()
    h = sensor.humidity()
    estado = clasificar(t, h)
    apagar()
    if estado == 'ALERTA':
        rojo.on()
    elif estado == 'PRECAUCION':
        amarillo.on()
    else:
        verde.on()
    print(t, h, estado)
    sleep(2)
```

Notes:
La división del código es solo visual; para ejecutar el ejemplo deben reunirse todos los fragmentos en main.py.

---

## Para terminar
<!-- .slide: class="oc-demo oc-l-closing" data-background-image="{{BASE_URL}}fondos/slide-06-cierre.png" data-background-size="cover" -->



Notes:
Agradecer la participación y recordar la actividad de cierre.

---

## Demostración de contenido extenso
<!-- .slide: class="oc-demo oc-l-text" data-background-image="{{BASE_URL}}fondos/slide-05-template.png" data-background-size="cover" data-oc-paginate="auto" -->

En una OpenClass real, una explicación puede superar el espacio disponible. Este ejemplo activa la paginación automática para listas; las diapositivas de continuación mantienen el mismo fondo, título y estilo.

- Un sistema IoT adquiere mediciones físicas mediante sensores distribuidos en el entorno.
- Los microcontroladores interpretan señales y controlan procesos con restricciones de memoria y energía.
- La conectividad permite comunicar eventos mediante redes cableadas o inalámbricas.
- Los protocolos de mensajería, como MQTT, facilitan la transmisión eficiente de telemetría.
- El procesamiento en el borde reduce la latencia y permite tomar decisiones locales.
- La computación en la nube posibilita almacenar grandes volúmenes de información histórica.
- Las plataformas de analítica identifican tendencias, anomalías y oportunidades de mejora.
- Los sistemas de automatización actúan cuando se cumplen condiciones establecidas.
- La seguridad incluye autenticación, actualización de firmware y cifrado de comunicaciones.
- La privacidad debe considerarse durante el diseño y el ciclo de vida de la solución.
- El consumo energético determina la autonomía de los dispositivos alimentados por batería.
- La interoperabilidad facilita la integración de sensores y servicios de diferentes fabricantes.
- El mantenimiento y la observabilidad permiten detectar fallos en instalaciones reales.
- Las decisiones responsables requieren contrastar la calidad y fiabilidad de los datos capturados.
- El resultado final es un sistema capaz de medir, comunicar, analizar y actuar de manera controlada.

Notes:
Este bloque debe extenderse en varias diapositivas. Verifica el resultado: conserva los puntos sin reducir la tipografía hasta volverla ilegible.
