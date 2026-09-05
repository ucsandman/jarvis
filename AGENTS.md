# Jarvis architecture constraints

- Jarvis may use **Astra or Fable only**, through existing **OpenAI or Anthropic monthly subscriptions**.
- **Never integrate or call a metered model API directly.** No API keys, API-key helpers, Google models, or API fallback, including during tests. The maintainer explicitly authorized Claude subscription usage credits for Fable on 2026-09-05; this exception is limited to the official Claude Code subscription path.
- Users may select Astra through official Codex authenticated with ChatGPT, or Fable through official Claude Code authenticated with Claude. Missing subscription authentication, unavailable model access, and usage limits must fail closed. Never switch models automatically.
- Core architecture or model changes require an explicit discussion with the maintainer before implementation. Credential availability is not an architectural justification.
- Preserve a clear camera-sharing control and show which frame was used. Never silently upload a live stream.

These constraints apply to development, verification, and published code.
