import React from 'react';

function slug(input) {
  return String(input || 'curso').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// Tres recorridos complementarios: mismas presentaciones y actividades, resultados equivalentes.
// Son sugerencias de estudio, no modalidades institucionales (la nota final del bloque lo aclara).
const RECORRIDOS = [
  ['Sincrónico por Zoom o Teams', 'Participa en la sesión en vivo con tu docente: responde la activación en el chat o de forma oral, trabaja las actividades con tus compañeros y resuelve dudas en el momento.'],
  ['Asincrónico guiado', 'Recorre la presentación a tu ritmo y en orden: si la semana incluye videos, responde antes la pregunta propuesta; realiza la actividad práctica y entrega la evidencia que indique tu docente en la fecha prevista.'],
  ['Aprendizaje autónomo', 'Vuelve a la presentación cuando lo necesites, repite las actividades para practicar y anota tus preguntas para la siguiente sesión. Las actividades funcionan en tu navegador y no envían tus respuestas a ningún servidor.'],
];

// Recursos de referencia (sobre todo para docentes): bloque secundario, sin quitar ninguna ruta.
const recursos = (base) => [
  [`${base}demo-completa/`, 'VER DEMOSTRACIÓN COMPLETA →', 'Presentación de referencia «Temática de prueba» con todos los recursos. No es una semana del curso.', 'oc-demo-entry'],
  [`${base}galeria/`, 'Galería de 13 layouts →', 'Vista previa de cada diseño de diapositiva con su código.'],
  [`${base}demo-layouts/`, 'Ejemplo con los 13 layouts →', 'Una presentación breve que recorre todos los diseños.'],
  [`${base}laboratorio/`, 'Laboratorio de interacciones →', 'Cuestionarios locales y simuladores para explorar.'],
  [`${base}guia/`, 'Guía del docente →', 'Cómo crear, diseñar y publicar las semanas del curso.', 'oc-guide-entry'],
];

export function Portal({ config }) {
  const base = import.meta.env.BASE_URL;
  const course = config.course || {};
  const weeks = [...new Set(config.generation?.activeWeeks || [])]
    .map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 8)
    .sort((a, b) => a - b);
  const byNumber = new Map((config.weeks || []).map((item) => [Number(item.number), item]));
  const short = slug(course.shortName);
  const publicadas = weeks.length === 1 ? '1 semana publicada' : `${weeks.length} semanas publicadas`;
  return <main className="portal">
    <a className="oc-skip" href="#ruta">Ir a las semanas publicadas</a>
    <header className="portal-header">
      <p className="overline">UNIMINUTO · OpenClass</p>
      <h1>{course.fullName}</h1>
      {course.description && <p>{course.description}</p>}
      <p className="oc-portal-orientacion">Aquí encuentras las presentaciones del curso. Empieza por la presentación general,
        avanza por las semanas en orden y vuelve a consultarlas cuando lo necesites.</p>
      <span className="chip">{course.year} · {publicadas}</span>
    </header>

    <section className="card oc-portal-bloque" id="comenzar" aria-labelledby="oc-comenzar">
      <p className="overline">Comenzar aquí</p>
      <h2 id="oc-comenzar">Antes de la primera semana</h2>
      <ol className="oc-pasos">
        <li><h3>Presentación general</h3>
          <p>Introducción, objetivos, metodología y evaluación del curso.</p>
          <a className="action-link" href={`${base}general/`}>Abrir presentación general →</a></li>
        <li><h3>Cómo usar el material</h3>
          <p>Avanza con las flechas del teclado, la barra espaciadora o los botones de la barra inferior.
            La tecla Esc muestra todas las diapositivas y, en las diapositivas internas, el icono de la casa regresa a este portal.</p></li>
        <li><h3>Ruta de aprendizaje</h3>
          <p>Las semanas se construyen una sobre otra: sigue el orden y repasa la anterior antes de empezar.</p>
          <a className="action-link" href="#ruta">Ver las semanas publicadas ↓</a></li>
      </ol>
    </section>

    <section className="oc-portal-seccion" id="ruta" aria-labelledby="oc-ruta">
      <p className="overline">Ruta de aprendizaje</p>
      <h2 id="oc-ruta" className="weeks-title">Semanas publicadas</h2>
      <p className="oc-portal-intro">Cada presentación parte de lo trabajado en la semana anterior y permanece publicada
        para que la repases después de la sesión.</p>
      {weeks.length ? <ol className="week-grid">
        {weeks.map((number, i) => {
          const week = byNumber.get(number) || {};
          const title = week.title || `Semana ${number}`;
          return <li className="card oc-week" key={number}>
            <p className="overline">Semana {number}</p>
            <h3>{title}</h3>
            {week.centralTheme && <p className="oc-week-tema">{week.centralTheme}</p>}
            <p className="oc-week-continuidad">{i ? `Continúa la semana ${weeks[i - 1]}` : 'Punto de partida de la ruta'}</p>
            <a className="action-link" href={`${base}semanas/${short}_semana${number}/`}
              aria-label={`Abrir la presentación de la semana ${number}: ${title}`}>Abrir semana {number} →</a>
          </li>;
        })}
      </ol> : <p className="card oc-portal-vacio">Aún no hay semanas publicadas. Mientras tanto, revisa la presentación general.</p>}
    </section>

    <section className="oc-portal-seccion" id="recorridos" aria-labelledby="oc-recorridos">
      <p className="overline">Cómo estudiar cada semana</p>
      <h2 id="oc-recorridos">Tres recorridos complementarios</h2>
      <p className="oc-portal-intro">Los tres usan las mismas presentaciones y actividades y buscan los mismos resultados
        de aprendizaje. Combínalos según tu horario y tu conexión.</p>
      <ul className="oc-recorridos">
        {RECORRIDOS.map(([titulo, texto]) => <li className="card" key={titulo}><h3>{titulo}</h3><p>{texto}</p></li>)}
      </ul>
      <p className="oc-portal-nota">Son sugerencias para organizar tu estudio dentro del mismo curso; no reemplazan la
        modalidad ni el calendario oficiales. Las fechas, evidencias y criterios de evaluación los indica tu docente.</p>
    </section>

    <section className="oc-portal-seccion oc-portal-recursos" id="recursos" aria-labelledby="oc-recursos">
      <p className="overline">Recursos complementarios</p>
      <h2 id="oc-recursos">Material de referencia</h2>
      <p className="oc-portal-intro">Muestran cómo se construyen las presentaciones; son útiles sobre todo para docentes.</p>
      <ul>
        {recursos(base).map(([href, texto, detalle, clase]) => <li className={clase} key={href}>
          <a className="action-link" href={href}>{texto}</a><span>{detalle}</span>
        </li>)}
      </ul>
    </section>
  </main>;
}
