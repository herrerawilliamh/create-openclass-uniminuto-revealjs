/*
 * VISTA DE LA MICROACTIVIDAD — dibuja datos.js con las funciones de logica.js.
 * Estado observable para pruebas: <body data-estado="listo|incompleto|evaluado" data-aciertos="N">.
 */
(function () {
  'use strict';
  const D = window.OC_ACTIVIDAD;
  const M = window.OCMicro;
  const $ = (selector) => document.querySelector(selector);
  const crear = (etiqueta, props = {}, ...hijos) => {
    const el = Object.assign(document.createElement(etiqueta), props);
    el.append(...hijos);
    return el;
  };

  const problemas = M.validarDatos(D);
  if (problemas.length) {
    $('#actividad').replaceChildren(crear('p', { className: 'error', textContent: `Revisa datos.js: ${problemas.join(' ')}` }));
    return;
  }

  const nombres = Object.fromEntries(D.categorias.map((c) => [c.id, c.nombre]));
  const orden = D.barajar ? M.barajar(D.elementos.map((_, i) => i), Date.now()) : D.elementos.map((_, i) => i);
  let respuestas = new Array(D.elementos.length).fill(null);

  $('#titulo').textContent = D.titulo;
  $('#objetivo').textContent = D.objetivo;
  $('#instrucciones').replaceChildren(...D.instrucciones.map((t) => crear('li', { textContent: t })));

  function estado(valor, aciertos) {
    document.body.dataset.estado = valor;
    if (aciertos === undefined) delete document.body.dataset.aciertos;
    else document.body.dataset.aciertos = String(aciertos);
  }

  function progreso() {
    const n = respuestas.filter((r) => r !== null).length;
    $('#contador').textContent = `Respondidas: ${n} de ${D.elementos.length}`;
    $('#progreso').style.width = `${(100 * n) / D.elementos.length}%`;
  }

  function dibujar() {
    const lista = orden.map((indice, posicion) => {
      const opciones = D.categorias.map((c) => {
        const id = `e${indice}-${c.id}`;
        const radio = crear('input', { type: 'radio', name: `e${indice}`, value: c.id, id, checked: respuestas[indice] === c.id });
        radio.addEventListener('change', () => {
          respuestas[indice] = c.id;
          const item = radio.closest('.item');
          item.classList.remove('correcto', 'incorrecto', 'pendiente');
          item.querySelector('.explicacion').hidden = true;
          progreso();
        });
        return crear('label', { htmlFor: id }, radio, crear('span', { textContent: c.nombre }));
      });
      const item = crear('fieldset', { className: 'item' },
        crear('legend', { textContent: `${posicion + 1}. ${D.elementos[indice].texto}` }),
        crear('div', { className: 'opciones' }, ...opciones),
        crear('p', { className: 'explicacion', hidden: true }));
      item.dataset.indice = String(indice);
      return item;
    });
    $('#elementos').replaceChildren(...lista);
    $('#resultado').hidden = true;
    $('#estado').textContent = 'Responde todas las acciones y pulsa «Comprobar».';
    progreso();
    estado('listo');
  }

  function comprobar() {
    const r = M.evaluar(D.elementos, respuestas);
    const items = [...document.querySelectorAll('.item')];
    if (!r.completo) {
      items.forEach((item) => item.classList.toggle('pendiente', respuestas[Number(item.dataset.indice)] === null));
      $('#estado').textContent = `Faltan ${r.pendientes} ${r.pendientes === 1 ? 'acción' : 'acciones'} por responder; están resaltadas.`;
      items.find((item) => item.classList.contains('pendiente'))?.querySelector('input')?.focus();
      estado('incompleto');
      return;
    }
    for (const item of items) {
      const d = r.detalle[Number(item.dataset.indice)];
      const e = D.elementos[d.indice];
      item.classList.remove('pendiente');
      item.classList.toggle('correcto', d.correcto);
      item.classList.toggle('incorrecto', !d.correcto);
      const p = item.querySelector('.explicacion');
      p.textContent = d.correcto ? `✔ Correcto. ${e.explicacion}` : `✘ Para revisar. Corresponde a «${nombres[d.esperado]}». ${e.explicacion}`;
      p.hidden = false;
    }
    const resumen = M.resumenPorCategoria(D.categorias, r, D.elementos);
    $('#puntaje').textContent = `${r.aciertos} de ${r.total} (${r.porcentaje} %)`;
    $('#barra-resultado').style.width = `${r.porcentaje}%`;
    $('#mensaje').textContent = M.mensajeFinal(r.porcentaje);
    $('#por-categoria').replaceChildren(...D.categorias.map((c) =>
      crear('li', { textContent: `${c.nombre}: ${resumen[c.id].aciertos} de ${resumen[c.id].total}` })));
    $('#resultado').hidden = false;
    $('#reintentar').hidden = r.aciertos === r.total;
    $('#estado').textContent = `Resultado: ${r.aciertos} de ${r.total} correctas. ${M.mensajeFinal(r.porcentaje)}`;
    estado('evaluado', r.aciertos);
  }

  $('#formulario').addEventListener('submit', (e) => { e.preventDefault(); comprobar(); });
  $('#reintentar').addEventListener('click', () => {
    const r = M.evaluar(D.elementos, respuestas);
    respuestas = respuestas.map((v, i) => (r.detalle[i].correcto ? v : null));
    dibujar();
    document.querySelector('.item input:not(:checked)')?.focus();
  });
  $('#reiniciar').addEventListener('click', () => { respuestas.fill(null); dibujar(); reiniciarReloj(); });

  // Cronómetro orientativo: no bloquea la actividad al terminar.
  let restante = (Number(D.minutos) || 7) * 60, intervalo = null;
  const mostrar = () => { $('#reloj').textContent = `${String(Math.floor(restante / 60)).padStart(2, '0')}:${String(restante % 60).padStart(2, '0')}`; };
  function reiniciarReloj() { clearInterval(intervalo); intervalo = null; restante = (Number(D.minutos) || 7) * 60; $('#cronometro').textContent = 'Iniciar tiempo'; mostrar(); }
  $('#cronometro').addEventListener('click', () => {
    if (intervalo) { clearInterval(intervalo); intervalo = null; $('#cronometro').textContent = 'Continuar'; return; }
    $('#cronometro').textContent = 'Pausar';
    intervalo = setInterval(() => {
      restante = Math.max(0, restante - 1); mostrar();
      if (!restante) { clearInterval(intervalo); intervalo = null; $('#cronometro').textContent = 'Tiempo cumplido'; }
    }, 1000);
  });
  reiniciarReloj();
  dibujar();
})();
