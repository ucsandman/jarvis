import {statusLine,gate,spend,record,ledger,sentCount,renderGate,renderPreview,MODEL_LABEL,ACCOUNT,CLI} from './harness.js';
import {families,chipsFor,captureFor,UNKNOWN_CHIPS,TONES} from './chips.js';

// The column. Its markup lives in index.html; this file only queries and wires it.
export function initCompanion({api,getState,updateControls,openWorkflow,stopWork,importSource}) {
  const native=window.chrome?.webview;
  const host=document.getElementById('companion');
  const $=id=>document.getElementById('companion-'+id);
  const settings=document.getElementById('settings'),preview=document.getElementById('send-preview'),tone=document.getElementById('rewrite-tone');
  let history=[],frame=null,text=null,controller=null,dictation=null,capturing=false,reading=false,captureEpoch=0,captureRequest=null,front=null,chips=[],pendingRoute=null,quickAsk=false,copyButton=null;
  const post=value=>native?.postMessage(value);
  const error=message=>{$('error').textContent=message;$('error').hidden=!message;};
  const clock=value=>new Date(value).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  try {tone.value=localStorage.getItem('jarvisTone') in TONES?localStorage.getItem('jarvisTone'):'plainer';} catch {tone.value='plainer';}
  tone.onchange=()=>{try{localStorage.setItem('jarvisTone',tone.value);}catch{}};
  function showSurface(next,notify=true) {
    document.body.dataset.surface=next==='studio'?'studio':'companion';
    $('expand').hidden=next==='studio';
    if(notify)post({type:'resize',mode:next==='studio'?'workbench':next==='dock'?'dock':'panel'});
    if(next==='companion')setTimeout(()=>$('input').focus(),100);
  }
  const frameOn=()=>!!frame && $('include').checked,textOn=()=>!!text && $('include-text').checked;
  const currentFamilies=()=>front?families(front.process,front.title):['unknown'];
  const view=()=>{const s=getState();return {dictating:!!dictation || !!s.recognition,thinking:!!controller,capturing:capturing || reading,busy:s.busy,elapsed:s.elapsed,planning:s.planning,live:s.live,liveCount:s.liveCount,setupBusy:s.setupBusy,checking:s.checking,token:s.token,configured:s.configured,remaining:s.remaining,computerOn:s.computerOn,frameAttached:frameOn(),textAttached:textOn(),stream:s.stream,captureKind:s.captureKind};};
  const gateView=()=>({surface:'chat',model:getState().model,earlier:history.length,frame:frameOn(),text:textOn()});
  // The strips describe the attachment from state, so a re-ticked box and its caption can never disagree, and the truncation flag never disappears.
  function renderStrips() {
    if(frame){
      const when=new Date(frame.capturedAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});
      $('frame-time').textContent=$('include').checked?`Captured ${when}${frame.sentAt?` · sent ${clock(frame.sentAt)} · attached again`:' · stays here until you send'}`:`Captured ${when}${frame.sentAt?` · sent ${clock(frame.sentAt)}`:''} · not attached`;
    }
    if(text){
      $('text-volume').textContent=`${text.controls} controls · ${text.characters.toLocaleString()} characters · truncated: ${text.truncated?'yes':'no'}${text.sentAt?` · sent ${clock(text.sentAt)}`:''}${$('include-text').checked?'':' · not attached'}`;
    }
  }
  function render() {
    const s=getState(),locked=!!controller || !!dictation || s.busy || s.live || s.setupBusy || s.inputBusy;
    for(const id of ['clear','import','capture','remove','include','include-text','text-remove'])$(id).disabled=locked || capturing || reading;
    $('read').disabled=locked || capturing || reading || !front || !s.token || s.planning;
    host.querySelectorAll('.chip,.companion-followups button').forEach(button=>button.disabled=locked || capturing || reading);
    $('send').disabled=locked || s.checking || !s.configured || !s.token || s.remaining===0;
    $('input').disabled=!!controller;
    $('mic').disabled=!!controller || s.busy || s.setupBusy || s.live || !s.dictation || !s.token;
    $('consent').disabled=!!controller;
    $('status').textContent=statusLine(view());
    renderGate($('gate'),gateView());renderStrips();
    const sent=sentCount();$('ledger').hidden=!ledger.length;$('ledger').textContent=`${sent} sent${ledger.length>sent?` · ${ledger.length-sent} refused`:''}`;
    $('hide').hidden=!native;$('drag').disabled=!native;
  }
  // Numbered or bulleted replies become lists; everything else stays a paragraph. No Markdown parser.
  function renderText(container,body) {
    const lines=body.split('\n');
    const ordered=lines.filter(line=>/^\d+\.\s/.test(line)).length>=2,bullets=lines.filter(line=>/^-\s/.test(line)).length>=2;
    if(!ordered && !bullets){const p=document.createElement('p');p.textContent=body;container.append(p);return;}
    let listEl=null,para=[];
    const flush=()=>{const chunk=para.join('\n').trim();if(chunk){const p=document.createElement('p');p.textContent=chunk;container.append(p);}para=[];};
    for(const line of lines) {
      const item=ordered && /^\d+\.\s/.test(line)?['ol',line.replace(/^\d+\.\s/,'')]:bullets && /^-\s/.test(line)?['ul',line.replace(/^-\s/,'')]:null;
      if(item){flush();if(!listEl || listEl.tagName.toLowerCase()!==item[0]){listEl=document.createElement(item[0]);container.append(listEl);}const li=document.createElement('li');li.textContent=item[1];listEl.append(li);}
      else {listEl=null;para.push(line);}
    }
    flush();
  }
  // Write-only clipboard. "Copied" appears only after the shell or the browser confirms the write; a refusal is said out loud.
  function copied(ok,reason) {
    const button=copyButton;copyButton=null;
    if(ok){if(button){button.textContent='Copied';setTimeout(()=>{button.textContent='Copy';},1500);}return;}
    if(button)button.textContent='Copy';
    error(reason || 'The clipboard refused the text. Select the reply and copy it yourself.');
  }
  function copyText(value,button) {
    const body=String(value).slice(0,8000);copyButton=button;
    if(native){post({type:'copy',text:body});return;}
    if(!navigator.clipboard?.writeText){copied(false,'This browser has no clipboard access. Select the reply and copy it yourself.');return;}
    navigator.clipboard.writeText(body).then(()=>copied(true),()=>copied(false,'The browser refused the clipboard. Select the reply and copy it yourself.'));
  }
  function addMessage(role,body,evidence,sentText) {
    const li=document.createElement('li');li.className='companion-message '+role;
    if(role==='assistant'){const label=document.createElement('span');label.textContent='Jarvis';li.append(label);}
    renderText(li,body);
    if(evidence){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=`Frame sent · ${evidence.label}`;const img=document.createElement('img');img.src=evidence.image;img.alt='Exact frame sent with this message';details.append(summary,img);li.append(details);}
    if(sentText){const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent=`Text sent · ${sentText.title} · ${sentText.controls} controls${sentText.truncated?' · truncated':''}`;const pre=document.createElement('pre');pre.textContent=sentText.text;details.append(summary,pre);li.append(details);}
    if(role==='assistant'){const copy=document.createElement('button');copy.type='button';copy.className='quiet companion-copy';copy.textContent='Copy';copy.onclick=()=>copyText(body,copy);li.append(copy);}
    $('messages').append(li);while($('messages').children.length>24)$('messages').firstElementChild.remove();
    $('welcome').hidden=true;li.scrollIntoView({block:'end',behavior:'smooth'});return li;
  }
  function renderFollowUps(reply,items) {
    const list=(items || []).filter(item=>typeof item==='string' && item.trim()).slice(0,3);
    if(!list.length)return;
    const wrap=document.createElement('div');wrap.className='companion-followups';
    for(const item of list){const button=document.createElement('button');button.type='button';button.className='quiet';button.textContent=item+(frameOn() || textOn()?' · with what is attached':'');button.onclick=()=>{$('input').value=item;$('consent').focus();};wrap.append(button);}
    reply.append(wrap);
  }
  // A tick authorizes exactly what its sentence said. New evidence changes the sentence, so it clears the tick.
  function setFrame(value) {
    frame=value;$('context').hidden=!value;
    if(value){$('frame').src=value.image;$('frame-label').textContent=value.label;$('include').checked=true;$('consent').checked=false;}
    else {$('frame').removeAttribute('src');$('include').checked=false;}
    render();
  }
  // The window's accessible text, every character shown before it can go, with an honest volume line.
  function setText(value) {
    text=value;$('text').hidden=!value;
    if(value){$('text-label').textContent=`Read from ${value.title}`;$('text-body').textContent=value.text || '(no accessible text)';$('include-text').checked=true;$('consent').checked=false;}
    else {$('text-body').textContent='';$('include-text').checked=false;}
    render();
  }
  function markSent(evidence,sentText) {
    if(evidence && frame===evidence){frame.sentAt=Date.now();$('include').checked=false;}
    if(sentText && text===sentText){text.sentAt=Date.now();$('include-text').checked=false;}
  }
  function afterCapture(ok) {
    const route=pendingRoute;pendingRoute=null;
    if(route==='build'){
      if(ok && frame){const direction=$('input').value.trim();$('input').value='';openWorkflow('build',direction,frame);showSurface('studio');}
      else error('No frame was captured, so nothing was sent to the studio. Try the chip again.');
      quickAsk=false;return;
    }
    if(quickAsk){quickAsk=false;if(ok)setTimeout(()=>$('consent').focus(),300);}
  }
  async function capture(keepError=false) {
    if(capturing || reading || controller)return;
    if(!keepError)error('');capturing=true;const epoch=++captureEpoch;render();
    if(native){captureRequest=crypto.randomUUID();post({type:'capture',requestId:captureRequest});return;}
    let stream,ok=false;
    try {
      stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
      const video=document.createElement('video');video.muted=true;video.srcObject=stream;await video.play();
      const canvas=document.createElement('canvas'),scale=Math.min(1,1440/video.videoWidth);canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
      if(epoch===captureEpoch){setFrame({image:canvas.toDataURL('image/jpeg',.8),label:(stream.getVideoTracks()[0].label || 'Selected screen').slice(0,200),capturedAt:new Date().toISOString()});ok=true;}
    }catch(e){if(e.name!=='NotAllowedError')error('Screen capture is unavailable. Open the studio to upload an image or use a camera.');}
    finally{stream?.getTracks().forEach(track=>track.stop());if(epoch===captureEpoch){capturing=false;render();afterCapture(ok);}}
  }
  // Read the accessible text of the window that was in front. Read-only on the server: it never arms Computer mode. Returns false when nothing could be read.
  async function readText() {
    if(capturing || reading || controller)return false;
    if(!front){error('Summon Jarvis from the window you want read, then press Read text.');return false;}
    error('');reading=true;render();
    try {
      const result=await api('/api/computer',{op:'read',title:front.title,consent:true});
      setText({title:result.title,controls:result.controls,characters:result.characters,truncated:result.truncated===true,text:String(result.text || '')});
      return true;
    }catch(e){error(e.message);return false;}
    finally{reading=false;render();}
  }
  function speak(body) {
    if(!$('spoken').checked)return;
    if(native){post({type:'speak',text:body});return;}
    const voice=window.speechSynthesis?.getVoices().find(v=>v.localService && /^en/i.test(v.lang));
    if(!voice){error('No local English voice is available. The reply is shown above.');return;}
    speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(body);utterance.voice=voice;speechSynthesis.speak(utterance);
  }
  function stop() {
    controller?.abort();dictation?.abort();post({type:'cancel-capture',requestId:captureRequest});captureEpoch++;capturing=false;captureRequest=null;pendingRoute=null;quickAsk=false;
    post({type:'stop-speaking'});window.speechSynthesis?.cancel();stopWork();render();
  }
  // The exact body submit() posts, and a description of it for the preview. Only the frame's bytes are elided from the preview.
  function requestBody() {
    const evidence=frameOn()?frame:null,read=textOn()?text:null;
    const body={instruction:$('input').value.trim(),history:history.slice(-12),...(evidence?{image:evidence.image}:{}),...(read?{windowText:read.text,windowTextTruncated:read.truncated===true}:{}),...(evidence || read?{contextLabel:(evidence?evidence.label:read.title)}:{}),consent:true};
    return {body,evidence,read};
  }
  function manifest() {
    const s=getState();const {body,evidence,read}=requestBody();
    return {title:'What goes with the next send',fields:[
      ['Message',body.instruction || '(nothing typed yet)'],['Earlier messages',String(body.history.length)],
      ['Frame',evidence?`${evidence.label} · ${Math.round(evidence.image.length*3/4/1024)} KB JPEG`:'none'],
      ['Window text',read?`${read.title} · ${read.controls} controls · ${read.characters.toLocaleString()} characters${read.truncated?' · truncated':''}`:'none'],
      ['Model',`${MODEL_LABEL[s.model]} · ${s.effort}`],['Goes to',`your ${ACCOUNT[s.model]} subscription through ${CLI[s.model]}`]],
      body:{...body,model:s.model,effort:s.effort,...(evidence?{image:`<frame: ${evidence.label}>`}:{})}};
  }
  function showPreview() {renderPreview(preview,manifest(),ledger);preview.showModal();}
  async function submit() {
    const s=getState();if(controller || dictation || capturing || reading || s.busy || s.live || s.setupBusy || s.inputBusy)return;
    const instruction=$('input').value.trim();if(!instruction)return;
    const refusal=gate({surface:'chat',ticked:$('consent').checked,configured:s.configured,token:s.token,remaining:s.remaining});
    if(refusal){error(refusal);$('consent').focus();return;}
    error('');const request=new AbortController();controller=request;s.inputBusy=true;updateControls();render();
    const {body,evidence,read}=requestBody();
    const user=addMessage('user',instruction,evidence,read);
    // The tick is one press: it clears whether the model answered, refused or was stopped. The attachments and the ledger follow what actually happened.
    spend($('consent'));
    let outcome='refused';
    try {
      const result=await api('/api/chat',body,request.signal);
      if(request.signal.aborted){outcome='stopped';return;}
      outcome='sent';record({surface:'chat',ok:true,frame:!!evidence,text:!!read,model:s.model,effort:s.effort,remaining:result.remaining});
      markSent(evidence,read);
      history.push({role:'user',text:instruction.slice(0,2000)},{role:'assistant',text:result.result.reply.slice(0,2000)});history=history.slice(-12);
      const reply=addMessage('assistant',result.result.reply);$('input').value='';
      if(read){const provenance=document.createElement('p');provenance.className='companion-provenance';provenance.textContent=`Read from: ${read.title} · ${read.controls} controls${read.truncated?' · truncated':''}`;reply.append(provenance);}
      if(['build','computer'].includes(result.result.suggestion)){
        const button=document.createElement('button');button.className='companion-workflow';button.textContent=result.result.suggestion==='build'?'Build this in the studio':'Let Jarvis do this';
        // Hand over the frame only while it is still here; a removed frame does not come back through an old reply.
        button.onclick=()=>{if(result.result.suggestion==='build')showSurface('studio');openWorkflow(result.result.suggestion,instruction,evidence && frame===evidence?frame:null);};reply.append(button);
      }
      renderFollowUps(reply,result.result.followUps);
      speak(result.result.reply);
    }catch(e){
      user.classList.add('interrupted');
      if(e.name==='AbortError'){outcome='stopped';error('Stopped. Your message is still here to edit or retry.');}
      else error(e.message);
    }
    finally{
      if(outcome!=='sent')record({surface:'chat',ok:false,outcome,frame:!!evidence,text:!!read,model:s.model,effort:s.effort,remaining:s.remaining});
      if(controller===request){controller=null;s.inputBusy=false;updateControls();render();}
    }
  }
  async function dictate() {
    if(dictation){dictation.abort();return;}
    if(!$('voice').checked){if(!settings.open)settings.showModal();document.getElementById('advanced').open=true;$('voice').focus();error('Allow local Windows dictation in Settings, then click Mic. Audio is not sent to the model.');return;}
    error('');post({type:'stop-speaking'});window.speechSynthesis?.cancel();
    const request=new AbortController();dictation=request;const s=getState();s.inputBusy=true;updateControls();$('mic').setAttribute('aria-pressed','true');render();
    try{const result=await api('/api/dictate',{consent:true},request.signal);if(!request.signal.aborted){if(result.text)$('input').value=($('input').value+' '+result.text).trim().slice(0,4000);else error('No speech recognized. Try again or type your message.');}}
    catch(e){if(e.name!=='AbortError')error(e.message);}
    finally{if(dictation===request){dictation=null;s.inputBusy=false;updateControls();$('mic').setAttribute('aria-pressed','false');render();$('input').focus();}}
  }
  // The deck: chips chosen locally from the window that was in front at summon. Nothing is captured or read until a chip, ＋ Window or Read text is pressed.
  const chipPrompt=chip=>chip.prompt.replace('{tone}',TONES[tone.value] || TONES.plainer);
  async function useChip(chip) {
    if(controller || capturing || reading)return;
    error('');$('input').value=chipPrompt(chip);
    if(chip.route==='build'){pendingRoute='build';capture();return;}
    const take=captureFor(chip,currentFamilies());
    if(take==='text'){
      if(await readText()){$('consent').focus();return;}
      // The read failed for a reason worth reading; keep it on screen and fall back to a frame.
      error(`${$('error').textContent} Capturing a frame instead.`);capture(true);return;
    }
    if(take==='frame')capture();
    $('input').focus();
  }
  function renderDeck() {
    const fams=currentFamilies();
    chips=front?chipsFor(fams,front.title):UNKNOWN_CHIPS;
    $('front').hidden=!front;$('front-title').textContent=front?`In front: ${front.title}`:'';
    $('chips').replaceChildren(...chips.map(chip=>{
      const take=captureFor(chip,fams);
      const button=document.createElement('button');button.type='button';button.className='chip';button.dataset.chip=chip.id;button.append(chip.label);
      if(take==='frame' || take==='text'){const badge=document.createElement('small');badge.textContent=take;button.append(badge);}
      button.onclick=()=>useChip(chip);
      button.onfocus=button.onmouseenter=()=>{$('hint').textContent=chipPrompt(chip).split(/(?<=\.)\s/)[0];};
      button.onblur=button.onmouseleave=()=>{$('hint').textContent='';};
      return button;
    }));
    render();
  }
  $('form').onsubmit=e=>{e.preventDefault();submit();};
  $('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();submit();}};
  $('consent').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit();}};
  $('capture').onclick=()=>capture();$('remove').onclick=()=>setFrame(null);$('mic').onclick=dictate;$('stop').onclick=stop;
  $('read').onclick=()=>readText();$('text-remove').onclick=()=>setText(null);
  // Changing what is attached changes the sentence, so the tick clears with it.
  $('include-text').onchange=()=>{$('consent').checked=false;render();};$('include').onchange=()=>{$('consent').checked=false;render();};
  $('settings').onclick=()=>{if(!settings.open)settings.showModal();};
  $('preview').onclick=showPreview;$('ledger').onclick=showPreview;
  document.getElementById('settings-preview').onclick=showPreview;
  $('expand').onclick=()=>showSurface('studio');$('back').onclick=()=>showSurface('companion');
  $('hide').onclick=()=>{stop();showSurface('dock');};$('drag').onpointerdown=()=>post({type:'drag'});
  $('front-clear').onclick=()=>{front=null;renderDeck();};
  document.getElementById('model-choice').addEventListener('change',()=>{$('consent').checked=false;render();});
  $('clear').onclick=()=>{history=[];$('messages').replaceChildren();$('welcome').hidden=false;setFrame(null);setText(null);error('');};
  $('spoken').onchange=()=>{if(!$('spoken').checked){post({type:'stop-speaking'});window.speechSynthesis?.cancel();}};
  $('voice').onchange=()=>{if(!$('voice').checked)dictation?.abort();};
  $('import').onclick=()=>$('import-file').click();
  $('import-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>120000)throw Error('Choose an HTML prototype under 120 KB.');await importSource(await file.text(),file.name);if(settings.open)settings.close();showSurface('studio');}catch(e){error(e.message);}finally{$('import-file').value='';}};
  native?.addEventListener('message',event=>{
    const data=event.data;if(!data || typeof data!=='object')return;
    if(data.type==='stop')stop();
    if(data.type==='host-ready'){
      showSurface(data.mode==='workbench'?'studio':'companion',false);
      front=data.front && typeof data.front==='object' && typeof data.front.title==='string' && data.front.title.trim()?{title:data.front.title.trim().slice(0,200),process:String(data.front.process || '').slice(0,100)}:null;
      document.getElementById('hotkey-note').hidden=!(data.hotkeys && data.hotkeys.quickAsk===false);
      renderDeck();render();
    }
    // Ctrl+Shift+E: never while something is in flight, and never over a message the user is still writing.
    if(data.type==='quick-ask'){
      if(controller || capturing || reading || dictation)return;
      if(!$('input').value.trim())$('input').value=chipPrompt(chips[0] || UNKNOWN_CHIPS[0]);
      quickAsk=true;capture();
    }
    if(data.type==='copied')copied(data.ok===true,data.error);
    if(data.type==='capture'&&capturing&&data.requestId===captureRequest){captureRequest=null;let ok=false;if(typeof data.image==='string'&&data.image.length<=4500000&&/^data:image\/jpeg;base64,/.test(data.image)){setFrame({image:data.image,label:String(data.label||'Selected window').slice(0,200),capturedAt:data.capturedAt});ok=true;}else error('The captured image could not be used.');capturing=false;render();afterCapture(ok);}
    if(data.type==='capture-error'&&capturing&&data.requestId===captureRequest){capturing=false;captureRequest=null;error(data.error || 'Choose a window, then summon Jarvis again.');render();afterCapture(false);}
    if(data.type==='speech-error')error(data.error || 'Local speech is unavailable.');
  });
  document.addEventListener('jarvis-state',render);
  window.addEventListener('pagehide',()=>{controller?.abort();dictation?.abort();post({type:'cancel-capture',requestId:captureRequest});post({type:'stop-speaking'});});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)dictation?.abort();});
  showSurface(native || new URLSearchParams(location.search).has('companion')?'companion':'studio',false);renderDeck();render();
  return {showPreview};
}
