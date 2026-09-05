# Security

Jarvis is a local development tool. Do not expose its HTTP server to a public network or place it behind a public tunnel.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** option when available. Do not put credentials, private images, exploit payloads containing personal data, or sensitive logs in a public issue. If private reporting is unavailable, open an issue asking for a private reporting channel without including vulnerability details.

## Security boundaries

- The server binds to loopback and checks Host, Origin, fetch metadata, and a per-process session token before state-changing operations.
- Camera preview stays in the browser. Building shares the selected image, direction, and selected prototype source through the subscription-authenticated Codex CLI after consent.
- Jarvis does not load environment files or read subscription credentials. The CLI owns authentication. API-key logins and provider fallback are rejected.
- Each model request uses an ephemeral working directory, read-only sandboxing, and disabled command tools and integrations.
- Generated HTML runs in an opaque-origin iframe sandbox with network requests, nested frames, and form destinations blocked by content security policy. It has no camera or microphone permissions.
- Preview storage, input sizes, request duration, concurrency, and per-session inference count are bounded.

These controls do not make generated code trustworthy. A generated page can still mislead a user or consume browser resources. Inspect downloaded HTML before running it outside the restricted preview. Local processes under the same operating-system account are outside the server's authentication boundary.

Reference images, directions, and source revisions persist in browser IndexedDB until **New project** clears them. Preview copies remain in bounded server memory until eviction or server exit. Source versions persist; application state entered inside a generated preview resets when it is reopened.
