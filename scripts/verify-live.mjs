import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {Vision} from '../lib/vision.mjs';
import {browserTools} from './browser.mjs';

// Synthetic drawing and inference only. No desktop content or account is used.
const html=await readFile('public/demo.html','utf8');
const requests=[];let release;
const vision=new Vision({status:async()=>({configured:true,cli:true}),inference:async data=>{
  await new Promise(resolve=>{release=resolve;});
  return {model:data.model==='fable'?'claude-fable-5-1':'gpt-6-astra',effort:data.effort,result:{title:'Live drawing',reply:'Synthetic update.',changes:[],html,observation:{readable:true,summary:'A drawing',observations:[]}}};
}});
const app=createApp({vision});await new Promise(r=>app.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${app.address().port}`;
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
  let stream;const canvas=document.createElement('canvas');canvas.width=800;canvas.height=450;
  const ctx=canvas.getContext('2d');window.drawTest=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,800,450);};window.drawTest('#e5bd7c');
  navigator.mediaDevices.getDisplayMedia=async options=>{window.captureOptions=options;stream=canvas.captureStream(5);setInterval(()=>ctx.fillRect(0,0,800,450),200);return stream;};
  window.endTestCapture=()=>stream.getVideoTracks()[0].dispatchEvent(new Event('ended'));
  window.captureStopped=()=>!stream || stream.getTracks().every(t=>t.readyState==='ended');
});
page.on('request',request=>{if(new URL(request.url()).pathname==='/api/build') requests.push(request.postDataJSON());});
const idle=()=>page.waitForFunction(()=>!document.querySelector('#build').disabled);
const chooseModel=async value=>{await page.locator('#settings-open').click();await page.locator('#model-choice').selectOption(value);await page.locator('#settings-close').click();};
try {
  await mkdir('.artifacts',{recursive:true});await page.goto(base);await idle();
  await page.locator('#try-demo').click();await page.frameLocator('#preview').locator('#todo').waitFor();
  await chooseModel('fable');await idle();
  assert.equal(await page.locator('#live-start').isDisabled(),true,'Live build waits for a shared screen');
  await page.locator('#share-screen').click();await page.locator('#live-controls').waitFor({state:'visible'});
  assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>captureOptions.audio),false);
  await page.locator('#live-start').click();assert.match(await page.locator('#live-consent-detail').innerText(),/paid Claude usage credits/);
  await page.getByRole('button',{name:'Keep it local',exact:true}).click();assert.equal(requests.length,0);
  await page.locator('#live-start').click();await page.locator('#live-confirm').click();
  assert.match(await page.locator('#build-consent-line').innerText(),/^Live build on/);assert.equal(await page.locator('#build-consent').isHidden(),true,'the tick gives way to the lease sentence');
  await page.waitForFunction(()=>document.querySelector('#live-count').textContent==='1 / 10 builds');
  await page.waitForFunction(()=>!document.querySelector('#build-overlay').hidden);
  assert.equal(requests.length,1);assert.ok(requests[0].image);assert.equal(requests[0].model,'fable');
  assert.match(await page.locator('#build-message').innerText(),/Fable is grinding/);
  assert.equal(await page.locator('#model-choice').isDisabled(),true);
  await page.locator('#sent-evidence').evaluate(el=>{el.open=true;});
  assert.match(await page.locator('#sent-image').getAttribute('src'),/^data:image\/jpeg;base64,/);
  await page.frameLocator('#preview').getByRole('textbox',{name:'Task title',exact:true}).fill('Usable while thinking');
  await page.frameLocator('#preview').getByRole('button',{name:'Add task',exact:true}).click();
  assert.match(await page.frameLocator('#preview').locator('#todo').innerText(),/Usable while thinking/);
  await page.screenshot({path:'.artifacts/live-build-desktop.png',fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.build-orbit').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'.artifacts/live-build-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  release();await page.waitForFunction(()=>document.querySelector('#version-label').textContent==='VERSION 02');
  await page.clock.install();await page.clock.fastForward(60000);assert.equal(requests.length,1,'Unchanged frame must not generate');
  await page.evaluate(()=>drawTest('#445577'));await page.waitForTimeout(500);
  await page.clock.fastForward(1000);await page.clock.fastForward(4000);
  await page.waitForFunction(()=>document.querySelector('#live-count').textContent==='2 / 10 builds');
  assert.equal(requests.length,2);assert.ok(requests[1].previous);
  await page.locator('#live-pause').click();release();
  await page.waitForFunction(()=>document.querySelector('#build-overlay').hidden);
  assert.equal(await page.locator('.revision').count(),2,'Canceled build must not add a version');
  await page.clock.fastForward(120000);assert.equal(requests.length,2);
  await page.locator('#screen-stop').click();assert.equal(await page.evaluate(()=>captureStopped()),true);
  await page.locator('#share-screen').click();await page.locator('#live-controls').waitFor({state:'visible'});
  await page.locator('#live-start').click();await page.locator('#live-confirm').click();await page.evaluate(()=>endTestCapture());
  assert.equal(await page.locator('#live-controls').isHidden(),true);
  await page.clock.fastForward(60000);assert.equal(requests.length,2);
  await page.reload();await idle();assert.equal(await page.locator('#live-controls').isHidden(),true);
  await page.locator('#share-screen').click();await page.locator('#live-controls').waitFor({state:'visible'});
  await page.locator('#live-start').click();await page.locator('#live-confirm').click();
  for(let i=0;i<10;i++) {
    await page.evaluate(color=>drawTest(color),i%2?'#eeeeee':'#222222');await page.waitForTimeout(250);
    await page.clock.fastForward(1000);await page.clock.fastForward(4000);
    await page.waitForFunction(n=>document.querySelector('#live-count').textContent===`${n} / 10 builds`,i+1);
    release();await page.waitForFunction(()=>document.querySelector('#build-overlay').hidden);
    await page.clock.fastForward(30000);
  }
  assert.equal(requests.length,12);assert.equal(await page.locator('#live-start').isVisible(),true);
  await page.evaluate(()=>drawTest('#ff0000'));await page.clock.fastForward(120000);
  assert.equal(requests.length,12,'Ten-build cap must prevent another automatic request');
  await page.locator('#screen-stop').click();
  assert.equal(errors.length,0);
  console.log('PASS: 24 live browser checks: consent, credit notice, audio excluded, selected model, lease sentence replaces the tick, Live build waits for a shared screen, exact frame evidence, animated wait, usable preview, locked selection, reduced motion, mobile fit, unchanged-frame suppression, changed-frame revision, pause cancellation, no canceled version, no paused calls, track release, capture-ended stop, no restart on reload, ten-build cap, no calls after cap, zero page errors. Synthetic inference only.');
} finally {release?.();await browser.close();await new Promise(r=>app.close(r));}
