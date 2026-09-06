import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {Computer} from '../lib/computer.mjs';
import {browserTools} from './browser.mjs';
let actions=0,armed=false,failRead=false;const planned=[],nativeOps=[];
// After an act the fixture window shows a Display control, so the page can prove it reads the outcome back instead of assuming it.
const computer=new Computer({platform:'win32',native:{close(){armed=false;},async call(data){
  nativeOps.push(data.op);
  if(data.op==='arm'){armed=true;return {armed};}
  if(data.op==='status')return {armed};
  if(data.op==='windows')return {windows:[{id:'1:2:3',title:'Calculator fixture'}]};
  if(data.op==='snapshot'){if(failRead)throw new Error('window gone');return {title:'Calculator fixture',elements:[{id:'1.2',name:'Seven',type:'Button',enabled:true},...(actions?[{id:'1.9',name:'Display',type:'Text',value:'7',enabled:true}]:[])]};}
  if(data.op==='act'){actions++;return {performed:true};}
}},inference:async request=>{planned.push({model:request.model,effort:request.effort});return {model:'fixture',result:{kind:'click',element:'1.2',text:'',key:'',app:'',reason:'Press Seven in the test calculator.'}};}});
const app=createApp({computer,vision:{status:async()=>({configured:true,cli:true})}});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
try{
  await page.goto(`http://127.0.0.1:${app.address().port}/?companion`);await page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
  assert.equal(await page.locator('#computer-mode').isVisible(),false,'Computer mode is not in the conversation');
  await page.locator('#companion-settings').click();await page.locator('#computer-open').click();await page.locator('#computer-lease').waitFor({state:'visible'});assert.equal(await page.locator('#settings').evaluate(d=>d.open),false,'Set it up leaves Settings');
  await page.locator('#computer-enable').click();await page.getByText('Allow local window inspection before enabling Computer mode.').waitFor();count++;
  await page.locator('#computer-permission').check();await page.locator('#computer-enable').click();await page.locator('#computer-work').waitFor();assert.equal(await page.locator('#computer-lease').evaluate(d=>d.open),false);
  assert.equal(await page.locator('.companion-compose').isVisible(),false,'the screen replaces the conversation');assert.match(await page.locator('#computer-left').innerText(),/^(9|10):\d\d left$/);count++;
  await page.locator('#companion-settings').click();await page.locator('#model-choice').selectOption('fable');await page.locator('#settings-close').click();
  assert.match(await page.locator('#computer-consent-line').innerText(),/the chosen window to Fable 5\.1/);count++;
  await page.locator('#computer-window').selectOption('1:2:3');assert.match(await page.locator('#computer-consent-line').innerText(),/reading of Calculator fixture/);assert.equal(await page.locator('#computer-title').innerText(),'Jarvis in Calculator fixture');
  await page.locator('#computer-inspect').click();await page.waitForFunction(()=>document.querySelector('#computer-snapshot').textContent.includes('Seven'));assert.ok(await page.locator('#computer-read').isVisible());count++;
  await page.locator('#computer-next').click();await page.getByText('Say what Jarvis should do first.').waitFor();assert.equal(planned.length,0);count++;
  await page.locator('#computer-task').fill('Enter seven');await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();assert.equal(actions,0);
  assert.equal(await page.locator('#computer input[type=checkbox], #computer-mode input[type=checkbox]').count(),0,'no tick anywhere on the screen');assert.equal(await page.locator('#computer-mode details').count(),0,'no details arrow either');assert.deepEqual(planned,[{model:'fable',effort:'medium'}]);assert.match(await page.locator('#computer-step-label').innerText(),/^Step 1 of 20 · waiting for you$/);count++;
  // Before Approve: the consequence, the window and the target read in plain words; references and the full tree wait behind Details.
  const detail=await page.locator('#computer-action-detail').innerText();assert.match(detail,/^In: Calculator fixture\nTarget: Button "Seven"$/);assert.equal(await page.locator('#computer-reason').innerText(),'Press Seven in the test calculator.');
  assert.equal(await page.locator('#computer-diagnostics').isHidden(),true,'diagnostics are behind Details');await page.locator('#computer-details').click();assert.equal(await page.locator('#computer-details').getAttribute('aria-expanded'),'true');
  const diagnostics=await page.locator('#computer-diagnostics').innerText();assert.match(diagnostics,/Control reference: 1\.2/);assert.match(diagnostics,/SENT WITH THIS MODEL STEP · Calculator fixture\nButton: Seven  #1\.2/);assert.equal(await page.locator('#computer-outcome').isHidden(),true);count++;
  await page.locator('#companion').screenshot({path:'.artifacts/computer-desktop.png'});
  // Approve: one act, then one local reading of the same window; acceptance and outcome are two different lines; no model step runs on its own.
  const plannedBefore=planned.length;
  await page.locator('#computer-approve').click();await page.waitForFunction(()=>document.querySelector('#computer-history').children.length===1);assert.equal(actions,1);assert.equal(await page.locator('#computer-count').innerText(),'1 action');assert.ok(await page.locator('#computer-done').isVisible());
  assert.deepEqual(nativeOps.slice(-3),['status','act','snapshot'],'one act, then one reading');assert.equal(planned.length,plannedBefore,'no model call after Approve');
  assert.ok(await page.locator('#computer-outcome').isVisible());assert.equal(await page.locator('#computer-outcome-accepted').innerText(),'Windows accepted click · Seven.');assert.equal(await page.locator('#computer-outcome-text').innerText(),'Observed: 1 new · Display = 7.');
  assert.match(await page.locator('#computer-history li').last().innerText(),/Windows accepted the action\. Observed: 1 new · Display = 7\.$/);
  assert.equal(await page.locator('#computer-outcome-tree').isHidden(),true);await page.locator('#computer-outcome-details').click();assert.match(await page.locator('#computer-outcome-tree').innerText(),/READ AFTER THE ACTION · Calculator fixture · local, not sent\n[\s\S]*Text: Display = 7  #1\.9/);
  assert.match(await page.locator('#computer-status').innerText(),/^Delivered and read back locally\. Plan the next action when you are ready\.$/);count++;
  await page.locator('#companion').screenshot({path:'.artifacts/computer-outcome.png'});
  // A reading that fails: the action is not retried, and the page says verification was unavailable instead of guessing.
  await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();assert.equal(await page.locator('#computer-outcome').isHidden(),true,'a new proposal clears the last outcome');
  failRead=true;await page.locator('#computer-approve').click();await page.waitForFunction(()=>document.querySelector('#computer-history').children.length===2);assert.equal(actions,2,'one act per approval, none replayed');
  assert.match(await page.locator('#computer-outcome-text').innerText(),/^Verification was unavailable\. The window could not be read after the action/);assert.equal(await page.locator('#computer-outcome-details').isHidden(),true);
  assert.match(await page.locator('#computer-status').innerText(),/^Delivered\. Verification was unavailable/);failRead=false;count++;
  await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();await page.locator('#computer-reject').click();await page.locator('#computer-review').waitFor({state:'hidden'});assert.equal(actions,2);count++;
  // Back keeps the lease; the conversation says so and Open returns to the screen.
  await page.locator('#computer-back').click();assert.ok(await page.locator('.companion-compose').isVisible());assert.match(await page.locator('#companion-goes-text').innerText(),/^Computer mode on/);assert.equal(armed,true);
  await page.locator('#companion-computer').click();assert.ok(await page.locator('#computer-work').isVisible());count++;
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#companion').screenshot({path:'.artifacts/computer-mobile.png'});count++;
  await page.locator('#computer-stop').click();await page.locator('#computer-work').waitFor({state:'hidden'});assert.equal(armed,false);assert.ok(await page.locator('.companion-compose').isVisible(),'Stop returns to the conversation');count++;
  assert.deepEqual(errors,[]);count++;
  console.log(`PASS: ${count} Computer UI checks; Set it up from Settings, lease dialog, the screen replacing the conversation, no tick, model from Settings, inspection, plain-words review with references behind Details, approve with a local read-back, an unavailable read-back without replay, reject, Back and Open, stop, mobile overflow and browser errors. ${actions} synthetic actions, ${planned.length} synthetic plans, ${nativeOps.length} synthetic native ops, no model charges.`);
}finally{await browser.close();await new Promise(r=>app.close(r));}
