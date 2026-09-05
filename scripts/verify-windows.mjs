import assert from 'node:assert/strict';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { readFile, mkdtemp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { subscriptionEnv } from '../lib/subscription.mjs';
import { browserTools } from './browser.mjs';
if(process.platform!=='win32') throw new Error('Run this executable verification on Windows x64.');
const {version}=JSON.parse(await readFile('package.json','utf8'));
const build=resolve(`.artifacts/windows-${version}`);
const exe=join(build,`Jarvis-${version}-Windows-x64.exe`);
const clean=await mkdtemp(resolve('.artifacts/desktop-profile-'));
const env={...Object.fromEntries(Object.entries(subscriptionEnv()).map(([key,value])=>[key.toUpperCase(),value])),PATH:join(process.env.WINDIR,'System32'),HOME:clean,USERPROFILE:clean,HOMEDRIVE:clean.slice(0,2),HOMEPATH:clean.slice(2),APPDATA:join(clean,'AppData','Roaming'),LOCALAPPDATA:join(clean,'AppData','Local')};
const probe=spawn(exe,['--verify'],{windowsHide:true,env});
assert.equal(await new Promise(resolve=>probe.on('close',resolve)),0,'Executable extraction/runtime check');
const hash=createHash('sha256').update(await readFile(join(build,'payload.zip'))).digest('hex');
const installed=join(env.LOCALAPPDATA,'Jarvis','versions',`${version}-${hash.slice(0,12)}`);
const node=join(installed,'runtime','node.exe');
const transport=pathToFileURL(join(installed,'lib','subscription.mjs')).href;
const discovery=JSON.parse(execFileSync(node,['--input-type=module','-e',`import {codexCommand,subscriptionStatus} from ${JSON.stringify(transport)};console.log(JSON.stringify({cli:await codexCommand(),status:await subscriptionStatus()}))`],{env,encoding:'utf8',windowsHide:true}));
assert.ok(discovery.cli.prefix[0].startsWith(join(installed,'runtime','node_modules')));
assert.equal(discovery.status.cli,true);
assert.equal(typeof discovery.status.configured,'boolean');
// Windows account-level auth can survive HOME overrides. Isolate only this direct
// CLI status probe explicitly; production subscriptionEnv still rejects CODEX_HOME.
const signedOut=spawnSync(node,[...discovery.cli.prefix,'login','status','-c','cli_auth_credentials_store="file"'],{env:{...env,CODEX_HOME:clean},encoding:'utf8',windowsHide:true});
assert.notEqual(signedOut.status,0);
assert.match(signedOut.stdout+signedOut.stderr,/not logged in/i);
const serverUrl=pathToFileURL(join(installed,'server.mjs')).href;
const desktopKey='c'.repeat(64); // Synthetic QA key, unrelated to any launcher session.
const service=spawn(node,['--input-type=module','-e',`import {createApp} from ${JSON.stringify(serverUrl)};const app=createApp({desktopKey:${JSON.stringify(desktopKey)}});app.listen(0,'127.0.0.1',()=>console.log(app.address().port));`],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
try {
  const port=await new Promise((resolve,reject)=>{service.stdout.once('data',chunk=>resolve(Number(chunk.toString().trim())));service.once('error',reject);service.once('exit',()=>reject(new Error('Packaged server exited before readiness')));});
  const base=`http://127.0.0.1:${port}`;
  assert.equal((await (await fetch(base+'/api/health')).json()).ready,true);
  assert.ok((await (await fetch(base)).text()).includes('Sign in with ChatGPT'));
  assert.ok((await (await fetch(base+'/demo.html')).text()).includes('DAYLIGHT'));
  assert.equal((await fetch(base+'/api/session')).status,403);
  const session=await (await fetch(base+'/api/session',{headers:{'X-Jarvis-Launch':desktopKey}})).json();
  assert.equal(session.cli,true); assert.equal(typeof session.configured,'boolean');
  const {chromium}=browserTools();
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/#launch='+desktopKey);
    await page.waitForFunction(()=>/^(Action needed|ChatGPT connected)$/.test(document.querySelector('#setup-summary').textContent));
    assert.equal(new URL(page.url()).hash,'');
    assert.equal((await page.context().cookies()).length,0,'No launch cookie may leak to another loopback port');
    assert.equal(await page.evaluate(()=>sessionStorage.getItem('jarvisLaunch')?.length),64);
    await page.locator('#try-demo').click();
    await page.frameLocator('#preview').getByRole('textbox',{name:'Task title',exact:true}).fill('Packaged preview works');
    await page.frameLocator('#preview').getByRole('button',{name:'Add task',exact:true}).click();
    assert.match(await page.frameLocator('#preview').locator('#todo').innerText(),/Packaged preview works/);
    await page.reload();
    await page.waitForFunction(()=>/^(Action needed|ChatGPT connected)$/.test(document.querySelector('#setup-summary').textContent));
    await page.frameLocator('#preview').getByRole('textbox',{name:'Task title',exact:true}).waitFor();
    assert.equal(errors.length,0);
    await page.screenshot({path:'.artifacts/windows-first-run.png'});
  } finally {await browser.close();}
  console.log('PASS: 18 assertions: executable extraction; bundled Node/Codex with system-only PATH; explicit signed-out CLI status probe; desktop bootstrap denial, fragment removal, port-isolated session storage, rendered setup/preview and reload. Existing Windows account untouched; no model calls.');
} finally {service.kill();}
