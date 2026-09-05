import { loadProject, saveProject } from './storage.js';

const $ = id => document.getElementById(id);
const state = { token:'', configured:false, stream:null, image:null, imageLabel:'', observation:null,
  revisions:[], selected:null, busy:false, consent:false, voiceConsent:false, speaking:false, recognition:null, controller:null, previewSequence:0, remaining:null, setupBusy:false, setupController:null, dictation:false, inputBusy:false };
const current = () => state.revisions.find(r => r.id === state.selected);
const showError = message => { $('error-text').textContent = message; $('error').hidden = false; };
const hideError = () => { $('error').hidden = true; };
const time = value => new Date(value).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });

async function api(path, body, signal) {
  const response = await fetch(path,{ method:'POST',signal,headers:{ 'Content-Type':'application/json','X-Jarvis-Session':state.token },body:JSON.stringify(body) });
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
  const controls = ['build','connect','upload','example','file','new-session','camera-select','clear-reference','resume','mic','try-demo','include-frame'];
  controls.forEach(id => { $(id).disabled = state.busy || state.setupBusy || state.inputBusy || (!state.token && id === 'build'); });
  $('build').disabled = state.busy || state.setupBusy || state.inputBusy || !state.configured || !state.token || state.remaining === 0;
  $('mic').disabled = state.busy || state.setupBusy || !state.token || !state.dictation;
  $('mic').title = state.dictation ? 'Dictate direction locally' : 'Local dictation is available on Windows after connection';
  for (const id of ['login','install-codex','recheck','reset-budget']) $(id).disabled = state.busy || state.setupBusy;
  $('direction').disabled = state.busy || state.setupBusy;
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
  $('source-status').textContent = state.stream ? 'LIVE · LOCAL ONLY' : 'CAMERA OFF';
  $('include-frame').checked = !!state.stream; updateFrameChoice();
}
function stopCamera() {
  state.stream?.getTracks().forEach(track => track.stop()); state.stream = null;
  $('camera').srcObject = null; $('camera-controls').hidden = true; $('resume').hidden = true;
  if (!state.image) liveView();
}
async function startCamera(deviceId) {
  if (state.inputBusy) return;
  hideError(); state.inputBusy = true; updateControls();
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera access needs localhost and a supported browser. You can upload a reference instead.');
    stopCamera();
    state.stream = await navigator.mediaDevices.getUserMedia({ video:deviceId ? { deviceId:{ exact:deviceId },width:{ ideal:1920 },height:{ ideal:1080 } } : { width:{ ideal:1920 },height:{ ideal:1080 },facingMode:'environment' }, audio:false });
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
async function beginBuild() {
  if (state.busy || state.setupBusy || state.inputBusy) return;
  hideError();
  const direction = $('direction').value.trim();
  if (!direction) { showError('Tell Jarvis what should work, such as “Build a task board.”'); $('direction').focus(); return; }
  if (!state.configured || !state.token) { $('setup-panel').open = true; showError('Connect your ChatGPT subscription in Setup, then try again.'); return; }
  if (state.remaining === 0) { $('setup-panel').open = true; showError('Choose Start new allowance in Setup. This does not renew your ChatGPT allowance.'); return; }
  try {
    if ($('include-frame').checked && !state.image && state.stream) setImage(imageFromElement($('camera')),`CHOSEN FRAME · ${time(Date.now())}`);
  } catch(error) { showError(error.message); return; }
  if (!state.consent) { $('consent-dialog').showModal(); return; }
  state.busy = true; $('cancel').disabled = false; stopDictation(); window.speechSynthesis?.cancel();
  state.controller = new AbortController(); const controller = state.controller;
  const parent = current();
  const image = $('include-frame').checked ? state.image : null;
  const previous = parent?.html || '', created = new Date().toISOString(), started = Date.now();
  $('build-phase').textContent = image ? 'READING AND BUILDING' : previous ? 'REVISING YOUR APPLICATION' : 'BUILDING YOUR APPLICATION';
  $('build-message').textContent = previous ? 'Making your next change.' : 'Building your first version.';
  $('build-detail').textContent = image ? 'One selected frame, one subscription turn. Observations and the prototype arrive together. This can take several minutes.' : 'Using your direction and selected source. No image is sent. This can take several minutes.';
  $('build-elapsed').textContent = '0s elapsed · up to 5 minutes';
  const elapsedTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now()-started)/1000);
    $('activity').textContent = `ASTRA · ${elapsed}s elapsed`;
    $('build-elapsed').textContent = `${elapsed}s elapsed · ${Math.max(0,300-elapsed)}s until timeout`;
  },1000);
  updateControls();
  try {
    const built = await api('/api/build',{ image,instruction:direction,previous,consent:true },controller.signal);
    if (controller.signal.aborted) return;
    const observation = built.result.observation || (image ? null : parent?.observation) || null;
    const revision = { ...built.result,id:crypto.randomUUID(),image:image || parent?.image || null,referenceUsed:!!image,observation,instruction:direction,created,model:built.model };
    // Accept and persist completed inference before attempting any preview work.
    state.revisions.push(revision); state.revisions = state.revisions.slice(-12); state.selected = revision.id;
    state.controller = null; $('cancel').disabled = true;
    renderRevision(revision); renderHistory(); await persist();
    $('direction').value = ''; $('include-frame').checked = false; updateFrameChoice();
    if (observation && image) renderObservations(observation,created);
    $('build-phase').textContent = 'SOURCE READY'; $('build-detail').textContent = 'Opening the preview. You can retry it without generating again.';
    await selectRevision(revision.id,true);
    $('provider-status').textContent = 'Astra · subscription';
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
$('cancel').addEventListener('click',() => { state.controller?.abort(); $('reply-text').textContent = 'Canceled. Your previous version is still here.'; });
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
    ++state.previewSequence; state.revisions = []; state.selected = null; stopDictation(); stopCamera(); liveView();
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
  $('include-frame').disabled = state.busy || state.setupBusy || state.inputBusy || !available;
  if (!available) $('include-frame').checked = false;
  $('frame-choice-note').textContent = $('include-frame').checked ? (state.image ? 'Selected image will be sent' : 'One camera frame will be chosen') : available ? 'Reference kept here; not sent' : 'No frame selected';
  $('input-note').textContent = $('include-frame').checked ? 'Your direction + one chosen frame. Shared only when you build.' : 'Your direction + selected source. No image will be sent.';
}
function renderBudget() {
  $('budget').textContent = Number.isFinite(state.remaining) ? `${state.remaining} local requests left · subscription limits also apply` : 'Local allowance unavailable';
}
async function refreshSession() {
  $('recheck').disabled = true;
  try {
    const local = await fetch('/api/local-session',{ signal:AbortSignal.timeout(3000) });
    if (!local.ok) throw new Error('Local connection unavailable. Reopen Start Jarvis.cmd, then choose Reconnect.');
    const connection = await local.json();
    state.token = connection.token; state.remaining = connection.remaining; state.dictation = connection.dictation;
    updateControls(); renderBudget();
    if (current()) await selectRevision(state.selected);
    const response = await fetch('/api/session',{ signal:AbortSignal.timeout(17000) });
    if (!response.ok) throw new Error('Could not connect to Jarvis. Reopen Start Jarvis.cmd, then choose Reconnect. Your saved source is available.');
    const session = await response.json();
    state.token = session.token; state.configured = session.configured; state.remaining = session.remaining; state.dictation = session.dictation;
    $('provider-status').textContent = session.configured ? 'Astra · subscription' : 'Setup needed';
    $('provider-dot').classList.toggle('ready',session.configured);
    $('setup-summary').textContent = session.configured ? 'ChatGPT connected' : 'Action needed';
    $('cli-check').textContent = session.cli === false ? 'Official Codex CLI needs installation.' : 'Official Codex CLI is available.';
    $('login-check').textContent = session.configured ? 'Signed in with ChatGPT.' : 'ChatGPT subscription sign-in is needed.';
    $('install-codex').hidden = session.cli !== false;
    $('login').hidden = session.configured || session.cli === false;
    $('setup-message').textContent = session.reason || 'Ready to build. Astra model access and subscription allowance are checked on each request.';
    $('setup-panel').open = !session.configured;
  } catch(error) {
    state.configured = false;
    $('provider-status').textContent = 'Local connection unavailable';
    $('provider-dot').classList.remove('ready'); $('setup-panel').open = true;
    $('setup-summary').textContent = 'Reconnect needed'; $('setup-message').textContent = error.message;
    showError(error.message);
  } finally { renderBudget(); updateControls(); updateFrameChoice(); }
}
async function setupAction(path) {
  if (state.setupBusy || state.busy || !state.token) return;
  state.setupBusy = true; state.setupController = new AbortController();
  $('cancel-setup').hidden = false;
  $('setup-message').textContent = path === '/api/login' ? 'Complete ChatGPT sign-in in the browser window opened by Codex. This can take up to three minutes.' : 'Installing the official Codex CLI. This can take up to three minutes.';
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
  updateControls();
  try {
    const project = await loadProject();
    state.revisions = Array.isArray(project.revisions) ? project.revisions.slice(-12).filter(r => r && typeof r.html === 'string' && typeof r.id === 'string' && typeof r.title === 'string' && Array.isArray(r.changes)) : [];
    if (state.revisions.length) await selectRevision(state.revisions.some(r => r.id === project.selected) ? project.selected : state.revisions.at(-1).id,true);
  } catch(error) { showError(error.message); }
  await refreshSession();
}
init();
