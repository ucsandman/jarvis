import test from 'node:test';
import assert from 'node:assert/strict';
import {partialHtml,jsonLines} from '../lib/progress.mjs';
import {claudeProgress} from '../lib/claude.mjs';
import {runProcess} from '../lib/subscription.mjs';
import {createApp,DRAFT_CSP} from '../server.mjs';

test('partial HTML decodes split escapes without accepting nested or quoted fake fields',()=>{
  const html='<html><body>Hi "friend"\n世界</body></html>';
  const json=JSON.stringify({title:'A "html": "fake"',observation:{html:'nested'},html});
  assert.equal(partialHtml(json),html);
  assert.equal(partialHtml('{"html":"abc\\u4e'), 'abc');
  assert.equal(partialHtml('{"html":"abc\\u4e16'), 'abc世');
  assert.equal(partialHtml('{"observation":{"html":"no"}}'),'');
  for(let i=0;i<json.length;i++) assert.ok(html.startsWith(partialHtml(json.slice(0,i))));
});
test('CLI progress ignores reasoning and rejects an unexpected model or tool',()=>{
  const events=[],progress=claudeProgress(e=>events.push(e));
  const send=e=>progress(JSON.stringify(e)+'\n');
  send({type:'system',subtype:'init',model:'claude-fable-5-1',tools:['StructuredOutput']});
  send({type:'stream_event',event:{type:'message_start',message:{model:'claude-fable-5-1'}}});
  send({type:'stream_event',event:{type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'DO NOT DISPLAY'}}});
  assert.equal(events.length,0);
  send({type:'stream_event',event:{type:'content_block_delta',index:null,delta:{type:'input_json_delta',partial_json:'{"html":"<html><body>Must not become a draft</body></html>"}'}}});
  assert.equal(events.length,0);
  send({type:'stream_event',event:{type:'content_block_start',index:1,content_block:{type:'tool_use',name:'StructuredOutput'}}});
  send({type:'stream_event',event:{type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:'{"html":"<html><body><h1>Actual growing draft</h1></body></html>"}'}}});
  assert.equal(events.length,1);assert.ok(events[0].html.includes('Actual growing draft'));
  assert.throws(()=>send({type:'stream_event',event:{type:'content_block_start',index:2,content_block:{type:'tool_use',name:'Bash'}}}));
  assert.throws(()=>send({type:'stream_event',event:{type:'message_start',message:{model:'wrong-model'}}}));
});
test('process output is delivered before exit and split JSON lines are reassembled',async()=>{
  let arrived=false,finished=false;const values=[],lines=jsonLines(e=>values.push(e));
  lines('{"a":');lines('1}\n');assert.deepEqual(values,[{a:1}]);
  const pending=runProcess(process.execPath,['-e','process.stdout.write("first");setTimeout(()=>process.stdout.write("last"),150)'],{onStdout:chunk=>{assert.equal(finished,false);if(chunk.includes('first')) arrived=true;}});
  const result=await pending;finished=true;assert.ok(arrived);assert.equal(result.stdout,'firstlast');
});
test('streaming API sends early drafts, sanitizes failure, and serves non-executable previews',async()=>{
  let release;const gate=new Promise(r=>release=r);
  const app=createApp({vision:{validate(){},async build(data,signal,progress){progress({type:'draft',html:'<html><body>Incomplete</body>'});await gate;throw Error('PRIVATE PROVIDER ERROR');}}});
  await new Promise(r=>app.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${app.address().port}`;
  try {
    const {token}=await(await fetch(base+'/api/local-session')).json();const headers={'Content-Type':'application/json','X-Sidelook-Session':token,Origin:base};
    const response=await fetch(base+'/api/build',{method:'POST',headers:{...headers,Accept:'application/x-ndjson'},body:JSON.stringify({instruction:'Build',consent:true})});
    const reader=response.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/Incomplete/);
    const session=first.split('\n').filter(Boolean).map(JSON.parse).find(e=>e.draftSession).draftSession;
    const draft=await(await fetch(base+'/api/preview',{method:'POST',headers,body:JSON.stringify({html:'<html><script>bad()</script></html>',draft:true,draftSession:session})})).json();
    const preview=await fetch(base+draft.url);assert.equal(preview.headers.get('content-security-policy'),DRAFT_CSP);assert.match(DRAFT_CSP,/script-src 'none'/);
    release();let rest='';while(true){const {done,value}=await reader.read();if(done)break;rest+=new TextDecoder().decode(value);}
    assert.match(rest,/"type":"error"/);assert.doesNotMatch(rest,/PRIVATE/);
    assert.equal((await fetch(base+draft.url)).status,404);
    assert.equal((await fetch(base+'/api/preview',{method:'POST',headers,body:JSON.stringify({html:'<html>Ended</html>',draft:true,draftSession:session})})).status,409);
  } finally {release();await new Promise(r=>app.close(r));}
});
