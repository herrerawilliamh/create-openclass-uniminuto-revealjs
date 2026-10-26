/**
 * Multimedia de la diapositiva actual, controlada desde Build Tech. Las órdenes se ejecutan SIEMPRE
 * sobre el reproductor de esta ventana (la que se comparte por Zoom); Build Tech no reproduce nada.
 *
 * - <video> y <audio>: reproducir, pausar, reiniciar, buscar, volumen y silencio, con su estado real.
 * - YouTube integrado: API oficial IFrame Player (https://www.youtube.com/iframe_api), que se descarga
 *   solo cuando Build Tech está abierto y la diapositiva tiene un video de YouTube. Para que el iframe
 *   acepte órdenes, la presentación añade enablejsapi=1 y origin a su URL al iniciar (antes de usarlo).
 * - Otros proveedores (Vimeo, actividades, sitios externos): «Control externo no disponible»; se usan
 *   con sus propios controles en la presentación. No se promete lo que el navegador no permite.
 */
const YOUTUBE = /^https:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\//i;
const API_YOUTUBE = 'https://www.youtube.com/iframe_api';
const PERMISOS_IFRAME = ['autoplay', 'encrypted-media', 'picture-in-picture', 'fullscreen'];

export const esYoutube = (url) => YOUTUBE.test(String(url ?? ''));

/** URL de YouTube con la API habilitada para esta página (idempotente). */
export function urlYoutubeControlable(url, origen) {
  const u = new URL(url);
  u.searchParams.set('enablejsapi', '1');
  u.searchParams.set('origin', origen);
  return u.toString();
}

/** Prepara los iframes de YouTube (src o data-src) para la API; se hace al iniciar, antes de usarlos. */
export function prepararYoutube(raiz, origen) {
  for (const f of raiz.querySelectorAll('iframe')) {
    for (const atributo of ['data-src', 'src']) {
      const url = f.getAttribute(atributo);
      if (!esYoutube(url)) continue;
      const nueva = urlYoutubeControlable(url, origen);
      if (nueva === url) continue;
      const permitidos = new Set((f.getAttribute('allow') ?? '').split(';').map((p) => p.trim()).filter(Boolean));
      for (const p of PERMISOS_IFRAME) permitidos.add(p);
      f.setAttribute('allow', [...permitidos].join('; '));
      f.setAttribute(atributo, nueva);
    }
  }
}

let cargaYoutube = null;
function apiYoutube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  cargaYoutube ??= new Promise((resolve, reject) => {
    const previo = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previo?.(); resolve(window.YT); };
    const s = document.createElement('script');
    s.src = API_YOUTUBE;
    s.async = true;
    s.onerror = () => { cargaYoutube = null; reject(new Error('sin_api')); };
    document.head.append(s);
    setTimeout(() => reject(new Error('sin_api')), 15_000);
  });
  return cargaYoutube;
}

const titulo = (n, i) => (n.getAttribute('aria-label') || n.getAttribute('title') || n.closest('[data-oc-nota]')?.dataset.ocNota || `${n.tagName === 'AUDIO' ? 'Audio' : 'Video'} ${i + 1}`).trim().slice(0, 120);
const redondo = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

export function crearMultimedia({ deck, alCambiar }) {
  let actual = null; // { diapositiva, medios: [{ id, nodo, tipo, ... }] }
  let activo = false; // Build Tech abierto: solo entonces se enlazan reproductores y se informa estado
  const quitar = [];

  const avisar = () => { try { alCambiar(); } catch { /* sin Build Tech */ } };

  function soltar() {
    while (quitar.length) quitar.pop()();
    for (const m of actual?.medios ?? []) {
      if (m.tipo === 'youtube' && m.player) {
        // Al salir de la diapositiva un video de YouTube no sigue sonando por detrás.
        try { if (m.player.getPlayerState?.() === 1) m.player.pauseVideo(); } catch { /* reproductor ya descargado */ }
      }
    }
    actual = null;
  }

  function enlazarHtml5(m) {
    const n = m.nodo;
    for (const ev of ['play', 'playing', 'pause', 'ended', 'volumechange', 'loadedmetadata', 'durationchange', 'seeked', 'error', 'waiting']) {
      n.addEventListener(ev, avisar);
      quitar.push(() => n.removeEventListener(ev, avisar));
    }
    let ultimo = 0;
    const tiempo = () => { const ahora = Date.now(); if (ahora - ultimo > 900) { ultimo = ahora; avisar(); } };
    n.addEventListener('timeupdate', tiempo);
    quitar.push(() => n.removeEventListener('timeupdate', tiempo));
  }

  async function enlazarYoutube(m) {
    m.estadoApi = 'cargando';
    try {
      const YT = await apiYoutube();
      if (actual?.medios[m.indice] !== m) return;
      await new Promise((resolve, reject) => {
        const reloj = setTimeout(() => reject(new Error('sin_respuesta')), 15_000);
        // youtube-nocookie.com: la API debe hablar con ese mismo origen.
        const host = new URL(m.nodo.src).origin;
        m.player = new YT.Player(m.nodo, { host, events: {
          onReady: () => { clearTimeout(reloj); resolve(); },
          onStateChange: avisar,
          onError: (e) => { m.errorYt = e?.data; avisar(); },
        } });
      });
      m.estadoApi = 'listo';
      const sondeo = setInterval(() => { if (m.player?.getPlayerState?.() === 1) avisar(); }, 1000);
      quitar.push(() => clearInterval(sondeo));
    } catch {
      m.estadoApi = 'error';
    }
    avisar();
  }

  function enlazar() {
    const diapositiva = deck.getCurrentSlide();
    if (actual?.diapositiva === diapositiva) return;
    soltar();
    if (!diapositiva) return;
    const medios = [...diapositiva.querySelectorAll('video, audio, iframe')].filter((n) => !n.closest('aside.notes, .oc-live-participa')).map((nodo, indice) => {
      const ancla = nodo.closest('[data-oc-nota]')?.dataset.ocNota ?? null;
      const base = { id: `m${indice}`, indice, nodo, ancla, titulo: titulo(nodo, indice) };
      if (nodo.tagName !== 'IFRAME') return { ...base, tipo: nodo.tagName === 'AUDIO' ? 'audio' : 'video' };
      const src = nodo.getAttribute('src') || nodo.getAttribute('data-src') || '';
      if (esYoutube(src)) return { ...base, tipo: 'youtube', titulo: (nodo.getAttribute('title') || 'Video de YouTube').slice(0, 120) };
      return { ...base, tipo: 'externo', titulo: (nodo.getAttribute('title') || 'Contenido integrado').slice(0, 120) };
    });
    actual = { diapositiva, medios };
    for (const m of medios) {
      if (m.tipo === 'video' || m.tipo === 'audio') enlazarHtml5(m);
      else if (m.tipo === 'youtube') enlazarYoutube(m);
    }
  }

  function describir(m) {
    const base = { id: m.id, tipo: m.tipo, titulo: m.titulo, ancla: m.ancla };
    if (m.tipo === 'video' || m.tipo === 'audio') {
      const n = m.nodo;
      return { ...base, control: true, reproduciendo: !n.paused && !n.ended, terminado: n.ended, actual: redondo(n.currentTime),
        duracion: Number.isFinite(n.duration) ? redondo(n.duration) : null, volumen: redondo(n.volume), silencio: n.muted,
        listo: n.readyState >= 1, error: n.error ? 'El navegador no pudo cargar este archivo.' : null };
    }
    if (m.tipo === 'youtube') {
      if (m.estadoApi !== 'listo') {
        return { ...base, control: false, preparando: m.estadoApi === 'cargando',
          motivo: m.estadoApi === 'cargando' ? 'Preparando el control del video de YouTube…' : 'Control externo no disponible: no se pudo cargar la API de YouTube (revise la conexión) o el video no lo permite. Use los controles del video en la presentación.' };
      }
      const p = m.player;
      const estado = p.getPlayerState?.();
      return { ...base, control: true, reproduciendo: estado === 1 || estado === 3, terminado: estado === 0, actual: redondo(p.getCurrentTime?.()),
        duracion: redondo(p.getDuration?.()) || null, volumen: redondo((p.getVolume?.() ?? 100) / 100), silencio: Boolean(p.isMuted?.()), listo: true,
        error: m.errorYt ? 'YouTube no permite reproducir este video integrado (restricción del propietario o enlace no válido).' : null };
    }
    return { ...base, control: false, motivo: 'Control externo no disponible para este contenido: use sus propios controles en la presentación.' };
  }

  const BLOQUEO = 'El navegador bloqueó la reproducción con sonido: pulse una vez sobre la presentación (o sobre el video) y vuelva a intentarlo, o active «Silenciar» y reproduzca.';

  async function ejecutar({ medio, accion, valor }) {
    enlazar();
    const m = actual?.medios.find((x) => x.id === medio);
    if (!m) return { ok: false, mensaje: 'Ese recurso ya no está en la diapositiva actual.' };
    if (m.tipo === 'video' || m.tipo === 'audio') {
      const n = m.nodo;
      try {
        if (accion === 'reproducir') await n.play();
        else if (accion === 'pausar') n.pause();
        else if (accion === 'reiniciar') n.currentTime = 0;
        else if (accion === 'buscar') n.currentTime = Math.min(valor, Number.isFinite(n.duration) ? n.duration : valor);
        else if (accion === 'volumen') { n.volume = valor; if (valor > 0 && n.muted) n.muted = false; }
        else if (accion === 'silencio') n.muted = valor;
      } catch (e) {
        avisar();
        return { ok: false, mensaje: e?.name === 'NotAllowedError' ? BLOQUEO : 'El navegador no pudo reproducir este archivo.' };
      }
      avisar();
      return { ok: true };
    }
    if (m.tipo === 'youtube' && m.estadoApi === 'listo') {
      const p = m.player;
      if (accion === 'reproducir') p.playVideo();
      else if (accion === 'pausar') p.pauseVideo();
      else if (accion === 'reiniciar') p.seekTo(0, true);
      else if (accion === 'buscar') p.seekTo(valor, true);
      else if (accion === 'volumen') { p.setVolume(Math.round(valor * 100)); if (valor > 0) p.unMute(); }
      else if (accion === 'silencio') { if (valor) p.mute(); else p.unMute(); }
      if (accion === 'reproducir') {
        // YouTube no confirma por adelantado: si en 2,5 s no arrancó, el navegador lo impidió.
        await new Promise((r) => setTimeout(r, 2500));
        avisar();
        const e = p.getPlayerState?.();
        if (e !== 1 && e !== 3) return { ok: false, mensaje: 'YouTube no inició la reproducción: el navegador puede exigir pulsar una vez el video en la presentación.' };
      }
      setTimeout(avisar, 300);
      return { ok: true };
    }
    return { ok: false, mensaje: describir(m).motivo };
  }

  return {
    /** Build Tech abierto (true) o cerrado (false): sin Build Tech no se carga la API de YouTube. */
    activar(si) {
      if (si === activo) return;
      activo = si;
      if (si) enlazar(); else soltar();
    },
    cambioDeDiapositiva() { if (activo) enlazar(); },
    estado() { if (!activo) return []; enlazar(); return actual?.medios.map(describir) ?? []; },
    ejecutar,
  };
}
