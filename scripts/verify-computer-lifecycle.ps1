$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$version=(Get-Content package.json -Raw | ConvertFrom-Json).version
$exe=(Resolve-Path ".artifacts/windows-$version/Sidelook-$version-Windows-x64.exe").Path
if(Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue){throw 'Quit the running Sidelook before this isolated check.'}
if(Get-Process mspaint,PaintApp -ErrorAction SilentlyContinue){throw 'This verification requires Paint to be closed so it cannot touch an existing document.'}
$launcher=$null
$ownedApps=@()
try {
    $launcher=Start-Process -FilePath $exe -WindowStyle Hidden -PassThru
    $deadline=[DateTime]::UtcNow.AddSeconds(40)
    do {
        Start-Sleep -Milliseconds 250
        try {$health=Invoke-RestMethod 'http://127.0.0.1:4317/api/health'}catch{$health=$null}
    }while(-not $health -and [DateTime]::UtcNow -lt $deadline)
    if(-not $health.instanceId){throw 'Packaged launcher did not become ready.'}
    $signal=[Threading.EventWaitHandle]::OpenExisting("Local\JarvisOpenApp-$($health.instanceId)-paint")   # legacy name
    $null=$signal.Set();$signal.Dispose()
    $deadline=[DateTime]::UtcNow.AddSeconds(15)
    do {Start-Sleep -Milliseconds 250;$ownedApps=@(Get-Process mspaint,PaintApp -ErrorAction SilentlyContinue)}while($ownedApps.Count -eq 0 -and [DateTime]::UtcNow -lt $deadline)
    if($ownedApps.Count -eq 0){throw 'Fixed Paint launch did not open an application.'}
    Start-Sleep -Seconds 2
    $ownedApps=@(Get-Process mspaint,PaintApp -ErrorAction SilentlyContinue)
    $quit=[Threading.EventWaitHandle]::OpenExisting('Local\JarvisDesktopQuit')   # legacy name
    $null=$quit.Set();$quit.Dispose()
    if(-not $launcher.WaitForExit(15000)){throw 'Sidelook did not quit.'}
    foreach($app in $ownedApps){$app.Refresh();if($app.HasExited){throw 'Quitting Sidelook terminated its user application.'}}
    if(Get-NetTCPConnection -LocalPort 4317 -State Listen -ErrorAction SilentlyContinue){throw 'Sidelook left its local server running.'}
    Write-Output "PASS: packaged fixed-app launch; $($ownedApps.Count) owned Paint process survived Sidelook Quit; local server stopped."
} finally {
    if($launcher -and -not $launcher.HasExited){Stop-Process -Id $launcher.Id}
    foreach($app in $ownedApps){$app.Refresh();if(-not $app.HasExited){$null=$app.CloseMainWindow();if(-not $app.WaitForExit(5000)){Stop-Process -Id $app.Id}}}
}
