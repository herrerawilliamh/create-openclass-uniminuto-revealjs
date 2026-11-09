# OpenClass Suite — Documento maestro de producto, requisitos y evolución

> **Versión del documento:** 0.1.3 · **Fecha:** 2026-10-30 · **Estado:** BORRADOR PARA VALIDACIÓN · **Responsable de decisiones:** propietario del proyecto.
>
> **Naturaleza:** especificación viva, escrita para orientar a Claude, Codex y demás colaboradores. **No es una autorización para modificar código, desplegar ni publicar.**
>
> **Regla de actualización:** mantener historial de cambios y un identificador estable por requisito. No eliminar requisitos ni convertir hipótesis en funcionalidades existentes sin evidencia.

## 0. Propósito y visión

**Visión:** OpenClass será un ecosistema de autoría, presentación y participación educativa que permita a cualquier docente crear clases, importar documentos, editar bloques visualmente, proyectar materiales y realizar actividades con estudiantes conectados desde celulares, dentro de una reunión virtual o en una red local, incluso sin acceso a internet cuando los recursos sean locales. La experiencia debe conservar la accesibilidad, la privacidad y la compatibilidad con los cursos ya creados.

**Principio de diseño:** *Una experiencia docente, varios medios de acceso.* El mismo núcleo de contenidos e interacciones debe poder adaptarse al uso individual offline, al aula presencial por LAN/Wi-Fi, a una sesión por internet y, en una fase posterior, a una Zoom App. No significa que todas las capacidades sean idénticas en todos los medios: las diferencias deben declararse en la interfaz.

**Restricción:** separar la identidad de la institución UNIMINUTO y sus materiales protegidos del futuro producto comercial, que debe utilizar recursos neutros o con derechos comprobados.

### 0.1 Niveles de certeza

- **EXISTENTE/VERIFICADO:** visible en código/documentación de la rama `main`, o demostrado por pruebas aportadas por el propietario.
- **REQUISITO APROBADO EN CONVERSACIÓN:** objetivo expresado por el propietario; no equivale a implementación.
- **PROPUESTA:** solución arquitectónica sujeta a validación.
- **PENDIENTE DE INVESTIGACIÓN:** requiere prueba técnica, autorización de terceros o decisión del propietario.

### 0.2 Terminología

- **Motor OpenClass:** generador y presentador Reveal.js/React/Vite.
- **My OpenClass / Studio:** aplicación de escritorio y editor de autoría (nombre provisional).
- **OpenClass Live:** motor de interacción, actualmente servicio web Node/Socket.IO v0.2.0.
- **Modo Aula:** interacción de alumnos con el material autorizado, navegación sincronizada y tiempos de revisión.
- **Servidor local:** servicio temporal alojado en el equipo docente y accesible en la red del aula.
- **Modo híbrido:** diseño para participantes locales/remotos, cuya implementación exige resolver autoridad, sincronización y seguridad.

## 1. Estado inicial y evidencia (2026-10-30)

| ID | Componente | Estado constatado | Límite o pendiente |
|---|---|---|---|
| BAS-001 | Generador npm | `create-openclass-uniminuto-revealjs@1.3.0` publicado; dist-tag `latest=1.3.0` confirmado por `npm view` del usuario. Tag Git `v1.3.0` anotado: el objeto del tag es `138c5bfe…` (NO es un commit) y apunta al commit `072b0bf3acc243be00e6d73dd02d07224842cc0e`, que coincide con `origin/main`. **Corrección (v0.1.3):** el diagnóstico previo (v0.1.2) hablaba de «divergencia», pero la rama local `codex/openclass-1.3.0-f13g` NO estaba divergida: en `4636e60` era ancestro directo de `origin/main` y estaba cuatro commits atrás (sin commits propios). El 2026-10-30 se ejecutó `git merge --ff-only origin/main` (Gate D1/D2, con respaldo SHA-256 previo en `D:\OpenClass_respaldos`); HEAD final `072b0bf3acc243be00e6d73dd02d07224842cc0e`, `package.json` = 1.3.0, sin push. Los cambios locales (Graphify, autosync, GITOPS.md, ajustes de Claude) se conservaron intactos. La rama local `main` sigue atrasada respecto de `origin/main` (no se intervino) | No declarar que todos los cursos históricos están migrados. No usar el objeto del tag como commit al evaluar ancestros (usar el commit `072b0bf…`) |
| BAS-002 | Motor del generador | React 19, Reveal.js 6, Vite 7, 13 layouts, Markdown, portal, herramientas docentes, multimedia y PDF | Comprobar diferencias entre documentación y estado local antes de intervenir |
| BAS-003 | Curso académico real | `D:\OpenClass\Cursos\plataformasdesarrollo-uniminuto` en uso activo | **PROTEGIDO, NO USAR COMO ENTORNO EXPERIMENTAL** |
| BAS-004 | Curso en uso / infraestructura | 110 archivos idénticos a plantilla 1.3.0, 18 personalizados, 3 archivos de arranque instalados, semanas 1 y 2 HTTP PASS | Su `package.json` académico marca `1.0.0`, NO la versión del generador |
| BAS-005 | Parche del curso | `scripts/openclass-start.mjs` cambió localmente a `localhost:8600` en C9, con copia `.before-localhost.bak` | Corrección **NO** incorporada por ello al npm 1.3.0 oficial |
| BAS-006 | Regresión a corregir | El lanzador oficial apuntaba a `127.0.0.1:8600` y Live rechazó ese origen (HTTP 403); `localhost:8600` obtuvo 200 | Requiere parche del generador, pruebas y eventual versión correctiva 1.3.1 aprobada |
| BAS-007 | Live | Servicio `services/openclass-live/`, protocolo v2, encuestas, temporizador, QR, preguntas moderadas y control de revelación | Salas en RAM, reinicio pierde sesiones; no probaron aún íntegramente la conexión posterior a C9 |
| BAS-008 | Zoom | `services/openclass-live/docs/ZOOM-APPS.md` contiene **diseño**, no implementación | Sin SDK, OAuth ni autorización de distribución implementados |
| BAS-009 | Studio | Ruta previa mencionada `D:\OpenClass\openclass-studio` | **No existe en este equipo, según el inventario realizado.** Puede existir en otro equipo o no haberse creado; no asumir contenido previo. Decidir con el propietario antes de crear un prototipo nuevo |
| BAS-010 | Proyecto maestro | `D:\OpenClass\Reveal.js\create-openclass-uniminuto-revealjs`; GitHub `herrerawilliamh/create-openclass-uniminuto-revealjs` | Preservar cambios locales; no worktrees, clones o carpetas paralelas sin decisión |
| BAS-011 | Recursos institucionales | Tema público neutro y recursos UNIMINUTO locales por separado | No copiar marca, logotipos, fondos o contenidos restringidos a producto comercial |
| BAS-012 | Trabajo previo de autosync (local, sin integrar) | Encontrado en el working tree: `services/openclass-live/docs/AUTOSYNC-PROVENANCE.md`, `services/openclass-live/scripts/procedencia-autosync.mjs`, su archivo de pruebas `services/openclass-live/tests/procedencia-autosync.test.mjs` y la modificación de `services/openclass-live/docs/GITOPS.md` | Trabajo local previo **sin aprobación de integración**. Preservar íntegramente. No se atribuye autoría sin evidencia. No se han ejecutado sus pruebas en esta sesión |

**Documentos y archivos fuente en repositorio:** `AGENTS.md`, `docs/AI-CONTEXT.md`, `services/openclass-live/README.md`, `services/openclass-live/docs/PROTOCOLO.md`, `services/openclass-live/docs/ZOOM-APPS.md`, `template/src/Presentacion.jsx`, `template/src/plugins/live.mjs`, `bin/create-openclass-uniminuto-revealjs.mjs`.

**Nota sobre vigencia:** `docs/AI-CONTEXT.md` puede contener estados antiguos (por ejemplo, publicación npm previa); no usarlo como único testigo del estado de versiones. Contrastar con Git, CI y evidencia reciente.

## 2. Arquitectura objetivo y separación de responsabilidades

**Arquitectura lógica propuesta:**

```text
                          [Experiencias de estudiantes]
                          Navegador móvil / Zoom App
                                    |
                          Contrato de participación
                                    |
                +-------------------+-------------------+
                |                                       |
       Servidor Live en internet                 Servidor local LAN
          (servicio remoto)                  (proceso de escritorio)
                |                                       |
                +------------ Núcleo común -------------+
                         Salas, eventos, permisos
                                    |
        [Presentador Reveal.js] <-> [My OpenClass / Studio]
                                    |
                        Cursos y recursos locales
                         (formato de contenido)
```

**No trasladar carpetas de código automáticamente:** separación lógica primero; después separación física en repositorios o paquetes solo tras comprobar importaciones, CI, control de versiones y despliegues.

Rutas de trabajo conocidas:

1. Motor/generador: `D:\OpenClass\Reveal.js\create-openclass-uniminuto-revealjs` (**lugar inicial de este documento y de Claude Code**).
2. Studio: `D:\OpenClass\openclass-studio` (inventariar; reutilizar si existe).
3. Live: por ahora `services/openclass-live/` dentro del motor; extraer solo tras análisis.
4. Curso activo: `D:\OpenClass\Cursos\plataformasdesarrollo-uniminuto` (**congelado como sistema en servicio**, no modificar).

Los componentes evolucionarán con **versiones independientes** y contratos explícitos de compatibilidad: motor/plantilla, formato de contenido, interfaz de aula, protocolo Live, servidor de aula y adaptadores externos.

## 3. Personas, escenarios y modos

**Perfiles:** docente sin conocimientos técnicos; docente avanzado; estudiante móvil; administrador institucional (futuro); integrador técnico.

**Modos previstos:**

| Modo | Contenidos | Participación | Conexión requerida |
|---|---|---|---|
| Offline individual | Archivos y medios incluidos localmente | Actividades individuales locales | No |
| Aula LAN/Wi-Fi | Material autorizado servido desde equipo docente | QR, encuestas, preguntas, nube de ideas, seguimiento | Misma red local; sin internet externo |
| Aula remota | Contenido autorizado por servicio remoto o enlace | OpenClass Live online | Internet para participantes |
| Aula híbrida | Participantes por LAN y remoto | Estado común sin votos duplicados | Diseño futuro; requiere puente autorizado y autoridad única |
| Zoom nativo | App dentro del cliente Zoom | Herramientas de participación y colaboración | Reunión Zoom e integración autorizada |

**Regla:** iniciar la presentación no debe crear una sala remota de forma silenciosa. «Iniciar sesión» y «Iniciar clase» son actos distintos y controlados por el docente.

## 4. Requisitos funcionales: aplicación y autoría

| ID | Prioridad | Requisito | Criterio de aceptación resumido | Estado |
|---|---|---|---|---|
| APP-001 | P0 | Abrir curso existente desde una carpeta, sin modificarlo por defecto | Detecta motor/versión, muestra compatibilidad y abre en lectura/uso; edición explícita | Requisito |
| APP-002 | P0 | Crear curso eligiendo nombre, destino y tema | Selección por diálogo; sin usar terminal; no sobrescribir carpeta existente | Requisito |
| APP-003 | P0 | Presentar con un clic | Arranque/cierre controlados; ventana independiente o navegador; errores comprensibles | Requisito |
| APP-004 | P0 | Preservar funciones Reveal existentes | Notas, vista del presentador, pizarra, navegación, PDF, multimedia y layouts pasan regresión | Requisito |
| APP-005 | P0 | Instalador autónomo Windows | Usuario final sin npm ni Node ni configuración manual; instalación totalmente offline comprobada | Requisito |
| APP-006 | P1 | Editor visual de bloques drag-and-drop | Título, texto, imagen, video, código, tabla, actividad, encuesta, experiencia; editar y ordenar | Requisito |
| APP-007 | P1 | Importar DOCX, PDF, PPTX, Markdown y texto | Previsualización, aviso de pérdida de fidelidad, original intacto; OCR escaneado opcional | Requisito |
| APP-008 | P1 | Pegar contenido generado por IA y convertirlo | Contrato estructurado, validación de esquemas y contenido, revisión docente antes de guardar | Requisito |
| APP-009 | P1 | Guardar en formato editable versionado independiente del renderizador | Conversión compatible a la estructura Markdown existente; migraciones no destructivas | Propuesta |
| APP-010 | P1 | Ayudas contextuales para no expertos | Campos obligatorios, sugerencias de cambios, accesibilidad y vista previa inmediata | Requisito |
| APP-011 | P1 | Segunda pantalla y vista privada del docente | Notas/soluciones nunca aparecen en la proyección; cerrar ventana no destruye curso/sala | Requisito |
| APP-012 | P2 | Identidad docente y autorización local–web | Inicio de sesión seguro, tokens acotados, cierre de sesión, vinculación de curso y sala | Requisito |
| APP-013 | P2 | Actualizaciones reversibles y explícitas | Comprobaciones previas, diff, preservación de modificaciones, rollback probado; nunca actualización silenciosa | Requisito |
| APP-014 | P2 | Configuración por institución/tema | Tema neutro separado de logos o recursos institucionales y comerciales | Requisito |

**Tecnología:** evaluar Tauri 2 como preferida, con prueba comparativa contra Electron y Wails antes de declarar decisión definitiva. React y Reveal.js actuales permanecen; Astro no es requisito. Medir frío/caliente arranque, tamaño de instalador, consumo RAM/CPU en equipos modestos, funcionamiento offline y compatibilidad de ventanas/proyección. No inventar métricas.

## 5. Requisitos: participación y experiencias en tiempo real

| ID | Prioridad | Requisito | Criterio de aceptación resumido | Estado |
|---|---|---|---|---|
| INT-001 | P0 | Mantener Live v2 existente sin regresiones | Encuestas, temporizadores, QR, moderación, dos rondas y revelación operan igual | Existente; preservar |
| INT-002 | P1 | Nube de ideas / nube de palabras | Envío desde celular, moderación opcional, agregación y visualización sin identificar estudiantes | Requisito |
| INT-003 | P1 | Respuestas rápidas y preguntas abiertas | Estado sincronizado, control docente de apertura/cierre, límites y protección antispam | Parcialmente existente |
| INT-004 | P1 | Pausas de revisión de diapositiva (ej. 15 minutos) | Docente define tiempo, estudiante ve estado/tiempo y señala «Listo» / «Necesito más tiempo» | Requisito |
| INT-005 | P1 | Mostrar al estudiante diapositiva autorizada | Seguir al docente, modo revisión con navegación permitida controlada; sin entregar notas privadas | Requisito |
| INT-006 | P1 | Sesión estable ante cambio de diapositiva y reconexión | QR/código de sala conservado, entrada tardía, recuperación del estado autorizado | Parcialmente existente |
| INT-007 | P2 | Actividades interactivas locales | Ordenar, arrastrar-soltar, Kanban, clasificar y votar; teclado y móvil accesibles | Requisito |
| INT-008 | P2 | Reportes de sesión con consentimiento | Exportación controlada, retención definida y diferenciación entre analítica anónima y nominativa | Requisito |
| INT-009 | P2 | Biblioteca de tipos de actividad y adaptadores | API/versiones compartidas para web, LAN y Zoom | Propuesta |
| INT-010 | P2 | Votación accesible ante bajo ancho de banda | Mensajes pequeños, reconexión, estados pendientes y sin retransmitir audio/video | Requisito |
| INT-011 | P2 | No permitir voto múltiple accidental | Identidad de sesión anónima y políticas claras; sin prometer un voto por persona sin identidad | Requisito |

**Nube de ideas — versión mínima:** prompt docente, envío de palabra o frase corta, validación y tasa máxima, opción moderación, visualización agregada en la proyección, control para cerrar/borrar, descarga agregada opcional. No publicar expresiones potencialmente ofensivas sin estrategia de moderación.

**Diapositivas compartidas:** el Live actual **no publica toda la presentación**. Modo Aula exige definir un *paquete público autorizado* o una proyección filtrada que no contenga notas, soluciones ni recursos privados. No activar sincronización indiscriminada del deck.

## 6. Requisitos: conectividad LAN, internet e híbrido

| ID | Prioridad | Requisito | Criterio de aceptación resumido | Estado |
|---|---|---|---|---|
| NET-001 | P1 | Servidor local ligero incorporado al escritorio | Arranca/detiene con la clase, en proceso aislado, sin Node instalado por el usuario | Requisito |
| NET-002 | P1 | QR de aula y enlace privado | URL local resoluble en celular, validación de sala y expiración | Requisito |
| NET-003 | P1 | Participación sin internet sobre la misma LAN/Wi-Fi | Dos o más celulares reales responden con conexión exterior desactivada | Requisito |
| NET-004 | P1 | Detección de redes incompatibles | Explicar aislamiento entre clientes, firewall, IP/puerto y remedios, sin pedir desactivar seguridad global | Requisito |
| NET-005 | P2 | Asistente para hotspot Wi-Fi | Comprobar hardware/permisos y guiar al usuario; **no garantizar creación automática** en todos los equipos | Requisito condicionado |
| NET-006 | P2 | Selección clara Online / Aula local | Un solo control de entrada a clase con señal de disponibilidad y limitaciones | Requisito |
| NET-007 | P3 | Aula híbrida local+remota | **Autoridad única de sesión**, enrutamiento, idempotencia, control de conflictos y recuperación | Propuesta pendiente |
| NET-008 | P3 | Transición entre redes / failover | No duplicar salas/votos; política explícita de continuidad o nueva sesión; validar antes de prometer | Investigación |
| NET-009 | P2 | Seguridad del servidor LAN | No exponer archivos de equipo, APIs privadas ni interfaz administrativa al alumno; acceso y CSRF/CORS/orígenes revisados | Requisito |

**Límites físicos y de plataforma:** una app no puede prometer «crear Wi-Fi» en todo computador: depende de adaptador, controlador, sistema operativo y políticas institucionales. En una red universitaria puede existir *client isolation*; en ese caso los celulares no acceden al portátil aunque tengan internet. Evitar NAT/puertos públicos o accesos a Internet abiertos automáticamente. Diseñar ruta alternativa con red del aula, hotspot autorizado o modo remoto.

**Rendimiento:** para interacción básica, transmitir eventos JSON pequeños y estado diferencial; no transmitir grabación, audio o video de Zoom por este canal. Instrumentar consumo real por participante en pruebas, sin metas numéricas arbitrarias antes de medir.

## 7. Integración futura con Zoom

| ID | Prioridad | Requisito | Criterio de aceptación resumido | Estado |
|---|---|---|---|---|
| ZOM-001 | P3 | Zoom App integrada durante reunión | Interfaz de preguntas, nube de ideas, votaciones y seguimiento desde el cliente Zoom | Diseño futuro |
| ZOM-002 | P3 | Uso de Zoom Apps SDK, no confundir con Meeting SDK | Confirmar API y permisos aplicables a experiencia *dentro de Zoom* | Investigación |
| ZOM-003 | P3 | Invitar o compartir la actividad con asistentes | Flujo oficial de invitación/compartición cuando plataforma/rol/permisos lo permitan | Investigación |
| ZOM-004 | P3 | OAuth y verificación del contexto de reunión | Token/contexto verificados en backend, mínima información personal | Requisito futuro |
| ZOM-005 | P3 | Revisión/instalación institucional y Marketplace | Piloto en cuenta autorizada, permisos administradores y requisitos de distribución | Dependencia externa |
| ZOM-006 | P3 | Compatibilidad fuera de Zoom | El núcleo debe seguir funcionando en navegador, Teams, Meet y LAN | Restricción |

**Aclaración tecnológica:** `Zoom Apps SDK` permite crear aplicaciones que funcionan dentro del cliente Zoom. `Zoom Meeting SDK` sirve para insertar una experiencia de reunión Zoom en *nuestra* aplicación; es un producto diferente. Priorizar el primero para este objetivo. La publicación, permisos y disponibilidad en cada cliente/cuenta requieren verificación. **No afirmar integración nativa implementada.**

Fuentes: https://developers.zoom.us/docs/zoom-apps/guides/invite-participants/ ; https://github.com/zoom/skills/blob/main/skills/general/use-cases/in-meeting-apps.md ; archivo interno `services/openclass-live/docs/ZOOM-APPS.md`.

## 8. Recursos externos y experiencias pedagógicas

| ID | Prioridad | Requisito | Criterio de aceptación resumido | Estado |
|---|---|---|---|---|
| EXT-001 | P2 | Catálogo de experiencias y recursos | URL oficial, descripción, objetivo, tarea y retorno a la clase | Requisito |
| EXT-002 | P2 | VirtuXperience UNIMINUTO | Abrir recursos institucionales autorizados; no replicar contenido ni prometer acceso offline | Requisito |
| EXT-003 | P2 | CloudLabs | Lanzamiento desde enlace oficial; autenticar con el proveedor; integración profunda solo con contrato/permisos | Investigación |
| EXT-004 | P2 | Alternativa local cuando un recurso externo falla | Actividad propia offline con equivalencia pedagógica razonable | Requisito |
| EXT-005 | P2 | Patrón pedagógico Reto → Explorar → Aplicar → Evidenciar | Especificación de bloques y evaluación formativa para experiencias | Propuesta |

Fuentes institucionales iniciales: https://www.uniminuto.edu/virtuxperience-home ; https://keycloak.cloudlabslearning.com/ (página de acceso, no API confirmada).

## 9. Requisitos no funcionales y de seguridad

| ID | Nivel | Requisito verificable |
|---|---|---|
| NFR-001 | Obligatorio | El curso activo del usuario no se edita ni actualiza sin autorización explícita y respaldo recuperable |
| NFR-002 | Obligatorio | Cifrado/autorización para servicio remoto; credenciales y secretos fuera del código/curso/QR público |
| NFR-003 | Obligatorio | No enviar por defecto diapositivas completas, notas, soluciones privadas ni materiales institucionales al VPS |
| NFR-004 | Obligatorio | Validación de entradas, longitud/tasa, contenido no confiable, mitigación XSS, autorizaciones por rol |
| NFR-005 | Obligatorio | Accesibilidad teclado, lector pantalla, contraste, movilidad y tamaños de pantalla; documentar WCAG aplicable |
| NFR-006 | Obligatorio | Edición offline sin instalar Node, npm o herramientas de desarrollo en equipo del docente |
| NFR-007 | Obligatorio | Una sala tiene una autoridad de estado; eventos idempotentes y política de reconexión verificable |
| NFR-008 | Obligatorio | Instalación, cambios y reversión auditables; nunca «update-theme» destructivo o autoactualización insegura |
| NFR-009 | Obligatorio | Privacidad por defecto: sin almacenar identificadores del alumnado innecesarios, política de retención y consentimiento |
| NFR-010 | Medible | Benchmarks de arranque, RAM, CPU, instalador, latencia de voto y transferencia de datos, con equipo y muestra documentados |
| NFR-011 | Obligatorio | Una caída de la red o de Live nunca borra el curso; UI debe mostrar qué puede hacerse sin conexión |
| NFR-012 | Obligatorio | Seguridad de red local: escuchar solo interfaz elegida, no abrir firewall automáticamente sin consentimiento y no exponer endpoints administrativos |
| NFR-013 | Obligatorio | Pruebas de regresión con Windows, Chrome, al menos un navegador móvil real, tamaños de pantalla y modo offline |
| NFR-014 | Obligatorio | Mínimo acoplamiento: componente de escritorio, motor y Live versionados y probados de forma independiente |

## 10. Decisiones y alternativas técnicas

| ADR | Decisión provisional | Motivo | Validación requerida |
|---|---|---|---|
| ADR-P01 | Conservar Reveal.js 6 + React como motor | Evitar rehacer presentador y romper cursos | Regresión de presentación existente |
| ADR-P02 | Diseñar Studio como UI separada del motor | Cambios independientes y empaquetado gradual | Inventario real de `openclass-studio` |
| ADR-P03 | Preferir Tauri 2 para escritorio | Webview del sistema y potencial de tamaño/consumo reducido | Comparativa focalizada con Electron y Wails, prototipo de proyección/sidecar |
| ADR-P04 | Formato de contenido JSON versionado + exportador a Markdown | Editor de bloques e importación documental | Esquema, migración y pruebas de round-trip |
| ADR-P05 | Reutilizar núcleo de salas/validación en local e internet | Coherencia de interacciones | Separar core de HTTP, auth, transporte y persistencia |
| ADR-P06 | No duplicar autoridad en sesión híbrida | Evitar votos y estados divergentes | Diseño de arquitectura distribuida y casos de fallo |
| ADR-P07 | Zoom Apps SDK como integración futura | Experiencia integrada *en* la reunión | Piloto/permiso Zoom, requisitos de seguridad y publicación |

Ninguna ADR de esta tabla autoriza implementación inmediata.

## 11. Plan incremental y criterios de salida

**ETAPA 0 — Gobernanza y protección (primero).** Inventariar motor, Studio y Live; conservar cambios locales; declarar protegido el curso académico; registrar baseline Git/npm y divergencia C9; crear este documento en el motor. **Salida:** mapa de componentes y archivos, riesgos y diferencias; sin cambios funcionales.

**ETAPA 1 — Estabilidad del motor.** Preparar corrección 1.3.1 del lanzador `localhost`/orígenes, proceso de actualización no destructivo y pruebas LAN/Live focalizadas. **Salida:** CI Windows/Chrome y aceptación; **no publicar sin aprobación**.

**ETAPA 2 — Interacciones sencillas.** Nube de ideas, preguntas y respuestas rápidas, controles de tiempo, API de actividades y UI móvil. **Salida:** prueba de sesión remota sin regresión de protocolo v2.

**ETAPA 3 — Modo Aula y seguimiento.** Proyección/entrega selectiva de diapositivas, sincronización autorizada, pausa de 15 minutos, «Listo»/«Más tiempo», protección de notas/soluciones. **Salida:** prueba real con docentes y móviles; no filtra materiales privados.

**ETAPA 4 — Studio básico.** Verificar/reutilizar carpeta preexistente, abrir un curso, ver compatibilidad, iniciar/parar presentación, mantener notas y pantalla secundaria. **Salida:** prototipo funcional sin tocar curso activo.

**ETAPA 5 — Autoría y contenido.** Formato versionado, importación DOCX/PDF/PPTX/Markdown, editor de bloques drag-and-drop e importación de resultados IA. **Salida:** reconstrucción fiel de un curso de prueba y round-trip validado.

**ETAPA 6 — Aula LAN offline.** Servidor local, QR, Wi-Fi existente y hotspot asistido, encuesta y nube de ideas sin internet. **Salida:** varios celulares reales en LAN sin acceso exterior.

**ETAPA 7 — Empaquetado de escritorio.** Selección definitiva Tauri/Electron/Wails tras prototipo; instalador offline, arranque seguro, medición de recursos. **Salida:** equipo limpio, usuario sin Node/npm, curso de prueba usable.

**ETAPA 8 — Integraciones externas y Zoom.** VirtuXperience/CloudLabs por enlaces autorizados y, cuando haya permisos, Zoom App. **Salida:** pilotos aprobados por institución/proveedor, sin romper web/LAN.

**Nota:** las etapas son priorización inicial y podrán reordenarse por decisión del propietario, siempre preservando dependencias técnicas. Un MVP de Studio puede adelantarse si se valida el motor.

## 12. Matriz transversal de compatibilidad y pruebas

Para toda funcionalidad nueva documentar:

1. **Modalidad:** offline individual, LAN, remoto, híbrido (si disponible), Zoom (si disponible).
2. **Actores:** docente, presentador, estudiante, administrador.
3. **Contenido enviado:** ninguno, fragmento público autorizado, interacción, resultado agregado, otro.
4. **Seguridad:** autenticación, origen, autorización, expiración, límites, manejo de desconexiones.
5. **UX:** teclado, lector de pantalla, móvil, proyector, dos monitores.
6. **Observabilidad:** evento/comprobación, sin nombres, claves ni contenido sensible en logs.
7. **Regresión:** curso nuevo generado y curso de prueba, sin modificar curso académico activo.
8. **Aceptación:** evidencia de Chrome/Edge y móvil real cuando proceda; pruebas automatizadas focalizadas.

## 13. Preguntas abiertas que NO bloquean el inventario

| ID | Pregunta / experimento | Decisión pendiente |
|---|---|---|
| Q-001 | `D:\OpenClass\openclass-studio` **no existe en este equipo** (inventario realizado). ¿Existe en otro equipo o repositorio y qué tecnología usa? | Reutilizar o diseñar nuevo prototipo |
| Q-002 | ¿Se desea compartir diapositiva actual o permitir navegar un conjunto docente autorizado? | Diseño Modo Aula |
| Q-003 | ¿Actividades nominativas, seudónimas o solo anónimas? | Política de privacidad y reportes |
| Q-004 | ¿Se admite un solo equipo docente por sala o varios presentadores? | Autoridad y roles |
| Q-005 | ¿Qué políticas de la red Wi-Fi institucional permiten conexiones entre dispositivos? | Viabilidad LAN presencial |
| Q-006 | ¿Qué mínimo de hardware y sistemas operativos probar? | Alcance del instalador y benchmarks |
| Q-007 | ¿Hay derechos/licencias de inserción para recursos VirtuXperience y CloudLabs? | Integración en iframe o enlace externo |
| Q-008 | ¿Quién puede registrar una Zoom App de prueba y autorizarla institucionalmente? | Piloto Zoom |
| Q-009 | ¿Qué formato/versionado de bloques conserva los cursos Markdown existentes? | Esquema y migración |
| Q-010 | ¿Qué información se retiene al cerrar una sesión de aula? | Persistencia y privacidad |

### 13.1 Decisiones propuestas (NO aprobadas por el propietario)

Son propuestas de trabajo; ninguna constituye aprobación ejecutiva ni autoriza implementación, merge, publicación o despliegue.

| ID | Propuesta | Relación | Estado |
|---|---|---|---|
| D1 | Alinear la rama local con `origin/main` solo después de resolver la preservación del trabajo local | BAS-001, BAS-012 | Ejecutada por fast-forward a `072b0bf…` (2026-10-30, sin push); pendiente de validación formal por el propietario |
| D2 | Conservar autosync y evaluar su procedencia | BAS-012 | Propuesta |
| D3 | Mostrar al estudiante la diapositiva actual por defecto; conjunto navegable autorizado como opción | Q-002, INT-005 | Propuesta |
| D4 | Nube de ideas anónima por defecto, con moderación y límites | Q-003, INT-002 | Propuesta |
| D5 | Planificación de 1.3.1 autorizable posteriormente; no implementar ni publicar en esta sesión | BAS-006, Etapa 1 | Propuesta |

## 14. Reglas de trabajo para Claude / Codex

1. Iniciar **en la raíz del repositorio maestro** `D:\OpenClass\Reveal.js\create-openclass-uniminuto-revealjs`.
2. Leer `AGENTS.md`, después `docs/AI-CONTEXT.md` y este documento; obedecer Graphify: **antes de inspeccionar código**, `graphify query`/`explain`/`path` si existe el grafo. No leer todo el repositorio indiscriminadamente.
3. Leer `git status`, rama y diffs locales. **No descartar, limpiar, restaurar, rebasar o hacer commit de cambios ajenos.**
4. **Nunca modificar:** `D:\OpenClass\Cursos\plataformasdesarrollo-uniminuto` salvo autorización específica posterior; el archivo de la presente fase no autoriza ello.
5. No crear worktrees, clones, cursos paralelos o nuevos repositorios sin revisar antes las carpetas existentes y obtener aprobación.
6. No mover `services/openclass-live` sin plan de migración, tests y aprobación; no tocar VPS, Traefik, Docker o Zoom en fase documental.
7. No instalar paquetes, modificar lockfiles, ejecutar scripts de actualización, `npm publish`, Git push/merge ni activar servicios sin autorización de implementación específica.
8. Diferenciar **hecho verificado**, **propuesta** y **pendiente**; no informar PASS sin prueba.
9. Para nuevos requisitos: crear ID incremental, prioridad, modalidad, criterios de aceptación, dependencias, riesgos; actualizar el historial y conservar el texto anterior en Git.
10. En implementación autorizada futura: una modificación -> una verificación -> siguiente gate; ejecutar `graphify update .` después de cambios relevantes y verificar.
11. Mantener el paquete público libre de logos, imágenes y materiales institucionales sin derechos de distribución.
12. La primera intervención de Claude con este documento es **análisis y propuesta**, no código.

## 15. Bitácora de cambios

| Fecha | Documento | Cambio | Fuente / decisión | Estado |
|---|---|---|---|---|
| 2026-10-30 | 0.1.0 | Creación de requisitos de autoría, Live, LAN/Wi-Fi, nube de ideas, Modo Aula, Zoom, escritorio, integraciones y protección del curso | Conversación con propietario + revisión repo/documentación | Borrador para validar |
| 2026-10-30 | 0.1.2 | Corrección de interpretación del tag `v1.3.0` (objeto del tag vs. commit `072b0bf…` = `origin/main`); divergencia de rama local (`4636e60`, base 1.2.0) en BAS-001; BAS-009 y Q-001 (Studio no existe en este equipo); nuevo BAS-012 (trabajo previo de autosync, preservado, sin autoría atribuida); nueva sección 13.1 con D1–D5 como decisiones propuestas; BAS-007 y requisitos funcionales sin cambios | Instrucción del propietario en sesión de gobernanza; inventario local. Sin pruebas técnicas ejecutadas | Borrador para validar |
| 2026-10-30 | 0.1.3 | BAS-001 corregido: la rama local no estaba divergida (era ancestro directo de `origin/main`, cuatro commits atrás); registrado el fast-forward a `072b0bf3…`; D1 marcada como ejecutada. Se conserva el diagnóstico 0.1.2 como historial. Studio (BAS-009, Q-001) sigue sin existir en este equipo; requisitos sin cambios; autosync no aprobado ni integrado | Gate D1/D2 con respaldo SHA-256 y verificación posterior | Borrador para validar |

### Plantilla para futuras adiciones

```markdown
### Solicitud de cambio CR-YYYY-NNN
- Fecha:
- Solicitado por:
- Necesidad docente / problema:
- Entorno (offline, LAN, web, Zoom):
- Requisito nuevo o modificado (ID):
- Prioridad propuesta (P0/P1/P2/P3):
- Cómo comprobarlo:
- Información que sale del dispositivo:
- Riesgos / dependencias:
- Decisión (propuesta / aprobada / rechazada / diferida):
- Versión de documento y etapa afectada:
```

## 16. Fuentes y referencias técnicas

### Internas (evidencia de código y proceso)
- `AGENTS.md`
- `docs/AI-CONTEXT.md` (algunos estados históricos pueden estar desactualizados)
- `services/openclass-live/README.md`
- `services/openclass-live/docs/PROTOCOLO.md`
- `services/openclass-live/docs/ZOOM-APPS.md`
- `template/src/Presentacion.jsx`, `template/src/plugins/live.mjs`, `template/src/plugins/fase2.mjs`
- `bin/create-openclass-uniminuto-revealjs.mjs`, `template/scripts/openclass-start.mjs`
- Evidencias C2–C9 suministradas por el propietario en conversación.

### Externas (para comprobaciones al ejecutar)
- Zoom Apps: https://developers.zoom.us/docs/zoom-apps/guides/invite-participants/
- In-meeting apps (Zoom): https://github.com/zoom/skills/blob/main/skills/general/use-cases/in-meeting-apps.md
- Zoom Meeting SDK (diferente a Apps SDK): https://developers.zoom.us/docs/meeting-sdk/
- Tauri 2, instalación offline: https://tauri.app/distribute/windows-installer/
- VirtuXperience: https://www.uniminuto.edu/virtuxperience-home
- CloudLabs (portal de identidad, no contrato técnico): https://keycloak.cloudlabslearning.com/

**Nota de mantenimiento:** revisar enlaces, versiones y políticas de terceros antes de cada fase de integración. Las URL no representan permisos adquiridos.
