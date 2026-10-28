import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { start } from '../template/scripts/openclass-start.mjs';
import { versionNotice } from '../template/scripts/openclass-version-notice.mjs';
const sandbox=fileURLToPath(new URL('../../',import.meta.url));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function snapshot(root,out={},prefix=''){for(const e of fs.readdirSync(root,{withFileTypes:true})){const p=path.join(root,e.name),r=prefix+e.name;if(e.isDirectory()){out[r]='dir';snapshot(p,out,r+'/');}else out[r]=hash(p);}return out;}
function fixture(){
 const root=fs.mkdtempSync(path.join(sandbox,'fixtures','F13-D curso con espacios '));
 for(const p of ['scripts','.openclass','node_modules/vite/dist/node','src/plugins'])fs.mkdirSync(path.join(root,p),{recursive:true});
 for(const n of ['openclass-start.mjs','openclass-version-notice.mjs'])fs.copyFileSync(new URL('../template/scripts/'+n,import.meta.url),path.join(root,'scripts',n));
 fs.copyFileSync(new URL('../template/Iniciar OpenClass.cmd',import.meta.url),path.join(root,'Iniciar OpenClass.cmd'));
 fs.writeFileSync(path.join(root,'scripts/openclass-update.mjs'),"throw Error('ACTUALIZADOR NO DEBE IMPORTARSE');");
 fs.writeFileSync(path.join(root,'node_modules/vite/package.json'),'{"type":"module"}');
 fs.writeFileSync(path.join(root,'slides.md'),'CONTENIDO PROTEGIDO');
 fs.writeFileSync(path.join(root,'openclass.config.json'),'{"LIVE":{"activa":true}}');
 fs.copyFileSync(new URL('../template/src/plugins/protocolo-live.mjs',import.meta.url),path.join(root,'src/plugins/protocolo-live.mjs'));
 fs.writeFileSync(path.join(root,'.openclass/generator.json'),JSON.stringify({name:'create-openclass-uniminuto-revealjs',installedVersion:'1.2.0',autoUpdate:true}));
 fs.writeFileSync(path.join(root,'.openclass/transaction.json'),'JOURNAL NO INTERPRETABLE');
 // Doble explícito del API Vite: verifica transporte HTTP y contrato del lanzador, no el renderizado React.
 fs.writeFileSync(path.join(root,'node_modules/vite/dist/node/index.js'),`import http from 'node:http';
export async function createServer(options){if(options.configLoader!=='runner'||options.cacheDir.startsWith(options.root))throw Error('cache insegura');const server=http.createServer((req,res)=>res.end('F13D_STABLE_HTTP'));return {listen:()=>new Promise((ok,bad)=>{server.once('error',bad);server.listen(8600,'127.0.0.1',ok)}),printUrls(){console.log('http://127.0.0.1:8600/')}};}`);
 return root;
}
const data=v=>new Response(JSON.stringify({name:'create-openclass-uniminuto-revealjs',version:v}));
test('consulta informativa: versión nueva, igual, antigua, inválida, offline y límite de bytes',async()=>{
 const root=fixture(),before=snapshot(root);let requests=0;
 for(const [v,pattern] of [['1.3.0',/Hay una versión 1.3.0/],['1.2.0',/Sin versión estable posterior/],['1.1.0',/Sin versión estable posterior/],['<script>',/no disponible/]])assert.match(await versionNotice(root,{request:async(url,opts)=>{requests++;assert.equal(url,'https://registry.npmjs.org/create-openclass-uniminuto-revealjs/latest');assert.equal(opts.redirect,'error');assert.ok(opts.signal);return data(v);}}),pattern);
 assert.match(await versionNotice(root,{request:async()=>{throw Error('OFFLINE');}}),/Puede iniciar/);
 assert.match(await versionNotice(root,{request:async()=>new Response('x'.repeat(65537))}),/no disponible/);
 assert.equal(requests,4);assert.deepEqual(snapshot(root),before);
});
test('curso nuevo: la procedencia de 1.3.0 viene de package.json de plantilla',async()=>{
 const root=fixture();
 fs.unlinkSync(path.join(root,'.openclass/generator.json'));
 fs.copyFileSync(new URL('../template/package.json',import.meta.url),path.join(root,'package.json'));
 assert.match(await versionNotice(root,{request:async()=>data('1.4.0')}),/Hay una versión 1.4.0; instalada: 1.3.0/);
});

test('curso heredado sin procedencia: no usar versión académica ni acceder a red',async()=>{
 const root=fixture();fs.unlinkSync(path.join(root,'.openclass/generator.json'));
 assert.match(await versionNotice(root,{request:()=>{assert.fail('red no autorizada');}}),/sin procedencia/);
});
test('opciones de actualización rechazadas antes de cargar motor o crear caché',async()=>{
 for(const flag of ['--enable-updates','--retry-update','--recover-lock','--update-theme','--install-launcher','--route=//evil.example'])await assert.rejects(start('X:/no-curso',[flag],{load:()=>assert.fail('motor ejecutado'),log:()=>{}}),/AUTOUPDATE=BLOCKED/);
});
for(const mode of ['offline','actualizador bloqueado','Windows CMD'])test('arranque '+mode+': HTTP, LIVE activa/protocolo 2 y hashes intactos',async()=>{
 const root=fixture(),before=snapshot(root);
 const guard=path.join(root,'offline-guard.mjs');fs.writeFileSync(guard,"globalThis.fetch=()=>{throw Error('NETWORK_FORBIDDEN')};");
 const ready=new Promise((resolve,reject)=>{
 const win=mode==='Windows CMD';
 const child=spawn(win?(process.env.ComSpec||'cmd.exe'):process.execPath,win?['/d','/s','/c','call "Iniciar OpenClass.cmd"']:['--import',pathToFileURL(guard).href,path.join(root,'scripts/openclass-start.mjs')],{cwd:root,windowsHide:true,windowsVerbatimArguments:win,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_OPTIONS:'--import='+JSON.stringify(pathToFileURL(guard).href)}});
 let output='';const timer=setTimeout(()=>{child.kill();reject(Error('timeout '+output));},10000);
 child.stdout.on('data',b=>{output+=b;if(output.includes('OPENCLASS_STABLE_READY')){clearTimeout(timer);resolve({child,output});}});child.stderr.on('data',b=>output+=b);child.on('error',reject);child.on('exit',code=>{clearTimeout(timer);if(!output.includes('OPENCLASS_STABLE_READY'))reject(Error(code+': '+output));});
 });
 const {child,output}=await ready;
 try{assert.match(output,/sin consultar la red/);const response=await fetch('http://127.0.0.1:8600/');assert.equal(await response.text(),'F13D_STABLE_HTTP');assert.equal(JSON.parse(fs.readFileSync(path.join(root,'openclass.config.json'))).LIVE.activa,true);assert.match(fs.readFileSync(path.join(root,'src/plugins/protocolo-live.mjs'),'utf8'),/2/);fs.writeFileSync(path.join(sandbox,'evidence','f13d-'+mode.replaceAll(' ','-')+'.json'),JSON.stringify({fixture:root,output,http:response.status,scope:'API Vite double; not real Vite/React acceptance'},null,2));}
 finally{if(mode==='Windows CMD')spawnSync('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true});else child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));}
 const after=snapshot(root);delete after['offline-guard.mjs'];assert.deepEqual(after,before,'sin escrituras del lanzador o mutaciones de contenido');
});
