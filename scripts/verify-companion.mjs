import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {Vision} from '../lib/vision.mjs';
import {Computer} from '../lib/computer.mjs';
import {browserTools} from './browser.mjs';

// Isolated synthetic service: no provider request or account operation.
let requests=[],aborted=false;
const vision=new Vision({status:async()=>({configured:true,cli:true,model:'gpt-6-astra'}),inference:async(request,signal)=>{
  const input=JSON.parse(request.prompt);requests.push(input);
  if(input.instruction==='Wait for cancellation')await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Canceled','AbortError'));},{once:true}));
  if(input.instruction==='List two things')return {model:'gpt-6-astra',result:{reply:'Two things stand out:\n1. The heading is too small.\n2. The button has no label.',suggestion:'none',followUps:[]}};
  return {model:'gpt-6-astra',result:{reply:input.instruction.includes('prototype')?'Let’s turn that idea into a working prototype. Open the studio to describe the details and review what gets shared.':input.instruction.includes('setup')?'I can help with supported Windows controls. Choose the window and review each proposed action.':'The selected frame shows a clear starting point. I would simplify the main action and give the content a little more space.',suggestion:input.instruction.includes('prototype')?'build':input.instruction.includes('setup')?'computer':'none',followUps:input.screenEvidenceIncluded?['Show me the steps','Why did it fail','What else stands out']:[]}};
}});
// A synthetic Windows broker: reads answer with fixture text, and every native op is recorded so the verifier can prove a read never arms.
const nativeOps=[];
const computer=new Computer({platform:'win32',native:{close(){},async call(data){nativeOps.push(data.op);
  if(data.op==='arm')return {armed:true};
  if(data.op==='status')return {armed:false};
  if(data.op==='windows')return {windows:[{id:'1:1:1',title:'Design reference window'},{id:'2:2:2',title:'Setup failed: error 0x1'}]};
  if(data.op==='snapshot')return {title:data.window==='2:2:2'?'Setup failed: error 0x1':'Design reference window',elements:[{id:'1.1',name:'Fixture input',type:'Edit',value:'Only this fixture',enabled:true},{id:'1.2',name:'Apply',type:'Button',enabled:true}],limited:false};
  return {};}},inference:async()=>{throw new Error('verify-companion must not plan actions');}});
const server=createApp({vision,computer});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:440,height:760}});const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.nativeMessages=[];window.nativeListener=null;window.chrome={webview:{postMessage(value){window.nativeMessages.push(value);if(value.type==='copy'){setTimeout(()=>window.nativeListener({data:{type:'copied',ok:!/refuse me/.test(value.text)}}),10);}if(value.type==='capture'){const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#efede5';ctx.fillRect(0,0,200,100);ctx.fillStyle='#292e29';ctx.font='18px sans-serif';ctx.fillText('Design reference',15,55);setTimeout(()=>window.nativeListener({data:{type:'capture',requestId:value.requestId,image:canvas.toDataURL('image/jpeg'),label:'Design reference · verification fixture',capturedAt:new Date().toISOString()}}),10);}},addEventListener(type,fn){window.nativeListener=fn;}}};});
const $=id=>page.locator('#companion-'+id);
const idle=()=>page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
const captures=()=>page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='capture').length);
const hostReady=front=>page.evaluate(front=>window.nativeListener({data:{type:'host-ready',mode:'panel',front,hotkeys:{summon:true,quickAsk:true}}}),front);
try{
  await mkdir('.artifacts',{recursive:true});await page.goto(`http://127.0.0.1:${server.address().port}`);await idle();
  assert.ok(await page.locator('#companion').isVisible());assert.equal(await page.locator('.app-shell').isVisible(),false);assert.equal(requests.length,0);
  assert.equal(await captures(),0,'nothing is captured at summon');assert.equal(nativeOps.length,0,'nothing is read at summon');
  await page.screenshot({path:'.artifacts/companion-desktop.png'});checks.push('desktop panel renders without inference, capture or read');
  // The deck: three chips, none sends, only the frame chip captures.
  assert.equal(await page.locator('#companion-chips .chip').count(),3);
  await page.locator('#companion-chips .chip').nth(1).click();assert.equal(await $('input').inputValue(),'Help me finish setting this up.');assert.equal(requests.length,0);assert.equal(await captures(),0);
  assert.match(await $('status').innerText(),/screen & mic off$/);
  await page.locator('#companion-chips .chip').nth(0).click();await $('context').waitFor();assert.equal(await captures(),1);assert.equal(requests.length,0);assert.equal(await $('input').inputValue(),'What do you think about this?');
  checks.push('deck chips fill the box; only the frame chip captures; none sends');
  await $('remove').click();await $('input').fill('What do you think?');await $('send').click();assert.ok(await $('error').isVisible());assert.match(await $('error').innerText(),/Tick the sharing line/);assert.equal(requests.length,0);checks.push('unticked sharing line sends zero requests');
  await $('capture').click();await $('context').waitFor();assert.equal(requests.length,0);assert.match(await $('frame-label').innerText(),/Design reference/);
  assert.equal(await $('status').innerText(),'Ready · 1 frame attached · screen & mic off');checks.push('explicit snapshot remains local with exact preview and an honest status');
  await $('preview').click();const previewText=await page.locator('#send-preview-list').innerText();assert.match(previewText,/What do you think\?/);assert.match(previewText,/Design reference/);assert.match(previewText,/Astra · medium/);assert.match(previewText,/Earlier messages\s*0/);await page.locator('#send-preview [data-close]').click();
  await $('consent').check();await $('send').click();await idle();assert.equal(requests.length,1);assert.equal(requests[0].screenEvidenceIncluded,true);assert.equal(requests[0].contextLabel,'Design reference · verification fixture');assert.ok(await page.locator('.companion-message details').isVisible());
  assert.equal(await $('consent').isChecked(),false,'the tick clears after every send');assert.equal(await $('include').isChecked(),false,'the include box clears when the frame went');assert.match(await $('frame-time').innerText(),/ · sent .* · not attached$/);
  await $('include').check();assert.match(await $('frame-time').innerText(),/attached again$/);assert.equal(await $('consent').isChecked(),false,'re-attaching clears the tick');await $('include').uncheck();
  checks.push('send preview matches the request; tick and include clear after the send');
  assert.equal(await page.locator('.companion-followups button').count(),3);await page.locator('.companion-followups button').first().click();assert.equal(await $('input').inputValue(),'Show me the steps');assert.equal(requests.length,1);checks.push('follow-up chips fill the box without sending');
  // Copy is write-only: the shell gets a copy message with the reply, and no clipboard read exists anywhere.
  await page.locator('.companion-copy').first().click();const copied=await page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='copy'));assert.equal(copied.length,1);assert.match(copied[0].text,/clear starting point/);await page.waitForFunction(()=>document.querySelector('.companion-copy').textContent==='Copied');
  assert.equal(await page.evaluate(()=>window.nativeMessages.some(m=>/read|paste/i.test(m.type))),false);checks.push('Copy posts one write-only clipboard message');
  await $('input').fill('Help me build a prototype');await $('consent').check();await $('input').press('Enter');await idle();assert.equal(requests[1].screenEvidenceIncluded,false);assert.equal('contextLabel' in requests[1],false);assert.equal(requests[1].history.length,2);checks.push('follow-up context bounded; unchecked frame and its label excluded');
  await $('input').fill('List two things');await $('consent').check();await $('send').click();await idle();assert.equal(await page.locator('.companion-message.assistant').last().locator('ol li').count(),2);checks.push('numbered replies render as lists');
  assert.equal(await $('ledger').innerText(),'3 sent');await $('ledger').click();assert.equal(await page.locator('#send-ledger li').count(),3);await page.locator('#send-preview [data-close]').click();
  // A refused request is not a send: the server answers 409 while busy, the ledger says refused, the attachment stays.
  await page.route('**/api/chat',route=>route.fulfill({status:409,json:{type:'error',code:'BUSY',error:'Another request is still finishing.'}}));
  await $('capture').click();await $('context').waitFor();await $('input').fill('Refused one');await $('consent').check();await $('send').click();await idle();
  assert.match(await $('error').innerText(),/still finishing/);assert.equal(await $('include').isChecked(),true,'a refused send keeps the frame attached');assert.equal(await $('ledger').innerText(),'3 sent · 1 refused');
  await page.unroute('**/api/chat');await $('remove').click();checks.push('ledger counts sends, names refusals, and a refused send keeps its attachment');
  // Read text: the front window's accessible text, shown in full with a volume line, sent only while ticked, and never arming anything.
  assert.equal(await $('read').isDisabled(),true,'Read text waits for a known front window');
  await hostReady({title:'Design reference window',process:'notepad'});assert.equal(await $('front-title').innerText(),'In front: Design reference window');
  await $('read').click();await $('text').waitFor();assert.match(await $('text-body').innerText(),/Edit: Fixture input = Only this fixture/);assert.equal(await $('text-volume').innerText(),'2 controls · 53 characters · truncated: no');
  assert.deepEqual(nativeOps,['windows','snapshot'],'a read never arms');assert.equal(await captures(),3,'a read captures no frame');
  assert.match(await $('consent-line').innerText(),/this message, the 6 earlier messages and the window text to Astra/);assert.equal(await $('status').innerText(),'Ready · window text attached · screen & mic off');
  await $('input').fill('What is in the field?');await $('consent').check();await $('send').click();await idle();
  assert.equal(requests[3].windowTextIncluded,true);assert.equal(requests[3].windowTextTruncated,false);assert.match(requests[3].windowText,/Only this fixture/);assert.equal(requests[3].contextLabel,'Design reference window');assert.equal(requests[3].screenEvidenceIncluded,false);
  assert.equal(await $('include-text').isChecked(),false,'the text include clears after the send');assert.match(await page.locator('.companion-provenance').last().innerText(),/Read from: Design reference window · 2 controls/);
  await $('input').fill('And now?');await $('consent').check();await $('send').click();await idle();assert.equal(requests[4].windowTextIncluded,false);assert.equal('windowText' in requests[4],false);
  checks.push('Read text shows every character before it goes, rides only while ticked, and never arms the broker');
  // An error-titled front window puts "Unstick me" first with a text badge, and pressing it reads instead of capturing.
  await hostReady({title:'Setup failed: error 0x1',process:'WindowsTerminal'});assert.equal(await page.locator('#companion-chips .chip').first().innerText(),'Unstick me\nframe','a terminal takes a frame even for a text-first chip');
  await hostReady({title:'Setup failed: error 0x1',process:'Fixture'});assert.equal(await page.locator('#companion-chips .chip').first().innerText(),'Unstick me\ntext');
  await page.locator('#companion-chips .chip').first().click();await page.waitForFunction(()=>document.getElementById('companion-text-label').textContent.includes('Setup failed'));
  assert.equal(await captures(),3,'a text chip captures no frame');assert.match(await $('input').inputValue(),/^Read this error exactly as shown/);assert.equal(requests.length,5);assert.equal(await $('consent').isChecked(),false,'new evidence clears the tick');
  assert.equal(await page.locator('#companion-chips .chip').first().innerText(),'Unstick me\ntext');
  // A read that fails keeps its reason on screen and falls back to a frame.
  await hostReady({title:'Gone window: error',process:'Fixture'});await page.locator('#companion-chips .chip').first().click();await $('context').waitFor();assert.match(await $('error').innerText(),/not open.*Capturing a frame instead/);assert.equal(await captures(),4);await $('remove').click();
  await hostReady({title:'Setup failed: error 0x1',process:'Fixture'});await $('front-clear').click();assert.equal(await page.locator('#companion-chips .chip').count(),3);assert.equal(await $('front').isHidden(),true);
  checks.push('error window: Unstick me first, reads text instead of a frame, not this one falls back');
  await page.getByRole('button',{name:'Build this in the studio'}).click();assert.ok(await page.locator('.app-shell').isVisible());assert.equal(await page.locator('#direction').inputValue(),'Help me build a prototype');assert.equal(await page.locator('#include-frame').isChecked(),false);assert.equal(requests.length,5);checks.push('build handoff fills the studio composer without generation');
  await $('back').click();await $('text-remove').click();await $('input').fill('Help with setup');await $('consent').check();await $('send').click();await idle();await page.getByRole('button',{name:'Let Jarvis do this'}).click();assert.equal(await page.locator('#computer-task').inputValue(),'Help with setup');assert.equal(await page.locator('#computer-permission').isChecked(),false);assert.equal(await page.locator('.app-shell').isVisible(),false);checks.push('computer handoff stays in the column and retains explicit permissions');
  await $('settings').click();await page.locator('#advanced').evaluate(el=>{el.open=true;});await $('voice').check();await page.locator('#settings-close').click();await page.route('**/api/dictate',route=>route.fulfill({json:{text:'A locally dictated question'}}));await $('mic').click();await page.waitForFunction(()=>document.getElementById('companion-input').value.includes('locally dictated'));assert.equal(requests.length,6);checks.push('dictation fills message without sending');
  await $('input').fill('Wait for cancellation');await $('consent').check();await $('send').click();await page.waitForFunction(()=>document.getElementById('companion-status').textContent.startsWith('Thinking'));await $('stop').click();await idle();await new Promise(resolve=>setTimeout(resolve,200));assert.equal(aborted,true);assert.equal(await $('input').inputValue(),'Wait for cancellation');checks.push('stop aborts inference and retains retry text');
  await $('settings').click();await $('clear').click();assert.equal(await page.locator('.companion-message').count(),0);assert.equal(await $('context').isVisible(),false);assert.equal(await $('text').isVisible(),false);await page.locator('#settings-close').click();checks.push('clear removes conversation, frame and text');
  await $('input').fill('A fresh question');await $('consent').check();await $('send').click();await idle();assert.equal(requests.at(-1).history.length,0);
  await $('settings').click();const html=await readFile('public/demo.html');await $('import-file').setInputFiles({name:'My prototype.html',mimeType:'text/html',buffer:html});await page.locator('#version-label').filter({hasText:'VERSION 01'}).waitFor();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');assert.equal(await page.locator('#preview').getAttribute('sandbox'),'allow-scripts allow-forms');checks.push('HTML import preserves sandbox and saves a version');
  await $('back').click();await page.setViewportSize({width:360,height:600});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await $('send').isVisible());await page.screenshot({path:'.artifacts/companion-small.png'});checks.push('compact viewport has no horizontal overflow');
  await page.reload();await idle();assert.equal(await page.locator('.companion-message').count(),0);await $('ledger').isHidden();await $('expand').click();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');checks.push('conversation and ledger clear on reload; imported work persists');
  assert.equal(nativeOps.filter(op=>op==='arm').length,0,'no read ever armed the broker');
  assert.deepEqual(errors,[]);await writeFile('.artifacts/companion-report.json',JSON.stringify({checks,requests:requests.length,errors},null,2));console.log(`PASS: ${checks.length} companion checks, ${requests.length} synthetic model requests, ${nativeOps.length} synthetic native reads, ${errors.length} page errors.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
