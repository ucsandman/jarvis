// The one source of prewritten prompts. Family detection is local: process name plus title, zero pixels, zero model calls.
// A chip only fills the box (and captures a frame when marked). It never sends.
const PROCESS={
  code:['code','devenv','idea64','rider64','notepad++','sublime_text'],
  terminal:['windowsterminal','powershell','pwsh','cmd','conhost'],
  browser:['chrome','msedge','firefox','brave'],
  chat:['outlook','olk','ms-teams','teams','slack','discord'],
  sheet:['excel'],
  doc:['winword','acrobat','acrord32','sumatrapdf'],
  design:['figma','photoshop','illustrator','mspaint','affinity'],
  settings:['systemsettings','msiexec']
};
const ERROR=/error|failed|exception|cannot|denied|unable|not responding/i;

export function families(process='',title='') {
  const name=String(process || '').replace(/\.exe$/i,'').toLowerCase(),text=String(title || '');
  const out=[];
  if(ERROR.test(text)) out.push('error');
  for(const [family,names] of Object.entries(PROCESS)) if(names.includes(name)) out.push(family);
  if(out.includes('browser') && /\.pdf\b/i.test(text)) out.push('doc');
  if(/Setup|Install|Settings|Options|Preferences/.test(text) && !out.includes('settings')) out.push('settings');
  if(!out.length) out.push('unknown');
  return out;
}

export const UNKNOWN_CHIPS=[
  {id:'think',label:'What do you think about this?',prompt:'What do you think about this?',capture:'frame',families:['unknown']},
  {id:'task',label:'Help me with a task',prompt:'Help me finish setting this up.',capture:'none',families:['unknown']},
  {id:'make',label:'Make something together',prompt:'Help me build a prototype.',capture:'none',families:['unknown']}
];

// The studio rail's three prompts. They only fill #direction.
export const DESIGN_CHIPS=[
  {id:'build',label:'Build this.',prompt:'Build the app in this sketch. Make the controls work.',capture:'none',families:['design']},
  {id:'change',label:'Change it to this.',prompt:'Apply the changes in this new reference to the current app. Preserve everything else.',capture:'none',families:['design']},
  {id:'mobile',label:'Make it work on mobile.',prompt:'Make the current app work beautifully on a phone. Keep all its functionality.',capture:'none',families:['design']}
];

export const CHIPS=[
  {id:'unstick',label:'Unstick me',families:['error','terminal','settings','code'],capture:'frame',prompt:'Read this error exactly as shown. Name the single most likely cause in one sentence. Then give at most three concrete next steps I can do from this screen, each one referencing something visible. If the screen does not contain enough to be sure, say what to look at next instead of guessing. No general troubleshooting advice.'},
  {id:'safe-click',label:'Is this safe to click?',families:['error','settings'],capture:'frame',prompt:'Look at the buttons on this screen. For the one I am most likely to press, say what it will do and whether it can be undone. If the dialog is asking for a password, permission or payment, say so first.'},
  {id:'what-error',label:"What's this error?",families:['code','terminal'],capture:'frame',prompt:'Find the error or warning on this screen. Quote it exactly. Say what it means in one plain sentence and the one change most likely to fix it.'},
  {id:'commit',label:'Write the commit message',families:['code'],when:/diff|Source Control|git/i,capture:'frame',prompt:'Write a commit message for the change visible on this screen. First line under 60 characters, imperative mood. Then at most three lines saying what changed and why, from the diff only.'},
  {id:'explain-code',label:'What does this do?',families:['code'],capture:'frame',prompt:'Explain what the code visible on this screen does, in the order it runs, in plain sentences. Do not rewrite it. If part of it is cut off, say which part.'},
  {id:'tests',label:'What should I test?',families:['code'],capture:'frame',prompt:'From the code visible here, list the three cases most likely to break: one normal input, one edge, one failure. One line each, each naming the input and the expected result.'},
  {id:'output',label:'What does this output mean?',families:['terminal'],capture:'frame',prompt:'Read the terminal output on this screen. Say whether the command succeeded or failed, quote the line that tells you, and say what to do next in one sentence.'},
  {id:'summarize',label:'Summarize this page',families:['browser','doc'],capture:'frame',prompt:'Summarize what is visible on this screen in five bullets or fewer: what it is, what it claims, what it wants me to do. Quote the line each bullet came from. If the page continues off screen, say so.'},
  {id:'agreeing',label:'What am I agreeing to?',families:['doc'],when:/Terms|Agreement|Licen[cs]e|Policy/i,capture:'frame',prompt:'Read the visible text and list what I am agreeing to: obligations, costs, renewal, cancellation, data use. One line each, quoting the clause. If the important part is off screen, say so.'},
  {id:'claim',label:'Is this claim right?',families:['browser'],capture:'frame',prompt:'Take the main claim visible on this screen. Say in plain terms whether it is well supported by what is shown, what evidence is missing, and what I would need to check. Do not add claims of your own.'},
  {id:'next-here',label:'What do I do next here?',families:['browser','settings'],capture:'frame',prompt:'Look at this screen and tell me the one action that moves me forward, naming the exact button or field. If there are two reasonable choices, name both and the difference.'},
  {id:'check-send',label:'Check before I send',families:['chat','browser','doc'],capture:'frame',prompt:'Read the draft visible on this screen as its recipient would. List up to five things to fix before it goes out: a missing answer, an unclear ask, a wrong date, name or number, a tone that lands badly. Quote each one. If it is fine, say "looks fine" and nothing else.'},
  {id:'draft-reply',label:'Draft a reply',families:['chat'],capture:'frame',prompt:'Draft my reply to the message on this screen. Plain sentences, no filler. Say what I will do and by when. If something is unclear, put one question at the end instead of guessing. Give me the reply text only.'},
  {id:'asking',label:'What are they actually asking?',families:['chat'],capture:'frame',prompt:'Read the message on this screen and tell me in one sentence what the sender actually wants from me, then list any dates, amounts or names I must not miss.'},
  {id:'catch-up',label:'Catch me up',families:['chat','browser'],capture:'frame',prompt:'Summarize this in five bullets or fewer: what was decided, what changed, and who is waiting on me. Then one line: the single thing I should do next. Quote the exact line each claim came from. If the reading looks truncated, say which end you are missing.'},
  {id:'plainly',label:'Say it plainly',families:['browser','chat','doc','code'],capture:'frame',prompt:'Rewrite the text visible on this screen in plain sentences with the same meaning, shorter where possible, no jargon, no filler. Keep names, numbers and dates exactly. Give me the rewrite only.'},
  {id:'numbers',label:'Read the numbers',families:['sheet'],capture:'frame',prompt:'Read the numbers visible on this screen exactly. Tell me the total, the largest and the smallest, and any cell that looks like an error or an outlier. Say exactly which cells you read from. Put [?] where you cannot read a value with confidence.'},
  {id:'formula',label:'What formula do I need?',families:['sheet'],capture:'frame',prompt:'From the selected cell and the visible columns, give me the one formula that does what the labels imply, on one line by itself, then one sentence saying what it does. If the intent is not visible, ask one question instead.'},
  {id:'stands-out',label:'What stands out?',families:['sheet','browser'],capture:'frame',prompt:'Look at this table or chart and tell me the three things that stand out, each in one line, each pointing at the exact row, column or series. No advice.'},
  {id:'dates',label:'Pull out the dates and numbers',families:['doc','chat'],capture:'frame',prompt:'List every date, deadline, amount and reference number visible on this screen, one per line, exactly as written, with the words next to it that say what it is.'},
  {id:'walk',label:'Walk me through it',families:['settings'],capture:'frame',prompt:'This is a settings or setup screen. Tell me what each visible option does in one line each, and which one to choose for the normal case. Say if any option is risky or hard to undo.'},
  {id:'layout',label:"What's off about this layout?",families:['design'],capture:'frame',prompt:'Look at this design and name at most three things that hurt it: alignment, spacing, hierarchy, contrast, or copy. Point at the exact element each time.'},
  {id:'make-real',label:'Make this real',families:['design'],capture:'frame',route:'build',prompt:'Build a working web prototype from this design. Keep the layout and the words you can read.'}
];

// Exact text beats a picture of text for errors, terminals, spreadsheets and settings pages. These chips read the window's accessible
// text first and fall back to a frame when the window exposes none. Browser and document bodies stay on frames (ValuePattern only).
for(const id of ['unstick','safe-click','output','numbers','formula','walk']) CHIPS.find(chip=>chip.id===id).capture='text';
// "Say it plainly" carries the rewrite tone from Settings; {tone} is replaced when the chip is pressed.
CHIPS.find(chip=>chip.id==='plainly').prompt='Here is a draft I wrote. Rewrite it {tone}. Keep every fact and every number exactly. Add no claims. Add no greeting or sign-off I did not write. Return only the rewritten text and nothing else.';
export const TONES={plainer:'in plain sentences, no jargon, no filler',shorter:'shorter, cutting anything that does not carry meaning',warmer:'warmer and more personal without adding claims',firmer:'firmer and more direct without becoming rude'};

// What a chip actually takes for the window in front. Terminals are excluded by the helper's safety filter, and browser, editor, chat
// and design windows expose ribbons rather than bodies, so those families take a frame even for a text-first chip.
const FRAME_ONLY=['terminal','browser','code','chat','design'];
export function captureFor(chip,list=[]){
  if(chip.capture==='text' && list.some(family=>FRAME_ONLY.includes(family))) return 'frame';
  return chip.capture;
}

// Up to three chips for the families in front. The error chip always comes first. Unknown falls back to the three generic starters.
export function chipsFor(list=[],title='') {
  const picked=[];
  const add=chip=>{if(!picked.includes(chip) && (!chip.when || chip.when.test(String(title || '')))) picked.push(chip);};
  for(const family of list) for(const chip of CHIPS) if(chip.families.includes(family)) add(chip);
  const ordered=[...picked.filter(chip=>chip.families.includes('error') && list.includes('error')),...picked.filter(chip=>!(chip.families.includes('error') && list.includes('error')))];
  const out=[];for(const chip of ordered) if(!out.includes(chip)) out.push(chip);
  return out.length?out.slice(0,3):UNKNOWN_CHIPS;
}
