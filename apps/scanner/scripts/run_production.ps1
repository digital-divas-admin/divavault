# Scanner Production Supervisor
# Runs the scanner + cloudflared tunnel in a loop, restarts on crash, captures logs, rotates old logs.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/run_production.ps1

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScannerRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ScannerRoot "logs"
$PidFile = Join-Path $LogDir "scanner.pid"
$SupervisorLog = Join-Path $LogDir "supervisor.log"
$PythonExe = Join-Path $ScannerRoot ".venv\Scripts\python.exe"
$CloudflaredExe = "C:\Users\alexi\cloudflared.exe"
$TunnelName = "scanner"
$TunnelHealthUrl = "https://scanner.consentedai.com/health"
$MaxLogFiles = 7
$RestartDelaySec = 30
$MonitorIntervalSec = 60

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

# --- Tunnel management ---

$script:tunnelProcess = $null

function Start-Tunnel {
    if (-not (Test-Path $CloudflaredExe)) {
        Write-SupervisorLog "WARNING: cloudflared not found at $CloudflaredExe — tunnel disabled"
        return
    }

    $tunnelLog = Join-Path $LogDir "tunnel.log"
    $tunnelArgs = @{
        FilePath               = $CloudflaredExe
        ArgumentList           = "tunnel", "run", $TunnelName
        RedirectStandardOutput = $tunnelLog
        RedirectStandardError  = $tunnelLog
        PassThru               = $true
        NoNewWindow            = $true
    }
    $script:tunnelProcess = Start-Process @tunnelArgs
    Write-SupervisorLog "Tunnel started with PID $($script:tunnelProcess.Id)"
}

function Stop-Tunnel {
    if ($script:tunnelProcess -and -not $script:tunnelProcess.HasExited) {
        Write-SupervisorLog "Stopping tunnel (PID $($script:tunnelProcess.Id))"
        try {
            Stop-Process -Id $script:tunnelProcess.Id -Force -ErrorAction SilentlyContinue
        } catch {
            # Process may have already exited
        }
        $script:tunnelProcess = $null
    }
}

function Test-TunnelHealth {
    # If cloudflared isn't installed, skip health check
    if (-not (Test-Path $CloudflaredExe)) {
        return $true
    }

    # Check if tunnel process is still alive
    if ($null -eq $script:tunnelProcess -or $script:tunnelProcess.HasExited) {
        Write-SupervisorLog "Tunnel process has exited"
        return $false
    }

    # Check localhost first — if scanner itself is down, don't blame the tunnel
    try {
        $local = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($local.StatusCode -ne 200) {
            return $true  # Scanner unhealthy, but not a tunnel issue
        }
    } catch {
        return $true  # Scanner unreachable locally — not a tunnel problem
    }

    # Scanner is healthy locally — verify the tunnel is routing correctly
    try {
        $response = Invoke-WebRequest -Uri $TunnelHealthUrl -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            return $true
        }
        Write-SupervisorLog "Tunnel health check returned status $($response.StatusCode)"
        return $false
    } catch {
        Write-SupervisorLog "Tunnel health check failed: $($_.Exception.Message)"
        return $false
    }
}

function Restart-Tunnel {
    Write-SupervisorLog "Restarting tunnel..."
    Stop-Tunnel
    Start-Sleep -Seconds 2
    Start-Tunnel
}

# --- Main ---

Write-SupervisorLog "=== Scanner supervisor starting ==="
Write-SupervisorLog "Scanner root: $ScannerRoot"
Write-SupervisorLog "Python: $PythonExe"
Write-SupervisorLog "Log dir: $LogDir"

# Verify python exists
if (-not (Test-Path $PythonExe)) {
    Write-SupervisorLog "ERROR: Python not found at $PythonExe"
    exit 1
}

# Start tunnel before entering the scanner loop
Start-Tunnel

try {
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

        # Active monitoring loop — check both scanner and tunnel every $MonitorIntervalSec
        while (-not $process.HasExited) {
            # Wait with periodic wake-ups to check tunnel health
            $process.WaitForExit($MonitorIntervalSec * 1000) | Out-Null

            if (-not $process.HasExited) {
                # Scanner is still running — check tunnel health
                if (-not (Test-TunnelHealth)) {
                    Restart-Tunnel
                }
            }
        }

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
} finally {
    # Clean up tunnel on supervisor exit
    Stop-Tunnel
    Write-SupervisorLog "=== Scanner supervisor stopped ==="
}
