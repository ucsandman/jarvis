import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { subscriptionEnv,inferenceArgs,MODEL,runProcess,hasSubscriptionLogin,usageTokens } from '../lib/subscription.mjs';
import { Vision } from '../lib/vision.mjs';

test('subscription child inherits no API keys, alternate credentials or endpoint overrides',() => {
  const env=subscriptionEnv({ PATH:'safe-path',USERPROFILE:'safe-home',OPENAI_API_KEY:'fake',ANTHROPIC_API_KEY:'fake',GEMINI_API_KEY:'fake',ANTHROPIC_AUTH_TOKEN:'fake',CODEX_API_KEY:'fake',OPENAI_BASE_URL:'https://bad.invalid',CODEX_HOME:'override',HTTP_PROXY:'https://bad.invalid',AWS_ACCESS_KEY_ID:'fake' });
  assert.deepEqual(env,{ PATH:'safe-path',USERPROFILE:'safe-home' });
});
test('inference pins Astra and ChatGPT login with no provider or configuration fallback',() => {
  const args=inferenceArgs('schema.json','result.json','reference.png');
  assert.equal(MODEL,'gpt-6-astra');
  assert.ok(args.includes('forced_login_method="chatgpt"'));
  assert.ok(args.includes('model_provider="openai"'));
  assert.ok(args.includes('--ignore-user-config'));
  assert.ok(args.includes('--ephemeral'));
  assert.ok(args.includes('read-only'));
  assert.ok(args.includes('approval_policy="never"'));
  assert.ok(!args.includes('--dangerously-bypass-approvals-and-sandbox'));
  assert.ok(!args.includes('--fallback-model'));
});
test('Codex usage reports the turn total with its cached input beside it, and zero when the CLI reports none',()=> {
  assert.deepEqual(usageTokens({input_tokens:1200,cached_input_tokens:310,output_tokens:40}),{tokens:1240,cachedTokens:310});
  assert.deepEqual(usageTokens({input_tokens:1200,output_tokens:40}),{tokens:1240,cachedTokens:0});
  assert.deepEqual(usageTokens(),{tokens:0,cachedTokens:0});
});
test('API-key login and failed status checks are rejected; only ChatGPT login passes',()=> {
  assert.equal(hasSubscriptionLogin({code:0,stdout:'Logged in using an API key',stderr:''}),false);
  assert.equal(hasSubscriptionLogin({code:1,stdout:'Logged in using ChatGPT',stderr:''}),false);
  assert.equal(hasSubscriptionLogin({code:0,stdout:'Not logged in',stderr:''}),false);
  assert.equal(hasSubscriptionLogin({code:0,stdout:'',stderr:'Logged in using ChatGPT\n'}),true);
});
test('model transport contains no HTTP inference or environment-file loading',async()=> {
  const files=['lib/vision.mjs','lib/subscription.mjs','package.json','scripts/start.ps1'];
  for(const file of files) {
    const source=await readFile(file,'utf8');
    assert.doesNotMatch(source,/generativelanguage|api\.openai\.com|api\.anthropic\.com|x-goog-api-key|--env-file|process\.env\.[A-Z_]*API_KEY/);
  }
});
test('subscription failure never invokes a second transport',async()=> {
  let calls=0;
  const vision=new Vision({ inference:async()=>{calls++;throw Error('usage limit');} });
  await assert.rejects(()=>vision.build({instruction:'Build a board'}),/never falls back to an API/);
  assert.equal(calls,1);
});
test('process exit status and cancellation are observable',async()=> {
  const result=await runProcess(process.execPath,['-e','process.stdout.write("not success");process.exit(7)']);
  assert.equal(result.code,7);
  const controller=new AbortController();
  const pending=runProcess(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:controller.signal});
  setTimeout(()=>controller.abort(),100);
  await assert.rejects(pending,error=>error.name==='AbortError');
});
