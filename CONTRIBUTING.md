# Contributing

Start with a concrete user workflow or reproducible bug. For a substantial change, open an issue describing what a user should be able to do.

## Development

Use Node.js 24 or newer:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4317`. Refresh after frontend changes. After a server restart, choose Reconnect to restore the local session.

Before submitting:

```sh
npm test
npm run lint
npm run build
npm run verify:recovery
npm run verify:stream
node scripts/verify-live.mjs
node scripts/verify-models.mjs
```

Browser checks require Chrome and Playwright or an existing global `@playwright/cli` installation. These checks use synthetic generation. Real-provider checks consume subscription allowance or Claude usage credits. Use public synthetic references, never private desktop or camera content.

## Boundaries

- Astra uses official Codex with ChatGPT subscription authentication. Fable uses official Claude Code with a paid Claude subscription; usage credits are allowed.
- No direct model APIs, API keys, credential extraction, or automatic provider/model fallback, including tests.
- Screen and camera sharing must remain visible and consented. Preserve exact sent-frame evidence, Live build limits, cancellation, and no automatic restart.
- Stream only validated output categories. Never show reasoning, auth data, or raw provider errors. Draft HTML cannot execute scripts or enter saved history.
- Keep generated code inside its existing sandbox. Discuss model or transport changes with the maintainer first.
- Prefer platform features over new dependencies. Never weaken a test assertion to hide a regression.

Include the behavior changed, verification performed, and screenshots for visual changes. Keep credentials, personal paths, transcripts, and private references out of commits and issues. Contributions are under the [MIT license](LICENSE). See [SECURITY.md](SECURITY.md) for vulnerability reporting.

Computer-mode checks: `npm run verify:computer` uses synthetic planning and native responses. On an interactive Windows desktop, `npm run verify:computer-native` compiles and opens its own fixture, tests UIA actions and the global stop shortcut, then closes only its own process. `powershell -NoProfile -File scripts/verify-computer-filters.ps1` checks the compiled protection regexes. The optional `node scripts/verify-computer-live.mjs --allow-subscription` uses Fable with that fixture and consumes allowance. Run the native verifier first to create the fixture. Never test against personal documents, terminals or real outgoing messages.
