/**
 * OpenClass Live: panel docente. Autenticación por cookie HttpOnly (POST con token CSRF) y control de
 * la sala por Socket.IO en /docente. El servidor calcula todos los resultados; aquí solo se muestran.
 */
import { el, letra, textoConCodigo, barras, comparar, ESTADOS } from './comun.mjs';

const $ = (id) => document.getElementById(id);
let csrf = '';
let socket = null;
let salaId = '';
let estado = null;
const desveladas = new Set();

function mostrar(vista) {
  for (const id of ['vista-login', 'vista-salas', 'vista-sala']) $(id).classList.toggle('oculto', id !== vista);
  $('btn-salir').classList.toggle('oculto', vista === 'vista-login');
}
function aviso(id, texto, tipo = '') { const n = $(id); n.textContent = texto ?? ''; n.className = `aviso ${tipo}${texto ? '' : ' oculto'}`; }
const emitir = (evento, datos = {}) => new Promise((resolve) => {
  socket.timeout(10_000).emit(evento, datos, (err, r) => resolve(err ? { ok: false, mensaje: 'Sin respuesta del servidor' } : r));
});

// ---------------- Sesión HTTP ----------------
async function api(ruta, cuerpo) {
  const r = await fetch(ruta, {
    method: cuerpo === undefined ? 'GET' : 'POST', credentials: 'same-origin',
    headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json', 'X-OC-CSRF': csrf },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  return { estado: r.status, datos: await r.json().catch(() => ({})) };
}

async function iniciar() {
  const { datos } = await api('/api/docente/sesion');
  if (datos.autenticado) { csrf = datos.csrf; conectar(); } else mostrar('vista-login');
}

$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  $('btn-login').disabled = true;
  const { estado: s, datos } = await api('/api/docente/login', { password: $('password').value });
  $('btn-login').disabled = false;
  $('password').value = '';
  if (s === 200) { csrf = datos.csrf; aviso('error-login', ''); conectar(); return; }
  aviso('error-login', s === 429 ? 'Demasiados intentos. Espere unos minutos.' : 'Contraseña incorrecta.', 'error');
});

$('btn-salir').addEventListener('click', async () => {
  await api('/api/docente/logout', {});
  socket?.disconnect();
  socket = null; salaId = ''; csrf = '';
  history.replaceState(null, '', '/docente/');
  mostrar('vista-login');
});

// ---------------- Socket ----------------
function conectar() {
  socket?.disconnect();
  socket = window.io('/docente', { reconnectionDelayMax: 5000 });
  socket.on('connect', () => { $('conexion').textContent = 'Conectado'; $('conexion').classList.remove('offline'); });
  socket.on('disconnect', () => { $('conexion').textContent = 'Reconectando…'; $('conexion').classList.add('offline'); });
  socket.on('connect_error', (e) => {
    if (e.message === 'no_autenticado') { socket.disconnect(); mostrar('vista-login'); }
  });
  socket.on('sesion', ({ salas }) => {
    const deRuta = /#sala=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1];
    if (deRuta && salas.some((s) => s.id === deRuta)) seguir(deRuta);
    else if (salaId && salas.some((s) => s.id === salaId)) seguir(salaId);
    else { salaId = ''; pintarSalas(salas); }
  });
  socket.on('estado', (e) => { if (e.sala.id === salaId) pintar(e); });
  socket.on('sala:cerrada', ({ salaId: id, motivo }) => {
    if (id !== salaId) return;
    salaId = '';
    history.replaceState(null, '', '/docente/');
    alert(motivo === 'vencida' ? 'La sala venció y sus datos se eliminaron.' : 'Sesión finalizada. Los datos se eliminaron.');
    listar();
  });
}

async function listar() {
  const r = await emitir('sala:listar');
  if (r.ok) pintarSalas(r.salas);
}

function pintarSalas(salas) {
  mostrar('vista-salas');
  const lista = $('lista-salas');
  lista.replaceChildren();
  if (!salas.length) lista.append(el('li', { clase: 'suave', texto: 'No hay salas abiertas.' }));
  for (const s of salas) {
    lista.append(el('li', { clase: 'pregunta' },
      el('div', { clase: 'codigo-sala', texto: s.codigo }),
      el('div', {}, el('div', { texto: s.titulo || 'Sin título' }),
        el('div', { clase: 'suave', texto: `${s.conectados} conectados · vence ${new Date(s.vence).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}` })),
      el('div', { clase: 'acciones' }, el('button', { type: 'button', clase: 'mini', texto: 'Abrir panel', onclick: () => seguir(s.id) }))));
  }
}

$('form-sala').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const r = await emitir('sala:crear', { titulo: $('titulo-sala').value.trim(), preModeracion: $('premoderacion').checked });
  if (!r.ok) return alert(r.mensaje);
  $('titulo-sala').value = '';
  seguir(r.sala.id);
});

async function seguir(id) {
  const r = await emitir('sala:seguir', { salaId: id });
  if (!r.ok) { history.replaceState(null, '', '/docente/'); return listar(); }
  salaId = id;
  history.replaceState(null, '', `/docente/#sala=${id}`);
  $('enlace').href = r.enlace;
  $('enlace').textContent = r.enlace;
  $('qr').src = r.qr;
  mostrar('vista-sala');
  pintar(r.estado);
}

// ---------------- Vista de sala ----------------
function pintar(e) {
  estado = e;
  $('codigo-sala').textContent = e.sala.codigo;
  $('titulo-panel').textContent = e.sala.titulo || 'Sala sin título';
  $('m-conectados').textContent = String(e.sala.conectados);
  $('m-unidos').textContent = String(e.sala.participantes);
  $('vence').textContent = `Vence a las ${new Date(e.sala.vence).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  $('q-abiertas').checked = e.sala.preguntasAbiertas;
  $('q-premod').checked = e.sala.preModeracion;
  pintarActiva(e.activa, e.sala);
  pintarHistorial(e.historial, e.activa?.id);
  pintarPreguntas(e.preguntas);
}

const accion = (evento, encuestaId) => async () => {
  const r = await emitir(evento, encuestaId ? { salaId, encuestaId } : { salaId });
  if (!r.ok) alert(r.mensaje);
};

function pintarActiva(enc, sala) {
  const panel = $('panel-activa');
  panel.replaceChildren();
  if (!enc) {
    panel.append(el('h2', { texto: 'Sin encuesta en pantalla' }), el('p', { clase: 'suave', texto: 'Cree una encuesta abajo o ábrala desde la presentación con el botón «En vivo».' }));
    return;
  }
  const ronda = enc.rondas[enc.rondas.length - 1];
  // append(null) insertaría el texto «null»: los bloques opcionales se filtran.
  panel.append(...[
    el('div', { clase: 'fila' }, el('span', { clase: `chip ${enc.estado}`, texto: ESTADOS[enc.estado] }),
      enc.ronda ? el('span', { clase: 'chip', texto: `Ronda ${enc.ronda}` }) : null,
      enc.resultadosPublicados ? el('span', { clase: 'chip', texto: 'Resultados visibles para estudiantes' }) : null,
      enc.correctaRevelada ? el('span', { clase: 'chip abierta', texto: 'Respuesta revelada' }) : null),
    el('p', { clase: 'enunciado', texto: enc.enunciado }),
    enc.codigo ? el('pre', {}, el('code', { texto: enc.codigo })) : null,
    el('div', { clase: 'metricas' },
      el('div', { clase: 'metrica' }, el('b', { id: 'm-respuestas', texto: String(ronda?.respondientes ?? 0) }), el('span', { clase: 'suave', texto: 'respuestas válidas' })),
      el('div', { clase: 'metrica' }, el('b', { texto: String(sala.conectados) }), el('span', { clase: 'suave', texto: 'conectados' })),
      ronda?.porcentajeCorrecto !== undefined ? el('div', { clase: 'metrica' }, el('b', { texto: `${ronda.porcentajeCorrecto}%` }), el('span', { clase: 'suave', texto: 'acierto (solo usted lo ve)' })) : null),
    barras(enc.opciones, ronda, enc.correctas)].filter(Boolean));

  const tabla = comparar(enc.opciones, enc.rondas, enc.correctas);
  if (tabla) panel.append(el('h3', { texto: 'Primera vs. segunda ronda' }), tabla);
  if (enc.explicacion) panel.append(el('details', {}, el('summary', { texto: 'Explicación preparada' }), textoConCodigo(enc.explicacion)));

  const botones = el('div', { clase: 'fila' });
  if (enc.estado === 'abierta') botones.append(el('button', { type: 'button', id: 'btn-cerrar', texto: 'Cerrar votación', onclick: accion('encuesta:cerrar', enc.id) }));
  if (enc.estado === 'cerrada') {
    if (!enc.resultadosPublicados && !enc.correctaRevelada) botones.append(el('button', { type: 'button', id: 'btn-publicar', texto: 'Mostrar resultados a estudiantes', onclick: accion('encuesta:publicar', enc.id) }));
    if (enc.ronda === 1 && !enc.correctaRevelada) botones.append(el('button', { type: 'button', clase: 'secundario', id: 'btn-ronda2', texto: 'Discusión → segunda ronda', onclick: accion('encuesta:segundaRonda', enc.id) }));
    if (!enc.correctaRevelada && (enc.correctas.length || enc.explicacion)) botones.append(el('button', { type: 'button', id: 'btn-revelar', texto: 'Revelar respuesta y explicación', onclick: accion('encuesta:revelar', enc.id) }));
  }
  botones.append(el('button', { type: 'button', clase: 'secundario', texto: 'Retirar de las pantallas', onclick: accion('encuesta:retirar') }));
  panel.append(botones);
}

function pintarHistorial(lista, activaId) {
  const ul = $('historial');
  ul.replaceChildren();
  if (!lista.length) ul.append(el('li', { clase: 'suave', texto: 'Todavía no hay encuestas en esta sesión.' }));
  for (const e of lista) {
    const resumen = e.rondas.map((r) => `R${r.numero}: ${r.respondientes} resp.${r.porcentajeCorrecto !== undefined ? `, ${r.porcentajeCorrecto}% acierto` : ''}`).join(' · ');
    ul.append(el('li', { clase: 'pregunta' },
      el('span', { clase: `chip ${e.estado}`, texto: ESTADOS[e.estado] }),
      el('div', {}, el('div', { clase: 'texto-plano', texto: e.enunciado.length > 140 ? `${e.enunciado.slice(0, 140)}…` : e.enunciado }),
        el('div', { clase: 'suave', texto: resumen || `${e.opciones.length} opciones · ${e.tipo === 'multiple' ? 'múltiple' : 'única'}` })),
      el('div', { clase: 'acciones' },
        e.estado === 'lista' ? el('button', { type: 'button', clase: 'mini', texto: 'Abrir votación', onclick: accion('encuesta:abrir', e.id) }) : null,
        e.id === activaId ? el('span', { clase: 'suave', texto: 'En pantalla' }) : null)));
  }
}

function pintarPreguntas(preguntas) {
  const ul = $('lista-preguntas');
  ul.replaceChildren();
  if (!preguntas.length) ul.append(el('li', { clase: 'suave', texto: 'Sin preguntas por ahora.' }));
  for (const q of preguntas) {
    const moderar = (accionModeracion, confirmar) => async () => {
      if (confirmar && !confirm(confirmar)) return;
      const r = await emitir('pregunta:moderar', { salaId, preguntaId: q.id, accion: accionModeracion });
      if (!r.ok) alert(r.mensaje);
    };
    const velada = q.estado === 'pendiente' && !desveladas.has(q.id);
    const texto = el('div', { clase: `texto-plano${velada ? ' velo' : ''}`, texto: q.texto });
    ul.append(el('li', { clase: `pregunta ${q.estado}` },
      el('div', { clase: 'votos' }, el('b', { texto: `▲ ${q.votos}` })),
      el('div', {}, texto, el('div', { clase: 'suave', texto: [q.alias ? `Alias: ${q.alias}` : 'Anónima', q.estado, q.proyectada ? 'proyectada' : ''].filter(Boolean).join(' · ') })),
      el('div', { clase: 'acciones' },
        velada ? el('button', { type: 'button', clase: 'mini secundario', texto: 'Leer', onclick: () => { desveladas.add(q.id); pintarPreguntas(estado.preguntas); } }) : null,
        q.estado === 'pendiente' ? el('button', { type: 'button', clase: 'mini', texto: 'Aprobar', onclick: moderar('aprobar') }) : null,
        q.estado !== 'oculta' ? el('button', { type: 'button', clase: 'mini', texto: q.proyectada ? 'Quitar de la presentación' : 'Proyectar en la presentación', onclick: moderar(q.proyectada ? 'quitarProyeccion' : 'proyectar') }) : null,
        q.estado !== 'respondida' && q.estado !== 'oculta' ? el('button', { type: 'button', clase: 'mini secundario', texto: 'Marcar respondida', onclick: moderar('respondida') }) : null,
        q.estado !== 'oculta' ? el('button', { type: 'button', clase: 'mini secundario', texto: 'Ocultar', onclick: moderar('ocultar') }) : el('button', { type: 'button', clase: 'mini secundario', texto: 'Restaurar', onclick: moderar('aprobar') }),
        el('button', { type: 'button', clase: 'mini peligro', texto: 'Bloquear autor', onclick: moderar('bloquearAutor', '¿Bloquear al autor? Sus preguntas se ocultan y no podrá seguir participando desde ese dispositivo.') }))));
  }
}

for (const [id, campo] of [['q-abiertas', 'abiertas'], ['q-premod', 'preModeracion']]) {
  $(id).addEventListener('change', async (ev) => {
    const r = await emitir('preguntas:ajustar', { salaId, [campo]: ev.target.checked });
    if (!r.ok) alert(r.mensaje);
  });
}

// ---------------- Composición de encuestas ----------------
function filaOpcion(valor = '') {
  const fila = el('div', { clase: 'fila' },
    el('input', { type: 'text', maxlength: 200, placeholder: 'Texto de la opción', 'aria-label': 'Opción', value: valor }),
    el('label', { clase: 'fila suave' }, el('input', { type: 'checkbox', 'aria-label': 'Correcta' }), 'Correcta'),
    el('button', { type: 'button', clase: 'mini secundario', 'aria-label': 'Quitar opción', texto: '×', onclick: () => { if ($('opciones').children.length > 2) fila.remove(); renombrar(); } }));
  return fila;
}
function renombrar() {
  [...$('opciones').children].forEach((f, i) => { f.querySelector('input[type=text]').placeholder = `Opción ${letra(i)}`; });
}
function reiniciarComposer() {
  $('form-encuesta').reset();
  $('opciones').replaceChildren(...[0, 1, 2, 3].map(() => filaOpcion()));
  renombrar();
}
$('btn-mas').addEventListener('click', () => { if ($('opciones').children.length < 8) { $('opciones').append(filaOpcion()); renombrar(); } });

function leerComposer() {
  const filas = [...$('opciones').children].map((f) => ({ texto: f.querySelector('input[type=text]').value.trim(), correcta: f.querySelector('input[type=checkbox]').checked }))
    .filter((o) => o.texto);
  return {
    enunciado: $('enunciado').value, codigo: $('codigo').value || undefined, tipo: $('tipo').value,
    opciones: filas.map((o) => o.texto), correctas: filas.flatMap((o, i) => (o.correcta ? [i] : [])),
    explicacion: $('explicacion').value || undefined,
  };
}
async function guardarEncuesta(abrir) {
  const r = await emitir('encuesta:crear', { salaId, encuesta: leerComposer(), abrir });
  if (!r.ok) return aviso('error-encuesta', r.mensaje, 'error');
  aviso('error-encuesta', '');
  reiniciarComposer();
}
$('form-encuesta').addEventListener('submit', (ev) => { ev.preventDefault(); guardarEncuesta(true); });
$('btn-guardar').addEventListener('click', () => guardarEncuesta(false));

// ---------------- Acciones de sala ----------------
$('btn-volver').addEventListener('click', () => { salaId = ''; history.replaceState(null, '', '/docente/'); listar(); });
$('btn-copiar').addEventListener('click', () => navigator.clipboard?.writeText($('enlace').textContent));
$('btn-clave').addEventListener('click', async () => {
  const r = await emitir('sala:clave', { salaId });
  if (!r.ok) return aviso('aviso-clave', r.mensaje, 'error');
  try { await navigator.clipboard.writeText(r.clave); aviso('aviso-clave', 'Clave copiada. Péguela en «En vivo» de la presentación.', 'ok'); } catch {
    prompt('Copie la clave de presentador:', r.clave);
  }
});
$('btn-revocar').addEventListener('click', async () => {
  if (!confirm('¿Revocar todas las claves de presentador de esta sala? Las presentaciones conectadas se desconectarán.')) return;
  const r = await emitir('sala:revocarClaves', { salaId });
  aviso('aviso-clave', r.ok ? 'Claves revocadas. Copie una nueva si la necesita.' : r.mensaje, r.ok ? 'ok' : 'error');
});
$('btn-finalizar').addEventListener('click', async () => {
  if (!confirm('¿Finalizar la sesión? Se eliminarán del servidor todas las encuestas, respuestas y preguntas de esta sala.')) return;
  const r = await emitir('sala:finalizar', { salaId });
  if (!r.ok) alert(r.mensaje);
});

reiniciarComposer();
iniciar();
