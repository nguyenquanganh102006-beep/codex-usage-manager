$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$appUrl = "http://127.0.0.1:3000"
$healthUrl = "$appUrl/api/accounts"
$runtimeBase = $env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($runtimeBase)) { $runtimeBase = $env:TEMP }
$runtimeRoot = Join-Path $runtimeBase "CodexUsageManager"
$logRoot = Join-Path $runtimeRoot "logs"
New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
$launcherLog = Join-Path $logRoot "desktop-launcher.log"

function Write-LauncherLog([string]$message) {
  Add-Content -LiteralPath $launcherLog -Value "$(Get-Date -Format o) $message" -Encoding UTF8
}

function Show-LauncherError([string]$message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($message, "Codex Usage Manager", "OK", "Error") | Out-Null
}

function Test-AppReady {
  try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

try {
  Write-LauncherLog "Launcher started"
  if (-not (Test-AppReady)) {
    $npmPath = "C:\Program Files\nodejs\npm.cmd"
    if (-not (Test-Path -LiteralPath $npmPath)) {
      $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
      if ($null -eq $npmCommand) { throw "Không tìm thấy Node.js/npm. Hãy cài Node.js LTS trước." }
      $npmPath = $npmCommand.Source
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
      $install = Start-Process -FilePath $npmPath -ArgumentList @("install") -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
      if ($install.ExitCode -ne 0) { throw "npm install thất bại." }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ".env"))) {
      $setup = Start-Process -FilePath $npmPath -ArgumentList @("run", "setup") -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
      if ($setup.ExitCode -ne 0) { throw "npm run setup thất bại." }
    }

    $buildIdPath = Join-Path $projectRoot ".next\BUILD_ID"
    $needsBuild = -not (Test-Path -LiteralPath $buildIdPath)
    if (-not $needsBuild) {
      $buildTime = (Get-Item -LiteralPath $buildIdPath).LastWriteTimeUtc
      $sourceRoots = @((Join-Path $projectRoot "src"), (Join-Path $projectRoot "prisma"), (Join-Path $projectRoot "next.config.ts"), (Join-Path $projectRoot "package.json"))
      $newerSource = Get-ChildItem -LiteralPath $sourceRoots -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTimeUtc -gt $buildTime } | Select-Object -First 1
      $needsBuild = $null -ne $newerSource
    }
    if ($needsBuild) {
      $build = Start-Process -FilePath $npmPath -ArgumentList @("run", "build") -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
      if ($build.ExitCode -ne 0) { throw "Không thể build ứng dụng." }
    }

    $nodePath = Join-Path (Split-Path -Parent $npmPath) "node.exe"
    $nextCli = Join-Path $projectRoot "node_modules\next\dist\bin\next"
    if (-not (Test-Path -LiteralPath $nodePath)) { throw "Không tìm thấy node.exe." }
    if (-not (Test-Path -LiteralPath $nextCli)) { throw "Không tìm thấy Next.js CLI." }
    Start-Process -FilePath $nodePath -ArgumentList @("`"$nextCli`"", "start", "--hostname", "127.0.0.1") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot "server-output.log") -RedirectStandardError (Join-Path $logRoot "server-error.log") | Out-Null

    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
      Start-Sleep -Milliseconds 500
      if (Test-AppReady) { $ready = $true; break }
    }
    if (-not $ready) { throw "Server không khởi động được trong 30 giây. Hãy kiểm tra cổng 3000." }
  }

  if ($env:CODEX_USAGE_SKIP_BROWSER -ne "1") {
    Write-LauncherLog "Opening $appUrl"
    Start-Process $appUrl | Out-Null
  } else {
    Write-LauncherLog "Browser opening skipped for launcher test"
  }
} catch {
  Write-LauncherLog "ERROR: $($_.Exception.Message)"
  if ($env:CODEX_USAGE_SKIP_BROWSER -ne "1") { Show-LauncherError $_.Exception.Message }
  exit 1
}
