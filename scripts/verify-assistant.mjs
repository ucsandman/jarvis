import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { Assistant } from '../lib/assistant.mjs';

async function fixture({ generate, maxCalls = 2 } = {}) {
  const vision = { status:async () => ({configured:true}), generate };
  const server = createApp({ vision, assistant:new Assistant({vision}), maxCalls });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const { token } = await (await fetch(`${base}/api/session`)).json();
  return { server, post:body => fetch(`${base}/api/chat`,{method:'POST',headers:{'Content-Type':'application/json','X-Jarvis-Session':token},body:JSON.stringify(body)}) };
}

let calls = 0;
const app = await fixture({generate:async (_system, parts, _schema, _signal, options) => {
  calls++;
  if (calls === 1) {
    assert.equal(options.model,'fable');
    assert.equal(options.effort,'high');
    assert.match(parts.at(-1).text,/"history"/);
  }
  return {model:'claude-fable-5-1',result:{reply:'I can help you make that change.',suggestion:'build'}};
}});
try {
  assert.equal((await app.post({instruction:'hello',consent:false})).status,403);
  assert.equal((await app.post({instruction:'',consent:true})).status,400);
  assert.equal((await app.post({instruction:'hello',history:Array(13).fill({role:'user',text:'x'}),consent:true})).status,400);
  const response = await app.post({instruction:'hello',history:[{role:'user',text:'What is visible?'}],contextLabel:'Work board',consent:true,model:'fable',effort:'high'});
  assert.equal(response.status,200);
  assert.deepEqual((await response.json()).result,{reply:'I can help you make that change.',suggestion:'build'});
  assert.equal(calls,1);
  assert.equal((await app.post({instruction:'again',consent:true})).status,200);
  assert.equal((await app.post({instruction:'one more',consent:true})).status,429);
} finally { app.server.closeAllConnections(); app.server.close(); }

let aborted = false;
let started,finished;
const starting=new Promise(resolve=>{started=resolve;});
const stopping=new Promise(resolve=>{finished=resolve;});
const cancel = await fixture({generate:async (_system,_parts,_schema,signal) => new Promise((resolve,reject) => {started();signal.addEventListener('abort',() => { aborted=true;finished();reject(new DOMException('Canceled','AbortError')); },{once:true});})});
try {
  const controller = new AbortController();
  const pending = fetch(`http://127.0.0.1:${cancel.server.address().port}/api/chat`,{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json','X-Jarvis-Session':(await (await fetch(`http://127.0.0.1:${cancel.server.address().port}/api/session`)).json()).token},body:JSON.stringify({instruction:'cancel',consent:true})}).catch(error => error);
  await starting;
  controller.abort();
  await pending;
  await stopping;
  assert.equal(aborted,true);
} finally { cancel.server.closeAllConnections(); cancel.server.close(); }
console.log('PASS: 7 assistant requests across 2 isolated services: validation, explicit consent, shared budget, mocked inference, and cancellation.');
