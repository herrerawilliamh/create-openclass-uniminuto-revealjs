/**
 * Interact: página de cuenta (invitación, verificación de correo y recuperación).
 * Los enlaces del correo llevan el token en el FRAGMENTO (#invitacion=…): no viaja en la petición de la página,
 * no queda en registros del servidor ni en cabeceras Referer. Se lee una vez y se borra de la barra de direcciones.
 */
const $ = (id) => document.getElementById(id);
const VISTAS = ['v-invitacion', 'v-verificar', 'v-pendiente', 'v-olvide', 'v-restablecer', 'v-fin'];

function ver(id) {
  for (const v of VISTAS) $(v).classList.toggle('oculto', v !== id);
  const titulo = $(id).querySelector('h2');
  document.title = `Interact by WillEdTech · ${titulo.textContent || 'Su cuenta'}`;
  titulo.setAttribute('tabindex', '-1');
  titulo.focus({ preventScroll: true });
}
function aviso(id, texto, tipo = 'error') { const n = $(id); n.textContent = texto ?? ''; n.className = `aviso ${tipo}${texto ? '' : ' oculto'}`; }
async function post(ruta, cuerpo) {
  try {
    const r = await fetch(ruta, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
    return { estado: r.status, datos: await r.json().catch(() => ({})) };
  } catch { return { estado: 0, datos: {} }; }
}
function fin(titulo, texto) { $('t-fin').textContent = titulo; $('p-fin').textContent = texto; ver('v-fin'); }

const hash = new URLSearchParams(location.hash.slice(1));
const [clave, token] = ['invitacion', 'verificar', 'recuperar'].map((k) => [k, hash.get(k)]).find(([, v]) => v) ?? [];
const quiereOlvide = location.hash === '#olvide';
// El token no debe quedarse en el historial ni en la barra de direcciones.
if (token) history.replaceState(null, '', location.pathname);

let email = '';
if (clave === 'invitacion') {
  const r = await post('/api/auth/invitacion/validar', { token });
  if (r.estado === 200) {
    email = r.datos.email;
    $('inv-para').textContent = `Invitación para ${r.datos.email} (${r.datos.rol === 'superusuario' ? 'superusuario' : 'docente'}).`;
    ver('v-invitacion');
  } else fin('Invitación no válida', 'Este enlace ya se usó, venció o fue revocado. Pida una invitación nueva a quien administra el servicio.');
} else if (clave === 'verificar') {
  ver('v-verificar');
  const r = await post('/api/auth/verificar', { token });
  if (r.estado === 200) { $('t-ver').textContent = 'Correo confirmado'; $('p-verificar').textContent = 'Su cuenta está activa. Ya puede iniciar sesión.'; } else {
    $('t-ver').textContent = 'No se pudo confirmar';
    $('p-verificar').textContent = 'El enlace ya se usó o venció. Intente iniciar sesión: si su correo sigue sin verificar, podrá pedir otro enlace.';
  }
} else if (clave === 'recuperar') {
  const r = await post('/api/auth/restablecer/validar', { token });
  if (r.estado === 200) ver('v-restablecer'); else fin('Enlace no válido', 'Este enlace ya se usó o venció. Pida uno nuevo desde «¿Olvidó su contraseña?».');
} else if (quiereOlvide || location.hash === '#reenviar') {
  ver('v-olvide');
} else {
  fin('Su cuenta', 'Use el enlace del correo que recibió. Si no lo tiene, solicite una invitación a quien administra el servicio.');
}

$('f-invitacion').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if ($('i-pass').value !== $('i-pass2').value) { aviso('e-inv', 'Las contraseñas no coinciden.'); $('i-pass2').focus(); return; }
  const boton = ev.target.querySelector('button[type=submit]'); boton.disabled = true;
  const r = await post('/api/auth/invitacion/aceptar', { token, nombre: $('i-nombre').value, password: $('i-pass').value });
  boton.disabled = false;
  if (r.estado === 200) {
    $('i-pass').value = ''; $('i-pass2').value = '';
    $('p-pendiente').textContent = r.datos.correo === 'enviado'
      ? `Enviamos un enlace de confirmación a ${email}. Ábralo para activar su cuenta.`
      : 'Su cuenta se creó, pero este servicio no pudo enviar el correo de confirmación. Pida a quien administra el servicio que lo revise.';
    ver('v-pendiente');
  } else if (r.estado === 400 && r.datos.error === 'password') { aviso('e-inv', 'La contraseña debe tener al menos 12 caracteres.'); $('i-pass').focus(); } else if (r.estado === 0) aviso('e-inv', 'Sin conexión con el servidor. Inténtelo de nuevo.');
  else fin('Invitación no válida', 'Este enlace ya se usó, venció o fue revocado.');
});

$('a-reenviar').addEventListener('click', (ev) => { ev.preventDefault(); $('o-email').value = email; ver('v-olvide'); $('o-email').focus(); });

$('f-olvide').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const boton = ev.target.querySelector('button[type=submit]'); boton.disabled = true;
  const correo = $('o-email').value.trim();
  // Se piden ambos: recuperación (cuenta activa) o verificación (cuenta sin confirmar). La respuesta es idéntica.
  await Promise.all([post('/api/auth/olvide', { email: correo }), post('/api/auth/verificacion/reenviar', { email: correo })]);
  boton.disabled = false;
  fin('Revise su correo', 'Si la dirección corresponde a una cuenta, le enviamos las instrucciones. El enlace vence pronto y sirve una sola vez.');
});

$('f-restablecer').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if ($('r-pass').value !== $('r-pass2').value) { aviso('e-res', 'Las contraseñas no coinciden.'); $('r-pass2').focus(); return; }
  const boton = ev.target.querySelector('button[type=submit]'); boton.disabled = true;
  const r = await post('/api/auth/restablecer', { token, password: $('r-pass').value });
  boton.disabled = false;
  if (r.estado === 200) { $('r-pass').value = ''; $('r-pass2').value = ''; fin('Contraseña actualizada', 'Se cerraron sus otras sesiones. Inicie sesión con la nueva contraseña.'); } else if (r.estado === 400 && r.datos.error === 'password') aviso('e-res', 'La contraseña debe tener al menos 12 caracteres.');
  else if (r.estado === 0) aviso('e-res', 'Sin conexión con el servidor. Inténtelo de nuevo.');
  else fin('Enlace no válido', 'El enlace ya se usó o venció. Pida uno nuevo.');
});
