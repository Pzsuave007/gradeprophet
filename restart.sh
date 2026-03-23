#!/bin/bash
echo "Restarting FlipSlab Backend..."
PROD="/opt/gradeprophet/backend"
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && source "$PROD/venv/bin/activate"
nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "API: OK" || echo "ERROR: check $PROD/backend.log"
