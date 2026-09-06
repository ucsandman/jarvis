$ErrorActionPreference='Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'Computer.cs') -ReferencedAssemblies @('System.Windows.Forms','System.Drawing','System.Web.Extensions','UIAutomationClient','UIAutomationTypes','WindowsBase')
$flags=[Reflection.BindingFlags]'Static,NonPublic'
$denied=[SidelookComputer].GetField('denied',$flags).GetValue($null)
$commands=[SidelookComputer].GetField('commandText',$flags).GetValue($null)
$controls=[SidelookComputer].GetField('launcherControl',$flags).GetValue($null)
$count=0
foreach($name in @('.env','example/.env - Notepad','.secrets.env','cmd.exe','Windows PowerShell','Sign in')) {
    if(-not $denied.IsMatch($name)){throw 'Protected-window filter failed.'};$count++
}
foreach($value in @('powershell -NoProfile -Command calc','cmd /c calc','& whoami','javascript:alert(1)',"first`nsecond")) {
    if(-not $commands.IsMatch($value)){throw 'Command filter failed.'};$count++
}
foreach($value in @('hello world','normal note','Verified desktop input','24 * 7')) {
    if($commands.IsMatch($value)){throw 'Ordinary text was rejected.'};$count++
}
foreach($value in @('Address','urlbar','SearchOrEnterAddress','Terminal')) {
    if(-not $controls.IsMatch($value)){throw 'Launcher control filter failed.'};$count++
}
Write-Output "PASS: $count compiled Windows filter checks, including blocked and ordinary text."
