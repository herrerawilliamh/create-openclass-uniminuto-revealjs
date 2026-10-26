/**
 * OpenClass Live: panel docente. Autenticación por cookie HttpOnly (POST con token CSRF) y control de
 * la sala por Socket.IO en /docente. El servidor calcula todos los resultados; aquí solo se muestran.
 *
 * Orden de prioridad: sala (QR, código, participantes) → pregunta activa con temporizador y tendencias
 * privadas → controles del momento → preguntas de estudiantes → lo opcional plegado (pregunta
 * improvisada, historial, configuración de la sesión). Las tendencias se actualizan en el sitio con
 * cada respuesta (sin rehacer la tarjeta ni perder el foco) y nunca marcan la correcta con la votación abierta.
 */
import { el, letra, textoConCodigo, barras, refrescarBarras, comparar, ESTADOS, crearCuenta, formatoTiempo, textoDuracion } from './comun.mjs';

const $ = (id) => document.getElementById(id);
let csrf = '';
let socket = null;
let salaId = '';
let estado = null;
const desveladas = new Set();
const cuenta = crearCuenta();
const DURACIONES = [15, 30, 60, 90];

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
  socket.io.on('reconnect_attempt', () => { $('conexion').textContent = 'Sin conexión: reintentando…'; $('conexion').classList.add('offline'); });
  socket.on('sala:cerrada', ({ salaId: id, motivo }) => {
    if (id !== salaId) return;
    salaId = '';
    history.replaceState(null, '', '/docente/');
    listar().then(() => aviso('aviso-salas', motivo === 'vencida' ? 'La sala venció y sus datos se eliminaron.' : 'Sesión finalizada. Los datos se eliminaron del servidor.', 'ok'));
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
  if (!r.ok) return aviso('aviso-salas', r.mensaje, 'error');
  aviso('aviso-salas', '');
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
  cuenta.sincronizar(e.servidor);
  $('codigo-sala').textContent = e.sala.codigo;
  $('titulo-panel').textContent = e.sala.titulo || 'Sala sin título';
  $('m-conectados').textContent = String(e.sala.conectados);
  $('m-unidos').textContent = String(e.sala.participantes);
  $('vence').textContent = `Abierta hasta las ${new Date(e.sala.vence).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  $('q-abiertas').checked = e.sala.preguntasAbiertas;
  $('q-premod').checked = e.sala.preModeracion;
  pintarDuracion(e.sala.duracionVotacion);
  pintarActiva(e.activa, e.sala);
  pintarHistorial(e.historial, e.activa?.id);
  pintarPreguntas(e.preguntas);
  tictac();
}

/** Mensaje breve y no bloqueante (en lugar de alert): los éxitos se borran solos. */
let relojAviso = null;
function avisoSala(texto, tipo = 'ok') {
  clearTimeout(relojAviso);
  aviso('aviso-sala', texto, tipo);
  if (texto && tipo === 'ok') relojAviso = setTimeout(() => aviso('aviso-sala', ''), 5000);
}

const accion = (evento, encuestaId, { exito, silencio = [] } = {}) => async () => {
  const r = await emitir(evento, encuestaId ? { salaId, encuestaId } : { salaId });
  if (!r.ok) { if (!silencio.includes(r.error)) avisoSala(r.mensaje, 'error'); return; }
  avisoSala(exito ?? '', exito ? 'ok' : '');
};

// ---------- Tiempo de votación: UNA preferencia por sala ----------
function pintarDuracion(actual) {
  const caja = $('duraciones');
  if (!caja.childElementCount) {
    caja.append(...DURACIONES.map((s) => el('label', { clase: 'segmento' },
      el('input', { type: 'radio', name: 'duracion', value: String(s), id: `duracion-${s}` }), `${s} s`)));
  }
  for (const r of document.querySelectorAll('input[name=duracion]')) {
    r.checked = Number(r.value) === actual;
    r.closest('label').classList.toggle('activa', r.checked);
  }
  if (actual === 0) document.querySelector('#configuracion details.avanzado').open = true;
  $('resumen-config').textContent = `· votaciones de ${textoDuracion(actual)}`;
}
document.addEventListener('change', async (ev) => {
  if (ev.target.name !== 'duracion') return;
  const segundos = Number(ev.target.value);
  const r = await emitir('sala:ajustar', { salaId, duracionVotacion: segundos });
  if (!r.ok) { avisoSala(r.mensaje, 'error'); pintarDuracion(estado.sala.duracionVotacion); return; }
  avisoSala(`Las próximas votaciones durarán ${textoDuracion(segundos)}.${estado?.activa?.estado === 'abierta' ? ' La votación en curso conserva su tiempo.' : ''}`);
});

// ---------- Pregunta activa: temporizador, tendencias privadas y controles del momento ----------
let firmaActiva = '';
function pintarActiva(enc, sala) {
  const panel = $('panel-activa');
  const ronda = enc?.rondas[enc.rondas.length - 1];
  // Solo se rehace la tarjeta si cambia la etapa; cada voto actualiza cifras y barras en el sitio.
  const firma = JSON.stringify(enc ? [enc.id, enc.estado, enc.ronda, enc.resultadosPublicados, enc.correctaRevelada, ronda?.cierra, sala.duracionVotacion] : [null, sala.duracionVotacion]);
  if (firma === firmaActiva) return refrescarActiva(enc, sala);
  firmaActiva = firma;
  const foco = panel.contains(document.activeElement) ? document.activeElement.id : null;
  panel.replaceChildren();
  if (!enc) {
    panel.append(el('h2', { texto: 'Sin votación en curso' }),
      el('p', { clase: 'suave', texto: `En la presentación, vaya a la diapositiva de la pregunta y pulse «En vivo» → «Iniciar votación · ${textoDuracion(sala.duracionVotacion)}». Aquí verá el tiempo y las tendencias en privado.` }));
    return;
  }
  const abierta = enc.estado === 'abierta';
  const titulo = abierta ? (enc.ronda === 2 ? 'Segunda ronda abierta' : 'Votación abierta')
    : enc.correctaRevelada ? 'Respuesta revelada' : enc.resultadosPublicados ? 'Resultados mostrados' : `Votación finalizada${ronda?.cierre === 'tiempo' ? ' · se acabó el tiempo' : ''}`;
  // Con la votación abierta las barras no marcan la correcta (esta ventana podría estar compartida).
  const correctasVisibles = abierta ? [] : enc.correctas;
  panel.append(...[
    el('div', { clase: 'fila entre' }, el('h2', { texto: titulo }),
      el('div', { clase: 'fila' }, enc.ronda ? el('span', { clase: 'chip', texto: `Ronda ${enc.ronda}` }) : null,
        enc.resultadosPublicados ? el('span', { clase: 'chip', texto: 'Resultados visibles para estudiantes' }) : null,
        enc.correctaRevelada ? el('span', { clase: 'chip abierta', texto: 'Respuesta revelada' }) : null)),
    el('p', { clase: 'enunciado', texto: enc.enunciado }),
    enc.codigo ? el('pre', {}, el('code', { texto: enc.codigo })) : null,
    el('div', { clase: 'metricas' },
      abierta ? el('div', { clase: 'metrica' }, ronda?.cierra ? el('b', { clase: 'reloj', role: 'timer', 'data-cierra': String(ronda.cierra), texto: formatoTiempo(cuenta.restante(ronda.cierra)) }) : el('b', { texto: 'Sin límite' }),
        el('span', { clase: 'suave', texto: 'tiempo restante' })) : null,
      el('div', { clase: 'metrica' }, el('b', { id: 'm-respuestas', texto: String(ronda?.respondientes ?? 0) }), el('span', { clase: 'suave', id: 'm-respuestas-de', texto: `respuestas de ${sala.conectados} conectados` })),
      !abierta && ronda?.porcentajeCorrecto !== undefined ? el('div', { clase: 'metrica' }, el('b', { id: 'm-acierto', texto: `${ronda.porcentajeCorrecto}%` }), el('span', { clase: 'suave', texto: 'acierto (solo usted lo ve)' })) : null),
    el('h3', { texto: abierta ? 'Tendencias en vivo · solo en este panel' : 'Distribución de respuestas' }),
    barras(enc.opciones, ronda, correctasVisibles),
    abierta ? el('p', { clase: 'suave', texto: 'La presentación no proyecta estas barras salvo que usted pulse «Proyectar tendencias» en «En vivo». Los estudiantes no las ven.' }) : null].filter(Boolean));

  const tabla = comparar(enc.opciones, enc.rondas, correctasVisibles);
  if (tabla) panel.append(el('h3', { texto: 'Primera vs. segunda ronda' }), tabla);
  if (enc.explicacion) panel.append(el('details', {}, el('summary', { texto: 'Explicación preparada (privada hasta revelarla)' }), textoConCodigo(enc.explicacion)));

  // Controles del momento: una acción principal y, como mucho, las alternativas de ese paso.
  const botones = el('div', { clase: 'fila acciones-momento' });
  const puedeRevelar = !enc.correctaRevelada && (enc.correctas.length || enc.explicacion);
  if (abierta) {
    botones.append(el('button', { type: 'button', id: 'btn-cerrar', texto: 'Cerrar ahora', onclick: accion('encuesta:cerrar', enc.id, { silencio: ['no_abierta'] }) }));
    if (ronda?.cierra) botones.append(el('button', { type: 'button', clase: 'secundario', id: 'btn-extender', texto: '+30 segundos', onclick: accion('encuesta:extender', enc.id) }));
  } else if (!enc.resultadosPublicados && !enc.correctaRevelada) {
    botones.append(el('button', { type: 'button', id: 'btn-publicar', texto: 'Mostrar resultados', onclick: accion('encuesta:publicar', enc.id, { exito: 'Resultados visibles en los teléfonos. En la presentación: «En vivo» → «Mostrar resultados».' }) }));
  } else {
    if (enc.ronda === 1 && !enc.correctaRevelada) botones.append(el('button', { type: 'button', id: 'btn-ronda2', texto: 'Discutir y repetir', onclick: accion('encuesta:segundaRonda', enc.id) }));
    if (puedeRevelar) botones.append(el('button', { type: 'button', clase: enc.ronda === 1 ? 'secundario' : '', id: 'btn-revelar', texto: 'Revelar explicación', onclick: accion('encuesta:revelar', enc.id) }));
  }
  botones.append(el('button', { type: 'button', clase: 'secundario', id: 'btn-retirar', texto: 'Retirar de las pantallas', onclick: accion('encuesta:retirar') }));
  panel.append(botones);
  if (foco) $(foco)?.focus();
}

function refrescarActiva(enc, sala) {
  if (!enc) return;
  const ronda = enc.rondas[enc.rondas.length - 1];
  $('m-respuestas').textContent = String(ronda?.respondientes ?? 0);
  $('m-respuestas-de').textContent = `respuestas de ${sala.conectados} conectados`;
  if ($('m-acierto') && ronda?.porcentajeCorrecto !== undefined) $('m-acierto').textContent = `${ronda.porcentajeCorrecto}%`;
  refrescarBarras($('panel-activa').querySelector('.resultados'), ronda);
}

// Cuenta regresiva local (el servidor cierra la votación; no hay un mensaje por segundo).
let reloj = null;
function tictac() {
  const pasar = () => {
    const nodos = document.querySelectorAll('[data-cierra]');
    for (const n of nodos) {
      const ms = cuenta.restante(Number(n.dataset.cierra));
      n.textContent = formatoTiempo(ms);
      n.classList.toggle('urgente', ms <= 10_000);
    }
    if (!nodos.length) { clearInterval(reloj); reloj = null; }
  };
  pasar();
  if (!reloj && document.querySelector('[data-cierra]')) reloj = setInterval(pasar, 250);
}

function pintarHistorial(lista, activaId) {
  const ul = $('historial');
  ul.replaceChildren();
  $('cuenta-historial').textContent = lista.length ? `· ${lista.length}` : '';
  // Una pregunta guardada para después queda a la vista: hay algo que abrir.
  if (lista.some((e) => e.estado === 'lista')) $('bloque-historial').open = true;
  if (!lista.length) ul.append(el('li', { clase: 'suave', texto: 'Todavía no hay preguntas en esta sesión.' }));
  for (const e of lista) {
    const resumen = e.rondas.map((r) => `R${r.numero}: ${r.respondientes} resp.${r.porcentajeCorrecto !== undefined ? `, ${r.porcentajeCorrecto}% acierto` : ''}`).join(' · ');
    ul.append(el('li', { clase: 'pregunta' },
      el('span', { clase: `chip ${e.estado}`, texto: ESTADOS[e.estado] }),
      el('div', {}, el('div', { clase: 'texto-plano', texto: e.enunciado.length > 140 ? `${e.enunciado.slice(0, 140)}…` : e.enunciado }),
        el('div', { clase: 'suave', texto: resumen || `${e.opciones.length} opciones · ${e.tipo === 'multiple' ? 'múltiple' : 'única'}` })),
      el('div', { clase: 'acciones' },
        e.estado === 'lista' ? el('button', { type: 'button', clase: 'mini', texto: `Abrir votación · ${textoDuracion(estado?.sala.duracionVotacion ?? 30)}`, onclick: accion('encuesta:abrir', e.id) }) : null,
        e.id === activaId ? el('span', { clase: 'suave', texto: 'Activa' }) : null)));
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
      if (!r.ok) avisoSala(r.mensaje, 'error');
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
    if (!r.ok) avisoSala(r.mensaje, 'error');
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
  avisoSala(abrir ? 'Votación abierta.' : 'Pregunta guardada en «Preguntas de esta sesión».');
  if (abrir) $('composer').open = false;
}
$('form-encuesta').addEventListener('submit', (ev) => { ev.preventDefault(); guardarEncuesta(true); });
$('btn-guardar').addEventListener('click', () => guardarEncuesta(false));

// ---------------- Acciones de sala ----------------
$('btn-volver').addEventListener('click', () => { salaId = ''; firmaActiva = ''; history.replaceState(null, '', '/docente/'); listar(); });
$('btn-copiar').addEventListener('click', () => navigator.clipboard?.writeText($('enlace').textContent));
$('btn-clave').addEventListener('click', async () => {
  const r = await emitir('sala:clave', { salaId });
  if (!r.ok) return aviso('aviso-clave', r.mensaje, 'error');
  try { await navigator.clipboard.writeText(r.clave); aviso('aviso-clave', 'Clave copiada. En la presentación pulse «En vivo» (o la tecla L), péguela y pulse «Conectar participación».', 'ok'); } catch {
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
  if (!r.ok) avisoSala(r.mensaje, 'error');
});

reiniciarComposer();
iniciar();
