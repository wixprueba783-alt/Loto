$ErrorActionPreference = "Stop"

$serviceDirectory = $PSScriptRoot
$projectDirectory = Split-Path -Parent $serviceDirectory
$environmentFile = Join-Path $serviceDirectory ".env"
$exampleEnvironmentFile = Join-Path $serviceDirectory ".env.example"
$webEnvironmentFile = Join-Path $projectDirectory ".env"
$taskName = "Loto WhatsApp Notifications"
$credentialFile = Join-Path $serviceDirectory "service-account.json"
$webFirebaseKeys = @(
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID"
)

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Executable,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  Push-Location $WorkingDirectory
  try {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "$Executable $($Arguments -join ' ') finalizó con código $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

try {
  $nodeVersionText = (& node --version 2>$null | Select-Object -First 1)
  if ($LASTEXITCODE -ne 0 -or $nodeVersionText -notmatch "^v(\d+)\.(\d+)\.(\d+)") {
    throw "Instala Node.js 22.12 o posterior y vuelve a ejecutar este instalador."
  }

  $nodeVersion = [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3])
  if ($nodeVersion -lt [version]"22.12.0") {
    throw "Se requiere Node.js 22.12 o posterior. Versión detectada: $nodeVersionText"
  }

  if (-not (Test-Path $environmentFile)) {
    Copy-Item $exampleEnvironmentFile $environmentFile
    Write-Host "Se creó whatsapp-service\.env desde la plantilla."
  }

  $serviceEnvironment = [System.Collections.Generic.List[string]]::new()
  Get-Content $environmentFile | ForEach-Object { $serviceEnvironment.Add($_) }
  $webEnvironment = @{}
  if (Test-Path $webEnvironmentFile) {
    foreach ($line in Get-Content $webEnvironmentFile) {
      if ($line -match "^\s*(VITE_FIREBASE_[A-Z_]+)\s*=\s*(.*)$") {
        $webEnvironment[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
      }
    }
  }

  $missingWebKeys = [System.Collections.Generic.List[string]]::new()
  foreach ($key in $webFirebaseKeys) {
    $currentIndex = -1
    for ($index = 0; $index -lt $serviceEnvironment.Count; $index++) {
      if ($serviceEnvironment[$index] -match "^\s*$key\s*=") {
        $currentIndex = $index
        break
      }
    }

    $currentValue = if ($currentIndex -ge 0) {
      ($serviceEnvironment[$currentIndex] -split "=", 2)[1].Trim().Trim('"').Trim("'")
    } else {
      ""
    }

    if (-not $currentValue -and $webEnvironment[$key]) {
      $replacement = "$key=$($webEnvironment[$key])"
      if ($currentIndex -ge 0) {
        $serviceEnvironment[$currentIndex] = $replacement
      } else {
        $serviceEnvironment.Add($replacement)
      }
    } elseif (-not $currentValue) {
      $missingWebKeys.Add($key)
    }
  }

  if ($missingWebKeys.Count -gt 0) {
    throw "Faltan variables de Firebase Web en .env o whatsapp-service\.env: $($missingWebKeys -join ', ')."
  }

  Set-Content -Path $environmentFile -Value $serviceEnvironment -Encoding utf8

  if (-not (Test-Path $credentialFile)) {
    throw "Copia la clave privada de Firebase en whatsapp-service\service-account.json. No la subas al repositorio."
  }

  $credentialSetting = Get-Content $environmentFile |
    Where-Object { $_ -match "^\s*GOOGLE_APPLICATION_CREDENTIALS\s*=" } |
    Select-Object -First 1

  if (-not $credentialSetting) {
    throw "Define GOOGLE_APPLICATION_CREDENTIALS en whatsapp-service\.env."
  }

  $credentialPath = ($credentialSetting -split "=", 2)[1].Trim().Trim('"').Trim("'")
  if (-not [System.IO.Path]::IsPathRooted($credentialPath)) {
    $credentialPath = Join-Path $serviceDirectory $credentialPath
  }
  if (-not (Test-Path $credentialPath)) {
    throw "No se encontró la credencial indicada por GOOGLE_APPLICATION_CREDENTIALS: $credentialPath"
  }

  Write-Host "Instalando dependencias de la aplicación..."
  Invoke-CheckedCommand "npm" @("ci") $projectDirectory

  Write-Host "Instalando dependencias de WhatsApp..."
  Invoke-CheckedCommand "npm" @("ci", "--prefix", $serviceDirectory) $projectDirectory
  Invoke-CheckedCommand "npm" @("install-scripts", "approve", "puppeteer", "--prefix", $serviceDirectory) $projectDirectory
  Invoke-CheckedCommand "npm" @("rebuild", "puppeteer", "--prefix", $serviceDirectory) $projectDirectory

  Write-Host "Construyendo la aplicación web..."
  Invoke-CheckedCommand "npm" @("run", "build") $projectDirectory

  $logDirectory = Join-Path $serviceDirectory "logs"
  New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

  $windowsScriptHost = Join-Path $env:SystemRoot "System32\wscript.exe"
  $hiddenRunner = Join-Path $serviceDirectory "run-hidden-service.vbs"
  $action = New-ScheduledTaskAction `
    -Execute $windowsScriptHost `
    -Argument "//B //NoLogo `"$hiddenRunner`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
  $settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -MultipleInstances IgnoreNew `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries

  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Inicia Loto y el servicio de notificaciones WhatsApp al iniciar sesión." `
    -Force | Out-Null

  Start-ScheduledTask -TaskName $taskName
  Write-Host ""
  Write-Host "Instalación completa. El servicio se inició y arrancará al iniciar sesión en Windows."
  Write-Host "Log: whatsapp-service\logs\service.log"
  Write-Host "Para abrir Loto en esta computadora: http://localhost:10000"
}
catch {
  Write-Error $_
  exit 1
}
