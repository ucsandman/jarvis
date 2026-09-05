$ErrorActionPreference = 'Stop'
$jarvisRoot = Split-Path -Parent $PSScriptRoot
$jarvisUrl = 'http://127.0.0.1:4317'
$jarvisReady = $false
try {
    $jarvisResponse = Invoke-RestMethod -Uri "$jarvisUrl/api/session" -TimeoutSec 2
    $jarvisReady = $null -ne $jarvisResponse.configured -and $null -ne $jarvisResponse.token
} catch { $jarvisReady = $false }
if (-not $jarvisReady) {
    $jarvisNode = (Get-Command node -ErrorAction Stop).Source
    $jarvisLogDir = Join-Path $jarvisRoot '.artifacts'
    New-Item -ItemType Directory -Force -Path $jarvisLogDir | Out-Null
    Start-Process -FilePath $jarvisNode -ArgumentList 'server.mjs' -WorkingDirectory $jarvisRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $jarvisLogDir 'server.log') -RedirectStandardError (Join-Path $jarvisLogDir 'server-error.log') | Out-Null
    for ($jarvisAttempt = 0; $jarvisAttempt -lt 20; $jarvisAttempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $jarvisResponse = Invoke-RestMethod -Uri "$jarvisUrl/api/session" -TimeoutSec 2
            $jarvisReady = $null -ne $jarvisResponse.configured -and $null -ne $jarvisResponse.token
            if ($jarvisReady) { break }
        } catch { }
    }
}
if ($jarvisReady) {
    Start-Process $jarvisUrl
} else {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show('Jarvis could not start. Check that Node.js 24 or newer is installed and port 4317 is available.','Jarvis') | Out-Null
}
