cd /home/gradeprophet && git pull
cp -r frontend/src /opt/gradeprophet/frontend/src
cp backend/server.py /opt/gradeprophet/backend/server.py
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
pkill -f "uvicorn.*8001" 2>/dev/null; sleep 3
cd /opt/gradeprophet/backend
source /opt/gradeprophet/venv/bin/activate 2>/dev/null
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl http://localhost:8001/api/ && echo " - LISTO!"
