/**
 * OpenClass Live: panel docente. Autenticación por cookie HttpOnly (POST con token CSRF) y control de
 * la sala por Socket.IO en /docente. El servidor calcula todos los resultados; aquí solo se muestran.
 *
 * Orden de prioridad: sala (QR, código, participantes) → pregunta activa con temporizador y tendencias
 * privadas → controles del momento → preguntas de estudiantes → lo opcional plegado (pregunta
 * improvisada, historial, configuración de la sesión). Las tendencias se actualizan en el sitio con
 * cada respuesta (sin rehacer la tarjeta ni perder el foco) y nunca marcan la correcta con la votación abierta.
 */
import { crearPanelCuenta } from './cuenta-panel.mjs';
import { el, letra, textoConCodigo, barras, refrescarBarras, comparar, ESTADOS, crearCuenta, formatoTiempo, textoDuracion, mensajeHttp, esTransitorio, sincronizarLista } from './comun.mjs';

const $ = (id) => document.getElementById(id);
let csrf = '';
let socket = null;
let salaId = '';
let estado = null;
const desveladas = new Set();
const cuenta = crearCuenta();
const panelCuenta = crearPanelCuenta({ api: (ruta, cuerpo) => api(ruta, cuerpo), mostrar: (v) => mostrar(v) });
const DURACIONES = [15, 30, 60, 90];

// Solución de las preguntas improvisadas aquí: vive SOLO en esta pestaña (memoria + sessionStorage,
// que sobrevive a recargar la misma pestaña en la misma sala) y viaja únicamente con «Revelar». Cada
// entrada recuerda su sala: se descarta al revelar, al cerrar o vencer la sesión, al volver a «Salas» o
// entrar en otra sala, al finalizar o vencer la sala y cuando el servidor ya no la lista. Las preguntas
// de la presentación guardan su solución en el computador del docente.
// Límite: sessionStorage NO es un secreto frente a JavaScript del mismo origen (el panel solo carga sus
// propios módulos: CSP 'self', COOP same-origin, enlaces noopener) ni frente a «restaurar pestañas» o
// duplicar la pestaña, que copian su sessionStorage hasta que la limpieza anterior se ejecute.
const CLAVE_SOLUCIONES = 'openclass-live:soluciones';
const soluciones = new Map((() => {
  try {
    return Object.entries(JSON.parse(sessionStorage.getItem(CLAVE_SOLUCIONES) ?? '{}'))
      .filter(([, s]) => typeof s?.salaId === 'string' && Array.isArray(s.correctas));
  } catch { return []; }
})());
function guardarSoluciones() {
  try {
    if (soluciones.size) sessionStorage.setItem(CLAVE_SOLUCIONES, JSON.stringify(Object.fromEntries(soluciones)));
    else sessionStorage.removeItem(CLAVE_SOLUCIONES); // solo la clave propia, nunca sessionStorage.clear()
  } catch { /* solo en memoria */ }
}
function recordarSolucion(id, solucion) {
  if (solucion) soluciones.set(id, { salaId, ...solucion }); else soluciones.delete(id);
  guardarSoluciones();
}
/** Descarta las soluciones que no cumplan `conservar(salaIdDeLaSolucion)` (sin argumento: todas). */
function olvidarSoluciones(conservar = () => false) {
  for (const [id, s] of soluciones) if (!conservar(s.salaId)) soluciones.delete(id);
  guardarSoluciones();
}
const soloSalas = (salas) => olvidarSoluciones((id) => salas.some((s) => s.id === id));
guardarSoluciones(); // reescribe sin entradas inválidas o de un formato anterior

let heredado = false;
function mostrar(vista) {
  for (const id of ['vista-login', 'vista-salas', 'vista-sala', 'vista-historial', 'vista-admin']) $(id).classList.toggle('oculto', id !== vista);
  $('nav-vistas').classList.toggle('oculto', !['vista-salas', 'vista-historial', 'vista-admin'].includes(vista));
  if (vista === 'vista-salas') panelCuenta.pestana('salas');
  $('btn-salir').classList.toggle('oculto', vista === 'vista-login');
  // La cinta solo muestra el código y las secciones dentro de una sala.
  $('nav-secciones').classList.toggle('oculto', vista !== 'vista-sala');
  $('cinta-codigo-caja').classList.toggle('oculto', vista !== 'vista-sala');
}
function aviso(id, texto, tipo = '') { const n = $(id); n.textContent = texto ?? ''; n.className = `aviso ${tipo}${texto ? '' : ' oculto'}`; }
// Un acuse que no llega (sin socket, desconexión o 10 s sin respuesta) es `transitorio`: no prueba que la
// sala o la sesión hayan desaparecido, así que quien llama no debe borrar nada privado por ese motivo.
const emitir = (evento, datos = {}) => new Promise((resolve) => {
  if (!socket) return resolve({ ok: false, error: 'sin_conexion', mensaje: 'Sin conexión con el servidor', transitorio: true });
  socket.timeout(10_000).emit(evento, datos, (err, r) => {
    if (err) return resolve({ ok: false, error: 'timeout', mensaje: 'Sin respuesta del servidor', transitorio: true });
    if (r?.error === 'no_autenticado') terminarSesion(); // vencida o revocada: el servidor cierra después del acuse
    resolve(r);
  });
});

// ---------------- Sesión HTTP ----------------
/** Nunca rechaza: un fallo de red o un tiempo agotado vuelve como { estado: 0, falla: 'red' | 'timeout' }. */
async function api(ruta, cuerpo) {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 10_000);
  try {
    const r = await fetch(ruta, {
      method: cuerpo === undefined ? 'GET' : 'POST', credentials: 'same-origin', signal: control.signal,
      headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json', 'X-OC-CSRF': csrf },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: await r.json().catch(() => ({})) };
  } catch (error) {
    return { estado: 0, datos: {}, falla: error?.name === 'AbortError' ? 'timeout' : 'red' };
  } finally { clearTimeout(limite); }
}

/**
 * Sesión terminada (salir, vencida o rechazada): primero se limpia todo lo privado de esta pestaña
 * (memoria, la clave propia de sessionStorage y el formulario) y solo después aparece el acceso.
 */
function terminarSesion() {
  socket?.disconnect();
  socket = null; csrf = '';
  panelCuenta.limpiar();
  dejarSala();
  aviso('error-login', '');
  $('btn-reintentar').classList.add('oculto');
  mostrar('vista-login');
}

/**
 * Comprobar la sesión al abrir. Solo una respuesta que confirma que NO hay sesión (200 sin autenticar,
 * 401, 403) limpia lo privado de la pestaña. Si el servidor no responde (red, tiempo, 429, 5xx) no se sabe
 * nada: se conservan soluciones y borradores y se ofrece reintentar.
 */
async function iniciar() {
  $('btn-reintentar').disabled = true;
  const r = await api('/api/docente/sesion');
  $('btn-reintentar').disabled = false;
  if (r.estado === 200) configurarLogin(Boolean(r.datos.heredado)); // también con sesión abierta: tras cerrarla el formulario debe saber si hay acceso heredado
  if (r.estado === 200 && r.datos.autenticado) { csrf = r.datos.csrf; if (r.datos.usuario) panelCuenta.configurar(r.datos.usuario); aviso('error-login', ''); $('btn-reintentar').classList.add('oculto'); conectar(); return; }
  if (esTransitorio(r)) {
    mostrar('vista-login');
    $('btn-reintentar').classList.remove('oculto');
    aviso('error-login', `${mensajeHttp(r)} No se verificó su sesión; lo que tenía en esta pestaña no se ha borrado.`, 'alerta');
    return;
  }
  terminarSesion();
}
$('btn-reintentar').addEventListener('click', () => { aviso('error-login', ''); iniciar(); });

/** Con el acceso compartido heredado el correo es opcional; sin él es obligatorio. */
function configurarLogin(conHeredado) {
  heredado = conHeredado;
  $('email').required = !conHeredado;
  $('nota-email').textContent = conHeredado ? '(déjelo vacío para el acceso compartido heredado)' : '';
}

let entrando = false;
$('form-login').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (entrando) return;
  entrando = true;
  const boton = $('btn-login');
  boton.disabled = true; boton.textContent = 'Entrando…'; boton.setAttribute('aria-busy', 'true');
  aviso('error-login', '');
  let r;
  const email = $('email').value.trim();
  if (!email && !heredado) {
    entrando = false; boton.disabled = false; boton.textContent = 'Entrar'; boton.removeAttribute('aria-busy');
    aviso('error-login', 'Escriba su correo electrónico.', 'error'); $('email').focus(); return;
  }
  try { r = await (email ? api('/api/auth/login', { email, password: $('password').value }) : api('/api/docente/login', { password: $('password').value })); } finally {
    entrando = false;
    boton.disabled = false; boton.textContent = 'Entrar'; boton.removeAttribute('aria-busy');
  }
  if (r.estado === 200 && r.datos.csrf) { $('password').value = ''; csrf = r.datos.csrf; if (r.datos.usuario) { $('email').value = ''; iniciarUsuario(); } $('btn-reintentar').classList.add('oculto'); conectar(); return; }
  // Una contraseña rechazada se borra; ante un fallo del servidor o de la red se conserva para reintentar.
  if (!esTransitorio(r)) $('password').value = '';
  aviso('error-login', r.estado === 403 && r.datos.error === 'no_verificado'
    ? 'Su correo aún no está verificado. Abra el enlace que le enviamos o pida uno nuevo en la página de cuenta.'
    : (email && r.estado === 401 ? 'Correo o contraseña incorrectos.' : mensajeHttp(r, 'login')), r.estado === 401 || r.estado === 403 ? 'error' : 'alerta');
  $('password').focus();
});

/**
 * Salir: el estado local se limpia siempre, también si la petición falla. Solo se afirma que la sesión
 * del servidor se cerró cuando respondió 200 (revoca la sesión y borra la cookie).
 */
$('btn-salir').addEventListener('click', async () => {
  if (!descartarBorrador()) return;
  const boton = $('btn-salir');
  boton.disabled = true;
  const r = await api('/api/docente/logout', {});
  terminarSesion();
  boton.disabled = false;
  if (r.estado !== 200) {
    aviso('error-login', `${mensajeHttp(r)} Se cerró el panel y se borró lo privado de este navegador, pero NO se pudo confirmar que el servidor haya cerrado la sesión. Si el equipo es compartido, cierre el navegador o espere a que la sesión venza.`, 'alerta');
  }
});

/** Tras entrar con cuenta personal, el nombre y el rol salen de /api/docente/sesion. */
async function iniciarUsuario() {
  const r = await api('/api/docente/sesion');
  if (r.estado === 200 && r.datos.usuario) panelCuenta.configurar(r.datos.usuario);
}

// ---------------- Socket ----------------
function conectar() {
  socket?.disconnect();
  socket = window.io('/docente', { reconnectionDelayMax: 5000 });
  socket.on('connect', () => { $('conexion').textContent = 'Conectado'; $('conexion').classList.remove('offline'); });
  socket.on('disconnect', () => { $('conexion').textContent = 'Reconectando…'; $('conexion').classList.add('offline'); });
  socket.on('connect_error', (e) => {
    if (e.message === 'no_autenticado') terminarSesion();
    else if (!$('vista-login').classList.contains('oculto')) aviso('error-login', 'Sesión iniciada, pero no se pudo abrir la conexión en vivo. Se reintentará sola.', 'alerta');
  });
  socket.on('sesion', ({ salas }) => {
    salasConocidas = salas;
    soloSalas(salas); // salas finalizadas o vencidas mientras la pestaña estaba cerrada o sin conexión
    const deRuta = /#sala=([A-Za-z0-9_-]+)/.exec(location.hash)?.[1];
    const esperada = deRuta || salaId;
    if (deRuta && salas.some((s) => s.id === deRuta)) seguir(deRuta);
    else if (salaId && salas.some((s) => s.id === salaId)) seguir(salaId);
    else {
      dejarSala(); pintarSalas(salas);
      if (esperada) aviso('aviso-salas', AVISO_SALA_AUSENTE, 'alerta');
    }
  });
  socket.on('estado', (e) => { if (e.sala.id === salaId) pintar(e); });
  socket.io.on('reconnect_attempt', () => { $('conexion').textContent = 'Sin conexión: reintentando…'; $('conexion').classList.add('offline'); });
  socket.on('sala:cerrada', ({ salaId: id, motivo }) => {
    olvidarSoluciones((s) => s !== id);
    if (id !== salaId) return;
    dejarSala();
    listar().then(() => aviso('aviso-salas', motivo === 'vencida' ? 'La sala venció. Se eliminaron las respuestas individuales; el resumen queda en «Mis sesiones».' : 'Sesión finalizada. Se eliminaron las respuestas individuales; el resumen queda en «Mis sesiones».', 'ok'));
  });
}

let salasConocidas = [];
const AVISO_SALA_AUSENTE = 'La sala ya no está disponible: se finalizó o venció, o pertenece a otra cuenta. Las respuestas individuales ya no existen en el servidor.';

async function listar() {
  const lista = $('lista-salas');
  if (!lista.childElementCount) lista.append(el('li', { clase: 'suave', texto: 'Cargando salas…' }));
  const r = await emitir('sala:listar');
  if (r.ok) { salasConocidas = r.salas; soloSalas(r.salas); pintarSalas(r.salas); return; }
  // Sin respuesta: se muestra la última lista conocida y no se toca nada privado.
  if (!salaId) pintarSalas(salasConocidas);
  aviso('aviso-salas', `${r.mensaje}. La lista puede estar desactualizada.`, 'alerta');
}

function pintarSalas(salas) {
  mostrar('vista-salas');
  const lista = $('lista-salas');
  lista.replaceChildren();
  if (!salas.length) lista.append(el('li', { clase: 'suave', texto: 'No hay salas abiertas. Cree una para empezar la clase.' }));
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
  const r = await emitir('sala:crear', { titulo: $('titulo-sala').value.trim(), preModeracion: $('premoderacion').checked, conservarResultados: $('conservar').checked });
  if (!r.ok) return aviso('aviso-salas', r.mensaje, 'error');
  aviso('aviso-salas', '');
  $('titulo-sala').value = '';
  seguir(r.sala.id);
});

/**
 * Entrar o reanudar una sala. Una falla pasajera (sin respuesta, desconexión) NO borra soluciones ni
 * borrador: se avisa y se reintenta. Solo una respuesta del servidor que dice que la sala ya no existe o
 * venció (o que no hay permiso) lleva a dejar la sala y limpiar.
 */
let reintentoSeguir = null;
async function seguir(id, intento = 0) {
  clearTimeout(reintentoSeguir);
  const r = await emitir('sala:seguir', { salaId: id });
  if (!r.ok) {
    if (r.transitorio) {
      if (salaId === id) avisoSala('Sin respuesta al reanudar la sala. Reintentando; su borrador y las soluciones siguen guardados.', 'error');
      else {
        pintarSalas(salasConocidas);
        aviso('aviso-salas', 'No hubo respuesta al abrir la sala. Sus soluciones y borradores siguen guardados; pulse «Abrir panel» para reintentar.', 'alerta');
      }
      if (intento < 3 && socket) reintentoSeguir = setTimeout(() => seguir(id, intento + 1), 2000 * (intento + 1));
      return;
    }
    if (r.error === 'no_autenticado') return; // terminarSesion() ya limpió y mostró el acceso
    const ausente = ['sala_inexistente', 'sala_vencida'].includes(r.error);
    dejarSala();
    await listar();
    aviso('aviso-salas', ausente ? AVISO_SALA_AUSENTE : r.mensaje, ausente ? 'alerta' : 'error');
    return;
  }
  clearTimeout(reintentoSeguir);
  if ($('aviso-sala').textContent.startsWith('Sin respuesta al reanudar')) avisoSala('');
  if (id !== salaId) aviso('aviso-enlace', '');
  // Otra sala: nada del formulario ni de las soluciones de la anterior. La misma (recarga o
  // reconexión) conserva su solución y el borrador.
  if (id !== salaId) reiniciarComposer();
  olvidarSoluciones((s) => s === id);
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
  $('cinta-codigo').textContent = e.sala.codigo;
  $('cinta-codigo').setAttribute('aria-label', [...e.sala.codigo].join(' '));
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
  if (!r.ok) { avisoSala(`${r.mensaje}. El ajuste no se aplicó; se muestra el valor vigente.`, 'error'); if (estado) pintarDuracion(estado.sala.duracionVotacion); return; }
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
  // Mapa de foco: solo si el foco estaba DENTRO de la tarjeta. Si su control sigue existiendo se queda en él;
  // si la acción desapareció (cerrar, publicar, repetir, revelar, retirar) pasa a la principal del paso nuevo.
  const dentro = panel.contains(document.activeElement);
  const foco = dentro ? document.activeElement.id : '';
  const enSumario = dentro && document.activeElement.tagName === 'SUMMARY';
  const restaurarFoco = (destino) => {
    if (!dentro) return;
    const objetivo = (foco && $(foco)) || (enSumario && panel.querySelector('summary')) || $(destino) || $('titulo-activa');
    objetivo?.focus();
  };
  panel.replaceChildren();
  if (!enc) {
    panel.append(el('h2', { id: 'titulo-activa', tabindex: '-1', texto: 'Sin votación en curso' }),
      el('p', { clase: 'suave', texto: `En la presentación, vaya a la diapositiva de la pregunta y pulse «En vivo» → «Iniciar votación · ${textoDuracion(sala.duracionVotacion)}». Aquí verá el tiempo y las tendencias en privado.` }));
    restaurarFoco('titulo-activa');
    return;
  }
  const abierta = enc.estado === 'abierta';
  const titulo = abierta ? (enc.ronda === 2 ? 'Segunda ronda abierta' : 'Votación abierta')
    : enc.correctaRevelada ? 'Respuesta revelada' : enc.resultadosPublicados ? 'Resultados mostrados' : `Votación finalizada${ronda?.cierre === 'tiempo' ? ' · se acabó el tiempo' : ''}`;
  // Con la votación abierta las barras no marcan la correcta (esta ventana podría estar compartida).
  const local = enc.correctaRevelada ? null : soluciones.get(enc.id) ?? null;
  const correctasVisibles = abierta ? [] : enc.correctas ?? local?.correctas ?? [];
  const explicacion = enc.explicacion || local?.explicacion;
  panel.append(...[
    el('div', { clase: 'fila entre' }, el('h2', { id: 'titulo-activa', tabindex: '-1', texto: titulo }),
      el('div', { clase: 'fila' }, enc.ronda ? el('span', { clase: 'chip', texto: `Ronda ${enc.ronda}` }) : null,
        enc.resultadosPublicados ? el('span', { clase: 'chip', texto: 'Resultados visibles para estudiantes' }) : null,
        enc.correctaRevelada ? el('span', { clase: 'chip abierta', texto: 'Respuesta revelada' }) : null)),
    el('p', { clase: 'enunciado', texto: enc.enunciado }),
    enc.codigo ? el('pre', {}, el('code', { texto: enc.codigo })) : null,
    el('div', { clase: 'metricas' },
      abierta ? el('div', { clase: 'metrica' }, ronda?.cierra ? el('b', { clase: 'reloj', role: 'timer', 'data-cierra': String(ronda.cierra), texto: formatoTiempo(cuenta.restante(ronda.cierra)) }) : el('b', { texto: 'Sin límite' }),
        el('span', { clase: 'suave', texto: 'tiempo restante' })) : null,
      el('div', { clase: 'metrica' }, el('b', { id: 'm-respuestas', texto: String(ronda?.respondientes ?? 0) }), el('span', { clase: 'suave', id: 'm-respuestas-de', texto: `respuestas de ${sala.conectados} conectados` })),
      !abierta && ronda?.porcentajeCorrecto !== undefined ? el('div', { clase: 'metrica' }, el('b', { id: 'm-acierto', texto: `${ronda.porcentajeCorrecto}%` }), el('span', { clase: 'suave', texto: 'acierto' })) : null),
    el('h3', { texto: abierta ? 'Tendencias en vivo · solo en este panel' : 'Distribución de respuestas' }),
    barras(enc.opciones, ronda, correctasVisibles),
    abierta ? el('p', { clase: 'suave', texto: 'La presentación no proyecta estas barras salvo que usted pulse «Proyectar tendencias» en «En vivo». Los estudiantes no las ven.' }) : null].filter(Boolean));

  const tabla = comparar(enc.opciones, enc.rondas, correctasVisibles);
  if (tabla) panel.append(el('h3', { texto: 'Primera vs. segunda ronda' }), tabla);
  if (explicacion) panel.append(el('details', {}, el('summary', { texto: enc.correctaRevelada ? 'Explicación revelada' : 'Explicación preparada (solo en esta pestaña hasta revelarla)' }), textoConCodigo(explicacion)));

  // Controles del momento: una acción principal y, como mucho, las alternativas de ese paso.
  const botones = el('div', { clase: 'fila acciones-momento' });
  const puedeRevelar = Boolean(local && (local.correctas.length || local.explicacion));
  if (abierta) {
    botones.append(el('button', { type: 'button', id: 'btn-cerrar', texto: 'Cerrar ahora', onclick: accion('encuesta:cerrar', enc.id, { silencio: ['no_abierta'] }) }));
    if (ronda?.cierra) botones.append(el('button', { type: 'button', clase: 'secundario', id: 'btn-extender', texto: '+30 segundos', onclick: accion('encuesta:extender', enc.id) }));
  } else if (!enc.resultadosPublicados && !enc.correctaRevelada) {
    botones.append(el('button', { type: 'button', id: 'btn-publicar', texto: 'Publicar en teléfonos', onclick: accion('encuesta:publicar', enc.id, { exito: 'Resultados visibles en los teléfonos. Para proyectarlos, en la presentación: «En vivo» → «Mostrar resultados».' }) }));
  } else {
    if (enc.ronda === 1 && !enc.correctaRevelada) botones.append(el('button', { type: 'button', id: 'btn-ronda2', texto: 'Discutir y repetir', onclick: accion('encuesta:segundaRonda', enc.id) }));
    if (puedeRevelar) botones.append(el('button', { type: 'button', clase: enc.ronda === 1 ? 'secundario' : '', id: 'btn-revelar', texto: 'Revelar explicación', onclick: () => revelar(enc.id, local) }));
  }
  botones.append(el('button', { type: 'button', clase: 'secundario', id: 'btn-retirar', texto: 'Retirar de las pantallas', onclick: accion('encuesta:retirar') }));
  panel.append(botones);
  // Alcance real de cada paso: qué cambia en teléfonos y qué NO cambia solo en la presentación.
  const alcance = abierta ? 'Cerrar no publica resultados ni revela la respuesta.'
    : enc.correctaRevelada ? 'Los teléfonos ven la respuesta correcta y la explicación; no se puede deshacer.'
    : enc.resultadosPublicados ? 'Los teléfonos ven las barras, todavía sin la correcta. La presentación no cambia sola.'
    : 'Los teléfonos saben que terminó, pero no ven resultados hasta que usted los publique.';
  panel.append(el('p', { clase: 'suave nota-alcance', texto: alcance }));
  if (!abierta && !enc.correctaRevelada && !local) {
    panel.append(el('p', { clase: 'suave', id: 'revelar-en-presentacion', texto: 'La solución de esta pregunta no está en este navegador. Si la pregunta viene de la presentación, revélela allí: «En vivo» → «Revelar explicación» (o desde Build Tech).' }));
  }
  panel.append(reglaQuienVeQue(enc, abierta, local));
  // Principal del paso: cerrar → mostrar resultados → discutir y repetir → revelar → retirar.
  restaurarFoco(abierta ? 'btn-cerrar' : !enc.resultadosPublicados && !enc.correctaRevelada ? 'btn-publicar'
    : enc.ronda === 1 && !enc.correctaRevelada ? 'btn-ronda2' : puedeRevelar ? 'btn-revelar' : 'btn-retirar');
}

/** «Quién ve qué ahora»: solo afirma lo que este panel sabe; la presentación no es detectable desde aquí. */
function reglaQuienVeQue(enc, abierta, local) {
  const telefonos = abierta ? 'Ven la pregunta y el tiempo. No ven barras.'
    : enc.correctaRevelada ? 'Ven la respuesta correcta y la explicación.'
    : enc.resultadosPublicados ? 'Ven las barras, todavía sin la correcta.'
    : 'Saben que terminó. No ven resultados.';
  const solucion = enc.correctaRevelada ? 'Ya fue revelada a la clase.'
    : local ? 'Sellada en esta pestaña. No ha salido de aquí.'
    : 'No está en este navegador.';
  const fila = (signo, titulo, texto) => el('div', {}, el('dt', {}, el('span', { clase: `signo ${signo}`, 'aria-hidden': 'true' }), titulo), el('dd', { texto }));
  return el('div', { clase: 'regla-caja' },
    el('h3', { id: 't-regla', texto: 'Quién ve qué ahora' }),
    el('dl', { clase: 'regla', 'aria-labelledby': 't-regla' },
      fila('s-privado', 'Este panel', abierta ? 'Usted ve las tendencias en vivo, sin marcar la correcta.' : 'Usted ve la distribución de respuestas.'),
      fila('s-telefonos', 'Teléfonos', telefonos),
      fila('s-nosabe', 'Presentación', 'Este panel no lo detecta. Compruébelo en «En vivo».'),
      fila('s-sello', 'Solución', solucion)));
}

/** La solución sale de esta pestaña solo aquí, con la votación ya cerrada; el servidor la valida y la revela de una vez. */
async function revelar(encuestaId, { correctas, explicacion }) {
  const r = await emitir('encuesta:revelar', { salaId, encuestaId, solucion: { correctas, explicacion } });
  if (!r.ok && r.error !== 'ya_revelada') return avisoSala(r.mensaje, 'error');
  recordarSolucion(encuestaId, null);
  avisoSala('');
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
  $('cuenta-historial').textContent = lista.length ? `· ${lista.length}` : '';
  // Una pregunta guardada para después queda a la vista: hay algo que abrir.
  if (lista.some((e) => e.estado === 'lista')) $('bloque-historial').open = true;
  const duracion = estado?.sala.duracionVotacion ?? 30;
  const resumenDe = (e) => e.rondas.map((r) => `R${r.numero}: ${r.respondientes} resp.${r.porcentajeCorrecto !== undefined ? `, ${r.porcentajeCorrecto}% acierto` : ''}`).join(' · ');
  sincronizarLista(ul, lista, {
    clave: (e) => e.id,
    firma: (e) => JSON.stringify([e.estado, e.enunciado, resumenDe(e), e.opciones.length, e.tipo, e.id === activaId, duracion]),
    vacio: () => el('li', { clase: 'suave', texto: 'Todavía no hay preguntas en esta sesión.' }),
    crear: (e) => {
    const resumen = resumenDe(e);
    return (el('li', { clase: 'pregunta' },
      el('span', { clase: `chip ${e.estado}`, texto: ESTADOS[e.estado] }),
      el('div', {}, el('div', { clase: 'texto-plano', texto: e.enunciado.length > 140 ? `${e.enunciado.slice(0, 140)}…` : e.enunciado }),
        el('div', { clase: 'suave', texto: resumen || `${e.opciones.length} opciones · ${e.tipo === 'multiple' ? 'múltiple' : 'única'}` })),
      el('div', { clase: 'acciones' },
        e.estado === 'lista' ? el('button', { type: 'button', clase: 'mini', 'data-slot': 'abrir', texto: `Abrir votación · ${textoDuracion(duracion)}`, onclick: accion('encuesta:abrir', e.id) }) : null,
        e.id === activaId ? el('span', { clase: 'suave', texto: 'Activa' }) : null)));
    },
  });
}

/**
 * Preguntas de los estudiantes: cada una conserva su nodo mientras no cambie su estado; los apoyos se
 * actualizan en el sitio y el orden por apoyos no se aplica mientras se interactúa con la lista.
 * Mapa de foco por `data-slot`: proyectar ↔ quitar y ocultar ↔ restaurar conservan el foco; si la acción
 * desaparece (p. ej. «Aprobar») pasa al siguiente control de la misma pregunta.
 */
function pintarPreguntas(preguntas) {
  const pendientes = preguntas.filter((q) => q.estado === 'pendiente').length;
  const contador = $('cuenta-pendientes');
  contador.textContent = String(pendientes);
  contador.classList.toggle('oculto', !pendientes);
  contador.setAttribute('aria-label', `${pendientes} pendientes`);
  sincronizarLista($('lista-preguntas'), preguntas, {
    clave: (q) => q.id,
    firma: (q) => JSON.stringify([q.estado, q.proyectada, q.alias, q.texto, q.estado === 'pendiente' && !desveladas.has(q.id)]),
    vacio: () => el('li', { clase: 'suave', texto: 'Sin preguntas por ahora.' }),
    actualizar: (nodo, q) => { const b = nodo.querySelector('.votos b'); if (b && b.textContent !== `▲ ${q.votos}`) b.textContent = `▲ ${q.votos}`; },
    crear: (q) => {
    const moderar = (accionModeracion, confirmar) => async () => {
      if (confirmar && !confirm(confirmar)) return;
      const r = await emitir('pregunta:moderar', { salaId, preguntaId: q.id, accion: accionModeracion });
      if (!r.ok) avisoSala(r.mensaje, 'error');
    };
    const velada = q.estado === 'pendiente' && !desveladas.has(q.id);
    const texto = el('div', { clase: `texto-plano${velada ? ' velo' : ''}`, texto: q.texto });
    return (el('li', { clase: `pregunta ${q.estado}` },
      el('div', { clase: 'votos' }, el('b', { texto: `▲ ${q.votos}` })),
      el('div', {}, texto, el('div', { clase: 'suave', texto: [q.alias ? `Alias: ${q.alias}` : 'Anónima', q.estado, q.proyectada ? 'proyectada' : ''].filter(Boolean).join(' · ') })),
      el('div', { clase: 'acciones' },
        velada ? el('button', { type: 'button', clase: 'mini secundario', 'data-slot': 'leer', texto: 'Leer', onclick: () => { desveladas.add(q.id); pintarPreguntas(estado.preguntas); } }) : null,
        q.estado === 'pendiente' ? el('button', { type: 'button', clase: 'mini', 'data-slot': 'aprobar', texto: 'Aprobar', onclick: moderar('aprobar') }) : null,
        q.estado !== 'oculta' ? el('button', { type: 'button', clase: 'mini', 'data-slot': 'proyeccion', texto: q.proyectada ? 'Quitar de la presentación' : 'Proyectar en la presentación', onclick: moderar(q.proyectada ? 'quitarProyeccion' : 'proyectar') }) : null,
        q.estado !== 'respondida' && q.estado !== 'oculta' ? el('button', { type: 'button', clase: 'mini secundario', 'data-slot': 'respondida', texto: 'Marcar respondida', onclick: moderar('respondida') }) : null,
        q.estado !== 'oculta' ? el('button', { type: 'button', clase: 'mini secundario', 'data-slot': 'ocultar', texto: 'Ocultar', onclick: moderar('ocultar') }) : el('button', { type: 'button', clase: 'mini secundario', 'data-slot': 'ocultar', texto: 'Restaurar', onclick: moderar('aprobar') }),
        el('button', { type: 'button', clase: 'mini peligro', 'data-slot': 'bloquear', texto: 'Bloquear autor', onclick: moderar('bloquearAutor', '¿Bloquear al autor? Sus preguntas se ocultan y no podrá seguir participando desde ese dispositivo.') }))));
    },
  });
}

// El interruptor muestra siempre el valor CONFIRMADO por el servidor: si lo rechaza o no responde,
// vuelve a ese valor (estado.sala) en lugar de quedar marcado con algo que no se aplicó.
for (const [id, campo, clave] of [['q-abiertas', 'abiertas', 'preguntasAbiertas'], ['q-premod', 'preModeracion', 'preModeracion']]) {
  $(id).addEventListener('change', async (ev) => {
    const r = await emitir('preguntas:ajustar', { salaId, [campo]: ev.target.checked });
    if (r.ok) return;
    if (estado) ev.target.checked = estado.sala[clave];
    avisoSala(`${r.mensaje}. El ajuste no se aplicó; se muestra el valor vigente.`, 'error');
  });
}

// ---------------- Composición de encuestas ----------------
function filaOpcion(valor = '') {
  const fila = el('div', { clase: 'fila' },
    el('input', { type: 'text', maxlength: 200, placeholder: 'Texto de la opción', 'aria-label': 'Opción', value: valor }),
    el('label', { clase: 'fila suave' }, el('input', { type: 'checkbox', 'aria-label': 'Correcta' }), 'Correcta'),
    el('button', { type: 'button', clase: 'mini secundario', 'aria-label': 'Quitar opción', texto: '×', onclick: () => {
      const filas = [...$('opciones').children];
      if (filas.length <= 2) return;
      const i = filas.indexOf(fila);
      fila.remove(); renombrar();
      // El botón enfocado desaparece: el foco pasa a la opción que ocupa su lugar (o a la anterior).
      const quedan = [...$('opciones').children];
      quedan[Math.min(i, quedan.length - 1)].querySelector('input[type=text]').focus();
    } }));
  return fila;
}
/** Etiquetas accesibles distintas por fila: «Opción A», «Respuesta correcta de A», «Quitar opción A». */
function renombrar() {
  [...$('opciones').children].forEach((f, i) => {
    const l = letra(i);
    const texto = f.querySelector('input[type=text]');
    texto.placeholder = `Opción ${l}`; texto.setAttribute('aria-label', `Opción ${l}`);
    f.querySelector('input[type=checkbox]').setAttribute('aria-label', `Respuesta correcta de ${l}`);
    f.querySelector('button').setAttribute('aria-label', `Quitar opción ${l}`);
  });
}
function reiniciarComposer() {
  $('form-encuesta').reset();
  $('opciones').replaceChildren(...[0, 1, 2, 3].map(() => filaOpcion()));
  renombrar();
}
/** Pregunta improvisada a medio escribir (texto, código, opciones, correctas marcadas o explicación). */
function hayBorrador() {
  return ['enunciado', 'codigo', 'explicacion'].some((id) => $(id).value.trim())
    || [...$('opciones').querySelectorAll('input')].some((i) => (i.type === 'checkbox' ? i.checked : i.value.trim()));
}
const descartarBorrador = () => !hayBorrador()
  || confirm('Hay una pregunta improvisada sin guardar. ¿Descartarla? Se borrarán su texto, las correctas marcadas y la explicación.');

/**
 * Abandonar la sala actual: sus soluciones privadas (memoria y sessionStorage), la tarjeta activa y el
 * formulario improvisado no pasan a la lista de salas ni a otra sala.
 */
function dejarSala() {
  clearTimeout(reintentoSeguir);
  salaId = ''; firmaActiva = ''; estado = null;
  aviso('aviso-enlace', '');
  olvidarSoluciones();
  reiniciarComposer();
  $('panel-activa').replaceChildren();
  history.replaceState(null, '', '/docente/');
}
$('btn-mas').addEventListener('click', () => { if ($('opciones').children.length < 8) { $('opciones').append(filaOpcion()); renombrar(); } });

function leerComposer() {
  const filas = [...$('opciones').children].map((f) => ({ texto: f.querySelector('input[type=text]').value.trim(), correcta: f.querySelector('input[type=checkbox]').checked }))
    .filter((o) => o.texto);
  const correctas = filas.flatMap((o, i) => (o.correcta ? [i] : []));
  const explicacion = $('explicacion').value.trim();
  return {
    encuesta: { enunciado: $('enunciado').value, codigo: $('codigo').value || undefined, tipo: $('tipo').value, opciones: filas.map((o) => o.texto) },
    solucion: correctas.length || explicacion ? { correctas, explicacion } : null,
  };
}
async function guardarEncuesta(abrir) {
  const { encuesta, solucion } = leerComposer();
  if (solucion && encuesta.tipo === 'unica' && solucion.correctas.length > 1) return aviso('error-encuesta', 'Una pregunta de selección única admite una sola respuesta correcta.', 'error');
  // Al servidor solo viaja la pregunta; la solución se queda en esta pestaña hasta revelarla.
  const r = await emitir('encuesta:crear', { salaId, encuesta, abrir });
  if (!r.ok) return aviso('error-encuesta', r.mensaje, 'error');
  if (solucion) recordarSolucion(r.encuesta.id, solucion);
  aviso('error-encuesta', '');
  reiniciarComposer();
  avisoSala(abrir ? 'Votación abierta.' : 'Pregunta guardada en «Preguntas de esta sesión».');
  if (abrir) $('composer').open = false;
}
$('form-encuesta').addEventListener('submit', (ev) => { ev.preventDefault(); guardarEncuesta(true); });
$('btn-guardar').addEventListener('click', () => guardarEncuesta(false));

// ---------------- Acciones de sala ----------------
$('btn-volver').addEventListener('click', () => { if (descartarBorrador()) { dejarSala(); listar(); } });
/** Confirma la copia solo si el portapapeles la aceptó; si no, deja el enlace seleccionado para copiarlo a mano. */
let relojEnlace = null;
$('btn-copiar').addEventListener('click', async () => {
  clearTimeout(relojEnlace);
  const enlace = $('enlace');
  try {
    if (!navigator.clipboard?.writeText) throw new Error('sin_portapapeles');
    await navigator.clipboard.writeText(enlace.textContent);
    aviso('aviso-enlace', 'Enlace copiado.', 'ok');
    relojEnlace = setTimeout(() => aviso('aviso-enlace', ''), 4000);
  } catch {
    const rango = document.createRange();
    rango.selectNodeContents(enlace);
    const seleccion = getSelection();
    seleccion.removeAllRanges(); seleccion.addRange(rango);
    aviso('aviso-enlace', 'No se pudo copiar automáticamente. El enlace quedó seleccionado: cópielo con Ctrl+C (⌘+C en Mac).', 'alerta');
  }
});
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
