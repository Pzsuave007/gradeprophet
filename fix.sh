#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Fix Scanner Upload + AI"
echo "============================================"

REPO="/home/gradeprophet"
PROD="/opt/gradeprophet/backend"
WEB="/home/flipcardsuni2/public_html"

echo ""
echo "[1/4] Backend..."
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models"
cp -f "$REPO/backend/server.py" "$PROD/"
cp -f "$REPO/backend/config.py" "$PROD/"
cp -f "$REPO/backend/database.py" "$PROD/"
cp -f "$REPO/backend/routers/"*.py "$PROD/routers/"
cp -f "$REPO/backend/utils/"*.py "$PROD/utils/"
cp -f "$REPO/backend/models/"*.py "$PROD/models/"
echo "  OK"

echo "[2/4] Frontend (pre-built)..."
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
echo "  JS: $(grep -o 'main\.[a-f0-9]*\.js' "$WEB/index.html")"

echo "[3/4] Dependencias backend..."
"$PROD/venv/bin/pip" install feedparser -q 2>/dev/null

echo "[4/4] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver $PROD/backend.log"

echo ""
echo "============================================"
echo "  LISTO! Abre flipslabengine.com con Ctrl+Shift+R"
echo "============================================"
