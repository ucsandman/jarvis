# Desktop companion implementation plan

Goal: ship the approved Windows dock, conversation panel, and expanded workbench with the existing subscription transports and reviewed computer actions.

Architecture: extend the current WinForms launcher with an embedded WebView2 host. Mount the conversation surface in the existing document so expanding the workbench retains application state. A bounded conversation endpoint uses the existing isolated inference transport and shared request allowance.

Approved design: the September 5 discussion selected a small dock, a compact conversation panel, and the full workbench as three sizes of one application. Explicit snapshots, deliberate microphone use, optional local speech, session conversation history, and reviewed workflow handoffs are included. Wake words, unrestricted tools, and task-level action approval are excluded.

## Delivery and verification

1. Native host: extend desktop launcher and packaging; prove WebView2 rendering, shortcut activation, fresh explicit capture, narrow trusted-frame bridge, persistent profile, and owned-process cleanup.
2. Conversation: add lib/assistant.mjs and shared API route; validate invalid input, consent, history bounds, cancellation, request allowance, and structured suggestions without model tool execution.
3. Interface: add public/companion.js and companion.css to the canonical page; verify compact layout, keyboard access, exact context evidence, local dictation, cancellation, and handoff to existing workbench/computer workflows. Add HTML import for previously downloaded prototypes without replacing existing versions.
4. Release: update version, README, Windows/privacy docs, public site and screenshots. Run tests, syntax checks, browser suites, native checks and packaged checks; inspect staged content; commit and push; publish executable/checksum and deploy the allowlisted site; verify CI and public downloads.

## Deviations

A desktop profile is separate from browser storage; explicit HTML import preserves a path for existing work without reading browser profiles. The native host uses target-window rendering rather than a desktop-region screenshot to avoid capturing overlapping windows. Unsupported windows fail closed. The site verification download fixture now derives the expected release version from package metadata while retaining exact URL validation.
