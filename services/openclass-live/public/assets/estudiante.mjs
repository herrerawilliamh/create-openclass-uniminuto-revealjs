/**
 * OpenClass Live: vista del estudiante (móvil primero).
 * Guarda en localStorage solo el token de reconexión de cada sala (sin datos personales): si el
 * teléfono se bloquea o se recarga la página, vuelve como el mismo participante y conserva su respuesta.
 * Esta vista no controla la presentación del docente: solo responde, pregunta y vota preguntas.
 */
import { enviar, resolverVoto, buscarPregunta } from './envio.mjs';
import { el, letra, textoConCodigo, barras, comparar, MENSAJES_ERROR, crearCuenta, formatoTiempo, sincronizarLista } from './comun.mjs';

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
    pintar(e, true); // conexión nueva: su estado es la verdad del servidor tras cualquier envío anterior
  });
  s.on('estado', (e) => pintar(e));
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

// La encuesta solo se rehace si ELLA cambia: un apoyo, una pregunta nueva o un cambio de moderación
// llegan en el mismo estado y no deben destruir los controles (ni el foco) de quien está votando.
let firmaEncuesta = null;
function pintar(e, fresco = false) {
  estado = e;
  cuenta.sincronizar(e.servidor);
  $('titulo-sala').textContent = e.sala.titulo || 'Participación en clase';
  resolverIncertidumbre(e, fresco);
  const firma = JSON.stringify(e.encuesta ?? null);
  if (firma !== firmaEncuesta) { firmaEncuesta = firma; pintarEncuesta(e.encuesta); }
  pintarPreguntas(e);
  pintarEnvioVoto();
  pintarEnvioPregunta();
}

// ---------------- Envíos con resultado incierto ----------------
// fase: 'enviando' | 'desconocido' | 'rechazado' | 'no_enviado' | 'confirmado' | 'obsoleta' | 'no_registrada'
let envioVoto = null;     // { fase, encuestaId, ronda, seleccion, mensaje }
let envioPregunta = null; // { fase, texto, idsAntes, mensaje }
const FASES_PREGUNTA_ABIERTAS = ['desconocido', 'no_encontrada', 'encontrada'];
const MSG_VOTO_OK = 'Respuesta registrada. Puede cambiarla mientras la votación siga abierta.';

/** Fuerza una conexión nueva: su `sesion` trae el estado real del servidor (no existe un evento de consulta). */
function verificar() {
  if (!socket) return;
  conexion('Verificando…');
  socket.disconnect().connect();
}

function resolverIncertidumbre(e, fresco) {
  if (envioVoto && ['desconocido', 'rechazado', 'no_enviado', 'no_registrada'].includes(envioVoto.fase)) {
    const r = resolverVoto(envioVoto, e.encuesta, fresco);
    if (r === 'confirmado') envioVoto = { ...envioVoto, fase: 'confirmado', mensaje: MSG_VOTO_OK };
    else if (r === 'obsoleta') {
      envioVoto = { fase: 'obsoleta', mensaje: 'La votación cambió o terminó antes de confirmar su envío; esa selección ya no aplica.' };
    } else if (r === 'no_registrada' && envioVoto.fase === 'desconocido') {
      envioVoto = { ...envioVoto, fase: 'no_registrada', mensaje: 'El servidor no registró su respuesta. Su selección se conserva: pulse el botón para enviarla otra vez.' };
    }
  }
  if (envioPregunta?.fase === 'desconocido' && fresco) {
    envioPregunta = buscarPregunta(envioPregunta, e.preguntas)
      ? { ...envioPregunta, fase: 'encontrada', mensaje: 'Encontramos en la lista una pregunta suya con ese texto, creada después de su envío: probablemente ya se registró. Si es la misma, no la reenvíe.' }
      : { ...envioPregunta, fase: 'no_encontrada', mensaje: 'No encontramos su pregunta en la lista, así que probablemente no se registró. Su texto se conserva: puede enviarla de nuevo.' };
  }
}

/** Refleja el estado del envío del voto en los controles ya creados (sin rehacer la tarjeta). */
let relojAvisoSala = null;
function pintarEnvioVoto() {
  if (envioVoto?.fase === 'obsoleta') { // sin tarjeta abierta no hay dónde mostrarlo: aviso de la sala, temporal
    if ($('aviso-sala').textContent !== envioVoto.mensaje) {
      aviso('aviso-sala', envioVoto.mensaje, 'alerta');
      clearTimeout(relojAvisoSala);
      relojAvisoSala = setTimeout(() => aviso('aviso-sala', ''), 20_000);
    }
  }
  const boton = $('btn-enviar');
  const salida = $('estado-envio');
  if (!boton || !salida) return;
  const f = envioVoto?.fase;
  const enc = estado?.encuesta;
  const mismo = enc && envioVoto && envioVoto.encuestaId === enc.id && envioVoto.ronda === enc.ronda;
  if (f === 'enviando' && mismo) {
    boton.disabled = true; boton.setAttribute('aria-busy', 'true'); boton.textContent = 'Enviando…';
    salida.className = 'aviso'; salida.textContent = 'Enviando su respuesta…';
    return;
  }
  boton.removeAttribute('aria-busy');
  boton.textContent = enc?.miSeleccion?.length ? 'Actualizar respuesta' : 'Enviar respuesta';
  boton.disabled = enc?.estado !== 'abierta' || !borrador || borrador.seleccion.length === 0;
  if (f === 'obsoleta') { salida.className = 'aviso alerta'; salida.textContent = envioVoto.mensaje; return; }
  if (!mismo || !envioVoto.mensaje) return;
  salida.className = `aviso ${f === 'confirmado' ? 'ok' : f === 'desconocido' ? 'alerta' : 'error'}`;
  salida.replaceChildren(envioVoto.mensaje);
  if (f === 'desconocido') salida.append(' ', el('button', { type: 'button', clase: 'mini secundario', id: 'btn-verificar', onclick: verificar, texto: 'Verificar ahora' }));
}

async function enviarVoto() {
  if (envioVoto?.fase === 'enviando' || !borrador) return; // un solo envío a la vez
  const datos = { encuestaId: borrador.encuestaId, ronda: borrador.ronda, seleccion: [...borrador.seleccion] };
  envioVoto = { fase: 'enviando', ...datos };
  aviso('aviso-sala', '');
  pintarEnvioVoto();
  const r = await enviar(socket, 'encuesta:responder', datos);
  const actual = estado?.encuesta;
  const vigente = actual && actual.id === datos.encuestaId && actual.ronda === datos.ronda;
  if (r.resultado === 'confirmado') {
    if (vigente) { actual.miSeleccion = r.respuesta.respuesta.seleccion; borrador.tocado = false; envioVoto = { ...datos, fase: 'confirmado', mensaje: MSG_VOTO_OK }; }
    else envioVoto = { fase: 'obsoleta', mensaje: 'Su respuesta se registró en la ronda anterior; la votación ya cambió.' };
  } else if (r.resultado === 'rechazado') {
    envioVoto = { ...datos, fase: 'rechazado', mensaje: `${r.mensaje ?? 'El servidor no aceptó la respuesta.'} Su selección se conserva.` };
  } else if (r.resultado === 'no_enviado') {
    envioVoto = { ...datos, fase: 'no_enviado', mensaje: 'Sin conexión: la respuesta no se envió. Su selección se conserva; se enviará cuando usted pulse el botón.' };
  } else {
    envioVoto = { ...datos, fase: 'desconocido', mensaje: 'No recibimos confirmación del servidor: la respuesta pudo o no registrarse. Su selección se conserva y no se reenvía sola.' };
    verificar();
  }
  firmaEncuesta = null; // la tarjeta se rehace con el resultado (miSeleccion, botón y mensaje)
  if (estado) pintar(estado);
}

function pintarEnvioPregunta() {
  const f = envioPregunta?.fase;
  const enviando = f === 'enviando';
  const abiertas = estado ? estado.sala.preguntasAbiertas && !estado.yo.bloqueado : false;
  const boton = $('btn-preguntar');
  boton.disabled = !abiertas || enviando;
  boton.textContent = enviando ? 'Enviando…' : (f === 'desconocido' || f === 'no_encontrada') ? 'Enviar de nuevo' : 'Enviar pregunta';
  if (enviando) boton.setAttribute('aria-busy', 'true'); else boton.removeAttribute('aria-busy');
  const recuperable = FASES_PREGUNTA_ABIERTAS.includes(f);
  $('recuperacion-pregunta').classList.toggle('oculto', !recuperable);
  $('btn-revisar-pregunta').classList.toggle('oculto', f !== 'desconocido');
  if (!abiertas || !f) return;
  if (enviando) aviso('aviso-pregunta', 'Enviando su pregunta…', '');
  else if (envioPregunta.mensaje) aviso('aviso-pregunta', envioPregunta.mensaje, f === 'encontrada' ? 'ok' : f === 'rechazada' ? 'error' : 'alerta');
}

function descartarPregunta() {
  envioPregunta = null;
  $('texto-pregunta').value = '';
  $('cuenta-pregunta').textContent = '0 / 280';
  aviso('aviso-pregunta', '');
  pintarEnvioPregunta();
  $('texto-pregunta').focus();
}

function pintarEncuesta(enc) {
  const panel = $('panel-encuesta');
  // Foco: solo se restaura si estaba dentro de la tarjeta (opción elegida o botón de envío).
  const activo = panel.contains(document.activeElement) ? document.activeElement : null;
  const foco = activo ? { opcion: activo.name === 'opcion' ? activo.value : null, enviar: activo.id === 'btn-enviar' } : null;
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
    borrador = { encuestaId: enc.id, ronda: enc.ronda, seleccion: [...enc.miSeleccion], tocado: false };
  } else if (!borrador.tocado) borrador.seleccion = [...enc.miSeleccion]; // sin cambios propios: se adopta lo confirmado (p. ej. desde otra pestaña)

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
        borrador.tocado = true;
        botonEnviar.disabled = borrador.seleccion.length === 0;
      },
    });
    return el('li', { clase: `opcion${correctas.includes(i) ? ' correcta' : ''}` },
      el('label', {}, entrada, el('span', {}, el('span', { clase: 'letra', texto: `${letra(i)}. ` }), texto)));
  }));
  panel.append(lista);

  const botonEnviar = el('button', { type: 'button', id: 'btn-enviar', disabled: !abierta || borrador.seleccion.length === 0, texto: enviada ? 'Actualizar respuesta' : 'Enviar respuesta' });
  const estadoEnvio = el('div', { role: 'status', id: 'estado-envio', clase: 'aviso oculto' });
  botonEnviar.addEventListener('click', enviarVoto);
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
  if (abierta && enviada && !(envioVoto && envioVoto.encuestaId === enc.id && envioVoto.ronda === enc.ronda)) { estadoEnvio.className = 'aviso ok'; estadoEnvio.textContent = 'Respuesta registrada. Puede cambiarla mientras la votación siga abierta.'; }
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
  restaurarFocoEncuesta(panel, foco);
  if (enc.correctaRevelada) {
    if (correctas.length && enviada) {
      const acierto = enc.miSeleccion.join(',') === correctas.join(',');
      panel.append(el('p', { clase: `aviso ${acierto ? 'ok' : 'alerta'}`, texto: acierto ? 'Su respuesta fue correcta.' : `Respuesta correcta: ${correctas.map(letra).join(', ')}.` }));
    }
    if (enc.explicacion) panel.append(el('h3', { texto: 'Explicación' }), textoConCodigo(enc.explicacion));
  }
}

/** Devuelve el foco al mismo control tras rehacer la tarjeta; si ya no existe o no admite foco, al enunciado. */
function restaurarFocoEncuesta(panel, foco) {
  if (!foco) return;
  const nodo = (foco.opcion !== null && panel.querySelector(`input[name=opcion][value="${foco.opcion}"]`)) || (foco.enviar && $('btn-enviar'));
  if (nodo && !nodo.disabled) { nodo.focus(); return; }
  const enunciado = panel.querySelector('.enunciado');
  if (enunciado) { enunciado.tabIndex = -1; enunciado.focus(); }
}

function pintarPreguntas(e) {
  const abiertas = e.sala.preguntasAbiertas && !e.yo.bloqueado;
  $('texto-pregunta').disabled = !abiertas;
  if (!abiertas) aviso('aviso-pregunta', 'La recepción de preguntas está cerrada.', 'alerta');
  else if ($('aviso-pregunta').textContent === 'La recepción de preguntas está cerrada.') aviso('aviso-pregunta', '');

  // Cada pregunta conserva su nodo: los apoyos se actualizan en el sitio (el foco del botón no se pierde)
  // y el orden por apoyos no se reaplica mientras la persona usa la lista.
  sincronizarLista($('lista-preguntas'), e.preguntas, {
    clave: (q) => q.id,
    firma: (q) => JSON.stringify([q.estado, q.propia, q.texto]),
    vacio: () => el('li', { clase: 'suave', texto: 'Aún no hay preguntas publicadas.' }),
    actualizar: (nodo, q) => {
      const b = nodo.querySelector('button');
      b.setAttribute('aria-pressed', q.votada ? 'true' : 'false');
      b.setAttribute('aria-label', `Apoyar pregunta (${q.votos} votos)`);
      if (b.textContent !== `▲ ${q.votos}`) b.textContent = `▲ ${q.votos}`;
    },
    crear: (q) => {
      const votar = el('button', {
        type: 'button', 'data-slot': 'apoyo', 'aria-pressed': q.votada ? 'true' : 'false', disabled: q.propia || q.estado === 'pendiente',
        'aria-label': `Apoyar pregunta (${q.votos} votos)`, texto: `▲ ${q.votos}`,
        onclick: async () => {
          const r = await enviar(socket, 'pregunta:votar', { preguntaId: q.id });
          if (r.resultado === 'rechazado') aviso('aviso-pregunta', r.mensaje ?? 'No se pudo registrar el apoyo.', 'error');
          else if (r.resultado === 'no_enviado') aviso('aviso-pregunta', 'Sin conexión: el apoyo no se envió.', 'error');
          else if (r.resultado === 'desconocido') aviso('aviso-pregunta', 'No recibimos confirmación del apoyo. Revise el contador de la pregunta antes de volver a pulsar.', 'alerta');
        },
      });
      return el('li', { clase: `pregunta ${q.estado}` },
        el('div', { clase: 'votos' }, votar),
        el('div', {}, el('div', { clase: 'texto-plano', texto: q.texto }),
          el('div', { clase: 'suave', texto: [q.propia ? 'Su pregunta' : '', q.estado === 'pendiente' ? 'en revisión del docente' : '', q.estado === 'respondida' ? 'respondida' : ''].filter(Boolean).join(' · ') })));
    },
  });
}

// ---------------- Eventos de la página ----------------
$('form-union').addEventListener('submit', (ev) => { ev.preventDefault(); unirse($('codigo').value, $('alias').value.trim()); });
$('codigo').addEventListener('input', (ev) => { ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
$('texto-pregunta').addEventListener('input', (ev) => { $('cuenta-pregunta').textContent = `${ev.target.value.length} / 280`; });
$('form-pregunta').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (envioPregunta?.fase === 'enviando') return; // Enter no puede duplicar un envío en curso
  const texto = $('texto-pregunta').value.trim();
  if (texto.length < 3) return aviso('aviso-pregunta', 'Escriba al menos 3 caracteres.', 'error');
  const idsAntes = (estado?.preguntas ?? []).filter((q) => q.propia).map((q) => q.id);
  envioPregunta = { fase: 'enviando', texto, idsAntes };
  pintarEnvioPregunta();
  const r = await enviar(socket, 'pregunta:enviar', { texto });
  if (r.resultado === 'confirmado') {
    envioPregunta = null;
    $('texto-pregunta').value = '';
    $('cuenta-pregunta').textContent = '0 / 280';
    pintarEnvioPregunta();
    aviso('aviso-pregunta', r.respuesta.pregunta.estado === 'pendiente' ? 'Pregunta enviada. Aparecerá cuando el docente la apruebe.' : 'Pregunta publicada.', 'ok');
  } else if (r.resultado === 'rechazado') {
    envioPregunta = { fase: 'rechazada', texto, idsAntes, mensaje: r.mensaje ?? 'No se pudo enviar. Su texto se conserva.' };
    pintarEnvioPregunta();
  } else if (r.resultado === 'no_enviado') {
    envioPregunta = { fase: 'rechazada', texto, idsAntes, mensaje: 'Sin conexión: la pregunta no se envió. Su texto se conserva.' };
    pintarEnvioPregunta();
  } else {
    envioPregunta = { fase: 'desconocido', texto, idsAntes, mensaje: 'No recibimos confirmación: la pregunta pudo o no registrarse. Su texto se conserva y no se reenvía sola; si la envía de nuevo podría quedar repetida.' };
    pintarEnvioPregunta();
    verificar();
  }
});
$('btn-revisar-pregunta').addEventListener('click', verificar);
$('btn-descartar-pregunta').addEventListener('click', descartarPregunta);
// Pestañas (patrón WAI-ARIA, activación automática): tabindex móvil, flechas, Inicio/Fin.
const PESTANAS = [['tab-encuesta', 'panel-encuesta'], ['tab-preguntas', 'panel-preguntas']];
function seleccionarPestana(tab, { foco = false } = {}) {
  for (const [t, p] of PESTANAS) {
    const activa = t === tab;
    $(t).setAttribute('aria-selected', String(activa));
    $(t).tabIndex = activa ? 0 : -1;
    $(p).classList.toggle('oculto', !activa);
  }
  if (foco) $(tab).focus();
}
for (const [tab] of PESTANAS) {
  $(tab).addEventListener('click', () => seleccionarPestana(tab));
  $(tab).addEventListener('keydown', (ev) => {
    const ids = PESTANAS.map(([t]) => t);
    const i = ids.indexOf(tab);
    const destino = { ArrowRight: ids[(i + 1) % ids.length], ArrowLeft: ids[(i - 1 + ids.length) % ids.length], Home: ids[0], End: ids[ids.length - 1] }[ev.key];
    if (!destino || ev.altKey || ev.ctrlKey || ev.metaKey) return;
    ev.preventDefault();
    seleccionarPestana(destino, { foco: true });
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
