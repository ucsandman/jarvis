import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {Computer} from '../lib/computer.mjs';
import {browserTools} from './browser.mjs';
let actions=0,armed=false;
const computer=new Computer({platform:'win32',native:{close(){armed=false;},async call(data){
  if(data.op==='arm'){armed=true;return {armed};}
  if(data.op==='status')return {armed};
  if(data.op==='windows')return {windows:[{id:'1:2:3',title:'Calculator fixture'}]};
  if(data.op==='snapshot')return {title:'Calculator fixture',elements:[{id:'1.2',name:'Seven',type:'Button',enabled:true}]};
  if(data.op==='act'){actions++;return {performed:true};}
}},inference:async()=>({model:'fixture',result:{kind:'click',element:'1.2',text:'',key:'',app:'',reason:'Press Seven in the test calculator.'}})});
const app=createApp({computer,vision:{status:async()=>({configured:true,cli:true})}});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));let count=0;
try{
  await page.goto(`http://127.0.0.1:${app.address().port}`);await page.locator('#computer-mode > summary').click();
  await page.locator('#computer-enable').click();await page.getByText('Allow local window inspection before enabling Computer mode.').waitFor();count++;
  await page.locator('#computer-permission').check();await page.locator('#computer-enable').click();await page.locator('#computer-work').waitFor();count++;
  await page.locator('#computer-model').selectOption('fable');await page.locator('#computer-setup').click();assert.equal(await page.locator('#model-choice').inputValue(),'fable');count++;
  await page.locator('#computer-window').selectOption('1:2:3');await page.locator('#computer-inspect').click();await page.waitForFunction(()=>document.querySelector('#computer-snapshot').textContent.includes('Seven'));count++;
  await page.locator('#computer-task').fill('Enter seven');await page.locator('#computer-next').click();await page.getByText('Review the sharing notice and allow this model request first.').waitFor();count++;
  await page.locator('#computer-cloud').check();await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();assert.equal(actions,0);count++;
  await page.locator('#computer-mode').screenshot({path:'.artifacts/computer-desktop.png'});
  await page.locator('#computer-approve').click();await page.waitForFunction(()=>document.querySelector('#computer-history').children.length===1);assert.equal(actions,1);count++;
  await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();await page.locator('#computer-reject').click();await page.locator('#computer-review').waitFor({state:'hidden'});assert.equal(actions,1);count++;
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.locator('#computer-mode').screenshot({path:'.artifacts/computer-mobile.png'});count++;
  await page.locator('#computer-stop').click();await page.locator('#computer-work').waitFor({state:'hidden'});assert.equal(armed,false);count++;
  assert.deepEqual(errors,[]);count++;
  console.log(`PASS: ${count} Computer UI checks; local and cloud consent, inspection, approve/reject, stop, mobile overflow and browser errors. Synthetic planner and native adapter, no model charges.`);
}finally{await browser.close();await new Promise(r=>app.close(r));}
