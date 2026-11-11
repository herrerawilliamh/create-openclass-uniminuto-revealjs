/** OpenClass Live: punto de entrada del contenedor. */
import { crearApp, crearLog } from './app.mjs';
import { leerConfig } from './config.mjs';

const log = crearLog();
let config;
try {
  config = leerConfig();
} catch (error) {
  // El mensaje describe la variable que falta; nunca incluye su valor.
  log('config_invalida', { mensaje: error.message });
  process.exit(1);
}

let app;
try {
  app = await crearApp(config, { log });
} catch (error) {
  // Base no disponible o esquema desactualizado: se informa la causa genérica, nunca la URL ni la credencial.
  log('arranque_fallido', { tipo: error.name, codigo: error.codigo ?? '', mensaje: error.name === 'ErrorBase' ? error.message : 'error interno' });
  process.exit(1);
}
const direccion = await app.escuchar();
log('inicio', { puerto: direccion.port, ttlMin: config.salaTtlMin, maxParticipantes: config.maxParticipantes });

let cerrando = false;
for (const senal of ['SIGTERM', 'SIGINT']) {
  process.on(senal, async () => {
    if (cerrando) return;
    cerrando = true;
    log('cierre', { senal });
    const limite = setTimeout(() => process.exit(0), 8000);
    limite.unref();
    await app.cerrar().catch(() => {});
    process.exit(0);
  });
}
