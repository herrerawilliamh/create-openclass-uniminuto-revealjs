/** Consulta explícita de metadatos; ningún tarball, escritura, import remoto o instalación. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
const NAME = 'create-openclass-uniminuto-revealjs';
const valid = v => typeof v === 'string' && /^(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})\.(0|[1-9]\d{0,8})$/.test(v);
const newer = (a,b) => { const aa=a.split('.').map(Number),bb=b.split('.').map(Number); for(let i=0;i<3;i++) if(aa[i]!==bb[i])return aa[i]>bb[i];return false; };
export async function versionNotice(root, { request = fetch } = {}) {
  try {
    // La versión académica de package.json NO es la del generador.
    const metadata = JSON.parse(readFileSync(path.join(root,'.openclass/generator.json'),'utf8'));
    if(metadata.name !== NAME || !valid(metadata.installedVersion)) throw Error('sin procedencia');
    const response = await request('https://registry.npmjs.org/' + NAME + '/latest', {
      signal: AbortSignal.timeout(2500), redirect: 'error', headers: { accept: 'application/json' }
    });
    if(!response.ok || !response.body) throw Error('sin respuesta');
    const reader=response.body.getReader();let size=0,text='';const decoder=new TextDecoder();
    try { while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536)throw Error('respuesta excesiva');text+=decoder.decode(value,{stream:true});}text+=decoder.decode(); }
    finally { await reader.cancel().catch(()=>{}); }
    const data=JSON.parse(text);
    if(data.name!==NAME || !valid(data.version)) throw Error('metadatos inválidos');
    return newer(data.version,metadata.installedVersion)
      ? `Hay una versión ${data.version}; instalada: ${metadata.installedVersion}. Aviso informativo: instalación automática bloqueada.`
      : `Versión instalada: ${metadata.installedVersion}. Sin versión estable posterior. Instalación automática bloqueada.`;
  } catch { return 'Aviso de versiones no disponible (sin conexión o sin procedencia verificable). Puede iniciar el curso normalmente. No se descargó ni instaló ningún paquete.'; }
}
