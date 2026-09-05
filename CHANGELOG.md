# Changelog

## 0.6.0 · 2026-09-05

- Fable streams real partial HTML into a script-disabled live draft and code view. Switch to the last working version during generation.
- Completion still validates and saves a full interactive version. Canceled or failed drafts are discarded and their temporary URLs revoked.
- Direct structured output avoids duplicate JSON narration. Shorter generation prompts and a low-effort shortcut help reduce waiting.
- Astra remains on the isolated Codex exec path and displays completed messages; it does not simulate incremental tokens.
- MIT license, refreshed README and contributor guidance, current screenshot, GitHub description, website link, and release documentation.

## 0.5.0 · 2026-09-05

- Share a screen or window and opt into Live build while drawing or editing. Camera and upload remain available.
- Local change detection, three quiet seconds, configurable minimum intervals, one request at a time, and ten builds per start. Pause cancels unfinished inference; Stop sharing releases capture.
- Exact sent-frame evidence, explicit automatic-sharing and usage-credit consent, and no automatic resume after reload.
- Animated Astra/Fable waiting messages, elapsed time, reduced-motion support, and a status panel that keeps the current prototype usable.
- Windows package, privacy documentation, public download guidance, and deterministic live-loop verification updated.

## 0.4.0 · 2026-09-05

- Choose Astra or Fable 5.1 and low, medium, high, xhigh, or max effort in the workbench. Preferences persist; each build records its selection.
- Fable generation and image input through official Claude Code with a paid Claude subscription. Usage credits may be charged; the UI shows this before consent.
- Provider-specific Setup, sign-in, and a Windows button to install the checksum- and publisher-verified Claude Code runtime directly from Anthropic.
- Server-side model/effort validation, isolated CLI settings, disabled executable tools and model fallback, safe errors and cancellation.
- Updated Windows executable and public download guidance.

## Website update · 2026-09-05

- Removed the optional task-board section and its hosted sample file. The public page now focuses on the reference-to-result walkthrough and Windows download.

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
