import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { subscriptionEnv, SubscriptionError } from '../lib/subscription.mjs';
import { Vision } from '../lib/vision.mjs';
import { createApp } from '../server.mjs';

test('discovery ignores arbitrary native binaries and accepts a custom npm prefix',async t=> {
  const dir=await mkdtemp(join(tmpdir(),'jarvis-discovery-test-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  await writeFile(join(dir,process.platform==='win32'?'codex.exe':'codex'),'not an official installation');
  const url=new URL('../lib/subscription.mjs',import.meta.url).href;
  const probe=()=>spawnSync(process.execPath,['--input-type=module','-e',`import {codexCommand} from ${JSON.stringify(url)}; try { console.log(JSON.stringify(await codexCommand())); } catch(e) { console.log(e.code);process.exitCode=2; }`],{encoding:'utf8',env:{...subscriptionEnv(),HOME:dir,USERPROFILE:dir,PATH:dir}});
  assert.equal(probe().status,2);
  const pkg=join(dir,'node_modules','@openai','codex');await mkdir(join(pkg,'bin'),{recursive:true});
  await writeFile(join(pkg,'bin','codex.js'),'// Discovery only. Never executed.');
  await writeFile(join(pkg,'package.json'),JSON.stringify({name:'impostor',bin:{codex:'bin/codex.js'}}));
  assert.equal(probe().status,2);
  await writeFile(join(pkg,'package.json'),JSON.stringify({name:'@openai/codex',bin:{codex:'bin/codex.js'}}));
  const accepted=probe();assert.equal(accepted.status,0);assert.equal(JSON.parse(accepted.stdout).prefix[0],join(pkg,'bin','codex.js'));
});
test('typed subscription failures preserve only safe categories',async()=> {
  for(const code of ['LOGIN_REQUIRED','SUBSCRIPTION_LIMIT','MODEL_UNAVAILABLE','INCOMPLETE_OUTPUT']) {
    const vision=new Vision({inference:async()=>{throw new SubscriptionError(code);}});
    await assert.rejects(()=>vision.build({instruction:'Build a board'}),error=>error.code===code&&error.status===502);
  }
});
test('installation is explicit, authenticated, and never starts during inference',async t=> {
  let installs=0,release;
  const pending=new Promise(resolve=>{release=resolve;});
  const server=createApp({vision:{status:async()=>({configured:true}),build:async()=>{await pending;return {result:{}};}},install:async()=>{installs++;return {cli:true};}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>{release();server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const {token}=await (await fetch(base+'/api/local-session')).json();
  const post=(path,body,session=token,origin=base)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Jarvis-Session':session,Origin:origin},body:JSON.stringify(body)});
  assert.equal((await post('/api/install-codex',{})).status,403);
  assert.equal((await post('/api/install-codex',{consent:true},'wrong')).status,403);
  assert.equal((await post('/api/install-codex',{consent:true},token,'https://outside.invalid')).status,403);
  assert.equal((await post('/api/install-codex',{consent:true})).status,200);
  const build=post('/api/build',{consent:true});await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal((await post('/api/install-codex',{consent:true})).status,409);
  release();await build;assert.equal(installs,1);
});
