import {readFile} from 'node:fs/promises';
import {browserTools} from './browser.mjs';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const image=(await readFile('docs/images/companion.png')).toString('base64');
const mark=(await readFile('public/mark.svg')).toString('base64');
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.setContent(`<html lang="en"><title>Jarvis desktop companion</title><body style="margin:0;background:#171D2D;color:#F8FAFC"><main style="height:630px;box-sizing:border-box;padding:56px 72px;display:grid;grid-template-columns:1fr 290px;gap:54px;align-items:center"><section><p style="display:flex;align-items:center;gap:14px;margin:0;font:500 22px 'Segoe UI',sans-serif"><img src="data:image/svg+xml;base64,${mark}" width="44" height="44" alt="" style="border-radius:10px">Jarvis ${version}</p><h1 style="font:58px/1.08 Georgia,serif;font-weight:400;letter-spacing:-.02em;margin:34px 0 26px">A second pair of eyes,<br><em style="color:#2DD4A8">on the subscription you already pay for.</em></h1><p style="font:21px/1.5 'Segoe UI',sans-serif;color:#B3BCCA;margin:0;max-width:640px">A Windows companion. Ask about your screen, build a prototype from a sketch, or approve one desktop action at a time. Any OpenAI or Anthropic model, no API key.</p></section><figure style="margin:0"><img style="width:290px;display:block;border:1px solid #303A50" src="data:image/png;base64,${image}" alt="Jarvis companion interface"><figcaption style="font:13px 'Segoe UI',sans-serif;color:#B3BCCA;margin-top:10px">The companion. Screen and microphone off.</figcaption></figure></main></body></html>`);
  await page.locator('img').last().evaluate(img=>img.decode());await page.screenshot({path:'docs/images/social.png'});
  console.log('PASS: 1 release image rendered at 1200 x 630.');
}finally{await browser.close();}
