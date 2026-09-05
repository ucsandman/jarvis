# Jarvis onboarding, launch, and speed review

Reviewed 2026-09-05 against commit `f668896`. This is a prioritized review of the existing local workbench, with implementation and verification guidance. Application source was not changed during the review. The implementation is now delivered in 0.2.0; see CHANGELOG.md and PLAYBOOK.md for current behavior and verification. The findings below describe the reviewed commit, not the current release.

## Recommendation

Fix completed-result preservation, launch readiness, and setup recovery first. Then make revisions cheaper and shorten the path to a first useful result. Preserve the subscription-only Astra transport and explicit frame-sharing control. A different framework or model is not needed to address these findings.

Effort: S = hours, M = roughly a day, L = multiple days. Estimates include focused regression coverage. Risk describes the proposed fix. All findings below have high confidence in the observed behavior; product-direction benefits remain hypotheses until tested with users.

| Priority | Finding | Impact | Effort | Fix risk | Evidence |
| --- | --- | --- | --- | --- | --- |
| P1 | Persist completed generation before preview loading | A transient preview failure throws away a completed model result, requiring generation again. | S | Medium: preserve cancellation semantics and distinguish saved from rendered. | `public/app.js:208-215` |
| P1 | Separate launch readiness from subscription readiness | A working server is treated as unavailable when Codex status takes longer than the launcher's two-second request timeout. | S | Low: keep subscription checks on inference. | `scripts/start.ps1:6-19`, `server.mjs:55-57` |
| P1 | Make missing prerequisites and login recoverable | Missing Node can exit before the launcher's error dialog. Missing login leaves a disabled Build button and no setup/recheck actions. Windows Codex discovery accepts only one npm installation location. | M | Medium: authentication initiation must remain explicitly user-controlled. | `scripts/start.ps1:10`, `lib/subscription.mjs:14-24`, `public/app.js:313-323` |
| P1 | Make a typed revision use the existing one-turn path | Retaining the old reference causes another observation followed by generation even for a text-only edit. | M | Medium: make the choice explicit; preserve evidence and selected-frame consent. | `public/app.js:188-206`, `public/app.js:133-137` |
| P2 | Restore saved work independently of session checks | A failed session request prevents local history from loading and disables source access, even when versions remain in IndexedDB. | S | Low: preview still needs the local service; source/export need not. | `public/app.js:311-323`, `public/app.js:119-141`, `public/storage.js:12-19` |
| P2 | Expose actionable failure categories and session allowance | Limit, authentication, incomplete output, and other transport failures collapse into generic guidance. The UI ignores remaining operations; a visual build spends two. | M | Medium: use safe typed errors, never expose raw provider output. | `lib/subscription.mjs:100-108`, `lib/vision.mjs:47-51`, `server.mjs:57`, `server.mjs:95-106` |
| P2 | Keep build controls and progress visible | The composer follows the whole workbench, below the initial viewport in the inspected desktop layout. Mobile hides the only elapsed timer. | M | Low: verify focus, scrolling, keyboard, and unobstructed preview. | `public/index.html:96-101`, `public/style.css:45`, `public/style.css:205`, `public/app.js:190` |

## Fix and verification notes

### Preserve completed results

The browser receives valid generated HTML, then requests a preview and waits for its iframe before adding the revision to history. A preview error therefore leaves no source to download. Save accepted generation first; treat preview as a retryable presentation step. Keep canceled generation excluded and do not announce a running version before the frame is ready.

Verification: return a valid recorded build response, make `/api/preview` fail, and assert the completed version is still saved and downloadable. Reload and retry the preview with zero additional observation or build calls.

### Reliable one-click launch

Every readiness probe currently calls `/api/session`, which waits for `codex login status`. The launcher times out each probe after two seconds, while the server permits 15 seconds. The 20 polling iterations can take roughly 45 seconds, not merely the five seconds of explicit sleeps. An already-running server may also trigger an unnecessary second launch attempt after the initial probe times out.

Use an application-specific lightweight readiness response, separate from authentication. Catch missing or unsupported Node and startup failures around the entire launch path, and present useful graphical recovery. Support verified official CLI installations outside the single hard-coded Windows npm location. Avoid treating any unrelated listener as Jarvis.

Verification: inject a three-second subscription-status delay and confirm readiness succeeds promptly without spawning a duplicate. Exercise missing Node, unsupported Node, occupied port, and paths containing spaces. Keep actual subscription enforcement tests unchanged.

### Setup recovery

Provide an in-app prerequisite checklist with an explicit next action, a recheck button, and a clear distinction between ChatGPT authentication and Astra availability. Do not label login alone as proof that the account can use Astra. Missing authentication should not prevent exploring a local sample or exporting saved source. Opening or changing authentication requires the user's explicit action; never discover API keys or change the permitted transport.

Verification: first-run sessions with missing CLI, missing login, valid login, and a failed status request all produce useful recoverable states. No automatic login, model call, or alternative billing route occurs.

### Cheaper revisions

A browser trace of a sample build followed by “Change the heading to My tasks” showed four requests: observe + build, then observe + build again. The second build included previous source and the old image. Clearing the reference already enables one-turn generation, but this is not the obvious default flow.

Offer an explicit revision choice such as updating the current version without a new frame versus building from a selected reference. Preserve the original frame as evidence separately from the next request's attachment. One omitted observation means one fewer subscription turn per applicable revision; no wall-clock speedup percentage has been measured.

Verification: a typed revision without a newly selected reference makes one build request and zero observation requests. Choosing a new frame keeps the existing visible-frame and consent behavior.

### Local recovery and useful errors

Restore IndexedDB separately from session initialization. Keep saved HTML available for source and download when preview creation or subscription status is unavailable. Add a local reconnect/recheck action that preserves the user's unsent direction.

Return allowlisted error codes for authentication, allowance, timeout, incomplete output, and local service failure. Display the server's remaining operation count as Jarvis's local session budget, distinct from provider subscription allowance. Validate requests before charging that budget. If a visual build cannot complete within the remaining local budget, explain this before spending the observation turn.

Verification: seed two saved versions, fail `/api/session`, and confirm source/export remains available. Exercise each error code with synthetic failures and assert no raw diagnostics or credentials reach the page.

## Product direction, separate from defects

1. **Make the sample the primary first-run path.** Camera permission is currently the strongest call to action (`public/index.html:47-60`). Promote “Try a sample sketch,” place the direction/build action beside it, and explain the frontend-prototype scope plainly. Consider a clearly labeled prebuilt interactive example that works before authentication; the existing demo is evidence that such a walkthrough could be useful, but product assets should be curated rather than read from ignored verification artifacts. Effort M, low implementation risk. Measure time and clicks to the first interaction.
2. **Reduce the first visual build to one model turn only after discussion.** Observation gates unreadable input, but its result is not sent to generation; generation independently receives the image (`lib/vision.mjs:54-77`). A combined structured response could remove serial work, but changes the architecture and when observations become visible. Benchmark the existing two-turn path first, then discuss a combined response or explicitly optional analysis with the maintainer. Effort M/L, medium risk. No such change was made.

## Verification performed

- `npm test`: 13 tests passed, zero failed. No model requests.
- `node scripts/check.mjs`: syntax checked 12 JavaScript files, four required assets present, local noindex verified. This is the implementation used by both lint and build scripts.
- The harness intercepted `npm run lint` and returned an ESLint JSON-parser error. The direct project check above passed; this was not evidence of a source lint failure.
- Six isolated browser scenarios: initial readiness; visual build followed by typed revision; failed session with saved history; missing login; completed generation followed by preview failure; mobile layout. Zero page errors.
- Initial browser readiness was 232 ms on the already-running local server. This is one warm measurement, not cold-launch or generation latency.
- Typed revision reproduced the extra observation request. Failed session displayed zero restored versions and disabled Source. Missing login disabled Build with zero setup/recheck buttons. Preview failure left zero saved versions and disabled Download.
- At 390 px, no horizontal overflow; elapsed activity was hidden.
- Inspected the rendered desktop screenshot. Evidence screenshots are in ignored `.artifacts/review-initial.png` and `.artifacts/review-login.png`.
- Browser inference requests were intercepted using recorded synthetic-demo responses. No fresh subscription inference, real webcam upload, microphone recording, installation, or authentication change was performed.

Not audited end to end: clean-machine installation, cold CLI startup, real webcam/microphone behavior, current medium-effort generation latency, Linux process-tree cancellation, complete accessibility conformance, or an exhaustive security audit.

## Considered and rejected

- Framework migration, bundling, and additional runtime dependencies: no measured bottleneck justifies them. The app already becomes ready quickly against the running local server.
- Alternate model providers or metered APIs: prohibited and unnecessary for the recommended improvements.
- “Cancellation is broken”: the inspected path propagates browser abort to the owned process; no specific failure was reproduced. Linux descendant cleanup was not verified.
- “The launcher waits only five seconds”: incorrect. Individual requests add up to two seconds per poll; the finding is the per-request authentication/readiness mismatch.

## Review retro and deviations

What worked: isolated browser contexts and intercepted inference reproduced failures without sharing private frames or spending subscription allowance.

What did not: the initial update prematurely promised implementation before the audit established scope; a subreview also understated the polling duration. Both were corrected before this report.

Change for the next pass: state review scope before proposing edits, and require a browser failure case plus correctly accounted timing for each launch/recovery fix. This file records the review; source changes, login flows, architecture changes, commits, and publication remain separate work.
