# Design

Graphite and mint (chosen 2026-09-06 from five rendered options, `.artifacts/palette-mock.html`). Cool neutrals tinted toward hue 200, one mint accent used for exactly three things: the mark, the primary button, and the thing under the cursor. Dark is not a style choice here; the companion floats over other people's windows and a dark surface recedes. It should read as an instrument, not a lamp.

## Colors

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#141719` (app) / `#171a1d` (site) | Body |
| `--panel` | `#1b1f22` / `#111416` | Raised surfaces, inputs |
| `--line` | `#2b3135` / `#2e3539` | 1px rules and borders |
| `--ink` | `#e9edee` | Body text |
| `--muted` | `#97a2a6` / `#aeb8bb` | Secondary text. 6.9:1 on the app body, 4.5:1+ on the site body |
| `--accent` | `#6fe3c1` | The accent. Hover `--accent-hover` `#8eeccf`. Text on it is `--on-accent` `#0f2a22` (9.8:1) |
| `--paper` | `#eef0f0` | Prototype preview background |
| `--green` | `#7fc9b1` | Ready state only, a dimmer mint so it never competes with the accent |

The long tail of studio shades in `style.css` was retinted by rule (warm and olive neutrals moved to hue 200 at the same lightness; the amber family became the accent), so every surface keeps its relative depth. No gradients on text. No side-stripe borders (`border-left` accents). Grey text never sits on the accent; use `--on-accent`. The mark, the dock button (`desktop/JarvisMark.cs`), the exe icon (`scripts/build-icon.ps1`) and the WebView backdrop carry the same two values: charcoal `20,23,25` and mint `111,227,193`.

## Mark

The mark is a lens: one thick mint ring with a solid mint pupil offset up and right, on a rounded charcoal square. It reads at 16px because it is two shapes. Geometry on a 64 grid: square radius 14, ring center (32,32) radius 18 stroke 6, pupil center (36,28) radius 6.5. Sources of truth: `public/mark.svg` (web), `desktop/JarvisMark.cs` (dock button and tray fallback), `scripts/build-icon.ps1` (the multi-size `desktop/jarvis.ico` embedded in the exe). Change all three together. No letter "J" anywhere in the identity.

## Typography

- App: Segoe UI 14/1.55 for body, Georgia for the occasional italic display line, Bahnschrift for the wordmark. Three families, no more.
- Site: Georgia 17/1.65 body, Segoe UI for controls, captions and labels. Headings weight 400, letter-spacing no tighter than -0.03em, `text-wrap: balance`.
- Scale steps at least 1.25 apart. Uppercase is for short labels under four words, never for sentences, never as a per-section eyebrow.

## Spacing and layout

Site max width 1360px with 48px gutters (24px under 900px). Section padding 56-80px, one dominant idea per section. Two-column grids collapse to one at 900px; the walkthrough tabs go 4-up to 2-up at 620px. App shell max width 1800px, 40px gutters.

## Motion

Ease-out only (`cubic-bezier(.22,1,.36,1)`), 150-300ms. Motion signals state (building, listening, scanning), never decoration. Every animation has a `prefers-reduced-motion` alternative.

## The panel

Borderless, 440 wide, as tall as its content: the page posts its height and the shell moves the top edge with the bottom pinned. Empty over a window it is about 380px. Header 44px: the mark (the drag handle), the sensor line, Settings, dock; no wordmark. The window Jarvis will look at is a tile (28px app icon or the app's initial on `#2a3236`, title in ink 14px/500, app name muted 12px); mid-conversation the tile is one 12px muted line above the box with the app name in ink. Starters are three lines of 14px on 1px rules, no arrows, no cards. Your messages are bubbles on the right (`--panel`, 1px `--line`, radius 10/10/2/10) with the sent frame as a 40×28 thumbnail inside; Jarvis's replies are plain text. No name labels. The box is a 12px-radius field, one 21px line at rest, eight at most before it scrolls inside, with a grip in the corner. Screenshot and Mic are 16px icons; Send is the mint ↑ alone with only words, and "Send with screenshot ↑" with a chip. The line under the box is the model in ink and "may use paid credits" when it applies, and What goes.

## Components

- Buttons: `.button.amber` primary (the class name is historical; it paints `--accent` with `--on-accent` text), `.button.secondary` (raised charcoal), `.quiet` text buttons. Labels are verb plus object.
- Cards are avoided. Lists with 1px rules, definition lists and figures with captions carry the content.
- Screenshots are evidence: captured from the real app, captioned with what they are and what they are not.
