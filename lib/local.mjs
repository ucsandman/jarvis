// Local runtimes: LM Studio and Ollama on this computer, reached through the official Codex CLI's open-source provider
// (`codex exec --oss --local-provider <runtime>`). No API key, nothing metered, nothing leaves the machine. The maintainer
// approved this path on 2026-09-06 as the one non-subscription exception in AGENTS.md. The server enumerates what each
// runtime holds so the page chooses from that list; a model that is not there fails closed, the same as a subscription model.
import {access} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {PROVIDERS,setLocalModels,choice,LOCAL} from '../public/models.js';

const RUNTIMES={
  lmstudio:{list:'/api/v0/models',parse:body=>(body?.data || []).filter(m=>m?.type==='llm').map(m=>({provider:'lmstudio',model:m.id,label:m.id,context:m.max_context_length})),start:'Start the LM Studio server, then choose Check again.',install:'https://lmstudio.ai/'},
  ollama:{list:'/api/tags',parse:body=>(body?.models || []).map(m=>({provider:'ollama',model:m.name,label:m.name})),start:'Start Ollama (ollama serve), then choose Check again.',install:'https://ollama.com/'}
};
export const RUNTIME_IDS=Object.keys(RUNTIMES);
const base=runtime=>`http://127.0.0.1:${PROVIDERS[runtime].port}`;

// One probe per runtime, 1.5 s each, in parallel. A runtime that is down contributes no models and reports up:false.
export async function localModels(signal,fetchImpl=fetch) {
  const runtimes={};
  const lists=await Promise.all(RUNTIME_IDS.map(async runtime=>{
    try {
      const response=await fetchImpl(base(runtime)+RUNTIMES[runtime].list,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(1500)]):AbortSignal.timeout(1500)});
      if(!response.ok) throw new Error(String(response.status));
      const models=RUNTIMES[runtime].parse(await response.json());
      runtimes[runtime]={up:true,models:models.length};
      return models;
    } catch(error) {if(signal?.aborted) throw error;runtimes[runtime]={up:false,models:0};return [];}
  }));
  return {runtimes,models:setLocalModels(lists.flat()).map(entry=>({...entry}))};
}

// Readiness for a local selection, in the shape the page already reads for a subscription: cli/configured/code/reason.
export async function localStatus(signal,selected,options={}) {
  const chosen=choice(selected.model);
  const runtime=PROVIDERS[chosen.provider];
  const seen=await localModels(signal,options.fetchImpl);
  const up=seen.runtimes[chosen.provider]?.up===true;
  const present=up && LOCAL.some(entry=>entry.id===chosen.id);
  const baseStatus={cli:true,model:chosen.model,provider:`${runtime.account} on this computer`,auth:runtime.account,usageCredits:false,local:true,runtime:chosen.provider};
  if(!up) return {...baseStatus,configured:false,code:'RUNTIME_DOWN',reason:RUNTIMES[chosen.provider].start};
  if(!present) return {...baseStatus,configured:false,code:'MODEL_UNAVAILABLE',reason:`${chosen.label} is no longer in ${runtime.account}. Choose a model it holds. Sidelook will not select another model.`};
  return {...baseStatus,configured:true,code:null,reason:null};
}

// The LM Studio CLI, when its server is not running: the same binary the app installs beside itself. Ollama has no equivalent one-shot starter.
export async function lmsCommand() {
  const name=process.platform==='win32'?'lms.exe':'lms';
  for(const path of [join(homedir(),'.lmstudio','bin',name),join(homedir(),'.cache','lm-studio','bin',name)]) {
    try {await access(path);return path;} catch { }
  }
  return null;
}

// Codex's own prompt is about 12,700 tokens before Sidelook's request; LM Studio's just-in-time load uses a 4,096 context and the
// request fails at once (measured 2026-09-06). So the model is loaded ahead of the call, with this context, through LM Studio's CLI.
export const LOCAL_CONTEXT=32768;
// How much of the model to put on the GPU: the card's memory (nvidia-smi, when there is one) minus room for the 32k cache, over the
// model's size. Measured 2026-09-06 on an 8 GB RTX 3070 Ti with Qwen3 8B: every layer on the GPU swapped through the driver (prefill
// 150 s, 5 tokens/s); 0.5 to 0.7 fit (prefill 80 s cold, 8 to 34 s warm). Null means no flag: LM Studio decides.
export const KV_BUDGET=5*1024**3;
export function gpuRatio(vramBytes,modelBytes) {
  if(!(vramBytes>0) || !(modelBytes>0)) return null;
  const ratio=(vramBytes-KV_BUDGET)/modelBytes;
  return ratio>=1?'max':String(Math.max(0.3,Math.round(ratio*10)/10));
}
export async function ensureLoaded(chosen,signal,{fetchImpl=fetch,run,vram}={}) {
  if(chosen?.provider!=='lmstudio') return {loaded:true,context:null};
  const listed=async()=>{
    const response=await fetchImpl(base('lmstudio')+RUNTIMES.lmstudio.list,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(1500)]):AbortSignal.timeout(1500)});
    return (await response.json())?.data?.find(m=>m?.id===chosen.model) || null;
  };
  const before=await listed();
  if(before?.state==='loaded' && Number(before.loaded_context_length)>=LOCAL_CONTEXT) return {loaded:true,context:Number(before.loaded_context_length)};
  const lms=await lmsCommand();
  if(!lms || !run) return {loaded:false,context:Number(before?.loaded_context_length) || null};
  if(before?.state==='loaded') await run(lms,['unload',chosen.model],{signal});
  const ratio=gpuRatio(vram===undefined?await gpuMemory(run,signal):vram,Number(before?.size_bytes) || await modelBytes(chosen,fetchImpl,signal));
  await run(lms,['load',chosen.model,'--context-length',String(LOCAL_CONTEXT),...(ratio?['--gpu',ratio]:[]),'--yes'],{signal});
  const after=await listed();
  return {loaded:after?.state==='loaded',context:Number(after?.loaded_context_length) || null};
}

// The card's memory in bytes from nvidia-smi, or null on a machine without it (LM Studio then chooses the offload itself).
async function gpuMemory(run,signal) {
  try {const result=await run('nvidia-smi',['--query-gpu=memory.total','--format=csv,noheader,nounits'],{signal});const mib=parseInt(result.stdout,10);return result.code===0 && mib>0?mib*1024**2:null;}
  catch {return null;}
}
// The model's size on disk from LM Studio's fuller listing; null when it cannot be read.
async function modelBytes(chosen,fetchImpl,signal) {
  try {const response=await fetchImpl(base('lmstudio')+'/api/v1/models',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(1500)]):AbortSignal.timeout(1500)});return Number((await response.json())?.models?.find(m=>m?.key===chosen.model)?.size_bytes) || null;}
  catch {return null;}
}

// Codex's open-source provider flags for a local selection. The model key is the runtime's own id, passed verbatim to --model.
export function localArgs(chosen) {
  if(!chosen?.local) throw new Error('Local arguments require a local model.');
  return ['--oss','--local-provider',chosen.provider,'--model',chosen.model];
}
