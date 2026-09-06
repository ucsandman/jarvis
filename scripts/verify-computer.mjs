import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {Computer} from '../lib/computer.mjs';
import {browserTools} from './browser.mjs';
let actions=0,armed=false;const planned=[];
const computer=new Computer({platform:'win32',native:{close(){armed=false;},async call(data){
  if(data.op==='arm'){armed=true;return {armed};}
  if(data.op==='status')return {armed};
  if(data.op==='windows')return {windows:[{id:'1:2:3',title:'Calculator fixture'}]};
  if(data.op==='snapshot')return {title:'Calculator fixture',elements:[{id:'1.2',name:'Seven',type:'Button',enabled:true}]};
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
  assert.equal(await page.locator('#computer input[type=checkbox], #computer-mode input[type=checkbox]').count(),0,'no tick anywhere on the screen');assert.deepEqual(planned,[{model:'fable',effort:'medium'}]);assert.match(await page.locator('#computer-step-label').innerText(),/^Step 1 of 20 · waiting for you$/);count++;
  await page.locator('#companion').screenshot({path:'.artifacts/computer-desktop.png'});
  await page.locator('#computer-approve').click();await page.waitForFunction(()=>document.querySelector('#computer-history').children.length===1);assert.equal(actions,1);assert.equal(await page.locator('#computer-count').innerText(),'1 action');assert.ok(await page.locator('#computer-done').isVisible());count++;
  await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();await page.locator('#computer-reject').click();await page.locator('#computer-review').waitFor({state:'hidden'});assert.equal(actions,1);count++;
  // Back keeps the lease; the conversation says so and Open returns to the screen.
  await page.locator('#computer-back').click();assert.ok(await page.locator('.companion-compose').isVisible());assert.match(await page.locator('#companion-goes-text').innerText(),/^Computer mode on/);assert.equal(armed,true);
  await page.locator('#companion-computer').click();assert.ok(await page.locator('#computer-work').isVisible());count++;
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#companion').screenshot({path:'.artifacts/computer-mobile.png'});count++;
  await page.locator('#computer-stop').click();await page.locator('#computer-work').waitFor({state:'hidden'});assert.equal(armed,false);assert.ok(await page.locator('.companion-compose').isVisible(),'Stop returns to the conversation');count++;
  assert.deepEqual(errors,[]);count++;
  console.log(`PASS: ${count} Computer UI checks; Set it up from Settings, lease dialog, the screen replacing the conversation, no tick, model from Settings, inspection, approve/reject, Back and Open, stop, mobile overflow and browser errors. Synthetic planner and native adapter, no model charges.`);
}finally{await browser.close();await new Promise(r=>app.close(r));}
