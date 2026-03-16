#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Fix All Issues"
echo "============================================"

REPO="/home/gradeprophet"
PROD="/opt/gradeprophet/backend"
WEB="/home/flipcardsuni2/public_html"

echo ""
echo "[1/5] Backend..."
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models"
cp -f "$REPO/backend/server.py" "$PROD/"
cp -f "$REPO/backend/config.py" "$PROD/"
cp -f "$REPO/backend/database.py" "$PROD/"
cp -f "$REPO/backend/routers/"*.py "$PROD/routers/"
cp -f "$REPO/backend/utils/"*.py "$PROD/utils/"
cp -f "$REPO/backend/models/"*.py "$PROD/models/" 2>/dev/null
echo "  OK"

echo "[2/5] Frontend (pre-built)..."
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
echo "  OK"

echo "[3/5] Llaves..."
cp -f /home/flipcardsuni2/public_html/llaves.txt "$PROD/.env"
echo "  OK"

echo "[4/5] Dependencias..."
"$PROD/venv/bin/pip" install openai httpx feedparser pillow numpy -q
echo "  OK"

echo "[5/5] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver $PROD/backend.log"

echo ""
echo "LISTO! Abre flipslabengine.com con Ctrl+Shift+R"
