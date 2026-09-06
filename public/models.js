// The model catalog. One list for the server (lib/models.mjs re-exports it) and the page, so the selector, the consent
// sentence and the CLI arguments can never disagree. Every entry is a product choice: one model on one official CLI,
// on the subscription that CLI is signed in with. Never an arbitrary model ID or CLI argument from the page.
// Local runtimes (LM Studio, Ollama) are the one exception to a fixed list: the server enumerates what the runtime holds
// and the page adopts that list, so the page still chooses from server-supplied entries, never free text.
export const EFFORTS=['low','medium','high','xhigh','max'];
const STANDARD=['low','medium','high','xhigh'];
export const LOCAL_EFFORTS=['low','medium','high'];
export const PROVIDERS={
  openai:{label:'OpenAI',account:'ChatGPT',cli:'Codex',subscription:'OpenAI subscription',usageCredits:false},
  anthropic:{label:'Anthropic',account:'Claude',cli:'Claude Code',subscription:'Anthropic subscription',usageCredits:true},
  lmstudio:{label:'Local',account:'LM Studio',cli:'Codex',subscription:'this computer',usageCredits:false,local:true,port:1234},
  ollama:{label:'Local',account:'Ollama',cli:'Codex',subscription:'this computer',usageCredits:false,local:true,port:11434}
};
// OpenAI entries and their effort levels come from the Codex CLI's own model list on 2026-09-05; Anthropic entries from Claude Code's model names.
export const MODELS=[
  {id:'astra',label:'Astra',model:'gpt-6-astra',provider:'openai',efforts:EFFORTS},
  {id:'sol',label:'GPT-5.6 Sol',model:'gpt-5.6-sol',provider:'openai',efforts:EFFORTS},
  {id:'terra',label:'GPT-5.6 Terra',model:'gpt-5.6-terra',provider:'openai',efforts:EFFORTS},
  {id:'luna',label:'GPT-5.6 Luna',model:'gpt-5.6-luna',provider:'openai',efforts:EFFORTS},
  {id:'gpt-5.5',label:'GPT-5.5',model:'gpt-5.5',provider:'openai',efforts:STANDARD},
  {id:'gpt-5.4-mini',label:'GPT-5.4 Mini',model:'gpt-5.4-mini',provider:'openai',efforts:STANDARD},
  {id:'codex-spark',label:'GPT-5.3 Codex Spark',model:'gpt-5.3-codex-spark',provider:'openai',efforts:STANDARD},
  {id:'fable',label:'Fable 5.1',model:'claude-fable-5-1',provider:'anthropic',efforts:EFFORTS},
  {id:'opus',label:'Opus 5',model:'claude-opus-5',provider:'anthropic',efforts:EFFORTS},
  {id:'sonnet',label:'Sonnet 5',model:'claude-sonnet-5',provider:'anthropic',efforts:EFFORTS},
  {id:'haiku',label:'Haiku 4.5',model:'claude-haiku-4-5-20251001',provider:'anthropic',efforts:EFFORTS}
];
// Local entries, replaced whole on each enumeration. An id is `<runtime>:<model key>`; the key is what Codex's --model receives.
export const LOCAL=[];
const KEY=/^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/;
export function localEntry(runtime,key,label,context) {
  if(!PROVIDERS[runtime]?.local || typeof key!=='string' || !KEY.test(key)) return null;
  return {id:`${runtime}:${key}`,label:typeof label==='string' && label.trim()?label.trim().slice(0,60):key,model:key,provider:runtime,efforts:LOCAL_EFFORTS,...(Number.isInteger(context) && context>0?{context}:{})};
}
export function setLocalModels(list) {
  LOCAL.length=0;
  for(const item of Array.isArray(list)?list:[]) {const entry=localEntry(item.provider,item.model,item.label,item.context);if(entry && !LOCAL.some(known=>known.id===entry.id)) LOCAL.push(entry);}
  return LOCAL;
}
// The catalog entry for a selection id, with its provider's account, CLI and billing facts folded in. Null for anything else.
export function choice(id) {
  const entry=MODELS.find(item=>item.id===id) || LOCAL.find(item=>item.id===id);
  if(!entry) return null;
  const provider=PROVIDERS[entry.provider];
  return {...entry,account:provider.account,cli:provider.cli,subscription:provider.subscription,usageCredits:provider.usageCredits,local:provider.local===true};
}
