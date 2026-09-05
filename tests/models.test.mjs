import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selection,EFFORTS} from '../lib/models.mjs';
import {inferenceArgs} from '../lib/subscription.mjs';
import {Vision} from '../lib/vision.mjs';
import {createApp} from '../server.mjs';

test('model and effort selection is an exact allowlist with backward-compatible defaults',()=>{
  assert.deepEqual(selection(),{model:'astra',effort:'medium'});
  for (const effort of EFFORTS) {
    assert.equal(selection({model:'astra',effort}).effort,effort);
    assert.ok(inferenceArgs('schema','result',null,null,{model:'astra',effort}).includes(`model_reasoning_effort="${effort}"`));
  }
  for (const invalid of [{model:'opus'},{model:'gpt-6-astra'},{model:null},{effort:null},{effort:'ultra'},{effort:'high" --model other'},{model:[]},{effort:{}}]) assert.throws(()=>selection(invalid),{code:'INVALID_SELECTION'});
});

test('requests carry effort independently and invalid choices preserve allowance',async t=>{
  const received=[];
  const vision=new Vision({status:async(signal,options)=>({configured:true,...options}),inference:async data=>{
    received.push(data);return {model:'gpt-6-astra',effort:data.effort,result:{title:'Choice',reply:'Ready',changes:[],html:'<!doctype html><html><body><h1>Request-specific effort</h1><p>This is a synthetic test, with no model call or billing.</p></body></html>'}};
  }});
  const app=createApp({vision});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
  t.after(()=>{app.closeAllConnections();app.close();});
  const base=`http://127.0.0.1:${app.address().port}`;
  const {token,models}=await (await fetch(base+'/api/local-session')).json();assert.equal(models.length,2);
  const post=data=>fetch(base+'/api/build',{method:'POST',headers:{'Content-Type':'application/json','X-Jarvis-Session':token},body:JSON.stringify({instruction:'Build a board',consent:true,...data})});
  for(const data of [{model:'opus'},{effort:'invalid'}]) assert.equal((await post(data)).status,400);
  assert.equal(received.length,0);
  for (const effort of ['low','max']) {const reply=await (await post({model:'astra',effort})).json();assert.equal(reply.effort,effort);}
  assert.deepEqual(received.map(item=>item.effort),['low','max']);
  assert.equal((await (await fetch(base+'/api/local-session')).json()).remaining,58);
  assert.equal((await fetch(base+'/api/session',{headers:{'X-Jarvis-Model':'injected'}})).status,400);
});
