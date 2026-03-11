#!/bin/bash
cd /home/gradeprophet && git pull
cp -r frontend/src /opt/gradeprophet/frontend/src
cp backend/server.py /opt/gradeprophet/backend/server.py
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 3
source /opt/gradeprophet/venv/bin/activate
cd /opt/gradeprophet/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
echo "Esperando 10 segundos..."
sleep 10
if curl -s http://localhost:8001/api/ | grep -q "GradeProphet"; then
    echo "LISTO! Todo funciona!"
else
    echo "ERROR - Ultimas lineas del log:"
    tail -20 backend.log
fi
