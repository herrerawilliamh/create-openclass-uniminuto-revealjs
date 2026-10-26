/**
 * Privacidad de la solución en pantalla y en el PDF (utilidad compartida por la prueba e2e y por la
 * verificación de un curso real en copia temporal). Abre una presentación en vista normal y en
 * `?print-pdf`, genera el PDF con Chrome y extrae su texto con pdftotext o, en su defecto, pypdf.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

/** Texto de un PDF (espacios normalizados) o null si no hay extractor disponible. */
export function textoPdf(archivo) {
  const intentos = [
    ['pdftotext', ['-enc', 'UTF-8', archivo, '-']],
    ['python', ['-I', '-c', 'import sys, pypdf; sys.stdout.reconfigure(encoding="utf-8"); print("\\n".join(p.extract_text() or "" for p in pypdf.PdfReader(sys.argv[1]).pages))', archivo]],
  ];
  for (const [cmd, args] of intentos) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (!r.error && r.status === 0) return { extractor: cmd, texto: r.stdout.normalize('NFC').replace(/\s+/g, ' ') };
  }
  return null;
}

const VISIBLE = `(n) => n.getClientRects().length > 0 && getComputedStyle(n).display !== 'none' && getComputedStyle(n).visibility !== 'hidden'`;

/** Estado de la solución en la diapositiva `idEncuesta` (vista normal) y en el PDF completo. */
export async function inspeccionar(navegador, urlPresentacion, { idEncuesta, pdf }) {
  const normal = await navegador.pagina({ ancho: 1280, alto: 720 });
  await normal.ir(idEncuesta ? `${urlPresentacion}#/${idEncuesta}` : urlPresentacion);
  await normal.esperarA(`window.OpenClass?.deck?.isReady?.()`, { timeout: 30000 });
  // Sin id: la primera diapositiva con encuesta (las demás están ocultas por Reveal y no prueban nada).
  if (!idEncuesta) {
    await normal.evaluar(`(() => { const d = window.OpenClass.deck; const s = d.getSlides().find((x) => x.querySelector('.oc-live-encuesta')); const i = d.getIndices(s); d.slide(i.h, i.v); })()`);
  }
  await normal.esperarA(`window.OpenClass.deck.getCurrentSlide().querySelector('.oc-live-encuesta')`);
  await new Promise((r) => setTimeout(r, 800));
  const vista = await normal.evaluar(`(() => { const vis = ${VISIBLE};
    const enc = [...document.querySelectorAll('.oc-live-encuesta')];
    return { live: Boolean(document.querySelector('.oc-live-control')),
      explicaciones: enc.flatMap((e) => [...e.querySelectorAll('.oc-live-explicacion')]).length,
      explicacionesVisibles: enc.flatMap((e) => [...e.querySelectorAll('.oc-live-explicacion')]).filter(vis).length,
      enunciadosVisibles: enc.map((e) => e.querySelector('.oc-live-enunciado')).filter((n) => n && vis(n)).length,
      encuestas: enc.length }; })()`);
  await normal.cerrar?.();

  const impresion = await navegador.pagina({ ancho: 1280, alto: 720 });
  await impresion.ir(`${urlPresentacion}?print-pdf`);
  await impresion.esperarA(`document.documentElement.classList.contains('reveal-print') && window.OpenClass?.deck?.isReady?.()`, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1500));
  await impresion.send('Emulation.setEmulatedMedia', { media: 'print' });
  const dom = await impresion.evaluar(`(() => { const vis = ${VISIBLE};
    return { explicacionesVisibles: [...document.querySelectorAll('.oc-live-encuesta .oc-live-explicacion')].filter(vis).length,
      opcionesVisibles: [...document.querySelectorAll('.oc-live-encuesta .oc-live-opciones > li')].filter(vis).length,
      capasLive: document.querySelectorAll('.oc-live-control, .oc-live-menu, .oc-live-capa, .oc-live-banda, .oc-live-participa').length,
      enlacesVideo: [...document.querySelectorAll('.oc-pdf-medio a')].map((a) => a.href),
      paginas: document.querySelectorAll('.pdf-page').length, total: window.OpenClass.deck.getTotalSlides() }; })()`);
  const { data } = await impresion.send('Page.printToPDF', { preferCSSPageSize: true, printBackground: true });
  const bytes = Buffer.from(data, 'base64');
  writeFileSync(pdf, bytes);
  await impresion.cerrar?.();
  return { vista, dom, bytes: bytes.length, texto: textoPdf(pdf) };
}
