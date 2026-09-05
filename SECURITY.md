# Security

Jarvis is a local development tool. Do not expose its HTTP server to a public network or place it behind a public tunnel.

## Reporting a vulnerability

Use the repository's **Security → Report a vulnerability** option when available. Do not put credentials, private images, exploit payloads containing personal data, or sensitive logs in a public issue. If private reporting is unavailable, open an issue asking for a private reporting channel without including vulnerability details.

## Security boundaries

- The server binds to loopback and checks Host, Origin, fetch metadata, and a per-process session token before state-changing operations.
- The Windows executable additionally requires a random per-launch key for all API routes except public readiness. The launcher passes it in the child environment, the server removes it before spawning the CLI, and the browser receives it in a URL fragment that is immediately removed. The key stays in origin-isolated session storage and travels only in an API request header. No authentication cookie is used, because cookies cross loopback ports. Unauthenticated local clients cannot obtain a session bearer or use an existing one without this desktop key. Preview URLs are separate random 160-bit capabilities issued only after an authenticated request; do not share them with untrusted processes.
- Camera preview stays in the browser. Building shares the selected image, direction, and selected prototype source through the selected subscription-authenticated Codex or Claude Code CLI after consent.
- Jarvis does not load environment files or read subscription credentials. The CLI owns authentication. API-key logins and provider fallback are rejected.
- Each model request uses an ephemeral working directory and disabled command tools and integrations. Codex uses a read-only sandbox. Claude Code uses safe mode, no executable tools, strict empty MCP configuration, and only its internal StructuredOutput tool. Fable requires a paid first-party Claude subscription; usage credits may be consumed after the in-app warning and sharing consent.
- Generated HTML runs in an opaque-origin iframe sandbox with network requests, nested frames, and form destinations blocked by content security policy. It has no camera or microphone permissions.
- Preview storage, input sizes, request duration, concurrency, and local inference allowance are bounded. Invalid input does not consume inference allowance. A user may explicitly renew the local allowance without affecting provider limits.
- Installation and sign-in routes require the same local session and explicit consent as other state-changing actions. Codex installation uses a fixed official npm package and registry with install scripts disabled. The Windows Claude Code installer downloads a pinned official native archive, checks SHA-512 integrity and the Anthropic publisher signature, and installs it per user. Anthropic binaries are not redistributed inside Jarvis. Sign-in delegates to the official CLI; credentials and login output are never returned to the page.
- Codex discovery accepts the official npm package layout and metadata, not arbitrary executable names. Claude Code discovery also accepts official native locations and checks Anthropic signatures on Windows. This is installation validation, not protection against a local user modifying installed package files.
- A lightweight local-session route permits preview/source recovery independently of subscription status. It uses the same Host, Origin, and fetch-metadata boundary as other routes.

These controls do not make generated code trustworthy. A generated page can still mislead a user or consume browser resources. Inspect downloaded HTML before running it outside the restricted preview. Local processes under the same operating-system account are outside the desktop server's authentication boundary. The developer source launch has no desktop bootstrap and trusts all native processes on the machine; do not use that mode on a machine with untrusted OS users.

The Windows build pins the Node archive SHA-256 and Codex npm package integrity, and validates upstream executable publishers before running the bundled CLI. The outer Jarvis launcher is currently unsigned. Installation uses an immutable build-specific per-user directory and rejects ZIP paths outside it. The launcher refuses an occupied port, validates its own server instance, and owns a Windows Job Object that stops descendants if the launcher exits. It does not start at Windows login or update itself automatically.

Reference images, directions, and source revisions persist in browser IndexedDB until **New project** clears them. Preview copies remain in bounded server memory until eviction or server exit. Source versions persist; application state entered inside a generated preview resets when it is reopened.
