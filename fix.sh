sed -i "s/SCRAPEDO_API_KEY=.*/SCRAPEDO_API_KEY=SCRAPEDO_KEY_REMOVED/" /opt/gradeprophet/backend/.env
echo "Clave instalada"
pkill -f "uvicorn.*8001" 2>/dev/null; sleep 3
cd /opt/gradeprophet/backend
source /opt/gradeprophet/venv/bin/activate 2>/dev/null
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl http://localhost:8001/api/
