import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';
import { Vision } from '../lib/vision.mjs';

const image = 'data:image/png;base64,iVBORw0KGgo=';
const observation = { summary:'A task board',readable:true,observations:[{ label:'Board',detail:'Three columns',box:[0,0,1,1] }] };
const html = '<!doctype html><html><head><title>Tasks</title></head><body><button>Add a task</button><p>Sample board</p></body></html>';
async function fixture(t,options) {
  const server = createApp(options);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base,post:async (path,body,token) => fetch(base+path,{ method:'POST',headers:{ 'Content-Type':'application/json','X-Jarvis-Session':token },body:JSON.stringify(body) }) };
}
test('readiness does not invoke subscription status',async t => {
  let checks=0;
  const f=await fixture(t,{vision:{status:async()=>{checks++;throw Error('must not run');}}});
  const response=await fetch(f.base+'/api/health');
  assert.equal(response.status,200);
  assert.equal((await response.json()).app,'jarvis-workbench');
  assert.equal(checks,0);
});
test('visual build returns validated observations and HTML in one inference turn',async()=> {
  let calls=0;
  const vision=new Vision({inference:async input=>{calls++;assert.ok(input.schema.properties.observation);return {result:{title:'Tasks',reply:'Ready',changes:['Added tasks'],html,observation}};}});
  const result=await vision.build({image,instruction:'Build the board'});
  assert.deepEqual(result.result.observation,observation);
  assert.equal(calls,1);
});
test('unreadable combined response does not accept an invented application',async()=> {
  const vision=new Vision({inference:async()=>({result:{title:'',reply:'',changes:[],html:'',observation:{...observation,readable:false}}})});
  await assert.rejects(()=>vision.build({image,instruction:'Build'}),e=>e.code==='UNREADABLE_REFERENCE');
});
test('invalid requests do not consume budget; explicit reset preserves service',async t=> {
  let calls=0;
  const vision=new Vision({status:async()=>({configured:true}),inference:async()=>{calls++;return {result:{title:'Tasks',reply:'Ready',changes:[],html}};}});
  const f=await fixture(t,{vision,maxCalls:1});
  const {token}=await (await fetch(f.base+'/api/session')).json();
  assert.equal((await f.post('/api/build',{instruction:'',consent:true},token)).status,400);
  assert.equal((await f.post('/api/build',{instruction:'Build',consent:true},token)).status,200);
  const limited=await f.post('/api/build',{instruction:'Build',consent:true},token);
  assert.equal(limited.status,429);assert.equal((await limited.json()).code,'SESSION_LIMIT');
  assert.equal((await f.post('/api/reset-budget',{},token)).status,403);
  assert.equal((await f.post('/api/reset-budget',{consent:true},'wrong')).status,403);
  assert.equal((await f.post('/api/reset-budget',{consent:true},token)).status,200);
  assert.equal((await f.post('/api/build',{instruction:'Build',consent:true},token)).status,200);
  assert.equal(calls,2);
});
test('subscription sign-in requires session and explicit consent',async t=> {
  let logins=0;
  const f=await fixture(t,{vision:{status:async()=>({configured:false})},login:async()=>{logins++;return {configured:true};}});
  const {token}=await (await fetch(f.base+'/api/session')).json();
  assert.equal((await f.post('/api/login',{consent:true},'wrong')).status,403);
  assert.equal((await f.post('/api/login',{},token)).status,403);
  assert.equal((await f.post('/api/login',{consent:true},token)).status,200);
  assert.equal(logins,1);
});
