import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../public/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('estructura de cabecera y elementos de marca 3.1.0', () => {
  for (const page of ['docente/index.html', 'cuenta/index.html', 'vincular/index.html', 'index.html']) {
    const html = read(page);
    assert.match(html, /\/favicon\.svg/);
    assert.match(html, /<a class="wt-header__brand" href="[^"]+" aria-label="WillEdTech Interact, ir al inicio">/);
    assert.match(html, /class="wt-lockup wt-lockup--full" src="\/assets\/marca\/interact-horizontal\.svg" alt=""/);
    assert.match(html, /class="wt-lockup wt-lockup--compact" src="\/assets\/marca\/interact-compacto\.svg" alt=""/);
    assert.match(html, /\/assets\/marca\/willedtech-header\.css/);
    assert.match(html, /\/assets\/marca\/willedtech-motion\.css/);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'un solo h1');
    assert.doesNotMatch(html, /marca-nombre|marca-firma|marca-divisor|wt-monograma|interact-simbolo/);
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
