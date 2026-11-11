/**
 * Gate OBLIGATORIO de integración Docker de Interact (PR). Ejecuta, EN SECUENCIA, las dos suites Docker con
 * INTERACT_TEST_DOCKER=1 e INTERACT_TEST_REQUIRE_DOCKER=1 y falla si Docker no está disponible, si alguna prueba
 * se omite (skipped/todo/cancelled > 0), si falla una aserción o si el número de pruebas ejecutadas es menor
 * que el esperado (una suite vaciada no pasa). Solo contenedores, redes y credenciales sintéticos con prefijo
 * aleatorio propio (oc-t-* / oc-p-*): nunca toca recursos preexistentes. El proveedor «administrado» es SIMULADO
 * (DNS + TLS en contenedores): no certifica a ningún proveedor real.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// El orden importa: docker-redes construye la imagen openclass-live:0.4.0 que reutiliza docker-proxy.
const SUITES = [{ archivo: 'tests/docker-redes.test.mjs', minimo: 7 }, { archivo: 'tests/docker-proxy.test.mjs', minimo: 4 }];

export function evaluarTap(salida, minimo) {
  const n = (k) => Number(new RegExp(`^# ${k} ([0-9]+)[ \\t\\r]*$`, 'm').exec(salida)?.[1] ?? NaN);
  const r = { pass: n('pass'), fail: n('fail'), skipped: n('skipped'), todo: n('todo'), cancelled: n('cancelled') };
  const problemas = [];
  if (Object.values(r).some(Number.isNaN)) problemas.push('resumen TAP ilegible');
  else {
    if (r.fail || r.cancelled) problemas.push(`${r.fail} fallidas, ${r.cancelled} canceladas`);
    if (r.skipped || r.todo) problemas.push(`${r.skipped} omitidas, ${r.todo} pendientes (no se acepta omitir)`);
    if (r.pass < minimo) problemas.push(`solo ${r.pass} pruebas pasaron (mínimo ${minimo})`);
  }
  return { ...r, problemas };
}

export function ejecutar() {
  const info = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8' });
  if (info.status !== 0) { process.stderr.write('Docker no disponible: el gate Docker es obligatorio.\n'); return 1; }
  const env = { ...process.env, INTERACT_TEST_DOCKER: '1', INTERACT_TEST_REQUIRE_DOCKER: '1' };
  let fallos = 0;
  for (const { archivo, minimo } of SUITES) {
    const r = spawnSync(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=tap', archivo], { cwd: raiz, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    process.stdout.write(r.stdout); process.stderr.write(r.stderr);
    const e = evaluarTap(r.stdout, minimo);
    if (r.status !== 0 || e.problemas.length) { fallos += 1; process.stderr.write(`GATE DOCKER ROJO ${archivo}: ${e.problemas.join('; ') || `código ${r.status}`}\n`); }
    else process.stdout.write(`GATE DOCKER VERDE ${archivo}: ${e.pass} pruebas, 0 omitidas\n`);
  }
  return fallos ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(ejecutar());
