/* Interact · enlace de presentación entre el estado REAL de conexión y la marca compacta de carga de Brand.
   No inicia, mide ni simula ninguna operación: observa el texto que ya escriben estudiante.mjs y docente.mjs
   en #conexion y muestra la marca animada solo mientras ese texto dice que se está (re)conectando o verificando.
   Al cambiar el texto (p. ej. «Conectado») o vaciarse, la marca se oculta. El texto y su aria-live no cambian.
   La W es el archivo oficial willedtech-isotipo-motion.svg, insertado tal cual; aquí no se dibuja nada. */
(function () {
  'use strict';
  var estado = document.getElementById('conexion');
  var marca = document.querySelector('.espera-marca');
  if (!estado || !marca) return;
  var ESPERA = /reconectando|verificando|reintentando/i;
  function sincronizar() {
    marca.hidden = !marca.firstElementChild || !ESPERA.test(estado.textContent || '');
  }
  new MutationObserver(sincronizar).observe(estado, { childList: true, characterData: true, subtree: true });
  sincronizar();

})();
