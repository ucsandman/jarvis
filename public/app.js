import { loadProject, saveProject } from './storage.js';
import { LiveFrames } from './live.js';

let launchKey = new URLSearchParams(location.hash.slice(1)).get('launch');
if (launchKey) history.replaceState(null,'',location.pathname+location.search);
try {
  if (launchKey && /^[a-f0-9]{64}$/.test(launchKey)) sessionStorage.setItem('jarvisLaunch',launchKey);
  else launchKey = sessionStorage.getItem('jarvisLaunch');
} catch { /* This tab can still work when browser storage is unavailable. */ }
const launchHeaders = () => launchKey ? {'X-Jarvis-Launch':launchKey} : {};

const $ = id => document.getElementById(id);
const state = { token:'', configured:false, stream:null, image:null, imageLabel:'', observation:null,
  revisions:[], selected:null, busy:false, consent:false, voiceConsent:false, speaking:false, recognition:null, controller:null, previewSequence:0, remaining:null, setupBusy:false, setupController:null, dictation:false, inputBusy:false };
state.live=false; state.liveCount=0; state.captureKind=null; state.liveFrames=new LiveFrames(); state.liveTimer=null;
state.model='astra'; state.effort='medium'; state.checking=false;
try {
  const saved=JSON.parse(localStorage.getItem('jarvisModelPreferences') || '{}');
  if (['astra','fable'].includes(saved.model)) state.model=saved.model;
  if (['low','medium','high','xhigh','max'].includes(saved.effort)) state.effort=saved.effort;
} catch { /* Preferences are optional when browser storage is unavailable. */ }
const selectedLabel = () => state.model==='fable' ? 'Fable 5.1' : 'Astra';
const selectedAccount = () => state.model==='fable' ? 'Claude' : 'ChatGPT';
const effortNotes = {low:'Faster, with lighter reasoning.',medium:'Balances speed and depth.',high:'More reasoning for complex changes.',xhigh:'Extra reasoning; expect a longer wait.',max:'Deepest reasoning; may take much longer and use more allowance.'};
function renderSelection() {
  $('model-choice').value=state.model; $('effort-choice').value=state.effort;
  $('effort-note').textContent=`${effortNotes[state.effort]} Applies to your next build.`;
  $('billing-note').textContent=state.model==='fable' ? 'Fable uses your Claude subscription. Usage credits may be charged automatically under your account settings.' : 'Astra uses your ChatGPT subscription. Model access and usage limits apply.';
  $('consent-detail').textContent=state.model==='fable' ? 'Your direction, selected prototype source, and included reference frame will be sent to Anthropic through Claude Code. Fable can automatically consume paid usage credits under your Claude account settings. Camera preview stays local until you choose a frame and build.' : 'Your direction, selected prototype source, and included reference frame will be sent to OpenAI through Codex using your ChatGPT subscription. Camera preview stays local until you choose a frame and build.';
  const claude=state.model==='fable';
  $('install-title').textContent=claude?'Install official Claude Code?':'Install the official Codex CLI?';
  $('install-detail').textContent=claude?'Downloads the verified Claude Code runtime directly from Anthropic’s official npm package into Jarvis’s per-user tools folder. No terminal or administrator access is needed. Claude Code is subject to Anthropic’s terms. No model request is made during installation.':'Downloads the official @openai/codex package through npm and installs it globally on this device. No account or model request is made during installation.';
  $('confirm-install').textContent=claude?'Install Claude Code':'Install Codex';
  $('install-terms').hidden=!claude;
  $('setup-help').href=claude?'https://code.claude.com/docs/en/authentication':'https://developers.openai.com/codex/auth';
  $('setup-detail').textContent=claude?'Sign-in opens Anthropic’s official browser flow and updates Claude Code login on this device. Installation downloads Claude Code into Jarvis’s own tools folder. Each action starts only when you choose it.':'Sign-in opens the official browser flow and updates Codex login on this device. Installing Codex adds its official npm package globally. Each action starts only when you choose it.';
}
const current = () => state.revisions.find(r => r.id === state.selected);
const showError = message => { $('error-text').textContent = message; $('error').hidden = false; };
const hideError = () => { $('error').hidden = true; };
const time = value => new Date(value).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });

async function api(path, body, signal) {
  if (['/api/build','/api/observe','/api/login','/api/install-codex'].includes(path)) body={...body,model:state.model,effort:state.effort};
  const response = await fetch(path,{ method:'POST',signal,headers:{ ...launchHeaders(),'Content-Type':'application/json','X-Jarvis-Session':state.token },body:JSON.stringify(body) });
  const data = await response.json();
  if (Number.isFinite(data.remaining)) { state.remaining = data.remaining; renderBudget(); }
  if (!response.ok) { const error = new Error(data.error || 'The request could not be completed.'); error.code = data.code; throw error; }
  return data;
}
function textElement(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function updateControls() {
  const controls = ['share-screen-top','share-screen','build','connect','upload','example','file','new-session','camera-select','clear-reference','resume','mic','try-demo','include-frame'];
  controls.forEach(id => { $(id).disabled = state.busy || state.setupBusy || state.inputBusy || (!state.token && id === 'build'); });
  $('build').disabled = state.live || state.busy || state.setupBusy || state.inputBusy || state.checking || !state.configured || !state.token || state.remaining === 0;
  for (const id of ['model-choice','effort-choice']) $(id).disabled=state.live || state.busy || state.setupBusy || state.inputBusy;
  $('mic').disabled = state.busy || state.setupBusy || !state.token || !state.dictation;
  $('mic').title = state.dictation ? 'Dictate direction locally' : 'Local dictation is available on Windows after connection';
  for (const id of ['login','install-codex','recheck','reset-budget']) $(id).disabled = state.busy || state.setupBusy || state.checking;
  $('direction').disabled = state.busy || state.setupBusy;
  for (const id of ['connect','share-screen-top','share-screen','upload','example','file','try-demo','new-session','resume','clear-reference']) $(id).disabled ||= state.live;
  $('live-start').disabled=state.busy || state.setupBusy || state.inputBusy || state.checking || !state.configured || !state.token || state.remaining===0;
  $('live-start').hidden=state.live; $('live-pause').hidden=!state.live;
  $('live-interval').disabled=state.live || state.busy;
  $('live-controls').dataset.active=String(state.live);
  $('live-count').textContent=`${state.liveCount} / 10 builds`;
  document.querySelectorAll('.revision').forEach(b => { b.disabled = state.busy || state.inputBusy; });
  $('build-overlay').hidden = !state.busy;
  $('source').disabled = !current(); $('download').disabled = !current();
  $('activity').textContent = state.busy ? 'WORKING ON YOUR IDEA' : current() ? 'READY FOR THE NEXT CHANGE' : 'IDEAS WELCOME';
  $('reply-status').textContent = state.busy ? 'Working' : current() ? 'Version ready' : 'Standing by';
  updateFrameChoice();
}
function clearObservations() {
  state.observation = null; $('annotations').replaceChildren(); $('observations').replaceChildren();
  $('observation-time').textContent = 'NO FRAME SENT';
  $('observation-summary').textContent = 'I’ll read the details, connect them to your direction, and build from there.';
}
function setImage(image,label) {
  clearObservations(); state.image = image; state.imageLabel = label;
  $('reference').src = image; $('reference').hidden = false; $('camera').hidden = true;
  $('camera-empty').hidden = true; $('frame-label').hidden = false; $('frame-label').textContent = label;
  $('frame-tools').hidden = false; $('resume').hidden = !state.stream;
  $('source-status').textContent = 'SELECTED FRAME';
  $('include-frame').checked = true; updateFrameChoice();
}
function liveView() {
  state.image = null; state.imageLabel = ''; clearObservations();
  $('reference').hidden = true; $('reference').removeAttribute('src'); $('frame-label').hidden = true; $('frame-tools').hidden = true;
  $('camera').hidden = !state.stream; $('camera-empty').hidden = !!state.stream;
  $('source-status').textContent = state.stream ? state.captureKind==='screen' ? 'SCREEN SHARED · LOCAL PREVIEW' : 'LIVE · LOCAL ONLY' : 'CAMERA OFF';
  $('include-frame').checked = !!state.stream; updateFrameChoice();
}
function stopCamera() {
  pauseLive('Sharing stopped. No new snapshots will be sent.');
  state.captureKind=null; $('live-controls').hidden=true;
  state.stream?.getTracks().forEach(track => track.stop()); state.stream = null;
  $('camera').srcObject = null; $('camera-controls').hidden = true; $('resume').hidden = true;
  if (!state.image) liveView();
  else $('source-status').textContent='SAVED FRAME · NOT SHARING';
}
async function startCamera(deviceId) {
  if (state.inputBusy) return;
  hideError(); state.inputBusy = true; updateControls();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost and a supported browser. You can upload a reference instead.');
    stopCamera();
    state.stream = await navigator.mediaDevices.getUserMedia({ video:deviceId ? { deviceId:{ exact:deviceId },width:{ ideal:1920 },height:{ ideal:1080 } } : { width:{ ideal:1920 },height:{ ideal:1080 },facingMode:'environment' }, audio:false });
    state.captureKind='camera';
    $('camera').srcObject = state.stream; await $('camera').play();
    state.stream.getVideoTracks()[0].addEventListener('ended',() => { stopCamera(); showError('The camera disconnected. Reconnect it or upload a reference.'); });
    liveView(); $('camera-controls').hidden = false;
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    $('camera-select').replaceChildren(...devices.map((d,i) => { const option = textElement('option',d.label || `Camera ${i+1}`); option.value = d.deviceId; return option; }));
    $('camera-select').value = state.stream.getVideoTracks()[0].getSettings().deviceId;
  } catch (error) {
    stopCamera();
    showError(error.name === 'NotAllowedError' ? 'Camera access was declined. Allow it in your browser or upload a reference.'
      : error.name === 'NotReadableError' ? 'The camera is busy. Close the other app using it or upload a reference.' : error.message);
  } finally { state.inputBusy = false; updateControls(); }
}
function showSharedScreen() {
  if(state.captureKind!=='screen' || !state.stream) return;
  state.image=null;state.imageLabel='';
  $('camera').hidden=false; $('reference').hidden=true; $('annotations').replaceChildren();
  $('frame-tools').hidden=true; $('frame-label').hidden=true; $('camera-empty').hidden=true;
  $('source-status').textContent=state.live?'LIVE BUILD ON · SCREEN SHARED':'SCREEN SHARED · LOCAL PREVIEW';
}
function pauseLive(message='Paused. No new snapshots will be sent.') {
  const wasLive=state.live;
  state.live=false; clearInterval(state.liveTimer); state.liveTimer=null;
  if(wasLive) state.controller?.abort();
  $('live-status').textContent=message; updateControls();
  if(state.captureKind==='screen') $('source-status').textContent='SCREEN SHARED · LOCAL PREVIEW';
}
async function startScreen() {
  let adopted=false;
  if(state.inputBusy || state.busy || state.live) return;
  hideError(); state.inputBusy=true; updateControls();
  try {
    if(!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing is unavailable in this browser. Use desktop Chrome or Edge, or upload an image.');
    // Must remain directly within the user's click activation, before any await.
    const pending=navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:5,max:10}},audio:false,selfBrowserSurface:'exclude',surfaceSwitching:'exclude',systemAudio:'exclude'});
    const stream=await pending;
    stopCamera(); state.stream=stream; state.captureKind='screen';adopted=true;
    state.stream.getAudioTracks().forEach(track=>track.stop());
    const track=stream.getVideoTracks()[0];
    track.addEventListener('ended',()=>{if(state.stream===stream) stopCamera();});
    track.addEventListener('mute',()=>pauseLive('Screen capture is unavailable. Resume only when the shared window is visible again.'));
    $('camera').srcObject=stream; await $('camera').play();
    state.consent=false; state.liveCount=0; liveView(); $('live-controls').hidden=false;
    $('live-status').textContent='Sharing locally. No automatic frames sent.';
    if(!$('direction').value.trim()) $('direction').value='Build a working web prototype from my shared design. Apply visible changes while preserving existing functionality.';
  } catch(error) {
    if(adopted) stopCamera();
    showError(error.name==='NotAllowedError'?'Screen sharing was canceled or declined. Nothing new is shared.':error.message);
  } finally {state.inputBusy=false;updateControls();}
}
const liveCanvas=document.createElement('canvas');liveCanvas.width=160;liveCanvas.height=90;
const liveContext=liveCanvas.getContext('2d',{willReadFrequently:true});
async function inspectScreen() {
  if(!state.live || state.captureKind!=='screen' || !state.stream) return;
  const track=state.stream.getVideoTracks()[0];
  if(track.readyState!=='live' || track.muted) {pauseLive('Screen capture stopped. Share your window again to continue.');return;}
  if(!$('camera').videoWidth || !$('camera').videoHeight) return;
  liveContext.drawImage($('camera'),0,0,160,90);
  const pixels=liveContext.getImageData(0,0,160,90).data;
  const now=Date.now(),interval=Number($('live-interval').value);
  const verdict=state.liveFrames.inspect(pixels,now,interval);
  if(state.busy) { $('live-status').textContent='Build in progress. Watching locally; only the newest settled frame can go next.';return; }
  if(state.liveCount>=10 || !state.configured || state.remaining===0) {pauseLive('Live build paused. Check your allowance and Setup before starting again.');return;}
  if(!$('direction').value.trim()) {pauseLive('Add a direction before starting Live build again.');return;}
  $('live-status').textContent={unchanged:'Watching locally. No meaningful change to send.',drawing:'Changes detected. Waiting for you to pause drawing…',cooldown:`Waiting between builds. Next eligible in ${Math.ceil((interval-(now-state.liveFrames.lastSent))/1000)}s.`,ready:'Sending one changed screen snapshot.'}[verdict];
  if(verdict!=='ready' || state.inputBusy || state.setupBusy || state.checking || state.recognition) return;
  state.liveFrames.accept(pixels,now);state.liveCount++;
  await beginBuild(true);
}
$('share-screen').addEventListener('click',startScreen);
$('share-screen-top').addEventListener('click',startScreen);
$('screen-stop').addEventListener('click',stopCamera);
$('live-pause').addEventListener('click',()=>pauseLive());
$('live-start').addEventListener('click',()=>{
  if(state.captureKind!=='screen' || !state.stream || state.busy || !state.configured) return;
  $('live-consent-detail').textContent=`Automatic snapshots go to ${selectedLabel()} through your ${selectedAccount()} subscription, at least ${Number($('live-interval').value)/1000} seconds apart. ${state.model==='fable'?'Fable can automatically consume paid Claude usage credits.':'Each build uses your subscription allowance.'}`;
  $('live-dialog').showModal();
});
$('live-confirm').addEventListener('click',()=>{
  $('live-dialog').close();
  if(state.captureKind!=='screen' || !state.stream || state.busy || !state.configured || state.setupBusy || state.checking) return;
  state.consent=true;state.live=true;state.liveCount=0;state.liveFrames=new LiveFrames();
  showSharedScreen();updateControls();
  $('live-status').textContent='Live build on. Waiting for a settled frame.';
  state.liveTimer=setInterval(()=>inspectScreen().catch(()=>pauseLive('Live build paused. The screen frame could not be read.')) ,1000);
});
function imageFromElement(element) {
  const w = element.videoWidth || element.naturalWidth, h = element.videoHeight || element.naturalHeight;
  if (!w || !h) throw new Error('The image is not ready. Give it a moment and try again.');
  const scale = Math.min(1,1600/Math.max(w,h));
  const canvas = document.createElement('canvas'); canvas.width = Math.round(w*scale); canvas.height = Math.round(h*scale);
  canvas.getContext('2d').drawImage(element,0,0,canvas.width,canvas.height);
  return canvas.toDataURL('image/jpeg',.86);
}
async function loadImageUrl(url,label) {
  state.inputBusy = true; updateControls();
  try {
    const img = new Image(); img.src = url;
    await img.decode(); setImage(imageFromElement(img),label);
  } finally { state.inputBusy = false; updateControls(); }
}
function renderObservations(observation,stamp) {
  state.observation = observation;
  $('observation-summary').textContent = observation.summary;
  $('observation-time').textContent = `FRAME · ${time(stamp)}`;
  $('observations').replaceChildren(...observation.observations.map((item,i) => {
    const li = document.createElement('li'), copy = document.createElement('div');
    copy.append(textElement('strong',item.label),textElement('p',item.detail));
    li.append(textElement('span',String(i+1).padStart(2,'0'),'index'),copy); return li;
  }));
  positionAnnotations();
}
function positionAnnotations() {
  const img = $('reference');
  if (!state.observation || img.hidden || !img.naturalWidth) return;
  const w = $('viewfinder').clientWidth, h = $('viewfinder').clientHeight;
  const scale = Math.min(w/img.naturalWidth,h/img.naturalHeight);
  const layer = $('annotations');
  Object.assign(layer.style,{ width:`${img.naturalWidth*scale}px`, height:`${img.naturalHeight*scale}px`,left:`${(w-img.naturalWidth*scale)/2}px`,top:`${(h-img.naturalHeight*scale)/2}px` });
  layer.replaceChildren(...state.observation.observations.map((item,i) => {
    const node = document.createElement('div'); node.className = 'annotation';
    const [x,y,width,height] = item.box;
    Object.assign(node.style,{ left:`${x*100}%`,top:`${y*100}%`,width:`${width*100}%`,height:`${height*100}%` });
    node.append(textElement('span',`${String(i+1).padStart(2,'0')} ${item.label}`)); return node;
  }));
}
async function persist() {
  try { await saveProject({ revisions:state.revisions,selected:state.selected }); }
  catch(error) { showError(error.message); }
}
function renderHistory() {
  $('revision-count').textContent = state.revisions.length ? `${state.revisions.length} saved version${state.revisions.length === 1 ? '' : 's'} · on this device` : 'Every build keeps the previous version.';
  $('revisions').replaceChildren(...state.revisions.map((revision,i) => {
    const button = document.createElement('button'); button.className = 'revision'; button.type = 'button';
    button.setAttribute('aria-current',String(revision.id === state.selected));
    button.setAttribute('aria-label',`Open version ${i+1}: ${revision.title}`); button.disabled = state.busy;
    button.append(textElement('span',`${String(i+1).padStart(2,'0')} / ${revision.title}`),textElement('small',`${time(revision.created)} · ${revision.referenceUsed === false ? 'typed revision' : revision.image ? 'visual reference' : 'typed direction'}`));
    button.addEventListener('click',() => { selectRevision(revision.id,true).catch(e => showError(e.message)); }); return button;
  }));
  if (!state.revisions.length) $('revisions').append(textElement('p','Your first version starts with an idea.','revision-empty'));
}
async function selectRevision(id,restoreEvidence = false) {
  const revision = state.revisions.find(r => r.id === id); if (!revision) return;
  const sequence = ++state.previewSequence;
  state.selected = id;
  $('preview').hidden = true; $('preview-empty').hidden = true;
  $('version-label').textContent = 'SOURCE AVAILABLE';
  renderRevision(revision); renderHistory(); updateControls();
  $('preview-note').textContent = 'Source available. Loading preview…';
  $('retry-preview').hidden = false;
  if (restoreEvidence) {
    if (revision.image) { setImage(revision.image,`SAVED REFERENCE · ${time(revision.created)}`); }
    else { liveView(); }
    if (revision.observation) renderObservations(revision.observation,revision.created);
    $('include-frame').checked = false; updateFrameChoice();
  }
  await persist();
  if (!state.token) { $('preview-note').textContent = 'Source available. Reconnect to load the preview.'; return; }
  try {
    const result = await api('/api/preview',{ html:revision.html });
    if (sequence !== state.previewSequence) return;
    await loadPreview(result.url);
    if (sequence !== state.previewSequence) return;
    $('preview').hidden = false; $('retry-preview').hidden = true;
    $('preview-note').textContent = revision.demo ? 'Working example · sample data · not a new AI build' : 'Interactive prototype · resets when reopened';
    await markReady(revision);
  } catch(error) {
    if (sequence === state.previewSequence) {
      $('preview-note').textContent = 'Source available. Retry preview or download it.';
      showError(error.message);
    }
  }
}
async function loadPreview(url,signal) {
  const response = await fetch(url,{ signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('The preview is unavailable. Your source is saved; choose Retry preview.');
  const frame = $('preview'); frame.hidden = true;
  await new Promise((resolve,reject) => {
    const cleanup = () => { clearTimeout(timer); frame.removeEventListener('load',loaded); signal?.removeEventListener('abort',aborted); };
    const loaded = () => { cleanup(); resolve(); };
    const aborted = () => { cleanup(); reject(new DOMException('Canceled','AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('The preview did not load. Select its saved version to retry.')); },15000);
    frame.addEventListener('load',loaded,{ once:true });
    signal?.addEventListener('abort',aborted,{ once:true });
    if (signal?.aborted) return aborted();
    frame.src = url;
  });
}
function renderRevision(revision) {
  $('prototype-title').textContent = revision.title;
  $('preview-note').textContent = 'Interactive prototype · resets when reopened';
  $('reply-text').textContent = revision.reply;
  $('changes').replaceChildren(...revision.changes.map(change => textElement('li',change)));
}
async function markReady(revision) {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  if (state.selected === revision.id) $('version-label').textContent = `VERSION ${String(state.revisions.indexOf(revision)+1).padStart(2,'0')}`;
}
function say(text) {
  if (!state.speaking || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find(v => v.localService && /en-(US|GB)/i.test(v.lang)) || voices.find(v => v.localService && /^en/i.test(v.lang)) || null;
  // Use a local voice only; avoid introducing a second cloud audio provider.
  if (!utterance.voice) { showError('No local English voice is available. Replies remain visible as text.'); return; }
  utterance.rate = 1.02; utterance.pitch = .92; speechSynthesis.speak(utterance);
}
async function beginBuild(automatic=false) {
  if (state.live && !automatic) return;
  if (state.busy || state.setupBusy || state.inputBusy || state.checking) return;
  hideError();
  const direction = $('direction').value.trim();
  if (!direction) { showError('Tell Jarvis what should work, such as “Build a task board.”'); $('direction').focus(); return; }
  if (!state.configured || !state.token) { $('setup-panel').open = true; showError('Check the selected model in Setup, then try again.'); return; }
  if (state.remaining === 0) { $('setup-panel').open = true; showError('Choose Start new allowance in Setup. This does not renew your provider subscription allowance.'); return; }
  try {
    if (automatic || ($('include-frame').checked && !state.image && state.stream)) setImage(imageFromElement($('camera')),`${state.captureKind==='screen' ? 'SCREEN SNAPSHOT' : 'CHOSEN FRAME'} · ${time(Date.now())}`);
  } catch(error) { showError(error.message); return; }
  if (!state.consent) { $('consent-dialog').showModal(); return; }
  state.busy = true; $('cancel').disabled = false; stopDictation(); window.speechSynthesis?.cancel();
  state.controller = new AbortController(); const controller = state.controller;
  let completed=false;
  const parent = current();
  const image = $('include-frame').checked ? state.image : null;
  const previous = parent?.html || '', created = new Date().toISOString(), started = Date.now();
  $('build-phase').textContent = image ? 'READING AND BUILDING' : previous ? 'REVISING YOUR APPLICATION' : 'BUILDING YOUR APPLICATION';
  $('build-overlay').dataset.model=state.model;
  $('build-message').textContent = state.model==='fable' ? 'Fable is grinding.' : 'Astra is thinking.';
  if (image) { $('sent-image').src=image; $('sent-label').textContent=`Frame sent · ${time(created)} · ${selectedLabel()}`; $('sent-evidence').hidden=false; }
  if (automatic) showSharedScreen();
  $('build-detail').textContent = image ? 'One selected frame, one subscription turn. Observations and the prototype arrive together. This can take several minutes.' : 'Using your direction and selected source. No image is sent. This can take several minutes.';
  $('build-elapsed').textContent = '0s elapsed · up to 5 minutes';
  const elapsedTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now()-started)/1000);
    $('activity').textContent = `${selectedLabel().toUpperCase()} · ${state.effort} · ${elapsed}s elapsed`;
    $('build-elapsed').textContent = `${elapsed}s elapsed · ${Math.max(0,300-elapsed)}s until timeout`;
    if (state.controller===controller) {
      $('build-message').textContent=elapsed<20 ? state.model==='fable' ? 'Fable is grinding.' : 'Astra is thinking.' : elapsed<60 ? 'Your idea is in motion.' : 'Still working on this version.';
      if(elapsed>=20) $('build-detail').textContent=elapsed<60 ? 'Waiting for the model’s result. You can keep trying the current prototype.' : 'No result yet. Complex builds can take several minutes. Cancel anytime; your saved versions stay here.';
    }
  },1000);
  updateControls();
  try {
    const built = await api('/api/build',{ image,instruction:direction,previous,consent:true },controller.signal);
    if (controller.signal.aborted) return;
    const observation = built.result.observation || (image ? null : parent?.observation) || null;
    const revision = { ...built.result,id:crypto.randomUUID(),image:image || parent?.image || null,referenceUsed:!!image,observation,instruction:direction,created,model:built.model,effort:built.effort || state.effort };
    // Accept and persist completed inference before attempting any preview work.
    state.revisions.push(revision); state.revisions = state.revisions.slice(-12); state.selected = revision.id;
    state.controller = null; $('cancel').disabled = true;
    renderRevision(revision); renderHistory(); await persist();
    if (!automatic) $('direction').value = ''; $('include-frame').checked = false; updateFrameChoice();
    if (observation && image) renderObservations(observation,created);
    $('build-phase').textContent = 'SOURCE READY'; $('build-detail').textContent = 'Opening the preview. You can retry it without generating again.';
    await selectRevision(revision.id,!automatic);
    completed=true;
    $('provider-status').textContent = `${selectedLabel()} · ${state.effort}`;
    say(revision.reply);
  } catch(error) {
    if (error.name !== 'AbortError') {
      showError(error.message);
      if (['LOGIN_REQUIRED','CLI_MISSING','MODEL_UNAVAILABLE','SUBSCRIPTION_LIMIT','SESSION_LIMIT'].includes(error.code)) {
        $('setup-panel').open = true; $('setup-message').textContent = error.message;
      }
    }
  } finally {
    clearInterval(elapsedTimer); state.busy = false; state.controller = null;
    if(automatic && !completed) pauseLive('Live build paused after an interrupted build. Review the message, then start again.');
    if(automatic && state.live && state.liveCount>=10) pauseLive('10 builds complete. Start again when you want more updates.');
    if(automatic && state.live) { showSharedScreen(); $('live-status').textContent='Version ready. Watching locally for your next change.'; }
    updateControls(); renderHistory();
  }
}
function stopDictation() {
  state.recognition?.abort(); state.recognition = null;
  $('mic').setAttribute('aria-pressed','false'); updateFrameChoice();
}
async function startDictation() {
  if (state.recognition) { stopDictation(); return; }
  if (!state.voiceConsent) { $('voice-dialog').showModal(); return; }
  window.speechSynthesis?.cancel();
  const recognition = new AbortController(); state.recognition = recognition;
  const base = $('direction').value.trim();
  $('mic').setAttribute('aria-pressed','true'); $('input-note').textContent = 'Listening locally through Windows. Pause to finish, or click the microphone to cancel.';
  try {
    const result = await api('/api/dictate',{ consent:true },recognition.signal);
    if (!recognition.signal.aborted) {
      if(result.text) $('direction').value = `${base ? `${base} ` : ''}${result.text}`.slice(0,4000);
      else showError('No speech was recognized. Try again or type your direction.');
    }
  } catch(error) { if(error.name !== 'AbortError') showError(error.message); }
  finally { if(state.recognition === recognition) stopDictation(); }
}

$('connect').addEventListener('click',() => startCamera());
$('camera-select').addEventListener('change',e => startCamera(e.target.value));
$('camera-off').addEventListener('click',stopCamera);
$('resume').addEventListener('click',liveView);
$('clear-reference').addEventListener('click',liveView);
$('upload').addEventListener('click',() => $('file').click());
$('file').addEventListener('change',async event => {
  const file = event.target.files?.[0]; if (!file) return;
  hideError();
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 20000000) { showError('Choose a JPEG, PNG, or WebP under 20 MB.'); return; }
  const url = URL.createObjectURL(file);
  try { await loadImageUrl(url,'UPLOADED REFERENCE · LOCAL'); }
  catch { showError('That image could not be opened. Try another file.'); }
  finally { URL.revokeObjectURL(url); event.target.value = ''; }
});
$('example').addEventListener('click',async () => {
  try { await loadImageUrl('/reference.svg','SAMPLE SKETCH · NOT YOUR CAMERA'); $('direction').value = 'Build the app in this sketch. Make the task board work: add, move, complete, and search tasks. Use warm ivory, ink, and terracotta.'; }
  catch { showError('The sample sketch could not be opened.'); }
});
$('composer').addEventListener('submit',event => { event.preventDefault(); beginBuild(); });
$('direction').addEventListener('keydown',event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); beginBuild(); } });
$('accept-consent').addEventListener('click',() => { state.consent = true; $('consent-dialog').close(); beginBuild(); });
$('decline-consent').addEventListener('click',() => $('consent-dialog').close());
$('cancel').addEventListener('click',() => { pauseLive('Paused. Your previous version is still here.'); state.controller?.abort(); $('reply-text').textContent = 'Canceled. Your previous version is still here.'; });
$('mic').addEventListener('click',startDictation);
$('accept-voice').addEventListener('click',() => { state.voiceConsent = true; $('voice-dialog').close(); startDictation(); });
$('sound').addEventListener('click',() => { state.speaking = !state.speaking; $('sound').setAttribute('aria-pressed',String(state.speaking)); $('sound').setAttribute('aria-label',state.speaking ? 'Mute spoken replies' : 'Enable spoken replies'); if (state.speaking) say('I’m here. Show me what you’re thinking.'); else window.speechSynthesis?.cancel(); });
$('privacy').addEventListener('click',() => $('privacy-dialog').showModal());
$('dismiss-error').addEventListener('click',hideError);
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click',() => $(button.dataset.close).close()));
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click',() => { if (!state.busy) { $('direction').value = button.dataset.prompt; $('direction').focus(); } }));
$('mobile-view').addEventListener('click',() => setViewport(true));
$('desktop-view').addEventListener('click',() => setViewport(false));
function setViewport(mobile) {
  $('preview').classList.toggle('mobile',mobile);
  for (const [id,active] of [['mobile-view',mobile],['desktop-view',!mobile]]) { $(id).classList.toggle('active',active); $(id).setAttribute('aria-pressed',String(active)); }
}
$('expand').addEventListener('click',() => { const expanded = document.querySelector('.output-column').classList.toggle('expanded'); $('expand').setAttribute('aria-label',expanded ? 'Collapse preview' : 'Expand preview'); });
document.addEventListener('keydown',event => { if (event.key === 'Escape') { document.querySelector('.output-column').classList.remove('expanded'); $('expand').setAttribute('aria-label','Expand preview'); } });
$('source').addEventListener('click',() => { if (!current()) return; $('source-code').textContent = current().html; $('source-dialog').showModal(); });
$('download').addEventListener('click',() => {
  const revision = current(); if (!revision) return;
  const url = URL.createObjectURL(new Blob([revision.html],{ type:'text/html' }));
  const link = document.createElement('a'); link.href = url; link.download = `${revision.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,60) || 'jarvis-prototype'}.html`;
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
});
$('new-session').addEventListener('click',() => { if (!state.busy) $('reset-dialog').showModal(); });
$('confirm-reset').addEventListener('click',async () => {
  if (state.busy) return;
  try {
    await saveProject({ revisions:[],selected:null });
    ++state.previewSequence; state.revisions = []; state.selected = null; stopDictation(); stopCamera(); liveView(); $('sent-evidence').hidden=true; $('sent-image').removeAttribute('src');
    $('preview').hidden = true; $('preview').removeAttribute('src'); $('preview-empty').hidden = false;
    $('prototype-title').textContent = 'Your next idea, running.'; $('version-label').textContent = 'READY WHEN YOU ARE';
    $('preview-note').textContent = 'A real preview will appear here.'; $('reply-text').textContent = 'A fresh page. Show me what’s next.';
    $('changes').replaceChildren(); $('direction').value = ''; $('source-code').textContent = '';
    $('retry-preview').hidden = true; $('reset-dialog').close(); renderHistory(); updateControls(); hideError();
  } catch(error) { showError(error.message); }
});
$('reference').addEventListener('load',positionAnnotations);
new ResizeObserver(positionAnnotations).observe($('viewfinder'));
window.addEventListener('pagehide',() => { state.controller?.abort(); stopCamera(); stopDictation(); window.speechSynthesis?.cancel(); });
document.addEventListener('visibilitychange',() => { if (document.hidden) stopDictation(); });

function updateFrameChoice() {
  const available = !!(state.image || state.stream);
  $('include-frame').disabled = state.live || state.busy || state.setupBusy || state.inputBusy || !available;
  if (!available) $('include-frame').checked = false;
  $('frame-choice-note').textContent = $('include-frame').checked ? (state.image ? 'Selected image will be sent' : `One ${state.captureKind==='screen'?'screen':'camera'} frame will be chosen`) : available ? 'Reference kept here; not sent' : 'No frame selected';
  $('input-note').textContent = state.live ? 'Live build on: changed screen snapshots are sent automatically under your consent.' : $('include-frame').checked ? 'Your direction + one chosen frame. Shared only when you build.' : 'Your direction + selected source. No image will be sent.';
}
function renderBudget() {
  $('budget').textContent = Number.isFinite(state.remaining) ? `${state.remaining} local requests left · subscription limits also apply` : 'Local allowance unavailable';
}
let sessionSequence=0;
async function refreshSession() {
  const sequence=++sessionSequence;
  const requestedModel=state.model,requestedEffort=state.effort;
  state.checking=true; state.configured=false; updateControls();
  $('recheck').disabled = true;
  try {
    const local = await fetch('/api/local-session',{ signal:AbortSignal.timeout(3000),headers:launchHeaders() });
    if (!local.ok) throw new Error('Local connection unavailable. Open Jarvis from its desktop shortcut, then choose Reconnect.');
    const connection = await local.json();
    if (sequence!==sessionSequence) return;
    state.token = connection.token; state.remaining = connection.remaining; state.dictation = connection.dictation;
    updateControls(); renderBudget();
    if (current()) await selectRevision(state.selected);
    const response = await fetch('/api/session',{ signal:AbortSignal.timeout(17000),headers:{...launchHeaders(),'X-Jarvis-Model':requestedModel,'X-Jarvis-Effort':requestedEffort} });
    if (!response.ok) throw new Error('Could not connect to Jarvis. Reopen Jarvis, then choose Reconnect. Your saved source is available.');
    const session = await response.json();
    if (sequence!==sessionSequence) return;
    state.token = session.token; state.configured = session.configured; state.remaining = session.remaining; state.dictation = session.dictation;
    $('provider-status').textContent = session.configured ? `${selectedLabel()} · ${state.effort}` : 'Setup needed';
    $('provider-dot').classList.toggle('ready',session.configured);
    $('setup-summary').textContent = session.configured ? `${selectedAccount()} connected` : 'Action needed';
    const cliName=state.model==='fable'?'Claude Code':'Codex CLI';
    $('cli-check').textContent = session.cli === false ? `Official ${cliName} needs installation.` : session.code==='CLI_UPDATE_REQUIRED' ? `Official ${cliName} needs updating.` : `Official ${cliName} is available.`;
    $('login-check').textContent = session.configured ? `Signed in with ${selectedAccount()}.` : `${selectedAccount()} subscription sign-in is needed.`;
    $('install-codex').hidden = session.cli !== false && session.code!=='CLI_UPDATE_REQUIRED';
    $('install-codex').textContent=`Install official ${cliName}`;
    $('login').hidden = session.configured || session.cli === false || session.code==='CLI_UPDATE_REQUIRED';
    $('login').textContent=`Sign in with ${selectedAccount()}`;
    $('setup-message').textContent = session.reason || 'Ready to build. Selected model access and subscription allowance are checked on each request.';
    $('setup-panel').open = !session.configured;
  } catch(error) {
    if (sequence!==sessionSequence) return;
    state.configured = false;
    $('provider-status').textContent = 'Local connection unavailable';
    $('provider-dot').classList.remove('ready'); $('setup-panel').open = true;
    $('setup-summary').textContent = 'Reconnect needed'; $('setup-message').textContent = error.message;
    showError(error.message);
  } finally { if (sequence===sessionSequence) {state.checking=false;renderBudget(); updateControls(); updateFrameChoice();} }
}
for (const id of ['model-choice','effort-choice']) $(id).addEventListener('change',async()=>{
  if (state.busy || state.setupBusy) {renderSelection();return;}
  state.model=$('model-choice').value; state.effort=$('effort-choice').value; state.consent=false;
  try {localStorage.setItem('jarvisModelPreferences',JSON.stringify({model:state.model,effort:state.effort}));} catch { }
  renderSelection(); hideError(); await refreshSession();
});
async function setupAction(path) {
  if (state.setupBusy || state.busy || !state.token) return;
  state.setupBusy = true; state.setupController = new AbortController();
  $('cancel-setup').hidden = false;
  $('setup-message').textContent = path === '/api/login' ? `Complete ${selectedAccount()} sign-in in the browser opened by the official CLI. This can take up to three minutes.` : `Installing official ${state.model==='fable'?'Claude Code':'Codex CLI'}. This can take up to three minutes.`;
  updateControls();
  try { await api(path,{ consent:true },state.setupController.signal); await refreshSession(); }
  catch(error) { $('setup-message').textContent = error.name === 'AbortError' ? 'Setup action canceled. Choose Check again to inspect the current state.' : error.message; }
  finally { state.setupBusy = false; state.setupController = null; $('cancel-setup').hidden = true; updateControls(); }
}
$('setup-toggle').addEventListener('click',() => { $('setup-panel').open = !$('setup-panel').open; if ($('setup-panel').open) $('setup-panel').scrollIntoView({ block:'nearest' }); });
$('recheck').addEventListener('click',refreshSession);
$('reconnect').addEventListener('click',async () => { hideError(); await refreshSession(); });
$('login').addEventListener('click',() => setupAction('/api/login'));
$('install-codex').addEventListener('click',() => $('install-dialog').showModal());
$('confirm-install').addEventListener('click',() => { $('install-dialog').close(); setupAction('/api/install-codex'); });
$('cancel-setup').addEventListener('click',() => state.setupController?.abort());
$('reset-budget').addEventListener('click',() => $('budget-dialog').showModal());
$('confirm-budget').addEventListener('click',async () => {
  $('budget-dialog').close();
  try { await api('/api/reset-budget',{ consent:true }); updateControls(); $('setup-message').textContent = 'Local allowance renewed. Your subscription allowance is unchanged.'; }
  catch(error) { showError(error.message); }
});
$('retry-preview').addEventListener('click',() => selectRevision(state.selected));
$('include-frame').addEventListener('change',updateFrameChoice);
$('direction').addEventListener('input',()=>{if(state.live) {state.liveFrames.sent=null;state.liveFrames.stableSince=Date.now();}});
$('try-demo').addEventListener('click',async () => {
  if (state.busy || state.inputBusy) return;
  hideError(); state.inputBusy = true; updateControls();
  try {
    const existing = state.revisions.find(r => r.demo);
    if (existing) { await selectRevision(existing.id,true); return; }
    const response = await fetch('/demo.html'); if (!response.ok) throw new Error('The working example could not load. Reconnect and try again.');
    const revision = { id:crypto.randomUUID(),demo:true,title:'DAYLIGHT · Working example',reply:'This is a built-in example with sample data, not a new AI build. Add a task, move it, then describe a change to make it yours.',changes:[],html:await response.text(),created:new Date().toISOString(),image:null,observation:null,referenceUsed:false };
    state.revisions.push(revision); state.revisions = state.revisions.slice(-12);
    await selectRevision(revision.id,true);
    $('prototype').scrollIntoView({ block:'nearest' });
  } catch(error) { showError(error.message); }
  finally { state.inputBusy = false; updateControls(); }
});
window.addEventListener('pagehide',() => state.setupController?.abort());
async function init() {
  renderSelection();
  updateControls();
  try {
    const project = await loadProject();
    state.revisions = Array.isArray(project.revisions) ? project.revisions.slice(-12).filter(r => r && typeof r.html === 'string' && typeof r.id === 'string' && typeof r.title === 'string' && Array.isArray(r.changes)) : [];
    if (state.revisions.length) await selectRevision(state.revisions.some(r => r.id === project.selected) ? project.selected : state.revisions.at(-1).id,true);
  } catch(error) { showError(error.message); }
  await refreshSession();
}
init();
