/**
 * Derivación determinista de docker-compose.gitops.yml a partir de docker-compose.yml (fuente única).
 * - El build del servicio recibe las etiquetas OCI con la revisión aprobada.
 * - TODA referencia a la imagen del servicio (servicio, preparación de roles y migraciones) pasa a
 *   `openclass-live:<versión>-<LIVE_REVISION>` con `pull_policy: never`: se ejecuta exactamente lo construido.
 * Uso:  node scripts/compose-gitops.mjs        → reescribe docker-compose.gitops.yml
 *       verificar-gitops.mjs compara el archivo con esta misma función.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PAYLOAD = Object.freeze(['docker-compose.yml', 'docker-compose.respaldo.yml', 'Dockerfile', '.dockerignore', '.env.example',
  'package.json', 'package-lock.json', 'src', 'public',
  'scripts/hash-password.mjs', 'scripts/init-superusuario.mjs', 'scripts/migrar.mjs', 'scripts/preparar-roles.mjs',
  'scripts/respaldar.mjs', 'scripts/restaurar.mjs', 'scripts/pg-herramientas.mjs']);

export function derivarGitops(base, version) {
  base = base.replace(/\r\n/g, '\n');
  const revision = '${LIVE_REVISION:?Full approved Git SHA required}';
  const imagen = `    image: openclass-live:${version}\n`;
  const fijada = `    image: openclass-live:${version}-${revision}\n    pull_policy: never\n`;
  const buildApp = `      dockerfile: Dockerfile\n${imagen}`;
  if (base.split(buildApp).length !== 2) throw new Error('docker-compose.yml: se esperaba un único build del servicio seguido de su imagen');
  return base
    .replace('# OpenClass Live — stack para /home/openclass-live/ (Docker Compose plugin; adoptable en Dockhand).',
      '# GitOps: generado desde docker-compose.yml; verificar con scripts/verificar-gitops.mjs.')
    .replace(buildApp, [
      '      dockerfile: Dockerfile',
      '      labels:',
      `        org.opencontainers.image.version: "${version}"`,
      `        org.opencontainers.image.revision: ${revision}`,
      '        org.opencontainers.image.source: https://github.com/herrerawilliamh/create-openclass-uniminuto-revealjs',
      '',
    ].join('\n') + fijada)
    .split(imagen).join(fijada);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const raiz = new URL('../', import.meta.url);
  const version = JSON.parse(readFileSync(new URL('package.json', raiz), 'utf8')).version;
  writeFileSync(new URL('docker-compose.gitops.yml', raiz), derivarGitops(readFileSync(new URL('docker-compose.yml', raiz), 'utf8'), version));
  console.log('docker-compose.gitops.yml regenerado');
}
