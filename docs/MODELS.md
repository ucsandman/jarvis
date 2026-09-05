# Models, effort, and streaming

Choose Astra (`gpt-6-astra`) through Codex and an eligible ChatGPT subscription, or Fable 5.1 (`claude-fable-5-1`) through Claude Code and a paid Claude subscription. Effort choices are low, medium, high, xhigh, and max. Existing choices persist in the browser; medium is the compatibility default. Use the low-effort shortcut for a smaller, faster request. Model changes reset sharing consent.

## Billing

Fable can automatically consume paid Claude usage credits under your account settings. The notice appears beside the selector and before sharing consent. An OAuth login does not guarantee included-only billing. See [Anthropic's Fable billing documentation](https://code.claude.com/docs/en/model-config#fable-and-usage-credits).

Jarvis has no direct model API, API-key route, or automatic model fallback. Missing subscription authentication, model access, or allowance fails closed.

## Setup

Windows includes Codex. Fable's Setup button downloads official Claude Code 2.1.261 from Anthropic's npm package, verifies pinned SHA-512 integrity and its publisher signature, and installs per user. Anthropic binaries are not redistributed inside Jarvis. Supported installations and eligible existing logins are reused. A different Claude Code version requires installing the verified runtime from Setup.

For source installations, Codex discovery supports official npm layouts on PATH. Claude Code discovery supports its native user installation and official native npm package layouts. The graphical installer is Windows x64 only.

## Streaming

Fable uses Claude Code's partial structured-output messages. Jarvis forwards only the HTML field from an active StructuredOutput block, never thinking text, tool logs, or authentication output. It asks for HTML first and calls StructuredOutput directly rather than writing the JSON twice. The draft updates as real chunks arrive; initial reasoning can still take time.

The installed Codex exec interface releases completed agent messages. Jarvis displays their HTML when available but does not simulate token streaming. Astra's separate app-server interface needs an equivalent config-isolation boundary before it can replace the current transport.

Drafts are labeled and use a script-disabled sandbox. Switch to the last working version anytime. Only a successful, validated final result enters history. Canceled, failed, or completed builds revoke their temporary draft URLs.

## Local protocol

- `GET /api/local-session` returns the fixed model catalog and local session token.
- `GET /api/session` accepts `X-Jarvis-Model` and `X-Jarvis-Effort` headers.
- Build/observe and setup bodies accept `model` and `effort`; omission retains Astra/medium compatibility.
- `POST /api/build` with `Accept: application/x-ndjson` streams `phase`, `draft`, and terminal `result` or `error` records. Without that header, the existing JSON response is preserved.
- The initial phase carries a temporary `draftSession`. Authenticated `POST /api/preview` with `draft: true`, that session, and bounded HTML creates a non-executable preview. Sessions expire when the build ends.

All existing session, desktop-key, consent, input-validation, concurrency, timeout, and allowance checks apply. Invalid selections fail before inference. Incomplete streams are not successful builds.

## Verification

Tests cover partial JSON escapes, output filtering, unexpected models/tools, early process output, sanitized stream failure, draft CSP and revocation. Browser checks cover progressive updates, script blocking, switching to the working version, cancellation, completion and mobile layout.

One real Fable/low request produced first HTML at 18.9 seconds and finished at 20.5 seconds with two draft updates. The result was 2,949 characters. This is not a latency guarantee or a comparison with a different request.

## Computer planning

Computer mode uses the same pinned model and effort selection, authentication and isolated subscription inference. Its output schema describes one proposed Windows accessibility action instead of HTML. Neither CLI executes the action. The local broker waits for a separate human approval. Each Plan next action consumes one request, with a 20-step ceiling per ten-minute control session plus the shared local request allowance. No incremental desktop action executes while a model is thinking.
