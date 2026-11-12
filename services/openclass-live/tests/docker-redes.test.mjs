/**
 * Integración Docker de los DOS modos de PostgreSQL soportados (P1 «PostgreSQL administrado»).
 *   A) dedicado: base en la red interna «interact-db» (sin salida, sin puertos); preparar → migrar → respaldar.
 *   B) administrado: base FUERA de las redes del stack, con TLS; migrar y respaldar por la red «interact-salida».
 *
 * Topología de ensayo, NO un proveedor real: la «base administrada» es un contenedor PostgreSQL 16 con TLS propio
 * (CA de prueba) publicado en el host y alcanzado por el nombre db-externo.test (host-gateway). No certifica la
 * compatibilidad con ningún proveedor concreto; demuestra red, DNS, salida y validación de certificado.
 *
 * Se ejecuta solo con INTERACT_TEST_DOCKER=1 (construye imágenes y levanta contenedores; usa el proyecto Compose
 * efímero «oc-t-<aleatorio>» y lo desmonta). Con INTERACT_TEST_REQUIRE_DOCKER=1 la ausencia de Docker es un fallo.
 * No toca ningún stack, volumen ni red ajenos al proyecto efímero.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verificarSuma } from '../scripts/autenticidad-respaldo.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// El gate Docker debe ejecutar la misma versión que Compose acaba de construir.
const IMG = `openclass-live:${JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}`;
const docker = (args, opciones = {}) => spawnSync('docker', args, { encoding: 'utf8', cwd: RAIZ, ...opciones });
const hay = !docker(['info', '--format', '{{.ServerVersion}}']).status;
const exigir = process.env.INTERACT_TEST_REQUIRE_DOCKER === '1';
const activo = process.env.INTERACT_TEST_DOCKER === '1' || exigir;
const omitir = !activo ? 'defina INTERACT_TEST_DOCKER=1 (integración Docker)' : (!hay && !exigir ? 'Docker no disponible' : false);

const P = `oc-t-${randomBytes(4).toString('hex')}`;
const claveAdmin = randomBytes(24).toString('base64url');
const claves = { migrador: randomBytes(24).toString('base64url'), app: randomBytes(24).toString('base64url'), respaldo: randomBytes(24).toString('base64url') };
const tmp = mkdtempSync(path.join(tmpdir(), 'interact-docker-'));
const respaldos = path.join(tmp, 'respaldos');
const certs = path.join(tmp, 'certs');
const sobrescritura = path.join(tmp, 'override.yml');
const fijas = ['interact-db', 'openclass-live'];
let puertoExterno = 0;

const entorno = (extra = {}) => ({
  ...process.env, COMPOSE_PROJECT_NAME: P, COMPOSE_PROFILES: 'postgres-dedicado',
  APP_URL: 'https://interact.test', APP_HOST: 'interact.test', SESSION_SECRET: randomBytes(32).toString('hex'),
  POSTGRES_ADMIN_PASSWORD: claveAdmin,
  DATABASE_ADMIN_URL: `postgres://postgres:${claveAdmin}@interact-db:5432/postgres`,
  INTERACT_DB_MIGRATOR_PASSWORD: claves.migrador, INTERACT_DB_APP_PASSWORD: claves.app, INTERACT_DB_BACKUP_PASSWORD: claves.respaldo,
  DATABASE_MIGRATION_URL: `postgres://interact_migrador:${claves.migrador}@interact-db:5432/interact`,
  DATABASE_URL: `postgres://interact_app:${claves.app}@interact-db:5432/interact`,
  DATABASE_BACKUP_URL: `postgres://interact_respaldo:${claves.respaldo}@interact-db:5432/interact`,
  TRUSTED_PROXY_CIDRS: '172.30.77.2/32', BACKUP_HOST_DIR: respaldos, ...extra,
});
const compose = (args, extra = {}, archivos = ['docker-compose.yml', 'docker-compose.respaldo.yml']) =>
  docker(['compose', ...archivos.flatMap((f) => ['-f', f]), ...args], { env: entorno(extra) });
const ok = (r, ctx) => assert.equal(r.status, 0, `${ctx}\n${r.stdout}\n${r.stderr}`);
const salida = (r) => `${r.stdout}\n${r.stderr}`;

// Cliente efímero con la imagen del servicio: ejecuta JavaScript dentro de una red concreta.
// En Linux (CI) el usuario del contenedor (uid 1000) no coincide con el del ejecutor: la carpeta de prueba se abre a
// todos y, tras cada respaldo, un contenedor efímero (root) devuelve el acceso de lectura/borrado al ejecutor.
// Solo afecta a la carpeta temporal sintética de la prueba; el despliegue real exige 700 y propietario uid 1000.
const abrirRespaldos = () => { if (process.platform === 'linux') chmodSync(respaldos, 0o777); };
const liberarRespaldos = () => { if (process.platform === 'linux') docker(['run', '--rm', '--user', '0', '-v', `${respaldos}:/r`, '--entrypoint', 'chmod', IMG, '-R', 'a+rwX', '/r']); };
const enRed = (red, js, extra = []) => docker(['run', '--rm', '--network', red, ...extra, '--entrypoint', 'node', IMG, '-e', js]);

before(() => {
  if (omitir) return;
  for (const n of fijas) assert.ok(!docker(['ps', '-a', '--filter', `name=^${n}$`, '--format', '{{.Names}}']).stdout.trim(), `ya existe un contenedor «${n}»: no se toca; deténgalo manualmente o use otra máquina`);
  mkdirSync(respaldos, { recursive: true }); mkdirSync(certs, { recursive: true }); abrirRespaldos();
  const build = compose(['build', 'openclass-live', 'interact-respaldo']);
  ok(build, 'construcción de imágenes');
});

after(() => {
  if (omitir) return;
  compose(['down', '--volumes', '--remove-orphans'], { COMPOSE_PROFILES: 'postgres-dedicado,postgres-administrado,respaldo-dedicado,respaldo-administrado' });
  docker(['rm', '-f', `${P}-db-externo`]);
  docker(['network', 'rm', `${P}_interact-db`, `${P}_interact-salida`]);
  liberarRespaldos();
  rmSync(tmp, { recursive: true, force: true });
});

test('Compose: ningún servicio publica puertos en ninguno de los dos modos', { skip: omitir }, () => {
  for (const perfiles of ['postgres-dedicado,respaldo-dedicado', 'postgres-administrado,respaldo-administrado']) {
    const r = compose(['config', '--format', 'json'], { COMPOSE_PROFILES: perfiles });
    ok(r, `config ${perfiles}`);
    const cfg = JSON.parse(r.stdout);
    for (const [nombre, s] of Object.entries(cfg.services)) assert.equal(s.ports, undefined, `${nombre} no debe publicar puertos (${perfiles})`);
    assert.equal(cfg.networks['interact-db'].internal, true, 'la red de la base dedicada es interna');
    if (perfiles.startsWith('postgres-dedicado')) {
      assert.deepEqual(Object.keys(cfg.services).filter((n) => /migrar|respaldo/.test(n)).sort(), ['interact-migrar', 'interact-respaldo']);
      for (const n of ['interact-db', 'interact-db-preparar', 'interact-migrar', 'interact-respaldo']) {
        assert.deepEqual(Object.keys(cfg.services[n].networks), ['interact-db'], `${n} solo en la red interna`);
      }
    } else {
      assert.deepEqual(Object.keys(cfg.services).filter((n) => /migrar|respaldo/.test(n)).sort(), ['interact-migrar-administrado', 'interact-respaldo-administrado']);
      assert.ok(!cfg.services['interact-db'], 'sin base dedicada en el modo administrado');
      for (const n of ['interact-migrar-administrado', 'interact-respaldo-administrado']) {
        assert.deepEqual(Object.keys(cfg.services[n].networks), ['interact-salida'], `${n} usa la red con salida`);
      }
      assert.notEqual(cfg.networks['interact-salida'].internal, true, 'la red de salida NO es interna (DNS + salida)');
    }
    for (const [nombre, s] of Object.entries(cfg.services)) {
      assert.ok(!Object.keys(s.networks ?? {}).includes('interact-salida') || /administrado/.test(nombre), `${nombre}: la base dedicada y su entorno nunca tocan la red con salida`);
    }
  }
});

test('modo A (dedicado): preparar → migrar → base solo en red interna, sin puertos, accesos no autorizados rechazados', { skip: omitir, timeout: 300_000 }, () => {
  ok(compose(['up', '-d', '--wait', 'interact-db']), 'arranque de PostgreSQL dedicado');
  const m = compose(['run', '--rm', '-e', 'DB_CONNECT_WAIT_SECONDS=30', 'interact-migrar']);
  ok(m, 'preparar + migrar');
  assert.match(m.stdout, /"version":\s*\d+/);

  const insp = JSON.parse(docker(['inspect', 'interact-db']).stdout)[0];
  assert.deepEqual(insp.HostConfig.PortBindings ?? {}, {}, 'sin puertos publicados');
  assert.deepEqual(Object.keys(insp.NetworkSettings.Networks), [`${P}_interact-db`], 'solo la red privada');
  assert.equal(docker(['network', 'inspect', `${P}_interact-db`, '--format', '{{.Internal}}']).stdout.trim(), 'true');

  // Credenciales y privilegios: contraseña errónea y DDL de la aplicación se rechazan.
  const mala = enRed(`${P}_interact-db`, `const pg=require('pg');(async()=>{const c=new pg.Client({connectionString:'postgres://interact_app:incorrecta@interact-db:5432/interact'});try{await c.connect();console.log('CONECTO')}catch(e){console.log('RECHAZO '+e.code)}})()`);
  assert.match(mala.stdout, /RECHAZO 28P01/, salida(mala));
  const ddl = enRed(`${P}_interact-db`, `const pg=require('pg');(async()=>{const c=new pg.Client({connectionString:process.env.U});await c.connect();try{await c.query('CREATE TABLE interact.intruso(x int)');console.log('CREO')}catch(e){console.log('RECHAZO '+e.code)}await c.end()})()`,
    ['-e', `U=${entorno().DATABASE_URL}`]);
  assert.match(ddl.stdout, /RECHAZO 42501/, `la aplicación no tiene DDL\n${salida(ddl)}`);
  // La red interna no tiene salida a Internet.
  const fuera = enRed(`${P}_interact-db`, `fetch('http://1.1.1.1',{signal:AbortSignal.timeout(4000)}).then(()=>console.log('SALIO')).catch(()=>console.log('SIN-SALIDA'))`);
  assert.match(fuera.stdout, /SIN-SALIDA/, salida(fuera));
});

test('modo A (dedicado): respaldo con la credencial de solo lectura', { skip: omitir, timeout: 300_000 }, () => {
  const r = compose(['run', '--rm', 'interact-respaldo'], { COMPOSE_PROFILES: 'postgres-dedicado,respaldo-dedicado' });
  liberarRespaldos();
  ok(r, 'respaldo dedicado');
  const copias = readdirSync(respaldos).filter((f) => f.endsWith('.dump'));
  assert.equal(copias.length, 1);
  verificarSuma(path.join(respaldos, copias[0]));
  for (const f of readdirSync(respaldos)) rmSync(path.join(respaldos, f));
});

// ---------------------------------------------------------------------------------------------------------------
function crearCertificados() {
  const sh = [
    'apk add --no-cache openssl >/dev/null', 'cd /c',
    'openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.crt -days 2 -subj "/CN=Interact Test CA" 2>/dev/null',
    'openssl req -newkey rsa:2048 -nodes -keyout server.key -out server.csr -subj "/CN=db-externo.test" 2>/dev/null',
    'printf "subjectAltName=DNS:db-externo.test" > ext.cnf',
    'openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt -days 2 -extfile ext.cnf 2>/dev/null',
    'chmod 644 *',
  ].join(' && ');
  ok(docker(['run', '--rm', '-v', `${certs}:/c`, 'alpine:3.24', 'sh', '-c', sh]), 'certificados de ensayo');
  writeFileSync(path.join(certs, 'pg_hba.conf'), 'local all all trust\nhostssl all all all scram-sha-256\nhostnossl all all all reject\n');
}

function levantarBaseExterna() {
  crearCertificados();
  const arranque = 'cp /c/server.crt /c/server.key /var/lib/postgresql/ && chown postgres:postgres /var/lib/postgresql/server.* && chmod 600 /var/lib/postgresql/server.key && '
    + 'exec docker-entrypoint.sh postgres -c ssl=on -c ssl_cert_file=/var/lib/postgresql/server.crt -c ssl_key_file=/var/lib/postgresql/server.key -c hba_file=/c/pg_hba.conf -c password_encryption=scram-sha-256';
  ok(docker(['run', '-d', '--name', `${P}-db-externo`, '-p', '0.0.0.0::5432', '-v', `${certs}:/c:ro`,
    '-e', 'POSTGRES_USER=proveedor_admin', '-e', `POSTGRES_PASSWORD=${claveAdmin}`, '-e', 'POSTGRES_DB=postgres',
    '--entrypoint', 'sh', 'postgres:16.10-alpine', '-c', arranque]), 'base externa de ensayo');
  for (let i = 0; i < 60; i++) {
    if (!docker(['exec', `${P}-db-externo`, 'pg_isready', '-q', '-U', 'proveedor_admin', '-d', 'postgres']).status) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  puertoExterno = Number(/:(\d+)\s*$/m.exec(docker(['port', `${P}-db-externo`, '5432/tcp']).stdout)?.[1]);
  assert.ok(puertoExterno > 0, 'puerto de la base externa');
  writeFileSync(sobrescritura, ['services:', '  interact-migrar-administrado:', '    extra_hosts: ["db-externo.test:host-gateway", "otro-nombre.test:host-gateway"]',
    '  interact-db-preparar-administrado:', '    extra_hosts: ["db-externo.test:host-gateway"]',
    '  interact-respaldo-administrado:', '    extra_hosts: ["db-externo.test:host-gateway", "otro-nombre.test:host-gateway"]', ''].join('\n'));
}

const urlExterna = (usuario, clave, host = 'db-externo.test', base = 'interact') => `postgres://${usuario}:${encodeURIComponent(clave)}@${host}:${puertoExterno}/${base}`;
const ARCHIVOS_B = ['docker-compose.yml', 'docker-compose.respaldo.yml', sobrescritura];
const entornoB = (extra = {}) => ({
  COMPOSE_PROFILES: 'postgres-administrado,respaldo-administrado,postgres-preparar-administrado', DATABASE_MIGRATION_URL: urlExterna('interact_migrador', claves.migrador),
  DATABASE_BACKUP_URL: urlExterna('interact_respaldo', claves.respaldo), DB_SSL: 'verificado',
  DATABASE_ADMIN_URL: urlExterna('proveedor_admin', claveAdmin, 'db-externo.test', 'postgres'),
  DB_SSL_CA_FILE: '/etc/interact/db-ca.pem', DB_CA_HOST_FILE: path.join(certs, 'ca.crt'), ...extra,
});
const migrarB = (extra = {}) => compose(['run', '--rm', '-e', 'DB_CONNECT_WAIT_SECONDS=3', 'interact-migrar-administrado'], entornoB(extra), ARCHIVOS_B);

test('modo B (administrado): control negativo — desde la red interna la base externa es inalcanzable (el defecto original)', { skip: omitir, timeout: 300_000 }, () => {
  levantarBaseExterna();
  const js = `const s=require('net').connect(${puertoExterno},'db-externo.test');s.setTimeout(4000);s.on('connect',()=>{console.log('ALCANZA');process.exit(0)});s.on('error',e=>{console.log('INALCANZABLE '+e.code);process.exit(0)});s.on('timeout',()=>{console.log('INALCANZABLE timeout');process.exit(0)})`;
  assert.match(enRed(`${P}_interact-db`, js, ['--add-host', 'db-externo.test:host-gateway']).stdout, /INALCANZABLE/, 'la red interna no llega al proveedor');
  assert.match(enRed('bridge', js, ['--add-host', 'db-externo.test:host-gateway']).stdout, /ALCANZA/, 'una red con salida sí');
});

test('modo B (administrado): preparación de roles y migración por la red con salida, TLS verificado', { skip: omitir, timeout: 300_000 }, () => {
  const prep = compose(['run', '--rm', '-e', 'DB_CONNECT_WAIT_SECONDS=5', 'interact-db-preparar-administrado'], entornoB(), ARCHIVOS_B);
  ok(prep, 'preparar-roles contra el proveedor con TLS verificado');
  assert.match(prep.stdout, /"preparado":\s*true/);
  const r = migrarB();
  ok(r, 'migrar-administrado con TLS verificado');
  assert.match(r.stdout, /"version":\s*\d+/);
  const red = JSON.parse(docker(['network', 'inspect', `${P}_interact-salida`]).stdout)[0];
  assert.notEqual(red.Internal, true);
  assert.equal(Object.keys(red.Containers ?? {}).length, 0, 'la red de salida no deja contenedores');
});

test('modo B: validación del certificado TLS — sin CA, nombre distinto y sin TLS se rechazan', { skip: omitir, timeout: 300_000 }, () => {
  const sinCa = migrarB({ DB_SSL_CA_FILE: '', DB_CA_HOST_FILE: '/dev/null' });
  assert.notEqual(sinCa.status, 0, 'CA desconocida');
  const soloCifrado = migrarB({ DB_SSL: 'requerido', DB_SSL_CA_FILE: '', DB_CA_HOST_FILE: '/dev/null' });
  ok(soloCifrado, 'control: con DB_SSL=requerido (sin validar) conecta, luego el rechazo anterior era la validación del certificado');
  const otroNombre = migrarB({ DATABASE_MIGRATION_URL: urlExterna('interact_migrador', claves.migrador, 'otro-nombre.test') });
  assert.notEqual(otroNombre.status, 0, 'el nombre del servidor no coincide con el certificado');
  assert.doesNotMatch(salida(otroNombre), new RegExp(claves.migrador), 'el mensaje no filtra credenciales');
  const sinTls = migrarB({ DB_SSL: 'desactivado', DB_SSL_CA_FILE: '' });
  assert.notEqual(sinTls.status, 0, 'el proveedor exige TLS');
  const clave = migrarB({ DATABASE_MIGRATION_URL: urlExterna('interact_migrador', 'incorrecta-incorrecta') });
  assert.notEqual(clave.status, 0, 'credencial errónea rechazada');
});

test('modo B (administrado): respaldo de la base externa con verify-full', { skip: omitir, timeout: 300_000 }, () => {
  const r = compose(['run', '--rm', 'interact-respaldo-administrado'], entornoB(), ARCHIVOS_B);
  liberarRespaldos();
  ok(r, 'respaldo administrado');
  const copias = readdirSync(respaldos).filter((f) => f.endsWith('.dump'));
  assert.equal(copias.length, 1);
  assert.ok(existsSync(path.join(respaldos, `${copias[0]}.sha256`)));
  verificarSuma(path.join(respaldos, copias[0]));
  assert.ok(readFileSync(path.join(respaldos, copias[0])).length > 100);
  const sinCa = compose(['run', '--rm', 'interact-respaldo-administrado'], entornoB({ DB_SSL_CA_FILE: '', DB_CA_HOST_FILE: '/dev/null' }), ARCHIVOS_B);
  assert.notEqual(sinCa.status, 0, 'el respaldo también valida el certificado');
});
