$ErrorActionPreference = 'Stop'
$sidelookRoot = Split-Path -Parent $PSScriptRoot
$sidelookUrl = 'http://127.0.0.1:4317'
function Test-SidelookReady {
    try {
        $response = Invoke-RestMethod -Uri "$sidelookUrl/api/health" -TimeoutSec 2
        return $response.app -eq 'jarvis-workbench' -and $response.ready -eq $true
    } catch { return $false }
}
# Serialize repeated double-clicks without relying on authentication or browser state.
$sidelookMutex = New-Object System.Threading.Mutex($false, 'Local\SidelookWorkbenchLauncher')
$sidelookOwned = $false
try {
    $sidelookOwned = $sidelookMutex.WaitOne(30000)
    if (-not $sidelookOwned) { throw 'Another Sidelook launch is still starting. Please try again shortly.' }
    if (-not (Test-SidelookReady)) {
        $sidelookNode = Get-Command node -ErrorAction SilentlyContinue
        if (-not $sidelookNode) { throw 'Install Node.js 24 or newer, then reopen Start Sidelook.cmd. Download: https://nodejs.org/en/download' }
        $sidelookVersion = & $sidelookNode.Source --version
        if ($LASTEXITCODE -ne 0 -or $sidelookVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) {
            throw 'Sidelook needs Node.js 24 or newer. Update Node, then reopen Start Sidelook.cmd. Download: https://nodejs.org/en/download'
        }
        $sidelookLogDir = Join-Path $sidelookRoot '.artifacts'
        New-Item -ItemType Directory -Force -Path $sidelookLogDir | Out-Null
        $sidelookProcess = Start-Process -FilePath $sidelookNode.Source -ArgumentList 'server.mjs' -WorkingDirectory $sidelookRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $sidelookLogDir 'server.log') -RedirectStandardError (Join-Path $sidelookLogDir 'server-error.log') -PassThru
        $sidelookDeadline = [DateTime]::UtcNow.AddSeconds(15)
        while (-not (Test-SidelookReady)) {
            if ($sidelookProcess.HasExited) { throw 'Sidelook could not start. Port 4317 may belong to another application. Close that application and try again. Startup details are in .artifacts/server-error.log.' }
            if ([DateTime]::UtcNow -ge $sidelookDeadline) { throw 'Sidelook did not become ready within 15 seconds. Reopen the launcher to retry. Startup details are in .artifacts/server-error.log.' }
            Start-Sleep -Milliseconds 250
        }
    }
    Start-Process $sidelookUrl
} catch {
    Add-Type -AssemblyName PresentationFramework
    $sidelookMessage = $_.Exception.Message
    if ($sidelookMessage -like '*nodejs.org*') {
        $sidelookAnswer = [System.Windows.MessageBox]::Show("$sidelookMessage`n`nOpen the Node.js download page?",'Sidelook setup','YesNo','Information')
        if ($sidelookAnswer -eq 'Yes') { Start-Process 'https://nodejs.org/en/download' }
    } else { [System.Windows.MessageBox]::Show($sidelookMessage,'Sidelook') | Out-Null }
    exit 1
} finally {
    if ($sidelookOwned) { $sidelookMutex.ReleaseMutex() }
    $sidelookMutex.Dispose()
}
