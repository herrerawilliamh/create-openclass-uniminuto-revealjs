import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, chmodSync, existsSync } from 'node:fs';
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
  assert.equal((code.match(/ up -d --no-deps /g) || []).length, 2);
});

// Entorno con "docker" simulado: registra llamadas; comportamiento controlado por archivos en el entorno.
function entorno({ baseImage = `${REPO}@${D1}`, dbHash = 'H1', extraImages = {} } = {}) {
  const d = mkdtempSync(join(tmpdir(), 'interact-t-'));
  const stack = join(d, 'stack dir'), state = join(d, 'state'), bin = join(d, 'bin');
  mkdirSync(stack); mkdirSync(state); mkdirSync(bin);
  writeFileSync(join(stack, 'compose.yaml'), 'services: {}\n');
  writeFileSync(join(stack, '.env'), '');
  writeFileSync(join(d, 'cfg.json'), JSON.stringify({ baseImage, extraImages }));
  writeFileSync(join(d, 'dbhash'), dbHash);
  writeFileSync(join(bin, 'docker'), `#!/usr/bin/env node
const fs=require('fs');const d=${JSON.stringify(d)};const a=process.argv.slice(2);
fs.appendFileSync(d+'/calls.log',JSON.stringify({a,cwd:process.cwd()})+'\\n');
const cfg=JSON.parse(fs.readFileSync(d+'/cfg.json','utf8'));const has=n=>fs.existsSync(d+'/'+n);
const files=[];for(let i=0;i<a.length;i++)if(a[i]==='-f')files.push(a[++i]);
const ov=files.find(f=>f.includes('/state/'));
const imgOf=()=>{if(ov){const m=fs.readFileSync(ov,'utf8').match(/image: (\\S+)/);if(m)return m[1];}return cfg.baseImage;};
if(a[0]==='inspect'){if(has('noinspect'))process.exit(1);console.log(fs.readFileSync(d+'/running','utf8').trim());process.exit(0);}
if(a[0]==='exec'){process.exit(has('unhealthy')&&fs.readFileSync(d+'/running','utf8').trim()!==cfg.baseImage?1:0);}
const i=a.indexOf(a.find(x=>['config','pull','up'].includes(x)));const c=a[i];
if(c==='config'){
  if(a.includes('--services')){console.log('openclass-live\\ninteract-db');process.exit(0);}
  if(a.includes('--hash')){console.log(fs.readFileSync(d+'/dbhash','utf8'));process.exit(0);}
  if(a.includes('--format')){const s={'openclass-live':{image:imgOf()},'interact-db':{image:'postgres:17'}};
    if(has('build'))s['openclass-live']={build:{context:'.'},image:imgOf()};
    for(const[k,v]of Object.entries(cfg.extraImages))s[k]={image:v};
    console.log(JSON.stringify({services:s}));process.exit(0);}
  process.exit(0);}
if(c==='pull'){process.exit(has('pullfail')?1:0);}
if(c==='up'){if(has('upfail')&&imgOf()!==cfg.baseImage&&!a.includes('--allow'))process.exit(1);fs.writeFileSync(d+'/running',imgOf());process.exit(0);}
process.exit(0);
`);
  chmodSync(join(bin, 'docker'), 0o755);
  writeFileSync(join(d, 'running'), `${REPO}@${D1}\n`);
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, INTERACT_STACK_DIR: stack, INTERACT_STATE_DIR: state, INTERACT_HEALTH_TRIES: '1', INTERACT_HEALTH_SLEEP: '0' };
  const run = (cmd) => spawnSync('bash', [sh], { env: { ...env, SSH_ORIGINAL_COMMAND: cmd }, input: '', encoding: 'utf8' });
  const calls = () => (existsSync(join(d, 'calls.log')) ? readFileSync(join(d, 'calls.log'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
  const flag = (n) => writeFileSync(join(d, n), '1');
  const read = (n) => readFileSync(join(state, n), 'utf8');
  const running = () => readFileSync(join(d, 'running'), 'utf8').trim();
  return { d, stack, state, run, calls, flag, read, running, dir: (n) => join(d, n) };
}
const ups = (e) => e.calls().filter((c) => c.a.includes('up'));

test('deploy válido: solo la app (--no-deps), mismo project-directory, registro SHA/digest, Compose del stack intacto', () => {
  const e = entorno();
  const r = e.run(`deploy ${SHA1} ${D2}`);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(e.running(), `${REPO}@${D2}`);
  assert.equal(e.read('deployed.current').trim(), `${SHA1} ${D2}`);
  assert.match(e.read('deploy.log'), new RegExp(`DEPLOY OK sha=${SHA1} digest=${D2}`));
  assert.equal(readFileSync(join(e.stack, 'compose.yaml'), 'utf8'), 'services: {}\n');
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
