#!/usr/bin/env bash
#
# CitySante — start/stop backend + shop-owner dashboard only
# Usage:
#   ./shop.sh          # start backend (5000) + shop-owner (3002)
#   ./shop.sh stop     # stop both
#
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

PORTS=(5000 3002)

stop_all() {
  echo "Stopping backend + shop-owner..."
  for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
    if [ -n "$PID" ]; then
      echo "  - port $PORT: killing PID $PID"
      kill -9 $PID 2>/dev/null || true
    fi
  done
}

if [ "$1" = "stop" ]; then
  stop_all
  exit 0
fi

stop_all
sleep 1

echo ""
echo "Starting backend + shop-owner..."

(cd "$ROOT_DIR/backend"        && nohup npm run dev > "$LOG_DIR/backend.log"    2>&1 &)
echo "  ✅ Backend API          -> http://localhost:5000   (logs/backend.log)"

(cd "$ROOT_DIR/web/shop-owner" && nohup npm run dev > "$LOG_DIR/shop-owner.log" 2>&1 &)
echo "  ✅ Shop Owner Dashboard -> http://localhost:3002   (logs/shop-owner.log)"

echo ""
echo "Ready in 3-5 seconds. Login: shopowner@greenfresh.com / password123"
echo ""
