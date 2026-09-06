# Screen on: Jarvis follows your clicks

Design for 0.13.0. Approved direction from the maintainer on 2026-09-05: build the Watch and See tiers first, the Act tier as a second release, one approval per action throughout.

## What changes

"Screen & mic off" in the panel header is a status today, from `sensorLine()` in `public/harness.js`. It becomes a button. Pressing it opens a lease. While the lease is on, Jarvis's target follows whatever window you click, the header says so with a countdown, a thin border on the desktop marks the followed window, and (if you chose it) a fresh screenshot of that window sits in the box after you pause, ready to go with your next question. Nothing is sent without Send. No model call happens on its own. The mic is untouched.

This reverses two recorded decisions ("no ambient screen monitoring", "nothing that watches a window and reports"). It stays inside the product principle because the mode is explicit, leased, counted down, stoppable from anywhere, and visible on the desktop itself. The line is truthful in both states.

## Not in this release, on purpose

- Sending anything automatically. A screenshot lands in the box; you press Send. So there is no per-lease send budget: every send is still yours.
- Acting. Computer mode keeps its own lease, picker and per-action Approve. Release B (below) makes it follow your clicks.
- A keyboard hook. Only mouse button events are observed, and only while the lease is on.
- Coordinate clicks, OCR, audio.

## States (mock these first, at 440px, before any code)

1. **Off.** Header reads "● Screen & mic off" as one button. Everything else as today.
2. **Lease dialog.** Title "Let Jarvis follow your screen?" Three sentences: what it does for 10 minutes, what stays local, how to stop (the header line or Ctrl+Shift+F12). No checkbox. Three buttons: "Not now", "Follow my clicks", "Follow and keep a fresh screenshot". The button is the consent.
3. **On, following.** Header reads "● Screen on · following clicks · 9:42" with the dot lit. The whole line is a button that stops. "Looking at" carries the clicked window and control: "Looking at: Inbox – Gmail · Send button". Starters regenerate when the window changes, not on every click.
4. **On, fresh screenshot.** As 3, header "● Screen on · fresh screenshots · 9:42". A screenshot chip sits in the box with the window's name and time; Send reads "Send with screenshot". Each new pause replaces the chip. × removes it and pauses replacement until the next click on a different window.
5. **Expired or stopped.** Header returns to state 1. The border disappears. A chip already in the box stays; it is yours to send or remove. A one-line note under the box: "Screen off · followed for 10 minutes".

Dictation while on: "● Screen on · mic on (local) · 9:42". Sensor words come first, always.

## Shell (desktop/DesktopShell.cs, desktop/CaptureService.cs, new desktop/FollowService.cs)

- Messages from the page: `screen-on {snapshots:boolean}` and `screen-off`. The shell answers `screen {on, snapshots, expires}` and later `screen {on:false, reason:'stopped'|'expired'|'hotkey'}`.
- `screen-on` starts a `WH_MOUSE_LL` hook in the shell process (no elevation), a 10-minute timer, and the border. `screen-off`, the timer, Ctrl+Shift+F12 and shell shutdown all tear the three down together. The hook is never installed outside a lease.
- On left or right button up: `WindowFromPoint` then `GA_ROOT`. Skip Jarvis's own process, tool windows, cloaked windows, and windows with a display affinity that blocks capture (the same filters as `ListWindows`). Pin it through the existing `Select` path so `DescribeForeground` and capture agree. Post `target {ok:true, via:'click', front:{title,process,id}, element:{name,type}}`. The element comes from UI Automation `ElementFromPoint`: name capped at 100 characters, control type name, nothing else. Never a value, never a password control (skip and send no `element`).
- A window the user picked from the list stays pinned until the next click. Summon still clears the pick; while following, the next click re-pins anyway.
- Border: one layered, topmost, click-through, non-activating form, 2px amber, moved to the followed window's rect on each click and on a 250ms tick while the lease is on (reusing `foregroundTimer`). Hidden when the followed window is minimized or gone. No animation, so reduced-motion needs nothing.
- Snapshots are a page concern. The shell only captures on the existing `capture` message.
- Ctrl+Shift+F12 is registered today by the Computer helper only while it is armed, and `RegisterHotKey` refuses a second owner. The shell registers the same shortcut only while following and releases it at `screen-off`. If registration fails because Computer mode already holds it, following still starts and the `screen` message carries `hotkey:false`, so the header line is the only Stop and the lease dialog's note says so. If Computer mode arms while following, the helper's existing refusal fires; its text becomes "Ctrl+Shift+F12 is held by another Jarvis session (Computer mode or Screen on). Stop that one first." The helper's registration is otherwise untouched; merging the two leases is Release B work.

## Page (public/companion.js, public/harness.js, new public/follow.js)

- `sensorLine(v)` gains `screenOn`, `snapshots`, `remaining`: `screen on · following clicks · 9:42`, `screen on · fresh screenshots · 9:42`, and `screen on · mic on (local) · 9:42` while dictating. Unit-tested like the existing three.
- The header status becomes `<button id="companion-sense">`. Off: opens the lease dialog. On: posts `screen-off`. Both states keep `role="status"` text inside for the verifier.
- `follow.js` is a pure reducer, tested in isolation: given `target via click` events and a clock, it decides `renderDeck` (window changed), `schedule capture at t+3000` (snapshots on), and `skip` (same window, chip removed by user, capture in flight). It reuses `live.js`'s thumbnail comparison so an unchanged window does not replace the chip.
- A captured frame goes through the existing `setFrame`, so the chip, the Send label, the ledger and the evidence pin all work unchanged.
- Ctrl+Shift+E while following captures the followed window, not the foreground one; the shell's pin already makes that true.

## Server

No changes. No new route, no model call, no broker op. `/api/computer` is untouched.

## Docs and release

- README "What it does": one bullet, "Follows your clicks when you ask it to", with the lease and the border named. README "Privacy and boundaries" table: a row for Screen on.
- `docs/DECISIONS.md`: entry "Screen on is a lease, not a status", recording the reversal and why it holds.
- `CHANGELOG.md` 0.13.0. Site copy updated in the same change.

## Verification

- Unit: `sensorLine` states; `follow.js` reducer (window change, quiet gap, in-flight, removed chip, expiry).
- `verify:companion`: the header line is a button; the lease dialog has three buttons and no checkbox; synthetic `screen {on}` puts the countdown in the header; a synthetic `target via click` updates "Looking at" with the element and regenerates starters once per window; with snapshots on, a synthetic capture after 3 s fills the chip and the Send label; stop returns the header to "Screen & mic off"; no checkbox in the panel, nothing scrolls at rest, no horizontal overflow at 360px. Screenshots of states 3 and 4 into `.artifacts/`.
- `verify-desktop-host.ps1`: `screen-on` installs the hook and border; a `SendInput` click on the host's own fixture window posts `target via click` with an element name; `screen-off` removes both; the lease expires on its own with a shortened timer flag; Ctrl+Shift+F12 tears it down.
- Definition of done includes the packaged app opened by hand, the border seen on a real window, and the chip seen after a real click.

## Security notes

The hook sees button events only. No coordinates are stored beyond the current click. Element names are bounded and values are never read. Screenshots stay local until Send, shown in full in the box as today. Protected windows are skipped at the shell. Malicious processes under the same user remain outside the boundary, as documented for Computer mode.

## Release B sketch (separate spec)

Computer mode's target follows the click instead of a picker. The border turns red when an action is armed and outlines the exact control. Enter approves, Escape rejects, or you click it yourself. Any mouse or key input from you cancels the pending action and returns the wheel. Still one approval per action, still the same broker.
