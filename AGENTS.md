# Jarvis architecture constraints

- Jarvis may use only models from the catalog in `public/models.js` (OpenAI models through Codex, Anthropic models through Claude Code), through existing **OpenAI or Anthropic monthly subscriptions**.
- **Never integrate or call a metered model API directly.** No API keys, API-key helpers, Google models, or API fallback, including during tests. The maintainer explicitly authorized Claude subscription usage credits for Fable on 2026-09-05; this exception is limited to the official Claude Code subscription path. The maintainer extended that authorization to every Anthropic catalog model on 2026-09-05, when the model catalog expanded.
- Users may select an OpenAI model through official Codex authenticated with ChatGPT, or an Anthropic model through official Claude Code authenticated with Claude. Missing subscription authentication, unavailable model access, and usage limits must fail closed. Never switch models automatically.
- Core architecture or model changes require an explicit discussion with the maintainer before implementation. Credential availability is not an architectural justification. The maintainer requested the model-catalog expansion on 2026-09-05, satisfying that discussion requirement for this change.
- Preserve camera sharing alongside screen capture and show which frame was used. Live build was explicitly approved by the maintainer: separately consented, bounded screen snapshots only. Never silently upload a live stream or capture audio.

These constraints apply to development, verification, and published code.

- The maintainer explicitly approved Computer mode on 2026-09-05: a local Windows accessibility broker, opt-in sessions, per-action review, and emergency stop. Models still return structured data through the existing isolated subscription transports; do not enable arbitrary CLI tools. Keep fixed launch targets, fresh target validation, and fail-closed action permissions.
