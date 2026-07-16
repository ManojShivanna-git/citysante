#!/usr/bin/env bash
#
# CitySante — restart all local dev services
# ---------------------------------------------------------------------------
# Restarts:
#   Web  — Backend API (5000), Admin (3001), Shop Owner Web (3002), Customer Web (3003)
#   Mobile — Customer Expo (8081), Rider Expo (8082), Shop Owner Expo (8083)
#
# Usage:
#   ./run.sh            # stop everything, then start all
#   ./run.sh web        # start web services only (no mobile)
#   ./run.sh mobile     # start mobile Expo servers only
#   ./run.sh stop       # stop everything
#
# Mobile apps run headless (no interactive QR). Connect via Expo Go:
#   exp://<YOUR_MAC_IP>:8081  ← Customer
#   exp://<YOUR_MAC_IP>:8082  ← Rider
#   exp://<YOUR_MAC_IP>:8083  ← Shop Owner
#
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

# All ports to clean up on stop
WEB_SERVICES=(
  "5000:backend"
  "3001:admin"
  "3002:shop-owner-web"
  "3003:customer-web"
)

MOBILE_SERVICES=(
  "8081:customer-mobile"
  "8082:rider-mobile"
  "8083:shop-owner-mobile"
)

ALL_SERVICES=("${WEB_SERVICES[@]}" "${MOBILE_SERVICES[@]}")

kill_port() {
  local PORT=$1
  local NAME=$2
  local PID
  PID=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "  - $NAME (port $PORT): killing PID $PID"
    kill -9 $PID 2>/dev/null || true
  else
    echo "  - $NAME (port $PORT): not running"
  fi
}

stop_all() {
  echo "Stopping all CitySante services..."
  for entry in "${ALL_SERVICES[@]}"; do
    kill_port "${entry%%:*}" "${entry##*:}"
  done
}

stop_web() {
  echo "Stopping web services..."
  for entry in "${WEB_SERVICES[@]}"; do
    kill_port "${entry%%:*}" "${entry##*:}"
  done
}

stop_mobile() {
  echo "Stopping mobile Expo servers..."
  for entry in "${MOBILE_SERVICES[@]}"; do
    kill_port "${entry%%:*}" "${entry##*:}"
  done
}

start_web() {
  echo ""
  echo "Starting web services..."

  (cd "$ROOT_DIR/backend" && nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &)
  echo "  ✓ Backend API          -> http://localhost:5000   (logs/backend.log)"

  (cd "$ROOT_DIR/web/admin" && nohup npm run dev > "$LOG_DIR/admin.log" 2>&1 &)
  echo "  ✓ Admin Panel          -> http://localhost:3001   (logs/admin.log)"

  (cd "$ROOT_DIR/web/shop-owner" && nohup npm run dev > "$LOG_DIR/shop-owner-web.log" 2>&1 &)
  echo "  ✓ Shop Owner Dashboard -> http://localhost:3002   (logs/shop-owner-web.log)"

  (cd "$ROOT_DIR/web/customer" && nohup npm run dev > "$LOG_DIR/customer-web.log" 2>&1 &)
  echo "  ✓ Customer Web App     -> http://localhost:3003   (logs/customer-web.log)"
}

start_mobile() {
  echo ""
  echo "Starting mobile Expo servers (headless — no QR code)..."

  (cd "$ROOT_DIR/mobile/customer" && nohup npx expo start --port 8081 --non-interactive > "$LOG_DIR/customer-mobile.log" 2>&1 &)
  echo "  ✓ Customer App  -> exp://<YOUR_IP>:8081   (logs/customer-mobile.log)"

  (cd "$ROOT_DIR/mobile/rider" && nohup npx expo start --port 8082 --non-interactive > "$LOG_DIR/rider-mobile.log" 2>&1 &)
  echo "  ✓ Rider App     -> exp://<YOUR_IP>:8082   (logs/rider-mobile.log)"

  (cd "$ROOT_DIR/mobile/shop-owner" && nohup npx expo start --port 8083 --non-interactive > "$LOG_DIR/shop-owner-mobile.log" 2>&1 &)
  echo "  ✓ Shop Owner App-> exp://<YOUR_IP>:8083   (logs/shop-owner-mobile.log)"

  # Detect local IP for convenience
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo "<YOUR_IP>")
  echo ""
  echo "  Your IP: $LOCAL_IP"
  echo "  In Expo Go → Enter URL manually:"
  echo "    Customer:   exp://$LOCAL_IP:8081"
  echo "    Rider:      exp://$LOCAL_IP:8082"
  echo "    Shop Owner: exp://$LOCAL_IP:8083"
}

case "$1" in
  stop)
    stop_all
    ;;
  web)
    stop_web
    sleep 1
    start_web
    echo ""
    echo "Give it 3-5 seconds, then verify: curl http://localhost:5000/health"
    echo "Logs: $LOG_DIR/"
    ;;
  mobile)
    stop_mobile
    sleep 1
    start_mobile
    echo ""
    echo "Give it 10-15 seconds for Metro bundlers to start."
    echo "Logs: $LOG_DIR/"
    ;;
  *)
    stop_all
    sleep 1
    start_web
    start_mobile
    echo ""
    echo "Give it 5-10 seconds to boot. Verify: curl http://localhost:5000/health"
    echo "Logs: $LOG_DIR/"
    ;;
esac
