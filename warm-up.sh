#!/usr/bin/env bash
# warm-up.sh — Poll all services until healthy (for demos / CI)

set -euo pipefail

SERVICES=(
    "order-service|http://localhost:8080/orders/health"
    "payment-service|http://localhost:8083/health"
    "inventory-service|http://localhost:8082/health"
    "orchestrator|http://localhost:8090/actuator/health"
    "anomaly-detector|http://localhost:8091/health"
    "llm-analyzer|http://localhost:8092/health"
)

MAX_WAIT=120
INTERVAL=3

echo "=== Warming up all services (max ${MAX_WAIT}s) ==="

for entry in "${SERVICES[@]}"; do
    NAME=$(echo "$entry" | cut -d'|' -f1)
    URL=$(echo "$entry" | cut -d'|' -f2)
    ELAPSED=0

    printf "Waiting for %-22s " "$NAME..."
    while true; do
        if curl -sf "$URL" --max-time 3 > /dev/null 2>&1; then
            echo "[UP] (${ELAPSED}s)"
            break
        fi
        if [ $ELAPSED -ge $MAX_WAIT ]; then
            echo "[TIMEOUT] after ${MAX_WAIT}s"
            exit 1
        fi
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
        printf "."
    done
done

echo ""
echo "[OK] All services healthy! Run ./trigger-race.sh to start the demo."
