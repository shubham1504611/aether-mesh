#!/usr/bin/env bash
# ==============================================================================
# AETHER-MESH: POSIX BASH AUTOMATED DEPLOYMENT TEST SCRIPT
# ==============================================================================
set -e

echo -e "\033[0;36m======================================================================\033[0m"
echo -e "\033[0;36m  🚀 INITIATING AETHER-MESH AUTONOMOUS END-TO-END VERIFICATION PIPELINE \033[0m"
echo -e "\033[0;36m======================================================================\033[0m"

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo -e "\n\033[1;33m[PHASE 1/4] Running Backend Unit & SEC Convergence Tests...\033[0m"
cd "$BASE_DIR/backend"
npm test

echo -e "\n\033[1;33m[PHASE 2/4] Verifying Frontend Production Build...\033[0m"
cd "$BASE_DIR/frontend"
npm run build

echo -e "\n\033[1;33m[PHASE 3/4] Spinning Up Live Ingress Gateway Server on Port 8080...\033[0m"
cd "$BASE_DIR/backend"
npx tsx src/server.ts &
SERVER_PID=$!
sleep 3

cleanup() {
  echo -e "\nShutting down background test server (PID $SERVER_PID)..."
  kill $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

echo -e "\n\033[1;33m[PHASE 4/4] Executing Live Gateway Ingress & Chaos API Probes...\033[0m"

# Health Check
curl -s http://localhost:8080/api/v1/health | grep -q '"status":"UP"'
echo -e "\033[0;32m  ✅ Health check verified (Status: UP)\033[0m"

# Ingress Dispatch
curl -s -X POST http://localhost:8080/api/v1/inference/dispatch \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Evaluate multi-agent routing metrics","model":"gemini-3.7-flash-edge","sessionId":"session_posix_test"}' | grep -q '"success":true'
echo -e "\033[0;32m  ✅ P2C Router Inference Dispatch succeeded\033[0m"

# Prometheus metrics
curl -s http://localhost:8080/api/v1/metrics/prometheus | grep -q 'aether_mesh_requests_total'
echo -e "\033[0;32m  ✅ Prometheus exposition endpoint validated\033[0m"

echo -e "\n\033[0;32m======================================================================\033[0m"
echo -e "\033[0;32m  🎉 ALL END-TO-END DEPLOYMENT SANITIZATION TESTS PASSED PERFECTLY!   \033[0m"
echo -e "\033[0;32m======================================================================\033[0m"
