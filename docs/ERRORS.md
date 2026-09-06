# Implementation lessons

## 2026-09-05: Identity and copy pass

- The site verifier passed against a stale `docs/images/companion.png` after the companion copy changed, because it checks the asset exists, not what it shows. Regenerate the companion capture from the packaged app whenever companion copy or the mark changes, then rebuild the social image and the site.
- The dock's white square came from the form background showing around an elliptical button region. Shaping the form itself (rounded-square Region in dock mode, cleared in the other modes) removes the backdrop; the button only paints the mark.
- `scripts/verify-browser.mjs` had two stale assumptions: it waited for "Astra · subscription" (the status has read "Astra · medium" since the effort selector landed) and it pointed at port 4317, which the desktop launcher now owns behind the launch key, so a plain browser saw "Setup needed". It is now self-hosted on a free port with a synthetic signed-in status like the other verifiers, and asserts the `#provider-status` label against the model plus effort pattern. It still needs the recorded `.artifacts/generated.json` and `observation.json` from a real verify:vision run.

## 2026-09-05: Desktop companion release

- Keeping the companion and workbench in one document preserved existing camera, build, version, and Computer mode behavior across expansion. Separate browser profiles would not preserve old saved work automatically; explicit HTML import now adds a desktop version without overwriting the existing history.
- Desktop capture review found that a screen-region copy could include an overlapping window. Capture now uses the selected window directly, snapshots its identity, validates it again, and refuses unsupported capture instead of falling back to a desktop crop.
- Stop and reload can race a native capture. Unique capture request IDs, host cancellation generations, and page-exit cancellation prevent late results from becoming the next message's reference. Future native operations must carry a request identity across the bridge.
- The marketing sweep initially retained browser-only storage and startup wording. The release check now includes the complete startup, storage, migration, and shutdown story, alongside rendered desktop and mobile pages.
- The local command-output wrapper treated `npm run lint` as ESLint JSON even though this project uses a syntax checker. Running npm's installed CLI entrypoint directly produced the actual passing output; no application lint rule was relaxed.
- Native automation must wait for connection completion and explicitly focus its owned fixture before capture. A background fixture can lose foreground ownership; verification refuses to save or share any other window's frame.
- Rendered native QA exposed a panel that stayed wide after workbench expansion. Lowering the native minimum size before setting the compact client size fixes the transition; the verifier now checks the restored width. Expanded windows are also clamped to the monitor's working area.

## 2026-09-05: Computer mode verification

- A PowerShell-hosted UI fixture was correctly excluded by the terminal process filter. A standalone compiled fixture let the test exercise real UI without weakening the guard.
- Hidden process startup suppressed the fixture's window. Native UI tests now open only their owned fixture visibly and close it by its captured process handle.
- Requiring foreground focus for every UIA action rejected otherwise valid operations. Target-bound UIA patterns now act directly; only focus and keyboard operations require proven foreground focus.
- A review found that validating a fresh element but invoking a pattern from the old element defeated the re-resolution. Execution now obtains the pattern from the fresh, verified element and also binds parent context and accessible state.
- A regex review mistakenly double-escaped JSON-rendered source. Tests now load the compiled native regexes and check both blocked and ordinary strings.
- The ship audit must update both the existing prototype walkthrough and the new Computer guide. Keep capabilities and limitations adjacent to each mode, and verify both public surfaces in the same release.
- A lifecycle review found that apps launched by the native helper would inherit the server's kill-on-close Job Object. Packaged fixed app launches now originate from the desktop launcher, outside that job; runtime helpers remain contained. Verify user-app survival after Quit before publishing.

- Windows 11 had Paint installed as a Store app with no System32 mspaint.exe. Fixed app launches now use a fixed registered Windows app ID when the system executable is absent; no arbitrary launch target is accepted.
- The Stop button must remain usable in a new tab even when that tab has no owning-session token. A failed page-close request can leave an old lease active; Stop now stays available to revoke it immediately instead of waiting for expiry.
- The packaged system-only-PATH probe could not find powershell.exe by name. Computer mode now resolves Windows PowerShell through the absolute Windows system path, removing that PATH dependency.

## 2026-09-05: One-column redesign

- The old companion status line overwrote "screen & mic off" with "selected snapshot only" the moment a frame was attached, so the promise disappeared exactly when it mattered. One `statusLine()` now computes the sensor clause from live state and appends the attachment instead of replacing it; the unit test asserts both halves are present.
- The companion's Include box never unticked after a send, so a second message silently carried the first frame again. `spend()` clears the tick and, when the frame went, the Include box; the companion verifier asserts both after the first send.
- Cascade layers bit twice: a 900px rule set `.app-shell{display:block}` and beat the companion-surface hide in the layout layer, and the unlayered `#companion{display:flex}` in companion.css beat the layered 1180px hide. Surface rules that must win live next to the rule they override, in the same file and layer.
- Playwright's modal dialogs block clicks behind them. The verifiers now open Settings, change, and close it explicitly; the app only opens Settings by itself when sign-in is needed, never on a transport error.
- Stop from the column reported "Computer control is stopped" even when nothing had been enabled, because the panel's Stop always clicks the Computer stop to revoke a stale lease. The message now shows only when a session was actually on; the revoke call still runs.
- The packaged exe embeds `public/`, so a hand check against the built exe does not see a source edit made after the build. Rebuild before reading the exe as evidence.
- A destructured `const {reading}` inside `submit()` shadowed the module-level `reading` flag that the same function reads in its first line, so every send threw a temporal-dead-zone ReferenceError and no error ever rendered. The companion verifier caught it as "unticked sharing line sends zero requests" failing for the wrong reason; the fix is a distinct local name. Do not reuse a state flag's name for a per-call value.
- Subagents were blocked for a whole session by a DashClaw hook bug, not by policy: the execution claim sent the bare parent agent id while the action was recorded under `<parent>:<agent_type>`, so the server answered 409. Root cause found by fetching the stored action and comparing `agent_id`; fixed in the DashClaw hook (a0c24eb6) with a regression test.
- Post-send bookkeeping (untick Include, relabel the strip "Sent", append to the ledger) sat in a `finally`, so a 409, a 429 or a Stop looked exactly like a send. The review caught it in three surfaces at once. Rule: only the response decides what happened; the tick is the one thing that clears on any attempt.
- The read-only window read shared the Computer route's socket-close handler, which calls `computer.stop()` for every op but `status`; a page reload during a slow read would have torn down an armed session and killed the helper. New ops on a shared route inherit its abort semantics until told otherwise.
- Text-first chips were assigned per chip, but the helper's safety filter excludes every terminal window from `windows`, so a terminal could never be read and the badge lied. What a chip takes is a property of the window family in front, not of the chip.

## 2026-09-05: One box, one button

- The 0.9.0 panel passed every verifier and the maintainer still rejected it on sight: a scrolling box inside a 440px window, a checkbox sentence, two Include boxes, a chip strip with arrows, a Computer card under the chat. The verifiers checked consent and evidence, never the shape. The redesign added three shape assertions to the companion verifier (no checkbox, no details arrow, nothing scrolls at rest) so the next regression fails a check instead of a review. Rule: a UX bar the maintainer states ("dead simple, like Loom") becomes a verifier assertion in the same change, not a note.
- The Computer step label used `text-transform:uppercase` on a sentence ("Step 1 of 20 · waiting for you"), which DESIGN.md forbids and which turned the verifier's innerText into caps so its regex failed. The transform went, not the regex. Playwright's innerText is post-CSS; assert on what the user reads.
- The design was mocked as four states in one HTML page and approved before the code changed; the implementation then passed both browser verifiers on the first run apart from the caps label. Mock before wire held.
