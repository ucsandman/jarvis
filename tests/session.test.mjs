import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession,selectionChange} from '../public/session.js';

const wait=(ms,value)=>new Promise(resolve=>setTimeout(()=>resolve(value),ms));
const deferred=()=>{let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});return {promise,resolve,reject};};
function harness(overrides={}) {
  const events=[];
  const session=createSession({
    localSession:async()=>({token:'t',remaining:5,dictation:false}),
    providerSession:async selection=>wait(10,{configured:true,token:'t',model:selection.model}),
    restorePreview:async()=>{await wait(60);events.push('preview');},
    onLocal:c=>events.push(`local:${c.token}`),onReady:(s,selection)=>events.push(`ready:${s.model}:${selection.effort}`),
    onError:e=>events.push(`error:${e.message}`),onPreviewError:e=>events.push(`preview-error:${e.message}`),onSettled:()=>events.push('settled'),
    ...overrides});
  return {session,events};
}

test('readiness arrives before a slow preview and is unaffected by a preview that fails',async()=>{
  const {session,events}=harness();
  assert.equal(await session.refresh({model:'astra',effort:'medium'}),'ready');
  assert.deepEqual(events,['local:t','ready:astra:medium','settled'],'the preview is still loading when Ready lands');
  await wait(80);
  assert.equal(events.at(-1),'preview');
  const failing=harness({restorePreview:async()=>{await wait(30);throw new Error('preview down');}});
  assert.equal(await failing.session.refresh({model:'astra',effort:'medium'}),'ready');
  await wait(50);
  assert.deepEqual(failing.events,['local:t','ready:astra:medium','settled','preview-error:preview down']);
});

test('a model change while an older check is pending makes the older answer stale; only the newest is applied',async()=>{
  const first=deferred(),second=deferred();let calls=0;
  const {session,events}=harness({providerSession:async selection=>{calls++;return (calls===1?first:second).promise.then(()=>({configured:true,token:'t',model:selection.model}));},restorePreview:null});
  const a=session.refresh({model:'astra',effort:'medium'});await wait(0);
  const b=session.refresh({model:'fable',effort:'medium'});await wait(0);
  second.resolve();assert.equal(await b,'ready');
  first.resolve();assert.equal(await a,'stale');
  assert.deepEqual(events,['local:t','local:t','ready:fable:medium','settled'],'the older response never reaches onReady or onSettled');
});

test('an effort-only change never refreshes; a pending readiness answer still lands once with the model it asked for',async()=>{
  const gate=deferred();
  const {session,events}=harness({providerSession:async selection=>gate.promise.then(()=>({configured:true,token:'t',model:selection.model})),restorePreview:null});
  const pending=session.refresh({model:'astra',effort:'medium'});await wait(0);
  assert.equal(selectionChange({model:'astra',effort:'medium'},{model:'astra',effort:'high'}),'effort','effort alone is local');
  assert.equal(selectionChange({model:'astra',effort:'medium'},{model:'fable',effort:'medium'}),'model');
  assert.equal(selectionChange({model:'astra',effort:'medium'},{model:'astra',effort:'medium'}),null);
  gate.resolve();assert.equal(await pending,'ready');
  assert.deepEqual(events,['local:t','ready:astra:medium','settled'],'one readiness, for the model that was checked');
});

test('a failed local handshake reports once and settles; a late failure after a newer refresh is dropped',async()=>{
  const {session,events}=harness({localSession:async()=>{throw new Error('Local connection unavailable.');},restorePreview:null});
  assert.equal(await session.refresh({model:'astra',effort:'medium'}),'failed');
  assert.deepEqual(events,['error:Local connection unavailable.','settled']);
  const slow=deferred();
  const late=harness({providerSession:async()=>slow.promise,restorePreview:null});
  const a=late.session.refresh({model:'astra',effort:'medium'});await wait(0);
  const b=late.session.refresh({model:'astra',effort:'medium'});
  slow.reject(new Error('gone'));
  assert.equal(await a,'stale');assert.equal(await b,'failed');
  assert.deepEqual(late.events,['local:t','local:t','error:gone','settled'],'one error, one settle, from the newest refresh');
});
