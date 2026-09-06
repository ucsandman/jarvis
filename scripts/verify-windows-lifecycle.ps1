$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$sidelookVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$sidelookExe = (Resolve-Path ".artifacts/windows-$sidelookVersion/Sidelook-$sidelookVersion-Windows-x64.exe").Path
if (Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 4317 must be free before this isolated lifecycle check.' }
function Wait-SidelookCondition($check, $message) {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not (& $check)) { if ([DateTime]::UtcNow -gt $deadline) { throw $message }; Start-Sleep -Milliseconds 200 }
}
function Get-SidelookListener { Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess }
function Start-SidelookProbe { Start-Process -FilePath $sidelookExe -WindowStyle Hidden -PassThru }
$sidelookProbe = $null
$sidelookListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,4317)
try {
    $sidelookListener.Start()
    $sidelookProbe = Start-SidelookProbe
    Wait-SidelookCondition { $sidelookProbe.Refresh(); $sidelookProbe.MainWindowTitle -eq "Sidelook couldn't start" } 'Occupied port did not produce a startup error.'
    $sidelookChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($sidelookProbe.Id)")
    if ($sidelookChildren.Count -ne 0) { throw 'Occupied-port launch created an unexpected child process.' }
    Stop-Process -Id $sidelookProbe.Id
    $sidelookProbe.WaitForExit(10000) | Out-Null
    Write-Output 'PASS: occupied port refused with visible error and zero child processes.'
} finally { $sidelookListener.Stop(); if ($sidelookProbe -and -not $sidelookProbe.HasExited) { Stop-Process -Id $sidelookProbe.Id } }
try {
    $sidelookProbe = Start-SidelookProbe
    Wait-SidelookCondition { Get-SidelookListener } 'Executable did not start its server.'
    $sidelookServerId = Get-SidelookListener
    $sidelookServer = Get-CimInstance Win32_Process -Filter "ProcessId=$sidelookServerId"
    if ($sidelookServer.ParentProcessId -ne $sidelookProbe.Id) { throw 'Launcher does not own listener.' }
    # Allow the initial browser and shortcuts to finish before testing a second click.
    Start-Sleep -Seconds 2
    $sidelookSecond = Start-SidelookProbe
    if (-not $sidelookSecond.WaitForExit(10000) -or $sidelookSecond.ExitCode -ne 0) { throw 'Second click did not reuse the active launcher.' }
    if ((Get-SidelookListener) -ne $sidelookServerId) { throw 'Second click changed the server process.' }
    $sidelookQuit = [Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopQuit')   # legacy name: the shell still creates the 0.15 signal
    $sidelookQuit.Set() | Out-Null; $sidelookQuit.Dispose()
    if (-not $sidelookProbe.WaitForExit(15000)) { throw 'Quit did not stop launcher.' }
    Wait-SidelookCondition { -not (Get-Process -Id $sidelookServerId -ErrorAction SilentlyContinue) } 'Quit left its server running.'
    Write-Output 'PASS: first launch owns listener; second click reuses it; Quit stops server.'
    $sidelookProbe = Start-SidelookProbe
    Wait-SidelookCondition { Get-SidelookListener } 'Second session did not start.'
    $sidelookServerId = Get-SidelookListener
    Start-Sleep -Seconds 2
    Stop-Process -Id $sidelookProbe.Id
    Wait-SidelookCondition { -not (Get-Process -Id $sidelookServerId -ErrorAction SilentlyContinue) } 'Unexpected launcher termination left its server running.'
    Write-Output 'PASS: Windows Job Object stops owned server after forced launcher termination. 6 lifecycle checks.'
} finally { if ($sidelookProbe -and -not $sidelookProbe.HasExited) { Stop-Process -Id $sidelookProbe.Id } }
