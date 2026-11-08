# OpenClass Live: funcionalidades planificadas (NO incluidas en 0.3.0)

Estado: solo planificación. Ninguna de estas piezas está implementada ni se mezcla con el
despliegue 0.3.0, que mantiene salas en memoria, una contraseña docente por entorno y protocolo 2.

| Bloque | Qué aportaría | Dependencias / decisiones previas |
|---|---|---|
| Base de datos | Historial persistente de salas, encuestas y preguntas | Elegir motor (p. ej. SQLite en volumen o PostgreSQL), migraciones, volumen con respaldo, política de retención y datos personales (Ley 1581) |
| Cuentas y administrador | Varios docentes, rol administrador, auditoría | Modelo de usuario, sesión servidor, CSRF ya existente; sustituye `ADMIN_PASSWORD_HASH` único |
| Correo | Verificación y avisos | Proveedor SMTP, SPF/DKIM, secretos fuera de Git |
| Recuperación de contraseña | Restablecer acceso docente | Requiere correo y cuentas; tokens de un solo uso con caducidad |
| OAuth | Ingreso institucional | Requiere cuentas; registro del cliente OAuth, callback por entorno |

Orden sugerido: base de datos → cuentas/administrador → correo → recuperación → OAuth.
Cada paso será una versión propia (0.4.0 en adelante), con su manifiesto inmutable
`releases/<versión>.json`, migración reversible, respaldo previo del volumen y plan de rollback.
Un rollback de aplicación no revierte migraciones de datos: diseñarlas compatibles hacia atrás.
