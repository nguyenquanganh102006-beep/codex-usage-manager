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

function Invoke-Git([string[]]$Arguments) {
  $gitCommand = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($null -eq $gitCommand) { return @{ ExitCode = 127; Output = "git.exe not found" } }
  $previousPrompt = $env:GIT_TERMINAL_PROMPT
  $env:GIT_TERMINAL_PROMPT = "0"
  try {
    $output = & $gitCommand.Source -C $projectRoot @Arguments 2>&1
    return @{ ExitCode = $LASTEXITCODE; Output = ($output -join "`n").Trim() }
  } finally {
    $env:GIT_TERMINAL_PROMPT = $previousPrompt
  }
}

function Update-AppFromGitHub {
  if ($env:CODEX_USAGE_SKIP_UPDATE -eq "1") {
    Write-LauncherLog "Auto-update skipped by CODEX_USAGE_SKIP_UPDATE"
    return @{ Updated = $false; DependenciesChanged = $false }
  }
  if (-not (Test-Path -LiteralPath (Join-Path $projectRoot ".git"))) {
    Write-LauncherLog "Auto-update skipped: project is not a Git repository"
    return @{ Updated = $false; DependenciesChanged = $false }
  }

  $remote = Invoke-Git @("remote", "get-url", "origin")
  if ($remote.ExitCode -ne 0 -or $remote.Output.TrimEnd("/").TrimEnd(".git") -ne "https://github.com/nguyenquanganh102006-beep/codex-usage-manager") {
    Write-LauncherLog "Auto-update skipped: origin is missing or unexpected"
    return @{ Updated = $false; DependenciesChanged = $false }
  }
  $branch = Invoke-Git @("branch", "--show-current")
  if ($branch.ExitCode -ne 0 -or $branch.Output -ne "main") {
    Write-LauncherLog "Auto-update skipped: current branch is not main"
    return @{ Updated = $false; DependenciesChanged = $false }
  }
  $status = Invoke-Git @("status", "--porcelain", "--untracked-files=normal")
  if ($status.ExitCode -ne 0 -or -not [string]::IsNullOrWhiteSpace($status.Output)) {
    Write-LauncherLog "Auto-update skipped: local worktree has changes"
    return @{ Updated = $false; DependenciesChanged = $false }
  }

  Write-LauncherLog "Checking GitHub for updates"
  $fetch = Invoke-Git @("-c", "http.lowSpeedLimit=1", "-c", "http.lowSpeedTime=15", "fetch", "--quiet", "origin", "main")
  if ($fetch.ExitCode -ne 0) {
    Write-LauncherLog "Auto-update unavailable; continuing current version: $($fetch.Output)"
    return @{ Updated = $false; DependenciesChanged = $false }
  }
  $behind = Invoke-Git @("rev-list", "--count", "HEAD..origin/main")
  if ($behind.ExitCode -ne 0 -or [int]$behind.Output -eq 0) {
    Write-LauncherLog "Application is up to date"
    return @{ Updated = $false; DependenciesChanged = $false }
  }

  $oldLockHash = if (Test-Path -LiteralPath (Join-Path $projectRoot "package-lock.json")) { (Get-FileHash -LiteralPath (Join-Path $projectRoot "package-lock.json") -Algorithm SHA256).Hash } else { "" }
  $merge = Invoke-Git @("merge", "--ff-only", "origin/main")
  if ($merge.ExitCode -ne 0) {
    Write-LauncherLog "Auto-update could not fast-forward; continuing current version: $($merge.Output)"
    return @{ Updated = $false; DependenciesChanged = $false }
  }
  $newLockHash = if (Test-Path -LiteralPath (Join-Path $projectRoot "package-lock.json")) { (Get-FileHash -LiteralPath (Join-Path $projectRoot "package-lock.json") -Algorithm SHA256).Hash } else { "" }
  Write-LauncherLog "Application updated successfully"
  return @{ Updated = $true; DependenciesChanged = $oldLockHash -ne $newLockHash }
}

function Stop-RunningProjectServer {
  $connections = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
    if ($null -eq $process -or $process.Name -ne "node.exe" -or $process.CommandLine -notlike "*$projectRoot*") {
      throw "Cổng 3000 đang do ứng dụng khác sử dụng; không thể tự khởi động lại an toàn."
    }
    Stop-Process -Id $connection.OwningProcess -Force
    Write-LauncherLog "Stopped previous project server after update"
  }
}

try {
  Write-LauncherLog "Launcher started"
  $update = Update-AppFromGitHub
  if ($update.Updated -and (Test-AppReady)) { Stop-RunningProjectServer }
  if (-not (Test-AppReady)) {
    $npmPath = "C:\Program Files\nodejs\npm.cmd"
    if (-not (Test-Path -LiteralPath $npmPath)) {
      $npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
      if ($null -eq $npmCommand) { throw "Không tìm thấy Node.js/npm. Hãy cài Node.js LTS trước." }
      $npmPath = $npmCommand.Source
    }

    if ($update.DependenciesChanged -or -not (Test-Path -LiteralPath (Join-Path $projectRoot "node_modules"))) {
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
