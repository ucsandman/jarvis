# Contributing

Keep changes small and tied to a specific behavior. For a substantial feature, open an issue describing the user workflow before implementing it.

## Local development

Use Node.js 24 or newer, then run:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4317`. Refresh the page after frontend changes. The development server restarts after source changes; choose Reconnect to obtain a fresh session.

Unit tests and syntax checks do not need a model account:

```sh
npm test
npm run lint
npm run build
```

Run `npm run verify:recovery` with Chrome and Playwright available for isolated onboarding and failure-path checks without model calls. Do not change a failing assertion just to make a fix pass.

For browser verification, follow the [README](README.md#development-and-verification). Real generation checks consume your ChatGPT subscription allowance. Use the included synthetic sketch, never someone else's private camera image.

## Architecture constraints

- Inference uses Astra through the official Codex CLI with ChatGPT subscription authentication.
- No metered model APIs, API keys, credential extraction, or API/model fallback, including tests.
- Keep explicit sharing consent, local-only camera preview, and the generated-code sandbox.
- Discuss model or transport changes with the maintainer first. See [AGENTS.md](AGENTS.md).
- Do not add dependencies without establishing why the existing platform cannot handle the task.

Include the behavior changed, verification performed, and screenshots for visual changes in pull requests. Keep credentials, machine paths, session transcripts, and private reference images out of commits and issues.
