# Install Scanner as a Windows Scheduled Task
# MUST be run as Administrator (right-click → Run as Administrator, or elevated terminal)
# Usage: powershell -ExecutionPolicy Bypass -File scripts/install_scheduled_task.ps1

$ErrorActionPreference = "Stop"

$TaskName = "ConsentedAI Scanner"
$ScannerRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$ScriptPath = Join-Path $ScannerRoot "scripts\run_production.ps1"

# Verify the production script exists
if (-not (Test-Path $ScriptPath)) {
    Write-Host "ERROR: run_production.ps1 not found at $ScriptPath" -ForegroundColor Red
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

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 0)  # No time limit (runs indefinitely)

# Register (or replace) the task
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force

Write-Host ""
Write-Host "Scheduled task '$TaskName' installed successfully." -ForegroundColor Green
Write-Host ""
Write-Host "Details:" -ForegroundColor Cyan
Write-Host "  - Trigger: At system startup"
Write-Host "  - Runs as: $env:USERNAME (highest privileges)"
Write-Host "  - No time limit (runs indefinitely)"
Write-Host "  - Auto-restart on failure (3 retries, 1 min apart)"
Write-Host "  - Runs on battery power"
Write-Host ""
Write-Host "Manage with:" -ForegroundColor Cyan
Write-Host "  Start now:  schtasks /run /tn `"$TaskName`""
Write-Host "  Stop:       schtasks /end /tn `"$TaskName`""
Write-Host "  Status:     schtasks /query /tn `"$TaskName`" /v"
Write-Host "  Remove:     schtasks /delete /tn `"$TaskName`" /f"
Write-Host ""
Write-Host "The task manages both the scanner process AND the Cloudflare tunnel." -ForegroundColor Yellow
Write-Host "Logs go to: $ScannerRoot\logs\" -ForegroundColor Yellow
