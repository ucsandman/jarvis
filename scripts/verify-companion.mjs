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
const page=await browser.newPage({viewport:{width:440,height:700}});const errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{window.nativeMessages=[];window.nativeListener=null;window.chrome={webview:{postMessage(value){window.nativeMessages.push(value);if(value.type==='copy'){setTimeout(()=>window.nativeListener({data:{type:'copied',ok:!/refuse me/.test(value.text)}}),10);}if(value.type==='capture'){const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#efede5';ctx.fillRect(0,0,200,100);ctx.fillStyle='#292e29';ctx.font='18px sans-serif';ctx.fillText('Design reference',15,55);setTimeout(()=>window.nativeListener({data:{type:'capture',requestId:value.requestId,image:canvas.toDataURL('image/jpeg'),label:'Design reference · verification fixture',capturedAt:new Date().toISOString()}}),10);}},addEventListener(type,fn){window.nativeListener=fn;}}};});
const $=id=>page.locator('#companion-'+id);
const starters=page.locator('#companion-chips .starter');
const idle=()=>page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
const captures=()=>page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='capture').length);
const hostReady=front=>page.evaluate(front=>window.nativeListener({data:{type:'host-ready',mode:'panel',front,hotkeys:{summon:true,quickAsk:true}}}),front);
const ledgerRows=async()=>{await $('preview').click();const rows=await page.locator('#send-ledger li').allInnerTexts();await page.locator('#send-preview [data-close]').click();return rows;};
try{
  await mkdir('.artifacts',{recursive:true});await page.goto(`http://127.0.0.1:${server.address().port}`);await idle();
  assert.ok(await page.locator('#companion').isVisible());assert.equal(await page.locator('.app-shell').isVisible(),false);assert.equal(requests.length,0);
  assert.equal(await captures(),0,'nothing is captured at summon');assert.equal(nativeOps.length,0,'nothing is read at summon');
  // No tick, no include box, no chip strip, no inner scroll box at rest.
  assert.equal(await page.locator('#companion input[type=checkbox]').count(),0,'the panel has no checkbox');
  assert.equal(await page.locator('#companion details').count(),0,'the panel has no details arrows');
  assert.equal(await page.evaluate(()=>{const s=document.querySelector('.companion-scroll');return s.scrollHeight<=s.clientHeight;}),true,'nothing scrolls at rest');
  assert.match(await $('status').innerText(),/^screen & mic off$/i);assert.equal(await $('send').innerText(),'Send ↑');
  await page.screenshot({path:'.artifacts/companion-desktop.png'});checks.push('desktop panel renders without inference, capture, read, checkbox, arrow or scroll');
  // The starters: three rows, none sends, only the screenshot starter captures, and the button then says so.
  assert.equal(await starters.count(),3);
  await starters.nth(1).click();assert.equal(await $('input').inputValue(),'Help me finish setting this up.');assert.equal(requests.length,0);assert.equal(await captures(),0);
  await starters.nth(0).click();await $('context').waitFor();assert.equal(await captures(),1);assert.equal(requests.length,0);assert.equal(await $('input').inputValue(),'What do you think about this?');
  assert.equal(await $('send').innerText(),'Send with screenshot ↑','the button says what goes');assert.match(await $('frame-time').innerText(),/^Captured .* · \d+ KB$/);
  await $('remove').click();assert.equal(await $('send').innerText(),'Send ↑');checks.push('starters fill the box; only the screenshot starter captures; the button names the attachment');
  await $('capture').click();await $('context').waitFor();assert.equal(requests.length,0);assert.match(await $('frame-label').innerText(),/Design reference/);
  assert.match(await $('status').innerText(),/^screen & mic off$/i,'the sensor line is never overwritten by an attachment');checks.push('explicit screenshot stays local with its exact preview');
  await $('input').fill('What do you think?');
  await $('preview').click();const previewText=await page.locator('#send-preview-list').innerText();assert.match(previewText,/What do you think\?/);assert.match(previewText,/Design reference/);assert.match(previewText,/Astra · medium/);assert.match(previewText,/Earlier messages\s*0/);await page.locator('#send-preview [data-close]').click();
  await page.screenshot({path:'.artifacts/companion-attached.png'});
  await $('send').click();await idle();assert.equal(requests.length,1);assert.equal(requests[0].screenEvidenceIncluded,true);assert.equal(requests[0].contextLabel,'Design reference · verification fixture');
  assert.equal(await $('context').isHidden(),true,'the screenshot leaves the box after it went');assert.equal(await $('send').innerText(),'Send ↑');
  const evidence=page.locator('.companion-message.user .companion-evidence').first();assert.match(await evidence.innerText(),/^Screenshot sent · Design reference/);await evidence.click();assert.ok(await page.locator('.companion-message.user img').first().isVisible());
  checks.push('send preview matches the request; the attachment clears after the send and stays on the message as evidence');
  assert.equal(await page.locator('.companion-followups button').count(),3);await page.locator('.companion-followups button').first().click();assert.equal(await $('input').inputValue(),'Show me the steps');assert.equal(requests.length,1);checks.push('follow-ups fill the box without sending');
  // Copy is write-only: the shell gets a copy message with the reply, and no clipboard read exists anywhere.
  await page.locator('.companion-copy').first().click();const copied=await page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='copy'));assert.equal(copied.length,1);assert.match(copied[0].text,/clear starting point/);await page.waitForFunction(()=>document.querySelector('.companion-copy').textContent==='Copied');
  assert.equal(await page.evaluate(()=>window.nativeMessages.some(m=>/read|paste/i.test(m.type))),false);checks.push('Copy posts one write-only clipboard message');
  await $('input').fill('Help me build a prototype');await $('input').press('Enter');await idle();assert.equal(requests[1].screenEvidenceIncluded,false);assert.equal('contextLabel' in requests[1],false);assert.equal(requests[1].history.length,2);checks.push('follow-up context bounded; a sent screenshot never rides again');
  await $('input').fill('List two things');await $('send').click();await idle();assert.equal(await page.locator('.companion-message.assistant').last().locator('ol li').count(),2);checks.push('numbered replies render as lists');
  assert.equal((await ledgerRows()).length,3);
  // A refused request is not a send: the server answers 409 while busy, the ledger says refused, the attachment stays in the box.
  await page.route('**/api/chat',route=>route.fulfill({status:409,json:{type:'error',code:'BUSY',error:'Another request is still finishing.'}}));
  await $('capture').click();await $('context').waitFor();await $('input').fill('Refused one');await $('send').click();await idle();
  assert.match(await $('error').innerText(),/still finishing/);assert.equal(await $('context').isVisible(),true,'a refused send keeps the screenshot attached');
  const rows=await ledgerRows();assert.equal(rows.length,4);assert.match(rows[3],/refused, nothing reached the model/);
  await page.unroute('**/api/chat');await $('remove').click();checks.push('the ledger counts sends, names refusals, and a refused send keeps its attachment');
  // Summoned from an error window mid-conversation: the starters come back, "Unstick me" reads the window's text, every character shows before it goes, and nothing arms.
  assert.equal(await $('deck').isHidden(),true,'starters leave once there is a conversation');
  await hostReady({title:'Setup failed: error 0x1',process:'WindowsTerminal'});assert.equal(await $('deck').isVisible(),true,'a new window in front brings the starters back');
  assert.match(await starters.first().innerText(),/^Unstick me\ntakes a screenshot of WindowsTerminal$/,'a terminal takes a screenshot even for a text-first starter');
  await hostReady({title:'Setup failed: error 0x1',process:'Fixture'});assert.equal(await $('front-title').innerText(),'In front: Setup failed: error 0x1');
  assert.match(await starters.first().innerText(),/^Unstick me\nreads the text of Fixture$/);
  await starters.first().click();await $('text').waitFor();
  assert.deepEqual(nativeOps,['windows','snapshot'],'a read never arms');assert.equal(await captures(),3,'a text starter captures no frame');
  assert.equal(await $('text-label').innerText(),'Text from Setup failed: error 0x1');assert.match(await $('text-body').innerText(),/Edit: Fixture input = Only this fixture/);assert.equal(await $('text-volume').innerText(),'2 controls · 53 characters');
  assert.match(await $('input').inputValue(),/^Read this error exactly as shown/);assert.equal(await $('send').innerText(),'Send with window text ↑');assert.equal(requests.length,3);
  await $('input').fill('What is in the field?');await $('send').click();await idle();
  assert.equal(requests[3].windowTextIncluded,true);assert.equal(requests[3].windowTextTruncated,false);assert.match(requests[3].windowText,/Only this fixture/);assert.equal(requests[3].contextLabel,'Setup failed: error 0x1');assert.equal(requests[3].screenEvidenceIncluded,false);
  assert.equal(await $('text').isHidden(),true,'the text leaves the box after it went');assert.match(await page.locator('.companion-provenance').last().innerText(),/Read from: Setup failed: error 0x1 · 2 controls/);
  assert.match(await page.locator('.companion-message.user .companion-evidence').last().innerText(),/^Text sent · Setup failed: error 0x1 · 2 controls$/);
  await $('input').fill('And now?');await $('send').click();await idle();assert.equal(requests[4].windowTextIncluded,false);assert.equal('windowText' in requests[4],false);
  checks.push('an error window brings Unstick me back, reads text instead of a frame, shows every character, sends it once, never arms');
  // A read that fails keeps its reason on screen and falls back to a screenshot.
  await hostReady({title:'Gone window: error',process:'Fixture'});await starters.first().click();await $('context').waitFor();assert.match(await $('error').innerText(),/not open.*Taking a screenshot instead/);assert.equal(await captures(),4);await $('remove').click();
  await $('front-clear').click();assert.equal(await starters.count(),3);assert.equal(await $('front').isHidden(),true);assert.match(await starters.first().innerText(),/takes a screenshot of the window$/);
  checks.push('a failed read says why and takes a screenshot; not this one falls back to the generic starters');
  await page.getByRole('button',{name:'Build this in the studio'}).click();assert.ok(await page.locator('.app-shell').isVisible());assert.equal(await page.locator('#direction').inputValue(),'Help me build a prototype');assert.equal(await page.locator('#include-frame').isChecked(),false);assert.equal(requests.length,5);checks.push('build handoff fills the studio composer without generation');
  await $('back').click();await $('input').fill('Help with setup');await $('send').click();await idle();await page.getByRole('button',{name:'Let Jarvis do this'}).click();
  assert.equal(await page.locator('#computer-task').inputValue(),'Help with setup');assert.equal(await page.locator('#computer-lease').evaluate(d=>d.open),true,'the lease asks before anything is armed');assert.equal(await page.locator('#computer-permission').isChecked(),false);assert.equal(await page.locator('.app-shell').isVisible(),false);
  await page.locator('#computer-lease [data-close]').click();assert.equal(nativeOps.filter(op=>op==='arm').length,0);checks.push('computer handoff opens the lease dialog with the task and retains explicit permissions');
  await $('settings').click();await page.locator('#advanced').evaluate(el=>{el.open=true;});await $('voice').check();await page.locator('#settings-close').click();await page.route('**/api/dictate',route=>route.fulfill({json:{text:'A locally dictated question'}}));await $('mic').click();await page.waitForFunction(()=>document.getElementById('companion-input').value.includes('locally dictated'));assert.equal(requests.length,6);checks.push('dictation fills message without sending');
  await $('input').fill('Wait for cancellation');await $('send').click();await page.waitForFunction(()=>document.getElementById('companion-activity').textContent.startsWith('Thinking'));assert.ok(await $('stop').isVisible(),'Stop shows only while something runs');assert.equal(await $('goes').isHidden(),true);
  await $('stop').click();await idle();await new Promise(resolve=>setTimeout(resolve,200));assert.equal(aborted,true);assert.equal(await $('input').inputValue(),'Wait for cancellation');assert.equal(await $('running').isHidden(),true);checks.push('stop aborts inference, retains retry text, and leaves with the running line');
  await $('settings').click();await $('clear').click();assert.equal(await page.locator('.companion-message').count(),0);assert.equal(await $('context').isVisible(),false);assert.equal(await $('text').isVisible(),false);assert.equal(await $('deck').isVisible(),true);await page.locator('#settings-close').click();checks.push('clear removes conversation and attachments and brings the starters back');
  await $('input').fill('A fresh question');await $('send').click();await idle();assert.equal(requests.at(-1).history.length,0);
  await $('settings').click();const html=await readFile('public/demo.html');await $('import-file').setInputFiles({name:'My prototype.html',mimeType:'text/html',buffer:html});await page.locator('#version-label').filter({hasText:'VERSION 01'}).waitFor();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');assert.equal(await page.locator('#preview').getAttribute('sandbox'),'allow-scripts allow-forms');checks.push('HTML import preserves sandbox and saves a version');
  await $('back').click();await page.setViewportSize({width:360,height:600});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await $('send').isVisible());await page.screenshot({path:'.artifacts/companion-small.png'});checks.push('compact viewport has no horizontal overflow');
  await page.reload();await idle();assert.equal(await page.locator('.companion-message').count(),0);assert.equal((await ledgerRows()).length,0,'the ledger clears on reload');
  await $('settings').click();await $('expand').click();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');checks.push('conversation and ledger clear on reload; imported work persists; the studio opens from Settings');
  assert.equal(nativeOps.filter(op=>op==='arm').length,0,'no read ever armed the broker');
  assert.deepEqual(errors,[]);await writeFile('.artifacts/companion-report.json',JSON.stringify({checks,requests:requests.length,errors},null,2));console.log(`PASS: ${checks.length} companion checks, ${requests.length} synthetic model requests, ${nativeOps.length} synthetic native reads, ${errors.length} page errors.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
