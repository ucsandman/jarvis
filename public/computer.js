export function initComputer({api,getSelection,openSetup}) {
  const host=document.createElement('details');host.id='computer-mode';host.className='computer-mode';
  host.innerHTML=`<summary>Computer mode <span>Work in your Windows apps, one reviewed action at a time</span></summary>
    <div class="computer-content">
      <div class="computer-heading"><div><p class="eyebrow">YOUR DESKTOP / YOUR DECISION</p><h2>A second pair of hands.</h2></div><button class="button secondary" id="computer-stop" disabled>Stop computer control</button></div>
      <p>Open an app, choose its window, and describe the task. Jarvis reads accessible controls and proposes one action. You review every click, text replacement, and shortcut before Windows executes it.</p>
      <p class="computer-boundary">Windows only. Accessible controls only; no canvas drawing, coordinate clicking, shell execution tool, or administrator prompts. Use <strong>Ctrl+Shift+F12</strong> to stop from any app. Stop prevents further actions; it cannot undo an action already delivered.</p>
      <div class="computer-actions"><label><input type="checkbox" id="computer-permission"> Allow local window inspection and reviewed control for 10 minutes.</label><button class="button amber" id="computer-enable">Enable computer mode</button></div>
      <p id="computer-status" role="status" aria-live="polite">Computer control is off.</p>
      <div id="computer-work" hidden>
        <div class="computer-grid"><section aria-label="Choose an application"><h3>01 / Choose the window</h3>
          <div class="computer-actions"><label>Open an app<select id="computer-app"><option value="notepad">Notepad</option><option value="calculator">Calculator</option><option value="paint">Paint</option></select></label><button class="button secondary" id="computer-launch">Open selected app</button></div>
          <p>For other apps, open them yourself, then refresh this list. Explorer, terminals, sign-in windows and address bars are excluded.</p>
          <label>Window<select id="computer-window"><option value="">Choose a window</option></select></label>
          <div class="computer-actions"><button class="button secondary" id="computer-refresh">Refresh windows</button><button class="button secondary" id="computer-inspect">Inspect selected window</button></div>
          <details><summary>Last inspected or sent text</summary><pre id="computer-snapshot">Inspect a window to see its controls. Password controls and protected windows are excluded. Other visible text may contain private information.</pre></details>
        </section><section aria-label="Direct the task"><h3>02 / Describe the task</h3>
          <div class="computer-actions"><label>Model<select id="computer-model"><option value="astra">Astra · ChatGPT</option><option value="fable">Fable 5.1 · Claude</option></select></label><label>Effort<select id="computer-effort"><option value="low">Low · faster</option><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra high</option><option value="max">Maximum</option></select></label></div>
          <label>What should Jarvis do?<textarea id="computer-task" maxlength="2000" rows="3" placeholder="Example: enter 24 × 7 in Calculator and show the result."></textarea></label>
          <label class="computer-consent"><input type="checkbox" id="computer-cloud"> Capture and send this task, the selected window’s current accessible text, and recent action descriptions to the selected model through my subscription. Planning takes a fresh reading, which may differ from the last inspection. Fable can consume paid usage credits under my Claude settings.</label>
          <button class="button amber" id="computer-next">Plan next action</button>
          <p>Each step uses a model request. Up to 20 steps per session.</p><button class="button secondary" id="computer-setup">Set up selected model</button>
        </section></div>
        <section id="computer-review" class="computer-review" hidden aria-label="Review the next action"><p class="eyebrow">03 / REVIEW BEFORE EXECUTION</p><h3 id="computer-action-title"></h3><p id="computer-reason"></p><pre id="computer-action-detail"></pre><p id="computer-expiry">This approval expires after one minute. Check the target and any side effects before approving.</p><div class="computer-actions"><button class="button amber" id="computer-approve">Approve this action</button><button class="button secondary" id="computer-reject">Reject</button></div></section>
        <details open><summary>Action history <span id="computer-count">0 actions</span></summary><ol id="computer-history"></ol></details>
      </div>
    </div>`;
  document.querySelector('.intro').after(host);
  const $=id=>document.getElementById('computer-'+id);
  const selection=getSelection();$('model').value=selection.model;$('effort').value=selection.effort;
  let owner='',busy=false,proposal=null,controller=null,epoch=0,deadline=0,ticker=null;
  const status=text=>$('status').textContent=text;
  function controls(){
    for(const id of ['refresh','inspect','launch','next','approve','reject','window','model','effort','task','app']) $(id).disabled=busy || !owner;
    $('enable').disabled=busy || !!owner;$('stop').disabled=false;
    $('approve').disabled=busy || !owner || !proposal || Date.now()>proposal.expires;
  }
  const call=(op,body={},signal)=>api('/api/computer',{op,owner,...body},signal);
  function log(text){const li=document.createElement('li');li.textContent=text;$('history').append(li);$('count').textContent=`${$('history').children.length} entries`;}
  async function work(fn){
    if(busy)return;
    busy=true;const sequence=epoch;controller=new AbortController();controls();
    try {await fn(controller.signal,()=>sequence===epoch);}
    catch(error){if(sequence===epoch)status(error.message);}
    finally {if(sequence===epoch){busy=false;controller=null;controls();}}
  }
  function clearProposal(){proposal=null;$('review').hidden=true;controls();}
  async function windows(signal){
    const result=await call('windows',{},signal);const previous=$('window').value;
    $('window').replaceChildren(new Option('Choose a window',''));
    for(const window of result.windows)$('window').append(new Option(window.title,window.id));
    if(result.windows.some(w=>w.id===previous))$('window').value=previous;
  }
  async function stop(){
    ++epoch;controller?.abort();controller=null;owner='';busy=false;clearInterval(ticker);clearProposal();
    $('work').hidden=true;$('permission').checked=false;$('cloud').checked=false;controls();status('Computer control is stopped. Previously delivered actions are not undone.');
    try{await call('stop');}catch{status('Connection unavailable. Press Ctrl+Shift+F12 to stop locally. Control also expires automatically.');}
  }
  $('enable').onclick=()=>work(async(signal,current)=>{
    if(!$('permission').checked)throw new Error('Allow local window inspection before enabling Computer mode.');
    const result=await call('enable',{consent:true},signal);if(!current())return;
    owner=result.owner;deadline=result.expires;$('work').hidden=false;$('history').replaceChildren();$('count').textContent='0 actions';
    await windows(signal);status('Choose a window to inspect. Ctrl+Shift+F12 stops control from any app.');
    ticker=setInterval(async()=>{
      if(!owner)return;
      if(Date.now()>=deadline){await stop();return;}
      if(proposal && Date.now()>proposal.expires){$('expiry').textContent='This action expired. Reject it and plan another action.';controls();}
      if(busy)return;
      try {const s=await call('status');if(!s.armed)await stop();}catch{/* The local expiry and global shortcut remain available. */}
    },2000);
  });
  $('stop').onclick=stop;
  $('permission').onchange=()=>{if(!$('permission').checked && (owner || busy))stop();};
  $('refresh').onclick=()=>work(async signal=>{clearProposal();await windows(signal);status('Window list refreshed. Choose the app you want to control.');});
  $('window').onchange=()=>{clearProposal();$('cloud').checked=false;$('snapshot').textContent='Inspect this window before sharing it.';};
  for(const id of ['task','model','effort'])$(id).oninput=()=>{clearProposal();if(id==='model')$('cloud').checked=false;};
  $('setup').onclick=()=>{try{openSetup({model:$('model').value,effort:$('effort').value});}catch(error){status(error.message);}};
  $('inspect').onclick=()=>work(async signal=>{
    clearProposal();const result=await call('inspect',{window:$('window').value},signal);
    $('snapshot').textContent=result.elements.map(e=>`${e.type}: ${e.name || '(unnamed)'}${e.value?` = ${e.value}`:''}${e.enabled?'':' [disabled]'}`).join('\n');
    $('snapshot').parentElement.open=true;status(`Inspected ${result.elements.length} accessible controls locally. Nothing was sent to a model.`);
  });
  $('launch').onclick=()=>work(async signal=>{
    clearProposal();await call('launch',{app:$('app').value},signal);log(`You opened ${$('app').selectedOptions[0].text}.`);await windows(signal);status('App launch requested. Refresh the list if needed, then select the new window.');
  });
  $('next').onclick=()=>work(async(signal,current)=>{
    if(!$('cloud').checked)throw new Error('Review the sharing notice and allow this model request first.');
    clearProposal();const start=Date.now();status(`${$('model').selectedOptions[0].text} is planning the next action…`);
    const timer=setInterval(()=>status(`Planning the next action · ${Math.floor((Date.now()-start)/1000)}s elapsed · no desktop action is running`),1000);
    try{
      const result=await call('propose',{task:$('task').value,window:$('window').value,model:$('model').value,effort:$('effort').value,consent:true},signal);if(!current())return;
      $('snapshot').textContent='SENT WITH THIS MODEL STEP\n'+result.snapshot.elements.map(e=>`${e.type}: ${e.name || '(unnamed)'}${e.value?` = ${e.value}`:''}`).join('\n');
      const action=result.proposal;proposal=action.kind==='done'?null:action;
      $('review').hidden=false;$('action-title').textContent=action.kind==='done'?'Model report':`${action.kind.toUpperCase()} · ${action.name || action.app || action.title}`;
      $('reason').textContent=action.reason;
      $('action-detail').textContent=action.kind==='done'?'No action will run.':`Window: ${action.title}\nControl: ${action.name || '(window)'}\nType: ${action.type || '(window)'}\nParent: ${action.context || '(none)'}\nAutomation ID: ${action.automationId || '(none)'}\nControl reference: ${action.element || '(window)'}${action.kind==='type'?`\nReplace entire value with:\n${action.text}`:''}${action.key?`\nShortcut/direction: ${action.key}`:''}${action.app?`\nOpen: ${action.app}`:''}`;
      $('expiry').textContent=action.kind==='done'?'Check the application yourself to confirm the outcome.':'This approval expires after one minute. Check the target and side effects before approving.';
      $('approve').hidden=action.kind==='done';status(`Step ${result.steps} of 20. ${action.kind==='done'?'Review the model’s report.':'Waiting for your approval; nothing has executed.'}`);
    }finally{clearInterval(timer);}
  });
  $('approve').onclick=()=>work(async(signal,current)=>{
    const action=proposal;if(!action)throw new Error('Request a fresh action.');
    proposal=null;await call('approve',{id:action.id,consent:true},signal);if(!current())return;
    log(`${action.kind} · ${action.name || action.app || action.title}: Windows accepted the action.`);clearProposal();
    status('Action delivered. Check the application, then choose Plan next action to verify and continue.');
  });
  $('reject').onclick=()=>work(async signal=>{await call('reject',{},signal);clearProposal();status('Action rejected. Change the task or plan another action.');});
  window.addEventListener('pagehide',()=>{controller?.abort();if(owner)api('/api/computer',{op:'stop'},undefined,true).catch(()=>{});});
  controls();return host;
}
