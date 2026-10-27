/**
 * OpenClass Live: vista del estudiante (móvil primero).
 * Guarda en localStorage solo el token de reconexión de cada sala (sin datos personales): si el
 * teléfono se bloquea o se recarga la página, vuelve como el mismo participante y conserva su respuesta.
 * Esta vista no controla la presentación del docente: solo responde, pregunta y vota preguntas.
 */
import { el, letra, textoConCodigo, barras, comparar, MENSAJES_ERROR, crearCuenta, formatoTiempo } from './comun.mjs';

const $ = (id) => document.getElementById(id);
const CLAVE = (codigo) => `oclive:${codigo}`;
const leer = (codigo) => { try { return JSON.parse(localStorage.getItem(CLAVE(codigo))) ?? {}; } catch { return {}; } };
const guardar = (codigo, datos) => { try { localStorage.setItem(CLAVE(codigo), JSON.stringify(datos)); } catch { /* modo privado */ } };
const borrar = (codigo) => { try { localStorage.removeItem(CLAVE(codigo)); } catch { /* modo privado */ } };

let socket = null;
let codigo = '';
let estado = null;
let borrador = null; // selección local aún no enviada: { encuestaId, ronda, seleccion }

function mostrar(vista) {
  for (const id of ['vista-union', 'vista-sala', 'vista-fin']) $(id).classList.toggle('oculto', id !== vista);
}

function aviso(id, texto, tipo = '') {
  const nodo = $(id);
  nodo.textContent = texto ?? '';
  nodo.className = `aviso ${tipo}${texto ? '' : ' oculto'}`;
}

function conexion(texto) { $('conexion').textContent = texto; }

// ---------------- Unión ----------------
function codigoDeRuta() {
  const m = /^\/join\/([A-Za-z0-9]{6})\/?$/.exec(location.pathname);
  return m ? m[1].toUpperCase() : '';
}

function unirse(c, alias) {
  codigo = c.trim().toUpperCase();
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(codigo)) {
    aviso('error-union', 'El código tiene 6 caracteres (letras y números, sin 0, O, 1, I ni L).', 'error');
    return;
  }
  const previo = leer(codigo);
  if (alias !== undefined) previo.alias = alias;
  guardar(codigo, previo);
  aviso('error-union', '');
  $('btn-unirse').disabled = true;
  socket?.disconnect();
  socket = window.io('/participante', {
    // Se recalcula en cada reconexión: así viaja siempre el último token guardado.
    auth: (cb) => { const d = leer(codigo); cb({ codigo, alias: d.alias ?? '', token: d.token ?? null }); },
    reconnectionDelayMax: 8000,
  });
  enlazar(socket);
}

function enlazar(s) {
  s.on('connect', () => conexion('Conectado'));
  s.on('sesion', ({ token, estado: e }) => {
    guardar(codigo, { ...leer(codigo), token });
    $('btn-unirse').disabled = false;
    $('codigo-actual').textContent = codigo;
    if (location.pathname !== `/join/${codigo}`) history.replaceState(null, '', `/join/${codigo}`);
    mostrar('vista-sala');
    pintar(e);
  });
  s.on('estado', pintar);
  s.on('connect_error', (error) => {
    $('btn-unirse').disabled = false;
    // Un rechazo del servidor no se reintenta solo; un fallo de red sí (socket.active).
    if (s.active) { conexion('Reconectando…'); return; }
    const mensaje = MENSAJES_ERROR[error.message] ?? 'No se pudo conectar. Inténtelo de nuevo.';
    if (error.message === 'sala_inexistente' || error.message === 'sala_vencida') borrar(codigo);
    if (estado) { fin(mensaje); return; }
    mostrar('vista-union');
    aviso('error-union', mensaje, 'error');
  });
  s.on('disconnect', (motivo) => { if (motivo !== 'io client disconnect') conexion('Reconectando…'); });
  s.on('sala:cerrada', ({ motivo }) => {
    borrar(codigo);
    fin(motivo === 'vencida' ? 'La sesión venció. Los datos se eliminaron.' : 'El docente finalizó la sesión. Gracias por participar; los datos se eliminaron.');
  });
  s.on('bloqueado', () => fin(MENSAJES_ERROR.bloqueado));
}

function fin(texto) {
  socket?.disconnect();
  socket = null;
  estado = null;
  conexion('');
  $('texto-fin').textContent = texto;
  mostrar('vista-fin');
}

// ---------------- Pintado ----------------
const cuenta = crearCuenta();
let tic = null;

function pintar(e) {
  estado = e;
  cuenta.sincronizar(e.servidor);
  $('titulo-sala').textContent = e.sala.titulo || 'Participación en clase';
  pintarEncuesta(e.encuesta);
  pintarPreguntas(e);
}

function pintarEncuesta(enc) {
  const panel = $('panel-encuesta');
  panel.replaceChildren();
  clearInterval(tic);
  if (!enc) {
    panel.append(el('h2', { texto: 'Esperando la próxima pregunta' }),
      el('p', { clase: 'suave', texto: 'Cuando el docente abra una encuesta aparecerá aquí. Mantenga esta página abierta.' }));
    return;
  }
  const abierta = enc.estado === 'abierta';
  const enviada = enc.miSeleccion.length > 0;
  if (!borrador || borrador.encuestaId !== enc.id || borrador.ronda !== enc.ronda) {
    borrador = { encuestaId: enc.id, ronda: enc.ronda, seleccion: [...enc.miSeleccion] };
  }

  panel.append(el('div', { clase: 'fila' },
    el('span', { clase: `chip ${enc.estado}`, texto: abierta ? 'Votación abierta' : 'Votación cerrada' }),
    enc.ronda === 2 ? el('span', { clase: 'chip', texto: 'Segunda ronda' }) : null,
    abierta && enc.cierra ? el('span', { clase: 'chip tiempo', role: 'timer', id: 'tiempo-restante' }) : null));
  panel.append(el('p', { clase: 'enunciado', texto: enc.enunciado }));
  if (enc.codigo) panel.append(el('pre', {}, el('code', { texto: enc.codigo })));
  if (enc.tipo === 'multiple') panel.append(el('p', { clase: 'suave', texto: 'Puede elegir varias opciones.' }));

  const correctas = enc.correctaRevelada ? enc.correctas ?? [] : [];
  const lista = el('ul', { clase: 'opciones' }, enc.opciones.map((texto, i) => {
    const entrada = el('input', {
      type: enc.tipo === 'multiple' ? 'checkbox' : 'radio', name: 'opcion', value: String(i),
      checked: borrador.seleccion.includes(i), disabled: !abierta,
      onchange: () => {
        if (enc.tipo === 'multiple') {
          borrador.seleccion = [...lista.querySelectorAll('input:checked')].map((x) => Number(x.value));
        } else borrador.seleccion = [i];
        botonEnviar.disabled = borrador.seleccion.length === 0;
      },
    });
    return el('li', { clase: `opcion${correctas.includes(i) ? ' correcta' : ''}` },
      el('label', {}, entrada, el('span', {}, el('span', { clase: 'letra', texto: `${letra(i)}. ` }), texto)));
  }));
  panel.append(lista);

  const botonEnviar = el('button', { type: 'button', disabled: !abierta || borrador.seleccion.length === 0, texto: enviada ? 'Actualizar respuesta' : 'Enviar respuesta' });
  const estadoEnvio = el('div', { role: 'status', clase: 'aviso oculto' });
  botonEnviar.addEventListener('click', () => {
    botonEnviar.disabled = true;
    socket.emit('encuesta:responder', { ...borrador }, (r) => {
      botonEnviar.disabled = false;
      if (r?.ok) {
        enc.miSeleccion = r.respuesta.seleccion;
        botonEnviar.textContent = 'Actualizar respuesta';
        estadoEnvio.className = 'aviso ok';
        estadoEnvio.textContent = 'Respuesta registrada. Puede cambiarla mientras la votación siga abierta.';
      } else {
        estadoEnvio.className = 'aviso error';
        estadoEnvio.textContent = r?.mensaje ?? 'No se pudo enviar.';
      }
    });
  });
  if (abierta) panel.append(el('div', { clase: 'fila' }, botonEnviar), estadoEnvio);
  // Cuenta regresiva local (el servidor cierra la votación; aquí solo se muestra el tiempo).
  const reloj = $('tiempo-restante');
  if (reloj) {
    const paso = () => {
      const ms = cuenta.restante(enc.cierra);
      reloj.textContent = ms > 0 ? `Quedan ${formatoTiempo(ms)}` : 'Tiempo terminado';
      reloj.classList.toggle('urgente', ms <= 10_000);
      if (ms <= 0) { clearInterval(tic); botonEnviar.disabled = true; }
    };
    paso();
    tic = setInterval(paso, 250);
  }
  if (abierta && enviada) { estadoEnvio.className = 'aviso ok'; estadoEnvio.textContent = 'Respuesta registrada. Puede cambiarla mientras la votación siga abierta.'; }
  if (!abierta) {
    panel.append(el('p', { clase: 'aviso', texto: enviada ? 'Votación cerrada. Su respuesta quedó registrada.' : 'Votación cerrada.' }));
  }

  if (enc.rondas?.length) {
    const ultima = enc.rondas[enc.rondas.length - 1];
    panel.append(el('h3', { texto: `Resultados${enc.rondas.length > 1 ? ` · ronda ${ultima.numero}` : ''}` }),
      el('p', { clase: 'suave', texto: `${ultima.respondientes} respuestas` }), barras(enc.opciones, ultima, correctas));
    const tabla = comparar(enc.opciones, enc.rondas, correctas);
    if (tabla) panel.append(el('h3', { texto: 'Comparación entre rondas' }), tabla);
  }
  if (enc.correctaRevelada) {
    if (correctas.length && enviada) {
      const acierto = enc.miSeleccion.join(',') === correctas.join(',');
      panel.append(el('p', { clase: `aviso ${acierto ? 'ok' : 'alerta'}`, texto: acierto ? 'Su respuesta fue correcta.' : `Respuesta correcta: ${correctas.map(letra).join(', ')}.` }));
    }
    if (enc.explicacion) panel.append(el('h3', { texto: 'Explicación' }), textoConCodigo(enc.explicacion));
  }
}

function pintarPreguntas(e) {
  const abiertas = e.sala.preguntasAbiertas && !e.yo.bloqueado;
  $('texto-pregunta').disabled = !abiertas;
  $('btn-preguntar').disabled = !abiertas;
  if (!abiertas) aviso('aviso-pregunta', 'La recepción de preguntas está cerrada.', 'alerta');
  else if ($('aviso-pregunta').textContent === 'La recepción de preguntas está cerrada.') aviso('aviso-pregunta', '');

  const lista = $('lista-preguntas');
  lista.replaceChildren();
  if (!e.preguntas.length) lista.append(el('li', { clase: 'suave', texto: 'Aún no hay preguntas publicadas.' }));
  for (const q of e.preguntas) {
    const votar = el('button', {
      type: 'button', 'aria-pressed': q.votada ? 'true' : 'false', disabled: q.propia || q.estado === 'pendiente',
      'aria-label': `Apoyar pregunta (${q.votos} votos)`, texto: `▲ ${q.votos}`,
      onclick: () => socket.emit('pregunta:votar', { preguntaId: q.id }, (r) => { if (!r?.ok) aviso('aviso-pregunta', r?.mensaje, 'error'); }),
    });
    lista.append(el('li', { clase: `pregunta ${q.estado}` },
      el('div', { clase: 'votos' }, votar),
      el('div', {}, el('div', { clase: 'texto-plano', texto: q.texto }),
        el('div', { clase: 'suave', texto: [q.propia ? 'Su pregunta' : '', q.estado === 'pendiente' ? 'en revisión del docente' : '', q.estado === 'respondida' ? 'respondida' : ''].filter(Boolean).join(' · ') }))));
  }
}

// ---------------- Eventos de la página ----------------
$('form-union').addEventListener('submit', (ev) => { ev.preventDefault(); unirse($('codigo').value, $('alias').value.trim()); });
$('codigo').addEventListener('input', (ev) => { ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('texto-pregunta').addEventListener('input', (ev) => { $('cuenta-pregunta').textContent = `${ev.target.value.length} / 280`; });
$('form-pregunta').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const texto = $('texto-pregunta').value.trim();
  if (texto.length < 3) return aviso('aviso-pregunta', 'Escriba al menos 3 caracteres.', 'error');
  $('btn-preguntar').disabled = true;
  socket.emit('pregunta:enviar', { texto }, (r) => {
    $('btn-preguntar').disabled = false;
    if (r?.ok) {
      $('texto-pregunta').value = '';
      $('cuenta-pregunta').textContent = '0 / 280';
      aviso('aviso-pregunta', r.pregunta.estado === 'pendiente' ? 'Pregunta enviada. Aparecerá cuando el docente la apruebe.' : 'Pregunta publicada.', 'ok');
    } else aviso('aviso-pregunta', r?.mensaje ?? 'No se pudo enviar.', 'error');
  });
});
for (const [tab, panel] of [['tab-encuesta', 'panel-encuesta'], ['tab-preguntas', 'panel-preguntas']]) {
  $(tab).addEventListener('click', () => {
    for (const [t, p] of [['tab-encuesta', 'panel-encuesta'], ['tab-preguntas', 'panel-preguntas']]) {
      $(t).setAttribute('aria-selected', String(t === tab));
      $(p).classList.toggle('oculto', p !== panel);
    }
  });
}
$('btn-salir').addEventListener('click', () => { borrar(codigo); fin('Salió de la sala. Puede volver a entrar con el código.'); });
$('btn-otra').addEventListener('click', () => { history.replaceState(null, '', '/'); $('codigo').value = ''; mostrar('vista-union'); });

const inicial = codigoDeRuta();
if (inicial) {
  $('codigo').value = inicial;
  // Desde el QR se entra directamente; el alias puede añadirse después volviendo a entrar.
  unirse(inicial);
}
