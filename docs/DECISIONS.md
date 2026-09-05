# Architecture decisions

## 2026-09-05: Reviewed Computer mode

The maintainer approved a separate local Windows action broker alongside prototype building. Keep subscription inference isolated and tool-free; interpret its structured output as a proposal, not permission. Every action requires a short-lived, single-use user approval bound to a fresh accessible target. Use a native global stop shortcut and a bounded session lease.

Use Windows accessibility patterns rather than arbitrary coordinates. Fixed app launches are Notepad, Calculator and Paint. Explorer and launch-capable address controls are excluded. The interface explicitly describes unsupported canvas, shell, elevated and unattended work. No direct model API, new billing route or automatic model fallback is introduced.

Keep all prototype building, streaming, capture and storage paths unchanged. Deploy only the allowlisted static marketing files to Vercel; native control remains in the downloaded app.
