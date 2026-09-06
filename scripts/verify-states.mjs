import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createApp} from '../server.mjs';
import {Vision} from '../lib/vision.mjs';
import {Computer} from '../lib/computer.mjs';
import {browserTools} from './browser.mjs';

// Every control in every surface and dialog, at rest and under the mouse, plus every text node at rest: text-on-background contrast,
// and whether a filled button loses its fill on hover. Born from 0.15.0, where a retint left `--accent-hover: var(--accent-hover)`
// and every primary button vanished under the cursor while every other verifier stayed green. Transitions are off so hover is measured settled.
// Also: every var(--token) used in a stylesheet must be defined in one, and no token may define itself.
const styles=await Promise.all(['public/style.css','public/companion.css','site/site.css'].map(f=>readFile(f,'utf8')));
const defined=new Set(styles.flatMap(css=>[...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m=>m[1])));
const used=new Set(styles.flatMap(css=>[...css.matchAll(/var\((--[a-z0-9-]+)/g)].map(m=>m[1])));
const undefinedTokens=[...used].filter(t=>!defined.has(t));
const selfTokens=styles.flatMap(css=>[...css.matchAll(/(--[a-z0-9-]+)\s*:\s*var\((--[a-z0-9-]+)\)/g)].filter(m=>m[1]===m[2]).map(m=>m[1]));
assert.deepEqual(undefinedTokens,[],`tokens used but never defined: ${undefinedTokens.join(', ')}`);
assert.deepEqual(selfTokens,[],`tokens that define themselves: ${selfTokens.join(', ')}`);

const vision=new Vision({status:async()=>({configured:true,cli:true,model:'gpt-6-astra'}),inference:async()=>{throw new Error('verify-states makes no model requests');}});
const computer=new Computer({platform:'win32',native:{close(){},async call(data){return data.op==='windows'?{windows:[]}:{armed:false};}},inference:async()=>{throw new Error('verify-states plans nothing');}});
const server=createApp({vision,computer});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const site=createServer(async(req,res)=>{const path='.artifacts/site'+(req.url==='/'?'/index.html':req.url.split('?')[0]);try{const body=await readFile(path);res.setHeader('content-type',path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':path.endsWith('.svg')?'image/svg+xml':path.endsWith('.png')?'image/png':'text/html');res.end(body);}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>site.listen(0,'127.0.0.1',resolve));
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='*{transition:none!important;animation:none!important}';document.head.append(style);});window.nativeListener=null;window.chrome={webview:{postMessage(){},addEventListener(type,fn){window.nativeListener=fn;}}};});
const luminance=c=>{const m=c.match(/[\d.]+/g);const [r,g,b]=m.slice(0,3).map(Number).map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;});return .2126*r+.7152*g+.0722*b;};
const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const findings=[];let controls=0,texts=0;
async function measure(scope,label){
  const items=await page.evaluate(scope=>{
    const root=document.querySelector(scope);
    const alpha=c=>{const m=c.match(/[\d.]+/g);return m&&m.length>3?Number(m[3]):1;};
    const bgOf=el=>{let e=el;while(e){const bg=getComputedStyle(e).backgroundColor;if(alpha(bg)>.5)return bg;e=e.parentElement;}return getComputedStyle(document.body).backgroundColor;};
    const visible=el=>{const r=el.getBoundingClientRect();const s=getComputedStyle(el);return r.width>=2&&r.height>=2&&s.visibility!=='hidden'&&Number(s.opacity)>=.5&&!(el.closest('dialog')&&!el.closest('dialog').open);};
    const name=el=>{let p=[],e=el;while(e&&e!==document.body){p.unshift(e.id?'#'+e.id:e.tagName.toLowerCase());e=e.parentElement;}return p.join('>');};
    const out=[];
    for(const el of root.querySelectorAll('button,a,select,summary')){if(!visible(el))continue;const s=getComputedStyle(el);out.push({control:true,path:name(el),id:el.id,text:(el.getAttribute('aria-label')||el.textContent||'').trim().slice(0,40),disabled:el.disabled===true,color:s.color,bg:s.backgroundColor,effBg:bgOf(el)});}
    for(const el of root.querySelectorAll('*')){if(![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;if(!visible(el))continue;const s=getComputedStyle(el);out.push({control:false,path:name(el),text:el.textContent.trim().slice(0,40),disabled:el.closest('button,select')?.disabled===true,color:s.color,effBg:bgOf(el)});}
    return out;
  },scope);
  for(const it of items){
    const where=`${label} ${it.path} "${it.text}"`;
    if(!it.control){texts++;const c=contrast(it.color,it.effBg);if(!it.disabled&&c<4.5)findings.push(`TEXT ${c.toFixed(2)}:1 ${where} ${it.color} on ${it.effBg}`);continue;}
    controls++;
    const rest=contrast(it.color,it.effBg);if(!it.disabled&&rest<4.5)findings.push(`REST ${rest.toFixed(2)}:1 ${where} ${it.color} on ${it.effBg}`);
    if(it.disabled)continue;
    const locator=page.locator(it.id?`#${it.id}`:it.path).first();
    let hover=null;try{await locator.hover({force:true,timeout:1500});hover=await locator.evaluate(el=>{const s=getComputedStyle(el);const alpha=c=>{const m=c.match(/[\d.]+/g);return m&&m.length>3?Number(m[3]):1;};let e=el,eff=getComputedStyle(document.body).backgroundColor;while(e){const bg=getComputedStyle(e).backgroundColor;if(alpha(bg)>.5){eff=bg;break;}e=e.parentElement;}return {color:s.color,bg:s.backgroundColor,effBg:eff};});}catch{}
    if(!hover)continue;
    const under=contrast(hover.color,hover.effBg);if(under<4.5)findings.push(`HOVER ${under.toFixed(2)}:1 ${where} ${hover.color} on ${hover.effBg}`);
    if(it.bg!=='rgba(0, 0, 0, 0)'&&hover.bg==='rgba(0, 0, 0, 0)')findings.push(`VANISH ${where} fill ${it.bg} became transparent under the mouse`);
  }
  await page.mouse.move(0,0);
}
try{
  await page.goto(`http://127.0.0.1:${server.address().port}/?companion`);await page.waitForFunction(()=>!document.getElementById('companion-send').disabled);
  await page.evaluate(()=>window.nativeListener({data:{type:'host-ready',mode:'panel',front:{title:'Design reference window',process:'Fixture',id:'1001'},hotkeys:{summon:true,quickAsk:true}}}));
  await measure('#companion','panel');
  for(const id of ['screen-lease','computer-lease','settings','send-preview']){await page.evaluate(id=>document.getElementById(id).showModal(),id);await measure('#'+id,`dialog ${id}`);await page.evaluate(id=>document.getElementById(id).close(),id);}
  await page.evaluate(()=>{document.getElementById('companion').classList.add('computer');document.getElementById('computer-mode').hidden=false;document.getElementById('computer-work').hidden=false;document.getElementById('computer-review').hidden=false;document.getElementById('computer-outcome').hidden=false;});
  await measure('#computer-mode','computer');
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>!document.getElementById('recheck').disabled);
  await measure('.app-shell','studio');
  for(const id of ['live-dialog','reset-dialog','install-dialog','source-dialog']){await page.evaluate(id=>document.getElementById(id).showModal(),id);await measure('#'+id,`dialog ${id}`);await page.evaluate(id=>document.getElementById(id).close(),id);}
  await page.goto(`http://127.0.0.1:${site.address().port}/`);await page.waitForSelector('.hero');
  await measure('body','site');
  assert.deepEqual(errors,[]);
  assert.deepEqual(findings,[],`\n${findings.join('\n')}`);
  // The mark's geometry lives in mark.svg, SidelookMark.cs and build-icon.ps1; verify-mark.ps1 compiles the C#, this checks the text agrees on Linux too.
  const hex='32,10 51,21 51,43 32,54 13,43 13,21';
  for(const [file,pattern] of [['public/mark.svg',hex],['public/mark.svg','cx="31" cy="32"'],['public/mark.svg','cx="43" cy="32"'],['scripts/build-icon.ps1',hex],['public/index.html',hex],['desktop/SidelookMark.cs','new PointF(32, 10), new PointF(51, 21), new PointF(51, 43), new PointF(32, 54), new PointF(13, 43), new PointF(13, 21)']]){
    assert.ok((await readFile(file,'utf8')).includes(pattern),`${file} lost the mark geometry: ${pattern}`);
  }
  console.log(`PASS: ${controls} controls at rest and under the mouse, ${texts} text nodes at rest, across the panel, four panel dialogs, Computer mode, the studio, four studio dialogs and the built site; ${used.size} tokens all defined, none self-referential; 0 findings, 0 page errors.; mark geometry agrees in 4 files`);
}finally{await browser.close();site.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
