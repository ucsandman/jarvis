# Models, effort, and streaming

Astra (`gpt-6-astra`) runs through Codex on an eligible ChatGPT subscription. Fable 5.1 (`claude-fable-5-1`) runs through Claude Code on a paid Claude subscription. Effort is low, medium, high, xhigh or max. Your choices persist in the browser, medium is the compatibility default, and the low-effort shortcut is the fast path for a small request. Changing the model resets sharing consent.

## Billing

Fable can spend paid Claude usage credits under your account settings. The notice sits beside the selector and shows again before sharing consent. An OAuth login doesn't guarantee included-only billing. See [Anthropic's Fable billing documentation](https://code.claude.com/docs/en/model-config#fable-and-usage-credits).

Jarvis has no direct model API, no API-key route, and no automatic model fallback. Missing subscription auth, model access or allowance fails closed.

## Setup

Windows ships with Codex bundled. Fable's Setup button downloads official Claude Code 2.1.261 from Anthropic's npm package, checks its pinned SHA-512 integrity and publisher signature, and installs it per user. No Anthropic binaries are redistributed inside Jarvis. Supported existing installs and logins are reused. A different Claude Code version means installing the verified runtime from Setup.

For source installs, Codex discovery supports official npm layouts on PATH. Claude Code discovery supports its native user install and official native npm package layouts. The graphical installer is Windows x64 only.

## Streaming

Fable uses Claude Code's partial structured-output messages. Jarvis forwards only the HTML field from an active StructuredOutput block, never thinking text, tool logs or auth output. It asks for HTML first and calls StructuredOutput directly instead of writing the JSON twice. The draft updates as real chunks arrive. The initial reasoning still takes its time.

The installed Codex exec interface releases finished agent messages. Jarvis shows their HTML when it has some, and doesn't fake token streaming. Astra's separate app-server interface needs an equivalent config-isolation boundary before it can replace the current transport.

Drafts are labeled and run in a script-disabled sandbox. Switch to the last working version any time. Only a successful, validated final result enters history. Canceled, failed or completed builds revoke their temporary draft URLs.

## Local protocol

- `GET /api/local-session` returns the fixed model catalog and local session token.
- `GET /api/session` accepts `X-Jarvis-Model` and `X-Jarvis-Effort` headers.
- Build/observe and setup bodies accept `model` and `effort`. Leaving them out keeps the Astra/medium compatibility behavior.
- `POST /api/build` with `Accept: application/x-ndjson` streams `phase`, `draft`, and a terminal `result` or `error` record. Without that header you get the existing JSON response.
- The initial phase carries a temporary `draftSession`. An authenticated `POST /api/preview` with `draft: true`, that session, and bounded HTML creates a non-executable preview. Sessions expire when the build ends.

All the existing session, desktop-key, consent, input-validation, concurrency, timeout and allowance checks apply. Invalid selections fail before inference. An incomplete stream is not a successful build.

## Verification

Tests cover partial JSON escapes, output filtering, unexpected models and tools, early process output, sanitized stream failure, draft CSP and revocation. Browser checks cover progressive updates, script blocking, switching to the working version, cancellation, completion and the mobile layout.

One real Fable/low request produced first HTML at 18.9 seconds and finished at 20.5 seconds with two draft updates. The result was 2,949 characters. That's one data point, not a latency guarantee or a comparison with a different request.

## Computer planning

Computer mode uses the same pinned model and effort, the same auth and the same isolated subscription inference. Its output schema describes one proposed Windows accessibility action instead of HTML. Neither CLI executes the action. The local broker waits for a separate human approval. Each Plan next action costs one request, with a 20-step ceiling per ten-minute control session plus the shared local allowance. Nothing executes on the desktop while a model is thinking.
