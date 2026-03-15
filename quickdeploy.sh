#!/bin/bash
# Quick deploy - only updates what changed
REPO="/home/gradeprophet"
PROD="/opt/gradeprophet/backend"
WEB="/home/flipcardsuni2/public_html"

cd "$REPO"
git pull origin main

# Check what changed
CHANGED=$(git diff --name-only HEAD~1)
NEED_BACKEND=false
NEED_FRONTEND=false

echo "$CHANGED" | grep -q "^backend/" && NEED_BACKEND=true
echo "$CHANGED" | grep -q "^frontend/" && NEED_FRONTEND=true

# Backend only
if $NEED_BACKEND; then
  echo "[BACKEND] Updating..."
  cp -f "$REPO/backend/server.py" "$PROD/"
  cp -f "$REPO/backend/config.py" "$PROD/" 2>/dev/null
  cp -f "$REPO/backend/database.py" "$PROD/" 2>/dev/null
  cp -f "$REPO/backend/routers/"*.py "$PROD/routers/"
  cp -f "$REPO/backend/utils/"*.py "$PROD/utils/"
  cp -f "$REPO/backend/models/"*.py "$PROD/models/" 2>/dev/null
  pkill -f "uvicorn.*8001" 2>/dev/null
  sleep 2
  cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
  sleep 3
  curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  API: ERROR"
else
  echo "[BACKEND] No changes"
fi

# Frontend only
if $NEED_FRONTEND; then
  echo "[FRONTEND] Building..."
  cd "$REPO/frontend"
  npm install --legacy-peer-deps 2>/dev/null
  REACT_APP_BACKEND_URL=https://flipslabengine.com npx craco build
  if [ $? -eq 0 ]; then
    rm -rf "$WEB/static/js/" "$WEB/static/css/"
    cp -rf "$REPO/frontend/build/"* "$WEB/"
    echo "  Build: OK"
  else
    echo "  Build: ERROR"
  fi
else
  echo "[FRONTEND] No changes"
fi

echo "Done!"
