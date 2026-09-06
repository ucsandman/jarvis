$ErrorActionPreference = 'Stop'
$jarvisRoot = Split-Path -Parent $PSScriptRoot
Set-Location $jarvisRoot
$jarvisVersion = (Get-Content package.json -Raw | ConvertFrom-Json).version
$jarvisBuild = Join-Path $jarvisRoot ".artifacts/windows-$jarvisVersion"
$jarvisPayload = Join-Path $jarvisBuild ('payload-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $jarvisPayload | Out-Null
$jarvisWebViewVersion = '1.0.4191.47'
$jarvisWebViewHash = 'f492bbf547d0da329553b6727435b677579b1e9f91cc9e4a1ad029366d5f23d0'
$jarvisWebViewPackage = Join-Path $jarvisBuild "Microsoft.Web.WebView2.$jarvisWebViewVersion.nupkg"
if (-not (Test-Path -LiteralPath $jarvisWebViewPackage)) { Invoke-WebRequest "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$jarvisWebViewVersion/microsoft.web.webview2.$jarvisWebViewVersion.nupkg" -OutFile $jarvisWebViewPackage }
if ((Get-FileHash -LiteralPath $jarvisWebViewPackage -Algorithm SHA256).Hash.ToLowerInvariant() -ne $jarvisWebViewHash) { throw 'Official WebView2 SDK package checksum mismatch.' }
$jarvisWebView = Join-Path $jarvisBuild ('webview2-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $jarvisWebView | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::ExtractToDirectory($jarvisWebViewPackage,$jarvisWebView)
# Fixed public inputs only. No profile, credentials, local artifacts or user revisions.
foreach ($file in @('server.mjs','package.json','LICENSE')) { Copy-Item -LiteralPath (Join-Path $jarvisRoot $file) -Destination $jarvisPayload }
# Include launcher source so its changes also select a fresh immutable install directory.
Get-ChildItem -LiteralPath (Join-Path $jarvisRoot 'desktop') -Filter '*.cs' -File | Copy-Item -Destination $jarvisPayload
Copy-Item -LiteralPath (Join-Path $jarvisWebView 'runtimes/win-x64/native/WebView2Loader.dll') -Destination $jarvisPayload
Copy-Item -LiteralPath (Join-Path $jarvisWebView 'LICENSE.txt') -Destination (Join-Path $jarvisPayload 'WEBVIEW2-LICENSE.txt')
New-Item -ItemType Directory -Force -Path (Join-Path $jarvisPayload 'scripts') | Out-Null
Copy-Item -LiteralPath (Join-Path $jarvisRoot 'scripts/dictate.ps1') -Destination (Join-Path $jarvisPayload 'scripts')
Copy-Item -LiteralPath (Join-Path $jarvisRoot 'scripts/check-publisher.ps1') -Destination (Join-Path $jarvisPayload 'scripts')
foreach ($file in @('computer.ps1','Computer.cs')) { Copy-Item -LiteralPath (Join-Path $jarvisRoot "scripts/$file") -Destination (Join-Path $jarvisPayload 'scripts') }
foreach ($dir in @('lib','public')) {
    $target = Join-Path $jarvisPayload $dir
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Get-ChildItem -LiteralPath (Join-Path $jarvisRoot $dir) -File | Where-Object { $_.Extension -in @('.mjs','.js','.html','.css','.svg') } | Copy-Item -Destination $target
}
$jarvisNodeZip = Join-Path $jarvisBuild 'node.zip'
$jarvisNodeHash = 'cc5149eabd53779ce1e7bdc5401643622d0c7e6800ade18928a767e940bb0e62'
if (-not (Test-Path -LiteralPath $jarvisNodeZip)) { Invoke-WebRequest 'https://nodejs.org/dist/v24.15.0/node-v24.15.0-win-x64.zip' -OutFile $jarvisNodeZip }
if ((Get-FileHash -LiteralPath $jarvisNodeZip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $jarvisNodeHash) { throw 'Official Node archive checksum mismatch.' }
Expand-Archive -LiteralPath $jarvisNodeZip -DestinationPath (Join-Path $jarvisBuild 'node') -Force
$jarvisRuntime = Join-Path $jarvisPayload 'runtime'
New-Item -ItemType Directory -Force -Path $jarvisRuntime | Out-Null
Copy-Item -LiteralPath (Join-Path $jarvisBuild 'node/node-v24.15.0-win-x64/node.exe') -Destination $jarvisRuntime
Copy-Item -LiteralPath (Join-Path $jarvisBuild 'node/node-v24.15.0-win-x64/LICENSE') -Destination (Join-Path $jarvisRuntime 'NODE-LICENSE.txt')
foreach ($notice in @('LICENSE','NOTICE')) { Invoke-WebRequest "https://raw.githubusercontent.com/openai/codex/rust-v0.153.4/$notice" -OutFile (Join-Path $jarvisRuntime "CODEX-$notice.txt") }
& npm install --prefix $jarvisRuntime --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org @openai/codex@0.153.4
if ($LASTEXITCODE -ne 0) { throw 'Official Codex package installation failed.' }
# Windows PowerShell cannot deserialize npm's empty root-package property name.
$jarvisIntegrity = 'const p=JSON.parse(require("fs").readFileSync(process.argv[2])).packages; console.log(p["node_modules/@openai/codex"].integrity); console.log(p["node_modules/@openai/codex-win32-x64"].integrity)' | & node - (Join-Path $jarvisRuntime 'package-lock.json')
if ($LASTEXITCODE -ne 0 -or $jarvisIntegrity[0] -ne 'sha512-wbHDmit7S/YvBGVX1DQmk13xtWblZ2cApeJ/pB7xDZ10Cna+DZc5ij7f0F4OxdsXN4FW1oLT48OpogUI1+8Y2w==' -or $jarvisIntegrity[1] -ne 'sha512-lMkB43kJZH0VFr+hoXc11qqR7QtQIbkr07ALgj4urKL1osNyUyuy1iXd3Vzz2iCYvBUCSw7I0l/W1cEPGx9euQ==') { throw 'Codex package integrity mismatch.' }
foreach ($binary in @((Join-Path $jarvisRuntime 'node.exe')) + @(Get-ChildItem (Join-Path $jarvisRuntime 'node_modules/@openai') -Recurse -Filter codex.exe | ForEach-Object FullName)) {
    $signature = Get-AuthenticodeSignature -LiteralPath $binary
    if ($signature.Status -ne 'Valid') { throw 'Bundled executable signature validation failed.' }
    $publisher = if ((Split-Path -Leaf $binary) -eq 'node.exe') { 'OpenJS Foundation' } else { 'OpenAI' }
    if ($signature.SignerCertificate.Subject -notmatch $publisher) { throw 'Unexpected bundled executable publisher.' }
}
& (Join-Path $jarvisRuntime 'node.exe') (Join-Path $jarvisRuntime 'node_modules/@openai/codex/bin/codex.js') --version
if ($LASTEXITCODE -ne 0) { throw 'Bundled Codex verification failed.' }
$jarvisZip = Join-Path $jarvisBuild 'payload.zip'
Compress-Archive -Path (Join-Path $jarvisPayload '*') -DestinationPath $jarvisZip -Force
$jarvisHash = (Get-FileHash -LiteralPath $jarvisZip -Algorithm SHA256).Hash.ToLowerInvariant()
$jarvisInfo = Join-Path $jarvisBuild 'BuildInfo.cs'
Set-Content -LiteralPath $jarvisInfo -Value "internal static class BuildInfo { public const string Version = `"$jarvisVersion`"; public const string PayloadHash = `"$jarvisHash`"; }"
$jarvisExe = Join-Path $jarvisBuild "Jarvis-$jarvisVersion-Windows-x64.exe"
$jarvisCompiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
# UI Automation and its Point type sit in the framework's WPF folder, which csc does not search by name.
$jarvisWpf = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/WPF'
$jarvisWebViewCore = Join-Path $jarvisWebView 'lib/net462/Microsoft.Web.WebView2.Core.dll'
$jarvisWebViewForms = Join-Path $jarvisWebView 'lib/net462/Microsoft.Web.WebView2.WinForms.dll'
$jarvisSources = @(Get-ChildItem -LiteralPath (Join-Path $jarvisRoot 'desktop') -Filter '*.cs' -File | ForEach-Object FullName)
$jarvisIcon = Join-Path $jarvisRoot 'desktop/jarvis.ico'
if (-not (Test-Path -LiteralPath $jarvisIcon)) { throw 'desktop/jarvis.ico is missing. Run scripts/build-icon.ps1 first.' }
& $jarvisCompiler /nologo /target:winexe /platform:x64 /optimize+ "/win32icon:$jarvisIcon" /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll /reference:System.Web.Extensions.dll /reference:Microsoft.CSharp.dll "/reference:$jarvisWpf/UIAutomationClient.dll" "/reference:$jarvisWpf/UIAutomationTypes.dll" "/reference:$jarvisWpf/WindowsBase.dll" "/reference:$jarvisWebViewCore" "/reference:$jarvisWebViewForms" "/resource:$jarvisZip,payload.zip" "/resource:$jarvisWebViewCore,Microsoft.Web.WebView2.Core.dll" "/resource:$jarvisWebViewForms,Microsoft.Web.WebView2.WinForms.dll" "/out:$jarvisExe" $jarvisSources $jarvisInfo
if ($LASTEXITCODE -ne 0) { throw 'Windows launcher compilation failed.' }
$jarvisExeHash = (Get-FileHash -LiteralPath $jarvisExe -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath (Join-Path $jarvisBuild 'SHA256SUMS.txt') -Value "$jarvisExeHash  Jarvis-$jarvisVersion-Windows-x64.exe"
Write-Output "PASS: packaged Jarvis $jarvisVersion, Node 24.15.0, Codex 0.153.4, WebView2 SDK $jarvisWebViewVersion. Executable bytes: $((Get-Item -LiteralPath $jarvisExe).Length)"
