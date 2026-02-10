#!/bin/bash
set -e

BACKEND_URL="${BACKEND_URL:-http://localhost:5001}"
WEBAPP_URL="${WEBAPP_URL:-http://localhost:8080}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[-]${NC} $1"; }

measure_latency() {
    local total=0
    local count=5
    for i in $(seq 1 $count); do
        latency=$(curl -s "$WEBAPP_URL/ping-redis" | jq -r '.latency_ms')
        total=$(echo "$total + $latency" | bc)
        sleep 0.2
    done
    echo "scale=2; $total / $count" | bc
}

log "=== GeoD External Chaos Test ==="
echo ""

log "1. Getting agents..."
AGENTS=$(curl -s "$BACKEND_URL/api/agents")
AGENT=$(echo "$AGENTS" | jq -r '.[-1].hostname')
log "   Using agent: $AGENT"

log "2. Baseline latency (webapp → redis)..."
BASELINE=$(measure_latency)
log "   Baseline: ${BASELINE}ms"

log "3. Getting webapp container ID..."
WEBAPP_ID=$(docker ps --filter "name=demo-webapp" --format "{{.ID}}")
log "   Container: $WEBAPP_ID"

log "4. Injecting 200ms latency..."
curl -s -X POST "$BACKEND_URL/api/chaos/external/$AGENT" \
  -H "Content-Type: application/json" \
  -d "{\"container_id\": \"$WEBAPP_ID\", \"rules\": [{\"effects\": {\"latency\": \"200ms\"}}]}" | jq .

sleep 2

log "5. Measuring latency with chaos..."
CHAOS=$(measure_latency)
log "   With chaos: ${CHAOS}ms"

DIFF=$(echo "$CHAOS - $BASELINE" | bc)
log "   Added latency: ${DIFF}ms"

log "6. Clearing chaos..."
curl -s -X DELETE "$BACKEND_URL/api/chaos/external/$AGENT/$WEBAPP_ID" | jq .

sleep 1

log "7. Measuring latency after cleanup..."
AFTER=$(measure_latency)
log "   After cleanup: ${AFTER}ms"

echo ""
log "=== Summary ==="
echo "   Baseline:    ${BASELINE}ms"
echo "   With chaos:  ${CHAOS}ms (+${DIFF}ms)"
echo "   After clean: ${AFTER}ms"

if (( $(echo "$DIFF > 150" | bc -l) )); then
    log "Chaos injection successful!"
else
    warn "Latency increase lower than expected"
fi
