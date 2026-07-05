#Requires -RunAsAdministrator
param(
  [switch]$RemoveData
)
$ErrorActionPreference = "Stop"
foreach ($Task in @("Tunnara Agent", "Tunnara Server")) {
  if (Get-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $Task -Confirm:$false
  }
}
Remove-Item -Recurse -Force (Join-Path $env:ProgramFiles "Tunnara") -ErrorAction SilentlyContinue
if ($RemoveData) {
  Remove-Item -Recurse -Force (Join-Path $env:ProgramData "Tunnara") -ErrorAction SilentlyContinue
}
Write-Host "Tunnara removido. Dados preservados: $(-not $RemoveData)"
