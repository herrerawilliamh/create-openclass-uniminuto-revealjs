# GitOps de OpenClass Live: preparación local, promoción manual

## Estado y alcance

Rama local preparada: `release/openclass-live`, creada desde
`8f58229ed787228445d36a8ec444e4d46d27f6c2`, conservando los cambios locales existentes.
No hay commit nuevo, push, etiqueta publicada, merge ni cambio en npm, VPS o Dockhand.
La rama todavía apunta al commit base: **no desplegar ese SHA como si contuviera esta preparación**.
La aceptación funcional de Live v2 en producción sigue pendiente. El curso conserva `LIVE.activa=false`.

Artefacto existente: `despliegue/openclass-live-0.2.0.tar.gz`, SHA-256
`33dafa439f9640fcd7f887b4b43ee1d35e617d4ac1162050f5a51beab7cf0bb1`.
No se reconstruyó. Sus 24 archivos coinciden byte a byte con el payload local.
`releases/0.2.0.json` registra esos hashes y los hashes normalizados a LF según
`.gitattributes`. El checkout Git puede cambiar los saltos de línea de Compose y package/lock;
no se afirma identidad binaria entre un tarball nuevo de Linux y el tarball aprobado de Windows.
Para futuras versiones: aprobar un nuevo artefacto y manifiesto; nunca cambiar silenciosamente
los hashes para hacer pasar CI. Los archivos GitOps no forman parte del tarball anterior.

## Fuente aprobada y CI

El propietario revisará el diff antes de commit/push. Tras autorizar su publicación:

1. Publicar la preparación a revisión. No mezclar recursos institucionales, cursos,
   `.env`, backups o secretos. No publicar npm.
2. Proteger `release/openclass-live`: PR obligatorio, revisión del propietario,
   check obligatorio `Live release checks`, impedir force-push y borrado, sin bypass ordinario.
   Proteger también las etiquetas `openclass-live-v*` contra modificación/borrado.
   Configurar el entorno `openclass-live-release` con revisor propietario y sin autoaprobación.
   Estas protecciones **no están configuradas por este trabajo local**.
3. Integrar solo revisiones aprobadas y pruebas PASS. Crear etiqueta anotada
   `openclass-live-v0.2.0` en el SHA completo aprobado de la rama.
   Esa etiqueta es distinta de `v1.2.0` del generador.
4. Ejecutar manualmente el workflow `OpenClass Live` con esa etiqueta. Verifica que
   etiqueta y HEAD de la rama coincidan; ejecuta las pruebas de servicio, navegador,
   privacidad y protocolo; valida y construye con el contexto real del servicio.
   Exporta imagen, image ID, SHA del código, manifiesto y SHA256SUMS como evidencia.
5. El job `Live manual release approval` exige las pruebas anteriores y aprobación
   del entorno. Ningún job despliega, publica npm ni se conecta a la VPS.
   No promover un artefacto de PR: exigir ejecución manual de la etiqueta y aprobación.

La política depende de las protecciones remotas y de la revisión del propietario;
un YAML local no puede imponerlas en GitHub. No activar sincronización, webhook,
redeploy programado ni actualización automática de imágenes antes de la promoción inicial.
Mantenerlos desactivados hasta una decisión posterior explícita del propietario.

## Definición que usará Dockhand

Repositorio: `https://github.com/herrerawilliamh/create-openclass-uniminuto-revealjs`.
Ref inicial: etiqueta inmutable `openclass-live-v0.2.0` que resuelva al SHA revisado;
si la versión instalada solo admite ramas, usar la rama protegida y comprobar el SHA
resuelto antes de cada promoción manual. No usar `main` ni una rama de desarrollo.

Archivo Compose: `services/openclass-live/docker-compose.gitops.yml`.
Contexto `.` relativo a ese archivo = `services/openclass-live/`, **no la raíz del repo**.
`Dockerfile`, `package.json`, lockfile, `src/`, `public/` y `scripts/hash-password.mjs`
están dentro del contexto. `.dockerignore` limita la entrada; el Dockerfile solo copia
esos archivos, sin semanas ni recursos institucionales. No mover únicamente el YAML:
Dockhand debe materializar también el contexto del directorio del servicio.

`docker-compose.gitops.yml` replica la definición base y añade identidad de imagen:
`openclass-live:0.2.0-<SHA_COMPLETO>` y labels OCI version/revision/source.
Conserva proyecto y contenedor `openclass-live`, red externa `web`, dominio, límites,
healthcheck y el único servicio. `pull_policy: never` impide sustituir la imagen local
por un pull. La base Node continúa fijada por versión y digest en Dockerfile.
Habilitar **Build images on deploy** para la promoción manual del Git stack;
mantener **Pull images**, Force recreate y automatismos desactivados.
No se utiliza `latest`. Registrar el image ID real después de construir: el SHA del código
identifica su procedencia y el image ID identifica los bytes de la imagen construida.
Un SHA de código no equivale al digest de imagen. No hay publicación en un registro preparada
ni necesaria para esta estrategia de build local bajo Dockhand.

Validación local sin daemon ni secretos reales, desde la raíz del maestro (PowerShell):

```powershell
node services/openclass-live/scripts/verificar-gitops.mjs
npm --prefix services/openclass-live test
$env:LIVE_REVISION = git rev-parse HEAD # solo prueba sintáctica; NO es todavía un release aprobado
$env:APP_HOST = 'live.example.invalid'
$env:APP_URL = 'https://live.example.invalid'
$env:SESSION_SECRET = 'synthetic-compose-validation-secret-only'
$env:ADMIN_PASSWORD_HASH = 'synthetic-compose-validation-only'
docker compose -f services/openclass-live/docker-compose.gitops.yml config --quiet
```

CI hará el build real sin arrancar un segundo contenedor Live. Localmente solo se validaron
la resolución del Compose, el payload y los archivos requeridos; el build Docker en CI
y el comportamiento de la versión instalada de Dockhand siguen siendo gates pendientes.

## Variables y secretos: conservar la instalación existente

Solo el propietario inspecciona el stack, exporta su definición efectiva y hace un respaldo
privado con permisos restringidos. Conservar **exactamente** `SESSION_SECRET` y
`ADMIN_PASSWORD_HASH`; no ejecutar `gen-env` ni `hash-password` para esta migración.
No pegarlos en Git, argumentos de shell, capturas, informes ni logs de CI.
Preservar también `APP_HOST`, `APP_URL`, `PRESENTER_ORIGINS`, `TRUST_PROXY`, `TZ`,
`TEACHER_SESSION_HOURS`, `ROOM_TTL_MINUTES`, `MAX_ROOM_PARTICIPANTS`, `MAX_ROOMS`
y cualquier parámetro adicional que use el stack actual. Verificar que `NODE_ENV=production`
y `PORT=3000` coincidan con el servicio existente. No reemplazar valores reales por defaults.

Para un Git stack, ingresar las mismas variables mediante la gestión privada de variables
del stack de la versión instalada. El manual actual documenta `.env.dockhand` como override
para variables Git y secretos inyectados en el entorno. No guardar `.env` en el repositorio
ni depender de que el checkout copie el `.env` de la instalación Internal.
Los hashes scrypt contienen `$`: conservar su valor literal mediante la interfaz de secretos
o el mecanismo de escape del archivo env que use esa versión; comparar privadamente el
valor efectivo antes/después. No imprimir `docker inspect` ni `compose config` completos.
Agregar únicamente `LIVE_REVISION=<SHA_COMPLETO_APROBADO>`; el gate local/CI rechaza valores
que no sean SHA de 40 caracteres. El propietario debe cotejarlo con la ref realmente resuelta.

## Si el stack actual es Internal

`DOCKHAND_MODE=POR_CONFIRMAR`. No inferir su tipo del directorio ni de labels Docker.
El propietario comprobará tipo, versión de Dockhand, proyecto, servicio, ref, variables,
Compose efectivo y opciones de build/sync. Internal incluye stacks adoptados.

El manual consultado no ofrece un flujo general de adjuntar origen Git a un stack Internal
existente. **No inventar un botón de conversión, editar la base de datos ni crear otro stack
con otro nombre**. Preparar esta transición como una operación manual condicionada:

1. Ventana sin clase/salas activas; respaldo privado de definición, valores y autoridad
   anterior, imagen anterior por ID y archivo de rollback de `PROMOCION-0.2.0.md`.
2. Si la versión instalada dispone de vinculación Git sin recrear la identidad, probar
   en la interfaz que conserva `project=openclass-live`, `service=openclass-live` y
   `container_name=openclass-live`; materializa el contexto completo; conserva variables;
   permite desactivar automatismos; y puede volver a la definición anterior.
3. Si requiere retirar el registro Internal para registrar Git, hacerlo únicamente si
   la interfaz distingue inequívocamente **retirar gestión conservando contenedores** de
   borrar/parar el stack. Respaldar primero y conservar el mismo proyecto/nombre. Registrar
   una sola autoridad Git, sin un despliegue intermedio de otro proyecto.
4. Si no permite demostrarlo, **detener la conversión**. Mantener Internal y usar,
   tras autorización separada, la ruta manual aprobada del artefacto existente. La conversión
   Git queda pendiente de un procedimiento compatible con esa versión; no usar `down`,
   borrar contenedores, crear otro stack o cambiar Dockhand para sortear el bloqueo.

La promoción posterior es del único servicio existente. Debe comprobar imagen/tag/SHA,
healthcheck, HTTP/WSS, protocolo 2, autenticación y flujo docente/participante externos
con `PROMOCION-0.2.0.md`, además del rollback. Git "synced" no acredita salud ni aceptación.
Solo después de esos controles y aceptación humana se considerará activar Live en el curso.

Fuente operativa consultada: [manual oficial de Dockhand](https://dockhand.pro/manual/),
apartados Stack types, Environment variables, Git stacks y Deploy options (2026-10-27).
El propietario debe confirmar las capacidades de su versión instalada.

## Dockhand 1.0.33: actualización previa y cambio controlado

Estado informado por el propietario (captura, no inspección remota): Git stack
`openclass-live`, rama `feat/openclass-live-v0.1.0`, Build images on deploy ON,
Scheduled sync OFF, Webhook OFF y secretos configurados. No corresponde convertir
un stack Internal. El selector de rama por stack está documentado desde 1.0.44.
Cambiar la rama vuelve a desplegar: hacerlo solo en la ventana de promoción,
tras CI PASS del SHA publicado y autorización separada de operación en la VPS.

Procedimiento reservado al propietario; Codex no ejecutó comandos remotos:

1. Registrar versión, imagen e ID actuales de Dockhand; identificar su Compose real,
   proyecto, servicio, mounts, DATA_DIR, ubicación de stacks y mecanismo de base de
   datos. Guardar privadamente configuración, variables y referencias de secretos.
   Inventariar IDs de contenedores gestionados para compararlos después.
2. Preparar respaldo consistente antes de actualizar: detener únicamente Dockhand
   durante la copia de su almacenamiento persistente. Respaldar todo DATA_DIR
   (incluida base SQLite y archivos auxiliares, si aplica), directorios de stacks,
   configuración externa y la clave `.encryption_key` o el valor original de
   ENCRYPTION_KEY en un respaldo privado separado. Si usa PostgreSQL, obtener
   también un respaldo consistente de esa base con su herramienta nativa.
   Conservar permisos/propietarios y comprobar que el respaldo puede restaurarse.
   No regenerar la clave: la base cifrada depende de ella.
3. Elegir una versión estable >=1.0.44 tras revisar sus notas y compatibilidad.
   Fijar tag y digest; no usar latest. Conservar la imagen anterior por ID y una
   copia recuperable. En el Compose existente, cambiar solo la imagen Dockhand;
   conservar mounts, clave, variables, redes, puertos, identidad y configuración.
   Validar `docker compose ... config --quiet` usando los archivos reales.
4. Recrear exclusivamente el servicio Dockhand mediante `docker compose ... up -d
   --no-deps <servicio-dockhand>` desde su proyecto real. Los puntos suspensivos y
   el nombre de servicio son parámetros pendientes de identificar, no comandos
   listos para copiar. No ejecutar down, borrar volúmenes, prune ni redeploy de stacks.
5. Verificar login, versión, acceso a secretos, inventario/configuración de stacks
   y ausencia de cambios en IDs de contenedores gestionados. Mantener sync y
   webhook OFF. Si falla, parar solo Dockhand y restaurar conjuntamente imagen,
   configuración, base/directorios y clave del respaldo anterior; no abrir la base
   ya migrada con el binario antiguo sin restaurar el respaldo correspondiente.
6. En una segunda operación y fuera de clase, respaldar Live según
   PROMOCION-0.2.0.md; conservar imagen anterior, Compose efectivo y variables.
   En el Git stack existente elegir `release/openclass-live`, verificar SHA completo
   publicado y CI PASS, Compose `services/openclass-live/docker-compose.gitops.yml`,
   contexto del servicio y LIVE_REVISION igual al SHA resuelto. Conservar todos los
   secretos y Build images on deploy ON; Pull images, sync y webhook OFF.
   Revisar antes de confirmar porque guardar la rama puede iniciar el despliegue.
7. Verificar identidad única openclass-live, imagen/revisión, healthy, HTTP/WSS,
   protocolo 2 y aceptación docente/participante. Ante fallo, restaurar la definición
   e imagen anteriores según el plan de rollback; las salas en memoria no se recuperan.

No activar el candidato experimental de autoactualización 1.3.0. La actualización
de Dockhand y la promoción Live son operaciones manuales distintas, pendientes.
Fuentes: https://dockhand.pro/manual/ y https://github.com/Finsys/dockhand/releases.
