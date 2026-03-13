#!/bin/bash
echo "=== Killing old backend ==="
pkill -9 -f "uvicorn.*8001"
sleep 3
echo "=== Starting backend ==="
cd /opt/gradeprophet/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ && echo "" && echo "=== Backend corriendo! Prueba Google Login y luego corre: ===" && echo "tail -30 /opt/gradeprophet/backend/backend.log" || echo "=== ERROR ==="
