/**
 * OpenClass Live: límites de frecuencia en memoria (cubeta de fichas por clave).
 * Las claves de red (IP) se guardan solo mientras dura la ventana, nunca en registros ni historiales.
 */
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

/** IP del cliente: detrás de Traefik se usa el último tramo de X-Forwarded-For; con TRUST_PROXY=false se ignoran todas las cabeceras. */
export function ipCliente(cabeceras, direccion, confiarProxy) {
  if (confiarProxy) {
    // El último tramo de X-Forwarded-For lo añade el proxy de confianza; lo anterior y X-Real-Ip los puede falsificar el cliente.
    const reenviada = String(cabeceras['x-forwarded-for'] ?? '').split(',').pop().trim();
    if (reenviada) return reenviada;
    const real = String(cabeceras['x-real-ip'] ?? '').trim();
    if (real) return real;
  }
  return String(direccion ?? 'desconocida');
}
