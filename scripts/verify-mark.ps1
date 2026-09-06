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
            if (bmp.GetPixel(6, 6).ToArgb() != SidelookMark.Navy.ToArgb()) { Console.WriteLine("FAIL corner not navy"); failures++; }
        }
        using (var wideBmp = new Bitmap(64, 64)) using (var wg = Graphics.FromImage(wideBmp)) {
            // Right eye centred at x=43: radius 3.6 narrow, 4.0 wide (EyeRadius + EyeWide). Rendered both and read (40,32):
            // narrow leaves a thin partial-coverage sliver there (not exactly Navy), wide fully covers it with solid Navy.
            // A regression that stops EyeWide from widening the eye collapses this pixel back to the narrow (non-Navy) value.
            SidelookMark.Draw(wg, new Rectangle(0, 0, 64, 64), new PointF(5, 0), true, true);
            if (wideBmp.GetPixel(40, 32).ToArgb() != SidelookMark.Navy.ToArgb()) { Console.WriteLine("FAIL wide eye pixel not navy"); failures++; }
        }
        Console.WriteLine(failures == 0 ? "PASS: 15 mark assertions" : failures + " mark assertion(s) failed");
        return failures == 0 ? 0 : 1;
    }
}
'@ | Set-Content -LiteralPath $test -Encoding UTF8
$csc = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$exe = Join-Path (Resolve-Path .artifacts) 'mark-test.exe'
& $csc /nologo /target:exe /out:$exe /reference:System.Drawing.dll /reference:System.Windows.Forms.dll desktop\SidelookMark.cs $test
if ($LASTEXITCODE -ne 0) { throw 'mark test did not compile.' }
& $exe; if ($LASTEXITCODE -ne 0) { throw 'mark test failed.' }
$ico = Get-Item desktop/sidelook.ico -ErrorAction Stop
if ($ico.Length -lt 20000) { throw "sidelook.ico is only $($ico.Length) bytes; run scripts/build-icon.ps1." }; $checks++
Write-Output "PASS: $checks source checks, 15 compiled assertions, sidelook.ico $($ico.Length) bytes."
