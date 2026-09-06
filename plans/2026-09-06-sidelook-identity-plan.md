# Sidelook Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename Jarvis to Sidelook as a Practical Systems product: one white hexagon node with navy eyes that follow the cursor, the family palette, a lowercase wordmark, a one-time profile move, and a lint gate that keeps the old name out.

**Architecture:** The mark has one geometry in four places (SVG, C#, PowerShell icon build, OG build) and a verifier that reads all of them. Eye motion is a pure function (`public/eyes.js` and its C# twin in `SidelookMark.cs`) driven by `mousemove` in the page and a 40 ms cursor poll in the shell, which also posts the cursor to the page when the pointer is outside the window. Every user-visible string is renamed by a scoped sed, then `npm run lint` refuses the old name anywhere but marked legacy lines.

**Tech Stack:** Node 24 (ESM, `node:test`), WinForms + WebView2 in C# compiled by the framework `csc.exe`, PowerShell 5 build scripts, Playwright via `scripts/browser.mjs`, Vercel static hosting.

**Spec:** `plans/2026-09-06-sidelook-identity-design.md`

## Global Constraints

- Node `>=24`; zero runtime dependencies; no new npm packages.
- Product name is `Sidelook`; wordmark is lowercase `sidelook`; the word Jarvis survives only on lines containing `legacy` (kernel object names, the old profile path) and in history files (CHANGELOG entries before 0.16.0, PLAYBOOK.md, docs/ERRORS.md, docs/DECISIONS.md, docs/SITE.md release log, plans/, .artifacts/).
- Palette: `--bg #171D2D`, `--panel #1F2638` (site `#12172A`), `--line #2C3549` (site `#303A50`), `--ink #F8FAFC`, `--muted #A3ADBD` (site `#B3BCCA`), `--accent #2DD4A8`, `--accent-hover #4EE0B8`, `--on-accent #0B1F1A`, `--paper #F8FAFC`, `--green #10B981`, `--hub #FFFFFF`. Native: Navy `23,29,45`.
- Mark on the 64 grid: rounded square radius 14 (only where a background is needed); hexagon `32,10 51,21 51,43 32,54 13,43 13,21` in white; eyes radius 3.6, home `(26,32)` `(38,32)`, travel 5, reach 120; static renders at `(31,32)` `(43,32)`.
- No text under 12px in `public/*.css`; the clipboard stays write-only; every `var(--token)` defined and not self-referential; AA contrast on every control at rest and under the mouse (`verify:states`).
- Version `0.16.0`. Port 4317, hotkeys, formats unchanged.
- Commit format `Claude: [TYPE] description`, one feature per commit, never commit `.artifacts/`.
- Outward copy: no em dashes, no hype.

---

## File map

| File | Responsibility |
| --- | --- |
| `public/eyes.js` (new) | Pure eye geometry: `eyeOffset`, `eyeCenters`, constants. |
| `tests/eyes.test.mjs` (new) | Cases for the geometry. |
| `public/mark.svg` | Static mark, eyes right. |
| `desktop/SidelookMark.cs` (renamed from `JarvisMark.cs`) | Native draw with eye offset, `EyeOffset` twin, app icon fallback. |
| `desktop/ProfileMigration.cs` (new) | `Decide` and `Apply` for the one-time folder move. |
| `scripts/build-icon.ps1` | Renders `desktop/sidelook.ico`. |
| `scripts/verify-mark.ps1` (new) | Compiles the two C# files with a test `Main`; checks geometry agreement across SVG, C#, PowerShell; migration cases on temp folders. |
| `public/style.css`, `public/companion.css`, `site/site.css` | Family palette tokens and retinted long tail. |
| `public/index.html`, `public/companion.js` | Live header mark, cursor message, About block. |
| `desktop/DesktopShell.cs` | Eye timer, cursor posting, fade, navy backdrop, strings. |
| `desktop/Launcher.cs`, `desktop/CaptureService.cs`, `desktop/FollowService.cs` | Strings, root folder, migration call. |
| `server.mjs`, `lib/*.mjs`, `public/*.js`, `tests/*.mjs` | Renamed strings and header names. |
| `scripts/check.mjs`, `scripts/verify-site.mjs`, `scripts/verify-states.mjs` | Name gate, old-name rejection on the site, geometry agreement. |
| `site/index.html`, `site/vercel.json`, `site/plus-jakarta-sans-700.woff2` (new), `scripts/build-site.mjs`, `scripts/build-social.mjs` | Wordmark, family ties, new origin, redirect, OG card. |
| `README.md`, `PRODUCT.md`, `DESIGN.md`, `CHANGELOG.md`, `docs/*.md` | Documentation for the new identity. |

---

### Task 1: Eye geometry as a pure module

**Files:**
- Create: `public/eyes.js`
- Create: `tests/eyes.test.mjs`
- Modify: `server.mjs` (the `assets` map, so `/eyes.js` is served; find the line that registers `/follow.js` and add `/eyes.js` the same way)

**Interfaces:**
- Produces: `eyeOffset({size, left, top, cursor, reducedMotion}) -> {dx, dy}` in grid units; `eyeCenters(offset) -> [[x,y],[x,y]]`; `EYE_HOME`, `EYE_TRAVEL = 5`, `EYE_REACH = 120`, `STATIC_RIGHT = {dx:5, dy:0}`. `cursor` is `{x,y}` in the same coordinate space as `left`/`top`, or `null` when unknown.

- [ ] **Step 1: Write the failing test**

```js
// tests/eyes.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { eyeOffset, eyeCenters, EYE_TRAVEL, STATIC_RIGHT } from '../public/eyes.js';

const mark={size:64,left:100,top:100};
const close=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);

test('no cursor or reduced motion: the static sidelong look', () => {
  assert.deepEqual(eyeOffset({...mark,cursor:null}),STATIC_RIGHT);
  assert.deepEqual(eyeOffset({...mark,cursor:{x:0,y:0},reducedMotion:true}),STATIC_RIGHT);
});

test('cursor inside the mark: eyes centred', () => {
  assert.deepEqual(eyeOffset({...mark,cursor:{x:132,y:132}}),{dx:0,dy:0});
  assert.deepEqual(eyeOffset({...mark,cursor:{x:100,y:163}}),{dx:0,dy:0});
});

test('far cursor turns the eyes fully, never past the travel', () => {
  const right=eyeOffset({...mark,cursor:{x:2000,y:132}});
  close(right.dx,EYE_TRAVEL);close(right.dy,0);
  const upLeft=eyeOffset({...mark,cursor:{x:-1000,y:-1000}});
  close(Math.hypot(upLeft.dx,upLeft.dy),EYE_TRAVEL);
  assert.ok(upLeft.dx<0&&upLeft.dy<0);
});

test('near cursor turns the eyes in proportion to distance, scaled by mark size', () => {
  // 60 grid units away at size 64 is half the reach.
  const half=eyeOffset({...mark,cursor:{x:132+60,y:132}});
  close(half.dx,EYE_TRAVEL/2);
  // The same pixel distance on a 32px mark is twice the grid distance, so fully turned.
  const small=eyeOffset({size:32,left:100,top:100,cursor:{x:116+60,y:116}});
  close(small.dx,EYE_TRAVEL);
});

test('eye centres are the home points plus the offset', () => {
  assert.deepEqual(eyeCenters({dx:5,dy:0}),[[31,32],[43,32]]);
  assert.deepEqual(eyeCenters({dx:0,dy:0}),[[26,32],[38,32]]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/eyes.test.mjs`
Expected: FAIL, `Cannot find module '../public/eyes.js'`.

- [ ] **Step 3: Write the module**

```js
// public/eyes.js
// The node's eyes look toward the cursor. Pure: no DOM, no timers, no state. Units are the mark's 64 grid;
// callers pass the mark's on-screen size and origin and get an offset to add to the home points.
// Mirrored in desktop/SidelookMark.cs (EyeOffset); scripts/verify-mark.ps1 checks the two agree.
export const EYE_HOME=[[26,32],[38,32]];
export const EYE_TRAVEL=5;    // grid units; keeps a 3.6-radius eye inside the hexagon at every angle
export const EYE_REACH=120;   // grid units of cursor distance at which the eyes are fully turned
export const STATIC_RIGHT=Object.freeze({dx:EYE_TRAVEL,dy:0});

export function eyeOffset({size,left,top,cursor,reducedMotion=false}){
  if(reducedMotion||!cursor)return STATIC_RIGHT;
  const unit=size/64;
  if(cursor.x>=left&&cursor.x<left+size&&cursor.y>=top&&cursor.y<top+size)return {dx:0,dy:0};
  const vx=cursor.x-(left+32*unit),vy=cursor.y-(top+32*unit);
  const d=Math.hypot(vx,vy);
  if(!d)return {dx:0,dy:0};
  const o=Math.min(d/(EYE_REACH*unit),1)*EYE_TRAVEL;
  return {dx:o*vx/d,dy:o*vy/d};
}

export function eyeCenters(offset){return EYE_HOME.map(([x,y])=>[x+offset.dx,y+offset.dy]);}
```

- [ ] **Step 4: Serve it**

In `server.mjs`, find the `assets` entry for `follow.js` and add an identical entry for `eyes.js` (same content type, same directory). `npm run lint` fails if a served route has no file or a referenced file is not served, so this is checked in Task 4.

- [ ] **Step 5: Run tests**

Run: `node --test tests/eyes.test.mjs && npm test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add public/eyes.js tests/eyes.test.mjs server.mjs
git commit -m "Claude: [FEAT] eyes.js: pure eye geometry for the Sidelook mark"
```

---

### Task 2: The mark in four sources and a verifier that reads them

**Files:**
- Modify: `public/mark.svg`
- Rename + rewrite: `desktop/JarvisMark.cs` -> `desktop/SidelookMark.cs`
- Modify: `scripts/build-icon.ps1`
- Create: `scripts/verify-mark.ps1`
- Modify: `package.json` (add `"verify:mark": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-mark.ps1"`)
- Modify: `desktop/DesktopShell.cs`, `desktop/Launcher.cs` (only the `JarvisMark` references, so the shell compiles; full renames come in Task 6)
- Delete: `desktop/jarvis.ico`; Create: `desktop/sidelook.ico` (generated)
- Modify: `scripts/build-windows.ps1` line 67-68 (`desktop/sidelook.ico`)

**Interfaces:**
- Produces: `SidelookMark.Navy`, `SidelookMark.Hub`, `SidelookMark.EyeTravel`, `SidelookMark.EyeOffset(Rectangle bounds, Point? cursor, bool reducedMotion) -> PointF`, `SidelookMark.Draw(Graphics g, Rectangle bounds, PointF eyes, bool background, bool wide)`, `SidelookMark.AppIcon()`.

- [ ] **Step 1: Write the verifier first (it fails until the sources agree)**

```powershell
# scripts/verify-mark.ps1
# The mark has one geometry in three sources (public/mark.svg, desktop/SidelookMark.cs, scripts/build-icon.ps1) and one eye function
# in two (public/eyes.js, SidelookMark.EyeOffset). This compiles the C# with a test entry point and checks every one of them agrees.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$hex = '32,10 51,21 51,43 32,54 13,43 13,21'
$checks = 0
$svg = Get-Content public/mark.svg -Raw
if ($svg -notmatch [regex]::Escape("points=`"$hex`"")) { throw 'mark.svg hexagon differs from the canonical points.' }; $checks++
if ($svg -notmatch 'cx="31" cy="32" r="3.6"' -or $svg -notmatch 'cx="43" cy="32" r="3.6"') { throw 'mark.svg eyes are not at the static right (31,32) (43,32) r 3.6.' }; $checks++
if ($svg -notmatch 'fill="#171D2D"') { throw 'mark.svg background is not Navy #171D2D.' }; $checks++
$ps = Get-Content scripts/build-icon.ps1 -Raw
if ($ps -notmatch [regex]::Escape($hex)) { throw 'build-icon.ps1 hexagon differs from the canonical points.' }; $checks++
if ($ps -notmatch 'sidelook\.ico') { throw 'build-icon.ps1 does not write desktop/sidelook.ico.' }; $checks++
$js = Get-Content public/eyes.js -Raw
if ($js -notmatch 'EYE_TRAVEL=5' -or $js -notmatch 'EYE_REACH=120') { throw 'eyes.js constants differ from the spec.' }; $checks++

New-Item -ItemType Directory -Force .artifacts | Out-Null
$test = Join-Path (Resolve-Path .artifacts) 'mark-test.cs'
@'
using System; using System.Drawing; using System.IO;
static class MarkTest {
    static int failures = 0;
    static void Close(double a, double b, string what) { if (Math.Abs(a - b) > 1e-4) { Console.WriteLine("FAIL " + what + ": " + a + " vs " + b); failures++; } }
    static int Main() {
        var bounds = new Rectangle(100, 100, 64, 64);
        var s = SidelookMark.EyeOffset(bounds, null, false); Close(s.X, 5, "no cursor dx"); Close(s.Y, 0, "no cursor dy");
        var r = SidelookMark.EyeOffset(bounds, new Point(0, 0), true); Close(r.X, 5, "reduced dx"); Close(r.Y, 0, "reduced dy");
        var inside = SidelookMark.EyeOffset(bounds, new Point(132, 132), false); Close(inside.X, 0, "inside dx"); Close(inside.Y, 0, "inside dy");
        var far = SidelookMark.EyeOffset(bounds, new Point(2000, 132), false); Close(far.X, 5, "far dx"); Close(far.Y, 0, "far dy");
        var half = SidelookMark.EyeOffset(bounds, new Point(192, 132), false); Close(half.X, 2.5, "half dx");
        var small = SidelookMark.EyeOffset(new Rectangle(100, 100, 32, 32), new Point(176, 116), false); Close(small.X, 5, "small mark dx");
        var upLeft = SidelookMark.EyeOffset(bounds, new Point(-1000, -1000), false); Close(Math.Sqrt(upLeft.X * upLeft.X + upLeft.Y * upLeft.Y), 5, "up-left magnitude");
        using (var bmp = new Bitmap(64, 64)) using (var g = Graphics.FromImage(bmp)) {
            SidelookMark.Draw(g, new Rectangle(0, 0, 64, 64), new PointF(5, 0), true, false);
            if (bmp.GetPixel(32, 20).ToArgb() != Color.White.ToArgb()) { Console.WriteLine("FAIL hub pixel not white"); failures++; }
            if (bmp.GetPixel(43, 32).ToArgb() != SidelookMark.Navy.ToArgb()) { Console.WriteLine("FAIL right eye pixel not navy"); failures++; }
            if (bmp.GetPixel(2, 2).ToArgb() != SidelookMark.Navy.ToArgb()) { Console.WriteLine("FAIL corner not navy"); failures++; }
        }
        Console.WriteLine(failures == 0 ? "PASS: 14 mark assertions" : failures + " mark assertion(s) failed");
        return failures == 0 ? 0 : 1;
    }
}
'@ | Set-Content -LiteralPath $test -Encoding UTF8
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe = Join-Path (Resolve-Path .artifacts) 'mark-test.exe'
& $csc /nologo /target:exe /out:$exe /reference:System.Drawing.dll /reference:System.Windows.Forms.dll desktop/SidelookMark.cs $test
if ($LASTEXITCODE -ne 0) { throw 'mark test did not compile.' }
& $exe; if ($LASTEXITCODE -ne 0) { throw 'mark test failed.' }
$ico = Get-Item desktop/sidelook.ico -ErrorAction Stop
if ($ico.Length -lt 20000) { throw "sidelook.ico is only $($ico.Length) bytes; run scripts/build-icon.ps1." }; $checks++
Write-Output "PASS: $checks source checks, 15 compiled assertions, sidelook.ico $($ico.Length) bytes."
```

Add to `package.json` scripts: `"verify:mark": "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-mark.ps1"`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run verify:mark`
Expected: FAIL at the first check, `mark.svg hexagon differs`.

- [ ] **Step 3: Write `public/mark.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#171D2D"/><polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="#fff"/><circle cx="31" cy="32" r="3.6" fill="#171D2D"/><circle cx="43" cy="32" r="3.6" fill="#171D2D"/></svg>
```

- [ ] **Step 4: Write `desktop/SidelookMark.cs`** (`git mv desktop/JarvisMark.cs desktop/SidelookMark.cs`, then replace the contents)

```cs
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

// The Sidelook mark: one node of the Practical Systems mark, a white hexagon with two navy eyes, on a navy rounded square
// where a background is needed. Same geometry as public/mark.svg and scripts/build-icon.ps1, same eye function as public/eyes.js.
// scripts/verify-mark.ps1 checks all of them agree. 64 grid: square radius 14; hexagon 32,10 51,21 51,43 32,54 13,43 13,21;
// eyes r 3.6 at home (26,32) (38,32), travel 5, reach 120; static renders look right, (31,32) (43,32).
internal static class SidelookMark {
    public static readonly Color Navy = Color.FromArgb(23, 29, 45);
    public static readonly Color Hub = Color.White;
    public const float EyeTravel = 5f, EyeReach = 120f, EyeRadius = 3.6f, EyeWide = 0.4f;
    static readonly PointF[] Home = { new PointF(26, 32), new PointF(38, 32) };
    static readonly PointF[] Hexagon = { new PointF(32, 10), new PointF(51, 21), new PointF(51, 43), new PointF(32, 54), new PointF(13, 43), new PointF(13, 21) };

    public static GraphicsPath RoundedSquare(Rectangle bounds, float radius) {
        var path = new GraphicsPath();
        float d = radius * 2;
        path.AddArc(bounds.X, bounds.Y, d, d, 180, 90);
        path.AddArc(bounds.Right - d, bounds.Y, d, d, 270, 90);
        path.AddArc(bounds.Right - d, bounds.Bottom - d, d, d, 0, 90);
        path.AddArc(bounds.X, bounds.Bottom - d, d, d, 90, 90);
        path.CloseFigure();
        return path;
    }

    // Where the eyes look, in grid units, for a mark drawn in bounds (screen coordinates) and a cursor in the same space.
    // Null cursor or reduced motion: the static sidelong look. Inside the mark: centred. Otherwise toward the cursor, fully turned at EyeReach units.
    public static PointF EyeOffset(Rectangle bounds, Point? cursor, bool reducedMotion) {
        if (reducedMotion || cursor == null) return new PointF(EyeTravel, 0);
        Point c = cursor.Value;
        if (bounds.Contains(c)) return PointF.Empty;
        float unit = Math.Min(bounds.Width, bounds.Height) / 64f;
        double vx = c.X - (bounds.X + 32 * unit), vy = c.Y - (bounds.Y + 32 * unit);
        double d = Math.Sqrt(vx * vx + vy * vy);
        if (d == 0) return PointF.Empty;
        double o = Math.Min(d / (EyeReach * unit), 1) * EyeTravel;
        return new PointF((float)(o * vx / d), (float)(o * vy / d));
    }

    public static void Draw(Graphics graphics, Rectangle bounds, PointF eyes, bool background, bool wide) {
        graphics.SmoothingMode = SmoothingMode.AntiAlias;
        float unit = Math.Min(bounds.Width, bounds.Height) / 64f;
        if (background) {
            using (GraphicsPath square = RoundedSquare(bounds, 14 * unit))
            using (var fill = new SolidBrush(Navy)) graphics.FillPath(fill, square);
        }
        var hex = new PointF[Hexagon.Length];
        for (int i = 0; i < hex.Length; i++) hex[i] = new PointF(bounds.X + Hexagon[i].X * unit, bounds.Y + Hexagon[i].Y * unit);
        using (var hub = new SolidBrush(Hub)) graphics.FillPolygon(hub, hex);
        float r = (EyeRadius + (wide ? EyeWide : 0)) * unit;
        using (var ink = new SolidBrush(Navy))
            foreach (PointF home in Home)
                graphics.FillEllipse(ink, bounds.X + (home.X + eyes.X) * unit - r, bounds.Y + (home.Y + eyes.Y) * unit - r, r * 2, r * 2);
    }

    // The exe carries sidelook.ico; a drawn 32px fallback keeps the tray from showing the stock Windows icon.
    public static Icon AppIcon() {
        try { return Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        using (var bitmap = new Bitmap(32, 32))
        using (Graphics graphics = Graphics.FromImage(bitmap)) {
            graphics.Clear(Color.Transparent);
            Draw(graphics, new Rectangle(0, 0, 32, 32), new PointF(EyeTravel, 0), true, false);
            return Icon.FromHandle(bitmap.GetHicon());
        }
    }
}
```

- [ ] **Step 5: Point the shell at the new class so it still compiles**

In `desktop/DesktopShell.cs` and `desktop/Launcher.cs` replace every `JarvisMark.Charcoal` with `SidelookMark.Navy`, `JarvisMark.AppIcon()` with `SidelookMark.AppIcon()`, and the dock paint line (DesktopShell.cs:85) with:

```cs
            SidelookMark.Draw(args.Graphics, dockButton.ClientRectangle, new PointF(SidelookMark.EyeTravel, 0), false, dockHover);
```

Also `DesktopShell.cs:49` `DefaultBackgroundColor = Color.FromArgb(23, 29, 45)`. Delete the `Amber`/`AmberHover` references (they no longer exist).

- [ ] **Step 6: Rewrite `scripts/build-icon.ps1`**

Change the header comment and the two colour lines, the output path, and the body of `Render`:

```powershell
# Renders desktop/sidelook.ico from the mark geometry shared with public/mark.svg and desktop/SidelookMark.cs.
# Run once after changing the mark: powershell -NoProfile -File scripts/build-icon.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'desktop/sidelook.ico'
$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$navy = [System.Drawing.Color]::FromArgb(23, 29, 45)
$hub = [System.Drawing.Color]::White
# 64 grid: hexagon 32,10 51,21 51,43 32,54 13,43 13,21; eyes r 3.6 at (31,32) (43,32), the static sidelong look.
$hexagon = @(@(32,10), @(51,21), @(51,43), @(32,54), @(13,43), @(13,21))

function Render([int]$size) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    $unit = $size / 64.0
    $radius = 14 * $unit; $d = $radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc($size - $d, 0, $d, $d, 270, 90)
    $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $path.AddArc(0, $size - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath((New-Object System.Drawing.SolidBrush $navy), $path)
    $points = [System.Drawing.PointF[]]($hexagon | ForEach-Object { New-Object System.Drawing.PointF ([single]($_[0] * $unit)), ([single]($_[1] * $unit)) })
    $g.FillPolygon((New-Object System.Drawing.SolidBrush $hub), $points)
    $eye = 3.6 * $unit
    foreach ($cx in @(31, 43)) { $g.FillEllipse((New-Object System.Drawing.SolidBrush $navy), [single]($cx * $unit - $eye), [single](32 * $unit - $eye), [single]($eye * 2), [single]($eye * 2)) }
    $g.Dispose()
    return $bitmap
}
```

Keep `Dib`, `Png` and the ICONDIR writer exactly as they are.

- [ ] **Step 7: Generate the icon, switch the build to it, run the verifier**

```bash
git rm -q desktop/jarvis.ico
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build-icon.ps1
sed -i "s#desktop/jarvis.ico#desktop/sidelook.ico#g" scripts/build-windows.ps1
npm run verify:mark
```
Expected: `PASS: 7 source checks, 14 compiled assertions, sidelook.ico <n> bytes.`

- [ ] **Step 8: Prove the verifier bites.** Change `13,21` to `13,22` in `public/mark.svg`, run `npm run verify:mark`, expect `mark.svg hexagon differs`. Revert. Change `EyeReach = 120f` to `60f` in the C#, run, expect `FAIL half dx`. Revert.

- [ ] **Step 9: Commit**

```bash
git add public/mark.svg desktop/SidelookMark.cs desktop/sidelook.ico desktop/DesktopShell.cs desktop/Launcher.cs scripts/build-icon.ps1 scripts/build-windows.ps1 scripts/verify-mark.ps1 package.json
git commit -m "Claude: [FEAT] the Sidelook mark: one Practical Systems node in SVG, C#, the icon build, and a verifier that reads all three"
```

---

### Task 3: Family palette

**Files:**
- Modify: `public/style.css:3`, `public/companion.css`, `site/site.css:1`
- Modify: `scripts/build-social.mjs` (background and text colours in the inline HTML)
- Scratch: `<scratchpad>/retint.mjs` (not committed)

- [ ] **Step 1: Retint by rule first, then set the token lines** (the rule maps every old token value to its new one; running it first keeps the hand-set values below untouched)

Run Step 2's script, then make `public/style.css` line 3 read:
```css
  :root { color-scheme: dark; --bg:#171D2D; --panel:#1F2638; --line:#2C3549; --ink:#F8FAFC; --muted:#A3ADBD; --accent:#2DD4A8; --accent-hover:#4EE0B8; --on-accent:#0B1F1A; --paper:#F8FAFC; --green:#10B981; --hub:#FFFFFF; --ease:cubic-bezier(.22,1,.36,1); }
```

`site/site.css` line 1:
```css
:root{color-scheme:dark;--ink:#F8FAFC;--muted:#B3BCCA;--accent:#2DD4A8;--accent-hover:#4EE0B8;--on-accent:#0B1F1A;--line:#303A50;--panel:#12172A;--raised:#222A3D;--bg:#171D2D;--hub:#FFFFFF;--ease:cubic-bezier(.22,1,.36,1)}
```

- [ ] **Step 2: The retint script** (run before Step 1's edits)

Write to the scratchpad and run once. It rewrites literal hex colours in the three stylesheets: exact old values map to the new tokens' values; any other low-saturation shade keeps its lightness and moves to hue 224 with at least 18% saturation; saturated colours (the accent family already mapped, the fixture orange, the error red) are left alone. It prints the count so the change is reviewable.

```js
// retint.mjs  (run: node retint.mjs C:/Projects/jarvis)
import {readFile,writeFile} from 'node:fs/promises';
const root=process.argv[2];
const explicit={'#141719':'#171D2D','#171a1d':'#171D2D','#1b1f22':'#1F2638','#111416':'#12172A','#1d2226':'#222A3D','#2b3135':'#2C3549','#2e3539':'#303A50','#e9edee':'#F8FAFC','#97a2a6':'#A3ADBD','#aeb8bb':'#B3BCCA','#6fe3c1':'#2DD4A8','#8eeccf':'#4EE0B8','#0f2a22':'#0B1F1A','#eef0f0':'#F8FAFC','#7fc9b1':'#10B981','#232a2e':'#242C40','#2a3236':'#2B3448'};
const keep=new Set(Object.values(explicit).map(v=>v.toLowerCase()));
const toHsl=h=>{let r=parseInt(h.slice(1,3),16)/255,g=parseInt(h.slice(3,5),16)/255,b=parseInt(h.slice(5,7),16)/255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;if(max===min)return [0,0,l];const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);let hh=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;return [hh*60,s,l];};
const toHex=(h,s,l)=>{const f=n=>{const k=(n+h/30)%12,a=s*Math.min(l,1-l);return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return `#${f(0)}${f(8)}${f(4)}`;};
let changed=0;
for(const file of ['public/style.css','public/companion.css','site/site.css']){
  let text=await readFile(`${root}/${file}`,'utf8');
  text=text.replace(/#([0-9a-fA-F]{6})\b/g,(m)=>{const key=m.toLowerCase();if(explicit[key]){changed++;return explicit[key];}const [h,s,l]=toHsl(key);if(s>=.2)return m;changed++;return toHex(224,Math.max(s,.18),l);});
  text=text.replace(/#([0-9a-fA-F]{3})\b(?![0-9a-fA-F])/g,(m,x)=>{const full='#'+x.split('').map(c=>c+c).join('').toLowerCase();if(explicit[full]){changed++;return explicit[full];}const [h,s,l]=toHsl(full);if(s>=.2||l>.97||l<.03)return m;changed++;return toHex(224,Math.max(s,.18),l);});
  await writeFile(`${root}/${file}`,text);
}
console.log(`retinted ${changed} colour literals`);
```

Do not retint `--paper`/white or pure black (the guards on lightness keep them). After running, `git diff --stat` and read the diff of every changed line once; any colour on a `.button.amber` rule must be a token, not a literal.

- [ ] **Step 3: The OG builder's inline colours.** In `scripts/build-social.mjs` replace `#171a1d` with `#171D2D` and `#e9edee` with `#F8FAFC`, and the accent if it appears.

- [ ] **Step 4: Verify**

```bash
npm run lint && npm run verify:states
```
Expected: `verify:states` PASS with its counts. Any `TEXT`/`REST`/`HOVER` finding under 4.5:1 is fixed by lightening that one `--muted`-class colour toward `#B3BCCA`, never by lowering the threshold.

- [ ] **Step 5: Commit**

```bash
git add public/style.css public/companion.css site/site.css scripts/build-social.mjs
git commit -m "Claude: [FEAT] family palette: Practical Systems navy and teal across the app and the site"
```

---

### Task 4: Live eyes in the page

**Files:**
- Modify: `public/index.html:116` (panel header), `public/index.html:29-31` (studio toolbar)
- Modify: `public/companion.css:15`
- Modify: `public/companion.js` (import, `lookAt`, `mousemove`, `cursor` message)

**Interfaces:**
- Consumes: `eyeOffset`, `eyeCenters` from Task 1.
- Produces: handles shell message `{type:"cursor", x, y, left, top}` where `x,y` are the cursor in screen pixels and `left,top` the page's client origin in screen pixels (Task 5 sends it).

- [ ] **Step 1: Markup.** Replace the `<img src="/mark.svg" alt="">` inside `#companion-drag` with:

```html
<svg class="mark-live" viewBox="0 0 64 64" width="22" height="22" aria-hidden="true"><polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="#fff"/><circle class="eye" cx="31" cy="32" r="3.6"/><circle class="eye" cx="43" cy="32" r="3.6"/></svg>
```

In the studio toolbar, before `<button class="quiet" id="companion-back">`, add:

```html
      <span class="toolbar-mark" aria-hidden="true"><svg class="mark-live" viewBox="0 0 64 64" width="22" height="22"><polygon points="32,10 51,21 51,43 32,54 13,43 13,21" fill="#fff"/><circle class="eye" cx="31" cy="32" r="3.6"/><circle class="eye" cx="43" cy="32" r="3.6"/></svg></span>
```

- [ ] **Step 2: Style.** In `public/companion.css` line 15 change `.companion-brand img{width:22px;height:22px}` to `.companion-brand .mark-live{width:22px;height:22px;display:block}`. Append to `public/style.css` in the components layer:

```css
  .mark-live .eye { fill:var(--bg); }
  .toolbar-mark { display:flex; align-items:center; padding:0 4px 0 2px; }
```

- [ ] **Step 3: Behaviour.** At the top of `public/companion.js` add `import {eyeOffset,eyeCenters} from './eyes.js';`. Near the other module-level helpers add:

```js
  // The mark's eyes look toward the cursor: in-page moves drive them here; when the pointer is outside the window the shell posts it (type 'cursor').
  const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
  let lastLook=0;
  function lookAt(cursor){
    for(const svg of document.querySelectorAll('.mark-live')){
      const r=svg.getBoundingClientRect();if(!r.width)continue;
      const eyes=svg.querySelectorAll('.eye');
      eyeCenters(eyeOffset({size:r.width,left:r.left,top:r.top,cursor,reducedMotion:reducedMotion.matches})).forEach(([x,y],i)=>{eyes[i].setAttribute('cx',x.toFixed(2));eyes[i].setAttribute('cy',y.toFixed(2));});
    }
  }
  document.addEventListener('mousemove',e=>{const now=performance.now();if(now-lastLook<40)return;lastLook=now;lookAt({x:e.clientX,y:e.clientY});});
  lookAt(null);
```

In the `native?.addEventListener('message', ...)` handler add, beside the other `data.type` branches:

```js
    if(data.type==='cursor')lookAt({x:data.x-data.left,y:data.y-data.top});
```

- [ ] **Step 4: Verify in the browser check**

```bash
npm run lint && npm run verify:companion && npm run verify:states
```
Expected: lint resolves `/eyes.js`; the companion check still passes (it drives the panel with a synthetic shell); states passes. Then open `http://127.0.0.1:4317/?companion` after `npm start`, move the mouse around the page, and watch the eyes. Close the server.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/companion.css public/style.css public/companion.js
git commit -m "Claude: [FEAT] the header mark's eyes follow the cursor in the panel and the studio"
```

---

### Task 5: Live eyes in the dock, cursor posting to the page

**Files:**
- Modify: `desktop/DesktopShell.cs` (fields near line 34-64, constructor near 84-108, `Shutdown`, `AnimationsEnabled` use)

**Interfaces:**
- Consumes: `SidelookMark.EyeOffset`, `SidelookMark.Draw` (Task 2). Posts `{type:"cursor", x, y, left, top}` (Task 4 consumes).

- [ ] **Step 1: Fields**

```cs
    readonly Timer eyeTimer = new Timer { Interval = 40 };
    PointF eyes = new PointF(SidelookMark.EyeTravel, 0);
    Point lastCursor = new Point(int.MinValue, int.MinValue);
    bool animations = true;   // Windows' animation switch, refreshed on preference change; false means the eyes stay at the static right
```

- [ ] **Step 2: Constructor.** Replace the dock paint line with `SidelookMark.Draw(args.Graphics, dockButton.ClientRectangle, eyes, false, dockHover);` and after `panelTimer.Tick += ...` add:

```cs
        animations = AnimationsEnabled();
        Microsoft.Win32.SystemEvents.UserPreferenceChanged += OnPreferenceChanged;
        Microsoft.Win32.SystemEvents.SessionSwitch += OnSessionSwitch;
        eyeTimer.Tick += delegate { TrackEyes(); };
        eyeTimer.Start();
```

- [ ] **Step 3: Methods** (next to `AnimationsEnabled`):

```cs
    void OnPreferenceChanged(object sender, Microsoft.Win32.UserPreferenceChangedEventArgs args) { animations = AnimationsEnabled(); lastCursor = new Point(int.MinValue, int.MinValue); }

    // A locked session has no cursor to follow; the eyes rest and the timer stops until the desktop is back.
    void OnSessionSwitch(object sender, Microsoft.Win32.SessionSwitchEventArgs args) {
        if (args.Reason == Microsoft.Win32.SessionSwitchReason.SessionLock) { eyeTimer.Stop(); SetEyes(new PointF(SidelookMark.EyeTravel, 0)); }
        else if (args.Reason == Microsoft.Win32.SessionSwitchReason.SessionUnlock) eyeTimer.Start();
    }

    // 25 times a second: read the cursor, and only when it moved either turn the dock's eyes or tell the page where it is.
    void TrackEyes() {
        Point cursor = Cursor.Position;
        if (cursor == lastCursor) return;
        lastCursor = cursor;
        if (mode == "dock") {
            SetEyes(SidelookMark.EyeOffset(dockButton.RectangleToScreen(dockButton.ClientRectangle), cursor, !animations));
        } else if (Visible && ready && animations) {
            Point origin = web.PointToScreen(Point.Empty);
            Post(new Dictionary<string, object> { {"type", "cursor"}, {"x", cursor.X}, {"y", cursor.Y}, {"left", origin.X}, {"top", origin.Y} });
        }
    }

    void SetEyes(PointF next) {
        // Redraw only when an eye moves a quarter unit; the dock is 76px so that is under a pixel.
        if (Math.Round(next.X * 4) == Math.Round(eyes.X * 4) && Math.Round(next.Y * 4) == Math.Round(eyes.Y * 4)) return;
        eyes = next;
        dockButton.Invalidate();
    }
```

In `Shutdown()` before `Close();` add:

```cs
        eyeTimer.Stop();
        Microsoft.Win32.SystemEvents.UserPreferenceChanged -= OnPreferenceChanged;
        Microsoft.Win32.SystemEvents.SessionSwitch -= OnSessionSwitch;
```

- [ ] **Step 4: Compile and run the shell**

```bash
npm run build:windows
```
Expected: `PASS: packaged ...`. Then, only if the maintainer has said the desktop is free (memory: desktop-driving needs a free desktop), run `powershell -NoProfile -File scripts/verify-desktop-host.ps1` and watch the dock: the eyes follow the pointer, and Task Manager shows the exe under 0.5% CPU while the mouse moves for a minute. If the desktop is not free, record the CPU check as owed in the task report.

- [ ] **Step 5: Commit**

```bash
git add desktop/DesktopShell.cs
git commit -m "Claude: [FEAT] the dock's eyes follow the cursor; the shell posts the cursor to the page when it is outside the window"
```

---

### Task 6: Rename the native shell and build scripts, move the profile once

**Files:**
- Create: `desktop/ProfileMigration.cs`
- Modify: `desktop/Launcher.cs`, `desktop/DesktopShell.cs`, `desktop/CaptureService.cs`, `desktop/FollowService.cs`
- Modify: `scripts/build-windows.ps1`, `scripts/start.ps1`, `scripts/verify-desktop-host.ps1`, `scripts/verify-windows-lifecycle.ps1`, `scripts/verify-windows.mjs`, `scripts/verify-mark.ps1` (add migration cases)
- Rename: `Start Jarvis.cmd` -> `Start Sidelook.cmd`
- Modify: `package.json` (`"name": "sidelook"`, `"version": "0.16.0"`)

**Interfaces:**
- Produces: `ProfileMigration.Decide(bool newExists, bool legacyExists) -> ProfileMigration.Plan` (`None`/`Move`), `ProfileMigration.Apply(string legacyRoot, string newRoot)`.

- [ ] **Step 1: Migration cases in the verifier (fail first).** Append to `scripts/verify-mark.ps1` before the `$csc` line, inside the here-string's `Main` after the drawing block:

```cs
        if (ProfileMigration.Decide(false, true) != ProfileMigration.Plan.Move) { Console.WriteLine("FAIL decide: legacy only should move"); failures++; }
        if (ProfileMigration.Decide(true, true) != ProfileMigration.Plan.None) { Console.WriteLine("FAIL decide: both present should not move"); failures++; }
        if (ProfileMigration.Decide(false, false) != ProfileMigration.Plan.None) { Console.WriteLine("FAIL decide: neither present should not move"); failures++; }
        string temp = Path.Combine(Path.GetTempPath(), "sidelook-migration-" + Guid.NewGuid().ToString("N"));
        string legacy = Path.Combine(temp, "OldProfile"), fresh = Path.Combine(temp, "NewProfile");
        Directory.CreateDirectory(Path.Combine(legacy, "WebView2")); File.WriteAllText(Path.Combine(legacy, "WebView2", "state.txt"), "kept"); File.WriteAllText(Path.Combine(legacy, "dock.json"), "{}");
        ProfileMigration.Apply(legacy, fresh);
        if (!File.Exists(Path.Combine(fresh, "WebView2", "state.txt")) || Directory.Exists(legacy)) { Console.WriteLine("FAIL move: profile not moved whole"); failures++; }
        // A locked file inside the legacy folder: the move fails and the two things worth keeping are copied instead.
        string legacy2 = Path.Combine(temp, "OldProfile2"), fresh2 = Path.Combine(temp, "NewProfile2");
        Directory.CreateDirectory(Path.Combine(legacy2, "WebView2")); Directory.CreateDirectory(Path.Combine(legacy2, "versions")); File.WriteAllText(Path.Combine(legacy2, "WebView2", "state.txt"), "kept"); File.WriteAllText(Path.Combine(legacy2, "dock.json"), "{}");
        using (var hold = new FileStream(Path.Combine(legacy2, "versions", "lock.bin"), FileMode.Create, FileAccess.Write, FileShare.None)) ProfileMigration.Apply(legacy2, fresh2);
        if (!File.Exists(Path.Combine(fresh2, "WebView2", "state.txt")) || !File.Exists(Path.Combine(fresh2, "dock.json")) || !Directory.Exists(legacy2)) { Console.WriteLine("FAIL copy fallback"); failures++; }
        Directory.Delete(temp, true);
```

Change the PASS line's count to `19` (14 mark, 5 migration), and add `desktop/ProfileMigration.cs` to the `& $csc` arguments.

Run `npm run verify:mark`. Expected: compile error, `ProfileMigration` does not exist.

- [ ] **Step 2: Write `desktop/ProfileMigration.cs`**

```cs
using System;
using System.IO;

// 0.16.0 renamed the product, and with it the profile folder under %LOCALAPPDATA%. Saved prototypes live in the WebView2 profile
// inside it, and the dock's position beside it, so the first start moves the whole folder once. Decide is pure and tested by
// scripts/verify-mark.ps1; Apply falls back to copying the two things worth keeping when a file in the old folder is locked.
internal static class ProfileMigration {
    public enum Plan { None, Move }

    public static Plan Decide(bool newExists, bool legacyExists) {
        return !newExists && legacyExists ? Plan.Move : Plan.None;
    }

    public static void Apply(string legacyRoot, string newRoot) {
        if (Decide(Directory.Exists(newRoot), Directory.Exists(legacyRoot)) != Plan.Move) return;
        try { Directory.Move(legacyRoot, newRoot); return; }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        try {
            Directory.CreateDirectory(newRoot);
            string profile = Path.Combine(legacyRoot, "WebView2");
            if (Directory.Exists(profile)) CopyTree(profile, Path.Combine(newRoot, "WebView2"));
            string dock = Path.Combine(legacyRoot, "dock.json");
            if (File.Exists(dock)) File.Copy(dock, Path.Combine(newRoot, "dock.json"), true);
        } catch (IOException) { /* The app still starts with a fresh profile; nothing in the old folder is deleted. */ }
        catch (UnauthorizedAccessException) { }
    }

    static void CopyTree(string from, string to) {
        Directory.CreateDirectory(to);
        foreach (string file in Directory.GetFiles(from)) File.Copy(file, Path.Combine(to, Path.GetFileName(file)), true);
        foreach (string dir in Directory.GetDirectories(from)) CopyTree(dir, Path.Combine(to, Path.GetFileName(dir)));
    }
}
```

Run `npm run verify:mark`. Expected: `PASS: 7 source checks, 19 compiled assertions, ...`.

- [ ] **Step 3: Rename in `desktop/Launcher.cs`**

Line 18 becomes two lines:

```cs
    static string LocalAppData = Environment.GetEnvironmentVariable("LOCALAPPDATA") ?? Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    static string Root = Path.GetFullPath(Path.Combine(LocalAppData, "Sidelook"));
```

In `Main`, immediately after the mutex is confirmed created (after the `if (!created) { ... }` block ends and before `Extract()`/the loading form), add:

```cs
        ProfileMigration.Apply(Path.Combine(LocalAppData, "Jarvis"), Root); // legacy profile folder from 0.15 and earlier
```

Keep the kernel object names so an older copy still running is caught by the "already running" path; mark them:

```cs
        Instance = new Mutex(true, "Local\\JarvisDesktopLauncher", out created); // legacy name: an older running copy holds the same mutex
```
and the same `// legacy name` comment on the `Local\\JarvisDesktopOpen` line. Then every other `Jarvis` in the file becomes `Sidelook` (messages, tray text and menu items, `Jarvis.exe` -> `Sidelook.exe`, the Start menu folder and `.lnk` names, `"Open Jarvis"` -> `"Open Sidelook"`). The "already running" message becomes: `"Sidelook is already running. Choose Quit from its tray menu, then reopen this download to install the new version."`

- [ ] **Step 4: Rename in the other C# files and scripts**

```bash
sed -i 's/Jarvis/Sidelook/g' desktop/DesktopShell.cs desktop/CaptureService.cs desktop/FollowService.cs scripts/start.ps1 scripts/build-windows.ps1 scripts/verify-windows.mjs scripts/verify-desktop-host.ps1 scripts/verify-windows-lifecycle.ps1
sed -i 's/\$jarvis/$sidelook/g; s/jarvisVersion/sidelookVersion/g' scripts/build-windows.ps1 scripts/verify-desktop-host.ps1 scripts/verify-windows-lifecycle.ps1
git mv "Start Jarvis.cmd" "Start Sidelook.cmd"
```

Then in `scripts/verify-desktop-host.ps1` restore the two kernel names the sed just broke and mark them: `'Local\JarvisDesktopOpen'` with `# legacy name` at the end of that line. Read `git diff desktop/ scripts/` once, whole, and fix any sentence the sed made ungrammatical.

- [ ] **Step 5: Version and package name.** In `package.json` set `"name": "sidelook"` and `"version": "0.16.0"`.

- [ ] **Step 6: Build and run the lifecycle check**

```bash
npm run build:windows && npm run verify:windows
```
Expected: `PASS: packaged Sidelook 0.16.0 ...` and the exe at `.artifacts/windows-0.16.0/Sidelook-0.16.0-Windows-x64.exe`; `verify:windows` PASS. Then `powershell -NoProfile -File scripts/verify-windows-lifecycle.ps1` (needs port 4317 free; it launches the exe hidden). Expected: its PASS lines.

- [ ] **Step 7: Commit**

```bash
git add desktop/ scripts/ "Start Sidelook.cmd" package.json
git commit -m "Claude: [FEAT] Sidelook in the shell, the launcher and the build; the 0.15 profile moves once"
```

---

### Task 7: Rename in the server, the page and the tests

**Files:**
- Modify: `server.mjs`, `lib/*.mjs`, `public/*.js`, `public/index.html`, `tests/*.mjs`

- [ ] **Step 1: Scoped sed, then read the diff**

```bash
sed -i 's/X-Jarvis-/X-Sidelook-/g; s/x-jarvis-/x-sidelook-/g; s/jarvisDesktop/sidelookDesktop/g; s/jarvis-workbench/sidelook/g; s/Jarvis/Sidelook/g' server.mjs lib/*.mjs public/*.js public/index.html tests/*.mjs
git diff --stat
```
Read the whole diff. Sentences to fix by hand: `'Ask Sidelook…'` stays; `Sidelook in ${windowTitle()}` (computer.js:37) stays; anything that became `a Sidelook` where `an` was right is corrected; the `X-Sidelook-Launch` header must match between `server.mjs`, `public/app.js` and `tests/desktop.test.mjs`.

- [ ] **Step 2: Tests**

```bash
npm test
```
Expected: all PASS (`desktop.test.mjs` now expects `app:'sidelook'` because the sed changed both sides).

- [ ] **Step 3: Browser checks**

```bash
npm run lint && npm run verify:assistant && npm run verify:companion && npm run verify:stream && npm run verify:computer && npm run verify:recovery
```
Expected: every one PASS.

- [ ] **Step 4: Commit**

```bash
git add server.mjs lib public tests
git commit -m "Claude: [FEAT] Sidelook in the server, the page and the tests"
```

---

### Task 8: The name gate, and the verifiers learn the new name

**Files:**
- Modify: `scripts/check.mjs` (append before the final `console.log`)
- Modify: `scripts/verify-site.mjs:50-53`
- Modify: `scripts/verify-states.mjs` (append a geometry agreement check)

- [ ] **Step 1: Name gate in lint**

```js
// The product is Sidelook. The old name may survive only on lines marked `legacy` (kernel object names that keep the upgrade path,
// the old profile folder) and in history files, which are not scanned. Anything else is a miss the retro should record.
const gateFiles = [...new Set([
  ...shipped, ...files, 'package.json', 'README.md', 'PRODUCT.md', 'DESIGN.md', 'CONTRIBUTING.md', 'SECURITY.md',
  'docs/COMPUTER.md', 'docs/MODELS.md', 'docs/WINDOWS.md', 'Start Sidelook.cmd',
  ...(await readdir('public')).filter(f => /\.(html|css)$/.test(f)).map(f => `public/${f}`),
  ...(await readdir('site')).filter(f => /\.(html|css|js|json)$/.test(f)).map(f => `site/${f}`),
  ...(await readdir('scripts')).filter(f => /\.(mjs|ps1|cmd)$/.test(f)).map(f => `scripts/${f}`),
  ...(await readdir('tests')).map(f => `tests/${f}`),
])];
let legacyLines = 0; const nameHits = [];
for (const file of gateFiles) {
  const lines = (await readFile(file,'utf8')).split('\n');
  lines.forEach((line,i) => { if (!/jarvis/i.test(line)) return; if (/legacy/.test(line)) { legacyLines++; return; } nameHits.push(`${file}:${i+1}`); });
}
if (nameHits.length) throw new Error(`Old product name in ${nameHits.length} place(s): ${nameHits.slice(0,12).join(', ')}`);
if (legacyLines > 5) throw new Error(`${legacyLines} legacy-marked lines; the allowance is 5.`);
```

Extend the final PASS line with `; name gate: ${gateFiles.length} files, ${legacyLines} legacy lines`.

- [ ] **Step 2: Run lint, fix what it finds, then prove it**

Run: `npm run lint`. Every hit it lists is renamed (these are the places the seds did not reach: `docs/COMPUTER.md`, `docs/MODELS.md`, `docs/WINDOWS.md`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `SECURITY.md`, `site/index.html` are done properly in Tasks 9 and 11, so for now expect hits there and continue; the gate must be green by the end of Task 11). Then add the line `// Jarvis` to `public/live.js`, run lint, expect `Old product name in 1 place(s): public/live.js:N`, remove it, run again.

- [ ] **Step 3: The site verifier rejects the old name**

Replace lines 50-53 of `scripts/verify-site.mjs` with:

```js
  assert.equal(href,`https://github.com/ucsandman/sidelook/releases/download/v${version}/Sidelook-${version}-Windows-x64.exe`);
  // Every version string on the page is the current one, and the old product name is gone; 0.15.0 shipped with "Open Jarvis-0.14.0-Windows-x64.exe" in the install steps.
  const bodyText=await page.locator('body').innerText();
  const stale=[...new Set(bodyText.match(/Sidelook[ -]0\.\d+\.\d+/g) || [])].filter(v=>!v.endsWith(version));
  assert.deepEqual(stale,[],`stale version strings on the page: ${stale.join(', ')}`);
  assert.doesNotMatch(bodyText,/jarvis/i,'the old product name is on the page');
  assert.doesNotMatch(await page.content(),/jarvis/i,'the old product name is in the page source');
```

Update the walkthrough text assertion on line 29 (`'Keep your design tool open beside Jarvis.'`) to `Sidelook`; Task 9 changes the page to match.

- [ ] **Step 4: Geometry agreement in `verify:states`**

Append before its final PASS line:

```js
// The mark's geometry lives in mark.svg, SidelookMark.cs and build-icon.ps1; verify-mark.ps1 compiles the C#, this checks the text agrees on Linux too.
const hex='32,10 51,21 51,43 32,54 13,43 13,21';
for(const [file,pattern] of [['public/mark.svg',hex],['public/mark.svg','cx="31" cy="32"'],['public/mark.svg','cx="43" cy="32"'],['scripts/build-icon.ps1',hex],['public/index.html',hex],['desktop/SidelookMark.cs','new PointF(32, 10), new PointF(51, 21), new PointF(51, 43), new PointF(32, 54), new PointF(13, 43), new PointF(13, 21)']]){
  assert.ok((await readFile(file,'utf8')).includes(pattern),`${file} lost the mark geometry: ${pattern}`);
}
```
(`readFile` and `assert` are already imported there.) Extend its PASS line with `; mark geometry agrees in 4 files`.

- [ ] **Step 5: Run and commit**

```bash
npm run verify:states
git add scripts/check.mjs scripts/verify-site.mjs scripts/verify-states.mjs
git commit -m "Claude: [TEST] name gate in lint; site and state verifiers know the Sidelook name and geometry"
```

---

### Task 9: The site, the wordmark, the family ties, the About block, the OG card

**Files:**
- Create: `site/plus-jakarta-sans-700.woff2`
- Modify: `site/site.css`, `site/index.html`, `site/vercel.json`
- Modify: `scripts/build-site.mjs` (origin, allowlist, copy list, llms.txt name), `scripts/build-social.mjs`
- Modify: `public/index.html:168-211` (settings dialog, About block), `public/style.css`

- [ ] **Step 1: Fetch the font (OFL) once and commit it**

```bash
url=$(curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36" "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700&display=swap" | awk '/\/\* latin \*\//{f=1} f&&/url\(/{match($0,/https:[^)]+\.woff2/);print substr($0,RSTART,RLENGTH);exit}')
curl -sL "$url" -o site/plus-jakarta-sans-700.woff2 && ls -la site/plus-jakarta-sans-700.woff2
```
Expected: a file between 15 and 40 KB. If the awk finds nothing, open the CSS in a browser tab and copy the latin block's URL by hand.

- [ ] **Step 2: `site/site.css`**

Add after the `:root` line:

```css
@font-face{font-family:'Plus Jakarta Sans';src:url(/plus-jakarta-sans-700.woff2) format('woff2');font-weight:700;font-style:normal;font-display:swap}
```
Replace the `.wordmark` rules:

```css
.wordmark{display:flex;gap:10px;align-items:center;font:700 22px/1 'Plus Jakarta Sans','Segoe UI',sans-serif;letter-spacing:-.02em;text-decoration:none}
.wordmark img{border-radius:7px}
.family{font:13px 'Segoe UI',sans-serif;color:var(--muted);margin-left:14px}
```

- [ ] **Step 3: `site/index.html`**

- `<title>sidelook | A desktop companion for Windows on your ChatGPT or Claude subscription</title>`
- Canonical and `og:url` to `https://sidelook.practicalsystems.io/`; `og:title` `sidelook | A desktop companion for Windows`; description: replace `Jarvis` with `Sidelook`.
- Masthead: `<a class="wordmark" href="/" aria-label="sidelook home"><img src="/mark.svg" width="32" height="32" alt="">sidelook</a><span class="family">a <a href="https://practicalsystems.io">Practical Systems</a> product</span>` and add `<a href="https://practicalsystems.io">Practical Systems</a>` as the last nav link.
- Footer: `<footer><span>sidelook is a Practical Systems product, made by Wes.</span><a href="https://practicalsystems.io">Practical Systems</a><a href="https://github.com/ucsandman/sidelook">Source and documentation</a><a href="https://github.com/ucsandman/sidelook/blob/main/LICENSE">MIT license</a></footer>`
- Every other `Jarvis` -> `Sidelook`; every `jarvis-workbench.vercel.app` -> `sidelook.practicalsystems.io`; every `ucsandman/jarvis` -> `ucsandman/sidelook`; download link and `<strong>` filename to `Sidelook-0.16.0-Windows-x64.exe` and `v0.16.0`; the caption `Sidelook 0.16.0 · Windows 10/11 ...`.
- In the privacy section add one `<details>` at the end: `<summary>Who makes this?</summary><p>Sidelook is a Practical Systems product, written by Wes. Karpathy's line fits it: "We're not building animals. We're building ghosts or spirits." Sidelook is summoned, looks at what you show it, and goes.</p>`

- [ ] **Step 4: `site/vercel.json`**

Add `font-src 'self';` to the CSP value (after `img-src 'self' data:;`) and a top-level:

```json
  "redirects": [
    { "source": "/(.*)", "has": [{ "type": "host", "value": "jarvis-workbench.vercel.app" }], "destination": "https://sidelook.practicalsystems.io/$1", "permanent": true }
  ],
```

- [ ] **Step 5: `scripts/build-site.mjs`**

`origin` to `https://sidelook.practicalsystems.io`; add `'plus-jakarta-sans-700.woff2'` to `allowed` and to the `copyFile` list from `site/`; in the llms.txt template replace `# Jarvis` with `# sidelook`, every `Jarvis` with `Sidelook`, the GitHub URL with `ucsandman/sidelook`, and add a line `- [Practical Systems](https://practicalsystems.io): the company behind Sidelook.`

- [ ] **Step 6: About block in the app**

At the end of the settings dialog (after the Advanced `<details>` closes, before the dialog's closing actions), add:

```html
    <section class="about" aria-label="About Sidelook"><img src="/mark.svg" width="40" height="40" alt=""><div><b class="about-name">sidelook</b><p>a <a href="https://practicalsystems.io" target="_blank" rel="noopener">Practical Systems</a> product, made by Wes.</p><p class="about-quote">“We're not building animals. We're building ghosts or spirits.” Andrej Karpathy, on the Dwarkesh Patel podcast, October 2025.</p><p>Sidelook is summoned, looks at what you show it, and goes.</p></div></section>
```

`public/style.css`, components layer:

```css
  .about { display:flex; gap:14px; align-items:flex-start; border-top:1px solid var(--line); margin-top:18px; padding-top:16px; }
  .about img { border-radius:9px; flex:0 0 auto; }
  .about p { margin:4px 0 0; color:var(--muted); font-size:13px; }
  .about-name { font:600 20px/1 'Segoe UI', sans-serif; letter-spacing:-.02em; }
  .about-quote { font:italic 14px/1.5 Georgia, serif; color:var(--ink); }
```

- [ ] **Step 7: OG card.** In `scripts/build-social.mjs` the `<title>` becomes `Sidelook desktop companion`, the visible name `sidelook` in `font:700 ... 'Segoe UI'` (the OG renders on this machine; Segoe is present), and a line `a Practical Systems product`. Run `node scripts/build-social.mjs` and look at `docs/images/social.png` once.

- [ ] **Step 8: Build and verify the site**

```bash
npm run build:site && npm run lint
node -e "import('node:http').then(h=>{const s=h.createServer((q,r)=>{import('node:fs').then(f=>{const p='.artifacts/site'+(q.url==='/'?'/index.html':q.url.split('?')[0]);f.readFile(p,(e,d)=>{if(e){r.statusCode=404;r.end();return;}r.setHeader('content-type',p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':p.endsWith('.svg')?'image/svg+xml':p.endsWith('.woff2')?'font/woff2':p.endsWith('.png')?'image/png':'text/html');r.end(d);});});});s.listen(4399,()=>console.log('site on 4399'));})" &
node scripts/verify-site.mjs http://127.0.0.1:4399
```
Expected: verify-site PASS with the old name absent. Stop the temporary server. (`docs/SITE.md` records the real command sequence for Vercel; local serving is only for this check.)

- [ ] **Step 9: Commit**

```bash
git add site scripts/build-site.mjs scripts/build-social.mjs public/index.html public/style.css docs/images/social.png
git commit -m "Claude: [FEAT] sidelook on the site: wordmark, family ties, new origin and redirect, About block, OG card"
```

---

### Task 10: Summon and dismiss fade

**Files:**
- Modify: `desktop/DesktopShell.cs` (`SummonPanel`, the `resize` message branch, a fade timer)

- [ ] **Step 1: Fade helper**

Fields:
```cs
    readonly Timer fadeTimer = new Timer { Interval = 15 };
    DateTime fadeStart; double fadeFrom, fadeTo, fadeMs; Action fadeDone;
```
Constructor: `fadeTimer.Tick += delegate { StepFade(); };`

Methods:
```cs
    // Summon fades in over 150 ms, dismiss out over 120 ms, opacity only, ease-out. Under Windows' animation switch both are instant.
    void Fade(double from, double to, double ms, Action done) {
        if (!animations) { Opacity = to; if (done != null) done(); return; }
        fadeFrom = from; fadeTo = to; fadeMs = ms; fadeDone = done; fadeStart = DateTime.UtcNow;
        Opacity = from;
        fadeTimer.Start();
    }

    void StepFade() {
        double t = Math.Min(1, (DateTime.UtcNow - fadeStart).TotalMilliseconds / fadeMs);
        double eased = 1 - Math.Pow(1 - t, 3);
        Opacity = fadeFrom + (fadeTo - fadeFrom) * eased;
        if (t < 1) return;
        fadeTimer.Stop();
        Action done = fadeDone; fadeDone = null;
        if (done != null) done();
    }
```

- [ ] **Step 2: Wire it**

`SummonPanel`: before `SetMode("panel");` add `if (animations) Opacity = 0;` and after `Activate();` add `Fade(Opacity, 1, 150, null);`.

In `OnWebMessageReceived`, the `resize` branch: where `requested == "dock"` would call `SetMode("dock")`, call instead:

```cs
                if (requested == "dock" && mode != "dock") Fade(1, 0, 120, delegate { SetMode("dock"); Opacity = 1; });
                else SetMode(requested);
```

The capture path that sets `Opacity = 0` and restores `1` (around line 384) is untouched; a fade cannot be running there because capture starts from a settled panel.

- [ ] **Step 3: Build, check, commit**

```bash
npm run build:windows
```
Then, if the desktop is free, open the exe, press Ctrl+Shift+Space, watch the panel fade in, press the dock button in its header, watch it fade out; turn off "Animation effects" in Windows Settings and repeat: instant both ways. Record what was checked.

```bash
git add desktop/DesktopShell.cs
git commit -m "Claude: [FEAT] summon fades in, dismiss fades out; instant under Windows' animation switch"
```

---

### Task 11: Documentation

**Files:**
- Modify: `README.md`, `PRODUCT.md`, `DESIGN.md`, `CHANGELOG.md`, `SECURITY.md`, `docs/COMPUTER.md`, `docs/MODELS.md`, `docs/WINDOWS.md`, `docs/SITE.md` (runbook lines only, not the release log), `plans/2026-09-06-sidelook-identity-design.md` (one line)

- [ ] **Step 1: README**

- Header block: `<img src="public/mark.svg" width="72" height="72" alt="Sidelook">`, `<h1>sidelook</h1>`, the strong line unchanged in meaning with the new name, then a new line under it: `<p>a <a href="https://practicalsystems.io">Practical Systems</a> product</p>`. Website link to `https://sidelook.practicalsystems.io/`, download to `v0.16.0/Sidelook-0.16.0-Windows-x64.exe`, badges and links to `ucsandman/sidelook`.
- Every `Jarvis` -> `Sidelook`; `Start Jarvis.cmd` -> `Start Sidelook.cmd`; `desktop/jarvis.ico` -> `desktop/sidelook.ico`; `desktop/JarvisMark.cs` -> `desktop/SidelookMark.cs`.
- Add to the verification list `npm run verify:mark` with the note `(Windows; compiles the mark and the profile migration)`.
- Add one paragraph after "What it does": **Why a ghost.** Sidelook is one node of the Practical Systems mark. Karpathy called these models ghosts, not animals: trained by imitating human documents, they see nothing until shown something. Sidelook is summoned, looks at what you show it, and goes. Its eyes follow your mouse; nothing else does.

- [ ] **Step 2: PRODUCT.md and DESIGN.md**

PRODUCT.md: name; under Brand Personality add `Sidelook is a Practical Systems product and shares the family's navy, teal and hexagon node.`; under Anti-references replace the letter-in-a-circle line with `- A cartoon ghost. The node has eyes and nothing else: no mouth, no arms, no sheet, no name tag. It never "haunts" or "watches"; it is summoned.`

DESIGN.md: rewrite the first paragraph and the Colors table with the Global Constraints values; replace the Mark section with the geometry in this plan's constraints plus: `The eyes follow the cursor in the dock and the page header (public/eyes.js, SidelookMark.EyeOffset); static renders look right. Sources of truth: public/mark.svg, desktop/SidelookMark.cs, scripts/build-icon.ps1; npm run verify:mark and verify:states check they agree.` Typography: replace the Bahnschrift line with `Plus Jakarta Sans 700 for the lowercase wordmark on the site (self-hosted), Segoe UI Semibold for it in the app.` Motion: add `Summon fades in over 150 ms, dismiss out over 120 ms.`

- [ ] **Step 3: CHANGELOG** (top of file):

```markdown
## 0.16.0: Sidelook

- Jarvis is now Sidelook, a Practical Systems product. Same app, same shortcuts, same port, same twelve versions. The exe is `Sidelook-0.16.0-Windows-x64.exe`; the site is https://sidelook.practicalsystems.io and the old address redirects.
- The mark is one node of the Practical Systems mark: a white hexagon with two navy eyes. In the dock and in the panel header the eyes follow your mouse anywhere on the screen. Under Windows' animation switch they hold the sidelong look and nothing moves.
- Graphite and mint became the family navy and teal. Every control was re-measured at rest and under the mouse.
- Saved prototypes survive: the first start moves the old Jarvis profile folder to Sidelook once, or copies the profile and the dock position if a file is locked.
- Summon fades the panel in, dismiss fades it out.
- `npm run lint` refuses the old name outside history and marked legacy lines; `npm run verify:mark` compiles the mark and the profile move and checks the SVG, the C# and the icon build agree.
```

- [ ] **Step 4: docs and spec line.** `sed -i 's/Jarvis/Sidelook/g' docs/COMPUTER.md docs/MODELS.md docs/WINDOWS.md SECURITY.md` then read the diff. In `docs/SITE.md` change the Production line and the two command lines that name the host to `sidelook.practicalsystems.io`, and add a step before deploy: `Add the domain to the Vercel project and the CNAME at the parent's DNS (hard stop: confirm with the maintainer). Only then deploy, because vercel.json redirects the old host to the new one.` Leave its release log lines as they are. In the design spec's Name gate paragraph, replace `docs/SITE.md` with `docs/SITE.md's runbook lines (its release log is history)`.

- [ ] **Step 5: Lint must be green now**

```bash
npm run lint && npm test
```
Expected: `name gate: N files, 4 legacy lines` (two in Launcher.cs, one in verify-desktop-host.ps1, one migration call). Any hit left is fixed here.

- [ ] **Step 6: Commit**

```bash
git add README.md PRODUCT.md DESIGN.md CHANGELOG.md SECURITY.md docs plans/2026-09-06-sidelook-identity-design.md
git commit -m "Claude: [DOCS] 0.16.0: Sidelook in the README, product and design docs, changelog and runbooks"
```

---

### Task 12: Full verification and the hand-check list

**Files:** none new; `PLAYBOOK.md` gets its entry at ship, not here.

- [ ] **Step 1: The whole synthetic suite, read every PASS line**

```bash
npm test && npm run lint && npm run build && npm run verify:assistant && npm run verify:companion && npm run verify:states && npm run verify:computer && npm run verify:recovery && npm run verify:stream && npm run verify:mark && npm run build:site && npm run build:windows && npm run verify:windows
```
Expected: every command prints PASS with its counts; `verify:states` reports the mark geometry line; lint reports the name gate counts.

- [ ] **Step 2: Grep for what the gate does not scan**

```bash
grep -rn "Jarvis" --include=*.md --include=*.json --include=*.yml --include=*.html . --exclude-dir=.artifacts --exclude-dir=node_modules --exclude-dir=.git | grep -vE "^./(CHANGELOG|PLAYBOOK)\.md|^./docs/(ERRORS|DECISIONS|SITE)\.md|^./plans/|legacy" 
```
Expected: no lines. Anything printed is a miss; fix it and note it for the retro.

- [ ] **Step 3: Desktop hand checks, only when the maintainer says the desktop is free**

1. Fresh profile (`%LOCALAPPDATA%\Sidelook` absent, `Jarvis` absent): open the exe; the dock shows the node; move the mouse across both monitors and the eyes follow; Task Manager, one minute of movement, under 0.5% CPU.
2. Copy a 0.15.1 profile with three saved versions to `%LOCALAPPDATA%\Jarvis`, remove `Sidelook`, open 0.16.0: the versions list shows all three, the dock sits where it was, `Jarvis` is gone.
3. Windows Settings, Accessibility, Animation effects off: eyes fixed right, summon and dismiss instant. Turn it back on.
4. Ctrl+Shift+Space fades in; the header's dock button fades out; Ctrl+Shift+E still stops at Send.
5. Retake `docs/images/companion.png`, `streaming.png`, `screen-on.png`, `computer.png` from the real app at the sizes the README captions state, then `node scripts/build-social.mjs`.
6. `powershell -NoProfile -File scripts/verify-desktop-host.ps1` and `scripts/verify-desktop-content.mjs`.

Record each as done or owed in the task report; owed items go into the release memory the way 0.15.1's were.

- [ ] **Step 4: Commit the retaken images when they exist**

```bash
git add docs/images
git commit -m "Claude: [DOCS] 0.16.0 screenshots from the hand check"
```

Ship is a separate step (`/ship`): GitHub repo rename, the Vercel domain and DNS record, Search Console and Bing, the parent Products page entry, the PLAYBOOK retro line.
