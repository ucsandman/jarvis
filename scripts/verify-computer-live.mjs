// Explicit opt-in: uses subscription allowance with only an owned synthetic Windows app.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {createApp} from '../server.mjs';
import {browserTools} from './browser.mjs';
if(!process.argv.includes('--allow-subscription'))throw new Error('Pass --allow-subscription to use Fable subscription allowance. Run verify-computer-native first to compile the fixture.');
const fixture=spawn(resolve('.artifacts/computer-fixture.exe'),[],{windowsHide:false,stdio:'ignore'});
const app=createApp({vision:{status:async()=>({configured:true,cli:true})}});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1100}});page.setDefaultTimeout(200000);
let steps=0;const started=Date.now();
try{
  await page.goto(`http://127.0.0.1:${app.address().port}/?companion`);await page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
  await page.locator('#companion-settings').click();await page.locator('#model-choice').selectOption('fable');await page.locator('#advanced').evaluate(el=>{el.open=true;});await page.locator('#effort-choice').selectOption('low');await page.locator('#settings-close').click();
  await page.locator('#computer-open').click();await page.locator('#computer-permission').check();await page.locator('#computer-enable').click();await page.locator('#computer-work').waitFor();
  await page.locator('#computer-window').selectOption({label:'Computer verification fixture'});
  await page.locator('#computer-task').fill('Set Fixture input to exactly Verified desktop input, then click Apply fixture. Do not interact with Stop fixture control. When the window title is Computer verification complete, report done.');
  for(let i=0;i<4;i++){
    await page.locator('#computer-cloud').check();
    await page.locator('#computer-next').click();await page.locator('#computer-review').waitFor();steps++;
    const title=await page.locator('#computer-action-title').textContent();
    if(title==='Model report'){
      const windows=await page.evaluate(async()=>{
        const {token}=await(await fetch('/api/local-session')).json();
        // Only the existing selected window's title is needed; the action history carries execution evidence.
        return {tokenPresent:!!token};
      });assert.ok(windows.tokenPresent);assert.equal(await page.locator('#computer-history li').count(),2);break;
    }
    if(i===0){assert.match(title,/TYPE.*Fixture input/);assert.match(await page.locator('#computer-action-detail').textContent(),/Replace entire value with:\nVerified desktop input$/);await page.locator('#computer-mode').screenshot({path:'.artifacts/computer-real.png'});}
    else assert.match(title,/CLICK.*Apply fixture/);
    await page.locator('#computer-approve').click();await page.locator('#computer-review').waitFor({state:'hidden'});
  }
  assert.equal(await page.locator('#computer-action-title').textContent(),'Model report');
  await page.locator('#computer-refresh').click();await page.locator('#computer-window option').filter({hasText:'Computer verification complete'}).waitFor({state:'attached'});
  await page.locator('#computer-stop').click();await page.locator('#computer-work').waitFor({state:'hidden'});
  console.log(`PASS: real Fable/native/browser journey, ${steps} model steps, 2 reviewed actions, resulting native title verified, elapsedMs=${Date.now()-started}.`);
}finally{await browser.close();await new Promise(r=>app.close(r));fixture.kill();}
