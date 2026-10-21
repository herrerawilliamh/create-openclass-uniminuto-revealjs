/**
 * OpenClass: diagramas Mermaid. Acepta bloques ```mermaid y <div class="mermaid">.
 * mermaid se importa bajo demanda (solo si la presentación tiene diagramas) y cada diagrama se
 * genera con mermaid.render(), que mide el texto en un contenedor propio: las diapositivas que
 * Reveal mantiene con display:none no permiten medirlo.
 */
let contador = 0;

export const OpenClassMermaid = () => ({
  id: 'oc-mermaid',
  // Debe registrarse antes que RevealHighlight: los bloques ```mermaid dejan de ser <pre><code>.
  async init(deck) {
    const raiz = deck.getSlidesElement();
    for (const code of raiz.querySelectorAll('pre > code:is(.mermaid, .language-mermaid)')) {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = code.textContent;
      code.parentElement.replaceWith(div);
    }
    const bloques = [...raiz.querySelectorAll('div.mermaid:not([data-processed])')];
    if (!bloques.length) return;
    try {
      const { default: mermaid } = await import('mermaid');
      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        fontFamily: "'Atkinson Hyperlegible', Arial, sans-serif",
        themeVariables: {
          fontSize: '22px',
          primaryColor: '#e8edf7',
          primaryBorderColor: '#243764',
          primaryTextColor: '#233660',
          secondaryColor: '#fff4c2',
          tertiaryColor: '#ffffff',
          lineColor: '#243764',
        },
      });
      for (const bloque of bloques) {
        try {
          const { svg } = await mermaid.render(`oc-mermaid-${++contador}`, bloque.textContent.trim());
          bloque.innerHTML = svg;
        } catch (error) {
          bloque.classList.add('oc-mermaid-error');
          console.warn('[OpenClass] Diagrama Mermaid no válido:', error);
        }
        bloque.dataset.processed = 'true';
      }
    } catch (error) {
      console.warn('[OpenClass] No se pudo cargar Mermaid:', error);
    }
  },
});
