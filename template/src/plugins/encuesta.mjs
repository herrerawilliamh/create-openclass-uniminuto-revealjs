/**
 * Encuesta de una diapositiva (`.oc-live-encuesta`), única fuente de autoría. La usan OpenClass Live
 * (carga pública que sale del computador al abrir la votación; la solución sale solo al revelarla) y
 * Build Tech (solución privada del docente). Sin dependencias: se importa aunque Live esté apagado.
 * Las reglas que ocultan `.oc-live-explicacion` en pantalla y en el PDF están en theme.css (siempre cargado).
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
 * Lee la encuesta completa de su elemento, solución incluida (correctas y explicación). Esta lectura
 * NUNCA se envía tal cual: `separarSolucion()` decide qué sale y cuándo.
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

/**
 * Separa la carga pública (enunciado, código, tipo y opciones: lo único que sale del computador al
 * abrir la votación) de la solución, que se queda aquí hasta que el docente pulsa «Revelar».
 * `solucion` es null si la diapositiva no define correcta ni explicación.
 */
export function separarSolucion({ correctas = [], explicacion = '', ...publica }) {
  return { publica, solucion: correctas.length || explicacion ? { correctas, explicacion } : null };
}
