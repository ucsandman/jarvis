# Architecture decisions

## 2026-09-05: Desktop companion stays a local entry point

The Windows companion is a native WinForms window hosting a persistent WebView2 profile. It gives the user a compact, summonable conversation surface, then opens the existing workbench when the user explicitly chooses a build or Computer mode workflow. Its conversational history is bounded to the active session.

Keep companion capture explicit: a requested current-window screenshot shows the exact frame used. Do not add ambient screen monitoring, always-on microphone capture, audio upload, automatic browser-history migration, model fallback, or action-permission changes. Camera sharing, Live build consent, source versions and downloads remain existing workbench behavior. WebView2 is a runtime dependency and missing availability fails closed with installation guidance.

## 2026-09-05: Reviewed Computer mode

The maintainer approved a separate local Windows action broker alongside prototype building. Keep subscription inference isolated and tool-free; interpret its structured output as a proposal, not permission. Every action requires a short-lived, single-use user approval bound to a fresh accessible target. Use a native global stop shortcut and a bounded session lease.

Use Windows accessibility patterns rather than arbitrary coordinates. Fixed app launches are Notepad, Calculator and Paint. Explorer and launch-capable address controls are excluded. The interface explicitly describes unsupported canvas, shell, elevated and unattended work. No direct model API, new billing route or automatic model fallback is introduced.

Keep all prototype building, streaming, capture and storage paths unchanged. Deploy only the allowlisted static marketing files to Vercel; native control remains in the downloaded app.
