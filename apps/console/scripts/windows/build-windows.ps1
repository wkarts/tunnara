<#
.SYNOPSIS
  Build e validação local Windows para tunnara-console.

.DESCRIPTION
  Script único para preparar dependências, validar frontend, validar Rust/Tauri
  quando disponível e gerar o instalador/binário Windows do Tauri.

  Pode ser usado por aplicações derivadas do template. Todas as portas e
  serviços auxiliares devem ser configurados por .env/.env.local e pela tela
  de parâmetros da aplicação; este script apenas injeta variáveis de build
  quando informadas por parâmetro.

.EXAMPLES
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-windows.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-windows.ps1 -Mode Debug
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-windows.ps1 -Clean -OpenOutput
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-windows.ps1 -WebOnly
  powershell -ExecutionPolicy Bypass -File .\scripts\windows\build-windows.ps1 -SkipRustChecks
#>

[CmdletBinding()]
param(
    [ValidateSet('Release', 'Debug')]
    [string]$Mode = 'Release',

    [switch]$Clean,
    [switch]$NoInstall,

    [ValidateSet('Auto', 'Ci', 'Install', 'Offline', 'Skip')]
    [string]$InstallMode = 'Auto',

    [switch]$PreferExistingNodeModules,

    [switch]$SkipRustChecks,
    [switch]$WebOnly,
    [switch]$TauriOnly,
    [switch]$OpenOutput,

    [string]$DevHost = '',
    [int]$DevPort = 0,
    [int]$InternalApiPort = 0,
    [string]$InternalApiHost = '',
    [string]$EnvFile = '.env.local'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " $Message" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Gray
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[AVISO] $Message" -ForegroundColor Yellow
}

function Assert-Command {
    param(
        [string]$Name,
        [string]$InstallHint
    )

    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        throw "Comando '$Name' não encontrado. $InstallHint"
    }

    Write-Ok "$Name encontrado em $($cmd.Source)"
}

function Invoke-Checked {
    param(
        [string]$Title,
        [string]$FilePath,
        [string[]]$Arguments = @()
    )

    Write-Step $Title
    Write-Info "> $FilePath $($Arguments -join ' ')"

    & $FilePath @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Falha em '$Title'. ExitCode=$exitCode"
    }
}


function Remove-PathIfExists {
    param([string]$PathToRemove)

    if (Test-Path $PathToRemove) {
        Write-Info "Removendo $PathToRemove"
        Remove-Item -Recurse -Force $PathToRemove -ErrorAction Stop
    }
}

function Clear-StaleCargoBuildArtifacts {
    <#
      O Tauri gera arquivos de permissões e scripts de build dentro de
      src-tauri/target/**/build contendo caminhos absolutos. Quando o projeto é
      extraído, renomeado ou movido para outra pasta, esses artefatos podem
      continuar apontando para o diretório anterior e provocar erro como:

      failed to read plugin permissions: failed to read file ...\target\...\permissions\...

      Por isso limpamos apenas os artefatos de build script/fingerprint antes
      do clippy/test/build, preservando o restante do cache de compilação sempre
      que possível.
    #>
    Write-Step "Preparando cache Rust/Tauri"

    $pathsToRemove = @(
        'src-tauri\target\debug\build',
        'src-tauri\target\release\build'
    )

    foreach ($path in $pathsToRemove) {
        Remove-PathIfExists -PathToRemove $path
    }

    $fingerprintRoots = @(
        'src-tauri\target\debug\.fingerprint',
        'src-tauri\target\release\.fingerprint'
    )

    $patterns = @(
        'tauri-*',
        'tauri_build-*',
        'tauri-build-*',
        'tunnara_console-*',
        'tunnara-console-*'
    )

    foreach ($rootPath in $fingerprintRoots) {
        if (-not (Test-Path $rootPath)) {
            continue
        }

        foreach ($pattern in $patterns) {
            Get-ChildItem -Path $rootPath -Directory -Filter $pattern -ErrorAction SilentlyContinue | ForEach-Object {
                Write-Info "Removendo fingerprint stale $($_.FullName)"
                Remove-Item -Recurse -Force $_.FullName -ErrorAction Stop
            }
        }
    }

    Write-Ok "Cache Rust/Tauri preparado sem limpar o target completo."
}

function Set-EnvIfProvided {
    param(
        [string]$Name,
        [string]$Value
    )

    if (-not [string]::IsNullOrWhiteSpace($Value)) {
        [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
        Write-Info "$Name=$Value"
    }
}

function Set-EnvIntIfProvided {
    param(
        [string]$Name,
        [int]$Value
    )

    if ($Value -gt 0) {
        [Environment]::SetEnvironmentVariable($Name, [string]$Value, 'Process')
        Write-Info "$Name=$Value"
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $scriptDir '..\..')
Set-Location $root

Write-Step "Tunnara Console - Build Windows"
Write-Info "Diretório raiz: $root"
Write-Info "Modo: $Mode"
Write-Info "Clean: $Clean"
Write-Info "NoInstall: $NoInstall"
Write-Info "InstallMode: $InstallMode"
Write-Info "PreferExistingNodeModules: $PreferExistingNodeModules"
Write-Info "SkipRustChecks: $SkipRustChecks"
Write-Info "WebOnly: $WebOnly"
Write-Info "TauriOnly: $TauriOnly"

if ($WebOnly -and $TauriOnly) {
    throw "Use apenas um entre -WebOnly e -TauriOnly."
}

if (-not (Test-Path 'package.json')) {
    throw "package.json não encontrado. Execute este script na raiz do projeto ou use o wrapper build-windows.bat."
}

Set-EnvIfProvided -Name 'VITE_DEV_HOST' -Value $DevHost
Set-EnvIntIfProvided -Name 'VITE_DEV_PORT' -Value $DevPort
Set-EnvIfProvided -Name 'VITE_INTERNAL_API_HOST' -Value $InternalApiHost
Set-EnvIntIfProvided -Name 'VITE_INTERNAL_API_PORT' -Value $InternalApiPort
Set-EnvIfProvided -Name 'APP_ENV_FILE' -Value $EnvFile

Write-Step "Verificando pré-requisitos"
Assert-Command -Name 'node' -InstallHint 'Instale Node.js LTS: https://nodejs.org/'
Assert-Command -Name 'npm' -InstallHint 'Instale Node.js LTS: https://nodejs.org/'

$nodeVersion = (& node --version)
$npmVersion = (& npm --version)
Write-Info "Node: $nodeVersion"
Write-Info "npm : $npmVersion"

if (-not $WebOnly) {
    Assert-Command -Name 'cargo' -InstallHint 'Instale Rust pelo rustup: https://rustup.rs/'
    Assert-Command -Name 'rustc' -InstallHint 'Instale Rust pelo rustup: https://rustup.rs/'
    $cargoVersion = (& cargo --version)
    $rustVersion = (& rustc --version)
    Write-Info "Cargo: $cargoVersion"
    Write-Info "Rust : $rustVersion"
}

if ($Clean) {
    Write-Step "Limpando artefatos locais"
    $pathsToRemove = @('dist', 'node_modules\.vite', 'src-tauri\target\release\bundle', 'src-tauri\target\debug\bundle')
    foreach ($path in $pathsToRemove) {
        Remove-PathIfExists -PathToRemove $path
    }
}

if ($NoInstall) {
    $InstallMode = 'Skip'
}

if ($InstallMode -eq 'Skip') {
    Write-Warn "Instalação de dependências ignorada por -NoInstall ou -InstallMode Skip."
} else {
    if (Test-Path 'scripts\npm\normalize-package-lock-registry.mjs') {
        Invoke-Checked -Title 'Normalizando package-lock para registry público' -FilePath 'node' -Arguments @('.\scripts\npm\normalize-package-lock-registry.mjs')
    }

    $hasNodeModules = Test-Path 'node_modules\@tauri-apps\cli'
    if ($PreferExistingNodeModules -and $hasNodeModules) {
        Write-Warn "node_modules existente detectado; instalação ignorada por -PreferExistingNodeModules."
    } elseif ($InstallMode -eq 'Offline') {
        Invoke-Checked -Title 'Instalando dependências NPM em modo offline' -FilePath 'npm' -Arguments @('ci', '--offline', '--prefer-offline')
    } elseif ($InstallMode -eq 'Install') {
        Invoke-Checked -Title 'Instalando dependências NPM com npm install' -FilePath 'npm' -Arguments @('install', '--registry', 'https://registry.npmjs.org/')
    } elseif ($InstallMode -eq 'Ci') {
        if (-not (Test-Path 'package-lock.json')) {
            throw "package-lock.json não encontrado para -InstallMode Ci. Use -InstallMode Install."
        }
        Invoke-Checked -Title 'Instalando dependências NPM com npm ci' -FilePath 'npm' -Arguments @('ci', '--registry', 'https://registry.npmjs.org/')
    } else {
        if (Test-Path 'package-lock.json') {
            Invoke-Checked -Title 'Instalando dependências NPM com npm ci' -FilePath 'npm' -Arguments @('ci', '--registry', 'https://registry.npmjs.org/')
        } else {
            Invoke-Checked -Title 'Instalando dependências NPM com npm install' -FilePath 'npm' -Arguments @('install', '--registry', 'https://registry.npmjs.org/')
        }
    }
}

if (-not $TauriOnly) {
    Invoke-Checked -Title 'Validando sincronização de versão' -FilePath 'npm' -Arguments @('run', 'ci:version')
    Invoke-Checked -Title 'Typecheck Vue/TypeScript' -FilePath 'npm' -Arguments @('run', 'typecheck')
    Invoke-Checked -Title 'Build Web/Vite e preparar resources Tauri' -FilePath 'npm' -Arguments @('run', 'build:web:tauri')
}

if ($WebOnly) {
    Write-Step "Build Web concluído"
    Write-Ok "Artefatos Web disponíveis em: dist"
    if ($OpenOutput) {
        Invoke-Item (Join-Path $root 'dist')
    }
    exit 0
}

if (-not $SkipRustChecks) {
    Clear-StaleCargoBuildArtifacts
    Invoke-Checked -Title 'Formatando Rust' -FilePath 'npm' -Arguments @('run', 'fmt:rust')
    Invoke-Checked -Title 'Verificando formatação Rust' -FilePath 'npm' -Arguments @('run', 'fmt:rust:check')
    Invoke-Checked -Title 'Clippy Rust' -FilePath 'npm' -Arguments @('run', 'lint:rust')
    Invoke-Checked -Title 'Testes Rust' -FilePath 'npm' -Arguments @('run', 'test:rust')
} else {
    Write-Warn "Validações Rust ignoradas por -SkipRustChecks."
}

if ($SkipRustChecks) {
    Clear-StaleCargoBuildArtifacts
}

if ($Mode -eq 'Debug') {
    Invoke-Checked -Title 'Build Tauri Windows Debug' -FilePath 'npm' -Arguments @('run', 'tauri:build:debug')
    $bundleDir = Join-Path $root 'src-tauri\target\debug\bundle'
} else {
    Invoke-Checked -Title 'Build Tauri Windows Release' -FilePath 'npm' -Arguments @('run', 'tauri:build')
    $bundleDir = Join-Path $root 'src-tauri\target\release\bundle'
}

Write-Step "Build Windows concluído"
Write-Ok "Bundle Tauri: $bundleDir"

if (Test-Path $bundleDir) {
    Get-ChildItem -Recurse $bundleDir | Where-Object { -not $_.PSIsContainer } | Select-Object FullName, Length, LastWriteTime | Format-Table -AutoSize
    if ($OpenOutput) {
        Invoke-Item $bundleDir
    }
} else {
    Write-Warn "Diretório de bundle não encontrado ainda: $bundleDir"
}

Write-Ok "Processo finalizado com sucesso."
