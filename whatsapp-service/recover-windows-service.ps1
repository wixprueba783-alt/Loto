$ErrorActionPreference = "Stop"

$serviceTaskName = "Loto WhatsApp Notifications"
$logFile = Join-Path $PSScriptRoot "logs\recovery.log"
$projectDirectory = Split-Path -Parent $PSScriptRoot

function Write-RecoveryLog {
  param([Parameter(Mandatory = $true)][string]$Message)

  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logFile -Value "[$timestamp] $Message" -Encoding utf8
}

try {
  Start-Sleep -Seconds 10

  $task = Get-ScheduledTask -TaskName $serviceTaskName -ErrorAction SilentlyContinue
  if ($task -and $task.State -in @("Running", "Queued")) {
    Stop-ScheduledTask -TaskName $serviceTaskName
  }

  $servicePath = [regex]::Escape($PSScriptRoot)
  $processes = @(Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match $servicePath -and (
      ($_.Name -ieq "wscript.exe" -and $_.CommandLine -match "run-hidden-service\.vbs") -or
      ($_.Name -ieq "node.exe" -and $_.CommandLine -match "run-with-logs\.js|server\.js")
    )
  })

  $authDataPath = Join-Path $env:LOCALAPPDATA "LotoWhatsapp\wwebjs_auth"
  $environmentFile = Join-Path $PSScriptRoot ".env"
  if (Test-Path $environmentFile) {
    $authSetting = Get-Content $environmentFile |
      Where-Object { $_ -match "^\s*WHATSAPP_LOCAL_AUTH_DIR\s*=" } |
      Select-Object -First 1

    if ($authSetting) {
      $configuredPath = ($authSetting -split "=", 2)[1].Trim().Trim('"').Trim("'")
      if ($configuredPath -and -not [System.IO.Path]::IsPathRooted($configuredPath)) {
        $configuredPath = Join-Path $projectDirectory $configuredPath
      }
      if ($configuredPath) {
        $authDataPath = [System.IO.Path]::GetFullPath($configuredPath)
      }
    }
  }

  $authProfilePath = [regex]::Escape(
    (Join-Path $authDataPath "session-loto-appointments-v2")
  )
  $allProcesses = @(Get-CimInstance Win32_Process)
  $browserProcesses = @(
    $allProcesses | Where-Object {
      $_.Name -ieq "chrome.exe" -and
      $_.CommandLine -match "--user-data-dir=$authProfilePath(?:\s|$)"
    }
  )

  $browserProcessIds = [System.Collections.Generic.HashSet[int]]::new()
  foreach ($browserProcess in $browserProcesses) {
    [void]$browserProcessIds.Add([int]$browserProcess.ProcessId)
  }

  $addedBrowserProcess = $true
  while ($addedBrowserProcess) {
    $addedBrowserProcess = $false
    foreach ($process in $allProcesses) {
      if (
        $process.Name -match "^(chrome|chrome_crashpad_handler)\.exe$" -and
        $browserProcessIds.Contains([int]$process.ParentProcessId) -and
        $browserProcessIds.Add([int]$process.ProcessId)
      ) {
        $addedBrowserProcess = $true
      }
    }
  }

  foreach ($processId in $browserProcessIds) {
    $process = $allProcesses | Where-Object ProcessId -eq $processId
    $processes += $process
  }

  $processes = $processes | Sort-Object {
    if ($_.CommandLine -match "server\.js") {
      0
    } elseif ($_.CommandLine -match "run-with-logs\.js") {
      1
    } elseif ($_.Name -ieq "wscript.exe") {
      3
    } else {
      2
    }
  }

  foreach ($process in $processes) {
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }

  $deadline = (Get-Date).AddSeconds(20)
  do {
    Start-Sleep -Milliseconds 500
    $allProcesses = @(Get-CimInstance Win32_Process)
    $remainingProcesses = $allProcesses | Where-Object {
      $_.CommandLine -match $servicePath -and (
        ($_.Name -ieq "wscript.exe" -and $_.CommandLine -match "run-hidden-service\.vbs") -or
        ($_.Name -ieq "node.exe" -and $_.CommandLine -match "run-with-logs\.js|server\.js")
      )
    }

    $remainingBrowserRoot = $allProcesses | Where-Object {
      $_.Name -ieq "chrome.exe" -and
      $_.CommandLine -match "--user-data-dir=$authProfilePath(?:\s|$)"
    }
  } while ($remainingProcesses -and (Get-Date) -lt $deadline)

  if ($remainingProcesses -or $remainingBrowserRoot) {
    $remainingIds = @(
      $remainingProcesses | ForEach-Object ProcessId
      $remainingBrowserRoot | ForEach-Object ProcessId
    ) -join ", "
    throw "Quedaron procesos antiguos del servicio en ejecución: $remainingIds."
  }

  $portDeadline = (Get-Date).AddSeconds(20)
  do {
    $portListeners = Get-NetTCPConnection `
      -State Listen `
      -LocalPort 10000 `
      -ErrorAction SilentlyContinue
    if (-not $portListeners) {
      break
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $portDeadline)

  if ($portListeners) {
    throw "El puerto 10000 sigue ocupado por otro proceso."
  }

  Unregister-ScheduledTask `
    -TaskName $serviceTaskName `
    -Confirm:$false `
    -ErrorAction SilentlyContinue

  $windowsScriptHost = Join-Path $env:SystemRoot "System32\wscript.exe"
  $hiddenRunner = Join-Path $PSScriptRoot "run-hidden-service.vbs"
  $action = New-ScheduledTaskAction `
    -Execute $windowsScriptHost `
    -Argument "//B //NoLogo `"$hiddenRunner`"" `
    -WorkingDirectory $projectDirectory
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
    -TaskName $serviceTaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Description "Inicia Loto y el servicio de notificaciones WhatsApp al iniciar sesión." `
    -Force | Out-Null

  Start-ScheduledTask -TaskName $serviceTaskName

  $healthDeadline = (Get-Date).AddSeconds(30)
  $serviceIsHealthy = $false
  while ((Get-Date) -lt $healthDeadline) {
    Start-Sleep -Seconds 2
    try {
      $health = Invoke-RestMethod `
        -Uri "http://127.0.0.1:10000/healthz" `
        -TimeoutSec 2
      $listener = Get-NetTCPConnection `
        -State Listen `
        -LocalPort 10000 `
        -ErrorAction SilentlyContinue |
        Select-Object -First 1
      $listenerProcess = if ($listener) {
        Get-CimInstance Win32_Process `
          -Filter "ProcessId = $($listener.OwningProcess)"
      }

      if (
        $health.ok -and
        $listenerProcess.CommandLine -match "$servicePath.*server\.js"
      ) {
        $serviceIsHealthy = $true
        break
      }
    } catch {
      continue
    }
  }

  if (-not $serviceIsHealthy) {
    throw "El servicio local no respondió después de reiniciarlo."
  }

  Write-RecoveryLog "Servicio de WhatsApp reiniciado y disponible después de iniciar sesión o desbloquear Windows."
}
catch {
  Write-RecoveryLog "No se pudo recuperar el servicio de WhatsApp: $($_.Exception.Message)"
  throw
}
