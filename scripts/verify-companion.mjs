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
await page.addInitScript(()=>{window.nativeMessages=[];window.nativeListener=null;window.shellWindows=[{id:'1001',title:'Design reference window',process:'Fixture'},{id:'1002',title:'Setup failed: error 0x1',process:'Fixture'}];window.shellFront={title:'Design reference window',process:'Fixture',id:'1001'};window.chrome={webview:{postMessage(value){window.nativeMessages.push(value);if(value.type==='windows'){setTimeout(()=>window.nativeListener({data:{type:'windows',windows:window.shellWindows}}),10);}if(value.type==='select-target'){const row=value.target==='desktop'?{title:'Whole desktop',process:'',id:'desktop'}:window.shellWindows.find(w=>w.id===value.target);if(row)window.shellFront=row;setTimeout(()=>window.nativeListener({data:{type:'target',ok:!!row,front:window.shellFront}}),10);}if(value.type==='copy'){setTimeout(()=>window.nativeListener({data:{type:'copied',ok:!/refuse me/.test(value.text)}}),10);}if(value.type==='capture'){const canvas=document.createElement('canvas');canvas.width=200;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillStyle='#efede5';ctx.fillRect(0,0,200,100);ctx.fillStyle='#292e29';ctx.font='18px sans-serif';ctx.fillText('Design reference',15,55);setTimeout(()=>window.nativeListener({data:{type:'capture',requestId:value.requestId,image:canvas.toDataURL('image/jpeg'),label:'Design reference · verification fixture',capturedAt:new Date().toISOString()}}),10);}
if(value.type==='screen-on'){window.screenLease={on:true,snapshots:!!value.snapshots,expires:Date.now()+600000,hotkey:true};setTimeout(()=>window.nativeListener({data:{type:'screen',...window.screenLease}}),10);}
if(value.type==='screen-off'){window.screenLease=null;setTimeout(()=>window.nativeListener({data:{type:'screen',on:false,reason:'stopped'}}),10);}
},addEventListener(type,fn){window.nativeListener=fn;}}};});
const $=id=>page.locator('#companion-'+id);
const starters=page.locator('#companion-chips .starter');
const idle=()=>page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
const captures=()=>page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='capture').length);
const hostReady=front=>page.evaluate(front=>window.nativeListener({data:{type:'host-ready',mode:'panel',front,hotkeys:{summon:true,quickAsk:true}}}),front);
const clickOn=(front,element)=>page.evaluate(([front,element])=>window.nativeListener({data:{type:'target',ok:true,via:'click',front,element}}),[front,element]);
const ledgerRows=async()=>{await $('preview').click();const rows=await page.locator('#send-ledger li').allInnerTexts();await page.locator('#send-preview [data-close]').click();return rows;};
try{
  await mkdir('.artifacts',{recursive:true});await page.goto(`http://127.0.0.1:${server.address().port}`);await idle();
  assert.ok(await page.locator('#companion').isVisible());assert.equal(await page.locator('.app-shell').isVisible(),false);assert.equal(requests.length,0);
  assert.equal(await captures(),0,'nothing is captured at summon');assert.equal(nativeOps.length,0,'nothing is read at summon');
  // No tick, no include box, no chip strip, no inner scroll box at rest.
  assert.equal(await page.locator('#companion input[type=checkbox]').count(),0,'the panel has no checkbox');
  assert.equal(await page.locator('#companion details').count(),0,'the panel has no details arrows');
  assert.equal(await page.evaluate(()=>{const s=document.querySelector('.companion-scroll');return s.scrollHeight<=s.clientHeight;}),true,'nothing scrolls at rest');
  assert.match(await $('status').innerText(),/^screen & mic off$/i);assert.equal(await $('send').innerText(),'↑');assert.equal(await $('send').getAttribute('aria-label'),'Send');
  // The shape: the tile is the window with its app name, the starters are plain rows (no card chrome), the box is one line at rest, and the page told the shell how tall it wants to be.
  assert.equal(await $('front').isHidden(),true,'no window yet, no tile');await hostReady({title:'Design reference window',process:'Fixture',id:'1001'});await $('front').waitFor();
  assert.equal(await $('front-title').innerText(),'Design reference window');assert.equal(await $('front-app').innerText(),'Fixture');assert.equal(await $('front-letter').innerText(),'F','no icon from the fixture, so the app initial stands in');
  assert.equal(await starters.first().evaluate(el=>getComputedStyle(el).borderRadius+' '+getComputedStyle(el).backgroundColor),'0px rgba(0, 0, 0, 0)','starters are rows, not cards');
  assert.equal(await $('input').evaluate(el=>el.offsetHeight),21,'the box is one line at rest');
  const wanted=await page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='resize' && m.height).at(-1)?.height);assert.ok(wanted>=300 && wanted<=460,`the page asked the shell for ${wanted}px; expected the empty panel between 300 and 460`);
  await page.setViewportSize({width:440,height:wanted});await page.screenshot({path:'.artifacts/companion-desktop.png'});await page.setViewportSize({width:440,height:700});
  checks.push(`desktop panel renders without inference, capture, read, checkbox, arrow or scroll; tile, plain starters, one-line box; asks the shell for ${wanted}px`);
  // The live eyes in the header: the shell posts the cursor while it is outside the window, and the page turns both eyes toward it.
  const eyeCentres=()=>page.locator('#companion .mark-live .eye').evaluateAll(nodes=>nodes.map(node=>Number(node.getAttribute('cx'))));
  await page.evaluate(()=>window.nativeListener({data:{type:'cursor',x:5000,y:500,left:0,top:0}}));
  const away=await eyeCentres();
  assert.ok(away[0]>26 && away[1]>38,`the eyes did not turn toward a cursor off to the right: ${away.join(', ')}`);
  const onMark=await page.locator('#companion .mark-live').evaluate(svg=>{const r=svg.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)};});
  await page.evaluate(point=>window.nativeListener({data:{type:'cursor',x:point.x,y:point.y,left:0,top:0}}),onMark);
  const home=await eyeCentres();
  assert.deepEqual(home,[26,38],`the eyes did not come home with the cursor on the mark: ${home.join(', ')}`);
  checks.push(`the header mark's eyes turned to ${away.map(v=>v.toFixed(2)).join(' and ')} for a cursor outside the window and came home to 26 and 38 on the mark`);
  // The box grows a line per line and shrinks back; the grip sets a height that sticks until the box is emptied.
  await $('input').fill('one\ntwo\nthree');assert.equal(await $('input').evaluate(el=>el.offsetHeight),63,'three lines, three lines tall');
  await $('input').fill('one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten');assert.equal(await $('input').evaluate(el=>el.offsetHeight),168,'eight lines at most, then it scrolls inside');assert.equal(await $('input').evaluate(el=>getComputedStyle(el).overflowY),'auto');
  await $('input').fill('');assert.equal(await $('input').evaluate(el=>el.offsetHeight),21,'empty again, one line again');
  const grip=await $('grip').boundingBox();await page.mouse.move(grip.x+6,grip.y+6);await page.mouse.down();await page.mouse.move(grip.x+6,grip.y+126,{steps:4});await page.mouse.up();
  assert.equal(await $('input').evaluate(el=>el.offsetHeight),141,'the grip dragged the box 120px taller');await $('input').fill('still tall');assert.equal(await $('input').evaluate(el=>el.offsetHeight),141,'a dragged height sticks while there is text');
  await $('input').fill('');assert.equal(await $('input').evaluate(el=>el.offsetHeight),21,'emptying the box lets go of the dragged height');
  checks.push('the box grows and shrinks with its lines, caps at eight, and the grip height sticks until the box is emptied');
  // The starters: three rows, none sends, only the screenshot starter captures, and the button then says so.
  assert.equal(await starters.count(),3);
  await starters.nth(1).click();assert.equal(await $('input').inputValue(),'Help me finish setting this up.');assert.equal(requests.length,0);assert.equal(await captures(),0);
  await starters.nth(0).click();await $('context').waitFor();assert.equal(await captures(),1);assert.equal(requests.length,0);assert.equal(await $('input').inputValue(),'What do you think about this?');
  assert.equal(await $('send').innerText(),'Send with screenshot ↑','the button says what goes');assert.match(await $('frame-time').innerText(),/^Captured .* · \d+ KB$/);
  await $('remove').click();assert.equal(await $('send').innerText(),'↑');checks.push('starters fill the box; only the screenshot starter captures; the button names the attachment');
  await $('capture').click();await $('context').waitFor();assert.equal(requests.length,0);assert.match(await $('frame-label').innerText(),/Design reference/);
  assert.match(await $('status').innerText(),/^screen & mic off$/i,'the sensor line is never overwritten by an attachment');checks.push('explicit screenshot stays local with its exact preview');
  await $('input').fill('What do you think?');
  await $('preview').click();const previewText=await page.locator('#send-preview-list').innerText();assert.match(previewText,/What do you think\?/);assert.match(previewText,/Design reference/);assert.match(previewText,/Astra · medium/);assert.match(previewText,/Earlier messages\s*0/);await page.locator('#send-preview [data-close]').click();
  await page.screenshot({path:'.artifacts/companion-attached.png'});
  await $('send').click();await idle();assert.equal(requests.length,1);assert.equal(requests[0].screenEvidenceIncluded,true);assert.equal(requests[0].contextLabel,'Design reference · verification fixture');
  assert.equal(await $('context').isHidden(),true,'the screenshot leaves the box after it went');assert.equal(await $('send').innerText(),'↑');
  assert.equal(await page.locator('.companion-message.user .companion-bubble p').first().innerText(),'What do you think?');assert.equal(await page.locator('.companion-message.assistant > span').count(),0,'no name labels on messages');
  const evidence=page.locator('.companion-message.user .companion-evidence').first();assert.match(await evidence.getAttribute('aria-label'),/^Screenshot sent · Design reference/);assert.ok(await evidence.locator('img').isVisible(),'the sent frame is a thumbnail in the bubble');await evidence.click();assert.ok(await page.locator('.companion-message.user > img').first().isVisible());
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
  assert.equal(await $('chips').isVisible(),false,'starters leave once there is a conversation');assert.equal(await $('deck').evaluate(el=>el.classList.contains('slim')),true,'the tile is one line above the box mid-conversation');
  assert.equal(await $('front-title').innerText(),'Fixture · Design reference window','the slim tile names the app first');
  await hostReady({title:'Setup failed: error 0x1',process:'WindowsTerminal'});assert.equal(await $('chips').isVisible(),true,'a new window in front brings the starters back');
  assert.equal(await starters.first().innerText(),'Unstick me');assert.equal(await $('front-app').innerText(),'WindowsTerminal');
  await starters.first().click();await $('context').waitFor();assert.equal(await captures(),4,'a terminal takes a screenshot even for a text-first starter');assert.equal(nativeOps.length,0);await $('remove').click();
  await hostReady({title:'Setup failed: error 0x1',process:'Fixture'});assert.equal(await $('front-title').innerText(),'Setup failed: error 0x1');assert.equal(await $('front-app').innerText(),'Fixture');
  assert.equal(await starters.first().innerText(),'Unstick me');
  await starters.first().click();await $('text').waitFor();
  assert.deepEqual(nativeOps,['windows','snapshot'],'a read never arms');assert.equal(await captures(),4,'a text starter captures no frame');
  assert.equal(await $('text-label').innerText(),'Text from Setup failed: error 0x1');assert.match(await $('text-body').innerText(),/Edit: Fixture input = Only this fixture/);assert.equal(await $('text-volume').innerText(),'2 controls · 53 characters');
  assert.match(await $('input').inputValue(),/^Read this error exactly as shown/);assert.equal(await $('send').innerText(),'Send with window text ↑');assert.equal(requests.length,3);
  await $('input').fill('What is in the field?');await $('send').click();await idle();
  assert.equal(requests[3].windowTextIncluded,true);assert.equal(requests[3].windowTextTruncated,false);assert.match(requests[3].windowText,/Only this fixture/);assert.equal(requests[3].contextLabel,'Setup failed: error 0x1');assert.equal(requests[3].screenEvidenceIncluded,false);
  assert.equal(await $('text').isHidden(),true,'the text leaves the box after it went');
  assert.match(await page.locator('.companion-message.user .companion-evidence').last().getAttribute('aria-label'),/^Text sent · Setup failed: error 0x1 · 2 controls$/);
  await $('input').fill('And now?');await $('send').click();await idle();assert.equal(requests[4].windowTextIncluded,false);assert.equal('windowText' in requests[4],false);
  checks.push('an error window brings Unstick me back, reads text instead of a frame, shows every character, sends it once, never arms');
  // A read that fails keeps its reason on screen and falls back to a screenshot.
  await hostReady({title:'Gone window: error',process:'Fixture'});await starters.first().click();await $('context').waitFor();assert.match(await $('error').innerText(),/not open.*Taking a screenshot instead/);assert.equal(await captures(),5);await $('remove').click();
  checks.push('a failed read says why and takes a screenshot');
  // The picker: change lists the whole desktop and every open window from the shell, a pick tells the shell and re-fits the starters, a stale row says so.
  const targets=page.locator('#companion-targets .starter');
  await $('front').click();await $('targets').waitFor();assert.equal(await targets.count(),3);assert.equal(await $('chips').isHidden(),true,'the list replaces the starters');
  assert.match(await targets.nth(0).innerText(),/^Whole desktop\nevery monitor, without Sidelook$/);assert.match(await targets.nth(1).innerText(),/^Design reference window\nFixture$/);
  assert.equal(await page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='windows').length),1);assert.equal(await captures(),5,'listing captures nothing');
  await targets.nth(0).click();await page.waitForFunction(()=>document.getElementById('companion-front-title').textContent==='Whole desktop');assert.equal(await $('front-app').innerText(),'');assert.equal(await $('front-letter').innerText(),'⧉');
  assert.deepEqual(await page.evaluate(()=>window.nativeMessages.filter(m=>m.type==='select-target').map(m=>m.target)),['desktop']);
  assert.equal(await $('targets').isHidden(),true);assert.equal(await starters.count(),3);
  await $('capture').click();await $('context').waitFor();assert.equal(await captures(),6);assert.equal(await starters.first().isDisabled(),false,'starters stay live after a capture');await $('remove').click();
  await $('front').click();await $('targets').waitFor();assert.equal(await targets.nth(0).getAttribute('aria-current'),'true','the current pick is marked');
  await page.evaluate(()=>{window.shellWindows=window.shellWindows.slice(0,1);});await targets.nth(2).click();await page.waitForFunction(()=>document.getElementById('companion-error').textContent.includes('no longer open'));
  await page.waitForFunction(()=>document.querySelectorAll('#companion-targets .starter').length===2,null,{timeout:3000});
  await targets.nth(1).click();await page.waitForFunction(()=>document.getElementById('companion-front-title').textContent==='Design reference window');assert.equal(await $('targets').isHidden(),true);
  assert.equal(nativeOps.filter(op=>op==='arm').length,0);checks.push('the tile lists the desktop and every window, a pick re-fits the starters and captures that target, a closed window is refused and relisted');
  await page.getByRole('button',{name:'Build this in the studio'}).click();assert.ok(await page.locator('.app-shell').isVisible());assert.equal(await page.locator('#direction').inputValue(),'Help me build a prototype');assert.equal(await page.locator('#frame-chip').isHidden(),true,'no screenshot went with that message, so none is attached');assert.equal(await page.locator('#build-label').innerText(),'Build');assert.equal(requests.length,5);checks.push('build handoff fills the studio composer without generation');
  await $('back').click();await $('input').fill('Help with setup');await $('send').click();await idle();await page.getByRole('button',{name:'Let Sidelook do this'}).click();
  assert.equal(await page.locator('#computer-task').inputValue(),'Help with setup');assert.equal(await page.locator('#computer-lease').evaluate(d=>d.open),true,'the lease asks before anything is armed');assert.equal(await page.locator('#computer-permission').isChecked(),false);assert.equal(await page.locator('.app-shell').isVisible(),false);
  await page.locator('#computer-lease [data-close]').click();assert.equal(nativeOps.filter(op=>op==='arm').length,0);checks.push('computer handoff opens the lease dialog with the task and retains explicit permissions');
  await $('settings').click();await page.locator('#advanced').evaluate(el=>{el.open=true;});await $('voice').check();await page.locator('#settings-close').click();await page.route('**/api/dictate',route=>route.fulfill({json:{text:'A locally dictated question'}}));await $('mic').click();await page.waitForFunction(()=>document.getElementById('companion-input').value.includes('locally dictated'));assert.equal(requests.length,6);checks.push('dictation fills message without sending');
  await $('input').fill('Wait for cancellation');await $('send').click();await page.waitForFunction(()=>document.getElementById('companion-activity').textContent.startsWith('Thinking'));assert.ok(await $('stop').isVisible(),'Stop shows only while something runs');assert.equal(await $('goes').isHidden(),true);
  await $('stop').click();await idle();await new Promise(resolve=>setTimeout(resolve,200));assert.equal(aborted,true);assert.equal(await $('input').inputValue(),'Wait for cancellation');assert.equal(await $('running').isHidden(),true);checks.push('stop aborts inference, retains retry text, and leaves with the running line');
  await $('settings').click();await $('clear').click();assert.equal(await page.locator('.companion-message').count(),0);assert.equal(await $('context').isVisible(),false);assert.equal(await $('text').isVisible(),false);assert.equal(await $('deck').isVisible(),true);await page.locator('#settings-close').click();checks.push('clear removes conversation and attachments and brings the starters back');
  await $('input').fill('A fresh question');await $('send').click();await idle();assert.equal(requests.at(-1).history.length,0);
  await $('settings').click();const html=await readFile('public/demo.html');await $('import-file').setInputFiles({name:'My prototype.html',mimeType:'text/html',buffer:html});await page.locator('#version-label').filter({hasText:'VERSION 01'}).waitFor();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');assert.equal(await page.locator('#preview').getAttribute('sandbox'),'allow-scripts allow-forms');checks.push('HTML import preserves sandbox and saves a version');
  await $('back').click();await page.setViewportSize({width:360,height:600});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.ok(await $('send').isVisible());await page.screenshot({path:'.artifacts/companion-small.png'});checks.push('compact viewport has no horizontal overflow');
  // The header line leases Screen on; the page follows synthetic clicks from the shell and keeps a fresh screenshot.
  await page.setViewportSize({width:440,height:700});
  assert.equal(await page.locator('#companion-sense').evaluate(el=>el.tagName),'BUTTON','the sensor line is a button');
  assert.equal(await $('status').innerText(),'Screen & mic off');
  await $('sense').click();await page.locator('#screen-lease').waitFor();
  assert.equal(await page.locator('#screen-lease input[type=checkbox]').count(),0,'the lease has no checkbox');
  assert.equal(await page.locator('#screen-lease .dialog-actions button').count(),3,'Not now, follow, follow with screenshots');
  await page.locator('#screen-follow').click();await page.waitForFunction(()=>/^Screen on · following clicks · \d+:\d\d$/.test(document.getElementById('companion-status').textContent));
  assert.equal(await page.locator('#companion-dot').getAttribute('class'),'on');
  // Idle cost while following: the countdown rewrites one text node once a second and nothing else in the panel moves (72 mutations per 2 s at 0.13.0, when a 250 ms timer ran the full render).
  const idleMutations=await page.evaluate(()=>new Promise(resolve=>{let mutations=0;new MutationObserver(records=>{mutations+=records.length;}).observe(document.getElementById('companion'),{subtree:true,childList:true,characterData:true,attributes:true});setTimeout(()=>resolve(mutations),2000);}));
  assert.ok(idleMutations<=4,`idle following made ${idleMutations} DOM mutations in 2 s; expected at most 4`);
  const before=await captures();
  await clickOn({title:'Inbox – Gmail',process:'brave',id:'2001'},{name:'Send',type:'button'});
  await page.waitForFunction(()=>document.getElementById('companion-front-title').textContent==='Inbox – Gmail' && document.getElementById('companion-front-app').textContent==='Brave · Send button');
  assert.equal(await page.locator('#companion-chips .starter').count(),3,'the deck refits to the clicked app');
  await clickOn({title:'Inbox – Gmail',process:'brave',id:'2001'},{name:'Compose',type:'button'});
  await page.waitForFunction(()=>document.getElementById('companion-front-app').textContent==='Brave · Compose button');
  await page.waitForTimeout(3200);assert.equal(await captures(),before,'following alone never captures');
  await $('sense').click();await page.waitForFunction(()=>document.getElementById('companion-status').textContent==='Screen & mic off');
  assert.equal(await $('note').innerText(),'Screen off · stopped early');
  checks.push(`the header line leases following, shows the clicked control, refits once per window, stops from the same line; idle following made ${idleMutations} DOM mutations in 2 s`);
  await $('sense').click();await page.locator('#screen-snapshots').click();await page.waitForFunction(()=>/fresh screenshots/.test(document.getElementById('companion-status').textContent));
  await clickOn({title:'Letter – Word',process:'WINWORD',id:'2002'},null);
  await page.waitForTimeout(2500);assert.equal(await captures(),before,'not before the quiet gap');
  await $('context').waitFor({timeout:2000});assert.equal(await captures(),before+1,'one capture after 3 quiet seconds');
  assert.equal(await $('send').innerText(),'Send with screenshot ↑');
  assert.match(await $('frame-time').innerText(),/replaces itself after each pause$/);
  await page.screenshot({path:'.artifacts/companion-screen-on.png'});
  await $('remove').click();await clickOn({title:'Letter – Word',process:'WINWORD',id:'2002'},null);await page.waitForTimeout(3300);assert.equal(await captures(),before+1,'× mutes the same window');
  await $('sense').click();await page.waitForFunction(()=>document.getElementById('companion-status').textContent==='Screen & mic off');
  assert.equal(await page.locator('#companion input[type=checkbox]').count(),0,'still no checkbox in the panel');
  assert.equal(await page.evaluate(()=>{const s=document.querySelector('.companion-scroll');return s.scrollHeight<=s.clientHeight;}),true,'still nothing scrolls at rest');
  checks.push('fresh screenshots land in the box after a pause, never send on their own, and × mutes the window');
  await page.reload();await idle();assert.equal(await page.locator('.companion-message').count(),0);assert.equal((await ledgerRows()).length,0,'the ledger clears on reload');
  await $('bench').click();assert.equal(await page.locator('#prototype-title').innerText(),'My prototype');checks.push('conversation and ledger clear on reload; imported work persists; Bench in the header opens the studio');
  assert.equal(nativeOps.filter(op=>op==='arm').length,0,'no read ever armed the broker');
  assert.deepEqual(errors,[]);await writeFile('.artifacts/companion-report.json',JSON.stringify({checks,requests:requests.length,errors},null,2));console.log(`PASS: ${checks.length} companion checks, ${requests.length} synthetic model requests, ${nativeOps.length} synthetic native reads, ${errors.length} page errors.`);
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
