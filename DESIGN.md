# Design

Warm charcoal, ivory, muted amber. One accent, used for the thing that matters right now (the primary button, the selected tab, the mark). Dark is not a style choice here; the companion floats over other people's windows and a dark surface recedes.

## Colors

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#191c1b` (app) / `#20221f` (site) | Body |
| `--panel` | `#202422` / `#191b18` | Raised surfaces, inputs |
| `--line` | `#383e39` / `#45443b` | 1px rules and borders |
| `--ink` | `#eeeae0` / `#eee5d5` | Body text |
| `--muted` | `#a9aea5` / `#c1b6a5` | Secondary text. Site value passes 4.5:1 on `--bg`; app value is for labels 12px+ only |
| `--amber` | `#e4ba7a` / `#e6bb79` | The accent. Hover: `#f0cb93` |
| `--paper` | `#efede5` | Prototype preview background |
| `--green` | `#a9c5a2` | Ready state only |

No gradients on text. No side-stripe borders (`border-left` accents). Grey text never sits on an amber surface; use `#292a20` ink on amber.

## Mark

The mark is a lens: one thick amber ring with a solid amber pupil offset up and right, on a rounded charcoal square. It reads at 16px because it is two shapes. Geometry on a 64 grid: square radius 14, ring center (32,32) radius 18 stroke 6, pupil center (36,28) radius 6.5. Sources of truth: `public/mark.svg` (web), `desktop/JarvisMark.cs` (dock button and tray fallback), `scripts/build-icon.ps1` (the multi-size `desktop/jarvis.ico` embedded in the exe). Change all three together. No letter "J" anywhere in the identity.

## Typography

- App: Segoe UI 14/1.55 for body, Georgia for the occasional italic display line, Bahnschrift for the wordmark. Three families, no more.
- Site: Georgia 17/1.65 body, Segoe UI for controls, captions and labels. Headings weight 400, letter-spacing no tighter than -0.03em, `text-wrap: balance`.
- Scale steps at least 1.25 apart. Uppercase is for short labels under four words, never for sentences, never as a per-section eyebrow.

## Spacing and layout

Site max width 1360px with 48px gutters (24px under 900px). Section padding 56-80px, one dominant idea per section. Two-column grids collapse to one at 900px; the walkthrough tabs go 4-up to 2-up at 620px. App shell max width 1800px, 40px gutters.

## Motion

Ease-out only (`cubic-bezier(.22,1,.36,1)`), 150-300ms. Motion signals state (building, listening, scanning), never decoration. Every animation has a `prefers-reduced-motion` alternative.

## Components

- Buttons: `.button.amber` primary (amber on ink), `.button.secondary` (raised charcoal), `.quiet` text buttons. Labels are verb plus object.
- Cards are avoided. Lists with 1px rules, definition lists and figures with captions carry the content.
- Screenshots are evidence: captured from the real app, captioned with what they are and what they are not.
