# Scanner Health Check
# Hits the /health endpoint and displays status, uptime, GPU, and scheduler info.
# Usage: powershell -ExecutionPolicy Bypass -File scripts/check_health.ps1
# Exit code: 0 = healthy, 1 = unreachable/error

$ErrorActionPreference = "Continue"
$HealthUrl = "http://localhost:8000/health"

try {
    $response = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
} catch {
    Write-Host "UNHEALTHY: Scanner unreachable at $HealthUrl" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor DarkRed
    exit 1
}

# Status
$status = $response.status
if ($status -eq "running") {
    Write-Host "Status: $status" -ForegroundColor Green
} else {
    Write-Host "Status: $status" -ForegroundColor Yellow
}

# Uptime
$uptimeSec = [math]::Round($response.uptime_seconds)
$hours = [math]::Floor($uptimeSec / 3600)
$mins = [math]::Floor(($uptimeSec % 3600) / 60)
$secs = $uptimeSec % 60
Write-Host "Uptime: ${hours}h ${mins}m ${secs}s"

# Compute / GPU
$compute = $response.compute
Write-Host ""
Write-Host "--- Compute ---"
Write-Host "GPU Available: $($compute.gpu_available)"
Write-Host "Execution Provider: $($compute.execution_provider)"
Write-Host "Model: $($compute.model)"

# Scanner metrics
$metrics = $response.metrics
if ($metrics -and -not $metrics.error) {
    Write-Host ""
    Write-Host "--- Scanner Metrics ---"
    $metrics.PSObject.Properties | ForEach-Object {
        Write-Host "$($_.Name): $($_.Value)"
    }
} elseif ($metrics.error) {
    Write-Host ""
    Write-Host "Metrics Error: $($metrics.error)" -ForegroundColor Yellow
}

# ML metrics
$ml = $response.ml
if ($ml -and -not $ml.error) {
    Write-Host ""
    Write-Host "--- ML Intelligence ---"
    Write-Host "Observer Buffer: $($ml.observer_buffer_size)"
    if ($ml.analyzers) {
        $ml.analyzers.PSObject.Properties | ForEach-Object {
            $a = $_.Value
            Write-Host "  $($_.Name): $($a.status) ($($a.signals)/$($a.minimum) signals)"
        }
    }
} elseif ($ml.error) {
    Write-Host ""
    Write-Host "ML Error: $($ml.error)" -ForegroundColor Yellow
}

# Test users
$testUsers = $response.test_users
if ($testUsers -and -not $testUsers.error) {
    Write-Host ""
    Write-Host "--- Test Users ---"
    $testUsers.PSObject.Properties | ForEach-Object {
        Write-Host "$($_.Name): $($_.Value)"
    }
}

# PID file check
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path (Split-Path -Parent $ScriptDir) "logs\scanner.pid"
if (Test-Path $PidFile) {
    $scannerPid = (Get-Content $PidFile -Raw).Trim()
    $proc = Get-Process -Id $scannerPid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host ""
        Write-Host "Process: PID $scannerPid (running)" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Process: PID $scannerPid (stale PID file)" -ForegroundColor Yellow
    }
}

Write-Host ""
exit 0
