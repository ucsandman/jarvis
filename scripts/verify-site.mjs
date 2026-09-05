import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { browserTools } from './browser.mjs';
const config = JSON.parse(await readFile('.artifacts/site/vercel.json','utf8'));
const types = {html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',xml:'application/xml',txt:'text/plain'};
const server = createServer(async(req,res)=>{
  const path = new URL(req.url,'http://localhost').pathname;
  if (path.includes('..')) {res.writeHead(404).end();return;}
  try {
    const file = path === '/' ? '/index.html' : path;
    const data = await readFile(`.artifacts/site${file}`);
    const headers = Object.fromEntries(config.headers.flatMap(rule => rule.source === '/(.*)' || rule.source === path ? rule.headers.map(h=>[h.key,h.value]) : []));
    res.writeHead(200,{'Content-Type':types[file.split('.').at(-1)] || 'application/octet-stream',...headers}).end(data);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base = process.argv[2] || `http://127.0.0.1:${server.address().port}`;
const {chromium} = browserTools();
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
  assert.equal((await page.goto(base)).status(),200);
  await page.getByRole('link',{name:'Walk through an example'}).click();
  assert.equal(await page.getByRole('tab',{name:'Reference'}).getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#journey-reference img').getAttribute('src'),'/reference.svg');
  await page.getByRole('tab',{name:'Prompt'}).click();
  assert.equal(await page.getByRole('tab',{name:'Prompt'}).getAttribute('aria-selected'),'true');
  assert.ok(await page.getByText('Say what the sketch should become.',{exact:true}).isVisible());
  await page.getByRole('tab',{name:'Prepared result'}).press('ArrowRight');
  assert.equal(await page.getByRole('tab',{name:'Revision'}).getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#journey-revision img').count(),2);
  assert.deepEqual(await page.locator('#journey-revision img').evaluateAll(images=>images.map(image=>image.getAttribute('src'))),['/workbench.png','/revision.png']);
  assert.ok(await page.getByText('this page does not perform a live revision.',{exact:false}).isVisible());
  assert.ok(await page.getByText('This site does not generate anything.',{exact:false}).isVisible());
  assert.equal(await page.locator('#demo, .sample, #reset-demo').count(),0);
  const faq = page.locator('summary').filter({hasText:'Can I generate here without installing anything?'});
  await faq.evaluate(element=>element.scrollIntoView({block:'center'}));
  await faq.press('Enter');
  assert.ok(await page.getByText('This website provides a prepared walkthrough.',{exact:false}).isVisible());
  const href=await page.locator('#download-zip').getAttribute('href');
  assert.equal(href,'https://github.com/ucsandman/jarvis/releases/download/v0.4.0/Jarvis-0.4.0-Windows-x64.exe');
  for(const path of ['/robots.txt','/sitemap.xml','/llms.txt','/og.png','/mark.svg','/reference.svg','/workbench.png','/revision.png']) assert.equal((await page.request.get(`${base}${path}`)).status(),200,path);
  for(const path of ['/api/session','/server.mjs','/.env','/demo.html']) assert.equal((await page.request.get(`${base}${path}`)).status(),404,path);
  await page.goto(base);await page.screenshot({path:'.artifacts/site-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'.artifacts/site-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(`PASS: ${base}; 24 checks: walkthrough tabs and keyboard change, actual sketch and captured before/after evidence, explicit no-inference labels, sample section removed, FAQ, pinned download, 8 public assets, 4 removed/private routes absent, mobile layout, zero browser errors.`);
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
