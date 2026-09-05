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

## 2026-09-05: Read-only window text and a write-only clipboard

The maintainer approved both after the redesign shipped. `op:'read'` on the Computer broker reads one window's accessible text through the existing helper without arming it: Snapshot has no Check(), so a read cannot click, and the operation never sets an owner or a proposal. It is a strictly weaker permission than Computer mode and needs no lease; pressing Read text or a text-first chip is the consent, and the text goes to a model only while its Include box is ticked. The clipboard is write-only. `Clipboard.SetText` in the shell, `writeText` in the browser, and a lint rule that fails on any read, because a clipboard read would make "screen & mic off" untrue. "Replace it in the app" through Computer mode was rejected: multi-paragraph text cannot pass the type broker and Jarvis should not be near a Send button.
