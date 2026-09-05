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
