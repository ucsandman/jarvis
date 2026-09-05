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
- The existing README is the public product surface. There is no separately hosted marketing site, registry package, or deployment target in this repository.

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
