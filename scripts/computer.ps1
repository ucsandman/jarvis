$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'Computer.cs') -ReferencedAssemblies @('System.Windows.Forms','System.Drawing','System.Web.Extensions','UIAutomationClient','UIAutomationTypes','WindowsBase')
[JarvisComputer]::Run()
