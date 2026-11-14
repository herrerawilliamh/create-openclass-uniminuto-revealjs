#!/usr/bin/env node
// WillEdTech Brand · verificación de la copia adoptada por una aplicación.
//
// Este archivo se copia tal cual a cada aplicación (lo hace tools/brand-sync.mjs).
// No necesita acceso al repositorio privado de Brand ni dependencias: lee brand.lock.json
// y comprueba que cada archivo adoptado sigue siendo idéntico al que se sincronizó.
//
//   node scripts/brand-verify.mjs                    comprueba la copia local (CI)
//   node scripts/brand-verify.mjs --brand <ruta>     además compara con un checkout de Brand
//   node scripts/brand-verify.mjs --lock <archivo>   usa otro brand.lock.json
//
// Sale con 1 si hay divergencia; con 0 si todo coincide.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT = /\.(svg|css|js|mjs|json|md|html|txt)$/i;

/** SHA-256 estable entre sistemas: en archivos de texto, CRLF cuenta como LF. */
export function sha256(file) {
  let buf = readFileSync(file);
  if (TEXT.test(file)) buf = Buffer.from(buf.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
  return createHash('sha256').update(buf).digest('hex');
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
}

export function verify({ lockPath, brandPath }) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  const appRoot = dirname(lockPath);
  const problems = [];
  const notes = [];

  for (const f of lock.files ?? []) {
    const dest = join(appRoot, f.to);
    if (!f.sha256) {
      problems.push(`SIN SINCRONIZAR  ${f.to}  (declarado en el lock, falta ejecutar brand-sync)`);
    } else if (!existsSync(dest)) {
      problems.push(`FALTA            ${f.to}`);
    } else if (sha256(dest) !== f.sha256) {
      problems.push(`MODIFICADO       ${f.to}  (difiere de Brand ${lock.brand?.version}; los activos de marca no se editan en la app)`);
    }
  }

  if (brandPath) {
    const manifestPath = join(brandPath, 'brand.manifest.json');
    if (!existsSync(manifestPath)) {
      problems.push(`No hay brand.manifest.json en ${brandPath}`);
    } else {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.version !== lock.brand?.version) {
        notes.push(`Brand va por ${manifest.version}; esta app adoptó ${lock.brand?.version}.`);
      }
      for (const f of lock.files ?? []) {
        const upstream = manifest.files?.[f.from];
        if (!upstream) problems.push(`RETIRADO EN BRAND ${f.from}`);
        else if (f.sha256 && upstream !== f.sha256) problems.push(`DESACTUALIZADO   ${f.to}  (Brand ${manifest.version} cambió ${f.from})`);
      }
    }
  }
  return { lock, problems, notes };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const lockPath = resolve(arg('--lock') ?? 'brand.lock.json');
  if (!existsSync(lockPath)) {
    console.error(`No existe ${lockPath}. Esta app aún no ha adoptado Brand con brand-sync.`);
    process.exit(1);
  }
  const brandPath = arg('--brand') ? resolve(arg('--brand')) : null;
  const { lock, problems, notes } = verify({ lockPath, brandPath });
  const b = lock.brand ?? {};
  const origin = b.repo ? `${b.repo}@${(b.commit ?? '?').slice(0, 12)}` : `manifiesto ${(b.manifestSha256 ?? '?').slice(0, 12)}`;
  console.log(`Brand ${b.version ?? '?'} · ${origin} · ${lock.files?.length ?? 0} archivos adoptados`);
  if (b.provisional || /\+/.test(b.commit ?? '')) console.log('AVISO  Copia tomada de un Brand con cambios sin confirmar: vuelve a sincronizar cuando exista el commit.');
  for (const n of notes) console.log(`AVISO  ${n}`);
  for (const l of lock.local ?? []) console.log(`LOCAL  ${l.path}  (${l.reason})`);
  if (problems.length) {
    for (const p of problems) console.error(p);
    console.error(`\nBRAND_VERIFY=FAIL (${problems.length})`);
    process.exit(1);
  }
  console.log(brandPath ? 'BRAND_VERIFY=PASS (copia local y Brand coinciden)' : 'BRAND_VERIFY=PASS (copia local íntegra)');
}
