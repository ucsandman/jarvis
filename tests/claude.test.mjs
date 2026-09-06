import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasClaudeSubscription,claudeInferenceArgs,claudeInput,parseClaudeResult,CLAUDE_SETTINGS,claudeEnv} from '../lib/claude.mjs';
import {FABLE_MODEL} from '../lib/models.mjs';

test('Claude auth requires paid first-party subscription, never Console or API credentials',()=>{
  const status={loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty',subscriptionType:'max'};
  const reply=data=>({code:0,stdout:JSON.stringify(data)});
  assert.equal(hasClaudeSubscription(reply(status)),true);
  for(const change of [{loggedIn:false},{authMethod:'api_key'},{authMethod:'console'},{apiProvider:'bedrock'},{subscriptionType:null},{subscriptionType:'free'}]) assert.equal(hasClaudeSubscription(reply({...status,...change})),false);
  assert.equal(hasClaudeSubscription({...reply(status),code:1}),false);
  assert.equal(hasClaudeSubscription({code:0,stdout:'not json'}),false);
});

test('Fable flags keep OAuth, exact model and effort while excluding other models and executable tools',()=>{
  const args=claudeInferenceArgs({system:'Bounded generation',schema:{type:'object'},effort:'xhigh'});
  assert.equal(args[args.indexOf('--model')+1],FABLE_MODEL);
  assert.equal(args[args.indexOf('--effort')+1],'xhigh');
  assert.equal(args[args.indexOf('--tools')+1],'');
  for(const flag of ['--safe-mode','--strict-mcp-config','--disable-slash-commands','--no-session-persistence']) assert.ok(args.includes(flag));
  assert.ok(!args.includes('--bare'));assert.ok(!args.includes('--dangerously-skip-permissions'));
  assert.deepEqual(CLAUDE_SETTINGS.availableModels,[FABLE_MODEL]);assert.deepEqual(CLAUDE_SETTINGS.fallbackModel,[]);
  assert.equal(CLAUDE_SETTINGS.switchModelsOnFlag,false);assert.equal(CLAUDE_SETTINGS.forceLoginMethod,'claudeai');
  assert.ok(!Object.keys(claudeEnv()).some(key=>/API_KEY|AUTH_TOKEN|BASE_URL|PROXY|CONFIG_DIR/.test(key)));
});

test('Fable input preserves selected image bytes and puts user data only in stdin',()=>{
  const image={extension:'png',bytes:Buffer.from([1,2,3])};
  const message=JSON.parse(claudeInput('Untrusted prior source and direction',image));
  assert.deepEqual(message.message.content[0],{type:'image',source:{type:'base64',media_type:'image/png',data:'AQID'}});
  assert.equal(message.message.content[1].text,'Untrusted prior source and direction');
  assert.equal(JSON.parse(claudeInput('Text only')).message.content.length,1);
});

test('Fable parser rejects model switches, external tools, partial output, limits and upstream errors',()=>{
  const init={type:'system',subtype:'init',model:FABLE_MODEL,tools:['StructuredOutput']};
  const completed={type:'result',subtype:'success',is_error:false,structured_output:{ok:true}};
  const result=(events,code=0)=>({code,stdout:events.map(e=>JSON.stringify(e)).join('\n'),stderr:''});
  assert.deepEqual(parseClaudeResult(result([init,completed]),'low').result,{ok:true});
  assert.throws(()=>parseClaudeResult(result([{...init,model:'claude-opus-5'},completed]),'low'));
  assert.throws(()=>parseClaudeResult(result([{...init,tools:['Bash']},completed]),'low'));
  assert.throws(()=>parseClaudeResult(result([init,{type:'assistant',message:{model:FABLE_MODEL,content:[{type:'tool_use',name:'Read'}]}},completed]),'low'));
  assert.throws(()=>parseClaudeResult(result([init,{...completed,structured_output:null}]),'low'),{code:'INCOMPLETE_OUTPUT'});
  assert.throws(()=>parseClaudeResult(result([init,{type:'result',subtype:'error',is_error:true,result:'Usage limit reached'}],1),'low'),{code:'SUBSCRIPTION_LIMIT'});
  assert.throws(()=>parseClaudeResult(result([init,{type:'result',subtype:'error',is_error:true,result:'PRIVATE UPSTREAM ERROR'}],1),'low'),error=>!error.message.includes('PRIVATE'));
});

test('another Anthropic choice pins its own model ID in the flags, the settings and the parser',()=>{
  const args=claudeInferenceArgs({system:'Bounded generation',schema:{type:'object'},effort:'low',model:'opus'});
  assert.equal(args[args.indexOf('--model')+1],'claude-opus-5');
  assert.deepEqual(JSON.parse(args[args.indexOf('--settings')+1]).availableModels,['claude-opus-5']);
  const completed={type:'result',subtype:'success',is_error:false,structured_output:{ok:true}};
  const result=events=>({code:0,stdout:events.map(e=>JSON.stringify(e)).join('\n'),stderr:''});
  assert.equal(parseClaudeResult(result([{type:'system',subtype:'init',model:'claude-opus-5',tools:['StructuredOutput']},completed]),'low','opus').model,'claude-opus-5');
  assert.throws(()=>parseClaudeResult(result([{type:'system',subtype:'init',model:FABLE_MODEL,tools:['StructuredOutput']},completed]),'low','opus'),error=>error.message.startsWith('Opus 5'));
  assert.throws(()=>claudeInferenceArgs({system:'x',schema:{},effort:'low',model:'astra'}));
});
