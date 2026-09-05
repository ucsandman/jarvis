$ErrorActionPreference = 'Stop'
$jarvisRoot = Split-Path -Parent $PSScriptRoot
$jarvisUrl = 'http://127.0.0.1:4317'
function Test-JarvisReady {
    try {
        $response = Invoke-RestMethod -Uri "$jarvisUrl/api/health" -TimeoutSec 2
        return $response.app -eq 'jarvis-workbench' -and $response.ready -eq $true
    } catch { return $false }
}
# Serialize repeated double-clicks without relying on authentication or browser state.
$jarvisMutex = New-Object System.Threading.Mutex($false, 'Local\JarvisWorkbenchLauncher')
$jarvisOwned = $false
try {
    $jarvisOwned = $jarvisMutex.WaitOne(30000)
    if (-not $jarvisOwned) { throw 'Another Jarvis launch is still starting. Please try again shortly.' }
    if (-not (Test-JarvisReady)) {
        $jarvisNode = Get-Command node -ErrorAction SilentlyContinue
        if (-not $jarvisNode) { throw 'Install Node.js 24 or newer, then reopen Start Jarvis.cmd. Download: https://nodejs.org/en/download' }
        $jarvisVersion = & $jarvisNode.Source --version
        if ($LASTEXITCODE -ne 0 -or $jarvisVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) {
            throw 'Jarvis needs Node.js 24 or newer. Update Node, then reopen Start Jarvis.cmd. Download: https://nodejs.org/en/download'
        }
        $jarvisLogDir = Join-Path $jarvisRoot '.artifacts'
        New-Item -ItemType Directory -Force -Path $jarvisLogDir | Out-Null
        $jarvisProcess = Start-Process -FilePath $jarvisNode.Source -ArgumentList 'server.mjs' -WorkingDirectory $jarvisRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $jarvisLogDir 'server.log') -RedirectStandardError (Join-Path $jarvisLogDir 'server-error.log') -PassThru
        $jarvisDeadline = [DateTime]::UtcNow.AddSeconds(15)
        while (-not (Test-JarvisReady)) {
            if ($jarvisProcess.HasExited) { throw 'Jarvis could not start. Port 4317 may belong to another application. Close that application and try again. Startup details are in .artifacts/server-error.log.' }
            if ([DateTime]::UtcNow -ge $jarvisDeadline) { throw 'Jarvis did not become ready within 15 seconds. Reopen the launcher to retry. Startup details are in .artifacts/server-error.log.' }
            Start-Sleep -Milliseconds 250
        }
    }
    Start-Process $jarvisUrl
} catch {
    Add-Type -AssemblyName PresentationFramework
    $jarvisMessage = $_.Exception.Message
    if ($jarvisMessage -like '*nodejs.org*') {
        $jarvisAnswer = [System.Windows.MessageBox]::Show("$jarvisMessage`n`nOpen the Node.js download page?",'Jarvis setup','YesNo','Information')
        if ($jarvisAnswer -eq 'Yes') { Start-Process 'https://nodejs.org/en/download' }
    } else { [System.Windows.MessageBox]::Show($jarvisMessage,'Jarvis') | Out-Null }
    exit 1
} finally {
    if ($jarvisOwned) { $jarvisMutex.ReleaseMutex() }
    $jarvisMutex.Dispose()
}
