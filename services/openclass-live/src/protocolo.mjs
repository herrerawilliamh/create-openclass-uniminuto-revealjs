/**
 * Versión del protocolo presentación ↔ servicio (docs/PROTOCOLO.md, «Negociación de versión»).
 * El adaptador la declara en el handshake (`auth.protocolo`, `auth.capacidades`) y el servicio la
 * devuelve en `sesion.protocolo`. v2: la solución viaja solo con `encuesta:revelar` (soluciones-privadas)
 * y el tiempo de votación es una preferencia de la sala con cierre en el servidor (temporizador-sala).
 * Un adaptador v0.1 no declara nada: se rechaza en el handshake, antes de crear ninguna encuesta.
 * Copia en la plantilla: template/src/plugins/protocolo-live.mjs (una prueba exige que coincidan).
 */
export const PROTOCOLO = Object.freeze({ version: 2, capacidades: Object.freeze(['soluciones-privadas', 'temporizador-sala']) });

export function presentadorCompatible(auth) {
  return auth?.protocolo === PROTOCOLO.version && Array.isArray(auth.capacidades)
    && PROTOCOLO.capacidades.every((c) => auth.capacidades.includes(c));
}
