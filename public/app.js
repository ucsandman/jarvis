import { loadProject, saveProject } from './storage.js';

const $ = id => document.getElementById(id);
const state = { token:'', configured:false, stream:null, image:null, imageLabel:'', observation:null,
  revisions:[], selected:null, busy:false, consent:false, voiceConsent:false, speaking:false, recognition:null, controller:null, previewSequence:0 };
const current = () => state.revisions.find(r => r.id === state.selected);
const showError = message => { $('error-text').textContent = message; $('error').hidden = false; };
const hideError = () => { $('error').hidden = true; };
const time = value => new Date(value).toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });

async function api(path, body, signal) {
  const response = await fetch(path,{ method:'POST',signal,headers:{ 'Content-Type':'application/json','X-Jarvis-Session':state.token },body:JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
function textElement(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function updateControls() {
  const controls = ['build','connect','upload','example','file','new-session','camera-select','clear-reference','resume','mic'];
  controls.forEach(id => { $(id).disabled = state.busy || (!state.token && id === 'build'); });
  $('build').disabled = state.busy || !state.configured;
  document.querySelectorAll('.revision').forEach(b => { b.disabled = state.busy; });
  $('direction').disabled = state.busy;
  $('build-overlay').hidden = !state.busy;
  $('source').disabled = !current(); $('download').disabled = !current();
  $('activity').textContent = state.busy ? 'WORKING ON YOUR IDEA' : current() ? 'READY FOR THE NEXT CHANGE' : 'IDEAS WELCOME';
  $('reply-status').textContent = state.busy ? 'Working' : current() ? 'Version ready' : 'Standing by';
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
}
function liveView() {
  state.image = null; state.imageLabel = ''; clearObservations();
  $('reference').hidden = true; $('reference').removeAttribute('src'); $('frame-label').hidden = true; $('frame-tools').hidden = true;
  $('camera').hidden = !state.stream; $('camera-empty').hidden = !!state.stream;
  $('source-status').textContent = state.stream ? 'LIVE · LOCAL ONLY' : 'CAMERA OFF';
}
function stopCamera() {
  state.stream?.getTracks().forEach(track => track.stop()); state.stream = null;
  $('camera').srcObject = null; $('camera-controls').hidden = true; $('resume').hidden = true;
  if (!state.image) liveView();
}
async function startCamera(deviceId) {
  hideError();
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
  }
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
  const img = new Image(); img.src = url;
  await img.decode(); setImage(imageFromElement(img),label);
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
    button.append(textElement('span',`${String(i+1).padStart(2,'0')} / ${revision.title}`),textElement('small',`${time(revision.created)} · ${revision.image ? 'visual reference' : 'spoken / typed direction'}`));
    button.addEventListener('click',() => { selectRevision(revision.id,true).catch(e => showError(e.message)); }); return button;
  }));
  if (!state.revisions.length) $('revisions').append(textElement('p','Your first version starts with an idea.','revision-empty'));
}
async function selectRevision(id,restoreEvidence = false) {
  const revision = state.revisions.find(r => r.id === id); if (!revision) return;
  const sequence = ++state.previewSequence;
  const result = await api('/api/preview',{ html:revision.html });
  if (sequence !== state.previewSequence) return;
  await loadPreview(result.url);
  if (sequence !== state.previewSequence) return;
  state.selected = id;
  renderRevision(revision);
  if (restoreEvidence) {
    if (revision.image) { setImage(revision.image,`SAVED REFERENCE · ${time(revision.created)}`); await $('reference').decode(); }
    else { liveView(); }
    if (revision.observation) renderObservations(revision.observation,revision.created);
  }
  renderHistory(); updateControls(); await persist(); await markReady(revision);
}
async function loadPreview(url,signal) {
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
  $('preview').hidden = false; $('preview-empty').hidden = true;
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
  if (state.busy) return;
  hideError();
  const direction = $('direction').value.trim();
  if (!direction) { showError('Give me a little direction, such as “Build the app in this sketch.”'); $('direction').focus(); return; }
  if (!state.configured) { showError('Jarvis requires Codex signed in with ChatGPT. API-key authentication is not accepted.'); return; }
  try {
    if (!state.image && state.stream) setImage(imageFromElement($('camera')),`CHOSEN FRAME · ${time(Date.now())}`);
  } catch (error) { showError(error.message); return; }
  if (!state.consent) { $('consent-dialog').showModal(); return; }
  state.busy = true; $('cancel').disabled = false; stopDictation(); window.speechSynthesis?.cancel();
  state.controller = new AbortController(); const controller = state.controller;
  const image = state.image, previous = current()?.html || '', created = new Date().toISOString();
  const started = Date.now();
  const elapsedTimer = setInterval(() => { $('activity').textContent = `ASTRA · ${Math.floor((Date.now()-started)/1000)}s elapsed`; },1000);
  updateControls(); let observation = null;
  try {
    if (image) {
      $('build-phase').textContent = 'READING YOUR REFERENCE'; $('build-message').textContent = 'I see where you’re going.';
      $('build-detail').textContent = 'Reading the layout, labels, and details in your selected frame.';
      $('viewfinder').classList.add('scanning');
      const observed = await api('/api/observe',{ image,instruction:direction,consent:true },controller.signal);
      if (controller.signal.aborted) return;
      observation = observed.result; renderObservations(observation,created);
      $('viewfinder').classList.remove('scanning');
      if (!observation.readable) throw new Error('I cannot read enough of this reference. Move closer, improve the lighting, or clear the image and describe the change.');
    }
    $('build-phase').textContent = previous ? 'REVISING YOUR APPLICATION' : 'BUILDING YOUR APPLICATION';
    $('build-message').textContent = previous ? 'Let’s make that change.' : 'From thought to thing.';
    $('build-detail').textContent = previous ? 'Updating this version while preserving the rest of your work. Large revisions can take several minutes.' : 'Astra is writing the layout and working interactions through your subscription. Large builds can take several minutes.';
    const built = await api('/api/build',{ image,instruction:direction,previous,consent:true },controller.signal);
    if (controller.signal.aborted) return;
    const revision = { ...built.result,id:crypto.randomUUID(),image,observation,instruction:direction,created,model:built.model };
    const preview = await api('/api/preview',{ html:revision.html },controller.signal);
    if (controller.signal.aborted) return;
    await loadPreview(preview.url,controller.signal);
    if (controller.signal.aborted) return;
    state.controller = null; $('cancel').disabled = true;
    state.revisions.push(revision); state.revisions = state.revisions.slice(-12);
    state.selected = revision.id; renderRevision(revision); renderHistory(); await persist(); await markReady(revision); $('direction').value = '';
    $('provider-status').textContent = 'Astra · subscription';
    say(revision.reply);
  } catch (error) {
    if (error.name !== 'AbortError') showError(error.message);
    if ($('preview').hidden && current()) await selectRevision(state.selected).catch(e => showError(e.message));
  } finally {
    clearInterval(elapsedTimer);
    state.busy = false; state.controller = null; $('viewfinder').classList.remove('scanning'); updateControls(); renderHistory();
  }
}
function stopDictation() {
  state.recognition?.abort(); state.recognition = null;
  $('mic').setAttribute('aria-pressed','false'); $('input-note').textContent = 'One chosen frame + your direction. Sent only when you build.';
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
    $('reset-dialog').close(); renderHistory(); updateControls(); hideError();
  } catch(error) { showError(error.message); }
});
$('reference').addEventListener('load',positionAnnotations);
new ResizeObserver(positionAnnotations).observe($('viewfinder'));
window.addEventListener('pagehide',() => { state.controller?.abort(); stopCamera(); stopDictation(); window.speechSynthesis?.cancel(); });
document.addEventListener('visibilitychange',() => { if (document.hidden) stopDictation(); });

async function init() {
  updateControls();
  try {
    const response = await fetch('/api/session'); if (!response.ok) throw new Error('Could not connect to the local Jarvis service.');
    const session = await response.json(); state.token = session.token; state.configured = session.configured;
    $('provider-status').textContent = session.configured ? 'Astra · subscription' : 'Subscription login needed';
    $('provider-dot').classList.toggle('ready',session.configured);
    if (!session.configured) showError(session.reason || 'Sign in to Codex with ChatGPT. Jarvis does not accept API keys.');
    const project = await loadProject();
    state.revisions = Array.isArray(project.revisions) ? project.revisions.slice(-12).filter(r => typeof r.html === 'string' && typeof r.id === 'string' && Array.isArray(r.changes)) : [];
    if (state.revisions.length) await selectRevision(state.revisions.some(r => r.id === project.selected) ? project.selected : state.revisions.at(-1).id,true);
  } catch(error) { showError(error.message); }
  updateControls();
}
init();
