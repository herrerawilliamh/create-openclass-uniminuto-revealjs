// Lector YAML mínimo y ESTRICTO para el subconjunto que usa .github/workflows/openclass-live.yml.
// Sin dependencias. Falla cerrado: cualquier construcción fuera del subconjunto lanza un error
// (anclas, alias, etiquetas, tabulaciones, claves duplicadas, escalares multilínea, flujos anidados).
// Subconjunto: mapas y secuencias por sangría, escalares planos/'...'/"...", {} , [] y [a, b] en una línea,
// bloques literales | |- |+ y comentarios #.

const VACIA = /^\s*(#.*)?$/;
const CLAVE = /^([A-Za-z0-9_.\/-]+|"[^"]*"|'[^']*'):(?:[ ]+(.*))?$/;

function sinComentario(v) {
  v = v.trim();
  if (v[0] === "'" || v[0] === '"') {
    const q = v[0];
    let i = 1;
    for (; i < v.length; i++) {
      if (q === '"' && v[i] === '\\') { i++; continue; }
      if (v[i] === q) { if (q === "'" && v[i + 1] === "'") { i++; continue; } break; }
    }
    if (i >= v.length) throw new Error(`Escalar entrecomillado sin cerrar: ${v}`);
    const resto = v.slice(i + 1).trim();
    if (resto && !resto.startsWith('#')) throw new Error(`Texto tras escalar entrecomillado: ${v}`);
    return v.slice(0, i + 1);
  }
  return v.replace(/(^|\s)#.*$/, '').trim();
}

function escalar(v) {
  v = sinComentario(v);
  if (v === '') return null;
  if (v[0] === "'") return v.slice(1, -1).replace(/''/g, "'");
  if (v[0] === '"') return JSON.parse(v);
  if (v === '{}') return {};
  if (v === '[]') return [];
  if (v[0] === '[') {
    if (!v.endsWith(']') || /[\[{]/.test(v.slice(1, -1))) throw new Error(`Flujo no admitido: ${v}`);
    return v.slice(1, -1).split(',').map(x => escalar(x));
  }
  if (/^[{&*!|>%@`]/.test(v)) throw new Error(`Construcción YAML no admitida: ${v}`);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~') return null;
  return v;
}

export function parseWorkflowYaml(src) {
  const raw = String(src).replace(/\r\n/g, '\n').split('\n');
  raw.forEach((l, n) => {
    if (/^ *\t/.test(l)) throw new Error(`Tabulación en la sangría (línea ${n + 1})`);
    if (/^(---|\.\.\.)/.test(l) && n > 0) throw new Error('Documentos múltiples no admitidos');
  });
  let i = 0;
  const sangria = l => l.length - l.trimStart().length;
  const saltar = () => { while (i < raw.length && VACIA.test(raw[i])) i++; };

  function bloque(valor, padre) {
    const m = valor.match(/^([|>])([+-]?)\s*(#.*)?$/);
    if (!m || m[1] !== '|') throw new Error(`Bloque escalar no admitido: ${valor}`);
    const lineas = [];
    while (i < raw.length && (raw[i].trim() === '' || sangria(raw[i]) > padre)) lineas.push(raw[i++]);
    while (lineas.length && lineas[lineas.length - 1].trim() === '') lineas.pop();
    const base = Math.min(...lineas.filter(l => l.trim()).map(sangria), Infinity);
    const cuerpo = lineas.map(l => l.trim() === '' ? '' : l.slice(base)).join('\n');
    return m[2] === '-' ? cuerpo : cuerpo + '\n';
  }

  function nodo(indent) {
    saltar();
    if (i >= raw.length || sangria(raw[i]) !== indent) throw new Error(`Sangría inesperada (línea ${i + 1})`);
    return /^-(\s|$)/.test(raw[i].trim()) ? secuencia(indent) : mapa(indent);
  }

  function secuencia(indent) {
    const out = [];
    for (;;) {
      saltar();
      if (i >= raw.length || sangria(raw[i]) !== indent || !/^-(\s|$)/.test(raw[i].trim())) break;
      const resto = raw[i].trim().replace(/^-\s*/, '');
      const col = raw[i].length - raw[i].trimStart().length + (raw[i].trim().length - resto.length);
      if (resto === '' || VACIA.test(resto)) {
        i++; saltar();
        if (i >= raw.length || sangria(raw[i]) <= indent) { out.push(null); continue; }
        out.push(nodo(sangria(raw[i])));
      } else if (CLAVE.test(sinComentario(resto))) {
        raw[i] = ' '.repeat(col) + resto;
        out.push(mapa(col));
      } else { out.push(escalar(resto)); i++; }
    }
    return out;
  }

  function mapa(indent) {
    const out = {};
    for (;;) {
      saltar();
      if (i >= raw.length) break;
      const ind = sangria(raw[i]);
      if (ind < indent) break;
      if (ind > indent) throw new Error(`Sangría inesperada (línea ${i + 1})`);
      const t = raw[i].trim();
      if (/^-(\s|$)/.test(t)) break;
      const m = t.match(CLAVE);
      if (!m) throw new Error(`Línea no admitida (línea ${i + 1}): ${t}`);
      const k = m[1].replace(/^["']|["']$/g, '');
      if (Object.hasOwn(out, k)) throw new Error(`Clave duplicada: ${k}`);
      const v = m[2] === undefined ? '' : m[2];
      i++;
      if (/^[|>]/.test(v.trim())) { out[k] = bloque(v.trim(), indent); continue; }
      if (sinComentario(v) !== '') { out[k] = escalar(v); continue; }
      saltar();
      if (i < raw.length && sangria(raw[i]) > indent) out[k] = nodo(sangria(raw[i]));
      else if (i < raw.length && sangria(raw[i]) === indent && /^-(\s|$)/.test(raw[i].trim())) out[k] = secuencia(indent);
      else out[k] = null;
    }
    return out;
  }

  saltar();
  if (i >= raw.length) throw new Error('Documento YAML vacío');
  const doc = nodo(sangria(raw[i]));
  saltar();
  if (i < raw.length) throw new Error(`Contenido sin interpretar (línea ${i + 1})`);
  return doc;
}
