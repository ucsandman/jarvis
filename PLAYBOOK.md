# Jarvis build notes

## Scope and decisions

Jarvis turns a selected camera frame or uploaded reference plus typed or locally dictated direction into an interactive frontend prototype. Further directions revise the selected source version.

- Astra runs through the official Codex CLI with ChatGPT subscription authentication. No model API, API credentials, or fallback transport is permitted.
- Camera preview stays local until a user chooses to build. The selected frame and observations remain visible in the workbench.
- Generated HTML runs inside a restricted browser frame. Host code execution, backends, deployment, and continuous camera inference are outside this release.
- Use Node built-ins and browser APIs. The application has no package dependencies.

## Implementation lessons

- Preview readiness waits for frame load and rendered layout before announcing a version. Otherwise the label can appear before controls accept clicks.
- JavaScript-handled forms need `allow-forms` in both iframe and response sandbox policies. `form-action 'none'` continues to block form destinations.
- Host-header rejection is tested with raw HTTP because Node fetch does not reliably preserve a custom Host header.
- Browser checks target visible task cards because generated applications may also render hidden views.
- Treat incomplete generation and provider failure as failed revisions. Preserve the previous version and never switch transport or billing route.
- Check child-process exit status and the explicit completion event before accepting output.

## Verified demo · 2026-09-05

| Check | Result and scope |
| --- | --- |
| Subscription inference | Astra read the synthetic sketch and generated the DAYLIGHT task board. |
| Full build | 23,539 HTML characters in 237.5 seconds at high reasoning effort. The current application runner requests medium effort. |
| Live revision | A second version added a 25-minute Focus timer through the actual workbench. |
| Generated revision controls | Five checks passed: Start, Pause, Reset, task creation/filtering, and three preserved columns. Zero page errors. |
| Workbench browser checks | Eight checks passed, covering consent, synthetic camera input, rendering, source/download, persistence, mobile layout, and project reset. Zero page errors. |
| Unit tests | All 13 passed. Covers input boundaries, host/origin checks, consent, sandbox headers, concurrency, budgets, redaction, subscription enforcement, and cancellation. |
| Fresh source copy | Installation, tests, syntax, and required-asset checks passed. |

The screenshots in `docs/images/` show real generated outputs using synthetic references. Live webcam sharing and microphone dictation remain unverified end to end. Runtime state inside generated apps resets when reopened.

## Public release retro

What worked: reviewed synthetic demo screenshots supplied evidence without sharing private camera images or repeating inference.

What needed correction: session notes contained machine-specific and conversational context that does not belong in public documentation. They were preserved locally and excluded from publication.

Change: review an explicit publish manifest, scan staged content, and verify the remote commit and CI before reporting a release complete. The public repository is the release surface; there is no separate hosted website or package publication.


## Onboarding release · 0.2.0 · 2026-09-05

### Decisions and behavior

- A combined visual build returns observations and HTML in one Astra subscription turn. Typed revisions send selected source and direction; an old reference remains as evidence but is unchecked for the next request.
- Completed generation is accepted and persisted before preview work. Preview failure does not require regeneration. Local source restoration and local preview sessions do not wait for subscription readiness.
- The built-in DAYLIGHT example is explicitly labeled sample content and is usable before login. It uses the same restricted preview and version history as generated work.
- Setup actions are human-operated buttons: install the official npm CLI, sign in with ChatGPT, recheck, reconnect, and renew the local request allowance. They do not introduce a model transport or alternate billing route.
- CLI discovery supports official npm package layouts in standard and custom prefixes. Native executable-name fallback is intentionally excluded. Metadata validation does not protect against modification by the local account owner.
- The README and public Vercel site are product surfaces. The later 0.3.0 release adds a bundled Windows executable; see docs/SITE.md and docs/WINDOWS.md for their separate allowlisted release paths.

### Verification

- 21 unit tests passed. Five new recovery tests were observed failing against the original code before implementation, then passed unchanged.
- Nine isolated recovery browser checks and eight workbench browser checks passed, each with zero page errors. The isolated suite uses a dedicated server and synthetic inference; it never installs software or signs in.
- A real combined visual build completed through Astra/ChatGPT in 209.7 seconds at medium reasoning effort, producing 22,342 HTML characters and observations. This is not a controlled comparison to the earlier high-effort two-turn build.
- The generated app passed task creation and filtering inside the restricted preview. A real typed revision through the UI added a Focus timer; five follow-up checks passed: initial time, Start, Pause, Reset, and preserved task creation/search.
- A fresh source copy of 38 files passed npm installation, all 21 tests, lint, and build.
- The Windows launcher started the server and opened the workbench in 2.87 seconds in one local run. A second launch reused the same server process. PowerShell parsing passed. Missing Node and occupied-port paths have source-level handling, not fresh-machine end-to-end proof.
- The separate security review cleared the final npm-only discovery, explicit setup operations, server-side consent and session controls, safe errors, and preview isolation.
- Actual CLI installation and interactive account sign-in were not invoked against the operator's existing installation/account. Their request/consent paths were checked with injected operations. Real webcam and microphone input remain unverified; camera browser checks use a synthetic device.

### Local routes

All state-changing routes require the local Host/Origin boundary, `Content-Type: application/json`, and an `X-Jarvis-Session` header from the local session response. Tokens are per-process and should never appear in logs or documentation examples.

| Route | Request | Response / purpose |
| --- | --- | --- |
| `GET /api/health` | none | `{ "app": "jarvis-workbench", "ready": true }`; lightweight launcher readiness, no CLI call. |
| `GET /api/local-session` | none | Local session token, remaining request count, and Windows dictation availability; no subscription check. |
| `GET /api/session` | none | Local token plus CLI availability, ChatGPT login status, model name, and remaining local count. Login is not proof of model entitlement. |
| `POST /api/build` | `{ "instruction": "Build a task board", "previous": "", "image": null, "consent": true }` | Validated result with title, reply, changes, HTML, and observations for image builds. One subscription turn. |
| `POST /api/observe` | Image data URL, optional instruction, `consent: true` | Standalone visual analysis; retained for explicit diagnostics. |
| `POST /api/preview` | `{ "html": "<html>...</html>" }` | Restricted preview URL; no inference. |
| `POST /api/login` | `{ "consent": true }` | Starts official ChatGPT browser sign-in and returns safe status when complete. |
| `POST /api/install-codex` | `{ "consent": true }` | Installs fixed `@openai/codex` from the official npm registry globally with scripts disabled; returns safe status. |
| `POST /api/reset-budget` | `{ "consent": true }` | Renews only Jarvis's local allowance. Saved versions and provider allowance are unchanged. |

The UI sends setup requests only after explicit button actions; installation and allowance renewal have confirmation dialogs. Setup/inference share a single busy guard and reject overlap. Failures expose allowlisted codes and messages, never raw CLI output. Invalid model input is rejected before the local allowance is charged.

### Release retro

What worked: failure-first regression checks and isolated browser profiles caught lost completed results and unnecessary reference sharing without spending subscription allowance. Real subscription checks then proved the combined build and revision paths.

What needed correction: broad executable discovery weakened the official-CLI boundary, and the camera button was hidden once a reference had been selected. The lint wrapper also attempted to parse a non-ESLint check as ESLint output.

Change: retain npm-layout validation and negative discovery tests; keep input controls outside replaceable preview content; run the repository's actual lint/build scripts through its npm CLI when the harness wrapper misclassifies them. Keep these gates in the release checks.

## 0.3.0 Windows and public launch

Website follow-up: retaining the rejected task board behind an optional disclosure did not address the maintainer's feedback. Removed the public section and hosted sample entirely. When a demo does not explain the product, remove it rather than merely demoting it.

The Windows download bundles the official runtime and CLI, opens a graphical browser workbench, and provides desktop/Start menu shortcuts and tray Open/Quit. Its build uses an explicit source allowlist, a fresh staging directory, pinned package integrity and verified upstream publishers. The Jarvis launcher itself is unsigned and this is disclosed beside the public download. Local subscription architecture and camera consent are unchanged.

Verification: 22 unit tests and syntax/build checks pass. Nine recovery browser checks pass. The rebuilt executable passes 18 assertions covering extraction with system-only PATH, bundled discovery, explicitly isolated signed-out CLI status, API bootstrap denial, removed URL fragments, port-isolated browser storage, rendered preview and reload. Six actual Windows lifecycle checks pass, including occupied-port refusal, second-click reuse, Quit and forced launcher termination. No new inference or interactive sign-in was required for this package release; the earlier real subscription build/revision evidence remains above.

Retro: the bundled runtime and process ownership checks worked. The first public task board confused an app input with a Jarvis prompt, so the site now shows the actual sketch, captured build and captured revision before offering the optional sample. The next demo must show the product's transformation, not just an output app's controls.

Security review caught unauthenticated cross-account loopback access, then a cookie-based fix that leaked across ports. The final executable uses a random launch key in origin-isolated session storage and API headers; preview URLs are separate random capabilities. Preserve negative raw-client checks and never use host cookies for loopback port isolation. The external review service became unavailable before its final re-review; final source and executable checks were completed locally.

Packaging failures: Windows PowerShell could not deserialize npm's empty root-package property, and native argument quoting stripped JavaScript string quotes. Parsing package integrity through Node stdin fixed both. HOME overrides also failed to create an unsigned-in Windows identity; the verifier now uses an explicit isolated CLI storage directory only for the signed-out status probe and does not claim a fresh OS account. Preserve these real failure cases when changing the packager or verifier.

Public hosting remains a static allowlisted deployment on the approved existing Vercel Pro team. Google and Bing ownership are verified and sitemaps submitted. Initial Google indexing request hit the account's daily quota; indexing is not guaranteed. Standard Vercel analytics is enabled, without the Plus add-on.

## 0.4.0 provider and effort verification

- 28 unit tests, 13 model/effort browser assertions, nine recovery browser checks, and 24 local public-site checks passed. Static verification checked 25 JavaScript files.
- Installed the pinned official Claude Code runtime through the production installer: archive checksum and Anthropic publisher verified; existing paid first-party login reused without exposing credential output.
- A real Fable image build at low effort completed in 34 seconds with five observations and 4,133 HTML characters. Its restricted preview passed five checks: load, task creation, search, movement, and zero page errors.
- Independent security review found no critical/high issue. Its stale billing-documentation finding was fixed before packaging.

Retro: the provider mechanism and rendered output worked. Initial preview QA used an incorrect session header and correctly received HTTP 403; using the server's actual header fixed the probe. Derive future verification clients from the canonical endpoint contract. Subscription OAuth does not prove included-only billing; preserve explicit credit notices and fresh consent on provider changes.

DEVIATIONS: Claude Code installs directly from Anthropic through Setup instead of redistribution inside the executable. The no-terminal flow is preserved. The user explicitly allowed Claude subscription usage credits; no direct model API was introduced.

Packaging evidence: the final 0.4.0 executable is 171,300,352 bytes. All 18 packaged-app assertions and six actual Windows lifecycle checks passed. Payload inventory checked 37 files, including 27 text files, with seven current-source matches and zero credential filenames or secret/private-path matches. A clean staged-source checkout passed npm ci, 28 tests, lint and build. The production dry-run contains 12 public files and excludes generated environment data.
