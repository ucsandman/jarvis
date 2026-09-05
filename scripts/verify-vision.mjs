import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { Vision } from '../lib/vision.mjs';
import { browserTools } from './browser.mjs';

await mkdir('.artifacts', { recursive: true });
const { chromium } = browserTools();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 750 } });
  await page.setContent(await readFile('public/reference.svg', 'utf8'));
  const image = `data:image/png;base64,${(await page.screenshot({ path: '.artifacts/reference.png' })).toString('base64')}`;
  const vision = new Vision();
  const observed = await vision.observe({ image }, AbortSignal.timeout(120000));
  assert.ok(observed.result.readable);
  assert.match(JSON.stringify(observed.result), /task|board|daylight/i);
  await writeFile('.artifacts/observation.json', JSON.stringify(observed, null, 2));
  console.log(JSON.stringify({ phase: 'observe', model: observed.model, observations: observed.result.observations.length, summary: observed.result.summary }));
  const built = await vision.build({ image, instruction: 'Build the application in this sketch. Make the task board genuinely work, including adding, moving, completing and filtering tasks. Use warm ivory, ink, and terracotta. It must say DAYLIGHT. Give the Add task button id openModalBtn, its form id taskForm, its title input id taskTitleInput and the search field id searchInput. Use the class task-card on each task card.' }, AbortSignal.timeout(300000));
  assert.match(built.result.html, /DAYLIGHT/i);
  assert.match(built.result.html, /<script[\s>]/i);
  await writeFile('.artifacts/generated.json', JSON.stringify(built, null, 2));
  await writeFile('.artifacts/generated.html', built.result.html);
  console.log(JSON.stringify({ phase: 'build', model: built.model, characters: built.result.html.length, changes: built.result.changes }));
} finally { await browser.close(); }
