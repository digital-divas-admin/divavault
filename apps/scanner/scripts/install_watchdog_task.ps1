# Install Scanner Watchdog as a Windows Scheduled Task
# MUST be run as Administrator (right-click → Run as Administrator, or elevated terminal)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install_watchdog_task.ps1

$ErrorActionPreference = "Stop"

$TaskName = "ConsentedAI Scanner Watchdog"
$ScannerRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ScriptPath = Join-Path $ScannerRoot "scripts\watchdog.ps1"

# Verify the watchdog script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERROR: watchdog.ps1 not found at $ScriptPath" -ForegroundColor Red
    exit 1
}

Write-Host "Installing scheduled task: $TaskName" -ForegroundColor Cyan
Write-Host "Scanner root: $ScannerRoot"
Write-Host "Script: $ScriptPath"
Write-Host ""

# Build the task components
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptPath`"" `
    -WorkingDirectory $ScannerRoot

# Two triggers: at startup + repeating every 5 minutes indefinitely
$triggerStartup = New-ScheduledTaskTrigger -AtStartup
$triggerRepeat = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 9999)

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# Register (or replace) the task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger @($triggerStartup, $triggerRepeat) `
    -Principal $principal `
    -Settings $settings `
    -Force

Write-Host ""
Write-Host "Scheduled task '$TaskName' installed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Details:" -ForegroundColor Cyan
Write-Host "  - Triggers: At startup + every 5 minutes"
Write-Host "  - Runs as: $env:USERNAME (highest privileges)"
Write-Host "  - Execution time limit: 2 minutes"
Write-Host "  - Multiple instances: ignored (prevents overlap)"
Write-Host "  - StartWhenAvailable: yes (catches up after sleep/wake)"
Write-Host "  - Runs on battery power"
Write-Host ""
Write-Host "Manage with:" -ForegroundColor Cyan
Write-Host "  Start now:  schtasks /run /tn `"$TaskName`""
Write-Host "  Stop:       schtasks /end /tn `"$TaskName`""
Write-Host "  Status:     schtasks /query /tn `"$TaskName`" /v"
Write-Host "  Remove:     schtasks /delete /tn `"$TaskName`" /f"
Write-Host ""
Write-Host "The watchdog checks scanner health every 5 min and restarts the supervisor if needed." -ForegroundColor Yellow
Write-Host "Logs go to: $ScannerRoot\logs\watchdog.log" -ForegroundColor Yellow
