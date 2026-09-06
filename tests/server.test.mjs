import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, PREVIEW_CSP } from '../server.mjs';
import { parseImage, boundedText, Vision } from '../lib/vision.mjs';

async function fixture(t, overrides = {}) {
  let calls = 0;
  const vision = { status:async () => ({ configured:true,model:'gpt-6-astra',provider:'OpenAI subscription' }),observe:async () => { calls++; return { result:{ summary:'A drawing' } }; },build:async () => { calls++; return { result:{ html:'<html>ok</html>' } }; },...overrides };
  const server = createApp({ vision,maxCalls:3 });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { token } = await (await fetch(`${base}/api/session`)).json();
  const post = (path,data,headers = {}) => new Promise((resolve,reject) => {
    const req = http.request(`${base}${path}`,{ method:'POST',headers:{ 'Content-Type':'application/json','X-Sidelook-Session':token,...headers } },response => {
      const chunks=[]; response.on('data',chunk=>chunks.push(chunk));
      response.on('end',()=>resolve({ status:response.statusCode,json:async()=>JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error',reject); req.end(JSON.stringify(data));
  });
  return { base,post,getCalls:() => calls };
}
test('requires local origin, exact host, session header and explicit cloud consent',async t => {
  const f = await fixture(t);
  assert.equal((await f.post('/api/build',{ consent:true },{ Origin:'https://attacker.invalid' })).status,403);
  assert.equal((await f.post('/api/build',{ consent:true },{ Host:'attacker.invalid' })).status,403);
  assert.equal((await f.post('/api/build',{ consent:true },{ 'X-Sidelook-Session':'wrong' })).status,403);
  assert.equal((await f.post('/api/build',{})).status,403);
  assert.equal((await f.post('/api/build',{ consent:true })).status,200);
  assert.equal(f.getCalls(),1);
});
test('secrets and source outside the asset allowlist are never served',async t => {
  const f = await fixture(t);
  for (const path of ['/.env','/.env.example','/server.mjs','/lib/vision.mjs','/../.env','/%2e%2e/.env']) assert.equal((await fetch(f.base+path)).status,404);
  const page = await fetch(f.base+'/');
  assert.equal(page.status,200);
  assert.ok(!(await page.text()).includes('test-key-not-real'));
});
test('isolates executable previews with sandbox, no connections and no camera',async t => {
  const f = await fixture(t);
  const data = await (await f.post('/api/preview',{ html:'<!doctype html><html><script>parent.localStorage.secret</script></html>' })).json();
  const response = await fetch(f.base+data.url);
  assert.equal(response.headers.get('content-security-policy'),PREVIEW_CSP);
  assert.match(response.headers.get('permissions-policy'),/camera=\(\)/);
  assert.match(PREVIEW_CSP,/sandbox allow-scripts/);
  assert.match(PREVIEW_CSP,/connect-src 'none'/);
  assert.doesNotMatch(PREVIEW_CSP,/allow-same-origin/);
});
test('bounded provider budget rejects requests past the limit',async t => {
  const f = await fixture(t);
  for (let i=0;i<3;i++) assert.equal((await f.post('/api/build',{ consent:true })).status,200);
  assert.equal((await f.post('/api/build',{ consent:true })).status,429);
  assert.equal(f.getCalls(),3);
});
test('concurrent provider calls are rejected rather than queued',async t => {
  let release; const pending = new Promise(resolve => { release=resolve; });
  const f = await fixture(t,{ build:async () => { await pending; return { result:{} }; } });
  const first = f.post('/api/build',{ consent:true });
  await new Promise(resolve => setTimeout(resolve,30));
  assert.equal((await f.post('/api/build',{ consent:true })).status,409);
  release(); assert.equal((await first).status,200);
});
test('rejects malformed image formats, mismatched magic bytes, oversized and invalid text',() => {
  for (const image of ['data:image/svg+xml;base64,AAAA','data:image/png;base64,AAAA','https://attacker.invalid','a'.repeat(4_500_001)]) assert.throws(() => parseImage(image));
  assert.throws(() => boundedText([],40,'Direction'));
  assert.throws(() => boundedText('',40,'Direction',true));
  assert.equal(boundedText('  build  ',40,'Direction',true),'build');
  assert.equal(parseImage('data:image/png;base64,iVBORw0KGgo=').extension,'png');
});
test('provider failures never echo credentials, upstream messages, or incomplete source',async () => {
  const vision = new Vision({ inference:async () => { throw new Error('sensitive-upstream-message test-key-not-real'); } });
  await assert.rejects(() => vision.build({ instruction:'Build a button' }),error => error.status === 502 && !/sensitive|test-key/.test(error.message));
});
