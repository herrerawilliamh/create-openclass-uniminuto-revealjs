-- Interact 0.4.0 · migración 1 (PostgreSQL ≥ 16): cuentas, tokens de un solo uso, sesiones, auditoría e historial.
-- Convenciones:
--   * Fechas: bigint con milisegundos desde la época Unix (UTC). El dominio usa un reloj inyectable (pruebas
--     deterministas de vencimientos) y la API ya entrega milisegundos; `CHECK (... >= 0)` evita valores absurdos.
--   * Correos: siempre en minúsculas (CHECK) y únicos sin distinguir mayúsculas (índice sobre lower(email)).
--   * Booleanos nativos; datos estructurados en jsonb con su forma comprobada.
--   * Sin funciones ni extensiones propias del proveedor: compatible con PostgreSQL dedicado o administrado.
-- El historial guarda solo datos agregados: nunca respuestas individuales, alias, notas privadas ni soluciones sin revelar.

CREATE TABLE usuarios (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
  nombre text NOT NULL DEFAULT '' CHECK (length(nombre) <= 80),
  rol text NOT NULL CHECK (rol IN ('superusuario', 'docente')),
  hash text NOT NULL CHECK (hash LIKE 'scrypt$%'),
  estado text NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
  email_verificado boolean NOT NULL DEFAULT false,
  creado bigint NOT NULL CHECK (creado >= 0),
  ultimo_acceso bigint CHECK (ultimo_acceso >= 0)
);
CREATE UNIQUE INDEX usuarios_email_ci ON usuarios (lower(email));
CREATE INDEX usuarios_rol ON usuarios (rol) WHERE rol = 'superusuario';

-- Invitación, verificación de correo y recuperación: solo se guarda el SHA-256 del token.
CREATE TABLE tokens (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  tipo text NOT NULL CHECK (tipo IN ('invitacion', 'verificacion', 'recuperacion')),
  hash_token text NOT NULL UNIQUE CHECK (length(hash_token) = 43),
  email text NOT NULL CHECK (email = lower(email)),
  rol text CHECK (rol IN ('superusuario', 'docente')),
  usuario_id text REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_por text REFERENCES usuarios(id) ON DELETE SET NULL,
  creado bigint NOT NULL CHECK (creado >= 0),
  vence bigint NOT NULL,
  usado bigint,
  revocado bigint,
  CHECK (vence > creado),
  CHECK (tipo <> 'invitacion' OR rol IS NOT NULL),
  CHECK (tipo = 'invitacion' OR usuario_id IS NOT NULL),
  CHECK (usado IS NULL OR revocado IS NULL)
);
CREATE INDEX tokens_email ON tokens (email, tipo);
CREATE INDEX tokens_pendientes ON tokens (tipo, email) WHERE usado IS NULL AND revocado IS NULL;
CREATE INDEX tokens_vence ON tokens (vence);

CREATE TABLE sesiones_cuenta (
  sid_hash text PRIMARY KEY CHECK (length(sid_hash) = 43),
  usuario_id text NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'panel' CHECK (tipo IN ('panel', 'vinculo')),
  creada bigint NOT NULL CHECK (creada >= 0),
  vence bigint NOT NULL,
  revocada bigint,
  CHECK (vence > creada)
);
CREATE INDEX sesiones_usuario_vivas ON sesiones_cuenta (usuario_id) WHERE revocada IS NULL;
CREATE INDEX sesiones_vence ON sesiones_cuenta (vence);

CREATE TABLE auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ts bigint NOT NULL CHECK (ts >= 0),
  actor_id text,
  accion text NOT NULL CHECK (accion ~ '^[a-z_]{1,60}$'),
  objetivo text NOT NULL DEFAULT '' CHECK (length(objetivo) <= 300),
  detalle text NOT NULL DEFAULT '' CHECK (length(detalle) <= 300)
);
CREATE INDEX auditoria_ts ON auditoria (ts);

CREATE TABLE salas_historial (
  id text PRIMARY KEY CHECK (length(id) BETWEEN 1 AND 64),
  propietario_id text NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo text NOT NULL DEFAULT '',
  estado text NOT NULL CHECK (estado IN ('activa', 'finalizada', 'vencida', 'interrumpida')),
  creada bigint NOT NULL CHECK (creada >= 0),
  actualizada bigint NOT NULL CHECK (actualizada >= 0),
  cerrada bigint,
  participantes integer NOT NULL DEFAULT 0 CHECK (participantes >= 0),
  preguntas integer NOT NULL DEFAULT 0 CHECK (preguntas >= 0)
);
CREATE INDEX historial_propietario ON salas_historial (propietario_id, creada DESC);
CREATE INDEX historial_creada ON salas_historial (creada DESC);
CREATE INDEX historial_activas ON salas_historial (estado) WHERE estado = 'activa';

CREATE TABLE actividades_historial (
  sala_id text NOT NULL REFERENCES salas_historial(id) ON DELETE CASCADE,
  actividad_id text NOT NULL,
  orden integer NOT NULL CHECK (orden >= 0),
  enunciado text NOT NULL,
  tipo text NOT NULL,
  opciones jsonb NOT NULL CHECK (jsonb_typeof(opciones) = 'array'),
  rondas jsonb NOT NULL CHECK (jsonb_typeof(rondas) = 'array'),
  resultados_publicados boolean NOT NULL DEFAULT false,
  correcta_revelada boolean NOT NULL DEFAULT false,
  PRIMARY KEY (sala_id, actividad_id)
);
