# WillEdTech · Protocolo Crew44 FASTTRACK

**Versión:** 2026-11-13
**Ámbito:** tareas de desarrollo, diagnóstico y auditoría en repositorios WillEdTech.
**Ubicación canónica en este repositorio:** `docs/CREW44-FASTTRACK.md`.

> Este documento complementa `AGENTS.md`, `CLAUDE.md` y las restricciones del proyecto. No concede permisos para modificar sistemas, publicar ni desplegar. Ante conflictos, prevalecen las restricciones explícitas del propietario y las políticas de seguridad del repositorio.

## 1. Enrutamiento y continuidad

- **Todas las tareas se envían a Partner (Gemini), el coordinador de Crew44.** Partner solo recibe, organiza y traspasa; **no** lee código, no ejecuta comandos y no realiza pruebas.
- Para elegir ejecutor, escribir su nombre natural en la instrucción: «Que lo implemente el Programador Junior», por ejemplo. `ASIGNACIÓN: X` o `AGENT=X` **no cambian de agente** por sí mismos.
- El chat de Crew44 se abre en la **raíz del mismo repositorio** indicado en `PROYECTO`.
- **Un mensaje = una tarea completa** con alcance verificable. No interrumpir la cadena automática con mensajes nuevos mientras está ejecutándose.
- Mantener el proyecto, los cambios ya realizados y los acuerdos anteriores: **no reiniciar** fases aprobadas ni pedir exploración global.
- Si Partner está bloqueado por un límite de API, reportar el bloqueo; no simular traspasos, ejecuciones ni aprobaciones.

## 2. Agentes y costo

| Agente (nombre exacto) | Uso |
|---|---|
| **Programador Junior (Claude Haiku)** | Predeterminado. Cambios mecánicos claros de 1–2 archivos; pruebas, texto, CSS y configuración puntual; diagnósticos de solo lectura. |
| **Programador Senior (Claude Sonnet)** | Más de 3 archivos; arquitectura, API, autenticación, seguridad, datos, migraciones o fallos de causa desconocida. |
| **Auditor Junior (GPT Luna)** | Auditoría predeterminada: verifica solo el diff de la tarea y sus pruebas. |
| **Auditor Senior (GPT Sol)** | Seguridad, autenticación, datos, migraciones, diffs grandes, promoción a `main` o escalamiento solicitado por el Auditor Junior. Evitar duplicar auditorías; reservarlo para el cierre cuando sea posible. |

## 3. Cadena FASTTRACK

```text
Partner → Programador → Auditor Junior → [Auditor Senior si corresponde] → Partner
                           │
                           └─ hallazgos → Programador corrige → Auditor Junior reaudita
                                                    (máximo 2 rondas; después PARCIAL)
```

- Cada ejecutor deja un **RELEVO** conciso para el siguiente: archivos y líneas exactas, símbolos, consulta de Graphify, comando de verificación y resultado.
- El Auditor Junior revisa el **diff de la tarea**, no todo el repositorio.
- Si corresponde Auditor Senior, recibe el alcance final y la evidencia anterior; no repite la exploración.
- Las solicitudes meramente diagnósticas `MODE=READ_ONLY` se asignan a un programador y regresan a Partner **sin auditoría adicional**, salvo que el objetivo explícito de la tarea sea una auditoría independiente.
- Para corregir una auditoría cerrada, enviar **otra tarea FASTTRACK** con los hallazgos precisos (`archivo:línea`) y el mismo comando de verificación.

## 4. Ahorro de tokens y uso de Graphify

- Cada tarea identifica **rutas, líneas conocidas y nombres de símbolos**; no solicita «revisar todo» ni incluye código/logs extensos.
- Antes de explorar código, consultar el grafo con una búsqueda acotada, por ejemplo:

  ```bash
  graphify query "interact release manifest reproducibility" --budget 800
  ```

- Si la versión de Graphify no reconoce `--budget`, documentar el rechazo y ejecutar `graphify query` sin ese parámetro; no inventar resultados.
- Usar `graphify path` o `graphify explain` para relaciones concretas. **No leer `graphify-out/graph.json` completo ni `GRAPH_REPORT.md` completo** por rutina. Este último es solo un resumen de arquitectura cuando una consulta focalizada no alcanza.
- Los **programadores**, después de modificar archivos, ejecutan **una vez** `graphify update .` desde la raíz y comprueban su resultado.
- Los **auditores** verifican la vigencia del grafo; **no** lo modifican.
- Nunca crear o editar `graphify-out/GRAPH_REPORT.md` manualmente. No crear grafos paralelos dentro de subdirectorios.
- El grafo orienta dónde mirar; los resultados de pruebas y archivos siguen siendo la evidencia del comportamiento.

## 5. Formato obligatorio del encargo

**Máximo 120 palabras por mensaje de tarea** (sin código ni logs). Rellenar este esquema:

```text
FASTTRACK
PROYECTO: /mnt/d/<ruta/al/repositorio> (abrir Crew44 aquí)
AGENTE INICIAL: Programador Junior (Claude Haiku) | Programador Senior (Claude Sonnet)
OBJETIVO: <resultado concreto, en 1–2 frases>
ARCHIVOS: <rutas:líneas y símbolos conocidos>
GRAPHIFY: graphify query "<símbolos o tema>" --budget 800
CRITERIOS DE ACEPTACIÓN: <comportamientos verificables>
VERIFICAR CON: <comando exacto desde el directorio indicado>
AUDITORÍA: <Auditor Junior por defecto; Senior si aplica>
RESTRICCIONES: <rutas excluidas y operaciones prohibidas>
COMMIT=NO  INSTALAR_DEPENDENCIAS=NO  MODE=WRITE
```

**Reglas de campos:**

- `AGENTE INICIAL` es una preferencia de traspaso expresada en lenguaje natural, no una orden que omita a Partner.
- `COMMIT=SI` permite **solo** un commit en la rama existente, sin push; por defecto `COMMIT=NO`.
- `INSTALAR_DEPENDENCIAS=NO` siempre por defecto. `SI` requiere autorización explícita del propietario y separación segura de los entornos.
- `MODE=READ_ONLY` prohíbe modificar archivos y crear commits. `MODE=WRITE` permite únicamente el alcance aprobado.
- Si falta una condición necesaria o el comando no está disponible, devolver `BLOQUEADO` o `NO_VERIFICADO`; no falsear PASS.
- Para gates de publicación, distinguir `READY_FOR_MERGE` y `READY_FOR_RELEASE`; separar pendientes de CI y de despliegue.

## 6. Reporte de cierre y evidencia

Partner entrega un **REPORTE FASTTRACK**:

- `TAREA`, `RESULTADO` (`COMPLETADO | PARCIAL | BLOQUEADO`), `RECORRIDO`, `IMPLEMENTADO`, `VERIFICACIÓN`, `AUDITORÍA`, `GRAPHIFY`, `COMMIT`, `PENDIENTES Y RIESGOS`, `SIGUIENTE ACCIÓN SUGERIDA`.
- Incluir **BITÁCORA paso a paso** y relevos breves. Cada PASS debe estar sustentado por un comando ejecutado **en ese chat**, su resultado, `archivo:línea` o SHA exacto. No pegar logs completos si basta con evidencia corta.
- Una afirmación sin ejecución verificable se marca `NO_VERIFICADO`. Un `PASS` sin evidencia no sirve como gate.
- Para auditorías contra commits, proporcionar `BASE_SHA`, `TARGET_SHA`, número de commits y archivos esperados, así como archivos sin seguimiento relevantes. No limitarse a `git diff BASE..HEAD` si el trabajo sigue sin commit.
- No reportar despliegues ni checks de GitHub no ejecutados. Si Crew44 no dispone de acceso a GitHub, solicitar que el propietario obtenga la evidencia con `gh` **fuera** del crew y la facilite resumida.

## 7. Restricciones técnicas y de seguridad

- Los repositorios Windows compartidos aparecen en Crew44 bajo `/mnt/d/...`; por ejemplo, `D:\OpenClass\Reveal.js\create-openclass-uniminuto-revealjs` ↔ `/mnt/d/OpenClass/Reveal.js/create-openclass-uniminuto-revealjs`.
- **NUNCA ejecutar `npm install` ni `npm ci` en un repositorio compartido con Windows sin autorización explícita.** Los módulos nativos y lanzadores de Linux pueden romper `node_modules` de Windows (por ejemplo, Rollup o Vitest). No intentar «reparar» la instalación eliminando `node_modules` o `package-lock.json`.
- Verificar primero dependencias y comandos ya existentes. Si un entorno carece de Docker, navegador o base de datos, distinguir esa restricción del estado real de Windows, CI y la VPS.
- Sin clones, worktrees, nuevas carpetas auxiliares, limpieza destructiva de Git ni borrado de archivos preexistentes, salvo permiso expreso.
- Sin `git reset --hard`, `git clean`, force-push ni eliminación manual de `.git/index.lock` sin identificar antes su causa y comprobar que no hay otro proceso Git activo.
- Sin push, merge, tags, publicación, despliegue, cambios de secretos o infraestructura, salvo autorización **específica** para esa operación. `COMMIT=SI` no concede esos permisos.
- Respetar los límites entre proyectos; no modificar `template/`, otros productos, Brand privado ni recursos institucionales cuando el trabajo se limita a `services/openclass-live/`.
- Nunca revelar secretos en reportes, comandos o archivos versionados.
- En Windows, presentar comandos PowerShell encapsulados en `& { ... }`; en Linux, bloques reproducibles `bash <<'BASH'` cuando proceda.

## 8. Política de publicación para Interact

- La marca aprobada, un paquete reproducible y las pruebas locales **no equivalen a una release**.
- Publicación solo con código identificado, auditoría aplicable, CI del SHA exacto, manifiesto íntegro y autorización de release.
- La automatización objetivo es **release oficial aprobada → imagen GHCR por digest → respaldo verificable → despliegue controlado en VPS → HTTP/WebSocket/funcionalidad → recuperación cuando sea compatible**.
- No desplegar Interact en producción simplemente por push a `main`, ni desde una rama móvil sin procedencia demostrada. No usar `latest` como identidad de imagen.
- Conservar el servicio existente hasta verificar el candidato; no afectar PostgreSQL ni otros stacks. Un cambio de esquema puede impedir rollback solo por imagen y exige procedimiento específico.
- El sandbox independiente se incorporará como etapa previa cuando se autorice; no inventar que ya existe.

---

**Uso recomendado:** al abrir una tarea, indicar al coordinador «Aplicar `docs/CREW44-FASTTRACK.md`; ejecutar solo este encargo y entregar el reporte FASTTRACK». El documento no sustituye los permisos específicos ni las instrucciones actuales del propietario.
