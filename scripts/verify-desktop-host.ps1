$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$sidelookVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$sidelookExe = (Resolve-Path ".artifacts/windows-$sidelookVersion/Sidelook-$sidelookVersion-Windows-x64.exe").Path
if (Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 4317 must be free before this desktop host check.' }

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SidelookWindowProbe {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  public delegate bool EnumWindowsCallback(IntPtr window, IntPtr value);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr value);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out int processId);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window, System.Text.StringBuilder text, int capacity);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr window, int id);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, IntPtr extra);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtrW")] public static extern IntPtr GetWindowLongPtr(IntPtr window, int index);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr window, out Rect rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr window, ref ClientPoint point);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [StructLayout(LayoutKind.Sequential)] public struct ClientPoint { public int X, Y; }
  public static void ClickAt(int x, int y) { SetCursorPos(x, y); mouse_event(0x0002, 0, 0, 0, IntPtr.Zero); mouse_event(0x0004, 0, 0, 0, IntPtr.Zero); }
  // The panel's tool-window frame is not its content, so every panel coordinate below is client space and lands here.
  public static void ClickClient(IntPtr window, int x, int y) { ClientPoint point; point.X = x; point.Y = y; ClientToScreen(window, ref point); ClickAt(point.X, point.Y); }
  public static int CountBorders(int processId, Rect around) {
    int count = 0;
    EnumWindows(delegate(IntPtr window, IntPtr value) {
      int pid; GetWindowThreadProcessId(window, out pid); if (pid != processId) return true;
      if (!IsWindowVisible(window)) return true;   // the border form keeps its handle and its last bounds after it hides
      long ex = (long)GetWindowLongPtr(window, -20); if ((ex & 0x20) == 0 || (ex & 0x80000) == 0) return true;   // WS_EX_TRANSPARENT and WS_EX_LAYERED
      Rect r; if (!GetWindowRect(window, out r)) return true;
      if (Math.Abs(r.Left - around.Left) <= 2 && Math.Abs(r.Top - around.Top) <= 2 && Math.Abs(r.Right - around.Right) <= 2 && Math.Abs(r.Bottom - around.Bottom) <= 2) count++;
      return true;
    }, IntPtr.Zero);
    return count;
  }
  public static IntPtr Find(int expectedProcessId) {
    IntPtr found = IntPtr.Zero;
    EnumWindows(delegate(IntPtr window, IntPtr value) {
      int processId; GetWindowThreadProcessId(window, out processId);
      var title = new System.Text.StringBuilder(64); GetWindowText(window, title, title.Capacity);
      if (processId == expectedProcessId && title.ToString() == "Sidelook") { found = window; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
'@

function Wait-SidelookCondition($check, $message) {
    $deadline = [DateTime]::UtcNow.AddSeconds(35)
    while (-not (& $check)) { if ([DateTime]::UtcNow -gt $deadline) { throw $message }; Start-Sleep -Milliseconds 200 }
}
function Get-SidelookBounds($process) {
    $process.Refresh()
    $window = [SidelookWindowProbe]::Find($process.Id)
    if ($window -eq [IntPtr]::Zero) { return $null }
    $rect = New-Object SidelookWindowProbe+Rect
    if (-not [SidelookWindowProbe]::GetWindowRect($window,[ref]$rect)) { return $null }
    return @{ Width = $rect.Right - $rect.Left; Height = $rect.Bottom - $rect.Top }
}

$env:JARVIS_FOLLOW_LEASE_SECONDS = '8'   # the shell reads the lease length from its own environment, once per screen-on
$sidelookProbe = Start-Process -FilePath $sidelookExe -PassThru
$fixture = $null
try {
    Wait-SidelookCondition { $sidelookProbe.Refresh(); $sidelookProbe.MainWindowTitle -eq 'Sidelook' } 'Embedded Sidelook window did not render.'
    # The panel is borderless and as tall as its content: 440 wide, somewhere between the 240 floor and the 700 the old fixed window had.
    Wait-SidelookCondition { $bounds = Get-SidelookBounds $sidelookProbe; $bounds -and $bounds.Width -eq 440 -and $bounds.Height -ge 240 -and $bounds.Height -lt 700 } 'Sidelook did not open a content-sized companion panel on first launch.'
    $panelStyle = [SidelookWindowProbe]::GetWindowLongPtr([SidelookWindowProbe]::Find($sidelookProbe.Id), -16)
    if (($panelStyle.ToInt64() -band 0xC00000) -ne 0) { throw 'The panel still has a native title bar (WS_CAPTION).' }
    $emptyHeight = (Get-SidelookBounds $sidelookProbe).Height
    [SidelookWindowProbe]::PostMessage([SidelookWindowProbe]::Find($sidelookProbe.Id),0x0010,[IntPtr]::Zero,[IntPtr]::Zero) | Out-Null
    Wait-SidelookCondition { $bounds = Get-SidelookBounds $sidelookProbe; $bounds -and $bounds.Width -eq 76 -and $bounds.Height -eq 76 } 'Closing the companion did not return Sidelook to its dock.'
    $secondHotkey = [SidelookWindowProbe]::RegisterHotKey([IntPtr]::Zero,0x4A42,0x0002 -bor 0x0004,0x20)
    if ($secondHotkey) { [SidelookWindowProbe]::UnregisterHotKey([IntPtr]::Zero,0x4A42) | Out-Null; throw 'Ctrl+Shift+Space was not registered by Sidelook.' }
    $quickAskProbe = [SidelookWindowProbe]::RegisterHotKey([IntPtr]::Zero,0x4A44,0x0002 -bor 0x0004,0x45)
    if ($quickAskProbe) { [SidelookWindowProbe]::UnregisterHotKey([IntPtr]::Zero,0x4A44) | Out-Null; throw 'Ctrl+Shift+E was not registered by Sidelook.' }
    $open = [Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopOpen')   # legacy name: the shell still creates the 0.15 signal
    $open.Set() | Out-Null
    $open.Dispose()
    Wait-SidelookCondition { $bounds = Get-SidelookBounds $sidelookProbe; $bounds -and $bounds.Width -eq 440 -and $bounds.Height -ge 240 -and $bounds.Height -lt 700 } 'Open signal did not summon the companion panel.'
    # Character Map is the fixture window: a plain Win32 top-level window, unlike Notepad, which is an app alias Start-Process cannot hand back.
    $fixture = Start-Process charmap -PassThru
    Wait-SidelookCondition { $fixture.Refresh(); $fixture.MainWindowHandle -ne 0 } 'Character Map fixture did not open.'
    $panel = [SidelookWindowProbe]::Find($sidelookProbe.Id)
    $client = New-Object SidelookWindowProbe+Rect; [SidelookWindowProbe]::GetClientRect($panel,[ref]$client) | Out-Null
    # The header line is the last item before the two icon buttons: 150px in from the panel's right edge, on the 44px header's centre line.
    [SidelookWindowProbe]::ClickClient($panel, $client.Right - 150, 22); Start-Sleep -Milliseconds 800
    # An open dialog grows the panel to fit it; the dialog is centred, and "Follow my clicks" is the middle of its three stacked actions, 106px below the centre.
    Wait-SidelookCondition { $bounds = Get-SidelookBounds $sidelookProbe; $bounds -and $bounds.Height -gt $emptyHeight } 'The panel did not grow to fit the lease dialog.'
    [SidelookWindowProbe]::GetClientRect($panel,[ref]$client) | Out-Null
    [SidelookWindowProbe]::ClickClient($panel, [int]($client.Right / 2), [int]($client.Bottom / 2) + 106); Start-Sleep -Milliseconds 1200
    $held = [SidelookWindowProbe]::RegisterHotKey([IntPtr]::Zero,0x4A46,0x0002 -bor 0x0004,0x7B)
    if ($held) { [SidelookWindowProbe]::UnregisterHotKey([IntPtr]::Zero,0x4A46) | Out-Null; throw 'Screen on did not take Ctrl+Shift+F12.' }
    $frect = New-Object SidelookWindowProbe+Rect; [SidelookWindowProbe]::GetWindowRect($fixture.MainWindowHandle,[ref]$frect) | Out-Null
    [SidelookWindowProbe]::ClickAt([int](($frect.Left + $frect.Right) / 2), [int](($frect.Top + $frect.Bottom) / 2))
    Wait-SidelookCondition { [SidelookWindowProbe]::CountBorders($sidelookProbe.Id, $frect) -eq 1 } 'No amber border appeared around the clicked Character Map window.'
    Wait-SidelookCondition { [SidelookWindowProbe]::RegisterHotKey([IntPtr]::Zero,0x4A46,0x0002 -bor 0x0004,0x7B) } 'The shortened lease did not release Ctrl+Shift+F12.'
    [SidelookWindowProbe]::UnregisterHotKey([IntPtr]::Zero,0x4A46) | Out-Null
    if ([SidelookWindowProbe]::CountBorders($sidelookProbe.Id, $frect) -ne 0) { throw 'The border outlived the lease.' }
    Write-Output "PASS: embedded WebView2 host rendered the first-launch companion panel borderless at 440x$emptyHeight (content-sized, no title bar), grew it for the lease dialog, collapsed to a 76x76 dock, registered Ctrl+Shift+Space and Ctrl+Shift+E, reopened from its named signal, leased Screen on from the header line, took and released Ctrl+Shift+F12, outlined a clicked Character Map window, and dropped the border at expiry."
} finally {
    if ($fixture) { Stop-Process -Id $fixture.Id -ErrorAction SilentlyContinue }
    Remove-Item Env:JARVIS_FOLLOW_LEASE_SECONDS -ErrorAction SilentlyContinue
    try { $quit = [Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopQuit'); $quit.Set() | Out-Null; $quit.Dispose() } catch { }   # legacy name
    if (-not $sidelookProbe.WaitForExit(15000)) { Stop-Process -Id $sidelookProbe.Id }
}
