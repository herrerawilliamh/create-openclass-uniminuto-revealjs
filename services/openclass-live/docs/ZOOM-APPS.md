# OpenClass Live — preparación para una futura Zoom App

Estado: **solo diseño**. En esta fase no se usa Zoom Meeting SDK ni Zoom Apps SDK, no se solicitan credenciales de Zoom y nada del servicio depende de Zoom. El sistema funciona igual con Teams, Meet o cualquier videoconferencia, porque los estudiantes participan desde un enlace o QR.

## Qué se puede reutilizar

| Pieza | Reutilización en una Zoom App |
| --- | --- |
| `src/salas.mjs` | Sin cambios: estado de salas, encuestas en dos rondas, preguntas y moderación. No conoce Socket.IO ni HTTP. |
| `src/validar.mjs` | Sin cambios: mismos esquemas para cualquier cliente. |
| Protocolo `/participante` | La vista del estudiante dentro de Zoom (panel lateral de la app) puede ser la misma página `/join/CODIGO` o un cliente equivalente. |
| Protocolo `/docente` modo presentador | Una Zoom App del docente puede actuar como el adaptador Reveal.js: clave ligada a una sala. |

## Qué faltaría

1. **Autenticación por Zoom (OAuth) como alternativa a la contraseña docente.** Añadir un tercer modo de handshake en `/docente` (token verificado del contexto Zoom) sin retirar los actuales. Nuevo módulo `src/auth-zoom.mjs`.
2. **Identidad de estudiantes opcional.** Con el contexto de la reunión, el servidor podría limitar un voto por usuario de Zoom. Debe seguir siendo opcional y sin almacenar identificadores más allá de la sala.
3. **Encabezados exigidos por el cliente de Zoom.** Zoom Apps carga la app en un navegador embebido que exige ciertas cabeceras (CSP con dominios de Zoom, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`). La CSP actual (`frame-ancestors 'none'`) debería relajarse solo para las rutas de la app.
4. **Dominio y registro** de la app en Zoom App Marketplace (credenciales en `.env`, nunca en el código).

## Principios que deben mantenerse

- El servidor no recibe diapositivas, fondos, logotipos, Markdown ni notas.
- Los resultados se calculan en el servidor.
- Ningún participante controla la presentación.
- Las salas son temporales y se borran al finalizar.
