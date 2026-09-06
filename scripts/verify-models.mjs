import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApp} from '../server.mjs';
import {Vision} from '../lib/vision.mjs';

import {browserTools} from './browser.mjs';

const requests=[];let release;let fableConfigured=false;
const html=await readFile('public/demo.html','utf8');
const vision=new Vision({status:async(signal,options)=>({configured:options.model==='fable'?fableConfigured:true,cli:true}),inference:async data=>{
  requests.push(data);await new Promise(resolve=>{release=resolve;});
  return {model:data.model==='fable'?'claude-fable-5-1':'gpt-6-astra',effort:data.effort,result:{title:'Selected effort',reply:'Synthetic verification only.',changes:[],html}};
}});
const app=createApp({vision,login:async()=>{fableConfigured=true;return {configured:true};}});await new Promise(resolve=>app.listen(0,'127.0.0.1',resolve));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const ready=()=>page.waitForFunction(()=>!document.querySelector('#build').disabled);
// Model and effort live in the one Settings dialog; open it, change, close it.
const settings=async()=>{if(!await page.locator('#settings').evaluate(d=>d.open))await page.locator('#settings-open').click();await page.locator('#advanced').evaluate(el=>{el.open=true;});};
const close=async()=>{if(await page.locator('#settings').evaluate(d=>d.open))await page.locator('#settings-close').click();};
try {
  await page.goto(`http://127.0.0.1:${app.address().port}`);await ready();
  await settings();assert.equal(await page.locator('#effort-choice').inputValue(),'medium');
  await page.locator('#effort-choice').selectOption('max');await ready();
  assert.match(await page.locator('#effort-note').innerText(),/much longer/);
  await page.reload();await ready();await settings();assert.equal(await page.locator('#effort-choice').inputValue(),'max');
  await page.locator('#model-choice').selectOption('fable');
  await page.waitForFunction(()=>document.querySelector('#setup-summary').textContent==='Action needed');
  assert.equal(await page.locator('#build').isDisabled(),true);
  assert.match(await page.locator('#billing-note').innerText(),/usage credits/i);
  assert.equal(requests.length,0);
  await page.locator('#login').click();await ready();await close();
  await page.locator('#direction').fill('Build a tiny board with my selected effort');
  assert.match(await page.locator('#build-billing').innerText(),/usage credits/i);
  await page.locator('#build').click();
  await page.waitForFunction(()=>document.querySelector('#model-choice').disabled);
  assert.equal(await page.locator('#effort-choice').isDisabled(),true);
  while(!release) await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(requests[0].effort,'max');assert.equal(requests[0].model,'fable');release();
  await ready();await page.waitForFunction(()=>document.querySelector('#version-label').textContent==='VERSION 01');
  await settings();await page.locator('#effort-choice').selectOption('low');await ready();await close();
  assert.equal(await page.locator('#revisions .revision').count(),1);
  await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.artifacts/model-controls-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await settings();await page.locator('#model-choice').selectOption('fable');
  await page.waitForFunction(()=>document.querySelector('#setup-summary').textContent==='Claude connected');
  await page.screenshot({path:'.artifacts/model-controls-desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: 13 model/effort browser assertions: preference persistence, effort payload, in-flight lock, Fable login and paid-credit line before the build, saved version retention, mobile layout and zero page errors. Synthetic inference only.');
} finally {release?.();await browser.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
