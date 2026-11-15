import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, chmodSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const wf = readFileSync(new URL('../../../.github/workflows/openclass-live-deploy.yml', import.meta.url), 'utf8');
const sh = new URL('../ops/vps/interact-actualizar.sh', import.meta.url).pathname;
const script = readFileSync(sh, 'utf8');
const REPO = 'ghcr.io/herrerawilliamh/openclass-live';
const SHA1 = 'a'.repeat(40), SHA2 = 'b'.repeat(40);
const D1 = 'sha256:' + '1'.repeat(64), D2 = 'sha256:' + '2'.repeat(64);

test('workflow de despliegue: acciones fijadas, sin build, sin Compose externo, protegido', () => {
  for (const m of wf.matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) assert.match(m[1], /@[a-f0-9]{40}$/);
  assert.doesNotMatch(wf, /pull_request|self-hosted|:latest|docker (buildx )?build|secrets:\s*inherit/);
  assert.match(wf, /vars\.INTERACT_AUTODEPLOY == 'true'/);
  assert.match(wf, /environment: interact-production/);
  assert.match(wf, /cancel-in-progress: false/);
  assert.match(wf, /merge-base --is-ancestor/);
  assert.match(wf, /gh attestation verify/);
  assert.match(wf, /StrictHostKeyChecking=yes/);
  assert.doesNotMatch(wf, /set -x|StrictHostKeyChecking=no|: write/);
  assert.match(wf, /"deploy \$SHA \$DIGEST" < \/dev\/null/);
  assert.match(wf, /"rollback \$SHA \$DIGEST"/);
  assert.doesNotMatch(wf, /< live-release\/docker-compose/);
});

test('script de la VPS: sin operaciones destructivas', () => {
  assert.equal(spawnSync('bash', ['-n', sh]).status, 0);
  const code = script.replace(/^\s*#.*$/gm, '');
  assert.doesNotMatch(code, /down -v|--volumes|volume rm|system prune|image prune|docker rm|--remove-orphans|up[^\n]*--build/);
  assert.equal((code.match(/ up -d /g) || []).length, 2);
  assert.doesNotMatch(code, /compose\.yaml/);
  assert.equal((code.match(/ up -d --no-deps /g) || []).length, 2);
});

// Entorno con "docker" simulado: registra llamadas; comportamiento controlado por archivos en el entorno.
function entorno({ baseImage = `${REPO}@${D1}`, dbHash = 'H1', extraImages = {} } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'interact-t-'));
  const stack = join(d, 'stack dir'), state = join(d, 'state'), bin = join(d, 'bin');
  mkdirSync(stack); mkdirSync(state); mkdirSync(bin);
  writeFileSync(join(stack, 'docker-compose.yml'), 'services: {}\n');
  writeFileSync(join(state, 'domain.yaml'), 'services: {}\n');
  for (const x of [d, stack, state, bin]) chmodSync(x, 0o755);
  for (const x of [join(stack, 'docker-compose.yml'), join(state, 'domain.yaml')]) chmodSync(x, 0o644);
  writeFileSync(join(stack, '.env'), '');
  writeFileSync(join(d, 'cfg.json'), JSON.stringify({ baseImage, extraImages }));
  writeFileSync(join(d, 'dbhash'), dbHash);
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env node
const fs=require('fs');const d=${JSON.stringify(d)};const a=process.argv.slice(2);
fs.appendFileSync(d+'/calls.log',JSON.stringify({a,cwd:process.cwd()})+'\\n');
const cfg=JSON.parse(fs.readFileSync(d+'/cfg.json','utf8'));const has=n=>fs.existsSync(d+'/'+n);
const files=[];for(let i=0;i<a.length;i++)if(a[i]==='-f')files.push(a[++i]);
const implicit=!files.length;
if(!files.length){const ei=a.indexOf('--env-file');const m=ei>=0&&fs.existsSync(a[ei+1])?fs.readFileSync(a[ei+1],'utf8').match(/^COMPOSE_FILE=(.*)$/m):null;if(m)files.push(...m[1].split(':'));}
const drift=has('drift')&&implicit;
const ov=files.find(f=>/override\.yaml$|candidate\./.test(f));const dom=files.some(f=>/domain\.yaml$/.test(f));
const imgOf=()=>{if(ov){const m=fs.readFileSync(ov,'utf8').match(/image: (\\S+)/);if(m)return m[1];}return cfg.baseImage;};
if(a[0]==='inspect'){if(has('noinspect'))process.exit(1);console.log(fs.readFileSync(d+'/running','utf8').trim());process.exit(0);}
if(a[0]==='exec'){process.exit(has('unhealthy')&&fs.readFileSync(d+'/running','utf8').trim()!==cfg.baseImage?1:0);}
const i=a.indexOf(a.find(x=>['config','pull','up'].includes(x)));const c=a[i];
if(c==='config'){
  if(a.includes('--services')){console.log('openclass-live\\ninteract-db');process.exit(0);}
  if(a.includes('--hash')){console.log(fs.readFileSync(d+'/dbhash','utf8'));process.exit(0);}
  if(a.includes('--format')){const s={'openclass-live':{image:imgOf(),environment:{APP_URL:dom&&!drift?'https://interact.apps.willedtech.io':'https://openclass-live.apps.willedtech.io',APP_ALT_URLS:'https://openclass-live.apps.willedtech.io'},labels:{'traefik.http.routers.interact.rule':'Host('+(dom?'interact':'openclass-live')+'.apps.willedtech.io)'}},'interact-db':{image:'postgres:17'}};
    if(has('build'))s['openclass-live']={...s['openclass-live'],build:{context:'.'}};
    for(const[k,v]of Object.entries(cfg.extraImages))s[k]={image:v};
    console.log(JSON.stringify({services:s}));process.exit(0);}
  process.exit(0);}
if(c==='pull'){process.exit(has('pullfail')?1:0);}
if(c==='up'){if(has('upfail')&&imgOf()!==cfg.baseImage&&!a.includes('--allow'))process.exit(1);fs.writeFileSync(d+'/running',imgOf());process.exit(0);}
process.exit(0);
`);
  chmodSync(join(bin, 'docker'), 0o755);
  writeFileSync(join(bin, 'curl'), `#!/usr/bin/env node
const fs=require('fs');const d=${JSON.stringify(d)};
fs.appendFileSync(d+'/curl.log',process.argv.slice(2).join(' ')+'\\n');
const cfg=JSON.parse(fs.readFileSync(d+'/cfg.json','utf8'));
process.exit(fs.existsSync(d+'/publicfail')&&fs.readFileSync(d+'/running','utf8').trim()!==cfg.baseImage?1:0);
`);
  chmodSync(join(bin, 'curl'), 0o755);
  writeFileSync(join(d, 'running'), `${REPO}@${D1}\n`);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, INTERACT_STACK_DIR: stack, INTERACT_STATE_DIR: state, INTERACT_DOMAIN_UIDS: String(process.getuid()), INTERACT_HEALTH_TRIES: '1', INTERACT_HEALTH_SLEEP: '0' };
  const run = (cmd) => spawnSync('bash', [sh], { env: { ...env, SSH_ORIGINAL_COMMAND: cmd }, input: '', encoding: 'utf8' });
  const calls = () => (existsSync(join(d, 'calls.log')) ? readFileSync(join(d, 'calls.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
  const flag = (n) => writeFileSync(join(d, n), '1');
  const read = (n) => readFileSync(join(state, n), 'utf8');
  const running = () => readFileSync(join(d, 'running'), 'utf8').trim();
  return { d, stack, state, run, curls: () => (existsSync(join(d, 'curl.log')) ? readFileSync(join(d, 'curl.log'), 'utf8').trim().split('\n') : []), calls, flag, read, running, dir: (n) => join(d, n) };
}
const ups = (e) => e.calls().filter((c) => c.a.includes('up'));

test('deploy válido: solo la app (--no-deps), mismo project-directory, registro SHA/digest, Compose del stack intacto', () => {
  const e = entorno();
  const r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(e.running(), `${REPO}@${D2}`);
  assert.equal(e.read('deployed.current').trim(), `${SHA1} ${D2}`);
  assert.match(e.read('deploy.log'), new RegExp(`DEPLOY OK sha=${SHA1} digest=${D2}`));
  assert.equal(readFileSync(join(e.stack, 'docker-compose.yml'), 'utf8'), 'services: {}\n');
  const u = ups(e);
  assert.equal(u.length, 1);
  assert.ok(u[0].a.includes('--no-deps') && u[0].a.includes('--no-build') && u[0].a.includes('openclass-live'));
  for (const c of e.calls().filter((c) => c.a[0] === 'compose')) assert.ok(c.a.includes('--project-directory') && c.a[c.a.indexOf('--project-directory') + 1] === e.stack);
  assert.ok(!e.calls().some((c) => c.a.some((x) => /interact-db/.test(x) && c.a.includes('up'))));
});

test('rechaza entradas inválidas y Compose externo sin efectos', () => {
  const e = entorno();
  for (const cmd of ['deploy abc sha256:00', 'rm -rf /', 'deploy', `deploy ${SHA1} ${D2} extra`, `rollback ${SHA1}`]) assert.notEqual(e.run(cmd).status, 0, cmd);
  assert.equal(ups(e).length, 0);
  assert.equal(e.running(), `${REPO}@${D1}`);
});

test('migración (otro servicio con la imagen de la app) o build en el modelo efectivo => abortado sin tocar nada', () => {
  let e;
  e = entorno({ extraImages: { migrar: `${REPO}@${D2}` } });
  let r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 65, r.stderr);
  assert.equal(ups(e).length, 0);
  assert.ok(!e.calls().some((c) => c.a.includes('pull')));
  e = entorno(); e.flag('build');
  r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 65, r.stderr);
  assert.equal(ups(e).length, 0);
  assert.equal(e.running(), `${REPO}@${D1}`);
});

test('fallo de pull: no muta y conserva el respaldo anterior', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 0);
  assert.equal(e.run(`deploy ${SHA2} ${D1}`).status, 0); // previous = (SHA1,D2)
  const prev = e.read('previous.deployed');
  assert.equal(prev.trim(), `${SHA1} ${D2}`);
  e.flag('pullfail');
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 1);
  assert.equal(e.read('previous.deployed'), prev);
  assert.equal(e.read('deployed.current').trim(), `${SHA2} ${D1}`);
});

test('fallo de up/salud: rollback automático al estado anterior y registro coherente', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  e.flag('unhealthy');
  const r = e.run(`deploy ${SHA2} ${D2}`);
  assert.equal(r.status, 1);
  assert.equal(e.running(), `${REPO}@${D1}`);
  assert.equal(e.read('deployed.current').trim(), `${SHA1} ${D1}`);
  assert.match(e.read('deploy.log'), /ROLLBACK/);
});

test('rollback con compare-and-swap: rechaza si otro despliegue sustituyó lo esperado; acepta el vigente', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  assert.equal(e.run(`deploy ${SHA2} ${D2}`).status, 0);
  const antes = ups(e).length;
  assert.equal(e.run(`rollback ${SHA1} ${D1}`).status, 73); // ya no es lo desplegado
  assert.equal(ups(e).length, antes);
  assert.equal(e.running(), `${REPO}@${D2}`);
  assert.equal(e.run(`rollback ${SHA2} ${D2}`).status, 0);
  assert.equal(e.running(), `${REPO}@${D1}`);
  assert.equal(e.read('deployed.current').trim(), `${SHA1} ${D1}`);
  assert.equal(e.run(`rollback ${SHA2} ${D2}`).status, 73); // no repetible
});

test('un segundo despliegue simultáneo es rechazado por el lock', () => {
  const e = entorno();
  const r = spawnSync('bash', ['-c', `exec 9>"${e.state}/lock"; flock -n 9; SSH_ORIGINAL_COMMAND="deploy ${SHA1} ${D2}" INTERACT_STATE_DIR="${e.state}" INTERACT_STACK_DIR="${e.stack}" PATH="${e.d}/bin:$PATH" bash "${sh}"; echo rc=$?`], { encoding: 'utf8' });
  assert.match(r.stdout + r.stderr, /rc=75|Otro despliegue/);
  assert.equal(ups(e).length, 0);
});

test('hash de PostgreSQL distinto con el override => abortado sin pull ni up', () => {
  const e = entorno();
  // el simulador devuelve un hash distinto cuando el override está presente en la llamada
  const dock = readFileSync(join(e.d, 'bin', 'docker'), 'utf8').replace("console.log(fs.readFileSync(d+'/dbhash','utf8'))", "console.log(ov?'H-CAMBIADO':'H1')");
  writeFileSync(join(e.d, 'bin', 'docker'), dock);
  const r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 65, r.stderr);
  assert.match(r.stderr, /PostgreSQL/);
  assert.equal(ups(e).length, 0);
  assert.ok(!e.calls().some((c) => c.a.includes('pull')));
});

test('el workflow de deploy solo acepta push a release/openclass-live o tag, y exige la punta vigente', () => {
  assert.match(wf, /workflow_run\.event == 'push' &&\s+github\.event\.workflow_run\.head_branch == 'release\/openclass-live'/);
  assert.match(wf, /test "\$\(git rev-parse origin\/release\/openclass-live\)" = "\$SHA"/);
  assert.match(wf, /vars\.INTERACT_AUTODEPLOY == 'true'/);
  assert.doesNotMatch(wf, /docker (buildx )?build/);
});

// --- domain.yaml, orden de archivos, PostgreSQL, permisos y estado previo ---
const composeCalls = (e) => e.calls().filter((c) => c.a[0] === 'compose');
const archivos = (c) => c.a.flatMap((x, i) => (c.a[i - 1] === '-f' ? [x.replace(/^.*\//, '')] : []));

test('domain.yaml se conserva en TODAS las operaciones Compose de deploy, en orden compose → override → domain', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  assert.equal(e.run(`deploy ${SHA2} ${D2}`).status, 0);
  const cs = composeCalls(e);
  assert.ok(cs.length > 6);
  for (const c of cs) {
    const f = archivos(c);
    assert.equal(f[0], 'docker-compose.yml', c.a.join(' '));
    assert.equal(f.at(-1), 'domain.yaml', c.a.join(' '));
    assert.ok(f.length === 2 || (f.length === 3 && /^(override\.yaml|candidate\..+)$/.test(f[1])), f.join(','));
    assert.equal(c.a.includes('--env-file'), true);
  }
  assert.ok(cs.some((c) => archivos(c).includes('override.yaml')));
});

test('domain.yaml se conserva en el rollback automático y en el manual; APP_URL oficial intacta', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  e.flag('unhealthy');
  const antes = composeCalls(e).length;
  assert.equal(e.run(`deploy ${SHA2} ${D2}`).status, 1);
  const auto = composeCalls(e).slice(antes);
  assert.ok(auto.some((c) => c.a.includes('up')));
  for (const c of auto) assert.equal(archivos(c).at(-1), 'domain.yaml');
  assert.equal(e.running(), `${REPO}@${D1}`);
  const e2 = entorno();
  assert.equal(e2.run(`deploy ${SHA1} ${D1}`).status, 0);
  assert.equal(e2.run(`deploy ${SHA2} ${D2}`).status, 0);
  const n = composeCalls(e2).length;
  assert.equal(e2.run(`rollback ${SHA2} ${D2}`).status, 0);
  const man = composeCalls(e2).slice(n);
  assert.ok(man.some((c) => c.a.includes('up')));
  for (const c of man) assert.equal(archivos(c).at(-1), 'domain.yaml');
  assert.equal(readFileSync(join(e2.state, 'domain.yaml'), 'utf8'), 'services: {}\n');
});

test('PostgreSQL: nunca se recrea ni se hace pull/up de él; solo el servicio de la app', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 0);
  e.flag('unhealthy');
  e.run(`deploy ${SHA2} ${D1}`);
  for (const c of e.calls().filter((c) => c.a.some((x) => ['up', 'pull'].includes(x)))) {
    assert.equal(c.a.at(-1), 'openclass-live');
    assert.ok(!c.a.includes('interact-db'));
    if (c.a.includes('up')) assert.ok(c.a.includes('--no-deps') && c.a.includes('--no-build'));
  }
});

test('sin domain.yaml o con permisos inseguros: abortado sin efectos (exit 66)', () => {
  let e = entorno();
  rmSync(join(e.state, 'domain.yaml'));
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 66);
  assert.equal(ups(e).length, 0);
  e = entorno();
  chmodSync(join(e.state, 'domain.yaml'), 0o666);
  const r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 66); assert.match(r.stderr, /domain\.yaml/);
  e = entorno();
  chmodSync(join(e.stack, 'docker-compose.yml'), 0o664);
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 66);
  e = entorno();
  rmSync(join(e.state, 'domain.yaml'));
  symlinkSync(join(e.stack, 'docker-compose.yml'), join(e.state, 'domain.yaml'));
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 66);
  assert.equal(ups(e).length, 0);
});

test('un propietario no confiable se rechaza', () => {
  const e = entorno();
  const r = spawnSync('bash', [sh], { env: { ...process.env, PATH: `${e.d}/bin:${process.env.PATH}`, INTERACT_STACK_DIR: e.stack, INTERACT_STATE_DIR: e.state, INTERACT_TRUSTED_UIDS: '999999', INTERACT_DOMAIN_UIDS: String(process.getuid()), SSH_ORIGINAL_COMMAND: `deploy ${SHA1} ${D2}` }, encoding: 'utf8' });
  assert.equal(r.status, 66);
  assert.equal(ups(e).length, 0);
});

test('modelo sin domain.yaml efectivo (APP_URL no oficial) => abortado', () => {
  const e = entorno();
  const r = spawnSync('bash', [sh], { env: { ...process.env, PATH: `${e.d}/bin:${process.env.PATH}`, INTERACT_STACK_DIR: e.stack, INTERACT_STATE_DIR: e.state, INTERACT_DOMAIN_UIDS: String(process.getuid()), INTERACT_EXPECTED_APP_URL: 'https://otro.example.org', SSH_ORIGINAL_COMMAND: `deploy ${SHA1} ${D2}` }, encoding: 'utf8' });
  assert.equal(r.status, 65, r.stderr);
  assert.match(r.stderr, /APP_URL/);
  assert.equal(ups(e).length, 0);
});

test('estado previo inconsistente (override ≠ deployed.current o forma inesperada) no se sobrescribe', () => {
  let e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  writeFileSync(join(e.state, 'deployed.current'), `${SHA1} ${D2}\n`);
  const prev = existsSync(join(e.state, 'previous.override'));
  const antes = readFileSync(join(e.state, 'override.yaml'), 'utf8');
  assert.equal(e.run(`deploy ${SHA2} ${D2}`).status, 70);
  assert.equal(readFileSync(join(e.state, 'override.yaml'), 'utf8'), antes);
  assert.equal(existsSync(join(e.state, 'previous.override')), prev);
  e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  writeFileSync(join(e.state, 'override.yaml'), `services:\n  openclass-live:\n    image: ${REPO}@${D1}\n    ports: ["1:1"]\n`);
  assert.equal(e.run(`deploy ${SHA2} ${D2}`).status, 70);
  assert.equal(ups(e).length, 1);
});

test('healthz público falla tras up => rollback automático (ambos dominios se comprueban)', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  e.flag('publicfail');
  assert.equal(e.run(`deploy ${SHA2} ${D2}`).status, 1);
  assert.equal(e.running(), `${REPO}@${D1}`);
  assert.equal(e.read('deployed.current').trim(), `${SHA1} ${D1}`);
  const urls = e.curls().join('\n');
  assert.match(urls, /interact\.apps\.willedtech\.io\/healthz/);
  assert.match(urls, /openclass-live\.apps\.willedtech\.io\/healthz/);
});

test('check: solo lectura, informa estado y no hace up/pull', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  const n = ups(e).length;
  const r = e.run('check');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /APP_URL=https:\/\/interact\.apps\.willedtech\.io/);
  assert.match(r.stdout, /salud=OK/);
  assert.equal(ups(e).length, n);
  assert.notEqual(e.run('check extra').status, 0);
});

test('check: ALINEADO solo si el modelo implícito (COMPOSE_FILE en .env) es idéntico al efectivo; mismo digest con dominio distinto => DERIVA', () => {
  const e = entorno();
  assert.equal(e.run(`deploy ${SHA1} ${D1}`).status, 0);
  // Sin COMPOSE_FILE: Dockhand reproduciría solo docker-compose.yml (digest base = D1, pero dominio distinto) => DERIVA
  let r = e.run('check');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /COMPOSE_FILE=AUSENTE/);
  assert.match(r.stdout, /compose-implicito=DERIVA/);
  assert.match(r.stdout, /openclass-live: [^\n]*(environment|labels)/);
  assert.doesNotMatch(r.stdout, /ALINEADO/);
  // Con COMPOSE_FILE de los tres archivos en .env => ALINEADO
  writeFileSync(join(e.stack, '.env'), `COMPOSE_FILE=docker-compose.yml:${join(e.state, 'override.yaml')}:${join(e.state, 'domain.yaml')}\n`);
  r = e.run('check');
  assert.match(r.stdout, /COMPOSE_FILE=configurado/);
  assert.match(r.stdout, /compose-implicito=ALINEADO/);
  // ALINEADO es solo diagnóstico de Compose sin -f: nunca se presenta como prueba de Dockhand; la evidencia es la del contenedor
  assert.match(r.stdout, /NO prueba cómo invoca Dockhand/);
  assert.match(r.stdout, /contenedor-evidencia=/);
  assert.doesNotMatch(r.stdout, /dockhand-solo/);
  // Mismo digest, dominio/routers incorrectos en el modelo implícito => DERIVA (no basta con coincidir el digest)
  e.flag('drift');
  r = e.run('check');
  assert.match(r.stdout, /compose-implicito=DERIVA/);
  assert.doesNotMatch(r.stdout, /ALINEADO/);
});

test('directorio de estado: debe ser de la autoridad de dominio; escritura de grupo solo con sticky; nunca de otros', () => {
  let e = entorno();
  chmodSync(e.state, 0o770);
  let r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 66); assert.match(r.stderr, /estado no protegido/);
  assert.equal(ups(e).length, 0);
  e = entorno(); chmodSync(e.state, 0o1770);
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 0);
  e = entorno(); chmodSync(e.state, 0o1777);
  assert.equal(e.run(`deploy ${SHA1} ${D2}`).status, 66);
  // propietario del directorio y de domain.yaml distinto de la autoridad (p. ej. el propio usuario de despliegue) => rechazado
  e = entorno();
  r = spawnSync('bash', [sh], { env: { ...process.env, PATH: `${e.d}/bin:${process.env.PATH}`, INTERACT_STACK_DIR: e.stack, INTERACT_STATE_DIR: e.state, INTERACT_DOMAIN_UIDS: '999999', SSH_ORIGINAL_COMMAND: 'check' }, encoding: 'utf8' });
  assert.equal(r.status, 66); assert.match(r.stderr, /no protegido/);
  assert.equal(ups(e).length, 0);
});

test('workflow: ensayo manual posible con INTERACT_AUTODEPLOY desactivado; automático solo con true; solo desde main', () => {
  assert.match(wf, /github\.event_name == 'workflow_dispatch' \|\|\s+\(vars\.INTERACT_AUTODEPLOY == 'true'/);
  assert.match(wf, /github\.ref == 'refs\/heads\/main'/);
  assert.match(wf, /"check" < \/dev\/null/);
});
