# OpenClass Live

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
npm test                 # 25 pruebas: lógica, integración con 40 clientes, seguridad, privacidad
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

### 1. Paquete (computador del docente o de desarrollo)

```bash
cd services/openclass-live
npm ci && npm test && npm run test:navegador
npm run empaquetar        # despliegue/openclass-live-0.1.0.tar.gz + SHA256SUMS (sin .env)
scp despliegue/openclass-live-0.1.0.tar.gz despliegue/SHA256SUMS root@194.163.168.99:/tmp/
```

No se usa GHCR: la imagen se construye en la VPS desde el código (no hay que confirmar una imagen remota). La base está fijada por versión y digest en el `Dockerfile`.

### 2. Verificación previa en la VPS (solo lectura)

```bash
docker network inspect web --format '{{.Name}} {{.Driver}}'                # debe existir
docker ps --format '{{.Names}}\t{{.Image}}' | grep -i traefik               # versión de Traefik
docker ps -a --filter name=^openclass-live$ --format '{{.Names}}'           # vacío: no hay otra instancia
test -e /home/openclass-live && echo "YA EXISTE: revisar antes de seguir" || echo "libre"
getent hosts openclass-live.apps.willedtech.io                               # 194.163.168.99
# Middlewares disponibles (solo para conocerlos; NO se asocia admin-chain al router de estudiantes):
T=$(docker ps --format '{{.Names}}' | grep -i traefik | head -1)
docker inspect "$T" --format '{{.Config.Image}} {{json .Args}}'
docker inspect "$T" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'   # ubicar la configuración dinámica
# y revisar en ese archivo qué contiene admin-chain (encabezados, rate limit, ¿autenticación?)
```

### 3. Instalar archivos

```bash
cd /tmp && sha256sum -c SHA256SUMS
mkdir -p /home/openclass-live
tar -xzf /tmp/openclass-live-0.1.0.tar.gz -C /home/openclass-live --strip-components=1
cd /home/openclass-live && ls -la
docker build -t openclass-live:0.1.0 .
```

### 4. Secretos (se generan dentro de la VPS; nada se imprime)

```bash
cd /home/openclass-live
install -m 600 .env.example .env
SECRET=$(docker run --rm openclass-live:0.1.0 node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))")
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=${SECRET}|" .env && unset SECRET
read -rsp 'Contraseña docente (mín. 12): ' PW; echo
HASH=$(printf '%s' "$PW" | docker run --rm -i openclass-live:0.1.0 node scripts/hash-password.mjs); unset PW
sed -i "s|^ADMIN_PASSWORD_HASH=.*|ADMIN_PASSWORD_HASH='${HASH}'|" .env && unset HASH
grep -c -E '^(SESSION_SECRET|ADMIN_PASSWORD_HASH)=CAMBIAR' .env   # debe imprimir 0
stat -c '%a' .env                                                     # 600
```

### 5. Validar y levantar solo este stack

```bash
cd /home/openclass-live
docker compose config --quiet && echo CONFIG_OK
docker compose up -d
docker compose ps
docker inspect openclass-live --format '{{.State.Health.Status}}'   # healthy (≈15 s)
docker logs --tail 5 openclass-live                                   # {"evento":"inicio",...}
```

### 6. Pruebas HTTP y WebSocket (desde fuera de la VPS)

```bash
cd services/openclass-live
npm run verificar -- https://openclass-live.apps.willedtech.io
# Flujo completo (crea una sala, vota por WSS y la finaliza). La contraseña va por variable, no en la línea:
read -rsp 'Contraseña docente: ' OCLIVE_PASSWORD; echo; export OCLIVE_PASSWORD
npm run verificar -- https://openclass-live.apps.willedtech.io; unset OCLIVE_PASSWORD
```

Comprueba: salud, CSP/HSTS/nosniff, que no existan rutas de fondos, imágenes, Markdown, `.env` ni código; handshake por polling y por **WSS**; rechazos de autorización y de origen; cookie `HttpOnly; Secure; SameSite=Strict`. Después, abrir `https://openclass-live.apps.willedtech.io/` desde un teléfono con datos móviles (red externa) y hacer una votación de prueba.

### 7. Adoptar en Dockhand

### Stack Git desde el repositorio público

En Dockhand, seleccione el repositorio público y la rama `feat/openclass-live-v0.1.0`, con el archivo Compose `services/openclass-live/docker-compose.yml`. El contexto `.` y `Dockerfile` se resuelven respecto de esa carpeta; no se usa el Dockerfile de la raíz del repositorio.

Configure en las variables del stack `APP_HOST`, `APP_URL`, `SESSION_SECRET` y `ADMIN_PASSWORD_HASH`; opcionalmente, las demás variables descritas arriba. Compose las pasa explícitamente al contenedor: **no necesita un archivo `.env` en el checkout Git**. Pegue el hash scrypt completo como valor literal, incluidos sus caracteres `$`, sin las comillas simples propias de un archivo `.env`. No publique secretos en el repositorio ni en la salida de diagnóstico. El archivo `.env.example` es solo una plantilla pública.

La alternativa local con `.env` sigue funcionando: Docker Compose utiliza ese archivo para interpolar las variables. La red externa `web`, HTTPS con `myresolver` y la ausencia de puertos publicados se mantienen. Esta configuración no autoriza un despliegue remoto.

### Adoptar un stack existente

`https://manager.apps.willedtech.io` → **Stacks → Adopt** → ruta `/home/openclass-live/docker-compose.yml`.

- Adopt debe registrar el proyecto existente (`name: openclass-live`) sin recrearlo. Antes y después, comparar el ID: `docker ps --filter name=^openclass-live$ --format '{{.ID}}'`. Debe ser el mismo y debe haber **un** solo contenedor.
- `container_name: openclass-live` impide por diseño una segunda instancia: Docker rechaza crear otro contenedor con ese nombre.
- Si la versión instalada de Dockhand no ofrece Adopt, no usar «Create/Deploy» sobre la misma ruta; gestionar con `docker compose` desde la carpeta.

### Traefik

Un único router HTTPS (`websecure`, `myresolver`) para estudiantes, panel y Socket.IO. Traefik reenvía WebSocket sin configuración adicional. **No** se asocia `admin-chain@file` (u otro middleware global): bloquearía o limitaría el tráfico de estudiantes y no sustituye la autenticación propia. No se crean routers administrativos separados: el panel ya exige su propia autenticación en HTTP y en Socket.IO, y un segundo router con otra prioridad sobre el mismo host no aportaría control adicional. Verificado localmente con Traefik v3.6.1, las etiquetas exactas de `docker-compose.yml` y `npm run verificar` (HTTPS y WSS).

### Actualización

```bash
# Local: subir "version" en package.json y la etiqueta image: en docker-compose.yml; npm test; npm run empaquetar; scp.
cp -a /home/openclass-live /home/openclass-live.bak-$(date +%F-%H%M)          # incluye .env (600)
tar -xzf /tmp/openclass-live-X.Y.Z.tar.gz -C /home/openclass-live --strip-components=1   # .env no viene en el paquete
cd /home/openclass-live && docker build -t openclass-live:X.Y.Z .
docker compose config --quiet && docker compose up -d && docker compose ps
```

Las salas abiertas se pierden al reiniciar: actualizar fuera de clase.

### Rollback

```bash
# Volver a la versión anterior (su imagen sigue en la VPS):
cd /home/openclass-live && docker compose down
rm -rf /home/openclass-live && mv /home/openclass-live.bak-<fecha> /home/openclass-live
cd /home/openclass-live && docker compose config --quiet && docker compose up -d

# Retirar el servicio por completo (no toca otras aplicaciones ni volúmenes ajenos; el stack no tiene volúmenes):
cd /home/openclass-live && docker compose down
docker image rm openclass-live:0.1.0
# Las rutas de Traefik desaparecen con el contenedor (se definen por etiquetas).
```

Nunca usar `docker system prune` ni borrar volúmenes o redes que no sean de este stack.

## Seguridad: resumen

- Contraseña docente con scrypt (N=32768); comparación en tiempo constante; 5 intentos por IP y 30 globales por ventana.
- Cookie de panel `HttpOnly`, `Secure`, `SameSite=Strict`, firmada, con vencimiento y revocable al cerrar sesión; POST con verificación de origen, `Content-Type: application/json` y token CSRF.
- Clave de presentador firmada, ligada a una sala y a su versión: «Revocar claves» invalida las anteriores; vence con la sala. Un QR o enlace de estudiante no contiene secretos.
- Socket.IO: orígenes verificados en el motor y por espacio de nombres; los eventos docentes no existen en `/participante`; mensajes > 16 KB cierran la conexión.
- Ningún participante controla la navegación de la presentación: el adaptador no escucha órdenes de navegación.
- Contenedor: usuario no privilegiado (1000), sistema de archivos de solo lectura, `cap_drop: ALL`, `no-new-privileges`, 256 MB, 0,5 CPU, 128 procesos, sin socket Docker, sin puertos en el host, `init`, registros rotados.
