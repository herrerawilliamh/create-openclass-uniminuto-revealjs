/**
 * OpenClass Live: validación estricta de los mensajes entrantes.
 * Cada esquema enumera los campos admitidos: un campo desconocido invalida el mensaje entero, así un
 * cliente no puede adjuntar Markdown, notas ni otros datos fuera de la interacción abierta.
 * Los textos se guardan como texto plano (los clientes los pintan con textContent, nunca como HTML).
 */
export const LIMITES = Object.freeze({
  enunciado: 500,
  codigo: 1500,
  opcion: 200,
  opcionesMin: 2,
  opcionesMax: 8,
  explicacion: 2000,
  titulo: 80,
  alias: 30,
  preguntaMin: 3,
  pregunta: 280,
});

/** Tiempo de votación de la sala, en segundos (0 = sin límite). Una sola preferencia por sala. */
export const DURACIONES_VOTACION = Object.freeze([15, 30, 60, 90, 0]);
export const DURACION_PREDETERMINADA = 30;

export class ErrorValidacion extends Error {}

const falla = (mensaje) => { throw new ErrorValidacion(mensaje); };

/** Texto plano: NFC, sin caracteres de control (salvo salto de línea y tabulador), recortado. */
export function limpiarTexto(valor, { max, min = 0, campo, multilinea = false }) {
  if (typeof valor !== 'string') falla(`${campo}: se esperaba texto`);
  let texto = valor.normalize('NFC').replace(/\r\n?/g, '\n');
  texto = texto.replace(multilinea ? /[\u0000-\u0008\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g
    : /[\u0000-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '');
  texto = multilinea ? texto.replace(/\n{3,}/g, '\n\n').replace(/^\n+|\s+$/g, '') : texto.replace(/\s+/g, ' ').trim();
  if (texto.length < min) falla(`${campo}: demasiado corto`);
  if (texto.length > max) falla(`${campo}: supera ${max} caracteres`);
  return texto;
}

function objeto(valor, permitidos, campo = 'mensaje') {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) falla(`${campo}: se esperaba un objeto`);
  for (const clave of Object.keys(valor)) if (!permitidos.includes(clave)) falla(`${campo}: campo no admitido «${clave}»`);
  return valor;
}

function indices(valor, total, campo) {
  if (!Array.isArray(valor) || valor.length > total) falla(`${campo}: lista inválida`);
  const vistos = new Set();
  for (const i of valor) {
    if (!Number.isInteger(i) || i < 0 || i >= total || vistos.has(i)) falla(`${campo}: índice inválido`);
    vistos.add(i);
  }
  return [...vistos].sort((a, b) => a - b);
}

const ID = /^[A-Za-z0-9_-]{8,40}$/;
export function id(valor, campo = 'id') {
  if (typeof valor !== 'string' || !ID.test(valor)) falla(`${campo}: identificador inválido`);
  return valor;
}

/** Códigos de sala: 6 caracteres de un alfabeto sin ambigüedades (sin 0/O, 1/I/L). */
export const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODIGO = new RegExp(`^[${ALFABETO_CODIGO}]{6}$`);
export function codigoSala(valor) {
  const c = typeof valor === 'string' ? valor.trim().toUpperCase() : '';
  if (!CODIGO.test(c)) falla('código de sala inválido');
  return c;
}

export function definicionEncuesta(valor) {
  const v = objeto(valor, ['enunciado', 'codigo', 'tipo', 'opciones', 'correctas', 'explicacion'], 'encuesta');
  const tipo = v.tipo ?? 'unica';
  if (tipo !== 'unica' && tipo !== 'multiple') falla('encuesta: tipo debe ser «unica» o «multiple»');
  if (!Array.isArray(v.opciones) || v.opciones.length < LIMITES.opcionesMin || v.opciones.length > LIMITES.opcionesMax) {
    falla(`encuesta: entre ${LIMITES.opcionesMin} y ${LIMITES.opcionesMax} opciones`);
  }
  const opciones = v.opciones.map((o, i) => limpiarTexto(o, { max: LIMITES.opcion, min: 1, campo: `opción ${i + 1}` }));
  const correctas = v.correctas === undefined || v.correctas === null ? [] : indices(v.correctas, opciones.length, 'correctas');
  if (tipo === 'unica' && correctas.length > 1) falla('encuesta: una pregunta de selección única admite una sola respuesta correcta');
  return {
    enunciado: limpiarTexto(v.enunciado, { max: LIMITES.enunciado, min: 3, campo: 'enunciado', multilinea: true }),
    codigo: v.codigo ? limpiarTexto(v.codigo, { max: LIMITES.codigo, campo: 'código', multilinea: true }) : '',
    tipo,
    opciones,
    correctas,
    explicacion: v.explicacion ? limpiarTexto(v.explicacion, { max: LIMITES.explicacion, campo: 'explicación', multilinea: true }) : '',
  };
}

export function respuesta(valor, encuesta) {
  const v = objeto(valor, ['encuestaId', 'ronda', 'seleccion'], 'respuesta');
  id(v.encuestaId, 'encuestaId');
  if (!Number.isInteger(v.ronda) || v.ronda < 1 || v.ronda > 2) falla('respuesta: ronda inválida');
  const seleccion = indices(v.seleccion, encuesta.opciones.length, 'selección');
  if (seleccion.length === 0) falla('respuesta: elegir al menos una opción');
  if (encuesta.tipo === 'unica' && seleccion.length !== 1) falla('respuesta: elegir exactamente una opción');
  return { encuestaId: v.encuestaId, ronda: v.ronda, seleccion };
}

export function union(valor) {
  const v = objeto(valor, ['codigo', 'alias', 'token'], 'unión');
  return {
    codigo: codigoSala(v.codigo),
    alias: v.alias ? limpiarTexto(v.alias, { max: LIMITES.alias, campo: 'alias' }) : '',
    token: v.token === undefined || v.token === null || v.token === '' ? null
      : (typeof v.token === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(v.token) ? v.token : falla('token inválido')),
  };
}

export function preguntaAbierta(valor) {
  const v = objeto(valor, ['texto'], 'pregunta');
  return { texto: limpiarTexto(v.texto, { max: LIMITES.pregunta, min: LIMITES.preguntaMin, campo: 'pregunta', multilinea: true }) };
}

export function soloId(valor, campo = 'id') {
  const v = objeto(valor, [campo], 'mensaje');
  return id(v[campo], campo);
}

export function crearSala(valor) {
  const v = objeto(valor ?? {}, ['titulo', 'preModeracion'], 'sala');
  if (v.preModeracion !== undefined && typeof v.preModeracion !== 'boolean') falla('sala: preModeracion debe ser booleano');
  return {
    titulo: v.titulo ? limpiarTexto(v.titulo, { max: LIMITES.titulo, campo: 'título' }) : '',
    preModeracion: v.preModeracion ?? true,
  };
}

export function moderacion(valor) {
  const v = objeto(valor, ['preguntaId', 'accion'], 'moderación');
  id(v.preguntaId, 'preguntaId');
  const acciones = ['aprobar', 'ocultar', 'respondida', 'proyectar', 'quitarProyeccion', 'bloquearAutor'];
  if (!acciones.includes(v.accion)) falla('moderación: acción no admitida');
  return { preguntaId: v.preguntaId, accion: v.accion };
}

export function ajustesPreguntas(valor) {
  const v = objeto(valor, ['abiertas', 'preModeracion'], 'ajustes');
  const salida = {};
  if (v.abiertas !== undefined) { if (typeof v.abiertas !== 'boolean') falla('ajustes: abiertas debe ser booleano'); salida.abiertas = v.abiertas; }
  if (v.preModeracion !== undefined) { if (typeof v.preModeracion !== 'boolean') falla('ajustes: preModeracion debe ser booleano'); salida.preModeracion = v.preModeracion; }
  return salida;
}

export function ajustesSala(valor) {
  const v = objeto(valor, ['duracionVotacion'], 'ajustes');
  if (!DURACIONES_VOTACION.includes(v.duracionVotacion)) falla(`ajustes: duración admitida ${DURACIONES_VOTACION.join(', ')} (0 = sin límite)`);
  return { duracionVotacion: v.duracionVotacion };
}
