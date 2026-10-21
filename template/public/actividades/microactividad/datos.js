/*
 * DATOS DE LA MICROACTIVIDAD — el único archivo que hay que editar para cambiar de tema.
 * - categorias: entre 2 y 5 grupos (id corto sin espacios + nombre visible).
 * - elementos: cada afirmación indica su categoría correcta y una explicación breve.
 * - minutos: tiempo sugerido (el cronómetro es orientativo, no bloquea la actividad).
 * No incluyas datos personales: la actividad funciona en el navegador y no envía respuestas.
 */
window.OC_ACTIVIDAD = {
  titulo: 'Clasifica los momentos de una sesión activa',
  objetivo: 'Reconocer qué momento de la secuencia didáctica cumple cada acción docente.',
  instrucciones: [
    'Lee cada acción y elige el momento de la sesión al que pertenece.',
    'Pulsa «Comprobar» cuando hayas respondido todas las acciones.',
    'Revisa la retroalimentación y vuelve a intentar las acciones marcadas para revisar.',
  ],
  minutos: 7,
  categorias: [
    { id: 'activar', nombre: 'Activar saberes previos' },
    { id: 'practicar', nombre: 'Practicar y aplicar' },
    { id: 'evaluar', nombre: 'Evaluar y retroalimentar' },
  ],
  elementos: [
    { texto: 'Lanzar una pregunta abierta sobre una experiencia cotidiana relacionada con el tema.', categoria: 'activar',
      explicacion: 'Conecta el tema nuevo con lo que el grupo ya sabe antes de explicar.' },
    { texto: 'Mostrar una imagen problemática y pedir hipótesis en el chat.', categoria: 'activar',
      explicacion: 'Las hipótesis iniciales revelan ideas previas y despiertan curiosidad.' },
    { texto: 'Resolver en parejas un ejercicio guiado con el material de la sesión.', categoria: 'practicar',
      explicacion: 'Aplicar el concepto con apoyo convierte la explicación en desempeño.' },
    { texto: 'Modificar un ejemplo de código y observar qué cambia en el resultado.', categoria: 'practicar',
      explicacion: 'Experimentar con un ejemplo permite construir el concepto haciendo.' },
    { texto: 'Usar un simulador para probar distintos valores de entrada.', categoria: 'practicar',
      explicacion: 'El simulador ofrece práctica segura y repetible.' },
    { texto: 'Aplicar un cuestionario breve con retroalimentación inmediata.', categoria: 'evaluar',
      explicacion: 'Es evaluación formativa: informa al estudiante y al docente sobre el avance.' },
    { texto: 'Pedir que cada estudiante escriba en una frase lo que aprendió hoy.', categoria: 'evaluar',
      explicacion: 'El ticket de salida evidencia la comprensión al cerrar la sesión.' },
    { texto: 'Comparar las respuestas con una rúbrica sencilla y comentar los criterios.', categoria: 'evaluar',
      explicacion: 'La rúbrica hace visibles los criterios de calidad y orienta la mejora.' },
  ],
};
