$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$jarvisVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$jarvisExe = (Resolve-Path ".artifacts/windows-$jarvisVersion/Jarvis-$jarvisVersion-Windows-x64.exe").Path
if (Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 4317 must be free before this isolated lifecycle check.' }
function Wait-JarvisCondition($check, $message) {
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not (& $check)) { if ([DateTime]::UtcNow -gt $deadline) { throw $message }; Start-Sleep -Milliseconds 200 }
}
function Get-JarvisListener { Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess }
function Start-JarvisProbe { Start-Process -FilePath $jarvisExe -WindowStyle Hidden -PassThru }
$jarvisProbe = $null
$jarvisListener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,4317)
try {
    $jarvisListener.Start()
    $jarvisProbe = Start-JarvisProbe
    Wait-JarvisCondition { $jarvisProbe.Refresh(); $jarvisProbe.MainWindowTitle -eq "Jarvis couldn't start" } 'Occupied port did not produce a startup error.'
    $jarvisChildren = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($jarvisProbe.Id)")
    if ($jarvisChildren.Count -ne 0) { throw 'Occupied-port launch created an unexpected child process.' }
    Stop-Process -Id $jarvisProbe.Id
    $jarvisProbe.WaitForExit(10000) | Out-Null
    Write-Output 'PASS: occupied port refused with visible error and zero child processes.'
} finally { $jarvisListener.Stop(); if ($jarvisProbe -and -not $jarvisProbe.HasExited) { Stop-Process -Id $jarvisProbe.Id } }
try {
    $jarvisProbe = Start-JarvisProbe
    Wait-JarvisCondition { Get-JarvisListener } 'Executable did not start its server.'
    $jarvisServerId = Get-JarvisListener
    $jarvisServer = Get-CimInstance Win32_Process -Filter "ProcessId=$jarvisServerId"
    if ($jarvisServer.ParentProcessId -ne $jarvisProbe.Id) { throw 'Launcher does not own listener.' }
    # Allow the initial browser and shortcuts to finish before testing a second click.
    Start-Sleep -Seconds 2
    $jarvisSecond = Start-JarvisProbe
    if (-not $jarvisSecond.WaitForExit(10000) -or $jarvisSecond.ExitCode -ne 0) { throw 'Second click did not reuse the active launcher.' }
    if ((Get-JarvisListener) -ne $jarvisServerId) { throw 'Second click changed the server process.' }
    $jarvisQuit = [Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopQuit')
    $jarvisQuit.Set() | Out-Null; $jarvisQuit.Dispose()
    if (-not $jarvisProbe.WaitForExit(15000)) { throw 'Quit did not stop launcher.' }
    Wait-JarvisCondition { -not (Get-Process -Id $jarvisServerId -ErrorAction SilentlyContinue) } 'Quit left its server running.'
    Write-Output 'PASS: first launch owns listener; second click reuses it; Quit stops server.'
    $jarvisProbe = Start-JarvisProbe
    Wait-JarvisCondition { Get-JarvisListener } 'Second session did not start.'
    $jarvisServerId = Get-JarvisListener
    Start-Sleep -Seconds 2
    Stop-Process -Id $jarvisProbe.Id
    Wait-JarvisCondition { -not (Get-Process -Id $jarvisServerId -ErrorAction SilentlyContinue) } 'Unexpected launcher termination left its server running.'
    Write-Output 'PASS: Windows Job Object stops owned server after forced launcher termination. 6 lifecycle checks.'
} finally { if ($jarvisProbe -and -not $jarvisProbe.HasExited) { Stop-Process -Id $jarvisProbe.Id } }
