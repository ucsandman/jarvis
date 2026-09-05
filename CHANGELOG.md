# Changelog

## 0.3.0 · 2026-09-05

- Windows executable bundles Node and official Codex: download, open, and use ChatGPT sign-in from Setup without terminal commands.
- Per-user extraction, desktop and Start menu shortcuts, tray Open/Quit, single-session reuse, occupied-port refusal, and owned-process cleanup.
- Pinned upstream package integrity and publisher verification; Jarvis's outer executable is unsigned and disclosed as such.
- Desktop bootstrap protects local APIs with a per-launch key scoped to the browser origin, separate from restricted preview capabilities.
- Public walkthrough explains reference, prompt, result, and revision; the task board is an optional sample rather than the main product demonstration.
- Windows extraction, clean-profile authentication, rendered preview, and lifecycle verification scripts.

## Public demo · 2026-09-05

- Launched the free browser example at https://jarvis-workbench.vercel.app on the maintainer's existing Vercel plan.
- Added a Windows download, explicit prerequisites, subscription setup guidance, and privacy details.
- Static deployment uses an allowlist; no local server or ChatGPT credentials are hosted.
- Added public metadata, sitemap, robots, llms, search ownership tags, and standard Vercel Web Analytics.
- The initial public launch used the 0.2.0 source archive; 0.3.0 replaces it with the bundled Windows executable.

## 0.2.0 · 2026-09-05

- Working example before login, setup checklist, explicit CLI installation and ChatGPT sign-in, and reconnect controls.
- One subscription turn per visual build, returning observations and HTML together; typed revisions do not resend an old frame by default.
- Completed source persists before preview loading; retry previews without inference and access local source during connection failures.
- Reliable Windows readiness checks independent of subscription status, serialized launches, and graphical prerequisite errors.
- Visible frame-inclusion control, build controls near the top, and mobile progress/countdown.
- Safe error categories, visible local allowance, validation before budget consumption, and explicit allowance renewal.
- 21 unit tests and nine additional browser recovery checks. No application dependencies added.

## 0.1.0 · 2026-09-05

Initial public release of the local Jarvis workbench.

- Selected camera frames, image upload, and a labeled sample sketch.
- Visual observations followed by interactive HTML generation.
- Astra through the official Codex CLI using a ChatGPT subscription, with no model API or fallback.
- Revisions, version history, source inspection, and standalone HTML download.
- Restricted previews with desktop, mobile, and expanded views.
- Local Windows English dictation and optional local spoken replies.
- Explicit sharing consent, cancellation, and bounded inference requests.
- Windows/Linux CI for unit tests, syntax, and required assets.

See the [README](README.md#current-limits) for current limits and the [playbook](PLAYBOOK.md) for verification evidence.
