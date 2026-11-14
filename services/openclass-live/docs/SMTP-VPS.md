# Interact · SMTP en la VPS

La configuración del transporte SMTP **es operativa, no parte de la administración web**. Solo las cuentas de superusuario administran invitaciones, roles y suspensión/reactivación desde `/docente/`. Nunca enviar la contraseña SMTP al navegador ni al repositorio.

## Archivo autorizado

`/home/apps/dockhand/stacks/VPS Principal/openclass-live/.env`

Este archivo ya fue instalado en el cambio a 0.4.2 y debe continuar con permisos `0600`, propietario `root`. NO editar `SESSION_SECRET`, `ADMIN_PASSWORD_HASH`, `DATABASE_URL`, `POSTGRES_ADMIN_PASSWORD`, ni `TRUSTED_PROXY_CIDRS`.

## Variables del servicio

Editar únicamente:

```dotenv
MAIL_TRANSPORT='smtp'
SMTP_HOST='SERVIDOR_SMTP_DEL_PROVEEDOR'
SMTP_PORT='587'
SMTP_USER='CUENTA_DEL_PROVEEDOR'
SMTP_PASSWORD='CLAVE_DE_APLICACION_DEL_PROVEEDOR'
MAIL_FROM='Interact <CORREO_REMITENTE_AUTORIZADO>'
SMTP_TLS_VERIFY='true'
```

Para puerto 587 se usa STARTTLS y `SMTP_SECURE='false'`. Para puerto 465 se usa TLS implícito y `SMTP_SECURE='true'`. La dirección `MAIL_FROM` debe estar autorizada por el proveedor. No desactivar verificación TLS para hacer funcionar el correo. Si la contraseña contiene un apóstrofo, validar el escapado de Docker Compose antes de escribir el archivo. Nunca mostrar los valores sensibles con `cat`, `docker compose config` sin `--quiet`, registros ni capturas.

## Comprobación y activación

En la **terminal Linux** de la VPS, con servicio inactivo de clases o salas:

```bash
bash <<'BASH'
set -euo pipefail
umask 077
project='/home/apps/dockhand/stacks/VPS Principal/openclass-live'
cd "$project"
test -f .env
test "$(stat -c '%a' .env)" = 600
test "$(docker inspect interact-db --format '{{.State.Health.Status}}')" = healthy
docker compose --project-name openclass-live -f docker-compose.yml --env-file .env config --quiet
echo "COMPOSE_SMTP_CONFIG=PASS"
# Activar solo tras revisar los datos SMTP y registrar respaldo previo.
# docker compose --project-name openclass-live -f docker-compose.yml --env-file .env up -d --no-deps --no-build --pull never --wait --wait-timeout 120 openclass-live
BASH
```

La recreación interrumpe temporalmente las conexiones WebSocket. El archivo `.env` tiene secretos y debe respaldarse fuera del repositorio y del alcance de Dockhand público. Tras activar, probar una invitación a una dirección propia; verificar el estado de entrega y la verificación de correo (no confundir aceptación del SMTP con entrega en bandeja de entrada).

**No se debe activar un despliegue automático de releases que omita la verificación de la imagen por digest, de la procedencia, del respaldo PostgreSQL o de la salud del servicio.**
