# Architecture decisions

## 2026-09-05: Desktop companion stays a local entry point

The Windows companion is a native WinForms window hosting a persistent WebView2 profile. It gives the user a compact, summonable conversation surface, then opens the existing workbench when the user explicitly chooses a build or Computer mode workflow. Its conversational history is bounded to the active session.

Keep companion capture explicit: a requested current-window screenshot shows the exact frame used. Do not add ambient screen monitoring, always-on microphone capture, audio upload, automatic browser-history migration, model fallback, or action-permission changes. Camera sharing, Live build consent, source versions and downloads remain existing workbench behavior. WebView2 is a runtime dependency and missing availability fails closed with installation guidance.

## 2026-09-05: Reviewed Computer mode

The maintainer approved a separate local Windows action broker alongside prototype building. Keep subscription inference isolated and tool-free; interpret its structured output as a proposal, not permission. Every action requires a short-lived, single-use user approval bound to a fresh accessible target. Use a native global stop shortcut and a bounded session lease.

Use Windows accessibility patterns rather than arbitrary coordinates. Fixed app launches are Notepad, Calculator and Paint. Explorer and launch-capable address controls are excluded. The interface explicitly describes unsupported canvas, shell, elevated and unattended work. No direct model API, new billing route or automatic model fallback is introduced.

Keep all prototype building, streaming, capture and storage paths unchanged. Deploy only the allowlisted static marketing files to Vercel; native control remains in the downloaded app.

## 2026-09-05: One column, one tick, one Settings

The companion column is the product. It keeps the same 440 pixels whether or not the studio is open: the studio widens the native window to the left with the right edge pinned, so "open the studio" never reads as a page change. Below 1180px the column steps aside and ← Panel brings it back. The native mode names (`dock`, `panel`, `workbench`) did not change.

Consent is one rule, stated in the settings dialog: a tick is one send, a dialog is a lease with a countdown and a Stop, Approve is one desktop action. The tick's sentence is generated from the payload and clears after every request that goes out, in every surface. That is stricter than 0.8.1, where the studio's permission was session-sticky. "See exactly what goes" shows the request body with only the frame's bytes elided, and a session ledger counts every send.

The deck is local. The shell already tracked the foreground window every 250 ms for capture; it now also reports the title and process name on `host-ready`, and `public/chips.js` maps those to families and chips with no pixels and no model call. Nothing is captured at summon. Ctrl+Shift+E summons, captures the window that was in front and fills the first chip, then stops at the tick. Follow-up chips come from the model's structured reply and only fill the box.

Computer mode moved into the column as one resting line and a lease dialog. Model and effort come from the one Settings choice. Live build, camera sharing and the import path stay where AGENTS.md records them.

Not built, on purpose: auto-capture on summon, model-generated chip suggestions, and anything that watches a window and reports when it changed.

## 2026-09-05: Choose what Jarvis looks at

The maintainer's second correction after 0.10.0: the panel only ever looked at the window that was foreground at summon, which is not how people use a computer, and its capture refused any window not entirely on the visible desktop. Approved from a fifth mock state before code changed.

The target is a pick. The "Looking at" line carries **change**, which asks the shell for every visible, titled, top-level window except Jarvis, tool windows, cloaked and minimized ones (titles and process names only, capped at 60), and lists them as rows under **Whole desktop**. A pick is a `select-target` message; the shell validates the window still exists, pins it, and answers with the new `front`, so the page never shows a target the shell would not capture. The foreground tracker keeps running but only fills the default; a pick lasts until the next summon, because a new summon is a new context. Ctrl+Shift+E therefore still captures the window that was in front.

Whole desktop is `CopyFromScreen` over the virtual screen with the panel at opacity zero for the capture, bounded and encoded like a window. Window capture is `PrintWindow` at the window's own size instead of its intersection with the screen, which is what made off-screen and other-monitor windows fail. The stricter "move it onto the desktop" check was protecting nothing: PrintWindow renders the window's surface, not the screen.

Not built, on purpose: a live thumbnail per window in the list (pixels before a pick), capturing minimized windows (nothing to render), and a per-monitor choice (Whole desktop covers it).

## 2026-09-05: One box, one button, no tick in the panel

The maintainer rejected the 0.9.0 panel on sight: a scrolling box inside a small window, a checkbox sentence, two Include boxes, a horizontal chip strip with arrows, a Computer card under the chat. The redesign was mocked as four states of the same 440px panel and approved before any code changed.

Consent in the panel is now the button, not a tick. The Send button reads "Send", "Send with screenshot", "Send with window text" or "Send with screenshot and text", computed by `sendLabel()` from what is in the box. Attached means it goes: a screenshot or the window's text sits inside the box as a chip with its name, time and size (every character of the text shown in full), × removes it, and a send that reached the model clears it and pins it to the message as evidence. A refused or stopped send keeps it. This reverses "one tick, one send" for the panel and for Computer mode, whose "Plan next action" button names the window whose fresh reading goes in the line under it. The studio keeps its tick and its sharing sentence; `gate()` requires a tick only for `surface:'build'`.

The panel has no checkbox, no details arrow and nothing that scrolls at rest, and the companion verifier asserts all three. Starters are three full-width rows, each saying what it takes ("takes a screenshot of Chrome", "reads the text of Notepad", "just asks"); they show while the conversation is empty and come back when Jarvis is summoned from a different window mid-conversation. The header carries one sensor line ("Screen & mic off") from `sensorLine()` that no activity overwrites; the line under the box carries the destination ("To Fable 5.1 on your Claude subscription · may use paid credits") and "What goes", and becomes "Thinking · 4s" with the only Stop while a request is out. The Read text button is gone; text comes through the text-first starters. The studio arrow left the header for Settings and for the reply that suggests it.

Computer mode is a screen, not a card. Set it up lives in Settings; once the lease is on, the screen replaces the conversation and the box, keeps the header, shows the window, the task, and the one action waiting for approval, with the lease countdown at the top and Stop control in the footer. Back returns to the conversation with the lease intact and an Open button on the line under the box. The lease dialog, the broker, the per-action approval and the global stop shortcut did not change.

## 2026-09-05: Read-only window text and a write-only clipboard

The maintainer approved both after the redesign shipped. `op:'read'` on the Computer broker reads one window's accessible text through the existing helper without arming it: Snapshot has no Check(), so a read cannot click, and the operation never sets an owner or a proposal. It is a strictly weaker permission than Computer mode and needs no lease; pressing Read text or a text-first chip is the consent, and the text goes to a model only while its Include box is ticked. The clipboard is write-only. `Clipboard.SetText` in the shell, `writeText` in the browser, and a lint rule that fails on any read, because a clipboard read would make "screen & mic off" untrue. "Replace it in the app" through Computer mode was rejected: multi-paragraph text cannot pass the type broker and Jarvis should not be near a Send button.
