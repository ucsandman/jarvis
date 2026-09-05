$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$jarvisVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$jarvisExe = (Resolve-Path ".artifacts/windows-$jarvisVersion/Jarvis-$jarvisVersion-Windows-x64.exe").Path
if (Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 4317 must be free before this desktop host check.' }

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class JarvisWindowProbe {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  public delegate bool EnumWindowsCallback(IntPtr window, IntPtr value);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr value);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out int processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, System.Text.StringBuilder text, int capacity);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr window, int id);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  public static IntPtr Find(int expectedProcessId) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr window, IntPtr value) {
      int processId; GetWindowThreadProcessId(window, out processId);
      var title = new System.Text.StringBuilder(64); GetWindowText(window, title, title.Capacity);
      if (processId == expectedProcessId && title.ToString() == "Jarvis") { found = window; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@

function Wait-JarvisCondition($check, $message) {
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    while (-not (& $check)) { if ([DateTime]::UtcNow -gt $deadline) { throw $message }; Start-Sleep -Milliseconds 200 }
}
function Get-JarvisBounds($process) {
    $process.Refresh()
    $window = [JarvisWindowProbe]::Find($process.Id)
    if ($window -eq [IntPtr]::Zero) { return $null }
    $rect = New-Object JarvisWindowProbe+Rect
    if (-not [JarvisWindowProbe]::GetWindowRect($window,[ref]$rect)) { return $null }
    return @{ Width = $rect.Right - $rect.Left; Height = $rect.Bottom - $rect.Top }
}

$jarvisProbe = Start-Process -FilePath $jarvisExe -PassThru
try {
    Wait-JarvisCondition { $jarvisProbe.Refresh(); $jarvisProbe.MainWindowTitle -eq 'Jarvis' } 'Embedded Jarvis window did not render.'
    Wait-JarvisCondition { $bounds = Get-JarvisBounds $jarvisProbe; $bounds -and $bounds.Width -ge 440 -and $bounds.Height -ge 700 } 'Jarvis did not open the companion panel on first launch.'
    [JarvisWindowProbe]::PostMessage([JarvisWindowProbe]::Find($jarvisProbe.Id),0x0010,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
    Wait-JarvisCondition { $bounds = Get-JarvisBounds $jarvisProbe; $bounds -and $bounds.Width -eq 76 -and $bounds.Height -eq 76 } 'Closing the companion did not return Jarvis to its dock.'
    $secondHotkey = [JarvisWindowProbe]::RegisterHotKey([IntPtr]::Zero,0x4A42,0x0002 -bor 0x0004,0x20)
    if ($secondHotkey) { [JarvisWindowProbe]::UnregisterHotKey([IntPtr]::Zero,0x4A42) | Out-Null; throw 'Ctrl+Shift+Space was not registered by Jarvis.' }
    $open = [Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopOpen')
    $open.Set() | Out-Null
    $open.Dispose()
    Wait-JarvisCondition { $bounds = Get-JarvisBounds $jarvisProbe; $bounds -and $bounds.Width -ge 440 -and $bounds.Height -ge 700 } 'Open signal did not summon the companion panel.'
    Write-Output 'PASS: embedded WebView2 host rendered the first-launch companion panel, collapsed to a 76x76 dock, registered Ctrl+Shift+Space, and reopened from its named signal.'
} finally {
    try { $quit = [Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopQuit'); $quit.Set() | Out-Null; $quit.Dispose() } catch { }
    if (-not $jarvisProbe.WaitForExit(15000)) { Stop-Process -Id $jarvisProbe.Id }
}
