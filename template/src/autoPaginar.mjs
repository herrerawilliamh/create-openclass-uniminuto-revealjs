/**
 * OpenClass: paginación conservadora para Markdown de Reveal.
 * Opt-in por diapositiva: data-oc-paginate="auto" (listas) o "code" (bloques).
 * El motor nativo de Reveal no pagina; aquí se añaden slides antes de renderizar.
 * Nunca divide HTML complejo, imágenes, tablas o plugins interactivos.
 */
function separarDiapositivas(source) {
  const lines = String(source).replace(/\r\n?/g, '\n').split('\n');
  const chunks = []; let current = []; let fence = null;
  for (const line of lines) {
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      if (!fence) fence = m[1][0];
      else if (m[1][0] === fence) fence = null;
    }
    if (!fence && line.trim() === '---') {
      chunks.push(current.join('\n').trim()); current=[];
    } else current.push(line);
  }
  chunks.push(current.join('\n').trim());
  return chunks.filter(Boolean);
}
/** Las continuaciones repiten los atributos de la diapositiva salvo su id (debe ser único). */
function sinId(attr) {
  return attr.replace(/\s+id=["'][^"']*["']/, '');
}
function coste(text, width=70) {
  return Math.max(1, Math.ceil(String(text).replace(/<[^>]*>/g,'').length/width));
}
function paginasTexto(slide, opts) {
  const lines = slide.split('\n');
  const attrIdx = lines.findIndex(l => /<!--\s*\.slide:/.test(l));
  const titleIdx = lines.findIndex(l => /^#{1,3}\s/.test(l));
  if (attrIdx < 0 || titleIdx < 0) return [slide];
  const notesIdx = lines.findIndex(l => /^Notes:\s*$/.test(l));
  const core = notesIdx >= 0 ? lines.slice(0, notesIdx) : lines;
  const notes = notesIdx >= 0 ? lines.slice(notesIdx).join('\n').trim() : '';
  const body = core.filter((line,i) => i!==titleIdx && i!==attrIdx).join('\n').trim();
  if (!body || /```|<table|<div|<iframe|<video|!\[[^\]]*\]\(/i.test(body)) return [slide];
  const budget = opts.budget ?? 9.0;
  // Mantener cada viñeta como una unidad. Párrafos extensos se separan por oraciones
  // (con respaldo de palabras para oraciones extraordinariamente largas).
  const units = [];
  for (const block of body.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean)) {
    if (/^(?:[-*+]\s|\d+[.)]\s)/m.test(block)) {
      let current = [];
      for (const line of block.split('\n')) {
        if (/^(?:[-*+]\s|\d+[.)]\s)/.test(line)) {
          if(current.length) units.push(current.join('\n').trim());
          current = [line];
        } else if(current.length) current.push(line);
        else units.push(line);
      }
      if(current.length)units.push(current.join('\n').trim());
    } else {
      const sentences = block.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/u);
      let current='';
      for(const sentence of sentences){
        if(current && coste(current+' '+sentence,70) > budget-1){
          units.push(current); current='';
        }
        if(coste(sentence,70)>budget-1){
          const words=sentence.split(/\s+/);let group='';
          for(const w of words){
            if(group && coste(group+' '+w,70)>budget-1){units.push(group);group='';}
            group+=(group?' ':'')+w;
          }
          if(group)units.push(group);
        } else current+=(current?' ':'')+sentence;
      }
      if(current)units.push(current);
    }
  }
  if(units.length===0)return [slide];
  const chunks=[];let current=[],score=0;
  for(const unit of units){
    const isBullet=/^(?:[-*+]\s|\d+[.)]\s)/.test(unit);
    const unitScore= Math.max(1, Math.ceil(unit.length/(isBullet?66:75)))*1.16+0.52;
    if(current.length && score+unitScore>budget){chunks.push(current);current=[];score=0;}
    current.push(unit);score+=unitScore;
  }
  if(current.length)chunks.push(current);
  if(chunks.length<2)return [slide];
  const heading=lines[titleIdx].trim();const attr=lines[attrIdx].trim();
  return chunks.map((units,i) => [
    i ? heading.replace(/^(#{1,3}\s+)(.*)$/,(_,$h,$name)=>`${$h}${$name} (continuación ${i+1})`) : heading,
    i ? sinId(attr) : attr,
    units.join('\n\n'),
    i===0?notes:''
  ].filter(Boolean).join('\n\n'));
}
function paginasCodigo(slide) {
  const title = slide.match(/^#{1,3}\s+.+$/m)?.[0];
  const attr = slide.match(/<!--\s*\.slide:[^\n]*-->/)?.[0];
  const match = slide.match(/```([^\n]*)\n([\s\S]*?)\n```/);
  if(!title || !attr || !match) return [slide];
  const lines=match[2].split('\n');
  // data-oc-lines="N" ajusta las líneas por diapositiva (4–22; la caja admite 22 a 19 px).
  const maxLines=Math.min(22, Math.max(4, Number(attr.match(/data-oc-lines=["'](\d+)["']/)?.[1]) || 16));
  if(lines.length<=maxLines)return [slide];
  const notes = slide.match(/^Notes:\s*$[\s\S]*/m)?.[0]||'';
  const pag=[];
  for(let start=0;start<lines.length;start+=maxLines){
    const i=start/maxLines;
    const hd = i===0?title:`${title} (continuación ${i+1})`;
    const snippet = lines.slice(start,start+maxLines).join('\n');
    pag.push(`${hd}\n${i ? sinId(attr) : attr}\n\n\`\`\`${match[1]}\n${snippet}\n\`\`\`${i===0&&notes?`\n\n${notes}`:''}`);
  }
  return pag;
}
/** Función pura, compartida por la demo y futuros cursos. */
export function paginarMarkdown(source, options={}) {
  const result=[];
  for(const slide of separarDiapositivas(source)){
    // El modo se lee SOLO del atributo .slide: un texto que mencione el atributo no pagina.
    const attr=slide.match(/<!--\s*\.slide:[^\n]*-->/)?.[0]||'';
    const mode=attr.match(/data-oc-paginate=["'](auto|code)["']/)?.[1];
    result.push(...(mode==='auto'?paginasTexto(slide,options):mode==='code'?paginasCodigo(slide):[slide]));
  }
  return result.join('\n\n---\n\n')+'\n';
}
/** Auditoría geométrica no mutante para casos donde el cálculo previo no basta. */
export function auditarOverflow() {
  if (typeof document === 'undefined') return [];
  const findings=[];
  const sections=[...document.querySelectorAll('.reveal .slides section.oc-demo')];
  for (const section of sections) {
    if(section.classList.contains('oc-l-cover')||section.classList.contains('oc-l-closing'))continue;
    const rect=section.getBoundingClientRect();
    if(!rect.width||!rect.height)continue;
    // Borde inferior del área útil del tema: Y 666 de 720 (justo sobre «Vigilada Mineducación»).
    const areaBottom=rect.top+rect.height*666/720;
    const elements=section.querySelectorAll('li, p, pre, table, iframe, video, .oc-media-demo');
    for(const el of elements) {
      if(el.closest('aside.notes'))continue;
      const b=el.getBoundingClientRect();
      if(b.width && b.height && b.bottom>areaBottom+2) {
        findings.push({titulo:section.querySelector('h1,h2')?.textContent||'(sin título)', etiqueta:el.tagName, excedentePx:Math.round(b.bottom-areaBottom)});
        break;
      }
    }
  }
  if (findings.length) console.warn('[OpenClass] Contenido que requiere revisión (no se recorta):',findings);
  else console.info('[OpenClass] Auditoría geométrica de layouts demo: sin excesos detectados.');
  return findings;
}
