# Models, effort, and billing

Choose Astra (`gpt-6-astra`) through Codex and ChatGPT, or Fable 5.1 (`claude-fable-5-1`) through Claude Code and a paid Claude subscription. Effort choices are low, medium, high, xhigh, and max; medium is the default. Higher effort can take longer. Preferences persist in the browser, controls lock during builds, and revisions record the model and effort. Changing models resets sharing consent.

## Claude usage credits

The maintainer explicitly approved Claude subscription usage credits on 2026-09-05. Fable can automatically consume paid usage credits under the user's Claude account settings. This appears beside the selector and before build consent. Subscription authentication is required; Jarvis has no direct model API, API-key route, or automatic model fallback.

[Anthropic documents Fable usage credits](https://code.claude.com/docs/en/model-config#fable-and-usage-credits). An OAuth login or a successful usage-status check does not guarantee inference is included in a monthly allowance. Jarvis does not claim otherwise.

## Setup and isolation

Windows bundles Codex. For Fable, Setup downloads official Claude Code 2.1.261 directly from Anthropic's npm package, verifies pinned SHA-512 integrity and the Anthropic publisher signature, and installs per user. Anthropic binaries are not redistributed inside Jarvis. Existing supported installations and eligible logins are reused. Different Claude Code versions require installing the verified runtime from Setup.

The transport requires logged-in first-party `claude.ai` authentication and a paid subscription type. It disables custom settings, hooks, connectors, executable tools, MCP servers, session persistence, and automatic model switching. Only the internal StructuredOutput tool is allowed. Images travel through stdin; cancellation terminates the owned process tree. Output from another model, unexpected tools, incomplete results, and API/Console authentication are rejected. Never use `--bare`, which disables subscription OAuth.

## Local API

`GET /api/local-session` includes the fixed model catalog. `GET /api/session` accepts `X-Jarvis-Model` and `X-Jarvis-Effort` headers. Build/observe and setup POST bodies accept `model` and `effort`; omitted values retain Astra/medium compatibility. Unknown selections fail before inference or allowance consumption. Existing desktop/session authentication applies.

## Verification

28 unit tests, 13 model/effort browser assertions, and nine recovery browser checks pass without model calls. Run `node scripts/verify-models.mjs` for the selector suite. A real Windows installer run verified the official publisher and reused the existing subscription login. A real Fable image build at low effort completed in 34 seconds, returning five observations and 4,133 HTML characters. This is one observation, not a latency guarantee. Independent security review reported zero critical/high findings; its billing-documentation finding was corrected here.

Retro: checking billing semantics before inference exposed that subscription login alone does not enforce included-only usage. Explicit credit approval resolved that requirement. Keep provider-specific billing notices tied to fresh sharing consent whenever the selected provider changes.
