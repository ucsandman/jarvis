<div align="center">
  <img src="public/mark.svg" width="72" height="72" alt="Jarvis">
  <h1>Jarvis</h1>
  <p><strong>Share your screen. Build as you draw.</strong></p>
  <p>Turn a drawing, design window, or sketch into a working web prototype.</p>
  <p><a href="https://github.com/ucsandman/jarvis/actions/workflows/ci.yml"><img src="https://github.com/ucsandman/jarvis/actions/workflows/ci.yml/badge.svg" alt="Windows and Linux checks"></a> <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-e5b977" alt="MIT license"></a> <a href="https://github.com/ucsandman/jarvis/releases/latest"><img src="https://img.shields.io/github/v/release/ucsandman/jarvis" alt="Latest release"></a></p>
  <p><a href="https://jarvis-workbench.vercel.app/">Website</a> · <a href="https://github.com/ucsandman/jarvis/releases/download/v0.6.0/Jarvis-0.6.0-Windows-x64.exe">Download for Windows</a> · <a href="#getting-started">Get started</a> · <a href="CONTRIBUTING.md">Contribute</a></p>
</div>

Jarvis runs on your computer and uses your eligible **ChatGPT or Claude subscription** for generation. Choose **Astra** or **Fable 5.1**, set the effort, and build from a shared screen, uploaded image, camera frame, or typed direction. No model API key is needed.

**Experimental.** Fable can consume paid Claude usage credits. Model access and limits depend on your account. The website is a prepared walkthrough; generation and sign-in happen in the downloaded app.

![Jarvis displaying a draft as HTML arrives](docs/images/streaming.png)

*The streaming interface replaying captured HTML from a real Fable build. Drafts are unfinished and have scripts disabled. Complete versions run in the interactive preview.*

## What it does

- **Build as you draw.** Share a design window and opt into Live build. Jarvis sends changed snapshots after you pause, then updates the prototype.
- **See code arrive.** Fable's incremental HTML appears in a live draft and code view. Switch to the last working version anytime. Astra's current CLI path releases completed messages rather than incremental code.
- **Keep control.** Choose low through max effort, inspect the exact frame sent, pause builds, cancel generation, or stop sharing.
- **Keep your work.** Up to 12 versions stay in your browser. Restore a version, inspect source, or download HTML.
- **Choose your input.** Screen sharing, image upload, camera, typed directions, and optional local Windows dictation.

## Getting started

1. [Download Jarvis 0.6.0 for Windows](https://github.com/ucsandman/jarvis/releases/download/v0.6.0/Jarvis-0.6.0-Windows-x64.exe) and open it. No terminal, Node.js installation, or administrator access is required.
2. Choose **Astra** or **Fable 5.1**. In **Setup**, use the selected provider's sign-in button. Codex is included. For Fable, **Install official Claude Code** downloads and verifies Anthropic's runtime if needed.
3. Choose **Share screen or window**, select your drawing or design window, and describe the product. For one build, check the frame-sharing control and click **Make it real**.
4. For automatic updates, click **Start Live build** and review the separate sharing and usage notice.

Use the desktop or Start menu shortcut next time. **Quit Jarvis** in the tray menu stops its server. Closing the browser leaves it running.

Windows 10/11 x64 is required. Desktop Chrome or Edge is recommended for screen sharing. The download is about 164 MiB. **The Jarvis executable is unsigned**, so Windows may show an unknown-publisher warning. The [release includes a SHA-256 checksum](https://github.com/ucsandman/jarvis/releases/tag/v0.6.0), and upstream runtime publishers are verified. [Installation, updates, and removal](docs/WINDOWS.md).

## Models and speed

| Model | Account | Preview while generating |
| --- | --- | --- |
| Astra | Eligible ChatGPT subscription through Codex | Updates when the CLI releases a completed message |
| Fable 5.1 | Paid Claude subscription through Claude Code | Incremental HTML drafts as chunks arrive |

Start with **low effort** for smaller changes. **Use low effort for faster builds** changes the next request without switching models. Higher effort can take much longer.

Streaming does not remove initial thinking time. A small Fable/low probe produced its first HTML at 18.9 seconds and finished at 20.5 seconds. A previous screen-based build took 60 seconds. These are different requests, not a controlled speed comparison or latency guarantee. [Model and billing details](docs/MODELS.md).

## Live build controls

Live build compares small thumbnails locally. It waits for three quiet seconds and a meaningful change, with one request at a time. Choose a minimum interval of **30 seconds**, **60 seconds**, or **two minutes**. It pauses after **ten requests per start**, on capture loss, or after an interrupted build.

**Pause** stops new snapshots and cancels unfinished inference. **Stop sharing** also releases capture. Reload never restarts sharing or Live build. Provider work already received may still consume allowance or credits.

Share the design window rather than Jarvis itself to avoid capture feedback. Animated surfaces may never settle; tiny edits can be ignored. Drafts are visual only until a finished result passes validation. A new completed version resets prototype runtime data, while saved source versions remain available.

## Privacy and boundaries

| What | What happens |
| --- | --- |
| Camera and screen | Preview stays local. Manual builds send one selected frame. Live build sends changed snapshots after separate consent. No full video stream or desktop audio is uploaded. |
| Model input | The chosen image, direction, and selected source go to the selected provider through its official CLI. |
| Accounts | The CLI manages sign-in. Jarvis does not read credential files or accept API-key login. No automatic model or API fallback. |
| Drafts | Partial HTML is not saved in history. Scripts are disabled; temporary draft URLs expire when the build ends. Reasoning and raw CLI logs are not shown. |
| Completed prototypes | Run in a restricted iframe with network requests, nested frames, and camera/microphone access blocked. Downloaded HTML runs outside that preview boundary. |
| Saved work | Source versions and references stay in this browser on this device. Use the same profile and local URL. |

Jarvis builds frontend prototypes. It does not control your desktop, edit repositories, deploy services, or connect real backends. Review generated output before using it elsewhere. [Security details and reporting](SECURITY.md).

## Run from source

Requires **Node.js 24+** and an eligible subscription for generation. Setup can install the selected CLI on Windows. On other platforms, install the supported official CLI separately. [Provider setup](docs/MODELS.md).

```sh
git clone https://github.com/ucsandman/jarvis.git
cd jarvis
npm ci
npm start
```

Open **http://127.0.0.1:4317**. There are zero application runtime package dependencies. **Start Jarvis.cmd** also works after installing Node.

## Development and verification

```sh
npm test
npm run lint
npm run build
npm run verify:recovery
npm run verify:stream
node scripts/verify-live.mjs
node scripts/verify-models.mjs
```

Browser checks require Chrome and Playwright or an existing global `@playwright/cli` installation. They use synthetic generation and do not consume subscription allowance. Live-provider checks are separate and consume allowance or credits. Windows/Linux CI checks installation, tests, lint, and build.

[Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [Windows packaging](docs/WINDOWS.md) · [Site runbook](docs/SITE.md) · [Verification history](PLAYBOOK.md)

## Troubleshooting

| Problem | Action |
| --- | --- |
| Generation is slow | Choose low effort, ask for a smaller change, or cancel. Fable supports incremental drafts; Astra's current CLI may remain quiet until completion. |
| Model or login unavailable | Open Setup, use the selected sign-in or install button, then Check again. |
| Screen sharing unavailable | Use desktop Chrome or Edge, upload an image, or use the camera. |
| Live build paused | Review the message, check the shared window and allowance, then explicitly start again. |
| Preview failed | Retry preview or download completed source. Do not regenerate just to reopen it. |
| Saved work missing | Use the same browser profile and local URL. Different origins have separate storage. |
| Port occupied | Quit the application using port 4317, then reopen Jarvis. |

## License

Jarvis source is [MIT licensed](LICENSE). Node.js, Codex, and Claude Code retain their own licenses and terms. Upstream notices accompany bundled runtimes; Claude Code is downloaded separately through Setup.
