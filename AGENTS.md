# Jarvis architecture constraints

- Jarvis may use **Astra or Fable only**, through existing **OpenAI or Anthropic monthly subscriptions**.
- **Never integrate or call a metered model API.** No API keys, API-key helpers, alternative billing routes, Google models, or API fallback, including during tests.
- This implementation selects Astra through the official Codex CLI, authenticated with ChatGPT. Missing subscription authentication, unavailable model access, and usage limits must fail closed.
- Core architecture or model changes require an explicit discussion with the maintainer before implementation. Credential availability is not an architectural justification.
- Preserve a clear camera-sharing control and show which frame was used. Never silently upload a live stream.

These constraints apply to development, verification, and published code.
