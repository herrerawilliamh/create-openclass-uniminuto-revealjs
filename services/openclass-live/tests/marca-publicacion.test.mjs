import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { huellaGit, esBinario } from '../scripts/huella.mjs';

const raiz = fileURLToPath(new URL('../', import.meta.url));
const leer = (f) => readFileSync(path.join(raiz, f), 'utf8');

test('la marca está clasificada, sin autorización y sin metadatos internos del repositorio de origen', () => {
  const origen = JSON.parse(leer('public/assets/marca/ORIGEN.json'));
  assert.equal(origen.BRAND_PUBLICATION_AUTHORIZED, 'NO');
  assert.equal(origen.autorizacionExpresaDelPropietario, null);
  for (const r of Object.values(origen.recursos)) assert.equal(r.redistribucionPublica, 'NO');
  for (const f of ['public/assets/marca/ORIGEN.json', 'docs/BRANDING-0.3.0.md', 'docs/BRAND-PUBLICACION.md',
    'public/assets/marca/willedtech.css', 'public/favicon.svg']) {
    const t = leer(f);
    assert.doesNotMatch(t, /willedtech\/brand/i, `${f}: nombre del repositorio privado`);
    assert.doesNotMatch(t, /\b[a-f0-9]{40}\b/, `${f}: SHA interno`);
    assert.doesNotMatch(t, /fechaCommit/, `${f}: fecha de commit interna`);
  }
});

test('cada familia tipográfica incluye su licencia OFL 1.1 y aviso de copyright', () => {
  const dir = path.join(raiz, 'public/assets/marca/fuentes');
  const avisos = readFileSync(path.join(dir, 'AVISOS.txt'), 'utf8');
  const familias = { 'atkinson-hyperlegible': /Braille Institute of America/, 'merriweather-sans': /Merriweather Project Authors/,
    opendyslexic: /Abbie Gonzalez[\s\S]*Reserved Font Name OpenDyslexic/ };
  for (const [slug, aviso] of Object.entries(familias)) {
    const lic = readFileSync(path.join(dir, `OFL-${slug}.txt`), 'utf8');
    assert.match(lic, aviso);
    assert.match(lic, /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.ok(avisos.includes(`OFL-${slug}.txt`) || avisos.includes('OFL-*.txt'), slug);
    assert.ok(readdirSync(dir).some((n) => n.startsWith(slug) && n.endsWith('.woff2')));
  }
});

test('huella: los binarios se hashean por bytes y el texto con CRLF→LF', () => {
  const bytes = Buffer.from([0xff, 0xfe, 0x0d, 0x0a, 0x80, 0x00]);
  assert.equal(esBinario('a.woff2'), true);
  assert.notEqual(huellaGit('a.woff2', bytes), huellaGit('a.txt', bytes), 'el binario no pasa por UTF-8');
  assert.equal(huellaGit('a.txt', Buffer.from('x\r\ny')), huellaGit('a.txt', Buffer.from('x\ny')));
  assert.notEqual(huellaGit('a.woff2', Buffer.from('x\r\ny')), huellaGit('a.woff2', Buffer.from('x\ny')));
});
