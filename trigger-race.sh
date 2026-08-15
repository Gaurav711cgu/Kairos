#!/usr/bin/env bash
# trigger-race.sh — Fire two concurrent orders to trigger the ghost order race condition
# Usage: ./trigger-race.sh [ORDER_SERVICE_URL]

set -euo pipefail

ORDER_URL=${1:-http://localhost:8080}
PRODUCT_ID="PRODUCT_X"

echo "=== Distributed State Time Machine — Race Trigger ==="
echo "Order service: $ORDER_URL"
echo ""

# Reset inventory to stock=1 before each run
echo "[1/3] Resetting inventory to stock=1..."
docker compose exec -T postgres \
    psql -U postgres -d demo -c \
    "UPDATE inventory SET stock = 1 WHERE product_id = 'PRODUCT_X';" 2>/dev/null \
    || psql "${POSTGRES_URL:-postgresql://postgres:postgres@localhost:5432/demo}" -c \
       "UPDATE inventory SET stock = 1 WHERE product_id = 'PRODUCT_X';" 2>/dev/null \
    || echo "  (Could not reset — ensure Postgres is running)"

echo "[2/3] Firing two concurrent orders..."

RESP_A=$(curl -s -w "\n%{http_code}" -X POST "$ORDER_URL/orders" \
    -H "Content-Type: application/json" \
    -d "{\"productId\":\"$PRODUCT_ID\",\"userId\":\"user-alice\"}" &)

RESP_B=$(curl -s -w "\n%{http_code}" -X POST "$ORDER_URL/orders" \
    -H "Content-Type: application/json" \
    -d "{\"productId\":\"$PRODUCT_ID\",\"userId\":\"user-bob\"}" &)

wait

echo ""
echo "Response A (user-alice): $RESP_A"
echo "Response B (user-bob):   $RESP_B"
echo ""
echo "[3/3] Checking for ghost order (both should have 'CREATED' status)..."

STOCK=$(psql "${POSTGRES_URL:-postgresql://postgres:postgres@localhost:5432/demo}" -t -c \
    "SELECT stock FROM inventory WHERE product_id = 'PRODUCT_X';" 2>/dev/null \
    || docker compose exec -T postgres psql -U postgres -d demo -t -c \
       "SELECT stock FROM inventory WHERE product_id = 'PRODUCT_X';" 2>/dev/null \
    || echo "unknown")

echo "Final inventory stock: $(echo $STOCK | xargs)"

if echo "$STOCK" | grep -q -- "-1\|-2"; then
    echo ""
    echo "[!] RACE CONDITION TRIGGERED! Ghost order created — stock went negative!"
    echo "   → Open the dashboard and click 'New Replay' to see the causal timeline."
elif echo "$STOCK" | grep -q "^0"; then
    echo ""
    echo "[OK] No ghost order (stock=0, one order won). Try again — race is ~80% trigger rate."
else
    echo ""
    echo "Stock: $STOCK — check service logs for details."
fi
