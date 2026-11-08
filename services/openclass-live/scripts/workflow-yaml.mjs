// Lector YAML 1.2 ESTRICTO del workflow, basado en la biblioteca `yaml` (versión fijada en package.json
// y package-lock.json). Falla cerrado: cualquier error o advertencia de parsing, documentos múltiples,
// claves duplicadas (comparadas tras decodificar escapes \u \x), claves no cadena, anclas, alias,
// etiquetas y claves de mezcla (<<) lanzan un error; nunca se devuelve un documento parcial.
import { parseAllDocuments, visit, isAlias, isScalar, isMap, isPair } from 'yaml';

// Escapes YAML 1.2 que `yaml` decodifica de forma fiel (comprobado contra la implementación de referencia).
// \U (8 dígitos) NO se admite: `yaml` lo degrada en silencio a texto literal mientras un analizador conforme
// lo decodificaría, lo que permitiría ocultar claves. Cualquier otro escape desconocido también se rechaza.
const ESCAPES_OK = /^(?:[0abtnvfre "\/\\N_LP]|\t|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4})/;
function validarEscapes(crudo) {
  for (let i = 0; i < crudo.length; i++) {
    if (crudo[i] !== '\\') continue;
    const resto = crudo.slice(i + 1);
    if (!ESCAPES_OK.test(resto)) throw new Error(`Escape YAML no admitido: \\${resto.slice(0, 2)}`);
    i += resto[0] === 'x' ? 3 : resto[0] === 'u' ? 5 : 1;
  }
}

export function parseWorkflowYaml(src) {
  const texto = String(src).replace(/\r\n/g, '\n');
  const docs = parseAllDocuments(texto, { version: '1.2', schema: 'core', strict: true, uniqueKeys: true, merge: false, prettyErrors: false });
  if (docs.length !== 1) throw new Error('Documentos múltiples o vacíos no admitidos');
  const doc = docs[0];
  const problemas = [...doc.errors, ...doc.warnings];
  if (problemas.length) throw new Error(`YAML no válido: ${problemas.map(p => p.message.split('\n')[0]).join('; ')}`);
  visit(doc, {
    Alias() { throw new Error('Alias YAML no admitidos'); },
    Node(_, n) {
      if (isAlias(n)) throw new Error('Alias YAML no admitidos');
      if (n.anchor) throw new Error(`Ancla YAML no admitida: &${n.anchor}`);
      if (n.tag) throw new Error(`Etiqueta YAML no admitida: ${n.tag}`);
      if (isScalar(n) && n.type === 'QUOTE_DOUBLE' && n.range) validarEscapes(texto.slice(n.range[0], n.range[1]));
    },
    Pair(_, p) {
      if (!isScalar(p.key) || typeof p.key.value !== 'string') throw new Error('Las claves de mapeo deben ser cadenas');
      if (p.key.value === '<<') throw new Error('Clave de mezcla (<<) no admitida');
    },
    Map(_, m) {
      const vistas = new Set();
      for (const p of m.items) {
        if (!isPair(p)) continue;
        if (vistas.has(p.key.value)) throw new Error(`Clave duplicada: ${p.key.value}`);
        vistas.add(p.key.value);
      }
    },
  });
  if (!isMap(doc.contents)) throw new Error('El documento YAML debe ser un mapeo');
  return doc.toJS({ maxAliasCount: 0 });
}
