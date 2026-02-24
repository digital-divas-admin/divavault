# Scanner Production Supervisor
# Runs the scanner in a loop, restarts on crash, captures logs, rotates old logs.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/run_production.ps1

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScannerRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ScannerRoot "logs"
$PidFile = Join-Path $LogDir "scanner.pid"
$SupervisorLog = Join-Path $LogDir "supervisor.log"
$PythonExe = Join-Path $ScannerRoot ".venv\Scripts\python.exe"
$MaxLogFiles = 7
$RestartDelaySec = 30

# Ensure logs directory exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-SupervisorLog {
    param([string]$Message)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$ts] $Message" | Out-File -Append -FilePath $SupervisorLog -Encoding utf8
    Write-Host "[$ts] $Message"
}

function Remove-OldLogs {
    $logFiles = Get-ChildItem -Path $LogDir -Filter "scanner_*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending
    if ($logFiles.Count -gt $MaxLogFiles) {
        $logFiles | Select-Object -Skip $MaxLogFiles | ForEach-Object {
            Write-SupervisorLog "Rotating old log: $($_.Name)"
            Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
            # Also remove corresponding .err file if it exists
            $errFile = "$($_.FullName).err"
            if (Test-Path $errFile) {
                Remove-Item $errFile -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-SupervisorLog "=== Scanner supervisor starting ==="
Write-SupervisorLog "Scanner root: $ScannerRoot"
Write-SupervisorLog "Python: $PythonExe"
Write-SupervisorLog "Log dir: $LogDir"

# Verify python exists
if (-not (Test-Path $PythonExe)) {
    Write-SupervisorLog "ERROR: Python not found at $PythonExe"
    exit 1
}

while ($true) {
    # Rotate old logs before starting
    Remove-OldLogs

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $logFile = Join-Path $LogDir "scanner_$timestamp.log"
    $errFile = "$logFile.err"

    Write-SupervisorLog "Starting scanner, logging to scanner_$timestamp.log"

    # Start the scanner process
    $procArgs = @{
        FilePath               = $PythonExe
        ArgumentList           = "-m", "src.main"
        WorkingDirectory       = $ScannerRoot
        RedirectStandardOutput = $logFile
        RedirectStandardError  = $errFile
        PassThru               = $true
        NoNewWindow            = $true
    }
    $process = Start-Process @procArgs

    # Write PID file
    $process.Id | Out-File -FilePath $PidFile -Encoding ascii -Force
    Write-SupervisorLog "Scanner started with PID $($process.Id)"

    # Wait for the process to exit
    $process.WaitForExit()
    $exitCode = $process.ExitCode

    # Clean up PID file
    if (Test-Path $PidFile) {
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    # Merge stderr into main log if it has content
    if ((Test-Path $errFile) -and (Get-Item $errFile).Length -gt 0) {
        Add-Content -Path $logFile -Value "`n=== STDERR ===" -Encoding utf8
        Get-Content $errFile | Add-Content -Path $logFile -Encoding utf8
    }
    if (Test-Path $errFile) {
        Remove-Item $errFile -Force -ErrorAction SilentlyContinue
    }

    Write-SupervisorLog "Scanner exited with code $exitCode"

    # If exit code is 0, it was a clean shutdown (e.g. stop_scanner.ps1) — don't restart
    if ($exitCode -eq 0) {
        Write-SupervisorLog "Clean exit (code 0). Supervisor stopping."
        break
    }

    Write-SupervisorLog "Restarting in $RestartDelaySec seconds..."
    Start-Sleep -Seconds $RestartDelaySec
}

Write-SupervisorLog "=== Scanner supervisor stopped ==="
