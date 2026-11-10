# Interact · Confianza de proxy y red de entrada dedicada

## Problema

`TRUSTED_PROXY_CIDRS` decide de qué pares TCP se acepta `X-Forwarded-For` (solo para límites y cupos). Con un rango
privado genérico, **cualquier contenedor de la red `web`** (otro stack, otro servicio) podría hablar con Interact por la
red y falsear su IP. Desde 0.4.0 (Gate 3):

- No hay valor por defecto: en producción `TRUST_PROXY=true` exige `TRUSTED_PROXY_CIDRS` y el servicio **no arranca** si
  está vacío o contiene rangos genéricos (`0.0.0.0/0`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, prefijo
  menor que /24 en IPv4 o /64 en IPv6).
- `X-Real-Ip` no se usa nunca. Traefik no la sobrescribe y no hay garantía verificable de saneamiento.
- Solo cuenta el último tramo de `X-Forwarded-For` y solo si el par TCP está en la lista.

Eso protege a Interact *si* la lista es exacta. Pero con una lista exacta de la red `web` completa el riesgo persiste
(cualquier contenedor de `web` está en la lista). La solución real es que **solo Traefik** pueda ser par de Interact.

## Propuesta (NO aplicada: requiere autorización separada, no se toca la VPS)

Red de entrada dedicada Traefik–Interact con direccionamiento fijo:

```yaml
# stack de Interact (cambio en este repositorio, aplicable al desplegar)
networks:
  entrada-interact:
    external: true        # creada por el operador; la comparten solo Traefik e Interact
services:
  openclass-live:
    networks: [entrada-interact, interact-db]     # sale de «web»
    labels: ["traefik.docker.network=entrada-interact"]
```

```bash
# preflight y cambio en el host (operador, con autorización):
docker network create --subnet 172.30.77.0/28 entrada-interact
docker network connect --ip 172.30.77.2 entrada-interact <contenedor-traefik>   # IP fija del proxy
# .env de Interact:
#   TRUST_PROXY=true
#   TRUSTED_PROXY_CIDRS=172.30.77.2/32
```

### Preflight (solo lectura) antes de pedir autorización

1. `docker network inspect web --format '{{range .Containers}}{{.Name}} {{end}}'` — inventario de quién comparte `web`.
2. `docker inspect <traefik> --format '{{json .NetworkSettings.Networks}}'` — redes y IP actuales de Traefik.
3. Confirmar que la subred elegida no colisiona: `docker network ls -q | xargs docker network inspect --format '{{range .IPAM.Config}}{{.Subnet}} {{end}}'`.
4. Confirmar que Traefik soporta estar en una segunda red sin reiniciar el resto de servicios (conexión en caliente con
   `docker network connect` es suficiente; la persistencia exige actualizar la definición del stack de Traefik).

### Plan de cambio (para autorización separada)

1. Crear `entrada-interact` y conectar Traefik con IP fija (cambio en el stack de Traefik, no en Interact).
2. Desplegar Interact con `entrada-interact` en lugar de `web` y `TRUSTED_PROXY_CIDRS=<IP de Traefik>/32`.
3. Verificar: `curl` por Traefik funciona; un contenedor de `web` ya no alcanza `openclass-live:3000`.
4. Reversión: volver a `web` con `TRUST_PROXY=false` (las cabeceras se ignoran; los cupos pasan a contar por la IP del par,
   es decir, la de Traefik: más estricto, nunca más permisivo).

## Evidencia

- Unitaria y HTTP: `tests/p2-auditoria.test.mjs` (proxy de confianza, par ajeno, X-Forwarded-For y X-Real-Ip
  falsificados, producción incompleta o con rangos genéricos, cupos deterministas 5 por IP y 200 globales).
- Docker (`INTERACT_TEST_DOCKER=1`, `tests/docker-proxy.test.mjs`): red de ensayo con proxy de IP fija e intruso en la misma
  red; el intruso no puede falsear su IP por acceso directo ni con `X-Real-Ip`, y producción sin lista no arranca.

La propuesta de red dedicada está validada como topología de ensayo; **no está desplegada ni autorizada en la VPS**.
