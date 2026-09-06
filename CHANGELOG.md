# Changelog

## 0.13.0: Screen on

- "Screen & mic off" in the panel header is now a button. It opens a ten-minute lease with two ways in: **Follow my clicks** and **Follow and keep a fresh screenshot**. No checkbox; the button is the consent. The header then reads "Screen on · following clicks · 9:42" (or "fresh screenshots"), the dot lights, and pressing the line stops it. Ctrl+Shift+F12 stops it too.
- While on, the shell pins whatever top-level window you click as the thing Jarvis looks at. "Looking at" shows the window and the control you clicked ("Inbox – Gmail · Send button"); the starters refit once per window change. A 2px amber border on the desktop outlines the followed window.
- With fresh screenshots on, three quiet seconds after a click a screenshot of that window replaces the chip in the box, only if the window looks different from the last one. Send reads "Send with screenshot". Nothing is sent without Send. × on the chip mutes that window until you click a different one.
- The lease ends on its own after ten minutes; the header returns to "Screen & mic off" and a line under the box says "Screen off · followed for 10 minutes". A chip already in the box stays.
- Shell: a `WH_MOUSE_LL` hook and the border exist only during a lease. Messages `screen-on`, `screen-off`, `screen`, and `target` with `via:'click'` and `element`. The Computer helper's shortcut refusal now names Screen on as a possible holder.
- Not built, on purpose: automatic sends, any keyboard hook, following inside Computer mode (next release).

## 0.12.0: Any model, minimized windows too

- Settings' model selector now lists the full catalog from `public/models.js` in two groups, "OpenAI · ChatGPT through Codex" and "Anthropic · Claude through Claude Code": Astra, GPT-5.6 Sol, GPT-5.6 Terra, GPT-5.6 Luna, GPT-5.5, GPT-5.4 Mini and GPT-5.3 Codex Spark on OpenAI; Fable 5.1, Opus 5, Sonnet 5 and Haiku 4.5 on Anthropic. Every Anthropic model can spend paid Claude usage credits.
- Picking a model whose effort levels don't include the saved effort moves it to that model's deepest level and says so under the effort control. GPT-5.5, GPT-5.4 Mini and GPT-5.3 Codex Spark stop at xhigh; the rest go to max.
- The "Looking at" line's **change** picker now lists minimized windows too, marked "minimized" under the title. Picking one and taking a screenshot shows the window without activating it, captures it, then minimizes it again, restoring its exact placement.
- Computer mode: an approved action on a minimized window restores it first, since focus is required for input.
- Shell: `windows` message rows carry a `minimized` boolean. `/api/local-session` returns the whole catalog instead of a fixed two-model list.

## 0.11.0: Choose what Jarvis looks at

- The "In front" line is now "Looking at" with **change**. It lists **Whole desktop** and every open window (title and app, Jarvis excluded) as rows in place of the starters; a pick tells the shell, re-fits the starters to that app, and Screenshot and the starters capture that target until the next summon. A closed window is refused and the list refreshes. "not this one" is gone.
- **Whole desktop** captures every monitor at once, bounded like a window capture, with the panel made transparent for the capture so Jarvis is not in the picture.
- Window capture renders the window's own surface at full size, so a window half off the screen or on another monitor captures whole. "Move the entire selected window onto the visible desktop" is gone; only a minimized window refuses, and says so.
- Shell messages: `windows` (titles and process names only), `select-target`, and `id` on `host-ready`'s `front`. The browser build hides **change** and keeps the OS picker.

## 0.10.0: One box, one button

- The panel redesigned from first principles: one message box, one Send button, nothing to tick. The button says what goes ("Send with screenshot", "Send with window text"); a screenshot or the window's text sits inside the box as a chip with its name, time and size, × removes it, and after a send it leaves the box and stays on the message as evidence. Refused and stopped sends keep it.
- The panel has no checkbox, no details arrow and nothing that scrolls at rest; the companion verifier asserts all three. The consent sentence, the Include boxes, the hover hint, the horizontal chip strip, the footer status line, the sent counter, the Read text button and the studio arrow are gone from the panel.
- Starters are three full-width rows, each saying what it takes ("takes a screenshot of Chrome", "reads the text of Notepad", "just asks"). They show while the conversation is empty and come back when Jarvis is summoned from a different window.
- The header carries one sensor line, "Screen & mic off" with a dot, that no activity overwrites. The line under the box names the model and the account ("To Fable 5.1 on your Claude subscription · may use paid credits") with "What goes"; while a request is out it becomes "Thinking · 4s" with the only Stop on the screen.
- Computer mode is a screen, not a card: entered from Settings, it replaces the conversation once the lease is on and shows the window, the task and the one action waiting for approval, with the lease countdown at the top and Stop control in the footer. Back keeps the lease; Open on the line under the box returns to it. "Plan next action" is the consent; the line under it names the window whose fresh reading goes.
- Settings gains a "Do more" section: Open the studio, Computer mode.
- Harness: `activityLine()`, `sensorLine()` and `sendLabel()` in `public/harness.js`; `gate()` requires a tick only in the studio. Old Computer card and text strip rules removed from `style.css`; the panel's rules live in `companion.css`.

## 0.9.0: One column, one tick

- The companion column is the product. It keeps the same 440 pixels when the studio opens beside it; the native window widens to the left with its right edge pinned. Below 1180px the column steps aside and ← Panel brings it back.
- The deck: at summon the panel reads the title and process of the window that was in front and offers three prewritten questions for it, from `public/chips.js` (errors, terminals, code, browsers, mail and chat, spreadsheets, documents, design tools, settings and installers). No pixels and no model call until a chip is pressed. "not this one" falls back to the three generic questions.
- Ctrl+Shift+E summons, captures the window that was in front, fills the first chip and stops at the sharing tick. Settings says when another app owns the shortcut.
- One consent pattern everywhere: a generated sentence next to one tick ("Send this message, the 4 earlier messages and the attached frame to Fable 5.1 (your Claude subscription)"), "See exactly what goes" with the request body, a per-session ledger in the footer. The tick and the frame's Include box clear after every send. The studio's session-sticky permission dialog is gone.
- Read text: the panel reads the accessible text of the window you came from through a new read-only `read` operation on the Computer broker (never arms, grants no owner, cannot act). Every character is shown with a control and character count and a truncation flag; it goes only while its Include box is ticked, and the sharing sentence, the preview, the ledger and the provenance line under the reply all name it. Error, terminal, spreadsheet and settings chips read text first and fall back to a frame.
- Copy on every reply, write-only: the shell handles a `copy` message with `Clipboard.SetText`, the browser falls back to `writeText`, and lint fails on any clipboard read in `public/` or `desktop/`. "Say it plainly" takes its tone (plainer, shorter, warmer, firmer) from Settings, Advanced.
- Follow-up chips under each reply from the model's structured response; numbered and bulleted replies render as lists.
- One Settings dialog from either surface: model and connection, Advanced (effort, dictation, spoken replies, import, allowance, clear), what leaves this device. The workbench top bar, hero, quick-start row, "Try saying" row, section numbers, eyebrows, the privacy, consent, voice and budget dialogs are removed.
- The studio replaces the workbench page: a toolbar (← Panel, Share window, Live build, model, Settings), an input rail and an output stage that scroll themselves. Copy in sentence case; nothing in the app under 12px, checked by lint.
- Computer mode moved into the column as one resting line, a lease dialog and a card; model and effort come from Settings; the sharing tick clears after every plan; Approve and Reject.
- Harness: `public/harness.js` holds the status line, consent sentence, gate, spend and ledger, unit-tested in `tests/harness.test.mjs`; `scripts/check.mjs` verifies the asset map against disk and references and the 12px floor. Companion, computer and app markup live in `index.html`.
- Shell: `host-ready` carries the foreground title and process plus hotkey registration state; the studio window is 1480x900, minimum 1180x680, pinned to the panel's right edge.


## 0.8.1: The Jarvis mark

- Replaced the letter-in-a-circle dock and stock tray icon with the Jarvis mark: an amber lens on a rounded charcoal square, drawn natively on a shaped dock window (no white square behind it), embedded in the exe as `desktop/jarvis.ico`, and used for the tray, taskbar and title bar. `scripts/build-icon.ps1` regenerates the icon from the shared geometry.
- Rewrote the README, public site, docs and llms.txt in plain first-person voice. Removed per-section eyebrow labels, decorative section numbering, arrow glyphs and side-stripe accents from the site and the workbench. Added PRODUCT.md and DESIGN.md as the design context.
- Companion welcome copy now opens with a question instead of a tagline. Workbench text sizes have a 9px floor.

## 0.8.0: Desktop companion

- Added a compact native Windows companion that can be summoned with Ctrl+Shift+Space and expands into the existing workbench when the user chooses a build or Computer mode workflow.
- Added optional local dictation and spoken replies, a bounded in-session conversation, and an explicit current-window screenshot that shows the exact frame used.
- Added a persistent WebView2 profile for the companion. Existing browser-stored revisions are not imported automatically; export HTML and use Settings, then Import a saved HTML prototype. Imports are limited to 120,000 bytes and append a revision when the 12-version history has room.
- Kept camera sharing, consented Live build, source versions, downloads, Astra/Fable subscription transports, and reviewed Computer mode actions unchanged.

## 0.7.0: Reviewed computer actions

- Added Windows Computer mode with explicit local and subscription sharing consent.
- Added accessible-control inspection, click, text replacement, scroll, supported shortcuts, window focus, and fixed app launches.
- Added one-action approvals, rejection, expiry, target revalidation, session history and a global Ctrl+Shift+F12 stop shortcut.
- Preserved the isolated Astra/Fable subscription transports and the prototype builder.
- Documented native limitations and updated the public Computer mode guide and Windows download.

## 0.6.0 · 2026-09-05

- Fable streams real partial HTML into a script-disabled live draft and code view. Switch to the last working version during generation.
- Completion still validates and saves a full interactive version. Canceled or failed drafts are discarded and their temporary URLs revoked.
- Direct structured output avoids duplicate JSON narration. Shorter generation prompts and a low-effort shortcut help reduce waiting.
- Astra remains on the isolated Codex exec path and displays completed messages; it does not simulate incremental tokens.
- MIT license, refreshed README and contributor guidance, current screenshot, GitHub description, website link, and release documentation.

## 0.5.0 · 2026-09-05

- Share a screen or window and opt into Live build while drawing or editing. Camera and upload remain available.
- Local change detection, three quiet seconds, configurable minimum intervals, one request at a time, and ten builds per start. Pause cancels unfinished inference; Stop sharing releases capture.
- Exact sent-frame evidence, explicit automatic-sharing and usage-credit consent, and no automatic resume after reload.
- Animated Astra/Fable waiting messages, elapsed time, reduced-motion support, and a status panel that keeps the current prototype usable.
- Windows package, privacy documentation, public download guidance, and deterministic live-loop verification updated.

## 0.4.0 · 2026-09-05

- Choose Astra or Fable 5.1 and low, medium, high, xhigh, or max effort in the workbench. Preferences persist; each build records its selection.
- Fable generation and image input through official Claude Code with a paid Claude subscription. Usage credits may be charged; the UI shows this before consent.
- Provider-specific Setup, sign-in, and a Windows button to install the checksum- and publisher-verified Claude Code runtime directly from Anthropic.
- Server-side model/effort validation, isolated CLI settings, disabled executable tools and model fallback, safe errors and cancellation.
- Updated Windows executable and public download guidance.

## Website update · 2026-09-05

- Removed the optional task-board section and its hosted sample file. The public page now focuses on the reference-to-result walkthrough and Windows download.

## 0.3.0 · 2026-09-05

- Windows executable bundles Node and official Codex: download, open, and use ChatGPT sign-in from Setup without terminal commands.
- Per-user extraction, desktop and Start menu shortcuts, tray Open/Quit, single-session reuse, occupied-port refusal, and owned-process cleanup.
- Pinned upstream package integrity and publisher verification; Jarvis's outer executable is unsigned and disclosed as such.
- Desktop bootstrap protects local APIs with a per-launch key scoped to the browser origin, separate from restricted preview capabilities.
- Public walkthrough explains reference, prompt, result, and revision; the task board is an optional sample rather than the main product demonstration.
- Windows extraction, clean-profile authentication, rendered preview, and lifecycle verification scripts.

## Public demo · 2026-09-05

- Launched the free browser example at https://jarvis-workbench.vercel.app on the maintainer's existing Vercel plan.
- Added a Windows download, explicit prerequisites, subscription setup guidance, and privacy details.
- Static deployment uses an allowlist; no local server or ChatGPT credentials are hosted.
- Added public metadata, sitemap, robots, llms, search ownership tags, and standard Vercel Web Analytics.
- The initial public launch used the 0.2.0 source archive; 0.3.0 replaces it with the bundled Windows executable.

## 0.2.0 · 2026-09-05

- Working example before login, setup checklist, explicit CLI installation and ChatGPT sign-in, and reconnect controls.
- One subscription turn per visual build, returning observations and HTML together; typed revisions do not resend an old frame by default.
- Completed source persists before preview loading; retry previews without inference and access local source during connection failures.
- Reliable Windows readiness checks independent of subscription status, serialized launches, and graphical prerequisite errors.
- Visible frame-inclusion control, build controls near the top, and mobile progress/countdown.
- Safe error categories, visible local allowance, validation before budget consumption, and explicit allowance renewal.
- 21 unit tests and nine additional browser recovery checks. No application dependencies added.

## 0.1.0 · 2026-09-05

Initial public release of the local Jarvis workbench.

- Selected camera frames, image upload, and a labeled sample sketch.
- Visual observations followed by interactive HTML generation.
- Astra through the official Codex CLI using a ChatGPT subscription, with no model API or fallback.
- Revisions, version history, source inspection, and standalone HTML download.
- Restricted previews with desktop, mobile, and expanded views.
- Local Windows English dictation and optional local spoken replies.
- Explicit sharing consent, cancellation, and bounded inference requests.
- Windows/Linux CI for unit tests, syntax, and required assets.

See the [README](README.md#privacy-and-boundaries) for current limits and the [playbook](PLAYBOOK.md) for verification evidence.
