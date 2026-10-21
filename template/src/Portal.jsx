import React from 'react';

function slug(input) {
  return String(input || 'curso').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function Portal({ config }) {
  const base = import.meta.env.BASE_URL;
  const course = config.course || {};
  const weeks = [...new Set(config.generation?.activeWeeks || [])]
    .map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= 8)
    .sort((a, b) => a - b);
  const byNumber = new Map((config.weeks || []).map((item) => [Number(item.number), item]));
  const short = slug(course.shortName);
  return <main className="portal">
    <header className="portal-header">
      <p className="overline">UNIMINUTO · OpenClass</p>
      <h1>{course.fullName}</h1>
      <p>{course.description}</p>
      <span className="chip">{course.year} · {weeks.length} semanas publicadas</span>
    </header>
    <section className="card general-card">
      <div><p className="overline">Comenzar aquí</p><h2>Presentación general</h2>
        <p>Introducción, objetivos, metodología y evaluación del curso.</p></div>
      <a className="action-link" href={`${base}general/`}>Abrir presentación general →</a>
    </section>
    <section className="card general-card oc-demo-entry" aria-label="Demostración completa de OpenClass">
      <div><p className="overline">Recurso de referencia · no es una semana del curso</p><h2>Temática de prueba</h2>
        <p>Una sola presentación con los 13 layouts, código con scroll y paginado, video, fórmulas, Mermaid, Chart, actividades y notas.</p></div>
      <div className="oc-portal-extra-links">
        <a className="action-link" href={`${base}demo-completa/`}>VER DEMOSTRACIÓN COMPLETA →</a>
        <a className="action-link" href={`${base}galeria/`}>Galería de 13 layouts →</a>
      </div>
    </section>
    <section className="card general-card" aria-label="Laboratorio interactivo">
      <div><p className="overline">Explorar y practicar</p><h2>Laboratorio de contenidos</h2>
        <p>13 layouts institucionales, cuestionarios locales y simuladores interactivos.</p></div>
      <div className="oc-portal-extra-links">
        <a className="action-link" href={`${base}demo-layouts/`}>Ver 13 layouts →</a>
        <a className="action-link" href={`${base}laboratorio/`}>Probar interacciones →</a>
      </div>
    </section>
    <section className="card general-card oc-guide-entry" aria-label="Guía para crear OpenClass">
      <div><p className="overline">Manual para docentes</p><h2>Cómo crear y enseñar con OpenClass</h2>
        <p>Guía detallada con ejemplos de Markdown, 13 diseños, semanas, actividades, plugins y publicación.</p></div>
      <a className="action-link" href={`${base}guia/`}>Abrir guía del docente →</a>
    </section>
    <h2 className="weeks-title">Presentaciones por semana</h2>
    <section className="week-grid">
      {weeks.map((number) => {
        const week = byNumber.get(number) || {};
        return <article className="card" key={number}>
          <p className="overline">Semana {number}</p>
          <h3>{week.title || `Semana ${number}`}</h3>
          <p>{week.centralTheme || 'Tema de la semana'}</p>
          <a className="action-link" href={`${base}semanas/${short}_semana${number}/`}>Ver presentación →</a>
        </article>;
      })}
    </section>
  </main>;
}
