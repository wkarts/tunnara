#Requires -RunAsAdministrator
param(
  [string]$Organization = "Tunnara Community",
  [string]$PublicControlUrl = "http://127.0.0.1:7100",
  [string]$PublicRelayUrl = "tcp://127.0.0.1:7300"
)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
$Node = (Get-Command node -ErrorAction Stop).Source
$Major = [int]((& $Node -p "process.versions.node.split('.')[0]").Trim())
if ($Major -lt 22) { throw "Node.js 22 ou superior é obrigatório." }
$Install = Join-Path $env:ProgramFiles "Tunnara"
$Data = Join-Path $env:ProgramData "Tunnara\Server"
New-Item -ItemType Directory -Force -Path $Install,$Data | Out-Null
Remove-Item -Recurse -Force (Join-Path $Install "runtime") -ErrorAction SilentlyContinue
Copy-Item -Recurse -Force (Join-Path $Root "runtime") (Join-Path $Install "runtime")
$Server = Join-Path $Install "runtime\node\bin\tunnara-server.mjs"
$Token = "tnr_admin_" + ([Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).TrimEnd('=').Replace('+','-').Replace('/','_'))
$EnvFile = Join-Path $Data "server-env.cmd"
@"
set NODE_NO_WARNINGS=1
set TUNNARA_DATA_DIR=$Data
set TUNNARA_BOOTSTRAP_ORGANIZATION=$Organization
set TUNNARA_BOOTSTRAP_ADMIN_TOKEN=$Token
set TUNNARA_PUBLIC_CONTROL_URL=$PublicControlUrl
set TUNNARA_PUBLIC_RELAY_URL=$PublicRelayUrl
"@ | Set-Content -Encoding Ascii $EnvFile
$Wrapper = Join-Path $Install "tunnara-server.cmd"
"@echo off`r`ncall `"$EnvFile`"`r`n`"$Node`" `"$Server`" serve-all --data-dir `"$Data`"" | Set-Content -Encoding Ascii $Wrapper
$Action = New-ScheduledTaskAction -Execute "$env:SystemRoot\System32\cmd.exe" -Argument "/c `"$Wrapper`""
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "Tunnara Server" -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Force | Out-Null
Start-ScheduledTask -TaskName "Tunnara Server"
Write-Host "Tunnara Server instalado. Token administrativo inicial: $Token"
