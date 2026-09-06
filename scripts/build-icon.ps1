# Renders desktop/jarvis.ico from the mark geometry shared with public/mark.svg and desktop/JarvisMark.cs.
# Run once after changing the mark: powershell -NoProfile -File scripts/build-icon.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path -Parent $PSScriptRoot
$output = Join-Path $root 'desktop/jarvis.ico'
$sizes = @(16, 20, 24, 32, 40, 48, 64, 128, 256)
$charcoal = [System.Drawing.Color]::FromArgb(20, 23, 25)
$amber = [System.Drawing.Color]::FromArgb(111, 227, 193)

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
    $g.FillPath((New-Object System.Drawing.SolidBrush $charcoal), $path)
    $ring = 18 * $unit; $stroke = [Math]::Max(2.0, 6 * $unit); $pupil = 6.5 * $unit
    $pen = New-Object System.Drawing.Pen $amber, ([single]$stroke)
    $g.DrawEllipse($pen, [single](32 * $unit - $ring), [single](32 * $unit - $ring), [single]($ring * 2), [single]($ring * 2))
    $g.FillEllipse((New-Object System.Drawing.SolidBrush $amber), [single](36 * $unit - $pupil), [single](28 * $unit - $pupil), [single]($pupil * 2), [single]($pupil * 2))
    $g.Dispose()
    return $bitmap
}

# Sizes under 256 are stored as classic 32-bit DIBs so every icon reader (shell, .NET, installers) decodes them; 256 is PNG per the Vista+ convention.
function Dib([System.Drawing.Bitmap]$bitmap) {
    $w = $bitmap.Width; $h = $bitmap.Height
    $data = $bitmap.LockBits((New-Object System.Drawing.Rectangle 0, 0, $w, $h), [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $pixels = New-Object byte[] ($data.Stride * $h)
    [System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $pixels, 0, $pixels.Length)
    $bitmap.UnlockBits($data)
    $maskStride = [int]([Math]::Ceiling($w / 32.0) * 4)
    $stream = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter $stream
    $bw.Write([uint32]40); $bw.Write([int32]$w); $bw.Write([int32]($h * 2)); $bw.Write([uint16]1); $bw.Write([uint16]32)
    $bw.Write([uint32]0); $bw.Write([uint32]($w * $h * 4 + $maskStride * $h)); $bw.Write([int32]0); $bw.Write([int32]0); $bw.Write([uint32]0); $bw.Write([uint32]0)
    for ($y = $h - 1; $y -ge 0; $y--) { $bw.Write($pixels, $y * $data.Stride, $w * 4) }
    $bw.Write((New-Object byte[] ($maskStride * $h)))
    $bw.Flush()
    Write-Output -NoEnumerate ([byte[]]$stream.ToArray())
}

function Png([System.Drawing.Bitmap]$bitmap) {
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Output -NoEnumerate ([byte[]]$stream.ToArray())
}

$images = New-Object System.Collections.Generic.List[byte[]]
foreach ($size in $sizes) {
    $bitmap = Render $size
    if ($size -ge 256) { $images.Add([byte[]](Png $bitmap)) } else { $images.Add([byte[]](Dib $bitmap)) }
    $bitmap.Dispose()
}
$file = [System.IO.File]::Create($output)
$writer = New-Object System.IO.BinaryWriter $file
# ICONDIR: reserved, type 1, count. Then one 16-byte ICONDIRENTRY per image, then the image payloads.
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]; $bytes = $images[$i]
    $dimension = if ($size -ge 256) { 0 } else { $size }
    $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
    $writer.Write([byte]0); $writer.Write([byte]0)
    $writer.Write([uint16]1); $writer.Write([uint16]32)
    $writer.Write([uint32]$bytes.Length); $writer.Write([uint32]$offset)
    $offset += $bytes.Length
}
foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
$writer.Dispose(); $file.Dispose()
Write-Output "PASS: wrote $output with $($sizes.Count) sizes ($($sizes -join ', ')), $((Get-Item -LiteralPath $output).Length) bytes."
