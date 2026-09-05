export function initCompanion({api,getState,updateControls,openWorkflow,stopWork,importSource}) {
  const native=window.chrome?.webview;
  const host=document.createElement('section');host.id='companion';host.setAttribute('aria-label','Jarvis companion');
  host.innerHTML=`
    <header class="companion-header"><button id="companion-drag" class="companion-brand" aria-label="Drag Jarvis window"><img src="/mark.svg" alt="">JARVIS</button><div><button id="companion-settings" aria-label="Settings" title="Settings">⚙</button><button id="companion-expand" aria-label="Open workbench" title="Open workbench">↗</button><button id="companion-hide" aria-label="Return to dock" title="Return to dock">−</button></div></header>
    <div class="companion-scroll">
      <div id="companion-welcome"><h1>What are you working on?</h1><p>Ask about the window you're in, or show me a frame when it helps. I'll say what I see and what I'd do next.</p><div class="companion-starters"><button data-start="What do you think about this?">Ask about my screen <span>›</span></button><button data-start="Help me finish setting this up.">Help me with a task <span>›</span></button><button data-start="Help me build a prototype.">Make something together <span>›</span></button></div></div>
      <ol id="companion-messages" aria-label="Conversation" aria-live="polite" aria-relevant="additions"></ol>
      <div id="companion-options" hidden><h2>Settings</h2><label>Model<select id="companion-model"><option value="astra">Astra · ChatGPT</option><option value="fable">Fable 5.1 · Claude</option></select></label><label>Effort<select id="companion-effort"><option value="low">Low · faster</option><option value="medium">Medium</option><option value="high">High</option><option value="xhigh">Extra high</option><option value="max">Maximum</option></select></label><p id="companion-account"></p><button id="companion-setup">Connection & sign-in</button><label class="companion-check"><input id="companion-voice" type="checkbox">Allow local Windows dictation when I click the microphone.</label><label class="companion-check"><input id="companion-spoken" type="checkbox">Read replies aloud using a local voice.</label><p>Conversation stays in this session. Each question sends up to 12 recent text messages and only the frame you choose. Model access and subscription limits apply.</p><button id="companion-clear">Clear conversation</button><button id="companion-import">Import a saved HTML prototype</button><input id="companion-import-file" type="file" accept=".html,.htm,text/html" hidden><p>Moving from the browser? Download your prototype there, then import its HTML here. Existing desktop versions stay intact.</p><button id="companion-options-done">Back to conversation</button></div>
    </div>
    <div class="companion-compose"><div id="companion-context" hidden><img id="companion-frame" alt="Exact frame selected for the next message"><div><strong id="companion-frame-label"></strong><small id="companion-frame-time"></small><label class="companion-check"><input id="companion-include" type="checkbox">Include this frame</label></div><button id="companion-remove" aria-label="Remove frame">×</button></div>
      <p id="companion-error" role="alert" hidden></p>
      <form id="companion-form"><label class="sr-only" for="companion-input">Message Jarvis</label><textarea id="companion-input" rows="2" maxlength="4000" placeholder="What are we working on?"></textarea><div class="companion-tools"><div><button type="button" id="companion-capture">＋ Window</button><button type="button" id="companion-mic" aria-label="Dictate locally" aria-pressed="false">Mic</button></div><button type="submit" id="companion-send">Send ↑</button></div></form>
      <label class="companion-check companion-sharing"><input id="companion-consent" type="checkbox">Send my message, recent conversation and included frame to my selected subscription.</label>
      <footer><span id="companion-status" role="status">Connecting</span><button id="companion-stop">Stop</button></footer>
    </div>`;
  document.body.prepend(host);
  const $=id=>document.getElementById('companion-'+id);
  const back=document.createElement('button');back.id='companion-back';back.className='quiet';back.textContent='← Companion';
  document.querySelector('.header-actions').prepend(back);
  let history=[],frame=null,controller=null,dictation=null,capturing=false,captureEpoch=0,captureRequest=null;
  const post=value=>native?.postMessage(value);
  const error=text=>{$('error').textContent=text;$('error').hidden=!text;};
  function showMode(next,notify=true) {
    document.body.classList.toggle('companion-mode',next!=='workbench');
    if(notify)post({type:'resize',mode:next});
    if(next==='panel')setTimeout(()=>$('input').focus(),100);
  }
  function render() {
    const s=getState(),locked=!!controller || !!dictation || s.busy || s.live || s.setupBusy || s.inputBusy;
    $('model').value=s.model;$('effort').value=s.effort;
    $('account').textContent=s.model==='fable'?'Uses Claude Code with your Claude subscription. Paid usage credits may be consumed under your account settings.':'Uses Codex with your ChatGPT subscription. No API key.';
    for(const id of ['model','effort','clear','import','capture','remove','include'])$(id).disabled=locked || capturing;
    $('send').disabled=locked || s.checking || !s.configured || !s.token || s.remaining===0;
    $('input').disabled=!!controller;
    $('mic').disabled=!!controller || s.busy || s.setupBusy || s.live || !s.dictation || !s.token;
    $('consent').disabled=!!controller;
    $('status').textContent=dictation?'Listening locally':controller?'Thinking':capturing?'Choosing a frame':s.live?'Live build is on':s.busy?'Building':s.setupBusy?'Setting up':s.checking?'Checking connection':!s.token?'Reconnect in Settings':!s.configured?'Sign in through Settings':s.remaining===0?'Allowance used · open Settings':'Ready · screen & mic off';
    if(s.configured && !locked && !capturing && frame)$('status').textContent='Ready · selected snapshot only';
    $('hide').hidden=!native;$('drag').disabled=!native;
  }
  function addMessage(role,text,evidence) {
    const li=document.createElement('li');li.className='companion-message '+role;
    const label=document.createElement('span');label.textContent=role==='user'?'YOU':'JARVIS';
    const p=document.createElement('p');p.textContent=text;li.append(label,p);
    if(evidence){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=`Frame sent · ${evidence.label}`;const img=document.createElement('img');img.src=evidence.image;img.alt='Exact frame sent with this message';details.append(summary,img);li.append(details);}
    $('messages').append(li);while($('messages').children.length>24)$('messages').firstElementChild.remove();
    $('welcome').hidden=true;li.scrollIntoView({block:'end',behavior:'smooth'});return li;
  }
  function setFrame(value) {
    frame=value;$('context').hidden=!value;
    if(value){$('frame').src=value.image;$('frame-label').textContent=value.label;$('frame-time').textContent=`Captured ${new Date(value.capturedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})} · kept local until Send`;$('include').checked=true;}
    else {$('frame').removeAttribute('src');$('include').checked=false;}
    render();
  }
  async function capture() {
    if(capturing || controller)return;
    error('');capturing=true;const epoch=++captureEpoch;render();
    if(native){captureRequest=crypto.randomUUID();post({type:'capture',requestId:captureRequest});return;}
    let stream;
    try {
      stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      const video=document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();
      const canvas=document.createElement('canvas'),scale=Math.min(1,1440/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      if(epoch===captureEpoch)setFrame({image:canvas.toDataURL('image/jpeg',.8),label:(stream.getVideoTracks()[0].label || 'Selected screen').slice(0,200),capturedAt:new Date().toISOString()});
    }catch(e){if(e.name!=='NotAllowedError')error('Screen capture is unavailable. Open the workbench to upload an image or use a camera.');}
    finally{stream?.getTracks().forEach(track=>track.stop());if(epoch===captureEpoch){capturing=false;render();}}
  }
  function speak(text) {
    if(!$('spoken').checked)return;
    if(native){post({type:'speak',text});return;}
    const voice=window.speechSynthesis?.getVoices().find(v=>v.localService && /^en/i.test(v.lang));
    if(!voice){error('No local English voice is available. The reply is shown above.');return;}
    speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.voice=voice;speechSynthesis.speak(utterance);
  }
  function stop() {
    controller?.abort();dictation?.abort();post({type:'cancel-capture',requestId:captureRequest});captureEpoch++;capturing=false;captureRequest=null;
    post({type:'stop-speaking'});window.speechSynthesis?.cancel();stopWork();render();
  }
  async function submit() {
    const s=getState();if(controller || dictation || capturing || s.busy || s.live || s.setupBusy || s.inputBusy)return;
    const instruction=$('input').value.trim();if(!instruction)return;
    if(!$('consent').checked){error('Check the sharing permission below your message before sending.');$('consent').focus();return;}
    if(!s.configured || !s.token){error('Open Settings, then Connection & sign-in to connect your selected subscription.');return;}
    error('');const request=new AbortController();controller=request;s.inputBusy=true;updateControls();render();
    const evidence=$('include').checked?frame:null;
    const user=addMessage('user',instruction,evidence);
    try {
      const result=await api('/api/chat',{instruction,history:history.slice(-12),...(evidence?{image:evidence.image,contextLabel:evidence.label}:{}),consent:true},request.signal);
      if(request.signal.aborted)return;
      history.push({role:'user',text:instruction.slice(0,2000)},{role:'assistant',text:result.result.reply.slice(0,2000)});history=history.slice(-12);
      const reply=addMessage('assistant',result.result.reply);$('input').value='';
      if(['build','computer'].includes(result.result.suggestion)){
        const button=document.createElement('button');button.textContent=result.result.suggestion==='build'?'Continue in workbench':'Review computer task';
        button.onclick=()=>{showMode('workbench');openWorkflow(result.result.suggestion,instruction,evidence);};reply.append(button);
      }
      speak(result.result.reply);
    }catch(e){user.classList.add('interrupted');error(e.name==='AbortError'?'Stopped. Your message is still here to edit or retry.':e.message);}
    finally{if(controller===request){controller=null;s.inputBusy=false;updateControls();render();}}
  }
  async function dictate() {
    if(dictation){dictation.abort();return;}
    if(!$('voice').checked){$('options').hidden=false;$('voice').focus();error('Allow local Windows dictation in Settings, then click Mic. Audio is not sent to the model.');return;}
    error('');post({type:'stop-speaking'});window.speechSynthesis?.cancel();
    const request=new AbortController();dictation=request;const s=getState();s.inputBusy=true;updateControls();$('mic').setAttribute('aria-pressed','true');render();
    try{const result=await api('/api/dictate',{consent:true},request.signal);if(!request.signal.aborted){if(result.text)$('input').value=($('input').value+' '+result.text).trim().slice(0,4000);else error('No speech recognized. Try again or type your message.');}}
    catch(e){if(e.name!=='AbortError')error(e.message);}
    finally{if(dictation===request){dictation=null;s.inputBusy=false;updateControls();$('mic').setAttribute('aria-pressed','false');render();$('input').focus();}}
  }
  $('form').onsubmit=e=>{e.preventDefault();submit();};
  $('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}};
  $('capture').onclick=capture;$('remove').onclick=()=>setFrame(null);$('mic').onclick=dictate;$('stop').onclick=stop;
  $('settings').onclick=()=>{$('options').hidden=!$('options').hidden;if(!$('options').hidden)$('options').scrollIntoView({block:'start'});};
  $('options-done').onclick=()=>{$('options').hidden=true;$('input').focus();};
  $('setup').onclick=()=>{showMode('workbench');openWorkflow('setup');};
  $('expand').onclick=()=>showMode('workbench');back.onclick=()=>showMode('panel');
  $('hide').onclick=()=>{stop();showMode('dock');};$('drag').onpointerdown=()=>post({type:'drag'});
  for(const [id,target] of [['model','model-choice'],['effort','effort-choice']])$(id).onchange=()=>{const control=document.getElementById(target);control.value=$(id).value;control.dispatchEvent(new Event('change'));$('consent').checked=false;render();};
  $('clear').onclick=()=>{history=[];$('messages').replaceChildren();$('welcome').hidden=false;setFrame(null);error('');};
  $('spoken').onchange=()=>{if(!$('spoken').checked){post({type:'stop-speaking'});window.speechSynthesis?.cancel();}};
  $('voice').onchange=()=>{if(!$('voice').checked)dictation?.abort();};
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>120000)throw Error('Choose an HTML prototype under 120 KB.');await importSource(await file.text(),file.name);showMode('workbench');}catch(e){error(e.message);}finally{$('import-file').value='';}};
  host.querySelectorAll('[data-start]').forEach(button=>button.onclick=()=>{$('input').value=button.dataset.start;$('input').focus();if(button.dataset.start.includes('think'))capture();});
  native?.addEventListener('message',event=>{
    const data=event.data;if(!data || typeof data!=='object')return;
    if(data.type==='stop')stop();
    if(data.type==='host-ready'){showMode(data.mode==='workbench'?'workbench':'panel',false);render();}
    if(data.type==='capture'&&capturing&&data.requestId===captureRequest){capturing=false;captureRequest=null;if(typeof data.image==='string'&&data.image.length<=4500000&&/^data:image\/jpeg;base64,/.test(data.image))setFrame({image:data.image,label:String(data.label||'Selected window').slice(0,200),capturedAt:data.capturedAt});else error('The captured image could not be used.');render();}
    if(data.type==='capture-error'&&capturing&&data.requestId===captureRequest){capturing=false;captureRequest=null;error(data.error || 'Choose a window, then summon Jarvis again.');render();}
    if(data.type==='speech-error')error(data.error || 'Local speech is unavailable.');
  });
  document.addEventListener('jarvis-state',render);
  window.addEventListener('pagehide',()=>{controller?.abort();dictation?.abort();post({type:'cancel-capture',requestId:captureRequest});post({type:'stop-speaking'});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)dictation?.abort();});
  showMode(native || new URLSearchParams(location.search).has('companion')?'panel':'workbench',false);render();
}
