/**
 * Interact: envío de correo con transporte configurable. Sin dependencias ni secretos en Git.
 *   MAIL_TRANSPORT=desarrollo  → no sale nada de la máquina: los mensajes quedan en `bandeja` (pruebas y desarrollo).
 *   MAIL_TRANSPORT=smtp        → cliente SMTP propio (STARTTLS en 587 o TLS implícito en 465), AUTH PLAIN/LOGIN.
 *   MAIL_TRANSPORT=desactivado → no se envía nada y la API lo dice con claridad (valor por omisión en producción).
 * Nunca se afirma «enviado» si el transporte no es SMTP real y aceptado por el servidor.
 */
import net from 'node:net';
import tls from 'node:tls';
import { randomBytes } from 'node:crypto';

export class ErrorCorreo extends Error {
  constructor(mensaje, codigo = 'correo') { super(mensaje); this.codigo = codigo; }
}

const limpiaCabecera = (v) => String(v).replace(/[\r\n]+/g, ' ').trim();

/** Mensaje RFC 5322 en texto plano UTF-8 (cabecera Subject codificada, cuerpo en base64). */
export function construirMensaje({ de, para, asunto, texto, fecha = new Date() }) {
  const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
  const trozos = (s) => s.match(/.{1,76}/g)?.join('\r\n') ?? '';
  return [
    `From: ${limpiaCabecera(de)}`, `To: ${limpiaCabecera(para)}`, `Subject: =?UTF-8?B?${b64(limpiaCabecera(asunto))}?=`,
    `Date: ${fecha.toUTCString()}`, `Message-ID: <${randomBytes(12).toString('hex')}@interact>`, 'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: base64', 'Auto-Submitted: auto-generated', '',
    trozos(b64(texto)), '',
  ].join('\r\n');
}

/** Conversación SMTP mínima. Cada línea de respuesta multilínea «250-» se agrupa hasta «250 ». */
async function conversar({ host, puerto, seguro, usuario, clave, de, para, mensaje, nombreCliente = 'interact.local', tiempoMs = 15_000, rechazarNoAutorizado = true }) {
  let socket = await new Promise((resolver, rechazar) => {
    const alAbrir = () => resolver(s);
    const s = seguro ? tls.connect({ host, port: puerto, servername: host, rejectUnauthorized: rechazarNoAutorizado }, alAbrir) : net.connect({ host, port: puerto }, alAbrir);
    s.once('error', rechazar);
    s.setTimeout(tiempoMs, () => s.destroy(new ErrorCorreo('Tiempo agotado con el servidor de correo', 'tiempo')));
  });
  let cola = '';
  let esperando = null;
  const alDato = (d) => { cola += d.toString('utf8'); avanzar(); };
  const alError = (e) => { esperando?.rechazar(e); esperando = null; };
  function avanzar() {
    if (!esperando) return;
    const lineas = cola.split('\r\n');
    for (let i = 0; i < lineas.length - 1; i++) {
      if (/^\d{3} /.test(lineas[i]) || /^\d{3}$/.test(lineas[i])) {
        const texto = lineas.slice(0, i + 1).join('\r\n');
        cola = lineas.slice(i + 1).join('\r\n');
        const { resolver } = esperando; esperando = null;
        return resolver({ codigo: Number(texto.slice(0, 3)), texto });
      }
    }
  }
  const enlazar = (s) => { s.on('data', alDato); s.on('error', alError); s.on('close', () => alError(new ErrorCorreo('Conexión cerrada por el servidor de correo'))); };
  enlazar(socket);
  const leer = () => new Promise((resolver, rechazar) => { esperando = { resolver, rechazar }; avanzar(); });
  const esperar = async (...ok) => {
    const r = await leer();
    if (!ok.includes(r.codigo)) throw new ErrorCorreo(`El servidor de correo respondió ${r.codigo}`, 'rechazado');
    return r;
  };
  const decir = (linea) => socket.write(`${linea}\r\n`);
  try {
    await esperar(220);
    decir(`EHLO ${nombreCliente}`);
    let ehlo = await esperar(250);
    if (!seguro && /STARTTLS/i.test(ehlo.texto)) {
      decir('STARTTLS');
      await esperar(220);
      socket.removeAllListeners('data'); socket.removeAllListeners('close'); socket.removeAllListeners('error');
      const crudo = socket;
      socket = await new Promise((resolver, rechazar) => {
        const t = tls.connect({ socket: crudo, servername: host, rejectUnauthorized: rechazarNoAutorizado }, () => resolver(t));
        t.once('error', rechazar);
      });
      cola = ''; enlazar(socket);
      decir(`EHLO ${nombreCliente}`);
      ehlo = await esperar(250);
    } else if (!seguro && usuario) {
      throw new ErrorCorreo('El servidor no ofrece STARTTLS: no se envían credenciales en claro', 'sin_tls');
    }
    if (usuario) {
      decir(`AUTH PLAIN ${Buffer.from(`\0${usuario}\0${clave}`).toString('base64')}`);
      await esperar(235);
    }
    decir(`MAIL FROM:<${limpiaCabecera(de.replace(/^.*<|>.*$/g, ''))}>`); await esperar(250);
    decir(`RCPT TO:<${limpiaCabecera(para)}>`); await esperar(250, 251);
    decir('DATA'); await esperar(354);
    // Relleno de puntos (RFC 5321 §4.5.2).
    socket.write(`${mensaje.replace(/^\./gm, '..')}\r\n.\r\n`);
    await esperar(250);
    decir('QUIT');
    await leer().catch(() => {}); // 221; ya aceptado, un cierre brusco no invalida la entrega
    return { aceptado: true };
  } finally {
    socket.destroy();
  }
}

/** @returns {{ transporte: string, real: boolean, bandeja: object[], enviar(m): Promise<{enviado:boolean, simulado:boolean}> }} */
export function crearCorreo(config, { log = () => {} } = {}) {
  const c = config.correo;
  const bandeja = [];
  const base = { transporte: c.transporte, real: c.transporte === 'smtp', bandeja };
  if (c.transporte === 'desarrollo') {
    return { ...base, async enviar({ para, asunto, texto }) {
      bandeja.push({ para, asunto, texto, fecha: Date.now() });
      if (bandeja.length > 200) bandeja.shift();
      log('correo_simulado');
      return { enviado: false, simulado: true };
    } };
  }
  if (c.transporte === 'smtp') {
    return { ...base, async enviar({ para, asunto, texto }) {
      try {
        await conversar({ host: c.host, puerto: c.puerto, seguro: c.seguro, usuario: c.usuario, clave: c.clave, de: c.de, para,
          mensaje: construirMensaje({ de: c.de, para, asunto, texto }), nombreCliente: new URL(config.appUrl).hostname,
          rechazarNoAutorizado: c.verificarCertificado });
        log('correo_enviado');
        return { enviado: true, simulado: false };
      } catch (error) {
        log('correo_fallido', { codigo: error.codigo ?? error.code ?? 'desconocido' });
        throw error instanceof ErrorCorreo ? error : new ErrorCorreo('No se pudo entregar el correo', 'entrega');
      }
    } };
  }
  return { ...base, async enviar() { log('correo_desactivado'); return { enviado: false, simulado: false }; } };
}

// ---------- Plantillas (texto plano; los enlaces usan fragmento para no quedar en registros ni cabeceras Referer) ----------
export const enlaces = (appUrl) => ({
  invitacion: (t) => `${appUrl}/cuenta/#invitacion=${t}`,
  verificacion: (t) => `${appUrl}/cuenta/#verificar=${t}`,
  recuperacion: (t) => `${appUrl}/cuenta/#recuperar=${t}`,
});

export const plantillas = {
  invitacion: ({ enlace, venceTexto, rol }) => ({
    asunto: 'Invitación a Interact by WillEdTech',
    texto: `Le invitaron a Interact by WillEdTech como ${rol}.\n\nCree su cuenta con este enlace (un solo uso, vence ${venceTexto}):\n${enlace}\n\nSi no esperaba esta invitación, ignore este mensaje: sin el enlace no se crea ninguna cuenta.\n`,
  }),
  verificacion: ({ enlace, venceTexto }) => ({
    asunto: 'Confirme su correo en Interact',
    texto: `Confirme que esta dirección es suya para activar su cuenta (un solo uso, vence ${venceTexto}):\n${enlace}\n\nSi no creó la cuenta, ignore este mensaje.\n`,
  }),
  recuperacion: ({ enlace, venceTexto }) => ({
    asunto: 'Restablecer su contraseña de Interact',
    texto: `Alguien pidió restablecer la contraseña de esta cuenta. Si fue usted, use este enlace (un solo uso, vence ${venceTexto}):\n${enlace}\n\nSi no fue usted, ignore este mensaje: su contraseña no cambia. Al restablecerla se cierran todas sus sesiones.\n`,
  }),
};
