# Jarvis 0.9 UI and harness redesign spec

Written against the 0.8.1 tree at commit 7ab8474 on 2026-09-05. Every line number below was read this session from the file it names. Bash was blocked by the DashClaw PreToolUse hook (act_ce507b2e), so no test, lint or verifier ran; the baseline step in section K is the first thing the implementer does. Files read in full: PRODUCT.md, DESIGN.md, AGENTS.md, README.md, PLAYBOOK.md, CHANGELOG.md (head), docs/DECISIONS.md, docs/COMPUTER.md, docs/ERRORS.md, plans/onboarding-review.md, plans/feature-roadmap-tournament.md, public/index.html, app.js, companion.js, companion.css, computer.js, style.css, live.js, storage.js, server.mjs, lib/assistant.mjs, lib/vision.mjs (head), desktop/DesktopShell.cs, desktop/CaptureService.cs, scripts/check.mjs, every scripts/verify-*.mjs except verify-windows.mjs (grepped) and verify-desktop-host.ps1, package.json. Greps: 54 sub-12px declarations in public/*.css (style.css 51, companion.css 3); no test under tests/ references `conversationSchema` or `suggestion`; `jarvis-workbench` is held by server.mjs:66, public/storage.js:1, tests/desktop.test.mjs:12, tests/recovery.test.mjs:21, scripts/start.ps1, scripts/build-site.mjs.

Two things the judges asked for that this spec does differently from the winning candidate, stated up front: the name stays **Computer mode** (no "Hands"; README, docs/COMPUTER.md and the site carry the current name), and the per-send sharing tick is **kept and made stricter** (it clears after every send, in every surface) instead of deleted.

---

## A. The concept

Jarvis is one column that never moves. The 440px companion column (header, transcript, deck of prompt chips, frame strip, compose box, one sharing tick, one status footer with Stop) is the whole product for most moments and stays in identical screen pixels when the studio opens. "Open the studio" widens the window to the left, keeping the window's right edge pinned where the panel was, and puts the prototype builder (an input rail and an output stage, neither of which scrolls the page) beside the column. Computer mode is a card inside the column's conversation, one line until you ask for it, because a per-action approval is a conversation turn. Every setting lives in one dialog opened from either surface. Every outbound request is described by one sentence next to one tick that clears after every send, and "See exactly what goes" shows the literal request body.

**Ten-second stranger test.** A stranger sees a dark column with "What are you working on?", three buttons naming questions ("Unstick me · frame", "Summarize this page · frame", "Help me with a task"), a box to type in, a line reading "Send this message to Astra (your ChatGPT subscription)" with an empty tick, and a footer "Ready · screen & mic off". They can say: it asks an AI about the window you were in, it shows you what it will send, and it is off until you tick and press Send.

---

## B. Information architecture

### Surfaces

One HTML document (public/index.html). Two client surfaces, three native window modes. The wire values `dock | panel | workbench` (DesktopShell.cs:175, :231-260; companion.js:25, :128) do not change.

| Surface | `body[data-surface]` | Native mode | What is on screen |
| --- | --- | --- | --- |
| Dock | (web hidden) | `dock` 76x76 | The mark. Unchanged. |
| Companion | `companion` | `panel` 440x700 | The column alone. |
| Studio | `studio` | `workbench` 1480x900, right edge pinned | The column (right, 440px, unchanged DOM) plus the studio canvas to its left. Below 1180px viewport width the column hides and the canvas toolbar's "← Panel" returns to it. |

`body.companion-mode` (companion.css:1, companion.js:25) becomes `body[data-surface]`. One function sets it: `showSurface(next)` in companion.js (the renamed `showMode`), which still posts `{type:'resize',mode}` with `panel` for companion and `workbench` for studio.

Settings is a `<dialog id="settings">`, not a surface. The send preview is a `<dialog id="send-preview">`. Both open from either surface.

### The companion, before and after

| Region | Today (companion.js:4-16) | After |
| --- | --- | --- |
| Header | mark JARVIS · gear · expand · minimize | Same. Expand titled "Open the studio". Expand hidden while the studio is open. |
| Welcome | 36px h1 + two-sentence paragraph + three starters in the scroll | `#companion-welcome` keeps its `<h1>` (verify-desktop-content.mjs:28 waits on `#companion-welcome h1`) at 20px, text "What are you working on?", no paragraph, no starters. Hidden after the first message. |
| Transcript | YOU / JARVIS eyebrows, one `<p>` | User turn: no label, 1px top rule. Assistant turn: 12px amber "Jarvis". Numbered and bulleted replies render as lists. Follow-up chips under a reply. |
| Computer mode | Not here (lives in the workbench page) | One resting line at the end of the scroll region; expands into the card when enabled. |
| Front line + deck | Not present | Above the compose block: "In front: Visual Studio Code [not this one]" and a one-row chip scroller with take badges. |
| Frame strip | Thumb, label, time, Include tick | Same component (`.frame-strip`), also used in the studio rail. Include clears after every send. |
| Compose | textarea, + Window, Mic, Send | Same, with the send gate (sentence + tick + "See exactly what goes") between the textarea and the tools row. |
| Sharing tick | One fixed sentence, cleared only on model change (:118) | Sentence generated from the payload; cleared after every send. |
| Footer | status span + Stop | status span (computed sentence) + "3 sent" ledger button + Stop. |

### The workbench page, before and after

| Today (index.html) | After |
| --- | --- |
| `.topbar` :29-33 with wordmark, "LOCAL WORKBENCH", status block, New project, sound, Privacy, Setup | 56px `.toolbar`: ← Panel · Studio · Share window · Live build · model button · gear |
| `.intro` hero :35-38 | Deleted |
| `.quick-start` :40 | Deleted (`#try-demo` moves to the stage empty state; `#share-screen-top` deleted) |
| `#setup-panel` :41 | Moved into `<dialog id="settings">` |
| `.model-controls` :43-47 | Moved into settings |
| `.composer-wrap` :49-55 (TRY SAYING, frame-choice, composer, meta, error) | Becomes the top block of the rail: chips from chips.js, `.frame-strip`, composer with gate, `#activity`, error |
| `.workbench` two columns :57-124 with 01/02 section bars, desk-tip, paper composition, eyebrows | `.studio` grid: rail (input) and stage (output), each scrolling itself, no section bars, no eyebrows, no paper composition |
| Dialogs :130-137 | Keep `#live-dialog`, `#reset-dialog`, `#install-dialog`, `#source-dialog`. Delete `#privacy-dialog`, `#consent-dialog`, `#voice-dialog`, `#budget-dialog`. Add `#settings`, `#send-preview`, `#computer-lease`. |

### Deleted outright

Markup: `.topbar` (index.html:29-33) including `.brand-caption`, `.header-middle`, `#sound`, `#privacy`, `#setup-toggle`; `.intro` (:35-38); `.quick-start` (:40) and `#share-screen-top`; `.suggestions` with the "TRY SAYING" span (:50, `[data-prompt]`); both `.section-bar` rows (:59, :102); `.desk-tip` (:98); the `.preview-empty` paper composition, "Less translating. More making.", and `.empty-steps` (:109-113); the "WHAT I'M SEEING" and "THE EVOLUTION" eyebrows (:94, :122); `#privacy-dialog` (:131), `#consent-dialog` (:132), `#voice-dialog` (:133), `#budget-dialog` (:136).

Companion: the welcome paragraph and the three `[data-start]` starters (companion.js:7); `#companion-options` and its children `#companion-model`, `#companion-effort`, `#companion-account`, `#companion-setup` (:9). `#companion-voice`, `#companion-spoken`, `#companion-clear`, `#companion-import`, `#companion-import-file` survive inside the settings dialog with their ids (verify-companion.mjs:31, :33, :35 hold them).

Computer mode: the `<details>` wrapper and summary (computer.js:2-3), the "YOUR DESKTOP / YOUR DECISION" eyebrow and 36px headline (:5), both caveat paragraphs (:6-7), the "01 /", "02 /", "03 /" headings (:11, :17, :24), `#computer-model`, `#computer-effort` (:18), `#computer-setup` (:22).

App state: `state.consent` stays as the internal flag the server contract needs but is set only by the tick or the Live build lease; `state.voiceConsent` and `state.speaking` (app.js:16) deleted.

### Kept because a verifier holds it (grepped, listed in section J)

`#try-demo`, `#example` ("Try a sample sketch" as aria-label), `#connect` ("Connect camera" as aria-label), `#camera-off` ("Turn off"), `#share-screen`, `#screen-stop`, `#include-frame`, `#direction`, `#build` ("Make it real"), `#cancel`, `#activity` (visible at 390px), `#model-choice`, `#effort-choice`, `#faster-effort`, `#billing-note`, `#effort-note`, `#setup-summary`, `#login`, `#recheck`, `#new-session` ("New project"), `#confirm-reset` ("Clear and start fresh"), `#version-label` ("VERSION 01"), `#prototype-title`, `#preview`, `#draft-preview`, `#draft-controls`, `#show-draft`, `#show-working`, `#draft-code`, `#build-phase`, `#build-message`, `#build-overlay`, `#sent-evidence`, `#sent-image`, `#live-controls`, `#live-start`, `#live-pause`, `#live-count`, `#live-confirm`, `#live-consent-detail`, "Keep it local", `#source` ("Source"), `#download` ("Download"), `#source-code`, "Close source", "Desktop preview", "Mobile preview", `#revisions`, `.revision`, `.app-shell`, `#companion`, every `#companion-*` id except the deleted options children, every `#computer-*` id except the four deleted above, `#provider-status` matching `/^Astra · (low|medium|high|xhigh|max)$/`.

Names that must not move: the IndexedDB name `jarvis-workbench` (storage.js:1), `/api/health` `app:'jarvis-workbench'` (server.mjs:66), and package name `jarvis-workbench`. Renaming any of them orphans saved versions or breaks scripts/start.ps1 and two tests.

---

## C. Companion column spec

All markup lives in public/index.html (companion.js and computer.js stop emitting HTML; they query and wire). Region order, top to bottom. Every quoted string is the exact visible text.

### C.1 Header (`.companion-header`)

```
[mark] JARVIS                                   [⚙] [↗] [−]
```
- `#companion-drag` brand button, aria-label "Drag Jarvis window", disabled outside the shell (companion.js:40 rule kept).
- `#companion-settings` aria-label "Settings", opens `#settings`.
- `#companion-expand` aria-label "Open the studio". Hidden when `data-surface="studio"`.
- `#companion-hide` aria-label "Return to dock". Hidden outside the shell.
1px rule under. 56px tall.

### C.2 Scroll region (`.companion-scroll`)

1. `#companion-welcome`: `<h1>What are you working on?</h1>` at 20px/500. Hidden after the first message (companion.js:48 rule kept), shown again by Clear conversation.
2. `#companion-messages` (`<ol>`, aria-live polite, 24-message cap kept).
   - User turn `li.companion-message.user`: 1px top rule, 14px padding, muted ink `#c4c8be`, no label.
   - Assistant turn `li.companion-message.assistant`: `<span>Jarvis</span>` 12px amber, then content.
   - Content rendering in `addMessage`: if the reply has two or more lines matching `^\d+\.\s` render `<ol>`; two or more matching `^-\s` render `<ul>`; each `<li>` by `textContent`; other lines stay `<p>`. No Markdown parser (lib/assistant.mjs:50 forbids markers).
   - Frame evidence: unchanged `<details>` with summary "Frame sent · {label}".
   - Workflow button under a reply when `suggestion` is `build` or `computer`: "Build this in the studio" / "Let Jarvis do this" (`button.companion-workflow`).
   - Follow-up chips (`.companion-followups`, up to three quiet buttons, 1px rule above): label is the follow-up text, plus " · with frame" when the frame is still attached and Include is ticked. Click fills `#companion-input`, focuses the sharing tick. Never sends.
3. `#computer-mode` section (spec in E). Resting state is one line.

### C.3 Front line and deck (`.companion-deck`, above the compose block, always present)

```
In front: Visual Studio Code                       [not this one]
[Unstick me · frame] [What's this error? · frame] [What should I test? · frame]
```
- `#companion-front` renders only when `host-ready` carried `front.title`. `#companion-front-clear` "not this one" clears it and re-renders the unknown-family chips.
- `#companion-chips` is a one-row horizontal scroller (`overflow-x:auto`, `scrollbar-width:thin`), three chips visible at 440px.
- Each chip is `<button class="chip" data-chip="unstick">Unstick me <small>frame</small></button>`. The `<small>` is the take badge: "frame" when `capture:'frame'`, "text" when `capture:'text'` (reserved), nothing when `capture:'none'`. Muted, 12px.
- `#companion-hint` is a one-line muted paragraph above the row; on chip focus or mouseenter it shows the prompt's first sentence; empty otherwise.
- A chip fills `#companion-input` with its prompt and, when `capture:'frame'`, runs `capture()`. It never calls `submit()`.
- Chips come from `chipsFor(families(front.process, front.title))` in public/chips.js. With no `front`, the unknown set renders: "What do you think about this? · frame", "Help me with a task", "Make something together".
- Chips re-render after each reply (same family; the deck does not change on its own).

### C.4 Compose block (`.companion-compose`, `flex-shrink:0`, 1px rule above)

1. `.frame-strip#companion-context` (hidden when no frame):
   ```
   [66x48 thumb]  Poker lobby - Chrome
                  Captured 2:14:07 PM · stays here until you send        [×]
                  [ ] Include this frame
   ```
   `#companion-frame`, `#companion-frame-label`, `#companion-frame-time`, `#companion-include`, `#companion-remove` (aria-label "Remove frame"). After a send that used it, the time line reads "Sent 2:14 PM · not attached" and Include is unticked. Re-ticking re-attaches the same frame.
2. `#companion-error` (role alert).
3. `#companion-form`:
   - `#companion-input` textarea, placeholder "What are we working on?", maxlength 4000.
   - `.send-gate#companion-gate`: `<label><input id="companion-consent" type="checkbox"> <span id="companion-consent-line">Send this message to Astra (your ChatGPT subscription).</span></label>` then `<button type="button" class="quiet" id="companion-preview">See exactly what goes</button>`. When the model is Fable, a second muted line `#companion-billing`: "Fable can use paid usage credits on your Claude account."
   - Tools row: `#companion-capture` "＋ Window", `#companion-mic` "Mic" (aria-label "Dictate locally", aria-pressed), `#companion-send` "Send ↑" (amber).
4. Footer: `<span id="companion-status" role="status">` · `<button id="companion-ledger" class="quiet" hidden>3 sent</button>` (aria-label "See what was sent this session"; hidden at zero) · `<button id="companion-stop">Stop</button>`.

### C.5 Status strings

`#companion-status` is written only by `statusLine(view)` from public/harness.js (section H). Shape: `activity[ · attachment] · sensor`, never more than three segments, footer allowed to wrap to two lines (no ellipsis).

Activity, first match wins:
1. "Listening"
2. "Thinking"
3. "Choosing a frame"
4. "Building · 42s"
5. "Planning the next action"
6. "Live build on · 3 of 10 sent"
7. "Setting up"
8. "Checking connection"
9. "Reconnect in Settings"
10. "Sign in through Settings"
11. "Allowance used · open Settings"
12. "Computer mode on · Ctrl+Shift+F12 stops it"
13. "Ready"

Attachment, only with "Ready": "1 frame attached".

Sensor, computed from live state, never from a literal at a call site: dictation running → "mic on (local)"; `state.stream` with `captureKind==='screen'` → "screen shared (local preview)"; `state.stream` otherwise → "camera on (local preview)"; else "screen & mic off".

Examples: "Ready · screen & mic off", "Ready · 1 frame attached · screen & mic off", "Thinking · screen & mic off", "Listening · mic on (local)", "Building · 42s · screen shared (local preview)". This fixes companion.js:39, where "Ready · selected snapshot only" overwrites the promise the moment a frame is attached.

### C.6 Keyboard flow

Tab order in the column: drag, settings, expand, hide; transcript buttons in document order; "not this one"; chips; Include, Remove; textarea; sharing tick; See exactly what goes; + Window; Mic; Send; ledger; Stop. Enter in the textarea sends (Shift+Enter newline); Enter on the focused sharing tick also calls `submit()` so the refusal-then-tick path is Enter, Space, Enter. Escape closes any open dialog. Ctrl+Shift+Space summons (shell). Ctrl+Shift+E quick-ask (shell, section H.7). Ctrl+Shift+F12 stops Computer mode (native helper, unchanged).

### C.7 Where the NOW-tier features sit

| Feature | Where |
| --- | --- |
| Deck | C.3, above the compose block, always present |
| Follow-up chips | C.2 under each assistant reply |
| Send preview | `#send-preview` dialog from "See exactly what goes" in all three gates |
| Ledger | Second half of `#send-preview`; opened from the footer "3 sent" button |
| Quick-ask | Shell posts `{type:'quick-ask'}` after `SummonPanel()`; client runs `capture()`, fills the first chip's prompt, focuses the sharing tick. Never sends. |
| Model/Effort behind Advanced | Settings dialog, section F |
| Computer mode collapsed | C.2 item 3, one line until enabled |
| One prompt source | public/chips.js feeds the deck and the studio rail |

---

## D. Studio spec

### D.1 Grid

```css
body[data-surface=studio]{display:grid;grid-template-columns:minmax(0,1fr) 440px;height:100dvh;overflow:hidden}
body[data-surface=studio] #companion{border-left:1px solid var(--line)}
.app-shell{display:grid;grid-template-rows:56px minmax(0,1fr);height:100dvh;padding:0 28px 0 40px}
.studio{display:grid;grid-template-columns:minmax(340px,400px) minmax(0,1fr);overflow:hidden}
.rail{overflow:auto;border-right:1px solid var(--line);padding:20px 24px 40px 0}
.stage{overflow:auto;padding:20px 0 40px 24px;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto}
.preview-stage{height:100%}
@media(max-width:1180px){body[data-surface=studio]{grid-template-columns:1fr} body[data-surface=studio] #companion{display:none}}
@media(max-width:1100px){.studio{grid-template-columns:minmax(300px,340px) minmax(0,1fr)} .app-shell{padding:0 24px}}
@media(max-width:900px){body[data-surface=studio],.app-shell{height:auto;overflow:visible} .studio{grid-template-columns:1fr;overflow:visible} .rail{border-right:0;border-bottom:1px solid var(--line);padding-right:0} .stage{overflow:visible;grid-template-rows:none;padding-left:0} .preview-stage{height:435px}}
```
The page does not scroll above 900px; each pane scrolls itself. Below 900px it degrades to normal page scroll, which keeps the 390px no-horizontal-overflow assertions true (verify-browser.mjs:72, verify-recovery.mjs:72, verify-computer.mjs:27, verify-live.mjs:50, verify-stream.mjs:37, verify-models.mjs:40). `.app-shell` stays the studio root class (verify-companion.mjs:23, :29 assert its visibility).

### D.2 Toolbar (row 1, 56px, 1px bottom rule)

```
[← Panel]  Studio ................ [Share window] [Live build] [● Astra · medium ▾] [⚙]
```
- `#companion-back` "← Panel" (id kept: verify-desktop-content.mjs:41, verify-companion.mjs:30-36). Posts `panel`.
- "Studio" is a plain 14px label, not a second wordmark; the brand is the column header beside it.
- `#share-screen` "Share window" (id kept for verify-live.mjs:31, :64, :69). Amber while nothing is shared, secondary once sharing.
- `#live-start` "Live build" and `#live-pause` "Live 3 / 10 · Pause" (ids kept; `#live-count` keeps its id inside the pause label and its text `"3 / 10 builds"` for verify-live.mjs:36, :57, :74). `#live-start` is disabled until a screen is shared (updateControls :127 rule kept).
- `#model-menu` button: `<span class="status-dot" id="provider-dot"></span><span id="provider-status">Astra · medium</span><span aria-hidden="true">▾</span>`. The caret sits outside `#provider-status` so verify-browser.mjs:20 and :78 still match. Click opens `#settings`.
- `#settings-open` "⚙" aria-label "Settings".
No Stop in the toolbar. The column footer's Stop is the global Stop and sits in the same pixel in both surfaces; `#cancel` "Cancel" stays in the build strip (verify-stream.mjs:39, verify-recovery.mjs:79) and Pause stays in live controls, so a Stop is visible whenever something runs even when the column is hidden below 1180px.

### D.3 Rail (input), blocks separated by 1px rules, no cards

The composer block goes first so `#build` is always above the fold (verify-recovery.mjs:25 asserts its y < 1000; plans/onboarding-review.md P2 filed the composer below the fold as a defect).

a. Chips row: the three Design chips from `DESIGN_CHIPS` in chips.js, labels "Build this." "Change it to this." "Make it work on mobile.", no badge (they only fill `#direction`). No "TRY SAYING" label.
b. `.frame-strip` without the thumbnail (the viewfinder below is the preview): `[ ] Include this frame` `#include-frame` then `#frame-choice-note`: "Sample sketch · 2:14 PM" / "One screen frame will be chosen" / "No frame yet".
c. `#composer` form: `#mic` (aria-label "Dictate direction"), `#direction` textarea (placeholder unchanged), then `.send-gate#build-gate`: `<input id="build-consent" type="checkbox"> <span id="build-consent-line">`, `#build-preview` "See exactly what goes", `#build-billing` (Fable only, same sentence as the companion), then `#build` "Make it real →" (amber, label unchanged). When `state.live` is true the tick and line are replaced by the Live sentence in G.
d. `#activity`: "Ready" / "Fable 5.1 · medium · 42s" while building / "Version 03 ready". Never `display:none` at any width (delete style.css:202 `#activity{display:none}` and :245).
e. `#error` banner with `#error-text`, `#reconnect`, `#dismiss-error`, unchanged.
f. `#viewfinder` unchanged ids (`#camera`, `#reference`, `#annotations`, `.viewfinder-corners`, `#frame-label`, `#frame-tools` with `#resume` "Back to live view" and `#clear-reference` "Clear image", `.scan-line`). Empty copy: h2 "Share the window you're designing in." p "Camera and image upload work too." `.local-note` "Preview stays on this device."
g. `#source-status` caption under the viewfinder (sentence case): "Camera off" / "Camera on · local only" / "Screen shared · local preview" / "Selected frame" / "Saved frame · not sharing" / "Live build on · screen shared".
h. Source row, quiet buttons: `#connect` "Camera" (aria-label "Connect camera"), `#upload` "Upload", `#example` "Sample sketch" (aria-label "Try a sample sketch"), hidden `#file`. `#camera-controls` (`#camera-select`, `#camera-off` "Turn off") unchanged, hidden until a camera is on.
i. `#live-controls` unchanged ids and behaviour (renders once a screen is shared), copy trimmed to: strong "Live build", `#live-count`, one sentence "After 3 quiet seconds Jarvis sends one changed snapshot and updates the prototype.", the interval select, `#live-pause`, `#screen-stop` "Stop sharing", `#live-status`. (`#live-start` is in the toolbar; keep a second `#live-start`? No: one id. The toolbar button is the only `#live-start`.)
j. Observations: `#observation-time` "No frame sent yet" / "From the frame sent at 2:14 PM", `#observation-summary`, `#observations`. No eyebrow.
k. `#sent-evidence` details, summary `#sent-label` "Last frame sent · 2:14 PM · Fable 5.1", `#sent-image`.

### D.4 Stage (output), four grid rows

1. `#build-overlay` build strip, ids unchanged (`#build-phase`, `#build-message`, `#build-detail`, `#build-elapsed`, `#cancel`). Phase strings become sentence case: "Connecting to your subscription", "Waiting for model output", "Code arriving", "Reading and building", "Revising your application", "Building your application", "Source ready".
2. `.prototype`: `.browser-bar` keeps the dots, `#prototype-title`, `#version-label` ("VERSION 01" kept; "READY WHEN YOU ARE" becomes "No version yet", "SOURCE AVAILABLE" becomes "Source available"), and now also `#desktop-view` "Desktop", `#mobile-view` "Mobile", `#expand`. `#draft-controls` unchanged. `#preview-stage` at 100% height holds `#preview-empty`, `#draft-preview`, `#preview`. Empty state: "Your prototype will run here." `[Try the working example]` (`#try-demo`) "Sample data. No login or camera needed." `.prototype-footer` keeps `#preview-note`, `#retry-preview`, `#source` "Source", `#download` "Download".
3. `.reply`: mark, byline "Jarvis" + `#reply-status`, `#reply-text`, `#changes`.
4. Versions row: left `#revision-count`, right `#new-session` "New project" (quiet; moved here so verify-browser.mjs:74 and verify-recovery.mjs:37 need no dialog), then `#revisions`. `#reset-dialog` kept.

### D.5 Copy kept / deleted

Kept: "Make it real", "Try the working example", "Try a sample sketch" (as aria-label), "Connect camera" (as aria-label), "Turn off", "Stop sharing", "Keep it local" / "Allow automatic builds" in the live dialog, "Start a new project?" dialog, "VERSION 01", "Source", "Download", "Interactive prototype · resets when reopened", "Working example · sample data · not a new AI build", "Your first version starts with an idea."

Deleted: "Share your screen. Build as you draw." and both intro lines; "Choose a window, describe the product, then turn on Live build."; "TRY SAYING"; "01 YOUR DESK"; "02 THE WORK TAKES SHAPE"; "THE DESK-TO-DEMO LOOP ..."; "FROM SKETCH TO PROTOTYPE"; "Less translating. More making."; "Your reference becomes a working web prototype ..."; the 1/2/3 empty steps; "WHAT I'M SEEING"; "THE EVOLUTION"; "IDEAS WELCOME" / "WORKING ON YOUR IDEA" / "READY FOR THE NEXT CHANGE"; "LOCAL WORKBENCH"; "Let me see your idea."; every uppercase frame label ("SAMPLE SKETCH · NOT YOUR CAMERA" becomes "Sample sketch · not your camera", "UPLOADED REFERENCE · LOCAL" becomes "Uploaded · local", "SCREEN SNAPSHOT" / "CHOSEN FRAME" become "Screen snapshot" / "Chosen frame", "SAVED REFERENCE" becomes "Saved reference").

---

## E. Computer mode in the column

### E.1 Mount and initialization

`<section id="computer-mode" class="computer-mode">` lives in index.html at the end of `.companion-scroll`, after `#companion-messages`. computer.js queries it (`document.getElementById('computer-mode')`) instead of building it (computer.js:2-28). The `#computer-*` id namespace is preserved except `#computer-model`, `#computer-effort`, `#computer-setup`. Because the markup is static, the app.js:650/:656 order no longer matters; keep one comment at app.js:650 saying the Computer card lives inside `#companion` in index.html so any future companion-created host would need `initCompanion` first.

`initComputer({api,getSelection,onState})`: `getSelection` (app.js:650) is the one model choice; `onState` is called whenever `owner` or `busy` changes so `statusLine` can render activity 5 and 12. `openSetup` is deleted.

### E.2 Resting state (always present, one line)

```
Computer mode · Jarvis works in one Windows app, one approved action at a time.   [Set it up]
```
`#computer-open` "Set it up" opens `#computer-lease`. `openWorkflow('computer', instruction)` fills `#computer-task`, scrolls the card into view and focuses `#computer-open`. No surface change.

### E.3 The lease (rank 2 modal, `<dialog id="computer-lease">`)

- h2 "Let Jarvis act in one Windows app?"
- "For the next 10 minutes Jarvis can read one window you choose and propose one action at a time. Nothing runs until you approve it, every time."
- "Accessible controls only. No terminals, no Explorer, no sign-in windows, no admin prompts, no drawing canvas."
- "Ctrl+Shift+F12 stops it from any app. Stop prevents the next action; it cannot undo one already delivered."
- `<label><input id="computer-permission" type="checkbox"> Allow local window inspection and reviewed control for 10 minutes.</label>` (id and semantics unchanged; `#computer-permission` onchange still stops the session when unticked, computer.js:73)
- `<p id="computer-lease-note" role="alert">` for the refusal "Allow local window inspection before enabling Computer mode." (text kept for verify-computer.mjs:18)
- `[Not now]` (`data-close="computer-lease"`) `[Start 10 minutes]` (`#computer-enable`, id kept)
The lease authorizes local reading only. No model request happens under it.

### E.4 After enable (`#computer-work`, single column)

```
Window   [select #computer-window ▾]   [Refresh] [Read this window]
Open an app  [select #computer-app ▾]  [Open]
▸ What Jarvis read                                (details > pre#computer-snapshot)
What should Jarvis do?
[textarea #computer-task]
[ ] Send this task and a fresh reading of {window title} to Fable 5.1 (your Claude subscription).   See exactly what goes
[Plan next action]                                (#computer-next, amber)
Each step uses one model request. Up to 20 per session.
#computer-status (role=status)
▸ Action history · 0 actions                      (#computer-history, #computer-count)
[Stop computer control]                           (#computer-stop)
```
- `#computer-refresh` "Refresh", `#computer-inspect` "Read this window", `#computer-launch` "Open".
- The tick is `#computer-cloud` (id kept for verify-computer.mjs:23 and verify-computer-live.mjs:18) rendered by the shared send gate (`.send-gate#computer-gate`, `#computer-consent-line`, `#computer-preview`, `#computer-billing`). It clears after every Plan next action and on window change (computer.js:75 rule kept). `gate()` refusal when unticked: "Tick the sharing line above Plan next action first." (replaces "Review the sharing notice and allow this model request first.", computer.js:87).
- The propose body (computer.js:91) reads `model`/`effort` from `getSelection()`.
- `#computer-count` is written by one function `count()` → "N actions" (fixes computer.js:39 "entries" vs :62 "actions").

### E.5 Approval card (`#computer-review`, unchanged logic)

- `#computer-action-title` "CLICK · Seven" (uppercase kind, under four words) or "Model report".
- `#computer-reason`.
- `#computer-action-detail` as a `<dl>`: Window / Control / Type / Parent / Automation ID / Reference, plus "Replace entire value with:" for `type` and "Shortcut" for `key`. verify-computer-live.mjs:29 matches `/Replace entire value with:\nVerified desktop input$/` on textContent; keep `<dt>Replace entire value with:</dt><dd>` on adjacent lines with a newline between them or use `<pre>` for that one field; simplest: keep `<pre>` for the whole detail block. Decision: keep `<pre>`.
- `#computer-expiry`: "This approval expires in one minute. Check the target before you approve."
- `#computer-approve` "Approve", `#computer-reject` "Reject".
- After approve, status: "Delivered. Plan the next action to see what changed."
- Stop: `#computer-stop` "Stop computer control"; status "Computer control is stopped. Anything already delivered stays done." The column footer Stop calls it (app.js:657 already clicks `#computer-stop`).

---

## F. The one settings dialog (`<dialog id="settings">`)

Opened by `#companion-settings`, `#settings-open`, `#model-menu`. Closed by `#settings-close` "Back" or Escape. Four sections separated by 1px rules, no tabs. Order:

**Model**
- `<label>Model <select id="model-choice">` Astra · ChatGPT / Fable 5.1 · Claude
- `#billing-note`: "Astra uses your ChatGPT subscription." / "Fable can use paid usage credits on your Claude account." (verify-models.mjs:28 matches `/usage credits/i`)
- `#setup-summary`: "ChatGPT connected" / "Action needed" / "Reconnect needed"
- `<ol id="setup-checks">` with `#cli-check`, `#login-check`, `#model-check`, strings unchanged (app.js:575-576)
- `#setup-message` (role status)
- `#install-codex`, `#login`, `#recheck` "Check again", `#cancel-setup`, `#setup-help` link, `#setup-detail`. All ids unchanged; `#install-dialog` kept.

**Advanced** (`<details id="advanced">`)
- `<label>Effort <select id="effort-choice">` + `#effort-note` (one sentence: "{note} Applies to your next request.") + `#faster-effort` "Use low effort".
- `[ ] Allow local Windows dictation when I click the microphone.` `#companion-voice`
- `[ ] Read replies aloud with a local Windows voice.` `#companion-spoken`
- `[Import a saved HTML prototype]` `#companion-import` + `#companion-import-file`, one line under: "Download the prototype from the browser version, then import its HTML here."
- `#budget` "58 local requests left · your subscription limits still apply" and `#reset-budget` "Start new allowance", two-step: first press relabels to "Confirm: reset the local counter", second press posts `/api/reset-budget`; any other click resets the label. `#budget-dialog` deleted.
- `[Clear conversation]` `#companion-clear`

**What leaves this device** (six sentences replacing `#privacy-dialog`)
1. "Nothing is captured until you press ＋ Window, Share window or Camera. Jarvis never watches the screen and never listens on its own."
2. "A frame goes only while its Include box is ticked, and the box clears after every send. The sharing tick clears after every send too."
3. "Your message, up to 12 recent messages from this session, and the frame go to Astra through Codex on your ChatGPT subscription, or to Fable 5.1 through Claude Code on your Claude subscription. There is no API key and no fallback model."
4. "Computer mode sends the chosen window's accessible text, your task and recent actions when you press Plan next action, after its own tick. No screenshot, no audio. You approve every action, and Ctrl+Shift+F12 stops it from any app."
5. "Prototypes and their reference images are saved on this device, up to 12 versions. New project clears them. Generated pages run with no network access."
6. "Live build sends changed snapshots automatically after its own permission, up to 10 per start, and never resumes after a reload."
Then `[See exactly what goes]`.

**Footer**
"Jarvis runs on your own ChatGPT or Claude subscription." When `host-ready` reported `hotkeys.quickAsk === false`: "Ctrl+Shift+E is taken by another app; Ctrl+Shift+Space still works."

Dictation consent unifies on `#companion-voice`. The studio `#mic`, when it is unticked, opens `#settings`, focuses the checkbox and shows "Allow local Windows dictation in Settings, then click the microphone." (companion.js:103 already does this.) `#voice-dialog`, `state.voiceConsent`, `#sound`, `state.speaking` deleted; `say()` (app.js:377) reads `#companion-spoken`.

Selects stay `<select>` elements because verify-models.mjs:21-42, verify-live.mjs:30/:40, verify-stream.mjs:19 call `selectOption`/`inputValue`.

---

## G. The one consent pattern

Three shapes. The rule, in one sentence, for docs and the settings sheet: **a tick is one send, a dialog is a lease with a countdown and a Stop, Approve is one action on your desktop.**

### G.1 A tick authorizes one send (`.send-gate`, three instances)

Each gate is `<label><input type="checkbox"> <span class="consent-line"></span></label> <button class="quiet">See exactly what goes</button> <p class="billing" hidden></p>`. The sentence comes from `consentLine(view)`:

| Surface | Sentence |
| --- | --- |
| Companion, no earlier messages, no frame | "Send this message to Astra (your ChatGPT subscription)." |
| Companion, earlier messages | "Send this message and the 4 earlier messages to Astra (your ChatGPT subscription)." |
| Companion, frame ticked | "Send this message, the 4 earlier messages and the attached frame to Fable 5.1 (your Claude subscription)." |
| Studio, no version | "Send this direction to Astra (your ChatGPT subscription)." |
| Studio, current version | "Send this direction and the current prototype source to Astra (your ChatGPT subscription)." |
| Studio, frame ticked | "Send this direction, the attached frame and the current prototype source to Fable 5.1 (your Claude subscription)." |
| Studio, Live build on | tick hidden; line reads "Live build on: changed snapshots of the shared window go to Fable 5.1 automatically, up to 10, under the permission you gave. Pause stops it." |
| Computer mode | "Send this task and a fresh reading of Calculator to Fable 5.1 (your Claude subscription)." (window title from `#computer-window`; "the chosen window" when none) |

Billing line when the model is Fable: "Fable can use paid usage credits on your Claude account."

Reset rules, enforced by `spend()`:
- The tick clears after every request that goes out, in every surface: companion `submit()` after the response or abort; studio `beginBuild()` after the response or abort; Computer `$('next')` after propose returns.
- The tick also clears on model change (companion.js:118 and app.js:595 rules kept) and, in Computer mode, on window change.
- The frame Include box clears after any send that carried the frame (`#companion-include` new; `#include-frame` already at app.js:434). The frame stays visible and can be re-ticked.
- The gate refuses in this order (`gate(view)`): "Tick the sharing line under your message before sending." / "Open Settings and connect your subscription first." / "Your local allowance is used up. Open Settings, then Start new allowance." (Studio adds "Tell Jarvis what should work first." before these, app.js:393.) The refusal renders in the surface's error element and focuses the tick.
- `state.consent` in app.js is set true by the studio tick at press time and by the Live build lease; it is no longer session-sticky (app.js:499 deleted).

Server contract unchanged: `/api/chat` requires `consent:true` (server.mjs:137), `/api/build` (:150), `propose` (lib/computer.mjs:99). The client sends `consent:true` only from a ticked press.

### G.2 A dialog grants a lease (two, no more)

Same body shape: what goes, how many, how it stops, what is not included. Live build: `#live-dialog` kept, `#live-consent-detail` keeps app.js:250's sentence (verify-live.mjs:33 matches `/paid Claude usage credits/`), buttons "Keep it local" / "Allow automatic builds" kept. Computer mode: `#computer-lease` (E.3). Both show a counter in the status line while on (activities 6 and 12) and die to the column's Stop.

### G.3 Approve authorizes one desktop action

Unchanged: `#computer-approve`, `#computer-reject`, one-minute expiry, fresh target validation, single use (lib/computer.mjs:119-126).

### G.4 What is not consent

Chips, follow-ups, quick-ask, "Build this in the studio", "Let Jarvis do this" fill and focus. None of them calls `/api/chat`, `/api/build` or `propose`. No frame is captured at summon; `host-ready` with `front` produces zero `capture` messages.

---

## H. Harness changes, against the real code

### H.1 public/harness.js (new, pure functions, importable by `node --test`)

```js
export function statusLine(view)      // C.5; view = {dictating,thinking,capturing,busy,elapsed,planning,live,liveCount,setupBusy,checking,token,configured,remaining,computerOn,frameAttached,stream,captureKind}
export function consentLine(view)     // G.1; view = {surface:'chat'|'build'|'computer',model,earlier,frame,hasSource,live,windowTitle}
export function gate(view)            // G.1 refusal string or null
export function spend(gateEl, includeEl, usedFrame)   // unticks gateEl; unticks includeEl when usedFrame
export const ledger = []              // session only
export function record(entry)         // {at,surface,frame,model,effort,remaining}; returns ledger.length
export function renderGate(root, view) // writes .consent-line, toggles .billing, disables tick when view.live
export function renderPreview(dialog, manifest, ledger) // fills #send-preview
export const MODEL_LABEL = {astra:'Astra',fable:'Fable 5.1'}, ACCOUNT = {astra:'ChatGPT',fable:'Claude'}
```
`selectedLabel`/`selectedAccount` (app.js:24-25) move here and are imported by app.js, companion.js and computer.js.

### H.2 public/chips.js (new)

```js
export function families(process, title) -> string[]      // table in plans/feature-roadmap-tournament.md section C, verbatim
export function chipsFor(families) -> [{id,label,prompt,capture:'frame'|'text'|'none'}]  // max three, error chip first
export const DESIGN_CHIPS                                  // the three index.html:50 prompts, capture:'none'
export const UNKNOWN_CHIPS                                 // the three fallbacks
```

### H.3 public/companion.js

- Delete the template literal (:4-16) and `document.body.prepend(host)` (:17); `host=document.getElementById('companion')`. Delete :19-20 (the back button is in the toolbar markup).
- `showMode` (:24-28) → `showSurface(next)`: sets `document.body.dataset.surface`, posts `resize`, toggles `#companion-expand` hidden, focuses `#companion-input` for companion.
- `render()` (:29-41): delete `$('model')`, `$('effort')`, `$('account')` writes (:31-32) and the `consent` disable (:37); status via `$('status').textContent=statusLine(view())`; `renderGate($('gate'),gateView())`; `$('ledger').hidden=!ledger.length`.
- `addMessage()` (:42-49): list rendering; "Jarvis" label; no user label.
- `setFrame()` (:50-55): keep `$('include').checked=true` on capture; add `markSent()` that sets the time line to "Sent {time} · not attached" and unticks.
- `submit()` (:80-100): keep the tick guard at :83 but route it through `gate()`; build `{body,manifest}=requestBody()` where `body` is exactly today's :89 object; after the response call `spend($('consent'),$('include'),!!evidence)`, `record({...})` from `result.model`, `result.effort`, `result.remaining`; render `result.result.followUps`; workflow buttons "Build this in the studio" / "Let Jarvis do this"; `openWorkflow('computer',...)` no longer calls `showSurface`.
- `dictate()` (:103) opens `#settings` and focuses `#companion-voice`.
- Handlers: `$('settings').onclick=()=>settings.showModal()` (:113); delete :114-115, :118 (model/effort forwarding), :124 (`[data-start]`); add deck rendering, `#companion-front-clear`, `#companion-preview`, `#companion-ledger`, chip focus → `#companion-hint`, `$('consent').onkeydown` Enter → `submit()`.
- `expand` (:116) → `showSurface('studio')`; `back` → `showSurface('companion')`.
- Native listener (:125-132): `host-ready` reads `data.front` and `data.hotkeys`, renders the deck; new `quick-ask` branch: `capture()` then fill the first chip's prompt then `$('consent').focus()`.
- Return `{setComputerState}` no longer needed; instead `initComputer`'s `onState` triggers `render` via the existing `jarvis-state` event (dispatch it from computer.js).

### H.4 public/app.js

- `state` (:15-18): delete `voiceConsent`, `speaking`; keep `consent` (set only at press or live-confirm).
- `renderSelection()` (:27-40): writes into the settings dialog; `consent-detail` write (:32) deleted; `billing-note` text per F.
- `updateControls()` (:117-139): remove `share-screen-top`; `#activity` strings per D.3d; `#reply-status` unchanged; call `renderGate($('build-gate'),...)` instead of `updateFrameChoice`'s `#input-note` write (:547 deleted).
- `setImage` (:150), `liveView` (:157), `stopCamera` (:166), `showSharedScreen` (:193), `pauseLive` (:200): sentence-case `#source-status` strings per D.3g. Frame labels at :326, :397, :489, :494 sentence case per D.5.
- `clearObservations` (:142), `renderObservations` (:279): observation-time strings per D.3j.
- `renderHistory` (:306) unchanged.
- `say()` (:377-387): reads `document.getElementById('companion-spoken').checked`.
- `beginBuild()` (:388-456): :394-395 open `#settings` instead of `#setup-panel`; :399 becomes `if(!$('build-consent').checked && !automatic){showError(gate(...));$('build-consent').focus();return;} state.consent=true;`; :407 and :436 phase strings sentence case; :416 `#activity` string; after :433 call `spend($('build-consent'),$('include-frame'),!!image)` (replaces :434's include untick), `record({...})`; :439 `#provider-status` unchanged; :444-446 open `#settings`.
- `startDictation()` (:461-476): :463 checks `#companion-voice`, else opens settings; :467 `#input-note` write deleted (status line covers it).
- Delete :245 (`share-screen-top`), :499-500 (consent dialog), :503 (voice), :504 (sound), :505 (privacy), :508 (`[data-prompt]`), :609 (`setup-toggle`), :616-621 (`budget-dialog`; replace with the two-step handler).
- :515-516 `#expand` toggles `.stage.expanded` (was `.output-column`).
- :592-598 unchanged. :650-670: `initComputer({api,getSelection,onState})`; `openWorkflow` (:658-662): `setup` opens `#settings`; `computer` fills `#computer-task`, scrolls `#computer-mode`, focuses `#computer-open`, no surface change; `build` unchanged.
- Add: `#settings-open`, `#model-menu`, `#build-preview` handlers; rail chips from `DESIGN_CHIPS`.

### H.5 public/computer.js

Query the static section; delete :2-28 markup and mount; :30 selection read deleted; `controls()` list drops `model`, `effort`; `count()` writes "N actions" at :39 and :62; `$('next')` (:86-100) uses `gate()`, reads `getSelection()` at :91, calls `spend($('cloud'))` and `record({surface:'computer',...})` after propose; `$('open')` opens `#computer-lease`; `$('enable')` closes it on success; `$('setup')` (:77) deleted; dispatch `jarvis-state` whenever `owner` or `busy` changes.

### H.6 server.mjs and scripts/check.mjs

- server.mjs:15 `export const assets = new Map([...])`, add `['/chips.js',['chips.js','text/javascript']]`, `['/harness.js',['harness.js','text/javascript']]`. Nothing else in the server changes: no route, no consent check, no CSP. Importing server.mjs from check.mjs does not start listening because of the `process.argv[1]` guard at :191.
- check.mjs: import `assets`; assert every route's file exists under public; scan public/*.html, *.js, *.css for `src="/…"`, `href="/…"`, `from './…'`, `import('/…')`, `url(/…)`; assert every referenced path is a route; type floor: over public/*.css fail on `font(-size)?:\s*([1-9]|1[01])px` (and `font:` shorthand with such a size); keep the noindex check. Print: `PASS: syntax checked N files; assets: R routes on disk, F references resolved; scanned 2 stylesheets, 0 declarations under 12px; local page is noindex.`

### H.7 desktop/*.cs

- CaptureService.cs: add `string targetProcessName` beside :22-25; in `RememberForeground` (:46-58) resolve `Process.GetProcessById(processId).ProcessName` only when `processId != targetProcessId` (the timer fires every 250 ms, DesktopShell.cs:66); add `public string[] DescribeForeground()` returning `{title, processName}` under `sync`.
- DesktopShell.cs: both host-ready payloads (:99, :264) gain `{"front", new Dictionary{{"title",…},{"process",…}}}` and `{"hotkeys", new Dictionary{{"summon",hotkeyRegistered},{"quickAsk",quickAskRegistered}}}`. `SetMode` workbench branch (:256-257): `ClientSize = new Size(1480, 900); MinimumSize = new Size(1180, 680);` (set MinimumSize after ClientSize as :248-249 does for the panel, per docs/ERRORS.md line 17). `PositionForMode` (:276): replace the centering expression with the panel's line, `Location = new Point(area.Right - Width - 22, Math.Max(area.Top + 22, area.Bottom - Height - 22));` so :275 and :276 collapse to one branch for `mode != "dock"`. Quick-ask: `const int QuickAskHotkeyId = 0x4A43; const uint VkE = 0x45;` registered in `OnHandleCreated` (:124), unregistered in `OnHandleDestroyed` (:128), handled in `WndProc` (:134) by `SummonPanel(); Post({type:'quick-ask'})`. 0x4A43 avoids the verifier's probe id 0x4A42 (verify-desktop-host.ps1:52). Panel and dock branches untouched (verify-desktop-host.ps1:49, :51, :57).

### H.8 lib/assistant.mjs

`conversationSchema` (:5-10) gains `followUps:{type:'array',items:{type:'string'}}` in `properties` and `required`. Prompt: one sentence after :50: "Also return up to three short follow-ups the user is most likely to want next, each under 60 characters, phrased as the user would say them, or an empty array." Validation beside :53: `followUps: Array.isArray(result.followUps) ? result.followUps.filter(s=>typeof s==='string'&&s.trim()).slice(0,3).map(s=>s.slice(0,60)) : []`, returned at :56.

### H.9 Stylesheets

style.css: replace `@layer layout` (:24-45) with `.app-shell`, `.toolbar`, `.studio`, `.rail`, `.stage` per D.1; delete `.topbar`, `.brand*`, `.header-*`, `.divider`, `.intro*`, `.eyebrow` (:33-34, :178, :183, :274-276), `.section-bar`, `.source-status` block styling (keep a caption rule), `.composer-wrap`, `.understanding-heading` eyebrow rule (:94), `.desk-tip` (:101-103), `.paper-*`, `.sketch-*`, `.result-paper`, `.mini-window`, `.empty-steps`, `.paper-index` (:117-137), `.suggestions` (:159-162), `.composer-meta` (:170, :230), `.quick-start` (:214-216, :241-243), `.setup-*` (:217-225), `.frame-choice` (:226-228), `.model-controls` (:255-259), `.build-overlay #cancel` grid placement (:277, :280 keep Cancel inline at the end of the strip), `.computer-mode > summary` and `.computer-grid` (:291-292, :300, :310), `.computer-heading` (:294-295), `.output-column.expanded` → `.stage.expanded` (:193-194). Add `.send-gate`, `.frame-strip`, `.chip`, `.chip-row`, `.chip small`, `.settings` section rules, `.computer-mode` single-column rules at 440px. Lift every declaration under 12px to 12px (51 sites). Keep `@media(prefers-reduced-motion:reduce)` at :204 untouched.

companion.css: `body.companion-mode` selectors (:1) → `body[data-surface=companion] .app-shell{display:none}` and `#companion{display:flex}` in both surfaces; delete `.companion-sharing`, `.companion-starters` (:5-6), `#companion-options` (:9); lift the three sub-12px sizes (:6 twice, :7, :8); add `.companion-deck`, `.companion-followups`, `.companion-message ol/ul`. Keep :10 and :11.

---

## I. File-by-file change list

| File | Change |
| --- | --- |
| public/index.html | Add `<section id="companion">` markup (C) as the last child of body before the dialogs, with `#computer-mode` inside its scroll region (E); replace :28-128 with `.app-shell` = `.toolbar` + `.studio` (`.rail`, `.stage`) per D; delete :35-38, :40, :41, :43-47, :49-55, :59, :98, :102, :109-113, :131-133, :136; add `<dialog id="settings">` (F), `<dialog id="send-preview">`, `<dialog id="computer-lease">` (E.3); keep :6 noindex meta (check.mjs:10), :130 live-dialog, :134 reset-dialog, :135 install-dialog, :137 source-dialog; delete the `i-sound` and `i-eye` symbols (:23, :26; `#i-eye` has no `<use>` today). |
| public/companion.js | H.3. Net shrink: no template literal. |
| public/app.js | H.4. |
| public/computer.js | H.5. |
| public/chips.js | New, H.2. |
| public/harness.js | New, H.1. |
| public/style.css | H.9. |
| public/companion.css | H.9. |
| public/live.js, public/storage.js | Untouched. |
| server.mjs | :15 export + two asset lines. |
| lib/assistant.mjs | H.8. |
| scripts/check.mjs | H.6. |
| desktop/CaptureService.cs, desktop/DesktopShell.cs | H.7. |
| tests/harness.test.mjs | New: statusLine sensor clause (with a stream it never says "screen & mic off"; with a frame and idle it contains both "1 frame attached" and "screen & mic off"), consentLine eight sentences, gate order, spend clears tick and include, record/ledger length. |
| scripts/verify-*.mjs, verify-desktop-host.ps1 | Section J. |
| README.md | "What it does" bullet order (companion first), Getting started step 3 (tick the sharing line, no dialog), Computer mode steps 1 and 3 (starts from the panel's "Set it up"; the sharing tick is per plan), Privacy table "Desktop companion" row (tick clears per send), Development list adds `npm run verify:computer` and `node scripts/verify-desktop-content.mjs`. |
| docs/COMPUTER.md | Steps 1 ("Set it up" in the companion panel), 4 (model and effort come from Settings; the sharing tick clears after each plan), 5 (Approve / Reject labels); paragraph 2 (the companion button now opens the card in place). |
| docs/DECISIONS.md | New entry: one column, studio as a second surface with pinned right edge, the tick/lease/Approve rule, per-send clearing named as stricter than 0.8.1. |
| CHANGELOG.md | 0.9.0 entry. |
| PLAYBOOK.md | Release section with the counts from section J and the hand-check results. |
| docs/ERRORS.md | The companion.js:39 status overwrite and the never-unticking include, stated as evidence. |
| site/index.html | 15 lines mention Computer mode / Make it real / workbench / Share screen / Live build / Setup / Privacy; rebuild through `npm run build:site` and re-run `verify:site`; regenerate docs/images/companion.png and computer.png from the packaged app (docs/ERRORS.md line 5). |

---

## J. Verification

Every script is updated, none deleted. Each line reference is from this session's read.

**scripts/verify-companion.mjs**
- :22 goto unchanged. :23 unchanged. :25 kept (unticked tick sends zero requests; the error text is the gate refusal).
- New after :25: click each of the three deck chips; assert `requests.length===0`; assert `#companion-input` holds the chip's prompt; after a `capture:'none'` chip assert `#companion-status` ends with "screen & mic off"; after a `capture:'frame'` chip assert `window.nativeMessages` has one `capture` and `#companion-context` is visible.
- :26 kept. New: assert `#companion-status === 'Ready · 1 frame attached · screen & mic off'` (L1: fails on 0.8.1, which reads "Ready · selected snapshot only").
- :27: after the send assert `requests[0].screenEvidenceIncluded===true`, then assert `#companion-consent` is unchecked AND `#companion-include` is unchecked (L1: the include assertion fails on 0.8.1 because companion.js:52 never unticks).
- :28: tick `#companion-consent` only, send; assert `screenEvidenceIncluded===false` and `!('contextLabel' in requests[1])`; `history.length===2`.
- New: open `#companion-preview`, read `#send-preview` message/earlier/frame/settings text, close, tick and send, diff against `requests.at(-1)` (instruction, history length, contextLabel presence, model, effort).
- New: synthetic inference returns `followUps:['Show me the steps','Why did it fail','What else']` for the frame case; assert three `.companion-followups button`; click one; assert input filled and `requests.length` unchanged. Synthetic reply "1. a\n2. b" for another instruction; assert `ol li` count 2.
- New: after three sends `#companion-ledger` reads "3 sent"; open; count ledger rows 3; reload (:37) then assert 0 rows.
- :29 button name "Build this in the studio"; assertions unchanged.
- :30 button name "Let Jarvis do this"; delete the `$('back')` click before it (no surface change); keep the `#computer-task` and `#computer-permission` assertions; add `assert.equal(await page.locator('.app-shell').isVisible(),false)`.
- :31, :33, :35, :36: `$('options-done')` → `page.locator('#settings-close')`; `$('settings')` still opens it.
- :32 `textContent==='Thinking'` → `textContent.startsWith('Thinking')`.
- :36 360px overflow and :37 reload unchanged.

**scripts/verify-browser.mjs**
- :24 "LIVE · LOCAL ONLY" → "Camera on · local only". :31 `/SAMPLE SKETCH/` → `/Sample sketch/`.
- :34-39 replaced: assert `#build-consent` unchecked; click "Make it real"; assert refusal text in `#error-text` and `cloudRequests===0`; check `#build-consent`; (routes at :46-47); click "Make it real"; assert `cloudRequests===1`, posted body `image` is a string, and `#build-consent` is now unchecked; untick `#include-frame`, check `#build-consent`, click again; assert next body `image===null`. Check name: "no build request before the tick, and the frame rides only when ticked".
- :49 "Allow and build" line deleted (the tick replaces it). :74-76 unchanged. :20, :78 unchanged.
- New: assert `#companion` visible beside `.app-shell` at 1440 and hidden at 1100.

**scripts/verify-recovery.mjs**
- :39-40: replace `#decline-consent` / `#accept-consent` with: click `#build` unticked → `requests.length===0`; check `#build-consent`; click `#build`. :42 kept (include unchecked after build). :44, :48: check `#build-consent` before each `#build` click. :67 "Camera on · local only". :68 kept. :73 kept. :79: check `#build-consent` instead of clicking `#accept-consent`.

**scripts/verify-stream.mjs**
- :19-20: wrap in a `settings()` helper (`#settings-open` click, `#advanced` open=true, then `#settings-close`). :21 replace `#accept-consent` click with checking `#build-consent` before `#build`. :22, :43 "Waiting for model output". :42 check `#build-consent` first.

**scripts/verify-models.mjs**
- Add `settings()` helper; call before :21, :25, :38, :42; close after each. :28 `#billing-note` `/usage credits/i`. :32: replace the `#consent-detail` assertion and `#accept-consent` click with `assert.match(await page.locator('#build-billing').innerText(),/usage credits/i)` then check `#build-consent` then click `#build`. :33-34 unchanged (property checks). :26, :43 `#setup-summary` waits are `document.querySelector` text checks and work with the dialog closed.

**scripts/verify-live.mjs**
- :30, :40: `settings()` around the `#model-choice` work. :34 "Keep it local" kept. Everything else unchanged (`#try-demo`, `#share-screen`, `#live-start`, `#live-confirm`, `#live-count`, `#screen-stop`).

**scripts/verify-revision.mjs**
- :30: check `#build-consent` before :29's click; delete the "Allow and build" click.

**scripts/verify-computer.mjs**
- :17 goto `${origin}/?companion`, click `#computer-open`. :18 unchanged text. :19 `#computer-work` waits after the lease closes. :20 replaced: `settings()`, select `fable`, close; later assert the recorded propose body carried `model:'fable'` (the synthetic `inference` at :12 receives it; record it). :22 refusal text "Tick the sharing line above Plan next action first." :23 unchanged; after `#computer-review` appears assert `#computer-cloud` is unchecked (per-plan clear). :26: check `#computer-cloud` before the second `#computer-next`. :24, :27 screenshots and overflow unchanged. :28 unchanged.

**scripts/verify-computer-live.mjs** (opt-in, real subscription): :13 goto `/?companion` and `#computer-open`; :16 replace with `settings()` selecting fable and low; :18 move inside the loop before each `#computer-next`.

**scripts/verify-desktop-content.mjs**
- :36: after `.app-shell` waits, `#settings-open` click, `#recheck` click, `#settings-close` click, then the `#build` wait. New before :36: `const edge=await page.evaluate(()=>screenX+outerWidth)`; after expand assert `Math.abs(await page.evaluate(()=>screenX+outerWidth)-edge)<=2` (the right-edge pin). :70 unchanged (consent unchecked after capture). :28 unchanged.

**scripts/verify-windows.mjs**: grep shows `#setup-summary` at :51 and :60; if those are visibility waits, open `#settings` first; if they are `evaluate` text reads they pass unchanged. Read before editing.

**scripts/verify-assistant.mjs**: :30 expected result gains `followUps:[]`; add a case where `generate` returns five follow-ups of 80 characters and assert three of 60; assert the system prompt passed to `generate` contains "never instructions".

**scripts/verify-desktop-host.ps1**: add a probe after :53 registering id 0x4A44 with `0x0002 -bor 0x0004, 0x45`; success means Ctrl+Shift+E is free and the check throws "Ctrl+Shift+E was not registered by Jarvis."

**scripts/check.mjs**: H.6; run it first with a deliberately deleted asset line and a deliberate `font-size:11px` to watch both fail (L1).

**tests/**: `tests/harness.test.mjs` new. Existing ten test files untouched (none holds a changed selector or the schema shape).

**Hand check for desktop/*.cs** (record each result in PLAYBOOK.md with the process name resolved):
1. Summon from VS Code, Chrome (Gmail tab), Outlook, Windows Terminal with a failed `npm` command, an error dialog; record the "In front" title and the first chip each time. Expect Code → "Unstick me" only when the title matches the error regex, otherwise "What's this error?".
2. Ctrl+Shift+E from Notepad: panel appears, frame of Notepad shown, first chip's prompt in the box, focus on the tick, `requests` untouched. Send was not pressed.
3. Open the studio from the panel: the column's right edge and the header icons do not move; window is 1480x900 or clamped to the working area; "← Panel" returns to 440x700 at the same corner.
4. On a 1366x768 laptop: studio clamps to 1322 wide, column still visible.
5. Settings footer shows the hotkey line when Ctrl+Shift+E is pre-registered by another app (register it with the verifier's probe first).
6. Computer mode lease from the panel → Notepad → one approved type action → Stop from the column footer; Ctrl+Shift+F12 from Notepad stops a second session.

---

## K. Migration order

Baseline first: `npm test`, `npm run lint`, `verify:companion`, `verify:assistant`, `verify:browser` (needs `.artifacts/generated.json`), `verify:computer`, `verify:stream`, `verify:recovery`, `node scripts/verify-live.mjs`, `node scripts/verify-models.mjs`. Record the counts (40 tests, 12 companion, 8 browser, 11 computer, 14 streaming, 9 recovery, 22 live, 13 model per PLAYBOOK.md), not just PASS.

1. **lib/assistant.mjs followUps** + verify-assistant edits. Independent, shippable.
2. **harness.js and chips.js** landed with no visible change: export `assets` from server.mjs, add the two asset lines, rewrite check.mjs, lift the 54 sizes, add tests/harness.test.mjs. Wire `statusLine` into companion.js `render` only. L1: make `statusLine` return a constant and watch verify-companion.mjs:32 fail, then restore. Lint must print the two new counts.
3. **Companion column**: static markup into index.html, deck, follow-ups, list rendering, send gate, per-send clearing, preview, ledger, additive status. verify-companion rewritten per J. L1: run the new include-unchecked and status assertions against the 0.8.1 companion.js first (both must fail).
4. **Settings dialog**: markup, app.js rewiring, deletion of the four dialogs and `#sound`/`#privacy`/`#setup-toggle`. verify-models, verify-stream, verify-live, verify-desktop-content edits.
5. **Studio**: toolbar, grid, rail order, stage, deletions, `#build-consent` gate, sentence-case strings. verify-browser, verify-recovery, verify-revision edits. At this step a plain browser at 1440 shows the column beside the canvas.
6. **Computer mode into the column**: static section, lease dialog, `#computer-cloud` gate, count fix. verify-computer, verify-computer-live edits.
7. **Shell**: front payload, hotkeys payload, studio size, pinned edge, quick-ask. `npm run build:windows`, `verify:windows`, verify-desktop-host.ps1, verify-desktop-content.mjs, then the hand-check list. Steps 1 through 6 ship without the shell; the deck degrades to the unknown chips and the studio centers as today.
8. **Docs in the same change**: README, docs/COMPUTER.md, docs/DECISIONS.md, CHANGELOG, PLAYBOOK, docs/ERRORS.md, site rebuild and verify:site, regenerated screenshots.
9. Release gate as PLAYBOOK.md records it, reading every count.

Each step leaves the app working and its own verifiers green; steps 3 through 6 each touch one verifier group.

---

## L. Open decisions for the maintainer

1. **The tick clears after every send, in the studio too.** Stricter than 0.8.1 (state.consent was session-sticky at app.js:499) and one extra click per revision. Alternative: clear only when the payload changes shape (frame attached, model changed, first send of the session). Recommendation: per send. One rule the docs can state in a sentence, and Enter, Space, Enter keeps the keyboard cost at two keys.
2. **The companion column stays visible inside the studio** (window 1480 wide, right edge pinned). Cost: two text boxes on screen (chat and build direction), a 440px column taken from the canvas. Alternative: Studio Cut as written, column hidden in the studio, edge still pinned. Recommendation: keep the column; it is the only mechanism that makes "expand" not feel like a page change, and the two boxes do different things with different button labels.
3. **Computer mode's model and effort come from the one Settings choice.** You can no longer plan a desktop action with a different model than you chat with. Recommendation: accept; one model in one place is the point.
4. **`/api/observe`** has no UI call site (server.mjs:88, :173; app.js:89; verify-browser.mjs:33, :46 stub it). Recommendation: leave it this release; remove in a separate one-line change with the verifier stubs.
5. **Live build stays in the studio rail with its own dialog**, per AGENTS.md:7. Recommendation: unchanged.
6. **"Keep it local" / "Allow automatic builds"** in the live dialog stay as they are. Recommendation: unchanged; renaming costs a verifier line for taste.
7. **Ctrl+Shift+E** collides with "Explorer" in VS Code. Recommendation: ship it, surface registration failure in the Settings footer, no further hotkeys.
8. **Chip prompts and the "text" take badge.** Feature 9 (exact window text) is not in this release; the badge value `text` is reserved and never rendered. Recommendation: keep the schema slot, ship frame-only.
9. **The version string in the Settings footer.** Static text goes stale. Recommendation: omit the number; `/api/health` can carry `version` later if wanted.
10. **`#activity` in the rail rather than the build strip**, because verify-recovery.mjs:73 asserts it visible while idle at 390px. Recommendation: rail, strings "Ready" / "Fable 5.1 · medium · 42s" / "Version 03 ready".

Retro for this pass: reading every verifier before designing turned four of the winner's "unchanged" claims into edits (verify-recovery:40/:79, verify-stream:21, verify-models:32 all click `#accept-consent`; verify-computer-live holds `#computer-cloud` once outside its loop). The one change for the next pass: grep the scripts/ tree for every id and visible string a plan deletes before the plan is written, and put that list in the plan.