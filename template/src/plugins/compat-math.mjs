// reveal.js 6.0.2: plugin/math.mjs termina con `n = Plugin = Object.assign(...)` sin declarar
// `Plugin`; en un módulo ES (modo estricto) eso lanza «Plugin is not defined» al importarlo.
// Si la propiedad global existe, la asignación es válida. Debe importarse ANTES que el plugin.
if (!('Plugin' in globalThis)) globalThis.Plugin = undefined;
