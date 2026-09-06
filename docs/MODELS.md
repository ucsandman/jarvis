# Models, effort, and streaming

`public/models.js` is the single model catalog for the selector page and the server, so they can never disagree. Each entry pins one model on one official CLI, on the subscription that CLI is signed in with.

| Model | ID | CLI and account | Effort levels |
| --- | --- | --- | --- |
| Astra | `gpt-6-astra` | Codex, ChatGPT subscription | low, medium, high, xhigh, max |
| GPT-5.6 Sol | `gpt-5.6-sol` | Codex, ChatGPT subscription | low, medium, high, xhigh, max |
| GPT-5.6 Terra | `gpt-5.6-terra` | Codex, ChatGPT subscription | low, medium, high, xhigh, max |
| GPT-5.6 Luna | `gpt-5.6-luna` | Codex, ChatGPT subscription | low, medium, high, xhigh, max |
| GPT-5.5 | `gpt-5.5` | Codex, ChatGPT subscription | low, medium, high, xhigh |
| GPT-5.4 Mini | `gpt-5.4-mini` | Codex, ChatGPT subscription | low, medium, high, xhigh |
| GPT-5.3 Codex Spark | `gpt-5.3-codex-spark` | Codex, ChatGPT subscription | low, medium, high, xhigh |
| Fable 5.1 | `claude-fable-5-1` | Claude Code, paid Claude subscription | low, medium, high, xhigh, max |
| Opus 5 | `claude-opus-5` | Claude Code, paid Claude subscription | low, medium, high, xhigh, max |
| Sonnet 5 | `claude-sonnet-5` | Claude Code, paid Claude subscription | low, medium, high, xhigh, max |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | Claude Code, paid Claude subscription | low, medium, high, xhigh, max |

GPT-5.5, GPT-5.4 Mini and GPT-5.3 Codex Spark stop at xhigh; the rest go to max. Picking a model whose levels don't include the saved effort moves it to that model's deepest level and says so under the effort control. Your choices persist in the browser, medium is the compatibility default, and the low-effort shortcut is the fast path for a small request. Changing the model resets sharing consent.

## Billing

Anthropic models can spend paid Claude usage credits under your account settings. The notice sits beside the selector and shows again before sharing consent. An OAuth login doesn't guarantee included-only billing. See [Anthropic's usage credits documentation](https://code.claude.com/docs/en/model-config#fable-and-usage-credits).

Sidelook has no direct model API, no API-key route, and no automatic model fallback. Missing subscription auth, model access or allowance fails closed.

## Local models

LM Studio and Ollama models run on your own computer and cost nothing per request. They appear in the selector under their runtime's name while the runtime is running, listed from what it holds right now (LM Studio's `GET /api/v0/models`, chat models only; Ollama's `GET /api/tags`). Sidelook talks to the runtime through the official Codex CLI's open-source provider (`codex exec --oss --local-provider lmstudio` or `ollama`, `--model` set to the runtime's own key), inside the same read-only sandbox and with the same disabled tools as a subscription model. Effort levels are low, medium and high; models without a reasoning mode ignore them.

Setup for a local model checks that Codex is available, that the runtime answers, and that the chosen model is still listed. If LM Studio's server is off, Setup offers **Start LM Studio server**, which runs LM Studio's own `lms server start`. Ollama is started by you (`ollama serve`). A model that disappears from the runtime fails closed with a message; Sidelook never picks another one.

Quality depends on the model. LM Studio does not enforce Codex's `--output-schema` (measured 2026-09-06: the model answered in prose), so for a local model the schema rides inside the instructions and Sidelook reads the one JSON object out of the reply, fenced or not. A reply that is still words gets one more run with that fact in the instructions (the same prompt gave JSON on the next try in every measured case); if the conversation still gets words, they become the reply, since a plain-text answer is still an answer. A build needs HTML and fails closed instead. Measured on Qwen3 8B at medium effort: eight compactions through the server, all eight answered, four of them on the retry.

Effort for a local model: **low turns reasoning off** (Codex's `model_reasoning_effort="none"`, which LM Studio maps to its reasoning-off switch); medium and high leave it on. Measured with Qwen3 8B: a warm turn took 8 s with reasoning off and 28 to 48 s with it on.

Speed on a small GPU. Codex's own prompt is about 12,700 tokens before Sidelook adds anything, so the model is loaded with a 32,768-token context, and that cache does not fit beside an 8B model in 8 GB. LM Studio's default of every layer on the GPU then swaps through the driver: prefill took 150 s and generation ran at 5 tokens/s on an RTX 3070 Ti. Sidelook therefore loads the model with a GPU share computed from the card (nvidia-smi) and the model's size, leaving 5 GB for the cache: 0.6 on that card, which measured 80 s for the first cold turn and 8 to 34 s warm, because LM Studio keeps the Codex prefix cached between turns. Machines without nvidia-smi leave the share to LM Studio. The first send after a load pays the cold prefill; local chats get a 300 s budget instead of 120 s.

## Setup

Windows ships with Codex bundled. For any Anthropic model, Setup's install button downloads official Claude Code 2.1.261 from Anthropic's npm package, checks its pinned SHA-512 integrity and publisher signature, and installs it per user. No Anthropic binaries are redistributed inside Sidelook. Supported existing installs and logins are reused. A different Claude Code version means installing the verified runtime from Setup.

For source installs, Codex discovery supports official npm layouts on PATH. Claude Code discovery supports its native user install and official native npm package layouts. The graphical installer is Windows x64 only.

## Streaming

Anthropic models use Claude Code's partial structured-output messages. Sidelook forwards only the HTML field from an active StructuredOutput block, never thinking text, tool logs or auth output. It asks for HTML first and calls StructuredOutput directly instead of writing the JSON twice. The draft updates as real chunks arrive. The initial reasoning still takes its time.

The installed Codex exec interface releases finished agent messages. Sidelook shows their HTML when it has some, and doesn't fake token streaming. Codex's separate app-server interface needs an equivalent config-isolation boundary before it can replace the current transport.

Drafts are labeled and run in a script-disabled sandbox. Switch to the last working version any time. Only a successful, validated final result enters history. Canceled, failed or completed builds revoke their temporary draft URLs.

## Local protocol

- `GET /api/local-session` returns the model catalog and local session token.
- `GET /api/session` accepts `X-Sidelook-Model` and `X-Sidelook-Effort` headers.
- Build/observe and setup bodies accept `model` and `effort`. Leaving them out keeps the Astra/medium compatibility behavior.
- `POST /api/build` with `Accept: application/x-ndjson` streams `phase`, `draft`, and a terminal `result` or `error` record. Without that header you get the existing JSON response.
- The initial phase carries a temporary `draftSession`. An authenticated `POST /api/preview` with `draft: true`, that session, and bounded HTML creates a non-executable preview. Sessions expire when the build ends.

All the existing session, desktop-key, consent, input-validation, concurrency, timeout and allowance checks apply. Invalid selections fail before inference. An incomplete stream is not a successful build.

## Verification

Tests cover partial JSON escapes, output filtering, unexpected models and tools, early process output, sanitized stream failure, draft CSP and revocation. Browser checks cover progressive updates, script blocking, switching to the working version, cancellation, completion and the mobile layout. Tests also cover every catalog entry selecting, each CLI receiving its own pinned model ID, and an unsupported effort being refused.

One real Fable/low request produced first HTML at 18.9 seconds and finished at 20.5 seconds with two draft updates. The result was 2,949 characters. That's one data point, not a latency guarantee or a comparison with a different request.

## Computer planning

Computer mode uses the same pinned model and effort, the same auth and the same isolated subscription inference. Its output schema describes one proposed Windows accessibility action instead of HTML. Neither CLI executes the action. The local broker waits for a separate human approval. Each Plan next action costs one request, with a 20-step ceiling per ten-minute control session plus the shared local allowance. Nothing executes on the desktop while a model is thinking.
