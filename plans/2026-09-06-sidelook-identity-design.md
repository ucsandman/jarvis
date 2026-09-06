# Sidelook: name, mark, family identity

Design for 0.16.0, the first of three: (a) identity, (b) the Ask · Build · Do front door, (c) the studio relaid. Approved direction from the maintainer on 2026-09-06: the product is called Sidelook, it ships as a Practical Systems product with the family palette and one node of the family mark, the node's eyes follow the mouse around the screen, and the lens marks (today's ring, the pupil-to-edge, the open ring, the window-and-pupil) are dropped. Everything below that is not attributed to the maintainer is the recommended call and stands unless overridden. Mock: `.artifacts/sidelook-mock.html`, sections 3 to 6.

## What changes

Jarvis becomes Sidelook everywhere a user can see it: the exe, the Start menu, the tray, the window titles, the panel and studio bylines, the site, the README. The graphite-and-mint palette becomes the Practical Systems navy and teal. The mark becomes one white hexagon with two navy eyes, the hub of the parent's seven-hexagon mark on its own. In the dock and in the page header the eyes look toward the cursor wherever it is on the screen. Summon and dismiss fade. The site moves to a subdomain of the parent. Saved versions survive the rename through a one-time profile move.

Why the ghost is the concept and not a costume: the parent's mark already has eyes, and Karpathy's line about these models ("we're summoning ghosts, not building animals": trained by imitating human documents, so they see nothing until shown something) is exactly the promise in PRODUCT.md. Sidelook is summoned, looks at what you show it, and goes. The word ghost appears in the story and the About screen. It never appears as a label, and the mark never gets a mouth, arms, a sheet or a name tag.

## Not in this release, on purpose

- The Ask · Build · Do mode switch, first-summon starters, the three-column hero: spec (b).
- The studio relayout: spec (c).
- The ghost-mode easter egg (translucent panel, "Only when summoned"): optional in (b).
- Moving the GitHub repo to the Practical-Systems org. It is renamed under ucsandman, where CI, releases and every download link already live; the old URL redirects. A move is a later one-line change.
- A new port, hotkey, file format or version limit. 4317, Ctrl+Shift+Space, Ctrl+Shift+E, Ctrl+Shift+F12, twelve versions, all unchanged.

## The mark

One node. On the 64 grid: a rounded square of Navy (radius 14) when the mark needs a background (exe icon, favicon, OG card); a pointy-top white hexagon, circumradius 22, centred at (32,32), vertices (32,10) (51,21) (51,43) (32,54) (13,43) (13,21); two Navy eyes, radius 3.6, home centres (26,32) and (38,32), maximum travel 5 units in any direction, which keeps them inside the hexagon at every angle. Dock, tray and page header draw it without the square on the surface's own background.

Static renders freeze the eyes 5 units to the right, at (31,32) and (43,32): the sidelong look is the name. This is option G in the mock and the only static form. Sources of truth, changed together and checked by `verify:states`: `public/mark.svg`, `desktop/SidelookMark.cs` (renamed from `JarvisMark.cs`), `scripts/build-icon.ps1` (renders `desktop/sidelook.ico`), and `scripts/build-social.mjs` for the OG card.

## The eyes follow the cursor

Everywhere the mark is live, both eyes look toward the cursor.

- **Geometry.** For a mark of side `s`, unit `u = s/64`. Vector `v` from the mark's centre (screen coordinates) to the cursor. Offset `o = min(|v| / (120 * u), 1) * 5u` along `v`; both eyes move by the same `o`, so they stay parallel. Cursor inside the mark's own bounds: `o = 0`, eyes centred. No cursor known (a remote session, a lock screen): eyes at the static right.
- **Dock (native).** `SidelookMark.Draw` takes the eye offset. `DesktopShell` runs a 40 ms timer that reads `Cursor.Position`, computes the integer-pixel offset, and invalidates the dock button only when that offset changes. The timer runs while the dock is visible and stops when the session locks or the shell hides. Budget: under 0.5% CPU in Task Manager over one minute of continuous mouse movement, recorded in the desktop-host check.
- **Panel and studio (page).** The header mark is inline SVG with two `<circle>` eyes. Inside the page, `mousemove` drives them. While the panel or studio is visible and the cursor is outside its window, the shell posts `{type:"cursor", x, y}` through the existing `PostWebMessageAsJson` channel at most every 40 ms and only when the position changed; the page converts with the window's screen position, which the shell includes in the same message. In a plain browser (source install) only the in-page path exists.
- **Reply mark in the studio** (`.reply-mark`) is the static SVG. Only the header and the dock are live; one pair of eyes per surface.
- **Reduced motion.** Windows "Animation effects" off (`SPI_GETCLIENTAREAANIMATION` false) or `prefers-reduced-motion` in the page: the eyes stay at the static right and no timer runs.
- **Hover.** The dock's hover state today swaps the accent; it becomes the eyes widening by 0.4 units. No colour change: the accent is reserved for the button, the mark's teal is gone because the node is white.

## Palette

Family values from `C:\Projects\Practical Systems\brand\brand.json`. Tokens keep their names so `verify:states` and the retint rule apply unchanged.

| Token | App | Site | Use |
| --- | --- | --- | --- |
| `--bg` | `#171D2D` Navy | `#171D2D` | Body |
| `--panel` | `#1F2638` | `#12172A` | Raised surfaces, inputs |
| `--line` | `#2C3549` | `#303A50` | 1px rules |
| `--ink` | `#F8FAFC` Snow | same | Body text |
| `--muted` | `#A3ADBD` | `#B3BCCA` | Secondary text, 7:1+ on the app body, 4.5:1+ on the site |
| `--accent` | `#2DD4A8` Teal | same | The button, the thing under the cursor. Hover `--accent-hover` `#4EE0B8`. Text on it `--on-accent` `#0B1F1A` |
| `--paper` | `#F8FAFC` | | Prototype preview background |
| `--green` | `#10B981` Emerald | | Ready state only |
| `--hub` | `#FFFFFF` | same | The mark's hexagon |

The retint is the same rule pass as 0.15.0 (every long-tail shade moves to hue 224 at its own lightness), followed by `verify:states`, which measures every control at rest and under the mouse and rejects any token that is undefined, self-referential, or below AA contrast. Accent stays reserved for three things; the mark is no longer one of them, so the three are: the primary button, the thing under the cursor, the follow border.

## Wordmark and type

- "sidelook", lowercase, Plus Jakarta Sans 700, letter-spacing -0.02em, beside the node, matching "practical systems" on the parent site. The site loads the face from Google Fonts for the wordmark only. The app has no network font: Segoe UI Semibold at the same size and spacing, in Settings and About only. The panel header keeps no wordmark (DESIGN.md).
- Body type unchanged: Segoe UI in the app, Georgia on the site. Bahnschrift is removed from every stylesheet.
- Footer on the site and the About screen: "a Practical Systems product", linking to the parent.

## Rename

- Product string "Sidelook" in: `package.json` name (`sidelook`), exe name `Sidelook-0.16.0-Windows-x64.exe`, `scripts/build-windows.ps1`, Start menu folder and shortcut, tray text and menu ("Quit Sidelook"), window titles and MessageBox captions in `desktop/*.cs`, page titles, bylines and aria labels in `public/`, `site/index.html`, README, PRODUCT.md, DESIGN.md, CONTRIBUTING.md, SECURITY.md, docs/*.md guides, `Start Sidelook.cmd`.
- Classes and files: `JarvisMark` → `SidelookMark`, `jarvis.ico` → `sidelook.ico`. Namespaces and other identifiers that only a developer sees are renamed where the file is already being edited; nothing else is touched for the sake of it.
- History stays as written: CHANGELOG entries before 0.16.0, PLAYBOOK, docs/ERRORS.md, docs/DECISIONS.md, plans/, `.artifacts/`. The 0.16.0 CHANGELOG entry says what was renamed and why.
- **Profile migration.** `Launcher.Root` becomes `%LOCALAPPDATA%\Sidelook`. On start, if `Sidelook` does not exist and `Jarvis` does, the launcher moves the whole folder once (`Directory.Move`); if the move fails because a file is locked, it copies `versions/` and the dock position file and leaves the old folder. The decision is a pure function of the two paths' existence, unit-tested in `tests/`, and the desktop lifecycle check runs it both ways on a synthetic profile. This is the only place the old name remains in shipped code, marked `// legacy profile folder`.
- **Name gate.** `scripts/check.mjs` fails on the word Jarvis (case-insensitive) anywhere in `public/`, `site/`, `desktop/`, `scripts/`, `tests/`, `package.json`, README, PRODUCT, DESIGN, CONTRIBUTING, SECURITY and `docs/COMPUTER.md`, `docs/MODELS.md`, `docs/WINDOWS.md`, docs/SITE.md's runbook lines (its release log is history), except the one marked line in `Launcher.cs`. `verify:site` adds the old name to the strings it rejects on the built site.

## Motion

Summon fades the panel in over 150 ms and dismiss fades it out over 120 ms, ease-out, opacity only, driven by the shell (layered window alpha), instant under reduced motion. Nothing else animates in this release. The follow border and the studio's build states keep their existing motion.

## Family ties

- Site: wordmark lockup, footer line, parent link in the nav.
- About (Settings): mark, "sidelook", version, "a Practical Systems product", and the Karpathy line with attribution: *"We're not building animals. We're building ghosts or spirits."* Andrej Karpathy, on the Dwarkesh Patel podcast, October 2025. One sentence under it in our words: Sidelook is summoned, looks at what you show it, and goes.
- The parent's Products page gets a Sidelook entry. That lives in `C:\Projects\Practical Systems\practical-systems-website` and is a handoff item for the ship step, not part of this repo's change.
- The parent's easter egg line ("Our agents are always watching") is not reused anywhere in Sidelook.

## Domain and hosting

- Site address: `sidelook.practicalsystems.io` (the parent resolves on .io; brand.json says .ai, and the record goes on whichever the live site serves, confirmed at ship time). A DNS CNAME to Vercel and the domain added to the existing Vercel project. Adding the record is a hard stop at ship, at no cost.
- The Vercel project keeps its id; `jarvis-workbench.vercel.app` redirects to the new address via `vercel.json` so old links and the README history keep working.
- GitHub: repo renamed `ucsandman/sidelook` at ship; README badges, release links, CI links and `docs/SITE.md` updated in the same commit. Search Console and Bing re-registered for the new host per the preflight procedure, in the ship session.

## Verification

Synthetic, in CI and the release checklist:

- `npm test`: harness strings, the migration decision function, the eye-offset function (pure: mark bounds, cursor, reduced-motion flag → offset; cases: inside bounds, far right, far up-left, unknown cursor, reduced motion).
- `npm run lint`: name gate, served assets, no text under 12px.
- `npm run verify:states`: every token defined and AA, every control at rest and under the mouse, the three mark sources agree on geometry (it parses the SVG and the C# constants).
- `npm run verify:site`: old name rejected, version strings current, wordmark font loaded.
- `npm run verify:companion`, `verify:assistant`, `verify:stream`: bylines and titles say Sidelook.
- `npm run build:windows` and `verify:windows`: exe name, icon resource, tray text.

On the desktop, when the maintainer says it is free (hand checks and `verify-desktop-host` need the mouse):

- Fresh profile: dock shows the node, eyes track the cursor across two monitors, CPU under 0.5% for a minute of movement.
- Jarvis profile from 0.15.1 with three saved versions: 0.16.0 moves it, the versions list shows all three, the dock is where it was.
- Reduced motion on: eyes fixed right, no fade.
- Summon and dismiss fade; Ctrl+Shift+E still stops at Send.
- Screenshots for README and the site retaken from the real app: companion, streaming, screen-on, computer; `docs/images/workbench.png` (still the amber palette) is deleted and its README reference replaced by the new studio render once (c) lands.

## Retro line for PLAYBOOK at ship

What the rename touched that a grep would not have found, and whether the name gate caught anything after the first pass.
