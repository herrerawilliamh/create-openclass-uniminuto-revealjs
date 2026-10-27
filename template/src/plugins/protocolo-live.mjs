/**
 * OpenClass Live: versión del protocolo que habla este adaptador (sin dependencias: lo usan live.mjs y
 * las pruebas). Debe coincidir con services/openclass-live/src/protocolo.mjs.
 */
export const PROTOCOLO_LIVE = Object.freeze({ version: 2, capacidades: Object.freeze(['soluciones-privadas', 'temporizador-sala']) });

/**
 * Revisa el `protocolo` que el servicio devuelve en `sesion`. null = compatible; si no, el componente
 * que hay que actualizar ('servicio' si es más antiguo o no declara versión, como el v0.1).
 */
export function componenteDesactualizado(protocolo) {
  const { version, capacidades } = PROTOCOLO_LIVE;
  if (protocolo?.version === version && Array.isArray(protocolo.capacidades) && capacidades.every((c) => protocolo.capacidades.includes(c))) return null;
  return typeof protocolo?.version === 'number' && protocolo.version > version ? 'presentacion' : 'servicio';
}

export const textoIncompatible = (componente) => `La presentación y OpenClass Live utilizan versiones diferentes. Actualice ${
  componente === 'presentacion' ? 'la presentación (adaptador «En vivo» del curso)' : 'el servicio OpenClass Live'}.`;
