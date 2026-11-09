-- Interact 0.4.0 · migración 1: cuentas, tokens de un solo uso, sesiones, auditoría e historial.
-- Dominio escrito en SQL estándar (sin funciones propias de SQLite) para poder migrar a PostgreSQL.
CREATE TABLE usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL CHECK (rol IN ('superusuario', 'docente')),
  hash TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo', 'suspendido')),
  email_verificado INTEGER NOT NULL DEFAULT 0 CHECK (email_verificado IN (0, 1)),
  creado INTEGER NOT NULL,
  ultimo_acceso INTEGER
);

-- Invitación, verificación de correo, recuperación y vínculo con la app local: solo se guarda el hash del token.
CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('invitacion', 'verificacion', 'recuperacion')),
  hash_token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE,
  rol TEXT CHECK (rol IN ('superusuario', 'docente')),
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  creado INTEGER NOT NULL,
  vence INTEGER NOT NULL,
  usado INTEGER,
  revocado INTEGER
);
CREATE INDEX tokens_email ON tokens(email, tipo);

CREATE TABLE sesiones_cuenta (
  sid_hash TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'panel' CHECK (tipo IN ('panel', 'vinculo')),
  creada INTEGER NOT NULL,
  vence INTEGER NOT NULL,
  revocada INTEGER
);
CREATE INDEX sesiones_usuario ON sesiones_cuenta(usuario_id);

CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  actor_id TEXT,
  accion TEXT NOT NULL,
  objetivo TEXT NOT NULL DEFAULT '',
  detalle TEXT NOT NULL DEFAULT ''
);
CREATE INDEX auditoria_ts ON auditoria(ts);

-- Historial: solo datos agregados. Nunca respuestas individuales, alias, notas privadas ni soluciones sin revelar.
CREATE TABLE salas_historial (
  id TEXT PRIMARY KEY,
  propietario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL CHECK (estado IN ('activa', 'finalizada', 'vencida', 'interrumpida')),
  creada INTEGER NOT NULL,
  actualizada INTEGER NOT NULL,
  cerrada INTEGER,
  participantes INTEGER NOT NULL DEFAULT 0,
  preguntas INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX historial_propietario ON salas_historial(propietario_id, creada);
CREATE INDEX historial_estado ON salas_historial(estado);

CREATE TABLE actividades_historial (
  sala_id TEXT NOT NULL REFERENCES salas_historial(id) ON DELETE CASCADE,
  actividad_id TEXT NOT NULL,
  orden INTEGER NOT NULL,
  enunciado TEXT NOT NULL,
  tipo TEXT NOT NULL,
  opciones TEXT NOT NULL,
  rondas TEXT NOT NULL,
  resultados_publicados INTEGER NOT NULL DEFAULT 0,
  correcta_revelada INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (sala_id, actividad_id)
);
