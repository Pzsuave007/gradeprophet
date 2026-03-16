#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Fix Scanner Upload + AI"
echo "  Cambios: Duplex pairing, AI front+back,"
echo "  Scanner Token, Inventory flip, eBay 2 imgs"
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
cp -f "$REPO/backend/models/"*.py "$PROD/models/"
echo "  OK"

echo "[2/5] Frontend build..."
cd "$REPO/frontend"
rm -rf node_modules/.cache
npm install --legacy-peer-deps 2>/dev/null
REACT_APP_BACKEND_URL=https://flipslabengine.com npx craco build
if [ $? -ne 0 ]; then
  echo "  ERROR: Build fallo."
  exit 1
fi
echo "  Build OK"

echo "[3/5] Copiando frontend..."
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
echo "  JS: $(grep -o 'main\.[a-f0-9]*\.js' "$WEB/index.html")"

echo "[4/5] Instalando dependencias backend..."
"$PROD/venv/bin/pip" install feedparser -q 2>/dev/null

echo "[5/5] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver $PROD/backend.log"

echo ""
echo "============================================"
echo "  LISTO! Cambios aplicados:"
echo "  - scan-upload: front/back pairing (item_id)"
echo "  - AI re-identifica con front + back"
echo "  - Scanner Token en Account"
echo "  - Inventory flip 3D (boton BACK)"
echo "  - eBay sube 2 imagenes (front + back)"
echo "  - Download scanner ZIP endpoint"
echo ""
echo "  Abre flipslabengine.com con Ctrl+Shift+R"
echo "============================================"
