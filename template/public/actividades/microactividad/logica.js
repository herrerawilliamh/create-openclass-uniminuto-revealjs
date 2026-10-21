/*
 * LÓGICA DE LA MICROACTIVIDAD — funciones puras, sin acceso al DOM (probadas en tests/).
 * Script clásico: funciona dentro de un iframe con sandbox="allow-scripts allow-forms".
 */
(function (global) {
  'use strict';

  /** Valida la estructura de los datos y devuelve la lista de problemas encontrados. */
  function validarDatos(datos) {
    const problemas = [];
    const ids = new Set((datos?.categorias || []).map((c) => c.id));
    if (!datos || !Array.isArray(datos.categorias) || datos.categorias.length < 2) problemas.push('Se necesitan al menos 2 categorías.');
    if (!Array.isArray(datos?.elementos) || datos.elementos.length < 1) problemas.push('Se necesita al menos 1 elemento.');
    (datos?.elementos || []).forEach((e, i) => {
      if (!e.texto) problemas.push(`El elemento ${i + 1} no tiene texto.`);
      if (!ids.has(e.categoria)) problemas.push(`El elemento ${i + 1} usa una categoría inexistente: ${e.categoria}.`);
    });
    return problemas;
  }

  /**
   * Evalúa las respuestas. `respuestas` es un arreglo con el id de categoría elegido por elemento
   * (o null si falta). Devuelve aciertos, pendientes, porcentaje y el detalle por elemento.
   */
  function evaluar(elementos, respuestas) {
    const detalle = elementos.map((e, i) => {
      const elegido = respuestas[i] ?? null;
      return { indice: i, elegido, esperado: e.categoria, respondido: elegido !== null, correcto: elegido === e.categoria };
    });
    const aciertos = detalle.filter((d) => d.correcto).length;
    const pendientes = detalle.filter((d) => !d.respondido).length;
    return {
      total: elementos.length, aciertos, pendientes, completo: pendientes === 0,
      porcentaje: elementos.length ? Math.round((100 * aciertos) / elementos.length) : 0,
      detalle,
    };
  }

  /** Aciertos por categoría: { id: { aciertos, total } }. */
  function resumenPorCategoria(categorias, resultado, elementos) {
    const resumen = Object.fromEntries(categorias.map((c) => [c.id, { aciertos: 0, total: 0 }]));
    resultado.detalle.forEach((d) => {
      const grupo = resumen[elementos[d.indice].categoria];
      grupo.total++;
      if (d.correcto) grupo.aciertos++;
    });
    return resumen;
  }

  function mensajeFinal(porcentaje) {
    if (porcentaje === 100) return 'Excelente: clasificaste todas las acciones correctamente.';
    if (porcentaje >= 70) return 'Muy bien: revisa las acciones marcadas y vuelve a intentarlo.';
    if (porcentaje >= 40) return 'Vas en camino: relee las explicaciones antes del siguiente intento.';
    return 'Conviene repasar los tres momentos de la sesión y reintentar.';
  }

  /** Barajado determinista (semilla numérica) para variar el orden sin perder reproducibilidad. */
  function barajar(lista, semilla) {
    const copia = lista.slice();
    let s = (semilla >>> 0) || 1;
    for (let i = copia.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }

  global.OCMicro = { validarDatos, evaluar, resumenPorCategoria, mensajeFinal, barajar };
})(typeof window !== 'undefined' ? window : globalThis);
