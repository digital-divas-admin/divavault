# Scanner Graceful Shutdown
# Reads PID from logs/scanner.pid, sends stop signal, waits for clean exit.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/stop_scanner.ps1

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScannerRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ScannerRoot "logs"
$PidFile = Join-Path $LogDir "scanner.pid"
$GracefulTimeoutSec = 30

function Write-Log {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$ts] $Message"
}

# Check PID file exists
if (-not (Test-Path $PidFile)) {
    Write-Log "No PID file found at $PidFile — scanner may not be running."

    # Try to find the process anyway
    $procs = Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*src.main*" }
    if ($procs) {
        Write-Log "Found scanner process(es) by name: $($procs.Id -join ', ')"
    } else {
        Write-Log "No scanner process found. Nothing to stop."
        exit 0
    }
    $pid = $procs[0].Id
} else {
    $pid = (Get-Content $PidFile -Raw).Trim()
    Write-Log "Read PID $pid from $PidFile"
}

# Check if process is running
$process = Get-Process -Id $pid -ErrorAction SilentlyContinue
if (-not $process) {
    Write-Log "Process $pid is not running. Cleaning up PID file."
    if (Test-Path $PidFile) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    exit 0
}

Write-Log "Sending stop signal to scanner (PID $pid)..."

# Send Ctrl+C via GenerateConsoleCtrlEvent (graceful shutdown for uvicorn)
# taskkill without /F sends WM_CLOSE which triggers graceful shutdown
taskkill /PID $pid /T 2>$null

# Wait for graceful exit
$elapsed = 0
$checkInterval = 2
while ($elapsed -lt $GracefulTimeoutSec) {
    Start-Sleep -Seconds $checkInterval
    $elapsed += $checkInterval

    $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Log "Scanner stopped gracefully after ${elapsed}s."
        if (Test-Path $PidFile) {
            Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
        }
        exit 0
    }
    Write-Log "Still running... (${elapsed}s / ${GracefulTimeoutSec}s)"
}

# Force kill after timeout
Write-Log "Graceful shutdown timed out after ${GracefulTimeoutSec}s. Force killing..."
taskkill /PID $pid /T /F 2>$null
Start-Sleep -Seconds 2

$process = Get-Process -Id $pid -ErrorAction SilentlyContinue
if ($process) {
    Write-Log "ERROR: Failed to kill process $pid"
    exit 1
} else {
    Write-Log "Scanner force-killed successfully."
}

# Clean up PID file
if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

exit 0
