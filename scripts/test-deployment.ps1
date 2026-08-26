# ==============================================================================
# AETHER-MESH: AUTOMATED DEPLOYMENT & END-TO-END SANITIZATION SCRIPT (POWERSHELL)
# ==============================================================================
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  🚀 INITIATING AETHER-MESH AUTONOMOUS END-TO-END VERIFICATION PIPELINE " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$baseDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $baseDir "backend"
$frontendDir = Join-Path $baseDir "frontend"

# Step 1: Execute Native Backend Unit & CRDT Convergence Test Suite
Write-Host "`n[PHASE 1/4] Running Backend Unit & SEC Convergence Tests..." -ForegroundColor Yellow
Push-Location $backendDir
try {
    npm test
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Backend unit test suite failed."
        exit 1
    }
} finally {
    Pop-Location
}

# Step 2: Validate Frontend Production Build
Write-Host "`n[PHASE 2/4] Verifying Frontend Production Build..." -ForegroundColor Yellow
Push-Location $frontendDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend compilation failed."
        exit 1
    }
} finally {
    Pop-Location
}

# Step 3: Launch Local Ingress Gateway in Background
Write-Host "`n[PHASE 3/4] Spinning Up Live Ingress Gateway Server on Port 8080..." -ForegroundColor Yellow
$serverProcess = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", "npm", "run", "dev" -WorkingDirectory $backendDir -PassThru -NoNewWindow
Start-Sleep -Seconds 4

# Step 4: Perform Live HTTP & Chaos Ingress Tests
Write-Host "`n[PHASE 4/4] Executing Live Gateway Ingress & Chaos API Probes..." -ForegroundColor Yellow

try {
    # 1. Health Probe
    $health = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/health" -Method Get -TimeoutSec 5
    Write-Host "  ✅ Health check returned status: $($health.status) ($($health.service))" -ForegroundColor Green

    # 2. Ingress Inference Dispatch via P2C Router
    $body = @{
        prompt = "Coordinate multi-agent consensus across global edge clusters."
        model = "gemini-3.7-flash-edge"
        maxTokens = 128
        sessionId = "session_live_e2e_test"
    } | ConvertTo-Json

    $headers = @{ "Content-Type" = "application/json" }
    $dispatch = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/inference/dispatch" -Method Post -Body $body -Headers $headers -TimeoutSec 5
    
    $decision = $dispatch.data.routingDecision
    Write-Host "  ✅ P2C Router selected node: $($decision.selectedNodeId) (Region: $($decision.targetRegion))" -ForegroundColor Green
    Write-Host "     Decision overhead: $($decision.decisionTimeMicros) µs | Tokens: $($dispatch.data.tokensGenerated) | Duration: $($dispatch.data.durationMs) ms" -ForegroundColor Gray

    # 3. CRDT State Mutation & Verification
    $mutateBody = @{
        sessionId = "session_live_e2e_test"
        nodeId = "node-us-east"
        action = "APPEND_CONTEXT"
        payload = @{ message = "Automated verification step 4 passed." }
    } | ConvertTo-Json

    $mutation = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/crdt/mutate" -Method Post -Body $mutateBody -Headers $headers -TimeoutSec 5
    Write-Host "  ✅ Delta-CRDT mutation applied. Vector clock: $($mutation.updatedSession.vectorClock | ConvertTo-Json -Compress)" -ForegroundColor Green

    # 4. Chaos Test: Split-Brain Partition & Self-Healing
    $partitionBody = @{ nodeIds = @("node-eu-west", "node-ap-south") } | ConvertTo-Json
    $partRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/mesh/chaos/partition" -Method Post -Body $partitionBody -Headers $headers -TimeoutSec 5
    Write-Host "  ✅ Chaos partition injected successfully: $($partRes.message)" -ForegroundColor Magenta

    $healRes = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/mesh/chaos/heal" -Method Post -Headers $headers -TimeoutSec 5
    Write-Host "  ✅ Mesh partition healed: $($healRes.repairedSessionsCount) sessions reconciled in $($healRes.convergenceTimeMs) ms" -ForegroundColor Green

    # 5. Prometheus Metrics Scrape Test
    $prom = Invoke-RestMethod -Uri "http://localhost:8080/api/v1/metrics/prometheus" -Method Get -TimeoutSec 5
    Write-Host "  ✅ Prometheus exposition endpoint verified ($($prom.Length) bytes scraped)" -ForegroundColor Green

    Write-Host "`n======================================================================" -ForegroundColor Green
    Write-Host "  🎉 ALL END-TO-END DEPLOYMENT SANITIZATION TESTS PASSED PERFECTLY!   " -ForegroundColor Green
    Write-Host "======================================================================" -ForegroundColor Green
}
finally {
    # Stop background server process and any child node processes on port 8080
    if ($serverProcess -and -not $serverProcess.HasExited) {
        Write-Host "`nTerminating background test server process..." -ForegroundColor Gray
        Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
    # Kill any lingering node process on port 8080 if present
    Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}
