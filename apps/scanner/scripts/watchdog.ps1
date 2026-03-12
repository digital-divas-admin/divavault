# Scanner Watchdog
# Lightweight health check that runs every 5 minutes via scheduled task.
# Detects when the supervisor or scanner has died and restarts the supervisor.
# Respects the stop_requested sentinel file (deliberate shutdown).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/watchdog.ps1

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScannerRoot = Split-Path -Parent $ScriptDir
$LogDir = Join-Path $ScannerRoot "logs"
$StopFile = Join-Path $LogDir "stop_requested"
$SupervisorPidFile = Join-Path $LogDir "supervisor.pid"
$HeartbeatFile = Join-Path $LogDir "heartbeat.json"
$WatchdogLog = Join-Path $LogDir "watchdog.log"
$FailureMarker = Join-Path $LogDir "watchdog_failures"
$SupervisorScript = Join-Path $ScriptDir "run_production.ps1"
$HealthUrl = "http://localhost:8000/health"

$HealthTimeoutSec = 10
$HeartbeatStaleSec = 300  # 5 minutes
$EscalationThreshold = 3  # consecutive failures before killing supervisor
$MaxLogBytes = 1048576    # 1 MB log rotation
$OkLogIntervalSec = 3600  # log "OK" once per hour

# Ensure logs directory exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Write-WatchdogLog {
    param([string]$Message, [switch]$Alert)

    # Rotate log if too large
    if ((Test-Path $WatchdogLog) -and (Get-Item $WatchdogLog).Length -gt $MaxLogBytes) {
        $rotated = "$WatchdogLog.old"
        if (Test-Path $rotated) { Remove-Item $rotated -Force -ErrorAction SilentlyContinue }
        Rename-Item $WatchdogLog $rotated -Force -ErrorAction SilentlyContinue
    }

    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $prefix = if ($Alert) { "ALERT" } else { "INFO" }
    "[$ts] [$prefix] $Message" | Out-File -Append -FilePath $WatchdogLog -Encoding utf8
}

function Get-FailureCount {
    if (Test-Path $FailureMarker) {
        $content = (Get-Content $FailureMarker -Raw -ErrorAction SilentlyContinue)
        if ($content) {
            $val = 0
            if ([int]::TryParse($content.Trim(), [ref]$val)) { return $val }
        }
    }
    return 0
}

function Set-FailureCount {
    param([int]$Count)
    $Count | Out-File -FilePath $FailureMarker -Encoding ascii -Force
}

function Test-ScannerHealth {
    # 1. HTTP health check
    try {
        $response = Invoke-WebRequest -Uri $HealthUrl -TimeoutSec $HealthTimeoutSec -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            return $true
        }
    } catch {
        # Health endpoint unreachable
    }

    # 2. Heartbeat freshness check (if the scheduler is running but HTTP is down)
    if (Test-Path $HeartbeatFile) {
        $lastWrite = (Get-Item $HeartbeatFile).LastWriteTime
        $ageSec = (New-TimeSpan -Start $lastWrite -End (Get-Date)).TotalSeconds
        if ($ageSec -lt $HeartbeatStaleSec) {
            # Heartbeat is fresh - scanner is alive but HTTP may be starting up
            return $true
        }
    }

    return $false
}

function Test-SupervisorAlive {
    if (-not (Test-Path $SupervisorPidFile)) {
        return $false
    }
    $spid = (Get-Content $SupervisorPidFile -Raw -ErrorAction SilentlyContinue)
    if (-not $spid) { return $false }
    $spid = $spid.Trim()
    $proc = Get-Process -Id $spid -ErrorAction SilentlyContinue
    return ($null -ne $proc)
}

function Start-Supervisor {
    Write-WatchdogLog "Starting supervisor: $SupervisorScript" -Alert
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", "`"$SupervisorScript`"" `
        -WorkingDirectory $ScannerRoot `
        -WindowStyle Hidden
}

# --- Main ---

# 1. Respect deliberate shutdown
if (Test-Path $StopFile) {
    # Don't log every 5 minutes - too noisy. Only log if there were prior failures.
    $fc = Get-FailureCount
    if ($fc -gt 0) {
        Write-WatchdogLog "Stop file present - deliberate shutdown. Clearing failure count: $fc." -Alert
        Set-FailureCount 0
    }
    exit 0
}

# 2. Check scanner health
$healthy = Test-ScannerHealth

if ($healthy) {
    # Reset failure counter
    $fc = Get-FailureCount
    if ($fc -gt 0) {
        Write-WatchdogLog "Scanner recovered after $fc consecutive failures."
        Set-FailureCount 0
    }

    # Log "OK" at most once per hour to avoid log spam
    $lastOk = Join-Path $LogDir "watchdog_last_ok"
    $shouldLog = $true
    if (Test-Path $lastOk) {
        $lastOkTime = (Get-Item $lastOk).LastWriteTime
        $elapsed = (New-TimeSpan -Start $lastOkTime -End (Get-Date)).TotalSeconds
        if ($elapsed -lt $OkLogIntervalSec) { $shouldLog = $false }
    }
    if ($shouldLog) {
        Write-WatchdogLog "Scanner healthy."
        Get-Date | Out-File -FilePath $lastOk -Encoding ascii -Force
    }
    exit 0
}

# 3. Scanner is unhealthy - escalation ladder
$failures = (Get-FailureCount) + 1
Set-FailureCount $failures
$supervisorAlive = Test-SupervisorAlive

$msg = "Scanner unhealthy - consecutive failure $failures, supervisor alive: $supervisorAlive"
Write-WatchdogLog $msg -Alert

if ($supervisorAlive) {
    if ($failures -lt $EscalationThreshold) {
        # Give the supervisor time to self-heal (it restarts scanner after 30s)
        Write-WatchdogLog "Supervisor is running - waiting for self-heal. Failure $failures of $EscalationThreshold before escalation."
        exit 0
    }

    # Supervisor has had enough chances - kill it and restart
    Write-WatchdogLog "Supervisor failed to recover after $failures checks. Killing and restarting." -Alert
    $spid = (Get-Content $SupervisorPidFile -Raw).Trim()
    # Kill the supervisor and all its children (scanner, cloudflared)
    taskkill /PID $spid /T /F 2>$null
    Start-Sleep -Seconds 3
    # Clean up PID files
    Remove-Item $SupervisorPidFile -Force -ErrorAction SilentlyContinue
    $scannerPid = Join-Path $LogDir "scanner.pid"
    if (Test-Path $scannerPid) { Remove-Item $scannerPid -Force -ErrorAction SilentlyContinue }
} else {
    Write-WatchdogLog "Supervisor is dead. Restarting immediately." -Alert
}

# Start a fresh supervisor
Start-Supervisor
Set-FailureCount 0
Write-WatchdogLog "Supervisor restart initiated."
