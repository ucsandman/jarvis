import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localModels,localStatus,localArgs} from '../lib/local.mjs';
import {selection,choice,setLocalModels,LOCAL,MODELS} from '../lib/models.mjs';
import {inferenceArgs,SubscriptionError} from '../lib/subscription.mjs';
import {adoptLocalModels,goesTo,consentLine,MODEL_LABEL} from '../public/harness.js';
import {createApp} from '../server.mjs';
import {Vision} from '../lib/vision.mjs';

// A fake of the two runtimes' listing endpoints: LM Studio's /api/v0/models and Ollama's /api/tags.
const runtimes=({lmstudio,ollama})=>async url=>{
  const body=String(url).includes(':1234')?lmstudio:String(url).includes(':11434')?ollama:null;
  if(!body) throw new Error('connection refused');
  return {ok:true,json:async()=>body};
};
const LMSTUDIO={data:[{id:'qwen/qwen3-8b',type:'llm',max_context_length:40960},{id:'text-embedding-nomic-embed-text-v1.5',type:'embeddings'}]};
const OLLAMA={models:[{name:'gemma3:4b'}]};

test('local runtimes are enumerated into catalog entries the page can choose from',async()=>{
  const seen=await localModels(undefined,runtimes({lmstudio:LMSTUDIO,ollama:OLLAMA}));
  assert.deepEqual(seen.runtimes,{lmstudio:{up:true,models:1},ollama:{up:true,models:1}});
  assert.deepEqual(seen.models.map(m=>m.id),['lmstudio:qwen/qwen3-8b','ollama:gemma3:4b']);
  assert.equal(seen.models[0].context,40960);
  // Embedding models never appear; a down runtime contributes nothing and says so.
  const down=await localModels(undefined,runtimes({lmstudio:LMSTUDIO}));
  assert.deepEqual(down.runtimes.ollama,{up:false,models:0});
  assert.deepEqual(LOCAL.map(m=>m.id),['lmstudio:qwen/qwen3-8b']);
});

test('a local selection is an allowlist of what the runtime listed, with its own effort levels',async()=>{
  await localModels(undefined,runtimes({lmstudio:LMSTUDIO}));
  assert.deepEqual(selection({model:'lmstudio:qwen/qwen3-8b',effort:'high'}),{model:'lmstudio:qwen/qwen3-8b',effort:'high'});
  assert.throws(()=>selection({model:'lmstudio:qwen/qwen3-8b',effort:'max'}),{code:'INVALID_SELECTION'});
  for(const invalid of ['lmstudio:other','ollama:gemma3:4b','lmstudio:','qwen/qwen3-8b','lmstudio:../x','lmstudio:a b']) assert.throws(()=>selection({model:invalid}),{code:'INVALID_SELECTION'});
  const chosen=choice('lmstudio:qwen/qwen3-8b');
  assert.equal(chosen.local,true);assert.equal(chosen.account,'LM Studio');assert.equal(chosen.cli,'Codex');assert.equal(chosen.usageCredits,false);
  // Hostile keys from a runtime listing are dropped, never passed to Codex.
  setLocalModels([{provider:'lmstudio',model:'-m evil',label:'x'},{provider:'openai',model:'gpt-6-astra'},{provider:'lmstudio',model:'ok-model',label:''}]);
  assert.deepEqual(LOCAL.map(m=>[m.id,m.label]),[['lmstudio:ok-model','ok-model']]);
  assert.equal(MODELS.some(m=>m.id.startsWith('lmstudio:')),false);
});

test('Codex arguments for a local model use the open-source provider and no ChatGPT pins',async()=>{
  await localModels(undefined,runtimes({lmstudio:LMSTUDIO,ollama:OLLAMA}));
  const args=inferenceArgs('schema.json','result.json',null,null,{model:'lmstudio:qwen/qwen3-8b',effort:'low'});
  assert.ok(args.includes('--oss'));
  assert.equal(args[args.indexOf('--local-provider')+1],'lmstudio');
  assert.equal(args[args.indexOf('--model')+1],'qwen/qwen3-8b');
  assert.ok(!args.some(a=>/forced_login_method|model_provider=/.test(a)));
  assert.ok(args.includes('--ephemeral') && args.includes('read-only') && args.includes('approval_policy="never"') && args.includes('--output-schema'));
  assert.deepEqual(localArgs(choice('ollama:gemma3:4b')),['--oss','--local-provider','ollama','--model','gemma3:4b']);
  assert.throws(()=>localArgs(choice('astra')),/local model/);
});

test('local status fails closed when the runtime is down or the model is gone',async()=>{
  await localModels(undefined,runtimes({lmstudio:LMSTUDIO}));
  const ready=await localStatus(undefined,{model:'lmstudio:qwen/qwen3-8b',effort:'medium'},{fetchImpl:runtimes({lmstudio:LMSTUDIO})});
  assert.equal(ready.configured,true);assert.equal(ready.local,true);assert.equal(ready.usageCredits,false);
  assert.match(new SubscriptionError('RUNTIME_DOWN','lmstudio:qwen/qwen3-8b').message,/LM Studio is not running/);
  const down=await localStatus(undefined,{model:'lmstudio:qwen/qwen3-8b',effort:'medium'},{fetchImpl:runtimes({})});
  assert.equal(down.configured,false);assert.equal(down.code,'RUNTIME_DOWN');assert.match(down.reason,/Start the LM Studio server/);
  await localModels(undefined,runtimes({lmstudio:LMSTUDIO}));
  const gone=await localStatus(undefined,{model:'lmstudio:qwen/qwen3-8b',effort:'medium'},{fetchImpl:runtimes({lmstudio:{data:[]}})});
  assert.equal(gone.configured,false);assert.equal(gone.code,'MODEL_UNAVAILABLE');
});

test('the page adopts the server listing and its words say the model stays on this computer',async()=>{
  adoptLocalModels([{provider:'lmstudio',model:'qwen/qwen3-8b',label:'Qwen3 8B'}]);
  assert.equal(MODEL_LABEL['lmstudio:qwen/qwen3-8b'],'Qwen3 8B');
  assert.equal(goesTo('lmstudio:qwen/qwen3-8b'),'LM Studio on this computer through Codex');
  assert.equal(goesTo('astra'),'your ChatGPT subscription through Codex');
  assert.equal(consentLine({surface:'chat',model:'lmstudio:qwen/qwen3-8b'}),'Send this message to Qwen3 8B (LM Studio on this computer).');
  adoptLocalModels([]);
  assert.equal(MODEL_LABEL['lmstudio:qwen/qwen3-8b'],undefined);
});

test('the handshake carries the local listing and a local request reaches inference with its key',async t=>{
  const received=[];
  const vision=new Vision({status:async(signal,options)=>({configured:true,...options}),inference:async data=>{received.push(data);return {model:data.model,effort:data.effort,result:{title:'Local',reply:'Ready',changes:[],html:'<!doctype html><html><body><h1>Local model build</h1><p>This is a synthetic test, with no model call or billing.</p></body></html>'}};}});
  const app=createApp({vision,local:async()=>({runtimes:{lmstudio:{up:true,models:1},ollama:{up:false,models:0}},models:setLocalModels([{provider:'lmstudio',model:'qwen/qwen3-8b'}])})});
  await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>{app.closeAllConnections();app.close();});
  const base=`http://127.0.0.1:${app.address().port}`;
  const session=await (await fetch(base+'/api/local-session')).json();
  assert.equal(session.local.runtimes.lmstudio.up,true);
  assert.deepEqual(session.local.models.map(m=>m.id),['lmstudio:qwen/qwen3-8b']);
  const response=await fetch(base+'/api/build',{method:'POST',headers:{'Content-Type':'application/json','X-Sidelook-Session':session.token},body:JSON.stringify({instruction:'Build a board',consent:true,model:'lmstudio:qwen/qwen3-8b',effort:'low'})});
  assert.equal(response.status,200);
  assert.deepEqual(received.map(item=>[item.model,item.effort]),[['lmstudio:qwen/qwen3-8b','low']]);
});

test('LM Studio models are loaded with a Codex-sized context before inference',async()=>{
  const {ensureLoaded,LOCAL_CONTEXT}=await import('../lib/local.mjs');
  const runs=[];let state={id:'qwen/qwen3-8b',type:'llm',state:'not-loaded'};
  const fetchImpl=async()=>({ok:true,json:async()=>({data:[state]})});
  const run=async(command,args)=>{runs.push(args);state={...state,state:args[0]==='load'?'loaded':'not-loaded',loaded_context_length:args[0]==='load'?Number(args[3]):undefined};return {code:0,stdout:'',stderr:''};};
  setLocalModels([{provider:'lmstudio',model:'qwen/qwen3-8b'}]);
  const chosen=choice('lmstudio:qwen/qwen3-8b');
  // Not loaded: one load with the wide context. Loaded wide: nothing runs. Loaded narrow (LM Studio's 4,096 default): unload, then load wide.
  assert.deepEqual(await ensureLoaded(chosen,undefined,{fetchImpl,run,vram:null}),{loaded:true,context:LOCAL_CONTEXT});
  assert.deepEqual(runs,[['load','qwen/qwen3-8b','--context-length',String(LOCAL_CONTEXT),'--yes']]); // vram null: LM Studio chooses the offload
  runs.length=0;assert.deepEqual(await ensureLoaded(chosen,undefined,{fetchImpl,run,vram:null}),{loaded:true,context:LOCAL_CONTEXT});assert.deepEqual(runs,[]);
  state={...state,loaded_context_length:4096};
  await ensureLoaded(chosen,undefined,{fetchImpl,run,vram:null});
  assert.deepEqual(runs.map(a=>a[0]),['unload','load']);
  assert.equal(LOCAL_CONTEXT>=16384,true);
  // Only LM Studio needs this; Ollama entries pass straight through.
  setLocalModels([{provider:'ollama',model:'gemma3:4b'}]);
  assert.deepEqual(await ensureLoaded(choice('ollama:gemma3:4b'),undefined,{fetchImpl,run,vram:null}),{loaded:true,context:null});
});

test('a local reply is read as its one JSON object, fenced or wrapped, and prose alone is refused',async()=>{
  const {extractJson}=await import('../lib/subscription.mjs');
  assert.deepEqual(extractJson('{"reply":"Four.","suggestion":"none","followUps":[]}'),{reply:'Four.',suggestion:'none',followUps:[]});
  assert.deepEqual(extractJson('Here you go:\n```json\n{"reply":"Four."}\n```\nHope that helps.'),{reply:'Four.'});
  assert.deepEqual(extractJson('Sure. {"reply":"A {curly} one","followUps":["a","b"]} Done.'),{reply:'A {curly} one',followUps:['a','b']});
  assert.throws(()=>extractJson('A hexagon is a six-sided polygon.\n\n**Follow-ups**:\n- "What else?"'),/No JSON object/);
  assert.throws(()=>extractJson('[1,2,3]'),/No JSON object/);
});

test('the GPU share comes from the card and the model, and low effort turns a local model reasoning off',async()=>{
  const {gpuRatio,ensureLoaded,LOCAL_CONTEXT}=await import('../lib/local.mjs');
  const GiB=1024**3;
  assert.equal(gpuRatio(8*GiB,5.03*GiB),'0.6');   // the 3070 Ti and Qwen3 8B: measured to fit
  assert.equal(gpuRatio(24*GiB,5*GiB),'max');
  assert.equal(gpuRatio(6*GiB,5*GiB),'0.3');
  assert.equal(gpuRatio(null,5*GiB),null);assert.equal(gpuRatio(8*GiB,0),null);
  const runs=[];let state={id:'qwen/qwen3-8b',type:'llm',state:'not-loaded',size_bytes:5.03*GiB};
  const fetchImpl=async()=>({ok:true,json:async()=>({data:[state]})});
  const run=async(command,args)=>{runs.push([command,...args]);if(args[0]==='load') state={...state,state:'loaded',loaded_context_length:LOCAL_CONTEXT};return {code:0,stdout:'',stderr:''};};
  setLocalModels([{provider:'lmstudio',model:'qwen/qwen3-8b'}]);
  await ensureLoaded(choice('lmstudio:qwen/qwen3-8b'),undefined,{fetchImpl,run,vram:8*GiB});
  assert.ok(runs.some(r=>r.includes('--gpu') && r[r.indexOf('--gpu')+1]==='0.6'));
  const low=inferenceArgs('s','r',null,null,{model:'lmstudio:qwen/qwen3-8b',effort:'low'}),medium=inferenceArgs('s','r',null,null,{model:'lmstudio:qwen/qwen3-8b',effort:'medium'});
  assert.ok(low.includes('model_reasoning_effort="none"'));assert.ok(medium.includes('model_reasoning_effort="medium"'));
  assert.ok(inferenceArgs('s','r',null,null,{model:'astra',effort:'low'}).includes('model_reasoning_effort="low"'));
});
