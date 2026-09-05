# Contributing

Start from a concrete user workflow or a bug you can reproduce. For anything substantial, open an issue first and say what a user should be able to do afterwards.

## Development

Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4317`. Refresh after frontend changes. After a server restart, hit Reconnect to restore the local session.

Before you submit:

```sh
npm test
npm run lint
npm run build
npm run verify:recovery
npm run verify:stream
node scripts/verify-live.mjs
node scripts/verify-models.mjs
```

Browser checks need Chrome plus Playwright, or an existing global `@playwright/cli`. They use synthetic generation. Real-provider checks spend subscription allowance or Claude usage credits. Use public synthetic references, never private desktop or camera content.

## Boundaries

- Astra uses official Codex with ChatGPT subscription auth. Fable uses official Claude Code with a paid Claude subscription, usage credits allowed.
- No direct model APIs, API keys, credential extraction, or automatic provider or model fallback. That includes tests.
- Screen and camera sharing stay visible and consented. Keep the exact sent-frame evidence, the Live build limits, cancellation, and no automatic restart.
- Stream only validated output categories. Never show reasoning, auth data or raw provider errors. Draft HTML can't run scripts or enter saved history.
- Generated code stays inside its sandbox. Talk to the maintainer before changing a model or a transport.
- Prefer platform features over new dependencies. Never weaken a test assertion to hide a regression.

Say what behavior changed, what you ran to verify it, and include screenshots for visual changes. Keep credentials, personal paths, transcripts and private references out of commits and issues. Contributions are under the [MIT license](LICENSE). See [SECURITY.md](SECURITY.md) for vulnerability reporting.

Computer-mode checks: `npm run verify:computer` uses synthetic planning and native responses. On an interactive Windows desktop, `npm run verify:computer-native` compiles and opens its own fixture, tests UIA actions and the global stop shortcut, then closes only its own process. `powershell -NoProfile -File scripts/verify-computer-filters.ps1` checks the compiled protection regexes. The optional `node scripts/verify-computer-live.mjs --allow-subscription` runs Fable against that fixture and spends allowance. Run the native verifier first so the fixture exists. Never test against personal documents, terminals or real outgoing messages.
