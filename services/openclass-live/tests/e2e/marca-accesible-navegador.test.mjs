/**
 * Modo accesible de la marca en Chrome real (Node >= 22): `[data-font="accessible"]` aplica line-height y word-spacing
 * válidos (antes lineHeight/wordSpacing, propiedades CSS inexistentes que el navegador ignoraba) y mantiene OpenDyslexic
 * como selección opcional: sin el atributo, la fuente de lectura sigue siendo Atkinson Hyperlegible.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirNavegador } from '../../../../scripts/lib/chrome.mjs';
import { servir } from '../../../../scripts/lib/servidor.mjs';

test('el modo accesible aplica interlineado, espaciado y OpenDyslexic en estilos computados', async () => {
  const estatico = await servir(new URL('../../public', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'), { base: '/' });
  let nav;
  try {
    nav = await abrirNavegador({ ancho: 1280, alto: 800 });
    const pag = await nav.pagina();
    await pag.ir(`${estatico.url}index.html`);
    const leer = `(() => { const cs = getComputedStyle(document.documentElement), cb = getComputedStyle(document.body); return {
      fuente: cb.fontFamily, interlineado: cs.lineHeight, palabras: cs.wordSpacing, tamano: cs.fontSize,
      attr: document.documentElement.getAttribute('data-font') }; })()`;
    const base = await pag.evaluar(leer);
    assert.equal(base.attr, null);
    assert.match(base.fuente, /^"?Atkinson Hyperlegible/);
    await pag.evaluar(`document.documentElement.setAttribute('data-font', 'accessible')`);
    const acc = await pag.evaluar(leer);
    const px = parseFloat(acc.tamano);
    assert.match(acc.fuente, /^"?OpenDyslexic/, 'selección opcional de OpenDyslexic');
    assert.ok(Math.abs(parseFloat(acc.interlineado) - 1.85 * px) < 0.05, `line-height computado ${acc.interlineado} ≠ 1.85 × ${px}px`);
    assert.ok(Math.abs(parseFloat(acc.palabras) - 0.12 * px) < 0.05, `word-spacing computado ${acc.palabras} ≠ 0.12em`);
    assert.notEqual(acc.interlineado, base.interlineado);
    // La fuente accesible realmente se descarga (autoalojada), no cae a la de respaldo.
    const cargada = await pag.evaluar(`document.fonts.load('400 16px OpenDyslexic').then((f) => f.length > 0 && f[0].status === 'loaded')`);
    assert.equal(cargada, true);
  } finally { await nav?.cerrar(); await estatico.cerrar(); }
});
