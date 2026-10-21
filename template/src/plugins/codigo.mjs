/**
 * OpenClass: bloques de código del layout oc-l-code.
 * - Modo SCROLL (predeterminado): el <pre> conserva el programa completo dentro de la caja del
 *   layout (theme.css) y se desplaza en vertical y horizontal. Este plugin añade «Copiar código»,
 *   hace el bloque enfocable y evita cambios de diapositiva involuntarios: la rueda nunca navega,
 *   el gesto táctil queda bloqueado y el teclado desplaza el código mientras haya recorrido; al
 *   llegar al borde, la tecla vuelve a Reveal (un control remoto sigue avanzando).
 * - Modo PAGINACIÓN: data-oc-paginate="code" lo resuelve autoPaginar.mjs antes de renderizar.
 * Debe registrarse antes que RevealHighlight para leer el texto original del bloque.
 */
/** ¿Puede el bloque desplazarse en ese eje y sentido? Se prueba moviéndolo 1 px y restaurando:
 *  con el canal de la barra y el escalado de Reveal, scrollWidth − clientWidth no es fiable. */
function puedeMover(pre, eje, signo) {
  const prop = eje === 'x' ? 'scrollLeft' : 'scrollTop';
  const antes = pre[prop];
  pre[prop] = antes + signo;
  const cambio = pre[prop] !== antes;
  pre[prop] = antes;
  return cambio;
}
const TECLAS = {
  ArrowDown: (p) => puedeMover(p, 'y', 1),
  PageDown: (p) => puedeMover(p, 'y', 1),
  End: (p) => puedeMover(p, 'y', 1),
  ' ': (p, e) => puedeMover(p, 'y', e.shiftKey ? -1 : 1),
  ArrowUp: (p) => puedeMover(p, 'y', -1),
  PageUp: (p) => puedeMover(p, 'y', -1),
  Home: (p) => puedeMover(p, 'y', -1),
  ArrowRight: (p) => puedeMover(p, 'x', 1),
  ArrowLeft: (p) => puedeMover(p, 'x', -1),
};

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Contextos sin permiso de portapapeles (file://, iframes): copia clásica.
    const area = Object.assign(document.createElement('textarea'), { value: texto, readOnly: true });
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  }
}

/** Marca si el bloque tiene más contenido abajo (indicador «Desplaza para ver más»). */
function marcar(pre) {
  const resto = pre.scrollHeight - pre.clientHeight - pre.scrollTop;
  pre.parentElement.toggleAttribute('data-oc-mas-codigo', pre.clientHeight > 0 && resto > 4);
}

export const OpenClassCodigo = () => ({
  id: 'oc-codigo',
  init(deck) {
    const bloques = [...deck.getSlidesElement().querySelectorAll('section.oc-l-code > pre')];
    for (const pre of bloques) {
      const code = pre.querySelector('code');
      if (!code || code.classList.contains('mermaid')) continue;
      const fuente = code.textContent.replace(/\n$/, '');
      pre.tabIndex = 0;
      pre.dataset.preventSwipe = '';
      pre.setAttribute('role', 'region');
      pre.setAttribute('aria-label', 'Código fuente: usa la rueda o las flechas para desplazarte');
      pre.addEventListener('keydown', (e) => {
        const puede = TECLAS[e.key];
        if (puede && !e.altKey && !e.ctrlKey && !e.metaKey) {
          // Con recorrido: la tecla desplaza el código. En el borde: se suelta el foco antes de que
          // el evento llegue a Reveal (ignora teclas con un bloque enfocado) y la diapositiva avanza.
          if (puede(pre, e)) e.stopPropagation();
          else pre.blur();
        }
        if (e.key === 'Escape') pre.blur();
      });
      pre.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
      pre.addEventListener('scroll', () => marcar(pre), { passive: true });

      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'oc-copiar';
      boton.textContent = 'Copiar código';
      boton.setAttribute('aria-label', 'Copiar el código de esta diapositiva');
      boton.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && e.stopPropagation());
      boton.addEventListener('click', async () => {
        const ok = await copiarTexto(fuente);
        boton.textContent = ok ? '¡Copiado!' : 'No se pudo copiar';
        boton.dataset.estado = ok ? 'ok' : 'error';
        clearTimeout(boton.temporizador);
        boton.temporizador = setTimeout(() => { boton.textContent = 'Copiar código'; delete boton.dataset.estado; }, 1800);
      });
      pre.after(boton);
    }
    const actualizar = () => {
      for (const pre of deck.getCurrentSlide()?.querySelectorAll(':scope.oc-l-code > pre') || []) marcar(pre);
    };
    deck.on('ready', actualizar);
    deck.on('slidechanged', () => {
      if (document.activeElement?.matches?.('section.oc-l-code > pre')) document.activeElement.blur();
      actualizar();
    });
    deck.on('resize', actualizar);
  },
});
