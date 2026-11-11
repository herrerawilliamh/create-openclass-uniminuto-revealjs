/** Interact: aprobación del vínculo con OpenClass local desde el navegador del sistema (sin tokens en la URL). */
const $ = (id) => document.getElementById(id);
let csrf = '';
function ver(id) {
  for (const v of ['v-entrar', 'v-codigo', 'v-confirmar', 'v-ok']) $(v).classList.toggle('oculto', v !== id);
  const h = $(id).querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true });
}
const aviso = (texto) => { const n = $('e-codigo'); n.textContent = texto; n.classList.toggle('oculto', !texto); };

try {
  const r = await fetch('/api/docente/sesion', { credentials: 'same-origin' });
  const d = await r.json();
  if (d.autenticado) {
    csrf = d.csrf;
    $('quien').textContent = `Sesión de ${d.usuario?.nombre || d.usuario?.email || 'su cuenta'}.`;
    ver('v-codigo');
  } else ver('v-entrar');
} catch { ver('v-entrar'); }

$('codigo').addEventListener('input', (ev) => {
  const limpio = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  ev.target.value = limpio.length > 4 ? `${limpio.slice(0, 4)}-${limpio.slice(4)}` : limpio;
});
async function enviarCodigo(confirmar) {
  const r = await fetch('/api/vinculo/aprobar', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-OC-CSRF': csrf }, body: JSON.stringify({ codigo: $('codigo').value, confirmar }) });
  return { estado: r.status, datos: await r.json().catch(() => ({})) };
}
const errorTexto = (e) => (e === 404 ? 'Ese código no existe o ya venció (dura 5 minutos). Genere uno nuevo en la presentación.' : e === 401 || e === 403 ? 'La sesión venció. Inicie sesión de nuevo.' : e === 429 ? 'Demasiados intentos. Espere un momento.' : 'No se pudo aprobar. Inténtelo de nuevo.');
$('f-codigo').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  aviso('');
  const boton = ev.target.querySelector('button[type=submit]'); boton.disabled = true;
  try {
    const { estado, datos } = await enviarCodigo(false);
    if (estado === 200 && datos.pendiente) {
      const c = datos.contexto ?? {};
      const dl = $('contexto'); dl.replaceChildren();
      for (const [k, v] of [['Origen declarado', c.origen || 'desconocido'], ['Solicitado hace', `${c.hace ?? 0} s`], ['Red aproximada (no verificada)', c.red || 'desconocida']]) {
        const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd);
      }
      ver('v-confirmar'); return;
    }
    aviso(errorTexto(estado));
  } catch { aviso('Sin conexión con el servidor.'); } finally { boton.disabled = false; }
});
$('b-cancelar').addEventListener('click', () => { $('codigo').value = ''; ver('v-codigo'); });
$('b-confirmar').addEventListener('click', async (ev) => {
  ev.target.disabled = true;
  try {
    const { estado } = await enviarCodigo(true);
    if (estado === 200) { ver('v-ok'); return; }
    ver('v-codigo'); aviso(errorTexto(estado));
  } catch { ver('v-codigo'); aviso('Sin conexión con el servidor.'); } finally { ev.target.disabled = false; }
});
