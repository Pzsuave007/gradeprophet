#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Deploy Terminología Update"
echo "  Snipe → Auction Alert"
echo "============================================"

REPO="/home/gradeprophet"
PROD="/opt/gradeprophet/backend"
WEB="/home/flipcardsuni2/public_html"

# 1. Pull últimos cambios
echo ""
echo "[1/5] Pulling cambios..."
cd "$REPO"
git pull origin main
echo "  OK"

# 2. Build frontend
echo ""
echo "[2/5] Build frontend..."
cd "$REPO/frontend"
npm install --legacy-peer-deps 2>/dev/null
REACT_APP_BACKEND_URL=https://flipslabengine.com npx craco build
if [ $? -ne 0 ]; then
  echo "  ERROR: Build falló. Revisa los errores arriba."
  exit 1
fi
echo "  Build OK"

# 3. Copiar frontend
echo ""
echo "[3/5] Copiando frontend a producción..."
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
echo "  JS: $(grep -o 'main\.[a-f0-9]*\.js' "$WEB/index.html")"

# 4. Copiar backend
echo ""
echo "[4/5] Actualizando backend..."
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models"
cp -f "$REPO/backend/server.py" "$PROD/"
cp -f "$REPO/backend/config.py" "$PROD/"
cp -f "$REPO/backend/database.py" "$PROD/"
cp -f "$REPO/backend/routers/"*.py "$PROD/routers/"
cp -f "$REPO/backend/utils/"*.py "$PROD/utils/"
cp -f "$REPO/backend/models/"*.py "$PROD/models/"
"$PROD/venv/bin/pip" install feedparser -q 2>/dev/null
echo "  OK"

# 5. Reiniciar backend
echo ""
echo "[5/5] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver $PROD/backend.log"

echo ""
echo "============================================"
echo "  LISTO! Abre flipslabengine.com con Ctrl+Shift+R"
echo "  Cambios: Snipe → Auction Alert en toda la app"
echo "============================================"
