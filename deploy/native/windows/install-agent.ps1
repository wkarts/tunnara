#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory=$true)][string]$ProvisioningToken,
  [string]$ControlUrl = "http://127.0.0.1:7100",
  [string]$RelayUrl = "",
  [string]$AgentName = $env:COMPUTERNAME
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Node = (Get-Command node -ErrorAction Stop).Source
$Major = [int]((& $Node -p "process.versions.node.split('.')[0]").Trim())
if ($Major -lt 22) { throw "Node.js 22 ou superior é obrigatório." }
$Install = Join-Path $env:ProgramFiles "Tunnara"
$Data = Join-Path $env:ProgramData "Tunnara\Agent"
New-Item -ItemType Directory -Force -Path $Install,$Data | Out-Null
Remove-Item -Recurse -Force (Join-Path $Install "runtime") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $Root "runtime") (Join-Path $Install "runtime")
$Cli = Join-Path $Install "runtime\node\bin\tunnara.mjs"
$args = @($Cli, "login", "--token", $ProvisioningToken, "--name", $AgentName, "--control-url", $ControlUrl, "--config-dir", $Data)
if ($RelayUrl) { $args += @("--relay-url", $RelayUrl) }
& $Node @args
$Cmd = Join-Path $Install "tunnara.cmd"
"@echo off`r`n`"$Node`" `"$Cli`" %*" | Set-Content -Encoding Ascii $Cmd
$TaskArgs = "`"$Cli`" serve --config-dir `"$Data`""
$Action = New-ScheduledTaskAction -Execute $Node -Argument $TaskArgs
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Tunnara Agent" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName "Tunnara Agent"
Write-Host "Tunnara Agent instalado. CLI: $Cmd"
