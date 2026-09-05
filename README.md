<div align="center">
  <img src="public/mark.svg" width="72" height="72" alt="Jarvis">
  <h1>Jarvis</h1>
  <p><strong>A desktop companion for Windows that runs on the ChatGPT or Claude subscription you already pay for.</strong></p>
  <p><a href="https://github.com/ucsandman/jarvis/actions/workflows/ci.yml"><img src="https://github.com/ucsandman/jarvis/actions/workflows/ci.yml/badge.svg" alt="Windows and Linux checks"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-e5b977" alt="MIT license"></a> <a href="https://github.com/ucsandman/jarvis/releases/latest"><img src="https://img.shields.io/github/v/release/ucsandman/jarvis" alt="Latest release"></a></p>
  <p><a href="https://jarvis-workbench.vercel.app/">Website</a> · <a href="https://github.com/ucsandman/jarvis/releases/download/v0.8.1/Jarvis-0.8.1-Windows-x64.exe">Download for Windows</a> · <a href="#getting-started">Get started</a> · <a href="CONTRIBUTING.md">Contribute</a></p>
</div>

Jarvis sits in the corner of your screen. Hit **Ctrl+Shift+Space**, ask about the window you're in, show it a frame, and either talk it through or hand it something bigger: turn a sketch into a working prototype, or let it drive a Windows app one approved click at a time. Pick **Astra** (ChatGPT) or **Fable 5.1** (Claude), set the effort, go. No API key, nothing metered.

It's experimental and built around how I work. Fable can burn paid Claude usage credits. What your account can reach is up to your plan. The website is a walkthrough, the app is where the sign-in and generation actually happen.

<img src="docs/images/companion.png" width="360" alt="Jarvis desktop companion with a message field, window capture, microphone control, and explicit sharing permission">

*The companion. Screen and mic are off until you turn something on.*

![Jarvis displaying a draft as HTML arrives](docs/images/streaming.png)

*Fable's HTML rendering as it arrives. Drafts run with scripts off; the finished version runs in the interactive preview.*

## What it does

- **Build as you draw.** Share your design window, turn on Live build, and Jarvis sends a snapshot after you pause and updates the prototype.
- **Watch the code land.** Fable streams HTML into a live draft and a code view. Flip back to the last working version any time. Astra's CLI hands over finished messages instead of a stream.
- **Stay in control.** Low through max effort, see the exact frame that was sent, pause, cancel, stop sharing.
- **Keep your versions.** Up to 12 stay in Jarvis's desktop profile. Restore one, read the source, download the HTML, import an old one.
- **Use whatever input you have.** Screen share, image upload, camera, typed direction, or local Windows dictation.
- **Work inside Windows apps.** Computer mode reads the accessible controls, proposes one action, and waits for your yes. Click, replace text, scroll, a handful of shortcuts, or open Notepad, Calculator and Paint. [Computer mode guide](docs/COMPUTER.md).

## Getting started

1. [Download Jarvis 0.8.1](https://github.com/ucsandman/jarvis/releases/download/v0.8.1/Jarvis-0.8.1-Windows-x64.exe) and open it. No terminal, no Node, no admin.
2. Pick **Astra** or **Fable 5.1**, then sign in from **Setup**. Codex ships inside. For Fable, **Install official Claude Code** downloads and verifies Anthropic's runtime.
3. **Share screen or window**, pick your design window, describe the product. For a one-off build, tick the frame checkbox and hit **Make it real**.
4. For hands-off updates, **Start Live build** and read the separate snapshot notice first.

**Ctrl+Shift+Space** brings the companion back. So does the desktop or Start menu shortcut. Closing the panel leaves Jarvis in the tray; **Quit Jarvis** from the tray menu stops the server.

Windows 10/11 x64 only. Chrome or Edge for screen sharing. The download is about 164 MiB. **The exe is unsigned**, so expect the unknown-publisher prompt. The [release has a SHA-256 checksum](https://github.com/ucsandman/jarvis/releases/tag/v0.8.1) and the bundled Node and Codex are publisher-verified. [Install, update, remove](docs/WINDOWS.md).

The companion needs the Microsoft Edge WebView2 Runtime. Jarvis checks on launch and tells you where to get it if it's missing. Its WebView profile is separate from any browser profile you used with an older install, so old revisions don't show up on their own. Export the HTML from the old profile, then **Settings, then Import a saved HTML prototype** in the companion. Imports cap at 120,000 bytes and add a version when the 12-slot history has room.

## Computer mode

![Computer mode waiting for approval](docs/images/computer.png)

*A real Fable proposal against a test app I own. Nothing happens until Approve.*

1. Open **Computer mode** and allow local inspection for ten minutes.
2. Open an app or pick an open window. **Inspect selected window** reads its controls locally.
3. Choose the model and effort, type the task, allow sharing the window's current accessible text. Each **Plan next action** takes a fresh reading.
4. Check the target, text or shortcut. **Approve this action** does one thing. **Reject** does nothing. Plan again to see the result.
5. **Stop computer control**, untick the permission, or hit **Ctrl+Shift+F12** from anywhere. Closing the page asks for Stop too. Stop doesn't undo what already ran.

A click or a key in the target app can send, delete, or buy something. Read every approval. Filters on names and commands are a safety net, not a promise that the app is trustworthy. Up to 20 model steps per session, each on your subscription or credits. [Capabilities, limits and protocol](docs/COMPUTER.md).

## Models and speed

| Model | Account | Preview while generating |
| --- | --- | --- |
| Astra | ChatGPT subscription through Codex | Updates when the CLI finishes a message |
| Fable 5.1 | Paid Claude subscription through Claude Code | HTML drafts as chunks arrive |

Start on **low effort** for small changes. **Use low effort for faster builds** applies to the next request only. High effort can take a while.

Streaming doesn't skip the thinking time. One small Fable/low probe showed first HTML at 18.9s and finished at 20.5s. An earlier screen-based build took 60s. Different requests, not a benchmark. [Model and billing details](docs/MODELS.md).

## Live build

Live build compares small thumbnails locally. It waits for three quiet seconds and a real change, one request at a time. Minimum gap is **30 seconds**, **60 seconds**, or **two minutes**. It pauses after **ten builds per start**, when capture drops, or after an interrupted build.

**Pause** stops snapshots and cancels the in-flight request. **Stop sharing** also releases capture. Reload never restarts sharing or Live build. Work the provider already received may still count against you.

Share the design window, not Jarvis, or you'll capture yourself. Animated windows may never settle. Drafts are visual only until a finished result validates. A new finished version resets the prototype's runtime data; saved source stays.

## Privacy and boundaries

| What | What happens |
| --- | --- |
| Camera and screen | Preview stays local. A manual build sends one frame you picked. Live build sends changed snapshots after its own consent. No video stream, no desktop audio. |
| Model input | Your frame, direction and selected source go to the provider through its official CLI. |
| Accounts | The CLI owns sign-in. Jarvis never reads credential files, never takes an API key, never falls back to another model. |
| Drafts | Partial HTML isn't saved. Scripts are off. Draft URLs expire when the build ends. Reasoning and raw CLI logs aren't shown. |
| Finished prototypes | Run in a locked-down iframe: no network, no nested frames, no camera or mic. Downloaded HTML runs outside that box. |
| Computer mode | Window choice is local. Planning sends a fresh bounded accessibility tree, editable values, the task and recent actions, after consent. No screenshot, no audio. History is session-only. |
| Saved work | Versions and reference images live in Jarvis's desktop profile on this machine. |
| Desktop companion | Conversation and profile stay local. It isn't listening, isn't watching your screen, and only grabs a window when you ask for a screenshot. |

The builder makes frontend pages. Computer mode, enabled separately, drives accessible Windows controls with per-action approval. It is not general desktop automation: no canvas, no Explorer, no address bars, no terminals, no admin prompts. No shell tool, no repo editing, no backend, no deploy. Read generated output before you use it somewhere else. [Security details and reporting](SECURITY.md).

## Run from source

Needs **Node.js 24+** and a subscription for generation. Setup can install the CLI on Windows. Elsewhere, install the official CLI yourself. [Provider setup](docs/MODELS.md).

```sh
git clone https://github.com/ucsandman/jarvis.git
cd jarvis
npm ci
npm start
```

Open **http://127.0.0.1:4317**. Zero runtime dependencies. **Start Jarvis.cmd** works too once Node is installed.

## Development and verification

```sh
npm test
npm run lint
npm run build
npm run verify:assistant
npm run verify:companion
npm run verify:recovery
npm run verify:stream
node scripts/verify-live.mjs
node scripts/verify-models.mjs
```

Browser checks need Chrome plus Playwright or a global `@playwright/cli`. They use synthetic generation and don't touch your allowance. Live-provider checks are separate and do. CI runs install, tests, lint and build on Windows and Linux.

Changed the mark? Run `powershell -NoProfile -File scripts/build-icon.ps1` to regenerate `desktop/jarvis.ico`.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Windows packaging](docs/WINDOWS.md) · [Site runbook](docs/SITE.md) · [Verification history](PLAYBOOK.md)

## Troubleshooting

| Problem | Try |
| --- | --- |
| Slow generation | Drop to low effort, ask for less, or cancel. Fable streams drafts; Astra stays quiet until it's done. |
| Model or login unavailable | Open Setup, use the sign-in or install button, then Check again. |
| Can't share the screen | Use Chrome or Edge, upload an image, or use the camera. |
| Live build paused | Read the message, check the shared window and your allowance, start it again yourself. |
| Preview failed | Retry preview or download the source. Don't regenerate just to reopen it. |
| Saved work missing | Same installed Jarvis profile? Older browser installs are separate. Export there, then **Settings, then Import a saved HTML prototype**. |
| Port taken | Quit whatever is on 4317, reopen Jarvis. |

## License

Jarvis is [MIT](LICENSE). Node.js, Codex and Claude Code keep their own licenses. Upstream notices ship with the bundled runtimes; Claude Code is downloaded separately through Setup.
