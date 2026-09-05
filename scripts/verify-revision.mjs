import { readFile,writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { browserTools } from './browser.mjs';
const { chromium } = browserTools();
const browser = await chromium.launch({ channel:'chrome',headless:true });
const page = await browser.newPage({ viewport:{ width:1440,height:1100 } });
try {
  const generated = JSON.parse(await readFile('.artifacts/generated.json','utf8'));
  const image = `data:image/png;base64,${(await readFile('.artifacts/reference.png')).toString('base64')}`;
  const observed = JSON.parse(await readFile('.artifacts/observation.json','utf8'));
  await page.goto('http://127.0.0.1:4317');
  await page.evaluate(async ({ generated,image,observed }) => {
    const { saveProject } = await import('/storage.js');
    await saveProject({ selected:'fixture-live-test',revisions:[{ ...generated.result,id:'fixture-live-test',created:new Date().toISOString(),image,observation:observed.result,instruction:'The synthetic Daylight sketch',model:generated.model }] });
  },{ generated,image,observed });
  await page.reload();
  await page.locator('#version-label').filter({ hasText:'VERSION 01' }).waitFor();
  const app = page.frameLocator('#preview');
  await app.locator('#openModalBtn').click();
  await app.locator('#taskTitleInput').fill('Jarvis integration verification');
  const submit = app.locator('#taskForm button[type="submit"]');
  await submit.click();
  await app.getByText('Jarvis integration verification',{ exact:true }).filter({ visible:true }).waitFor();
  await app.locator('#searchInput').fill('Jarvis integration verification');
  assert.equal(await app.locator('.task-card:visible').count(),1);
  console.log('PASS: generated app adds and filters real tasks in the restricted preview.');
  await page.getByRole('button',{ name:'Clear image',exact:true }).click();
  await page.locator('#direction').fill('Preserve the entire Daylight task board and all existing functionality. Add a clearly visible compact 25-minute focus timer above the board with Start, Pause, and Reset buttons and a mm:ss countdown. Call it Focus timer. Do not remove search, adding tasks, or the three columns.');
  await page.locator('#build-consent').check();
  await page.getByRole('button',{ name:'Make it real' }).click();
  await page.locator('#version-label').filter({ hasText:'VERSION 02' }).waitFor({ timeout:315000 });
  assert.match(await app.locator('body').innerText(),/focus timer/i);
  assert.match(await app.locator('body').innerText(),/DAYLIGHT/i);
  const project = await page.evaluate(async () => (await import('/storage.js')).loadProject());
  await writeFile('.artifacts/revised.json',JSON.stringify(project.revisions.at(-1),null,2));
  await writeFile('.artifacts/revised.html',project.revisions.at(-1).html);
  await page.screenshot({ path:'.artifacts/workbench-revised.png',fullPage:true });
  console.log(JSON.stringify({ phase:'live revision through UI',versions:project.revisions.length,characters:project.revisions.at(-1).html.length,reply:project.revisions.at(-1).reply }));
} finally { await browser.close(); }
