import test from 'node:test';
import assert from 'node:assert/strict';
import {Computer} from '../lib/computer.mjs';
import {createApp} from '../server.mjs';

const proposed={kind:'click',element:'1.2',text:'',key:'',app:'',reason:'Press the fixture button.'};
function fixture(inference=async()=>({result:proposed,model:'test'})){
  const acts=[];let armed=false;
  const native={close(){armed=false;},async call(d){
    if(d.op==='arm'){armed=true;return {armed};}
    if(d.op==='status')return {armed};
    if(d.op==='windows')return {windows:[{id:'42:7:8',title:'Fixture'},{id:'9:9:9',title:'  Padded title  '}]};
    if(d.op==='snapshot')return {title:'Fixture',elements:[{id:'1.2',name:'Calculate',type:'Button',enabled:true}]};
    if(d.op==='act'){assert.ok(armed);acts.push(d);return {performed:true};}
  }};
  return {computer:new Computer({native,inference,platform:'win32'}),acts,native};
}
async function enable(c){return (await c.handle({op:'enable',consent:true})).owner;}
const request=owner=>({op:'propose',owner,task:'Calculate a result',window:'42:7:8',consent:true,model:'astra',effort:'low'});
test('computer requires consent and an owning tab; inference alone cannot act',async()=>{
  const {computer:c,acts}=fixture();await assert.rejects(c.handle({op:'enable'}),/Allow/);
  const owner=await enable(c);await assert.rejects(c.handle({...request('foreign')}),/Enable/);
  const {proposal}=await c.handle(request(owner));assert.equal(acts.length,0);
  await assert.rejects(c.handle({op:'approve',owner,id:proposal.id}),/expired/);
  await c.handle({op:'approve',owner,id:proposal.id,consent:true});assert.equal(acts.length,1);
  await assert.rejects(c.handle({op:'approve',owner,id:proposal.id,consent:true}),/already used/);assert.equal(acts.length,1);
});
test('reject, expiry and emergency stop invalidate actions',async()=>{
  const {computer:c,acts,native}=fixture();const owner=await enable(c);
  const {proposal}=await c.handle(request(owner));await c.handle({op:'reject',owner});
  await assert.rejects(c.handle({op:'approve',owner,id:proposal.id,consent:true}));
  await c.handle(request(owner));c.pending.expires=Date.now()-1;
  await assert.rejects(c.handle({op:'approve',owner,id:c.pending.id,consent:true}),/expired/);
  await c.handle(request(owner));native.close();await assert.rejects(c.handle({op:'approve',owner,id:c.pending.id,consent:true}),/emergency stop/);
  assert.equal(acts.length,0);
});
test('stop during inference cannot publish a late proposal or execute it',async()=>{
  let release,started;const running=new Promise(r=>started=r);
  const {computer:c,acts}=fixture(async()=>{started();await new Promise(r=>release=r);return {result:proposed};});
  const owner=await enable(c);const pending=c.handle(request(owner));await running;c.stop();release();
  await assert.rejects(pending,/stopped/);assert.equal(c.pending,null);assert.equal(acts.length,0);
});
test('unknown actions, controls, apps and raw shortcut strings fail closed',async()=>{
  for(const action of [{...proposed,kind:'shell'},{...proposed,element:'invented'},{...proposed,kind:'launch',app:'powershell'},{...proposed,kind:'key',key:'^r'}]){
    const {computer:c,acts}=fixture(async()=>({result:action}));const owner=await enable(c);
    await assert.rejects(c.handle(request(owner)));assert.equal(acts.length,0);c.stop();
  }
});
test('read is read-only: it never arms, grants no owner, and reports truncation honestly',async()=>{
  const {computer:c,acts,native}=fixture();const ops=[];const call=native.call.bind(native);native.call=async d=>{ops.push(d.op);return call(d);};
  await assert.rejects(c.handle({op:'read',title:'Fixture'}),/Allow/);
  await assert.rejects(c.handle({op:'read',title:'Missing',consent:true}),/not open/);
  ops.length=0;
  await c.handle({op:'read',title:'Padded title',consent:true});
  const read=await c.handle({op:'read',title:'Fixture',consent:true});
  assert.deepEqual(read,{title:'Fixture',controls:1,characters:'Button: Calculate'.length,truncated:false,text:'Button: Calculate'});
  assert.deepEqual(ops,['windows','snapshot','windows','snapshot']);assert.equal(c.owner,null);assert.equal(c.pending,null);assert.equal(acts.length,0);
  assert.equal((await native.call({op:'status'})).armed,false);
  await assert.rejects(c.handle({op:'approve',id:'x',consent:true}),/Enable/);
  const {readable}=await import('../lib/computer.mjs');
  const big=readable({title:'T',limited:true,elements:Array.from({length:3},(_,i)=>({type:'Edit',name:`Field ${i}`,value:'x'.repeat(9000)}))});
  assert.equal(big.truncated,true);assert.equal(big.characters,20000);assert.equal(big.controls,3);
});
test('desktop route rejects foreign origins and missing session token',async()=>{
  const {computer}=fixture();const app=createApp({computer});await new Promise(r=>app.listen(0,'127.0.0.1',r));
  const base=`http://127.0.0.1:${app.address().port}`;
  try{
    const session=await(await fetch(base+'/api/local-session')).json();
    const post=headers=>fetch(base+'/api/computer',{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify({op:'enable',consent:true})});
    assert.equal((await post({})).status,403);
    assert.equal((await post({'X-Jarvis-Session':session.token,Origin:'https://evil.example'})).status,403);
    assert.equal((await post({'X-Jarvis-Session':session.token,Origin:base})).status,200);
  }finally{await new Promise(r=>app.close(r));}
});
