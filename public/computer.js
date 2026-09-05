import {gate,spend,record,ledger,renderGate,renderPreview,MODEL_LABEL,ACCOUNT,CLI} from './harness.js';

// The Computer mode card inside the companion column. Markup lives in index.html; the lease is <dialog id="computer-lease">.
export function initComputer({api,getSelection,onState}) {
  const $=id=>document.getElementById('computer-'+id);
  const lease=document.getElementById('computer-lease'),preview=document.getElementById('send-preview');
  let owner='',busy=false,proposal=null,controller=null,epoch=0,deadline=0,ticker=null,planning=false;
  const status=text=>{$('status').textContent=text;$('status').hidden=!text;};
  const notify=()=>onState?.({on:!!owner,planning});
  const windowTitle=()=>$('window').value?$('window').selectedOptions[0]?.text || '':'';
  const gateView=()=>({surface:'computer',model:getSelection().model,windowTitle:windowTitle()});
  function controls(){
    for(const id of ['refresh','inspect','launch','next','approve','reject','window','task','app','cloud','preview']) $(id).disabled=busy || !owner;
    $('enable').disabled=busy || !!owner;$('open').disabled=busy || !!owner;$('stop').disabled=false;
    $('approve').disabled=busy || !owner || !proposal || Date.now()>proposal.expires;
    renderGate($('gate'),gateView());
  }
  const call=(op,body={},signal)=>api('/api/computer',{op,owner,...body},signal);
  function count(){const n=$('history').children.length;$('count').textContent=`${n} action${n===1?'':'s'}`;}
  function log(text){const li=document.createElement('li');li.textContent=text;$('history').append(li);count();}
  async function work(fn){
    if(busy)return;
    busy=true;const sequence=epoch;controller=new AbortController();controls();
    try {await fn(controller.signal,()=>sequence===epoch);}
    catch(error){if(sequence===epoch){if(lease.open)$('lease-note').textContent=error.message;else status(error.message);}}
    finally {if(sequence===epoch){busy=false;controller=null;controls();}}
  }
  function clearProposal(){proposal=null;$('review').hidden=true;controls();}
  async function windows(signal){
    const result=await call('windows',{},signal);const previous=$('window').value;
    $('window').replaceChildren(new Option('Choose a window',''));
    for(const window of result.windows)$('window').append(new Option(window.title,window.id));
    if(result.windows.some(w=>w.id===previous))$('window').value=previous;
    controls();
  }
  async function stop(){
    const wasOn=!!owner;
    ++epoch;controller?.abort();controller=null;owner='';busy=false;planning=false;clearInterval(ticker);clearProposal();
    $('work').hidden=true;$('permission').checked=false;$('cloud').checked=false;controls();notify();if(wasOn)status('Computer control is stopped. Anything already delivered stays done.');
    try{await call('stop');}catch{status('Connection unavailable. Press Ctrl+Shift+F12 to stop locally. Control also expires automatically.');}
  }
  $('open').onclick=()=>{$('lease-note').textContent='';if(!lease.open)lease.showModal();};
  $('enable').onclick=()=>{
    if(!$('permission').checked){$('lease-note').textContent='Allow local window inspection before enabling Computer mode.';return;}
    $('lease-note').textContent='';
    work(async(signal,current)=>{
      const result=await call('enable',{consent:true},signal);if(!current())return;
      owner=result.owner;deadline=result.expires;lease.close();$('work').hidden=false;$('history').replaceChildren();count();notify();
      await windows(signal);status('Choose a window to read. Ctrl+Shift+F12 stops control from any app.');
      $('mode').scrollIntoView({block:'nearest'});
      ticker=setInterval(async()=>{
        if(!owner)return;
        if(Date.now()>=deadline){await stop();return;}
        if(proposal && Date.now()>proposal.expires){$('expiry').textContent='This action expired. Reject it and plan another action.';controls();}
        if(busy)return;
        try {const s=await call('status');if(!s.armed)await stop();}catch{/* The local expiry and global shortcut remain available. */}
      },2000);
    });
  };
  $('stop').onclick=stop;
  $('permission').onchange=()=>{if(!$('permission').checked && (owner || busy))stop();};
  $('refresh').onclick=()=>work(async signal=>{clearProposal();await windows(signal);status('Window list refreshed. Choose the app you want to control.');});
  $('window').onchange=()=>{clearProposal();$('cloud').checked=false;$('snapshot').textContent='Read this window before sharing it.';controls();};
  $('task').oninput=()=>clearProposal();
  document.getElementById('model-choice').addEventListener('change',()=>{$('cloud').checked=false;controls();});
  $('inspect').onclick=()=>work(async signal=>{
    clearProposal();const result=await call('inspect',{window:$('window').value},signal);
    $('snapshot').textContent=result.elements.map(e=>`${e.type}: ${e.name || '(unnamed)'}${e.value?` = ${e.value}`:''}${e.enabled?'':' [disabled]'}`).join('\n');
    $('snapshot').parentElement.open=true;status(`Read ${result.elements.length} accessible controls locally. Nothing was sent to a model.`);
  });
  $('launch').onclick=()=>work(async signal=>{
    clearProposal();await call('launch',{app:$('app').value},signal);log(`You opened ${$('app').selectedOptions[0].text}.`);await windows(signal);status('App launch requested. Refresh the list if needed, then select the new window.');
  });
  $('preview').onclick=()=>{
    const sel=getSelection();
    renderPreview(preview,{title:'What goes with Plan next action',fields:[
      ['Task',$('task').value.trim() || '(nothing typed yet)'],['Window',windowTitle() || '(none chosen)'],
      ['Fresh reading','the window’s accessible controls and text, read when you press Plan next action'],['Recent actions',`${$('history').children.length} from this session`],
      ['Model',`${MODEL_LABEL[sel.model]} · ${sel.effort}`],['Goes to',`your ${ACCOUNT[sel.model]} subscription through ${CLI[sel.model]}`]],
      body:{op:'propose',task:$('task').value,window:$('window').value,model:sel.model,effort:sel.effort,consent:true}},ledger);
    preview.showModal();
  };
  $('next').onclick=()=>work(async(signal,current)=>{
    const sel=getSelection();
    const refusal=gate({surface:'computer',ticked:$('cloud').checked,configured:sel.configured,token:sel.token,remaining:sel.remaining});
    if(refusal)throw new Error(refusal);
    clearProposal();const start=Date.now();planning=true;notify();status(`${MODEL_LABEL[sel.model]} is planning the next action…`);
    const timer=setInterval(()=>status(`Planning the next action · ${Math.floor((Date.now()-start)/1000)}s elapsed · no desktop action is running`),1000);
    let result;spend($('cloud'));
    try{result=await call('propose',{task:$('task').value,window:$('window').value,model:sel.model,effort:sel.effort,consent:true},signal);record({surface:'computer',ok:true,frame:false,model:sel.model,effort:sel.effort,remaining:result.remaining});}
    catch(error){record({surface:'computer',ok:false,outcome:'refused',frame:false,model:sel.model,effort:sel.effort,remaining:sel.remaining});throw error;}
    finally{clearInterval(timer);planning=false;notify();}
    if(!current())return;
    $('snapshot').textContent='SENT WITH THIS MODEL STEP\n'+result.snapshot.elements.map(e=>`${e.type}: ${e.name || '(unnamed)'}${e.value?` = ${e.value}`:''}`).join('\n');
    const action=result.proposal;proposal=action.kind==='done'?null:action;
    $('review').hidden=false;$('action-title').textContent=action.kind==='done'?'Model report':`${action.kind.toUpperCase()} · ${action.name || action.app || action.title}`;
    $('reason').textContent=action.reason;
    $('action-detail').textContent=action.kind==='done'?'No action will run.':`Window: ${action.title}\nControl: ${action.name || '(window)'}\nType: ${action.type || '(window)'}\nParent: ${action.context || '(none)'}\nAutomation ID: ${action.automationId || '(none)'}\nControl reference: ${action.element || '(window)'}${action.kind==='type'?`\nReplace entire value with:\n${action.text}`:''}${action.key?`\nShortcut/direction: ${action.key}`:''}${action.app?`\nOpen: ${action.app}`:''}`;
    $('expiry').textContent=action.kind==='done'?'Check the application yourself to confirm the outcome.':'This approval expires in one minute. Check the target before you approve.';
    $('approve').hidden=action.kind==='done';status(`Step ${result.steps} of 20. ${action.kind==='done'?'Review the model’s report.':'Waiting for your approval; nothing has executed.'}`);
  });
  $('approve').onclick=()=>work(async(signal,current)=>{
    const action=proposal;if(!action)throw new Error('Request a fresh action.');
    // The proposal stays until Windows accepts it, so a busy broker (a read in flight) leaves it approvable.
    await call('approve',{id:action.id,consent:true},signal);if(!current())return;proposal=null;
    log(`${action.kind} · ${action.name || action.app || action.title}: Windows accepted the action.`);clearProposal();
    status('Delivered. Plan the next action to see what changed.');
  });
  $('reject').onclick=()=>work(async signal=>{await call('reject',{},signal);clearProposal();status('Action rejected. Change the task or plan another action.');});
  window.addEventListener('pagehide',()=>{controller?.abort();if(owner)api('/api/computer',{op:'stop'},undefined,true).catch(()=>{});});
  controls();return {state:()=>({on:!!owner,planning})};
}
