/**
 * Encuesta de una diapositiva (`.oc-live-encuesta`), única fuente de autoría. La usan OpenClass Live
 * (carga mínima que sale del computador al abrir la votación) y Build Tech (solución privada del
 * docente, que nunca sale del computador). Sin dependencias ni estilos: se importa aunque Live esté apagado.
 *
 *   <div class="oc-live-encuesta" data-tipo="unica" data-correctas="B">
 *     <p class="oc-live-enunciado">¿…?</p>
 *     <ol class="oc-live-opciones"><li>…</li><li>…</li></ol>
 *     <div class="oc-live-explicacion">Se muestra solo al revelar.</div>
 *   </div>
 */

/** Texto de un nodo con sus bloques <pre> como ``` (el servidor y los estudiantes lo muestran sin ejecutarlo). */
export function textoDe(nodo) {
  if (!nodo) return '';
  let salida = '';
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === 3) salida += hijo.textContent;
    else if (hijo.nodeType === 1 && hijo.tagName === 'PRE') salida += `\n\`\`\`\n${hijo.textContent.replace(/\n$/, '')}\n\`\`\`\n`;
    else if (hijo.nodeType === 1 && /^(P|DIV|LI|BR|H\d)$/.test(hijo.tagName)) salida += `${textoDe(hijo)}\n`;
    else if (hijo.nodeType === 1) salida += textoDe(hijo);
  }
  return salida.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Construye la carga mínima de una encuesta a partir de su elemento. Es la ÚNICA información de la
 * presentación que sale del computador del docente, y solo al abrir la votación.
 */
export function extraerEncuesta(elemento) {
  const enunciadoNodo = elemento.querySelector('.oc-live-enunciado');
  const codigoNodo = enunciadoNodo?.querySelector('pre') ?? elemento.querySelector(':scope > pre');
  const enunciadoCopia = enunciadoNodo?.cloneNode(true);
  enunciadoCopia?.querySelectorAll('pre').forEach((p) => p.remove());
  const opciones = [...elemento.querySelectorAll('.oc-live-opciones > li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const tipo = elemento.dataset.tipo === 'multiple' ? 'multiple' : 'unica';
  const correctas = String(elemento.dataset.correctas ?? '').split(/[\s,]+/).filter(Boolean).map((c) => {
    const n = /^\d+$/.test(c) ? Number(c) - 1 : c.toUpperCase().charCodeAt(0) - 65;
    return n;
  }).filter((n) => Number.isInteger(n) && n >= 0 && n < opciones.length);
  const explicacion = textoDe(elemento.querySelector('.oc-live-explicacion'));
  return {
    enunciado: textoDe(enunciadoCopia),
    ...(codigoNodo ? { codigo: codigoNodo.textContent.replace(/\n$/, '') } : {}),
    tipo,
    opciones,
    correctas: [...new Set(correctas)],
    ...(explicacion ? { explicacion } : {}),
  };
}
