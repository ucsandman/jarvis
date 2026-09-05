import {readFile} from 'node:fs/promises';
import {browserTools} from './browser.mjs';
const {version}=JSON.parse(await readFile('package.json','utf8'));
const image=(await readFile('docs/images/companion.png')).toString('base64');
const {chromium}=browserTools();const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
  await page.setContent(`<html lang="en"><title>Jarvis desktop companion</title><body style="margin:0;background:#20221f;color:#eee5d5"><main style="height:630px;box-sizing:border-box;padding:48px 72px;display:grid;grid-template-columns:1fr 290px;gap:54px;align-items:center"><section><p style="font:15px 'Segoe UI',sans-serif;letter-spacing:4px;color:#e6bb79">JARVIS ${version}</p><h1 style="font:62px/1.07 Georgia,serif;margin:32px 0">Keep Jarvis<br><em style="color:#e6bb79">beside your work.</em></h1><p style="font:22px/1.5 'Segoe UI',sans-serif;color:#c1b6a5">Ask about your screen.<br>Build prototypes. Review each action.</p><p style="font:14px 'Segoe UI',sans-serif;color:#c1b6a5;margin-top:36px">WINDOWS · ASTRA OR FABLE · YOUR SUBSCRIPTION</p></section><figure style="margin:0"><img style="width:290px;display:block;border:1px solid #45443b" src="data:image/png;base64,${image}" alt="Jarvis companion interface"><figcaption style="font:11px 'Segoe UI',sans-serif;color:#c1b6a5;margin-top:10px">THE COMPANION · SCREEN & MICROPHONE OFF</figcaption></figure></main></body></html>`);
  await page.locator('img').evaluate(img=>img.decode());await page.screenshot({path:'docs/images/social.png'});
  console.log('PASS: 1 release image rendered at 1200 x 630.');
}finally{await browser.close();}
