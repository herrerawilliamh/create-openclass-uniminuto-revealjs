# OpenClass Live

Preparación GitOps local y promoción manual: [docs/GITOPS.md](docs/GITOPS.md).
La definición GitOps conserva la identidad del stack y añade versión + SHA; no activa sincronización.

Participación en tiempo real (encuestas y preguntas) para clases que el docente presenta **en su propio computador** con OpenClass Reveal.js y comparte por Zoom, Teams o Meet. Los estudiantes entran desde el teléfono con un QR o un código de 6 caracteres; no necesitan cuenta.

**Restricción de diseño:** las diapositivas, fondos, logotipos, Markdown y notas del presentador nunca llegan al servidor. Al crear una encuesta solo viajan enunciado, código opcional, tipo y opciones. El contrato v0.2 rechaza `correctas` y `explicacion` en `encuesta:crear`: la solución permanece local hasta la revelación explícita mediante `encuesta:revelar`, con la votación cerrada. También viajan las respuestas y las preguntas de los participantes; el estado se borra al finalizar o vencer la sala.

- Guía para docentes: [docs/GUIA-DOCENTE.md](docs/GUIA-DOCENTE.md)
- Protocolo Socket.IO: [docs/PROTOCOLO.md](docs/PROTOCOLO.md)
- Futura Zoom App: [docs/ZOOM-APPS.md](docs/ZOOM-APPS.md)

## Arquitectura

| Capa | Archivo | Responsabilidad |
| --- | --- | --- |
| Sesiones y votaciones | `src/salas.mjs` | Estado en memoria; única fuente de verdad; resultados calculados en el servidor. Sin dependencias de red: reutilizable por una Zoom App. |
| Validación | `src/validar.mjs` | Esquemas estrictos (un campo desconocido invalida el mensaje), límites de tamaño, texto plano. |
| Autenticación | `src/auth.mjs` | Contraseña docente con scrypt; tokens HMAC con tipo y vencimiento; sesiones revocables; CSRF. |
| API de participación | `src/sockets.mjs`, `src/http.mjs` | Socket.IO 4 (`/participante`, `/docente`) y rutas HTTP con CSP estricta. |
| Interfaz estudiante | `public/index.html`, `public/assets/estudiante.mjs` | Móvil primero; reconexión con token. |
| Interfaz docente | `public/docente/`, `public/assets/docente.mjs` | Panel autenticado. |
| Adaptador Reveal.js | `template/src/plugins/live.mjs` (plantilla del generador) | Panel «En vivo» en la presentación local, QR, resultados y pregunta proyectada. |

Roles: **docente** (cookie del panel), **presentador** (clave ligada a una sala, para la presentación local; no crea ni finaliza salas), **participante** (anónimo con código), **visitante** (solo páginas públicas). La autorización se comprueba en el handshake y en **cada** evento.

## Desarrollo y pruebas locales

```bash
cd services/openclass-live
npm ci
npm test                 # 34 pruebas: lógica, integración con 40 clientes, seguridad, privacidad
npm run test:navegador   # Chrome real: crea un curso temporal con el CLI y prueba docente + presentación + 3 móviles (una sala, QR integrado, PDF)
npm run audit            # dependencias de producción
```

Servidor local: `npm run gen-env` (crea `.env`; cambie `APP_URL=http://localhost:3000`) y `npm run dev`.

`test:navegador` necesita Chrome o Edge (o `CHROME_PATH`). `OPENCLASS_CAPTURAS=<carpeta>` guarda las capturas usadas en la guía.

## Variables de entorno

Ver [.env.example](.env.example). El archivo `.env` real **nunca** se versiona (está en `.gitignore`) y debe tener permisos `600`.

| Variable | Uso |
| --- | --- |
| `APP_HOST`, `APP_URL` | Dominio público; `APP_URL` es también el único origen admitido para estudiantes y panel. |
| `SESSION_SECRET` | 48 bytes aleatorios (base64url). Firma cookies y claves. Rotarlo invalida todas las sesiones. |
| `ADMIN_PASSWORD_HASH` | Hash scrypt de la contraseña docente, entre comillas simples. Nunca la contraseña. |
| `PRESENTER_ORIGINS` | Orígenes de la presentación local (`http://localhost:8613,http://localhost:8600`). |
| `TRUST_PROXY` | `true` detrás de Traefik (IP de `X-Real-Ip`, solo para límites en memoria). |
| `TEACHER_SESSION_HOURS`, `ROOM_TTL_MINUTES`, `MAX_ROOM_PARTICIPANTS`, `MAX_ROOMS` | Duración de la sesión docente, vida de una sala, cupos. |

El servidor se niega a arrancar si falta un secreto, si conserva el valor de ejemplo o si es débil; el mensaje nombra la variable, nunca su valor.

## Privacidad y límites conocidos

- Almacenamiento **solo en memoria**. No hay base de datos ni volumen `data/` (no se justifica). **Reiniciar o actualizar el contenedor pierde las salas abiertas**: hágalo fuera de clase. Tras un fallo, el docente crea una sala nueva; no queda nada que limpiar en disco.
- Finalizar o vencer una sala (`ROOM_TTL_MINUTES`) borra encuestas, respuestas, preguntas y participantes.
- Mientras el proceso sigue vivo, un estudiante que recarga o pierde la conexión vuelve como el mismo participante (token en `localStorage` de su navegador; en el servidor solo se guarda su hash SHA-256).
- No se guardan IP en historiales. La IP se usa en memoria, unos minutos, para limitar intentos. Los registros (`docker logs`) solo contienen eventos y contadores: nunca alias, textos, respuestas, códigos ni IP.
- **Votación anónima:** sin autenticación de estudiantes no puede garantizarse un voto por persona. El servidor evita duplicados accidentales (un voto por participante y ronda; reenviar reemplaza), pero alguien con varios navegadores puede participar varias veces.
- Límites: 16 KB por mensaje; 8 opciones; 500 caracteres de enunciado, 1500 de código, 2000 de explicación, 280 por pregunta; 5 preguntas por estudiante (una cada 15 s); 300 preguntas y 40 encuestas por sala; 10 intentos fallidos de unión por IP (se recuperan a 1 cada 10 s) sin penalizar una clase entera detrás de la misma IP; 5 intentos de inicio de sesión por IP.
- Los textos se guardan como texto plano y se pintan con `textContent`. El código de las preguntas se muestra, nunca se ejecuta. CSP: `script-src 'self'`, sin estilos ni scripts en línea.

## Despliegue en la VPS (WillEdTech)

Destino: `/home/openclass-live/`, red Docker externa `web`, Traefik con `myresolver`, dominio `openclass-live.apps.willedtech.io`. El contenedor no publica puertos: solo entra tráfico por Traefik/HTTPS.

> El despliegue cambia el servidor: requiere **autorización expresa**. Una mutación → una verificación → siguiente paso. Si un paso falla, detenerse y diagnosticar.

### Preparación y promoción de v0.2.0

El servicio usa protocolo **2**; el generador npm permanece en **1.2.0**.

```bash
cd services/openclass-live
npm ci
npm test
npm audit --omit=dev
npm run empaquetar
# despliegue/openclass-live-0.2.0.tar.gz + SHA256SUMS
```

El empaquetador comprueba package/lock/Compose, rechaza enlaces y usa metadatos y orden
constantes para obtener el mismo SHA-256 con los mismos archivos y herramientas.
Incluye únicamente archivos de ejecución, Docker/Compose, plantilla pública `.env.example`
y el auxiliar de hash; no incluye `.env`, cursos, notas, soluciones docentes ni recursos institucionales.

Para una instalación existente, seguir [el plan manual de promoción y rollback](docs/PROMOCION-0.2.0.md).
No ejecutar `gen-env`, ni copiar `.env.example` sobre la configuración real.
Preservar todos los parámetros y secretos existentes. La selección entre Compose local y stack Git
requiere identificar primero la autoridad efectiva en Dockhand. No activar sincronizaciones automáticas.
La promoción recrea únicamente `openclass-live`, fuera de clase; las salas viven en memoria.

## Seguridad: resumen

- Contraseña docente con scrypt (N=32768); comparación en tiempo constante; 5 intentos por IP y 30 globales por ventana.
- Cookie de panel `HttpOnly`, `Secure`, `SameSite=Strict`, firmada, con vencimiento y revocable al cerrar sesión; POST con verificación de origen, `Content-Type: application/json` y token CSRF.
- Clave de presentador firmada, ligada a una sala y a su versión: «Revocar claves» invalida las anteriores; vence con la sala. Un QR o enlace de estudiante no contiene secretos.
- Socket.IO: orígenes verificados en el motor y por espacio de nombres; los eventos docentes no existen en `/participante`; mensajes > 16 KB cierran la conexión.
- Ningún participante controla la navegación de la presentación: el adaptador no escucha órdenes de navegación.
- Contenedor: usuario no privilegiado (1000), sistema de archivos de solo lectura, `cap_drop: ALL`, `no-new-privileges`, 256 MB, 0,5 CPU, 128 procesos, sin socket Docker, sin puertos en el host, `init`, registros rotados.
