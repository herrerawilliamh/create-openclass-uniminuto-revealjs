/**
 * OpenClass Live: límites de frecuencia en memoria (cubeta de fichas por clave).
 * Las claves de red (IP) se guardan solo mientras dura la ventana, nunca en registros ni historiales.
 */
import { BlockList, isIP } from 'node:net';
export function crearLimitador({ capacidad, porSegundo }) {
  const cubetas = new Map();
  return {
    /** true si la clave puede gastar `costo` fichas ahora. */
    permitir(clave, costo = 1) {
      const ahora = Date.now();
      const c = cubetas.get(clave) ?? { fichas: capacidad, t: ahora };
      c.fichas = Math.min(capacidad, c.fichas + ((ahora - c.t) / 1000) * porSegundo);
      c.t = ahora;
      const ok = c.fichas >= costo;
      if (ok) c.fichas -= costo;
      cubetas.set(clave, c);
      return ok;
    },
    /** Consulta sin gastar: true si quedan al menos `costo` fichas. */
    disponible(clave, costo = 1) {
      const c = cubetas.get(clave);
      return !c || Math.min(capacidad, c.fichas + ((Date.now() - c.t) / 1000) * porSegundo) >= costo;
    },
    olvidar: (clave) => cubetas.delete(clave),
    /** Elimina cubetas llenas (inactivas): mantiene acotada la memoria. */
    purgar() {
      const ahora = Date.now();
      for (const [clave, c] of cubetas) {
        if (c.fichas + ((ahora - c.t) / 1000) * porSegundo >= capacidad) cubetas.delete(clave);
      }
    },
    get tamano() { return cubetas.size; },
  };
}

/** «::ffff:10.0.0.1» → «10.0.0.1»; devuelve null si no es una dirección IP válida. */
export function normalizarIp(valor) {
  let ip = String(valor ?? '').trim();
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/i.test(ip)) ip = ip.slice(7);
  if (ip.startsWith('[') && ip.endsWith(']')) ip = ip.slice(1, -1);
  return isIP(ip) ? ip : null;
}

/**
 * Redes de proxies de confianza (TRUSTED_PROXY_CIDRS). Devuelve una función `(direccionPar) => boolean`.
 * Una entrada inválida hace fallar el arranque: nunca se confía «por defecto» en una red mal escrita.
 */
export function crearConfianzaProxy(cidrs) {
  const lista = new BlockList();
  for (const c of cidrs) {
    const m = /^([^/]+)\/(\d{1,3})$/.exec(c);
    const ip = m && normalizarIp(m[1]);
    const prefijo = m && Number(m[2]);
    if (!ip || (isIP(ip) === 4 ? prefijo > 32 : prefijo > 128)) throw new Error(`TRUSTED_PROXY_CIDRS contiene una red inválida: ${c}`);
    lista.addSubnet(ip, prefijo, isIP(ip) === 4 ? 'ipv4' : 'ipv6');
  }
  return (direccion) => {
    const ip = normalizarIp(direccion);
    return Boolean(ip) && lista.check(ip, isIP(ip) === 4 ? 'ipv4' : 'ipv6');
  };
}

/**
 * IP del cliente para límites de frecuencia y cupos (nunca para autorizar ni registrar).
 * `confiarProxy`: false (se ignoran las cabeceras) | función de redes de confianza | true (cualquier par; solo pruebas).
 * Las cabeceras SOLO cuentan si la conexión TCP viene de un proxy de confianza (Traefik). Entonces manda el último
 * tramo de X-Forwarded-For, que añade ese proxy; lo anterior lo puede escribir el cliente. Un valor que no sea una
 * IP válida se descarta y se usa la dirección del par. X-Real-Ip NO se usa nunca (no hay garantía verificable de que el proxy lo sanee). Sin proxy de confianza se ignoran todas.
 */
export function ipCliente(cabeceras, direccion, confiarProxy) {
  const par = normalizarIp(direccion) ?? String(direccion ?? 'desconocida');
  const confiable = typeof confiarProxy === 'function' ? confiarProxy(direccion) : confiarProxy === true;
  if (confiable) {
    const reenviada = normalizarIp(String(cabeceras['x-forwarded-for'] ?? '').split(',').pop());
    if (reenviada) return reenviada;
  }
  return par;
}
