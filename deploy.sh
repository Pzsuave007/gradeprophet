#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Full Deploy (With Build)"
echo "============================================"

REPO="/home/gradeprophet"
PROD="/opt/gradeprophet/backend"
WEB="/home/flipcardsuni2/public_html"

echo ""
echo "[1/5] Backend dependencies..."
cd "$PROD"
source "$PROD/venv/bin/activate"
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ --quiet 2>/dev/null
pip install -r "$REPO/backend/requirements.txt" --quiet 2>/dev/null
echo "  OK"

echo "[2/5] Backend files..."
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models"
cp -f "$REPO/backend/server.py" "$PROD/"
cp -f "$REPO/backend/config.py" "$PROD/"
cp -f "$REPO/backend/database.py" "$PROD/"
cp -f "$REPO/backend/routers/"*.py "$PROD/routers/"
cp -f "$REPO/backend/utils/"*.py "$PROD/utils/"
cp -f "$REPO/backend/models/"*.py "$PROD/models/" 2>/dev/null
echo "  OK"

echo "[3/5] Building frontend..."
cd "$REPO/frontend"
export REACT_APP_BACKEND_URL="https://flipslabengine.com"
yarn install --frozen-lockfile --silent 2>/dev/null || npm install --silent 2>/dev/null
yarn build 2>&1 || npm run build 2>&1
if [ -d "$REPO/frontend/build" ]; then
    echo "  Build OK"
else
    echo "  ERROR: Build failed! Check Node.js version (need 16+)"
    echo "  Try: node -v"
    exit 1
fi

echo "[4/5] Deploying frontend..."
rm -rf "$WEB/static/js/" "$WEB/static/css/"
cp -rf "$REPO/frontend/build/"* "$WEB/"
echo "  OK"

echo "[5/5] Reiniciando backend..."
NEWKEY=$(grep OPENAI_API_KEY /home/flipcardsuni2/public_html/llaves.txt | cut -d'=' -f2)
sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$NEWKEY|" "$PROD/.env"
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver $PROD/backend.log"

echo ""
echo "============================================"
echo "  LISTO! Abre flipslabengine.com con Ctrl+Shift+R"
echo "============================================"
