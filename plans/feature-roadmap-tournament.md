# Jarvis feature roadmap: the Deck and what goes with it

Written against the 0.8.1 source on 2026-09-05. Every file, function and line number below was read this session, not taken from the tournament text. Where a judge's claim did not survive a re-read, the correction is stated in place. Effort scale is the one plans/onboarding-review.md already uses: S is hours, M is about a day, L is multiple days, including regression coverage. Bash was blocked by the DashClaw hook for this session, so nothing here was executed; every claim is from reading source.

## A. The killer use case and the product story

An npm install fails in Windows Terminal, or an installer stops on "The operation could not be completed", and the text cannot be selected. Wes presses Ctrl+Shift+Space. The shell already knows which window he came from (`CaptureService.RememberForeground`, desktop/CaptureService.cs:46, refreshed every 250 ms by `foregroundTimer` at desktop/DesktopShell.cs:66 and again inside `SummonPanel` at :107). Today that knowledge is thrown away until he clicks "+ Window". With the Deck, the panel opens with a line reading "In front: Windows Terminal" and three chips under it, the first one "Unstick me" because the title matched `failed|error|cannot`. One click captures that window, shows the frame in the strip that already exists (`setFrame`, public/companion.js:50) with "Include this frame" ticked, and puts the prompt in the box. He reads the frame, presses Send. Back comes one sentence of cause and three steps that each point at something visible on that screen, with a follow-up chip "show me the exact steps" under the reply. Hotkey, chip, Send. Better still, the same moment with one chord: Ctrl+Shift+E summons, captures, prefills the top chip and focuses Send, then stops dead at the frame so he still looks before anything leaves the machine. The current alternative is a screenshot, a browser tab, an upload and a typed paragraph, which is why it usually does not happen.

Three sentences: Jarvis knows which window you were just in and offers the right question as a button before you type anything. Every chip shows you the exact frame or text it will send, and nothing leaves the machine until you press Send on your own subscription. The second question costs one click, and your own questions become your own chips.

## B. Top 10 features, ranked

Tiers: NOW ships in the next release cycle, NEXT the one after, LATER needs a maintainer decision or a prerequisite.

### 1. The Deck: context chips on summon

- Moment: In VS Code with a red squiggle, an Outlook draft, an Excel sheet, a stuck installer. Ctrl+Shift+Space. The user wants the right question already written, not an empty "What are we working on?".
- Trigger: Three or four chips render where the three static starters live today (`[data-start]` buttons inside `#companion-welcome`, public/companion.js:7). A header line "In front: Visual Studio Code" with a "not this one" button that clears back to the generic starters. Chips also re-render after each reply, so the deck is not only a first-message thing.
- Captured and shown: Nothing at summon. Classification is a local table over process name plus title regex: zero pixels, zero model calls, zero network. When a chip is clicked, `capture()` (companion.js:56) runs and the frame lands in `#companion-context` (companion.js:11) with "Include this frame" ticked by `setFrame`. Chips marked `capture:'none'` only fill the box.
- Prompt shape: Each chip is `{id, label, prompt, capture:'frame'|'text'|'none', families:[...]}` in a new public/chips.js. The prompt goes into `#companion-input`; the user can edit it before Send. Family library is in section C.
- Reply and landing: An ordinary companion message through the unchanged `/api/chat` to `Assistant.chat` (lib/assistant.mjs:35). No transport change, no new endpoint.
- Why only Jarvis: A browser extension sees one tab. A web chat sees nothing. Jarvis is told by the OS which window was in front at the instant of the hotkey, uses it only to pick the words on a button, and still shows the frame before anything leaves the machine.
- Effort: M. Tier: NOW.
- Code touchpoints:
  - desktop/CaptureService.cs: `RememberForeground` (:46) stores `target`, `targetProcessId`, `targetTitle`, `targetSeenAt` (:22-25). Add `targetProcessName`, looked up with `Process.GetProcessById(processId).ProcessName` only when `processId` changes (the timer fires every 250 ms; do not open a Process handle every tick). Add a `DescribeForeground()` accessor returning title and process name under the same `sync` lock. Grep confirms `ProcessName` appears nowhere in desktop/ today; the only use in the repo is scripts/Computer.cs:43.
  - desktop/DesktopShell.cs: the host-ready dictionary is built in two places, `NavigationCompleted` (:99) and `SetMode` (:264), and carries only `type` and `mode`. Add `front:{title,process}` to both. `SummonPanel` (:106) already calls `capture.RememberForeground()` before `SetMode("panel")`, so the payload is fresh on every summon.
  - public/companion.js: the `host-ready` handler (:128) currently calls `showMode` and `render`. Add `setFront(data.front)`, which classifies and renders the deck. The `[data-start]` loop (:124) becomes the deck renderer. `render()` (:29) gains the "In front" line. The `clear` handler (:119) resets to the generic starters.
  - New public/chips.js exporting `families(process,title)` and `chipsFor(familyList)`. server.mjs `assets` map (:15-21) must list `/chips.js`, and scripts/check.mjs must see it; both are one line each.
- Correction to the tournament text: Electron apps do not "all look like Chrome". Code.exe, ms-teams.exe, slack.exe and Discord.exe have distinct process names. The real ambiguity is a web app inside a browser (Gmail in Chrome), where only the title carries the signal. That is why the title regex exists and why "not this one" must be visible.

### 2. Unstick me (with list rendering)

- Moment: A modal error, a failed build log, an installer that stopped, a greyed-out button. The text is not selectable and retyping it is the reason the user gives up.
- Trigger: First chip whenever the title matches `error|failed|exception|cannot|denied|unable|not responding`, and a standing chip in the Code, Terminal and Installer families. Also the default target of the Ctrl+Shift+E chord (feature 6).
- Captured and shown: One frame of that window in `#companion-context` with "Include this frame" ticked. When feature 9 exists, exact window text instead, because JPEG at quality 82 (`CaptureService.Encode`, :137) loses small dialog type and a misread digit ruins the answer.
- Prompt shape: "Read this error exactly as shown. Name the single most likely cause in one sentence. Then give at most three concrete next steps I can do from this screen, each one referencing something visible. If the screen does not contain enough to be sure, say what to look at next instead of guessing. No general troubleshooting advice."
- Reply and landing: Inline in the transcript. `addMessage` (companion.js:42-49) produces one `<p>` via `textContent`. Add a splitter: when the reply has two or more lines starting with `1.`, `2.` or `- `, render them as `<ol>`/`<ul>` with `<li>` set by `textContent`. No Markdown parser. The system prompt at lib/assistant.mjs:50 says "plain text without Markdown markers", so numbered lines are the only structure the model is allowed to use, and that is enough.
- Why only Jarvis: The error is a native modal on your desktop. No URL to paste, no text to select. Jarvis reads it where it is, shows you what it read, and answers through your own account.
- Effort: S. Tier: NOW.
- Code touchpoints: public/chips.js (prompt text); public/companion.js `addMessage` (:42) for list rendering; no server change.

### 3. Check before I send

- Moment: A Reddit post, a client email, a PR description, a form with a payment amount. Finger over the button, doubt unspecific.
- Trigger: Chip in the Browser, Email and Chat families. Ranked first when the title contains `Reply|Compose|New message|Draft|Pull Request|Comment`.
- Captured and shown: One frame, shown as always. Exact text when feature 9 exists.
- Prompt shape: "I am about to send this. Do not rewrite it. List only concrete problems visible on this screen: a wrong or missing recipient, a number that contradicts another number, link text that does not match where it says it goes, a claim I have not supported, a placeholder I forgot to replace, a tone that will read worse than I intend. At most five items, one line each, each pointing at something visible. If it looks fine, say so in one line and stop."
- Reply and landing: A short list inline (feature 2's renderer), plus a follow-up chip "Fix the wording" that fills the box with the Say it plainly prompt and reuses the attached frame without a new capture.
- Why only Jarvis: It works on whatever app the draft lives in, Outlook, a browser textarea, Word, a native invoicing app, and it is read-only by construction: it never sends, posts or touches the thing it is checking. This is the one Wes will notice most, because today it costs a whole context switch and usually does not happen at all.
- Effort: S. Tier: NOW.
- Code touchpoints: public/chips.js; public/companion.js `submit` (:80-100) where the reply node is built; no server change.

### 4. Follow-ups: the second question costs one click

- Moment: Jarvis just said what the error is. The obvious next question is "show me the exact steps", and typing it is what ends the session.
- Trigger: Up to three chips directly under the reply, in the place the "Continue in workbench" button is already appended (companion.js:93-96).
- Captured and shown: Nothing new. A follow-up reuses the attached frame only if it is still attached and ticked, and the chip says "(with frame)" when it will.
- Prompt shape: The model supplies them. `conversationSchema` (lib/assistant.mjs:5-10) gains `followUps:{type:'array',items:{type:'string'}}`. Put it in `required` too: the schema is passed to Codex through `--output-schema` (lib/subscription.mjs:120) and to Claude through `--json-schema` (lib/claude.mjs:79), and a required-but-empty array is safer across both than an optional property under `additionalProperties:false`. One sentence added to the system prompt after line 50: "Also return up to three short follow-ups the user is most likely to want next, each under 60 characters, phrased as the user would say them, or an empty array."
- Reply and landing: Validate beside the existing checks at lib/assistant.mjs:53-56: `Array.isArray(result.followUps) ? result.followUps.filter(s=>typeof s==='string'&&s.trim()).slice(0,3).map(s=>s.slice(0,60)) : []`. Client: clicking one fills `#companion-input` and calls `submit()` when `#companion-consent` is ticked, otherwise fills and focuses.
- Why only Jarvis: Not exotic, but it multiplies every other feature for one schema field and one sentence.
- Effort: S. Tier: NOW.
- Code touchpoints: lib/assistant.mjs `conversationSchema` (:5), system prompt (:47-50), result validation (:53-56); public/companion.js `submit` (:92-96); scripts/verify-assistant.mjs (the synthetic `generate` at :15-23 returns `{reply,suggestion}` and must add `followUps` or the validator's fallback is what gets tested, which is fine but should be deliberate); scripts/verify-companion.mjs synthetic inference (:9-13) likewise.

### 5. See exactly what goes, plus the session ledger

- Moment: A chip just made sending one click. Wes, or anyone, asks "what does it actually send?" The sharing checkbox at companion.js:14 is a sentence; this makes it a window.
- Trigger: The sharing label gains a "See exactly what goes" link. The status string in the footer (`render`, companion.js:38) becomes a button that opens the ledger.
- Captured and shown: The preview renders the literal request body that `submit()` assembles at companion.js:89: `instruction`, the up-to-12 history entries with their 2,000-character truncation visible (`history.push(... .slice(0,2000))` at :91), `contextLabel`, the image as a thumbnail with its byte size against the 4,500,000-character cap in `parseImage` (lib/vision.mjs:9), and the `model` and `effort` that `api()` injects in public/app.js:89. Plus a fixed line of what is not in it: no other windows, no audio, no files, no clipboard, no memory beyond these messages. No model call.
- Reply and landing: The ledger is a session-only array in companion.js: for each send, time, frame label or "no frame", window-text character count or "no text", model, effort, remaining allowance. Every value is already in the response: server.mjs:147 spreads `assistant.chat`'s result, which carries `model`, `effort`, `provider` and `tokens` from `infer` (lib/subscription.mjs:163, lib/claude.mjs:99), plus `remaining`. `submit()` reads only `result.result.reply` and `result.result.suggestion` today. Session-only keeps docs/DECISIONS.md:5 ("history is bounded to the active session") and the assertion at scripts/verify-companion.mjs:37 true.
- Why only Jarvis: This is the consent artifact that makes one-click chips defensible, and it is the cheapest thing in the whole tournament.
- Effort: S. Tier: NOW.
- Code touchpoints: public/companion.js markup (:14-15), `render` (:38-39), `submit` (:89-92); no server change.

### 6. Ctrl+Shift+E: the quick-ask chord

- Moment: The Unstick moment with the fewest keystrokes. One chord summons, captures the window you were in, prefills the deck's first chip and focuses Send, then stops at consent.
- Trigger: A second `RegisterHotKey` beside the existing one. `OnHandleCreated` (desktop/DesktopShell.cs:122-125) registers exactly one combo, `HotkeyId = 0x4A41` with `ModControl|ModShift` and `VkSpace`. Add `QuickAskHotkeyId = 0x4A43`, VK 0x45 (E). scripts/verify-desktop-host.ps1:52 already probes id 0x4A42 to prove Ctrl+Shift+Space is taken; use 0x4A43 in the shell so the probe's id stays unambiguous, and extend the probe to assert Ctrl+Shift+E is taken too.
- Captured and shown: The shell calls `SummonPanel()` then `Post({type:'quick-ask'})`. The panel is in `panel` mode before the capture request arrives, which matters because `BeginCapture` (:215, :219) silently drops results when `mode == "dock"`. The client handler runs `capture()` and fills the first chip's prompt. The frame is shown, Include is ticked, Send is focused. Send is never pressed by the chord.
- Prompt shape: Whatever chip the deck ranked first for the window in front, so it is "the right question, one key" rather than a fixed error prompt.
- Reply and landing: Same as the chip it fired.
- Why only Jarvis: A global chord that fires against the window you were just in, with the frame shown and the human still pressing Send. This keeps PRODUCT.md's "every frame is chosen and shown" intact.
- Effort: S (but it is a desktop/*.cs change, which `npm test` does not cover; see section F). Tier: NOW.
- Code touchpoints: desktop/DesktopShell.cs `OnHandleCreated` (:122), `OnHandleDestroyed` (:127), `WndProc` (:133-139), a `HotkeyAvailable`-style property for the second chord so a failed registration is visible in Settings, `Post` (:279); public/companion.js native listener (:125-132); scripts/verify-desktop-host.ps1.
- Do not build the Prompt Book's nine hotkeys (ids 0x4A42..0x4A4A). One chord, proven, before any more.

### 7. Say it plainly, with Copy

- Moment: A Reddit compose box, a client email, a PR description. The draft is written and reads like a robot wrote it.
- Trigger: Chip in Browser, Email, Chat and Editor families. A four-button tone row under it: Plainer, Shorter, Warmer, Firmer. Default Plainer, remembered in localStorage beside `jarvisModelPreferences` (public/app.js:20, :596).
- Captured and shown: One frame, or exact text when feature 9 exists, because the model must not invent phrasing the user never wrote.
- Prompt shape: "Here is a draft I wrote. Rewrite it {tone}. Keep every fact and every number exactly. Add no claims. Add no greeting or sign-off I did not write. Return only the rewritten text and nothing else."
- Reply and landing: The rewrite in a bordered block with a Copy button. This is the first clipboard code in the repo: a grep for `Clipboard|clipboard|writeText|execCommand` across the repo returns no matches. Shape: a `copy` branch in `OnWebMessageReceived` (desktop/DesktopShell.cs:165-195) beside the `speak` branch (:184-188), same 8,000-character cap `TrySpeak` uses, calling `Clipboard.SetText` on the UI thread; browser fallback `navigator.clipboard.writeText`. Write only. Clipboard read is never added, because it would make "screen & mic off" (companion.js:38) untrue.
- Not in this feature: "Replace it in the app" through Computer mode. `commandText` at scripts/Computer.cs:29 contains `[\r\n]`, so a multi-paragraph draft physically cannot pass the type broker, and the runner-up's reason is correct: Jarvis should not be near a Send button. The clipboard, pressed by the human, is the destination.
- Why only Jarvis: The draft never leaves the machine except through your own subscription, and the result lands on the Windows clipboard rather than in a web app you have to tab to and re-copy from.
- Effort: M. Tier: NEXT.
- Code touchpoints: public/chips.js; public/companion.js `addMessage` (:42) copy block; desktop/DesktopShell.cs `OnWebMessageReceived` (:165); no server change and no schema change (the chip knows it asked for a rewrite; a Copy button on that reply is enough, so the runner-up's `copy` schema field is not needed yet).

### 8. Computer mode honesty pair: "Show me it worked" and "Refuse before the spend"

Two defect fixes from the Worklist candidate, both zero model calls. They are ranked here because chips will route people into Computer mode more often, and the surface must not lie.

Show me it worked:
- Today `approve` (lib/computer.mjs:119-126) pushes `result:'Windows accepted the action; inspect the next snapshot to verify the outcome.'` into `this.history` (:124) whether the field changed, silently failed or landed in the wrong control, and public/computer.js:104 logs "Windows accepted the action." That fabricated string is fed back to the planner as observed history (:107, `history:this.history.slice(-10)`).
- Fix: in `propose`, keep the pre-action snapshot (`this.lastSnapshot=snapshot` after :104). In `approve`, after `this.native.call({op:'act',...})`, call `this.native.call({op:'snapshot',window:action.window})` and diff by element `id`: changed `name`, `value`, `enabled`, `state` (the SHA-256 fingerprint from scripts/Computer.cs:64-71), added and removed ids, and a title change. Push `{...,observed:'nothing changed'}` or `observed:'2 controls changed: Fixture input value changed; title changed'` and return it. Client logs `result.observed`.
- L1 check: approve a `type` action whose text equals the current value; the state hash is identical, `Recheck` passes, and the line must read "nothing changed", not a blank success. scripts/verify-computer-native.mjs already types "Verified desktop input" into the fixture (:29); add a second identical type and assert the observed line.

Refuse before the spend:
- server.mjs:95 runs `if(data.op==='propose'){busy=true;calls++;}` before `computer.handle` runs, and lib/computer.mjs:106 runs `this.steps++` before inference. The native refusal (`denied`, `launcherControl`, `commandText`, `Safe` at scripts/Computer.cs:27-29, :39) only fires at `Act`. So "open a terminal and run the build" costs a real subscription call and an allowance unit to be told no. Note the snapshot at :104 runs before `steps++`, so a protected window already fails before the step, but not before the server's `calls++`.
- Fix: `Windows()` (scripts/Computer.cs:54-58) returns `{windows, hotkey}`; add `rules:{denied,launcher,command}` as the regex source strings so Node never keeps a second copy. In `propose`, after the snapshot and before `this.steps++`, screen the task text against `command` and `denied` and throw a 400 with a plain sentence ("Jarvis will not run commands, open terminals or touch sign-in windows. It can click, type, scroll and press a few keys in the selected window."). Move the server's charge: pass a `charge` callback as a third argument to `computer.handle(data,signal,charge)` and call it immediately before inference, so a locally refused task costs nothing. The same strings render as a standing "Jarvis won't" list in the Computer mode block.
- Effort: S each. Tier: NEXT.
- Code touchpoints: lib/computer.mjs `propose` (:98-118), `approve` (:119-126); scripts/Computer.cs `Windows` (:54); server.mjs (:91-98); public/computer.js `$('approve')` (:101-106), `$('next')` (:86-100); tests/computer.test.mjs fakes must answer a second `snapshot` call after `act`; scripts/verify-computer.mjs; scripts/verify-computer-native.mjs.

### 9. Read it properly: exact window text, shown before it is sent

- Moment: A 60-line stack trace, a table of numbers, a settings page with forty labels, a licence dialog. A frame is a picture of text and the answer comes back subtly wrong.
- Trigger: A "Read text instead" toggle in the frame strip, and the default for the Error, Spreadsheet and Settings families when the window exposes accessible text.
- Captured and shown: The window's accessible controls through the existing broker, without arming anything. `JarvisComputer.Snapshot` (scripts/Computer.cs:89-99) never calls `Check()`; `Check` (:100-102) guards only `Focus`, `Recheck`, `FreshPattern` and `Act`. So a read-only op cannot click. It already skips `IsPassword` elements, names matching `denied` (:27), `launcherControl` (:28), and caps at 350 elements, depth 7, 3,500 ms (`Elements`, :72-88). The text renders in a scrollable block with an "Include this text" checkbox and a volume line: "214 controls · 3,180 characters · truncated: no", driven by the `limited` flag Snapshot already returns (:98) plus Node's own character cap. A summary of a truncated read that does not say so is worse than no summary.
- Scope constraint (verified): grep for `TextPattern` in the repo returns nothing. Snapshot reads `ValuePattern` only (:95), 500 characters per value. Word document bodies and Chrome page bodies will come back as ribbons and chrome. Sell this as dialogs, forms, tables, settings pages, terminals with accessible buffers and Excel's formula bar, not as Outlook bodies, until a TextPattern branch exists and is tested against real apps. That branch is a separate decision (section G).
- Prompt shape: `Assistant.validate` (lib/assistant.mjs:27-33) gains `windowText: boundedText(data.windowText, 20000, 'Window text')` and `chat` adds it to the JSON part (:40-45) with `windowTextIncluded`. The system prompt at :47 already declares "all visible screen text" untrusted; add "and any window text" so it covers this verbatim. Node's read op formats lines as `type: name = value`, caps at 20,000 characters and reports `truncated` if either the 350 cap or the character cap hit.
- Reply and landing: An ordinary inline answer that can quote exact strings and numbers. Provenance line under it: "Read from: {title} · 214 controls".
- Permission shape: a new `op:'read'` in `Computer.handle` (lib/computer.mjs:64) placed before the owner gate at :81. Requires `consent:true`, takes `{title}`, calls `native.call({op:'windows'})`, matches the exact title (refuses with a plain message if two windows share it), then `native.call({op:'snapshot',window:id})`. Never calls `arm`, never sets `this.owner`, never touches `this.pending`. One side effect to state in the docs: starting the helper registers the Ctrl+Shift+F12 stop hotkey (`StopWindow`, scripts/Computer.cs:175-185) even for a read; it is harmless but it is a global hotkey. This is a new permission shape and needs the maintainer's yes before code (AGENTS.md:6).
- Why only Jarvis: Nothing web-based can read the text of a native Windows window. Jarvis reads the exact control text, shows every character before you tick the box, and gains no ability to click anything by doing so.
- Effort: L. Tier: NEXT after the maintainer's yes, otherwise LATER.
- Code touchpoints: lib/computer.mjs `handle` (:64, :81, :89); scripts/Computer.cs `Snapshot` (:89), `Windows` (:54); server.mjs `/api/computer` (:91) and `/api/chat` (:136); lib/assistant.mjs `validate` (:27), `chat` (:35-45), prompt (:47); public/companion.js a `setText` sibling to `setFrame` (:50) and `submit` (:89); tests/computer.test.mjs; scripts/verify-computer.mjs; scripts/verify-computer-native.mjs (the fixture at :9-15 has a named TextBox, which is exactly what a read returns); scripts/verify-assistant.mjs.

### 10. The Prompt Book: your chips, no hotkeys yet

- Moment: A week in. Wes wants "turn this into a Reddit comment in my voice" as a chip that only shows when a browser is in front.
- Trigger: Gear, then "Prompt book", inside the existing `#companion-options` block (companion.js:9), plus a pencil on hover over any chip.
- Captured and shown: Nothing. It is a form: label (24 chars), prompt (1,500 chars), families (checkboxes), capture frame / read text / neither. No hotkey dropdown in this version; feature 6 is the only chord until it has proved itself.
- Prompt shape: The user's text plus a fixed suffix Jarvis appends and shows greyed out under the field: "Answer only from the frame and text I attached. Say so if it is not visible." A user-written prompt cannot accidentally invite invention.
- Reply and landing: No model reply. Saved to localStorage as `jarvisPromptBook`. Export and Import reuse the hidden-file-input pattern at companion.js:122-123. "Restore the built-in chips" resets. This is the "What Jarvis knows" page cut down to the Deck's actual state: the chips, the families, the remembered window title, each with a Forget.
- Why only Jarvis: Prompts you wrote, fired against the window you were just in, on your own subscription, with no server anywhere holding your library.
- Effort: M. Tier: LATER (after two weeks of the built-in deck, so the defaults are informed by which chips Wes actually pressed; the ledger from feature 5 gives that count).
- Code touchpoints: public/companion.js `#companion-options` (:9), import handler (:122-123); public/chips.js defaults and a merge function.

### Held behind the top 10

- Table to rows (runner-up): TSV to the clipboard with `[?]` on unread cells, rows rendered in monospace before copying. Needs feature 7's clipboard bridge. NEXT after 7.
- Try it on Notepad tour (C9): a sequencer over `$('enable')`, `$('launch')`, `windows()`, `$('inspect')`, `$('next')` in public/computer.js with every gate intact, stopping at the sharing tick. Fixes a real onboarding wall. LATER, alongside the UI tournament.
- Keep going (C7 feature 4): after an approval, plan the next action without a second click; lib/computer.mjs untouched, bounded by `steps>=20` and the ten-minute lease. LATER; it belongs with the Computer mode UI pass.
- Check back in 5 (C7 one-shot): one timer, one deferred capture, one turn. Not buildable today: `RememberForeground` overwrites the target every 250 ms, `ValidateTarget` (CaptureService.cs:98) throws when the title changed, and `BeginCapture` drops results in dock mode (:215, :219). It would need a pinned target, which is a new shape. LATER, and the honest ceiling on the time axis: no loops, no watching.
- Not built, said out loud: multi-frame compare (`Vision.generate` passes a single image, lib/vision.mjs:64, and both CLI inputs carry exactly one); model-generated chip suggestions (a model call before the user asked anything); anything that watches a window and tells you when it changed (docs/DECISIONS.md:7); auto-capture on every summon (same line, "keep companion capture explicit").

## C. The quick-action library

Family detection is local, in public/chips.js. Process names are from `Process.ProcessName` (no `.exe`): Code, devenv, idea64, rider64, notepad++, sublime_text (Code); WindowsTerminal, powershell, cmd, conhost (Terminal); chrome, msedge, firefox, brave (Browser); OUTLOOK, olk, ms-teams, Teams, slack, Discord (Email/Chat); EXCEL (Spreadsheet); WINWORD, Acrobat, AcroRd32, SumatraPDF, or a Browser title ending in `.pdf` (Document); Figma, Photoshop, Illustrator, mspaint, Affinity (Design); SystemSettings, msiexec, any title matching `Setup|Install|Settings|Options|Preferences` (Settings/Installer); any title matching `error|failed|exception|cannot|denied|unable|not responding` forces the Error chip into slot one regardless of family. Unknown gets the three current starters minus "Ask about my screen", because every chip captures.

| Chip label | Appears for | Prompt text | Grabs | Output shape |
| --- | --- | --- | --- | --- |
| Unstick me | Error title, Terminal, Installer, Code | Read this error exactly as shown. Name the single most likely cause in one sentence. Then give at most three concrete next steps I can do from this screen, each one referencing something visible. If the screen does not contain enough to be sure, say what to look at next instead of guessing. No general troubleshooting advice. | Frame (text when 9 exists) | One sentence, then a numbered list of up to three |
| What's this error? | Code, Terminal | Find the error or warning on this screen. Quote it exactly. Say what it means in one plain sentence and the one change most likely to fix it. | Frame | Quote, one sentence, one change |
| What does this do? | Code | Explain what the code visible on this screen does, in the order it runs, in plain sentences. Do not rewrite it. If part of it is cut off, say which part. | Frame | Short paragraph |
| Write the commit message | Code (title contains diff, Source Control, git) | Write a commit message for the change visible on this screen. First line under 60 characters, imperative mood. Then at most three lines saying what changed and why, from the diff only. | Frame | Copyable block (feature 7) |
| What should I test? | Code | From the code visible here, list the three cases most likely to break: one normal input, one edge, one failure. One line each, each naming the input and the expected result. | Frame | List of three |
| What does this output mean? | Terminal | Read the terminal output on this screen. Say whether the command succeeded or failed, quote the line that tells you, and say what to do next in one sentence. | Frame | Verdict, quote, one sentence |
| Summarize this page | Browser, Document | Summarize what is visible on this screen in five bullets or fewer: what it is, what it claims, what it wants me to do. Quote the line each bullet came from. If the page continues off screen, say so. | Frame (text when 9 exists) | Bullets with quotes |
| Is this claim right? | Browser | Take the main claim visible on this screen. Say in plain terms whether it is well supported by what is shown, what evidence is missing, and what I would need to check. Do not add claims of your own. | Frame | Three short paragraphs |
| What do I do next here? | Browser, Settings | Look at this screen and tell me the one action that moves me forward, naming the exact button or field. If there are two reasonable choices, name both and the difference. | Frame | One or two lines |
| Check before I send | Browser, Email/Chat, Document | (feature 3 prompt) | Frame (text when 9 exists) | List of up to five, or "looks fine" |
| Say it plainly | Browser, Email/Chat, Document, Code | (feature 7 prompt with {tone}) | Frame (text when 9 exists) | Rewrite block with Copy |
| Draft a reply | Email/Chat | Draft my reply to the message on this screen. Plain sentences, no filler. Say what I will do and by when. If something is unclear, put one question at the end instead of guessing. Give me the reply text only. | Frame (text when 9 exists) | Reply block with Copy |
| What are they actually asking? | Email/Chat | Read the message on this screen and tell me in one sentence what the sender actually wants from me, then list any dates, amounts or names I must not miss. | Frame | One sentence plus a short list |
| Catch me up | Email/Chat, Browser | Summarize this in five bullets or fewer: what was decided, what changed, and who is waiting on me. Then one line: the single thing I should do next. Quote the exact line each claim came from. If the reading looks truncated, say which end you are missing. | Frame (text when 9 exists) | Bullets, then one line |
| Read the numbers | Spreadsheet | Read the numbers visible on this screen exactly. Tell me the total, the largest and the smallest, and any cell that looks like an error or an outlier. Say exactly which cells you read from. Put [?] where you cannot read a value with confidence. | Frame (text when 9 exists) | Short list with cell references |
| What formula do I need? | Spreadsheet | From the selected cell and the visible columns, give me the one formula that does what the labels imply, on one line by itself, then one sentence saying what it does. If the intent is not visible, ask one question instead. | Frame (text when 9 exists) | One formula line with Copy, one sentence |
| What stands out? | Spreadsheet, Browser (dashboard) | Look at this table or chart and tell me the three things that stand out, each in one line, each pointing at the exact row, column or series. No advice. | Frame | Three lines |
| What am I agreeing to? | Document (title contains Terms, Agreement, Licence, License, Policy) | Read the visible text and list what I am agreeing to: obligations, costs, renewal, cancellation, data use. One line each, quoting the clause. If the important part is off screen, say so. | Frame (text when 9 exists) | List with quotes |
| Pull out the dates and numbers | Document, Email/Chat | List every date, deadline, amount and reference number visible on this screen, one per line, exactly as written, with the words next to it that say what it is. | Frame (text when 9 exists) | One-per-line list, copyable |
| Walk me through it | Settings/Installer | This is a settings or setup screen. Tell me what each visible option does in one line each, and which one to choose for the normal case. Say if any option is risky or hard to undo. | Frame (text when 9 exists) | List, one per option |
| Is this safe to click? | Settings/Installer, Error | Look at the buttons on this screen. For the one I am most likely to press, say what it will do and whether it can be undone. If the dialog is asking for a password, permission or payment, say so first. | Frame | Two or three lines |
| What's off about this layout? | Design | Look at this design and name at most three things that hurt it: alignment, spacing, hierarchy, contrast, or copy. Point at the exact element each time. | Frame | Three lines |
| Make this real | Design | (fills the workbench, not the companion: routes through `openWorkflow('build', instruction, evidence)` at public/app.js:658-661 with the frame attached) | Frame | Workbench build |
| What do you think about this? | Unknown (fallback) | What do you think about this? | Frame | Free reply |
| Help me with a task | Unknown (fallback) | Help me finish setting this up. | None | Free reply, may suggest Computer mode |
| Make something together | Unknown (fallback) | Help me build a prototype. | None | Free reply, suggests workbench |

Every chip only fills the box. None sends. Every prompt ends with the model answering from the attached evidence, and the system prompt at lib/assistant.mjs:48 already forbids claiming an action happened.

## D. What to cut, hide or merge

| Change | Where | Reason |
| --- | --- | --- |
| Cut the static starter "Ask about my screen" | public/companion.js:7 | Every chip captures; a chip that only captures is redundant. The other two starters become the Unknown fallback. |
| Hide Model and Effort selects behind an "Advanced" disclosure in the gear, replaced by one line "Astra · medium · change" | public/companion.js:9 | Two dropdowns and five effort levels are the most confusing thing in a 440 px panel whose job is one question. Changing model still clears consent (companion.js:118). No behavior change. |
| Hide "Import a saved HTML prototype" and its migration paragraph in the same disclosure | public/companion.js:9 | A one-time migration control holding permanent space. README.md:41 still documents it; the path stays. |
| Collapse the Computer mode block to one line until enabled, and delete the "01 /", "02 /", "03 /" scaffolding | public/computer.js:11, :17, :24 (and index.html:59, :102 section bars) | PRODUCT.md:25 names numbered scaffolding on non-sequences as an anti-reference. The `<details>` is inserted after `.intro` (computer.js:28) and its content is always built; keeping the summary line only until `owner` is set is pure subtraction. |
| Merge the workbench "TRY SAYING" row and the companion starters into public/chips.js | public/index.html:50 `[data-prompt]`, public/companion.js:7 `[data-start]` | Two prewritten-prompt surfaces is one too many. The workbench row stays rendered where it is, sourced from the Design family. |
| Demote the workbench hero and quick-start (`.intro`, `.quick-start`) to the UI tournament's list, do not cut now | public/index.html:35-40 | Marketing copy inside the product, but the UI tournament owns layout. Note it, leave it. |
| Live build stays where it is | public/live.js, index.html:84-91 | AGENTS.md:7 records it as explicitly approved. Moving it behind a setting is a maintainer decision, not a roadmap cut. |
| Camera sharing stays | index.html:77 | AGENTS.md:7 requires it be preserved alongside screen capture. |
| `/api/observe` is a cut candidate, not a cut | server.mjs:88, :173; public/app.js:89 | No UI call site; PLAYBOOK.md:76 says "retained for explicit diagnostics". Maintainer's call. |

## E. Consent and evidence rules every feature must obey

Each statement is testable and names where the test lives or should live.

1. No chip, chord or follow-up ever calls `/api/chat` without the user pressing Send or Enter in `#companion-input`. Test: scripts/verify-companion.mjs, click every chip and the quick-ask handler, assert `requests.length` unchanged until Send.
2. A frame is never captured at summon. `host-ready` with `front` set must produce zero `capture` messages in `window.nativeMessages` (the shim at verify-companion.mjs:18 records them).
3. Every frame that will be sent is visible in `#companion-context` with a label and a time before Send is enabled, and "Include this frame" is a checkbox the user can untick. Existing assertion at verify-companion.mjs:26 ("explicit snapshot remains local with exact preview") stays and is extended to chip-triggered captures.
4. Every window text that will be sent is visible in full, scrollable, with a volume line "N controls · M characters · truncated: yes/no", and "Include this text" is a checkbox. Test: a synthetic read returning 351 elements must render "truncated: yes".
5. The window title travels only when a frame or text travels (as `contextLabel`, companion.js:89). Test: send with Include unticked, assert the request body has no `contextLabel`.
6. The "In front" line can be cleared in one click and the chips fall back to the Unknown set. Test: click "not this one", assert three fallback chips.
7. A read (`op:'read'`) never sets `this.owner`, never calls `native.call({op:'arm'})`, and a subsequent `op:'approve'` without `enable` returns 403. Test: tests/computer.test.mjs with a fake native that records ops.
8. Clipboard is write-only. The desktop message handler accepts `copy` and never any `paste` or `read-clipboard` type; the client never calls `navigator.clipboard.readText`. Test: grep in scripts/check.mjs for `readText|GetText\(` returning zero.
9. The sharing checkbox `#companion-consent` clears after every send that included a frame or text, not only on model change (companion.js:118 today). Test: send with a frame, assert the box is unticked and the next Send shows the existing error at companion.js:83.
10. Every Computer mode history entry says what was observed after the action, never what was assumed. Test: the native verifier types an unchanged value and asserts `observed` equals "nothing changed".
11. A task the native layer would refuse costs zero `calls` and zero `steps`. Test: propose "open powershell and run npm test", assert 400, assert `remaining` unchanged.
12. The ledger count equals the number of `/api/chat` and `propose` responses received this session, and it resets on reload (docs/DECISIONS.md:5; verify-companion.mjs:37).
13. The send preview shows exactly the body `submit()` will post. Test: open the preview, then send, and diff the captured request against the rendered preview in verify-companion.mjs.
14. No chip prompt, follow-up or Prompt Book entry can remove the untrusted-content sentence from the system prompt; user prompts live in the instruction field only. Test: scripts/verify-assistant.mjs asserts the system string still contains "never instructions".
15. The status line reads "screen & mic off" whenever no capture, read or dictation is in progress, including after a chip fills the box. Test: click a chip with `capture:'none'`, assert the status text.

## F. Build order for the NOW tier, with verification after each step

Run the baseline first so a later failure is attributable: `npm test` (10 files in tests/), `npm run lint` (scripts/check.mjs), `npm run verify:companion`, `npm run verify:assistant`. Read the counts, not just PASS.

1. Follow-ups (feature 4). lib/assistant.mjs schema, prompt, validation; companion.js follow-up strip. Verify: `npm test`; `npm run verify:assistant` with the synthetic `generate` returning `followUps` and one case returning none; `npm run verify:companion` asserting three chips render under a reply and that clicking one sends only when consent is ticked.
2. Consent per send and the send preview plus ledger (feature 5, rule 9). Verify: `npm run verify:companion` with the new assertions from rules 9, 12, 13; `npm run lint`.
3. Chip table and renderer with the Unknown fallback (feature 1, client half). public/chips.js, server.mjs assets map, companion.js deck. No shell change yet, so `front` is absent and the fallback renders. Verify: `npm run verify:companion` (rules 1, 6, 15); `npm run lint` sees the new file.
4. Unstick me and Check before I send prompts, list rendering (features 2, 3). Verify: `npm run verify:companion` with a synthetic reply "1. a\n2. b" asserting an `<ol>` with two `<li>`.
5. Shell: process name and `front` on host-ready (feature 1, native half). desktop/CaptureService.cs and desktop/DesktopShell.cs. Verify: `npm run build:windows`, then `scripts/verify-desktop-host.ps1` and `node scripts/verify-desktop-content.mjs` (needs the packaged exe in .artifacts/windows-0.8.x/); add an assertion that the companion header shows the fixture's title "Jarvis capture verification" after summon. Then a hand check: summon from VS Code, Chrome, Outlook, an error dialog, and confirm the first chip each time. Record the five results in PLAYBOOK.md with the process name each resolved to.
6. Ctrl+Shift+E (feature 6). Verify: extend scripts/verify-desktop-host.ps1 to assert both combos are taken; hand check that the chord from the dock mode ends with a frame shown and Send focused, and that Send was not pressed; hand check that a failed registration shows in Settings.
7. Docs in the same change: README.md "What it does", the privacy dialog at public/index.html:131 (chips, ledger, clipboard write-only when 7 ships), docs/COMPUTER.md when 8 ships, CHANGELOG.md, and the site copy through `npm run build:site` and `npm run verify:site`.
8. Release gate as PLAYBOOK.md already records it: `npm test`, lint, build, verify:companion, verify:assistant, verify:recovery, verify:stream, verify:computer, verify:computer-native, build:windows, verify:windows, verify-desktop-host.ps1, verify-desktop-content.mjs, clean-clone install. Read every count.

Steps 1 through 4 are client and Node only and can ship on their own if the shell work slips; the deck degrades to the fallback chips.

## G. Open decisions for the maintainer

1. Read-only `op:'read'` (feature 9). It is a new permission shape, strictly weaker than the existing one (Snapshot never calls `Check()`), but AGENTS.md:6 requires discussion. Recommendation: approve it with three conditions written into docs/COMPUTER.md: separate one-shot consent, never arms, full text shown with the volume line before Send.
2. TextPattern in scripts/Computer.cs. Without it, "Read it properly" covers dialogs, forms, tables and settings, not Word or Outlook bodies. Recommendation: ship feature 9 without it and word the chips accordingly; add a bounded TextPattern branch only after one manual run each against Word, Outlook and Chrome is recorded in PLAYBOOK.md with control counts.
3. Clipboard write in the shell (feature 7). New host surface. Recommendation: approve, with the written rule that clipboard read is never added, stated in the privacy dialog.
4. Charge timing in server.mjs. Moving `calls++` for `propose` behind the local screen changes when the allowance is charged. Recommendation: approve; charge immediately before inference, which is what `/api/chat` effectively does already (validate at :139, charge at :146).
5. Ctrl+Shift+E as a second global hotkey. Collisions are possible (Ctrl+Shift+E is "Explorer" in VS Code and "Extensions" elsewhere). Recommendation: ship it, show registration failure in Settings, and let the Prompt Book later offer a different key; do not add nine.
6. Hide Model and Effort behind Advanced in the companion. Recommendation: yes; no behavior changes and the workbench selects remain.
7. `/api/observe`. Recommendation: remove it in the same change as the chips (route at server.mjs:88, :173; header list at public/app.js:89; the Playwright stub in scripts/verify-browser.mjs), since it has no UI call site and every chip goes through `/api/chat`. Your call, per PLAYBOOK.md:76.
8. Live build behind a setting. The runner-up wants it; AGENTS.md:7 records it as approved. Recommendation: leave it for the UI tournament; nothing in this roadmap depends on it.
9. The Prompt Book timing. Recommendation: hold it until the ledger has two weeks of chip counts, then seed the defaults from what was actually pressed.

Retro for this pass: reading the files instead of trusting the tournament text caught two things worth keeping: the Electron "everything looks like Chrome" claim is wrong for the apps that matter here, and the protected-window case already fails before the step counter but not before the server's allowance. The one change for the next pass is that any roadmap item touching desktop/*.cs carries a hand-check list in the build order, because `npm test` cannot see it.