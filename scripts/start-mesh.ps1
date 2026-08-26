# ==============================================================================
# AETHER-MESH: INSTANT LAUNCH SCRIPT (POWERSHELL)
# ==============================================================================
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  ⚡ LAUNCHING AETHER-MESH PRODUCTION-READY WORKSPACE" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

$baseDir = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $baseDir "backend"
$frontendDir = Join-Path $baseDir "frontend"

Write-Host "`n[1/2] Starting Backend Ingress & Gossip Mesh Gateway on http://localhost:8080..." -ForegroundColor Yellow
$backendJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $backendDir -PassThru

Start-Sleep -Seconds 2

Write-Host "[2/2] Starting Vite Frontend Telemetry UI on http://localhost:5173..." -ForegroundColor Yellow
$frontendJob = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory $frontendDir -PassThru

Write-Host "`n🚀 AETHER-MESH is running!" -ForegroundColor Green
Write-Host "   💻 Web UI: http://localhost:5173" -ForegroundColor White
Write-Host "   🌐 API Gateway: http://localhost:8080" -ForegroundColor White
Write-Host "   📡 WebSocket Stream: ws://localhost:8080/ws/mesh" -ForegroundColor White
Write-Host "   📊 Prometheus Metrics: http://localhost:8080/api/v1/metrics/prometheus" -ForegroundColor White
Write-Host "`nPress Ctrl+C in this terminal or close windows to exit." -ForegroundColor Gray
