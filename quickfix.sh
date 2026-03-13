#!/bin/bash
echo "=== Quick Update ==="
cd /home/gradeprophet && git pull
cp /home/gradeprophet/frontend/src/App.js /opt/gradeprophet/frontend/src/
cp /home/gradeprophet/frontend/src/components/AuthPage.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/backend/server.py /opt/gradeprophet/backend/server.py
echo "=== Restarting backend ==="
pkill -9 -f "uvicorn.*8001" 2>/dev/null; sleep 3
cd /opt/gradeprophet/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
echo "=== Building frontend ==="
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
cp -r build/* /home/flipcardsuni2/public_html/
sleep 5
curl -s http://localhost:8001/api/ && echo "" && echo "=== Listo! Prueba Google Login ===" || echo "=== ERROR ==="
