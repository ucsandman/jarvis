# Computer mode

Computer mode helps you work in Windows applications through accessible controls. It is separate from the screen-to-prototype builder. Every proposed action requires your approval; it is not unattended or unrestricted computer access.

The desktop companion can discuss a task and suggest that Computer mode may help. It cannot enable control, choose a target, or change a permission. Use its explicit workflow button to open the existing Computer mode surface, then follow the same consent and review steps below.

## Use it

1. Open **Computer mode** in the downloaded workbench. Allow local inspection and enable the ten-minute session.
2. Open Notepad, Calculator or Paint with the app selector, or choose an already-open supported window. Use **Refresh windows** when apps change.
3. **Inspect selected window** reads accessible text locally. This includes editable values; password controls and protected windows are excluded. Some controls are unnamed or unavailable.
4. Choose Astra or Fable and an effort level. Describe the task and approve sharing the selected window's current accessible text. **Plan next action** reads that window again. This fresh reading may differ from your earlier inspection. The exact sent text is returned with the model result.
5. Review the action, target name, type, parent, identifiers, text replacement and shortcut. **Approve this action** delivers one operation. **Reject** delivers nothing. Plan the next action to inspect the result and continue. A completion report is the model's interpretation; check the application yourself.
6. **Stop computer control**, uncheck the permission, or press **Ctrl+Shift+F12** from any app. Closing the page also requests Stop. The native lease expires after ten minutes even if the browser loses its connection. Stop cannot undo a delivered operation or refund a model request.

## What works

| Operation | Boundary |
| --- | --- |
| Inspect | Selected-window accessibility tree, up to 350 visible elements, depth seven, bounded names and values. No screenshot or desktop audio. |
| Click | Invoke, toggle, select or expand an accessible control. No coordinate fallback. |
| Type | Replaces the entire editable ValuePattern value, up to 2,000 characters. Command-like and multiline text is refused. |
| Scroll | Accessible scroll containers, one large up/down increment. |
| Keys | Enter, Tab, Escape, arrows, Save, Select all, Backspace and Delete, after proven target focus. |
| Focus | Requests foreground focus for the selected window. Refuses if Windows does not grant it. |
| Open | Fixed Windows executables or registered app IDs for Notepad, Calculator and Paint. Select the new window afterward. |

Explorer, terminals, sign-in/protected windows, password controls and address/command controls are excluded. Browser or custom application accessibility can be incomplete. Paint's accessible menus can be operated, but its drawing canvas cannot. There is no OCR, arbitrary mouse movement, drag-and-drop, shell execution tool, arbitrary executable path, administrator prompt handling or guarantee that every application supports these patterns.

All actions are reviewed because a UI click or key can send, purchase, delete, or trigger code in the target app. Name/command filters are additional protection, not a guarantee that an application is trustworthy. Jarvis is not a backend builder or repository/deployment agent.

## Local protocol and lifecycle

`POST /api/computer` requires the normal same-origin host checks, session header and packaged desktop launch key. It is never served by the Vercel website. Bodies are JSON:

| Operation | Required fields | Response |
| --- | --- | --- |
| `enable` | `consent: true` | Random owning-tab `owner`, expiry and fixed apps |
| `windows` | `owner` | Current window identities and titles |
| `inspect` | `owner`, `window` | Local bounded accessibility snapshot |
| `launch` | `owner`, fixed `app` | Explicit app-open result |
| `propose` | `owner`, `window`, `task`, `model`, `effort`, `consent: true` | One proposal, its exact sent snapshot and step count |
| `approve` | `owner`, proposal `id`, `consent: true` | One native result; the ID is consumed before execution |
| `reject` | `owner` | Discards the pending proposal |
| `status` | Normal local session authentication | Armed state and step count |
| `stop` | Normal local session authentication | Revokes control across tabs |

Approvals expire after one minute. Twenty model steps are allowed per enabled session, alongside the shared local request ceiling. Subscription limits still apply. No model fallback is used. The model returns only structured proposals through the existing isolated CLI; it cannot execute Windows actions directly.

Before execution, the native controller re-resolves the control and checks window/process identity, title, runtime ID, AutomationId, type, name, parent context, visibility, enabled/password state, and a fingerprint of accessible value/toggle/selection/expansion state. Changed controls require a new proposal. Focus-sensitive keys are checked again after focus. These checks cannot make arbitrary external applications transactional; an action already accepted by Windows may finish after Stop.

The helper is a per-session child process with no elevation. It registers the global stop shortcut before arming. A hotkey event aborts inference and kills the owned helper through the broker. Action history and proposals stay in memory and are cleared on a new session; they are not saved as prototype versions. Same-user malicious local processes are outside the security boundary.

In the packaged app, fixed app-open requests go to the desktop launcher through instance-specific events. User applications start outside the server's shutdown process group, so quitting Jarvis leaves those applications and their unsaved work open. Inference and controller processes remain inside the existing shutdown group.

## Verification

- Unit tests cover owning-tab authorization, consent, single-use approvals, expiry, unsupported actions, emergency-stop state and cancellation during inference.
- Browser verification covers local/cloud consent, inspection, approve/reject, Stop and mobile rendering with a synthetic planner.
- Native verification opens its own compiled WinForms fixture, replaces text, clicks a button, verifies the title, rejects stale context/value/targets and fires the real global shortcut.
- A real Fable/low browser-to-native test completed three model steps and two reviewed actions in about 29 seconds. This was a synthetic fixture, not a promise of speed or compatibility in every app.

DeskClaw informed the guarded accessibility approach. Jarvis's controller is implemented here and does not depend on a user's private harness, DeskClaw installation or global state files.
