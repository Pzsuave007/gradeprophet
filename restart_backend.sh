#!/bin/bash
echo "Matando procesos anteriores..."
pkill -9 -f "uvicorn.*8001" 2>/dev/null
sleep 3

echo "Iniciando backend..."
cd /opt/gradeprophet/backend
source venv/bin/activate
nohup venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5

curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "API: OK - Prueba el scanner!" || echo "ERROR: tail -20 /opt/gradeprophet/backend/backend.log"
