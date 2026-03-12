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
    Write-Log "No PID file found at $PidFile - scanner may not be running."

    # Try to find the process anyway
    $procs = Get-Process -Name "python" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*src.main*" }
    if ($procs) {
        Write-Log "Found scanner process(es) by name: $($procs.Id -join ', ')"
    } else {
        Write-Log "No scanner process found. Nothing to stop."
        exit 0
    }
    $scannerPid = $procs[0].Id
} else {
    $scannerPid = (Get-Content $PidFile -Raw).Trim()
    Write-Log "Read PID $scannerPid from $PidFile"
}

# Check if process is running
$process = Get-Process -Id $scannerPid -ErrorAction SilentlyContinue
if (-not $process) {
    Write-Log "Process $scannerPid is not running. Cleaning up PID file."
    if (Test-Path $PidFile) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    exit 0
}

Write-Log "Sending stop signal to scanner (PID $scannerPid)..."

# Create sentinel file so the supervisor knows this is a deliberate shutdown
$StopFile = Join-Path $LogDir "stop_requested"
Get-Date -Format "yyyy-MM-dd HH:mm:ss" | Out-File -FilePath $StopFile -Encoding utf8 -Force
Write-Log "Created stop sentinel file: $StopFile"

# Send Ctrl+C via GenerateConsoleCtrlEvent (graceful shutdown for uvicorn)
# taskkill without /F sends WM_CLOSE which triggers graceful shutdown
taskkill /PID $scannerPid /T 2>$null

# Wait for graceful exit
$elapsed = 0
$checkInterval = 2
while ($elapsed -lt $GracefulTimeoutSec) {
    Start-Sleep -Seconds $checkInterval
    $elapsed += $checkInterval

    $process = Get-Process -Id $scannerPid -ErrorAction SilentlyContinue
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
taskkill /PID $scannerPid /T /F 2>$null
Start-Sleep -Seconds 2

$process = Get-Process -Id $scannerPid -ErrorAction SilentlyContinue
if ($process) {
    Write-Log "ERROR: Failed to kill process $scannerPid"
    exit 1
} else {
    Write-Log "Scanner force-killed successfully."
}

# Clean up PID file
if (Test-Path $PidFile) {
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

# Also stop any cloudflared tunnel processes
$cfProcs = Get-Process -Name "cloudflared" -ErrorAction SilentlyContinue
if ($cfProcs) {
    Write-Log "Stopping cloudflared processes: $($cfProcs.Id -join ', ')"
    $cfProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Log "Cloudflared stopped."
} else {
    Write-Log "No cloudflared processes found."
}

exit 0
