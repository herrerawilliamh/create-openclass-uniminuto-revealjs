import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('marca familiar W | Interact y favicon con el mismo símbolo', () => {
  const favicon = read('favicon.svg');
  const logo = read('assets/marca/willedtech-w.svg');
  assert.match(logo, /viewBox="0 0 810 810"/);
  assert.match(favicon, /viewBox="0 0 810 810"/);
  assert.match(favicon, /#F27405/);
  for (const page of ['docente/index.html', 'cuenta/index.html', 'vincular/index.html', 'index.html']) {
    const html = read(page);
    assert.match(html, /\/assets\/marca\/willedtech-w\.svg/);
    assert.match(html, /\/favicon\.svg/);
    assert.match(html, /<h1 class="marca-nombre">Interact<\/h1>/);
    assert.match(html, /<span class="marca-firma">by WillEdTech<\/span>/);
    assert.match(html, /\/assets\/marca\/interact-shell\.css/);
  }
});

test('navegación separada y controles conservados', () => {
  const html = read('docente/index.html');
  const headerEnd = html.indexOf('</header>');
  assert.ok(headerEnd >= 0);
  assert.ok(html.indexOf('id="nav-vistas"') > headerEnd);
  assert.ok(html.indexOf('id="nav-secciones"') > headerEnd);
  for (const id of ['titulo-panel','conexion','chip-usuario','btn-salir','ir-salas','ir-historial','ir-admin','vista-login','vista-salas','vista-historial','vista-admin']) {
    assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) ?? []).length, 1, id);
  }
  assert.doesNotMatch(html, /Encuestas y preguntas en vivo/);
  assert.doesNotMatch(html, /Qué se conserva y por cuánto tiempo/);
  assert.match(html, /La paginación no modifica el plazo de conservación/);
});

test('búsqueda de usuarios conserva permisos de suspensión y reactivación', () => {
  const html = read('docente/index.html');
  assert.match(html, /id="buscar-usuarios"/);
  assert.match(html, /id="resumen-usuarios"/);
  const panel = read('assets/cuenta-panel.mjs');
  assert.match(panel, /function filtrarUsuarios/);
  assert.match(panel, /'input', filtrarUsuarios/);
  assert.match(panel, /onclick: \(\) => cambiarEstado\(x\)/);
});
