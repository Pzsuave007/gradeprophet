#!/bin/bash
echo "=== FlipSlab Engine - Full Deploy ==="

# 1. Install frontend dependencies
echo "[1/4] Installing frontend dependencies..."
cd /home/gradeprophet/frontend
npm install --legacy-peer-deps

# 2. Build frontend
echo "[2/4] Building frontend..."
npx craco build

# 3. Install backend dependency
echo "[3/4] Installing backend dependencies..."
/opt/gradeprophet/backend/venv/bin/pip install feedparser

# 4. Run fix.sh to deploy everything
echo "[4/4] Deploying..."
cd /home/gradeprophet
bash fix.sh

echo ""
echo "=== Deploy complete! Open flipslabengine.com with Ctrl+Shift+R ==="
