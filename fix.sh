#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Quick Update (Backend Only)"
echo "============================================"

REPO="/home/gradeprophet"
PROD="/opt/gradeprophet/backend"

echo ""
echo "[1/3] Backend dependencies..."
cd "$PROD"
source "$PROD/venv/bin/activate"
pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ --quiet 2>/dev/null
pip install -r "$REPO/backend/requirements.txt" --quiet 2>/dev/null
echo "  OK"

echo "[2/3] Backend files..."
mkdir -p "$PROD/routers" "$PROD/utils" "$PROD/models"
cp -f "$REPO/backend/server.py" "$PROD/"
cp -f "$REPO/backend/config.py" "$PROD/"
cp -f "$REPO/backend/database.py" "$PROD/"
cp -f "$REPO/backend/routers/"*.py "$PROD/routers/"
cp -f "$REPO/backend/utils/"*.py "$PROD/utils/"
cp -f "$REPO/backend/models/"*.py "$PROD/models/" 2>/dev/null
echo "  OK"

echo "[3/3] Reiniciando backend..."
NEWKEY=$(grep OPENAI_API_KEY /home/flipcardsuni2/public_html/llaves.txt | cut -d'=' -f2)
sed -i "s|^OPENAI_API_KEY=.*|OPENAI_API_KEY=$NEWKEY|" "$PROD/.env"
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver $PROD/backend.log"

echo ""
echo "============================================"
echo "  Backend updated! For frontend changes use:"
echo "  bash deploy.sh"
echo "============================================"
