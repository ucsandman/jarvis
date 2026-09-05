import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {Vision} from '../lib/vision.mjs';
import {browserTools} from './browser.mjs';

// Isolated synthetic service: no provider request or account operation.
let requests=[],aborted=false;
const vision=new Vision({status:async()=>({configured:true,cli:true,model:'gpt-6-astra'}),inference:async(request,signal)=>{
  const input=JSON.parse(request.prompt);requests.push(input);
  if(input.instruction==='Wait for cancellation')await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Canceled','AbortError'));},{once:true}));
  return {model:'gpt-6-astra',result:{reply:input.instruction.includes('prototype')?'Let’s turn that idea into a working prototype. Open the workbench to describe the details and review what gets shared.':input.instruction.includes('setup')?'I can help with supported Windows controls. Choose the window and review each proposed action.':'The selected frame shows a clear starting point. I would simplify the main action and give the content a little more space.',suggestion:input.instruction.includes('prototype')?'build':input.instruction.includes('setup')?'computer':'none'}};
}});
const server=createApp({vision});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:440,height:760}});const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.nativeMessages=[];window.nativeListener=null;window.chrome={webview:{postMessage(value){window.nativeMessages.push(value);if(value.type==='capture'){const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#efede5';ctx.fillRect(0,0,200,100);ctx.fillStyle='#292e29';ctx.font='18px sans-serif';ctx.fillText('Design reference',15,55);setTimeout(()=>window.nativeListener({data:{type:'capture',requestId:value.requestId,image:canvas.toDataURL('image/jpeg'),label:'Design reference · verification fixture',capturedAt:new Date().toISOString()}}),10);}},addEventListener(type,fn){window.nativeListener=fn;}}};});
const $=id=>page.locator('#companion-'+id);
const idle=()=>page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
try{
  await mkdir('.artifacts',{recursive:true});await page.goto(`http://127.0.0.1:${server.address().port}`);await idle();
  assert.ok(await page.locator('#companion').isVisible());assert.equal(await page.locator('.app-shell').isVisible(),false);assert.equal(requests.length,0);
  await page.screenshot({path:'.artifacts/companion-desktop.png'});checks.push('desktop panel renders without inference');
  await $('input').fill('What do you think?');await $('send').click();assert.ok(await $('error').isVisible());assert.equal(requests.length,0);checks.push('unchecked consent sends zero requests');
  await $('capture').click();await $('context').waitFor();assert.equal(requests.length,0);assert.match(await $('frame-label').innerText(),/Design reference/);checks.push('explicit snapshot remains local with exact preview');
  await $('consent').check();await $('send').click();await idle();assert.equal(requests.length,1);assert.equal(requests[0].screenEvidenceIncluded,true);assert.ok(await page.locator('.companion-message details').isVisible());
  await $('include').uncheck();await $('input').fill('Help me build a prototype');await $('input').press('Enter');await idle();assert.equal(requests[1].screenEvidenceIncluded,false);assert.equal(requests[1].history.length,2);checks.push('follow-up context bounded and unchecked image excluded');
  await page.getByRole('button',{name:'Continue in workbench'}).click();assert.ok(await page.locator('.app-shell').isVisible());assert.equal(await page.locator('#direction').inputValue(),'Help me build a prototype');assert.equal(await page.locator('#include-frame').isChecked(),false);assert.equal(requests.length,2);checks.push('build handoff fills existing composer without generation');
  await $('back').click();await $('input').fill('Help with setup');await $('send').click();await idle();await page.getByRole('button',{name:'Review computer task'}).click();assert.equal(await page.locator('#computer-task').inputValue(),'Help with setup');assert.equal(await page.locator('#computer-permission').isChecked(),false);checks.push('computer handoff retains explicit permissions');
  await $('back').click();await $('settings').click();await $('voice').check();await $('options-done').click();await page.route('**/api/dictate',route=>route.fulfill({json:{text:'A locally dictated question'}}));await $('mic').click();await page.waitForFunction(()=>document.getElementById('companion-input').value.includes('locally dictated'));assert.equal(requests.length,3);checks.push('dictation fills message without sending');
  await $('input').fill('Wait for cancellation');await $('send').click();await page.waitForFunction(()=>document.getElementById('companion-status').textContent==='Thinking');await $('stop').click();await idle();await new Promise(resolve=>setTimeout(resolve,200));assert.equal(aborted,true);assert.equal(await $('input').inputValue(),'Wait for cancellation');checks.push('stop aborts inference and retains retry text');
  await $('settings').click();await $('clear').click();assert.equal(await page.locator('.companion-message').count(),0);assert.equal(await $('context').isVisible(),false);await $('options-done').click();checks.push('clear removes conversation and reference');
  await $('input').fill('A fresh question');await $('send').click();await idle();assert.equal(requests.at(-1).history.length,0);
  await $('settings').click();const html=await readFile('public/demo.html');await $('import-file').setInputFiles({name:'My prototype.html',mimeType:'text/html',buffer:html});await page.locator('#version-label').filter({hasText:'VERSION 01'}).waitFor();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');assert.equal(await page.locator('#preview').getAttribute('sandbox'),'allow-scripts allow-forms');checks.push('HTML import preserves sandbox and saves a version');
  await $('back').click();await $('options-done').click();await page.setViewportSize({width:360,height:600});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await $('send').isVisible());await page.screenshot({path:'.artifacts/companion-small.png'});checks.push('compact viewport has no horizontal overflow');
  await page.reload();await idle();assert.equal(await page.locator('.companion-message').count(),0);await $('expand').click();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');checks.push('conversation clears on reload; imported work persists');
  assert.deepEqual(errors,[]);await writeFile('.artifacts/companion-report.json',JSON.stringify({checks,requests:requests.length,errors},null,2));console.log(`PASS: ${checks.length} companion checks, ${requests.length} synthetic model requests, ${errors.length} page errors.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

