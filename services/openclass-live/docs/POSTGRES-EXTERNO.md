# PostgreSQL provisionado externamente (modo `externo`)

`DB_MODO_POSTGRES=externo` hace que `scripts/preparar-roles.mjs` **solo verifique**. No ejecuta `CREATE/ALTER ROLE`, `CREATE DATABASE`, `CREATE SCHEMA`, `GRANT` ni `REVOKE`, no rota contraseñas y no toca la base `postgres`. Úselo cuando el administrador del servicio PostgreSQL entrega los recursos ya creados y su cuenta no tiene `CREATEROLE`.

> Alcance de la prueba: validado contra PostgreSQL 16 en Docker con un administrador sin `CREATEROLE`. **No** se declara soporte para ningún proveedor administrado concreto hasta probarlo contra ese proveedor (variantes de permisos, TLS y `pg_authid`).

## Qué debe provisionar el administrador del servicio

Con nombres por omisión (`DB_*_ROLE`, `DB_NAME`, `DB_SCHEMA` los cambian):

1. Tres roles `LOGIN`, sin `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION` ni `BYPASSRLS`: `interact_migrador`, `interact_app`, `interact_respaldo`, con las contraseñas que luego se pondrán en `INTERACT_DB_*_PASSWORD` (≥ 24 caracteres).
2. Base `interact` propiedad de `interact_migrador`; `CONNECT` para los tres roles (se recomienda `REVOKE ALL … FROM PUBLIC`).
3. Dentro de la base, esquema `interact` propiedad de `interact_migrador`; `USAGE` para app y respaldo; nadie más con `CREATE` en el esquema ni en la base.
4. Privilegios por omisión del migrador en el esquema: `SELECT, INSERT, UPDATE, DELETE` sobre tablas y `USAGE, SELECT` sobre secuencias para `interact_app`; `SELECT` sobre tablas y secuencias para `interact_respaldo`.
5. `ALTER ROLE <rol> IN DATABASE interact SET search_path = interact` para los tres roles (opcional recomendado: `statement_timeout` e `idle_in_transaction_session_timeout` para la app).

## Uso

```
DB_MODO_POSTGRES=externo DATABASE_ADMIN_URL=postgres://<cuenta>@<host>:5432/<base> \
INTERACT_DB_MIGRATOR_PASSWORD=… INTERACT_DB_APP_PASSWORD=… INTERACT_DB_BACKUP_PASSWORD=… \
node scripts/preparar-roles.mjs
```

`DATABASE_ADMIN_URL` solo aporta host, puerto y TLS (`DB_SSL`, `DB_SSL_CA_FILE`); la verificación abre una sesión como cada rol con su contraseña, así que comprueba que las credenciales configuradas operan. Las contraseñas deben ser las **vigentes**: el modo externo nunca las cambia.

Se informan todas las carencias a la vez, por ejemplo «el rol X tiene atributos privilegiados», «contraseña rechazada», «falta el esquema», «faltan privilegios por omisión», «necesita search_path». Los mensajes nunca incluyen URL ni contraseñas. Código de salida 1 si algo falta; no se modifica nada.
