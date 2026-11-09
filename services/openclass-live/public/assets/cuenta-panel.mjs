/**
 * Interact: «Mis sesiones» (docente) / «Todas las sesiones» (superusuario) y panel de administración.
 * El rol se usa solo para mostrar u ocultar controles; la autorización real ocurre en el servidor.
 * Todo texto recibido se inserta con textContent (helper `el`), nunca como HTML.
 */
import { el, mensajeHttp } from './comun.mjs';

const $ = (id) => document.getElementById(id);
const ESTADOS = { activa: 'Activa', finalizada: 'Finalizada', vencida: 'Vencida', interrumpida: 'Interrumpida' };
const fecha = (ms) => (ms ? new Date(ms).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const dia = (v, finDelDia = false) => (v ? new Date(`${v}T${finDelDia ? '23:59:59.999' : '00:00:00'}`).toISOString() : '');
const POR_PAGINA = 50;

export function crearPanelCuenta({ api, mostrar }) {
  let usuario = null;
  let desplazamiento = 0;
  let total = 0;
  const admin = () => usuario?.rol === 'superusuario';
  const aviso = (id, texto, tipo = '') => { const n = $(id); n.textContent = texto ?? ''; n.className = `aviso ${tipo}${texto ? '' : ' oculto'}`; };

  function pestana(actual) {
    for (const [id, vista] of [['ir-salas', 'salas'], ['ir-historial', 'historial'], ['ir-admin', 'admin']]) {
      if (vista === actual) $(id).setAttribute('aria-current', 'page'); else $(id).removeAttribute('aria-current');
    }
  }

  function configurar(u) {
    usuario = u;
    $('chip-usuario').textContent = u.nombre ? `${u.nombre} · ${u.rol === 'superusuario' ? 'superusuario' : 'docente'}` : u.email;
    $('chip-usuario').title = u.email;
    $('chip-usuario').classList.remove('oculto');
    $('ir-admin').classList.toggle('oculto', !admin());
    $('ir-historial').textContent = admin() ? 'Todas las sesiones' : 'Mis sesiones';
    $('t-historial').textContent = admin() ? 'Todas las sesiones' : 'Mis sesiones';
    $('alcance-historial').textContent = admin() ? 'Historial global de todas las cuentas.' : 'Solo se muestran las sesiones de su cuenta.';
    $('campo-usuario').classList.toggle('oculto', !admin());
    for (const c of document.querySelectorAll('.col-docente')) c.classList.toggle('oculto', !admin());
  }
  function limpiar() {
    usuario = null;
    $('chip-usuario').classList.add('oculto');
    $('chip-usuario').textContent = '';
    $('nav-vistas').classList.add('oculto');
    for (const id of ['tabla-historial']) $(id).querySelector('tbody').replaceChildren();
    for (const id of ['cuerpo-detalle', 'tabla-usuarios', 'tabla-auditoria', 'lista-invitaciones']) $(id).replaceChildren();
    $('enlace-manual').classList.add('oculto'); $('inv-enlace').value = '';
    $('detalle-historial').classList.add('oculto');
  }

  // ---------------- Historial ----------------
  function consulta() {
    const p = new URLSearchParams();
    const poner = (k, v) => { if (v) p.set(k, v); };
    poner('q', $('f-q').value.trim());
    poner('estado', $('f-estado').value);
    poner('desde', dia($('f-desde').value));
    poner('hasta', dia($('f-hasta').value, true));
    if (admin()) poner('usuario', $('f-usuario').value.trim());
    return p;
  }

  async function cargarHistorial() {
    const p = consulta();
    p.set('desplazamiento', String(desplazamiento));
    const r = await api(`/api/historial?${p}`);
    const cuerpo = $('tabla-historial').querySelector('tbody');
    if (r.estado !== 200) { aviso('aviso-historial', mensajeHttp(r), 'alerta'); return; }
    aviso('aviso-historial', '');
    total = r.datos.total;
    cuerpo.replaceChildren();
    if (!r.datos.filas.length) cuerpo.append(el('tr', {}, el('td', { colspan: admin() ? 7 : 6, clase: 'suave', texto: 'No hay sesiones que coincidan.' })));
    for (const f of r.datos.filas) {
      cuerpo.append(el('tr', {},
        el('th', { scope: 'row', texto: f.titulo || 'Sin título' }),
        admin() ? el('td', { texto: f.propietarioNombre ? `${f.propietarioNombre} (${f.propietarioEmail})` : f.propietarioEmail }) : null,
        el('td', {}, el('span', { clase: `estado-chip ${f.estado}`, texto: ESTADOS[f.estado] ?? f.estado })),
        el('td', { texto: fecha(f.creada) }),
        el('td', { texto: String(f.participantes) }),
        el('td', { texto: String(f.actividades) }),
        el('td', {}, el('div', { clase: 'acciones-fila' },
          el('button', { type: 'button', clase: 'mini secundario', texto: 'Ver detalle', 'aria-label': `Ver detalle de ${f.titulo || 'sesión sin título'}`, onclick: () => verDetalle(f.id) }),
          f.estado === 'activa' ? null : el('button', { type: 'button', clase: 'mini secundario', texto: 'Eliminar', 'aria-label': `Eliminar ${f.titulo || 'sesión sin título'}`, onclick: () => eliminar(f) })))));
    }
    const desde = total ? desplazamiento + 1 : 0;
    $('hist-pagina').textContent = `${desde}–${Math.min(total, desplazamiento + POR_PAGINA)} de ${total}`;
    $('hist-anterior').disabled = desplazamiento === 0;
    $('hist-siguiente').disabled = desplazamiento + POR_PAGINA >= total;
  }

  async function verDetalle(id) {
    const r = await api(`/api/historial/detalle?id=${encodeURIComponent(id)}`);
    if (r.estado !== 200) { aviso('aviso-historial', r.estado === 404 ? 'Esa sesión ya no está disponible.' : mensajeHttp(r), 'alerta'); return; }
    const d = r.datos;
    const caja = $('cuerpo-detalle');
    caja.replaceChildren(
      el('p', { clase: 'suave', texto: `${ESTADOS[d.estado] ?? d.estado} · creada ${fecha(d.creada)} · ${d.cerrada ? `cerrada ${fecha(d.cerrada)}` : 'sin cierre registrado'}` }),
      el('p', { texto: `${d.participantes} participantes · ${d.preguntas} preguntas de estudiantes${admin() ? ` · docente: ${d.propietarioEmail}` : ''}` }),
      d.estado === 'interrumpida' ? el('p', { clase: 'aviso alerta', texto: 'El servicio se reinició mientras esta sala estaba abierta. La sala no se puede recuperar; se conservan los datos del último punto de control.' }) : null,
      d.actividades.length ? null : el('p', { clase: 'suave', texto: 'Sin actividades guardadas (la sala se creó sin conservar resultados o no tuvo votaciones).' }),
      ...d.actividades.map((a) => el('section', { clase: 'detalle-actividad' },
        el('h4', { texto: a.enunciado }),
        ...a.rondas.map((ronda) => el('table', {},
          el('caption', { clase: 'suave', texto: `Ronda ${ronda.numero} · ${ronda.respondientes} respuestas${a.publicados ? ' · resultados publicados' : ''}` }),
          el('thead', {}, el('tr', {}, el('th', { scope: 'col', texto: 'Opción' }), el('th', { scope: 'col', texto: 'Respuestas' }), el('th', { scope: 'col', texto: '%' }))),
          el('tbody', {}, ...a.opciones.map((o, i) => el('tr', {}, el('td', { texto: o }), el('td', { texto: String(ronda.conteos[i] ?? 0) }), el('td', { texto: `${ronda.porcentajes[i] ?? 0}` })))))))));
    $('t-detalle').textContent = d.titulo || 'Sesión sin título';
    $('detalle-historial').classList.remove('oculto');
    $('detalle-historial').focus();
  }

  async function eliminar(f) {
    if (!window.confirm(`¿Eliminar «${f.titulo || 'Sin título'}» del historial? No se puede deshacer.`)) return;
    const r = await api('/api/historial/eliminar', { id: f.id });
    if (r.estado !== 200) { aviso('aviso-historial', r.estado === 404 ? 'No se pudo eliminar: la sesión no existe o sigue activa.' : mensajeHttp(r), 'alerta'); return; }
    aviso('aviso-historial', 'Sesión eliminada del historial.', 'ok');
    $('detalle-historial').classList.add('oculto');
    await cargarHistorial();
  }

  // ---------------- Administración ----------------
  async function cargarAdmin() {
    const [u, i, a] = await Promise.all([api('/api/admin/usuarios'), api('/api/admin/invitaciones'), api('/api/admin/auditoria')]);
    if (u.estado !== 200 || i.estado !== 200) { aviso('aviso-admin', mensajeHttp(u.estado !== 200 ? u : i), 'alerta'); return; }
    const real = i.datos.correo?.real;
    $('estado-correo').textContent = real ? 'Correo SMTP configurado: la invitación se envía por correo.'
      : 'El envío de correo NO está configurado en este servicio: tras crear la invitación recibirá un enlace para entregarlo usted mismo.';
    $('tabla-usuarios').replaceChildren(...u.datos.usuarios.map((x) => el('tr', {},
      el('th', { scope: 'row', texto: x.nombre || '—' }), el('td', { texto: x.email }), el('td', { texto: x.rol }),
      el('td', { texto: x.estado === 'activo' ? (x.emailVerificado ? 'Activo' : 'Sin verificar') : 'Suspendido' }),
      el('td', {}, x.id === usuario.id ? el('span', { clase: 'suave', texto: 'Su cuenta' }) : el('button', {
        type: 'button', clase: 'mini secundario', texto: x.estado === 'activo' ? 'Suspender' : 'Reactivar', 'aria-label': `${x.estado === 'activo' ? 'Suspender' : 'Reactivar'} a ${x.email}`,
        onclick: () => cambiarEstado(x),
      })))));
    const lista = $('lista-invitaciones');
    lista.replaceChildren();
    if (!i.datos.invitaciones.length) lista.append(el('li', { clase: 'suave', texto: 'Aún no hay invitaciones.' }));
    for (const v of i.datos.invitaciones) {
      lista.append(el('li', { clase: 'pregunta' },
        el('div', {}, el('div', { texto: v.email }), el('div', { clase: 'suave', texto: `${v.rol} · ${v.estado} · vence ${fecha(v.vence)}` })),
        v.estado === 'pendiente' ? el('div', { clase: 'acciones' }, el('button', { type: 'button', clase: 'mini secundario', texto: 'Revocar', 'aria-label': `Revocar la invitación de ${v.email}`, onclick: () => revocar(v) })) : null));
    }
    $('tabla-auditoria').replaceChildren(...(a.estado === 200 ? a.datos.eventos : []).slice(0, 100).map((e) => el('tr', {},
      el('td', { texto: fecha(e.ts) }), el('td', { texto: e.actorEmail ?? 'sistema' }), el('td', { texto: e.accion }), el('td', { texto: e.objetivo }))));
  }
  async function cambiarEstado(x) {
    const suspender = x.estado === 'activo';
    if (suspender && !window.confirm(`¿Suspender a ${x.email}? Se cerrarán todas sus sesiones.`)) return;
    const r = await api('/api/admin/usuarios/estado', { id: x.id, estado: suspender ? 'suspendido' : 'activo' });
    aviso('aviso-admin', r.estado === 200 ? `${x.email}: ${suspender ? 'suspendido' : 'reactivado'}.` : mensajeHttp(r), r.estado === 200 ? 'ok' : 'alerta');
    await cargarAdmin();
  }
  async function revocar(v) {
    const r = await api('/api/admin/invitaciones/revocar', { id: v.id });
    aviso('aviso-admin', r.estado === 200 ? `Invitación a ${v.email} revocada.` : mensajeHttp(r), r.estado === 200 ? 'ok' : 'alerta');
    await cargarAdmin();
  }

  $('form-invitar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = ev.submitter ?? $('form-invitar').querySelector('button[type=submit]');
    boton.disabled = true;
    const r = await api('/api/admin/invitaciones', { email: $('inv-email').value.trim(), rol: $('inv-rol').value });
    boton.disabled = false;
    $('enlace-manual').classList.add('oculto'); $('inv-enlace').value = '';
    if (r.estado === 201) {
      const cuando = { enviado: 'Invitación enviada por correo.', simulado: 'Invitación creada (correo SIMULADO: no salió ningún mensaje).', desactivado: 'Invitación creada. El correo no está configurado: entregue el enlace usted mismo.', fallido: 'Invitación creada, pero el correo NO pudo entregarse. Entregue el enlace usted mismo.' }[r.datos.correo];
      aviso('aviso-admin', `${cuando} Vence ${fecha(r.datos.vence)}.`, r.datos.correo === 'enviado' ? 'ok' : 'alerta');
      if (r.datos.enlaceManual) { $('inv-enlace').value = r.datos.enlaceManual; $('enlace-manual').classList.remove('oculto'); }
      $('inv-email').value = '';
    } else if (r.estado === 409) aviso('aviso-admin', 'Esa persona ya tiene una cuenta activa.', 'alerta');
    else if (r.estado === 400) aviso('aviso-admin', 'Revise la dirección de correo.', 'alerta');
    else aviso('aviso-admin', mensajeHttp(r), 'alerta');
    await cargarAdmin();
  });
  $('inv-enlace').addEventListener('focus', (ev) => ev.target.select());
  $('btn-retencion').addEventListener('click', async () => {
    if (!window.confirm('Se eliminarán de forma permanente los registros que superen el plazo de conservación. ¿Continuar?')) return;
    const r = await api('/api/admin/retencion', {});
    aviso('aviso-admin', r.estado === 200 ? `Política aplicada: ${r.datos.historial} sesiones y ${r.datos.auditoria} eventos de auditoría eliminados.` : mensajeHttp(r), r.estado === 200 ? 'ok' : 'alerta');
    await cargarAdmin();
  });

  // ---------------- Navegación ----------------
  $('ir-salas').addEventListener('click', () => { pestana('salas'); mostrar('vista-salas'); });
  $('ir-historial').addEventListener('click', async () => { pestana('historial'); mostrar('vista-historial'); desplazamiento = 0; await cargarHistorial(); });
  $('ir-admin').addEventListener('click', async () => { pestana('admin'); mostrar('vista-admin'); await cargarAdmin(); });
  $('form-filtros').addEventListener('submit', (ev) => { ev.preventDefault(); desplazamiento = 0; cargarHistorial(); });
  $('hist-anterior').addEventListener('click', () => { desplazamiento = Math.max(0, desplazamiento - POR_PAGINA); cargarHistorial(); });
  $('hist-siguiente').addEventListener('click', () => { desplazamiento += POR_PAGINA; cargarHistorial(); });
  $('cerrar-detalle').addEventListener('click', () => { $('detalle-historial').classList.add('oculto'); $('ir-historial').focus(); });
  $('btn-csv').addEventListener('click', () => {
    // Descarga directa autenticada por la cookie: el servidor aplica el mismo alcance que la lista.
    window.location.assign(`/api/historial.csv?${consulta()}`);
  });

  return { configurar, limpiar, pestana };
}
