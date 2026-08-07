$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcherPath = Join-Path $PSScriptRoot "start-desktop-app.ps1"
$iconPath = Join-Path $projectRoot "src\app\favicon.ico"
$runtimeBase = $env:LOCALAPPDATA
if ([string]::IsNullOrWhiteSpace($runtimeBase)) { $runtimeBase = $env:TEMP }
$runtimeRoot = Join-Path $runtimeBase "CodexUsageManager\launcher"
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null
$runtimePowerShell = Join-Path $runtimeRoot "launch.ps1"
$runtimeVbs = Join-Path $runtimeRoot "launch.vbs"
$runtimeIcon = Join-Path $runtimeRoot "favicon.ico"

$escapedLauncherPath = $launcherPath.Replace("'", "''")
$wrapperContent = "& '$escapedLauncherPath'`r`nexit `$LASTEXITCODE`r`n"
[System.IO.File]::WriteAllText($runtimePowerShell, $wrapperContent, [System.Text.UTF8Encoding]::new($true))
if (Test-Path -LiteralPath $iconPath) { Copy-Item -LiteralPath $iconPath -Destination $runtimeIcon -Force }

$powerShellPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$vbsContent = "CreateObject(`"WScript.Shell`").Run `"`"`"$powerShellPath`"`" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"`"$runtimePowerShell`"`"`", 0, False`r`n"
[System.IO.File]::WriteAllText($runtimeVbs, $vbsContent, [System.Text.Encoding]::ASCII)

$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Codex Usage Manager.lnk"

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\wscript.exe"
$shortcut.Arguments = "`"$runtimeVbs`""
$shortcut.WorkingDirectory = $runtimeRoot
$shortcut.Description = "Khởi động Codex Usage Manager local"
if (Test-Path -LiteralPath $runtimeIcon) { $shortcut.IconLocation = "$runtimeIcon,0" }
$shortcut.Save()

Write-Output "Đã tạo shortcut: $shortcutPath"
