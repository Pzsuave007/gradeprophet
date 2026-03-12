#!/bin/bash
cd /home/gradeprophet && git pull
cp -r /home/gradeprophet/frontend/src/* /opt/gradeprophet/frontend/src/
cp /home/gradeprophet/backend/server.py /opt/gradeprophet/backend/server.py
# Copy eBay API credentials to backend .env (only add if not present)
grep -q "EBAY_CLIENT_ID" /opt/gradeprophet/backend/.env || cat >> /opt/gradeprophet/backend/.env << 'ENVEOF'
EBAY_CLIENT_ID=EBAY_CLIENT_ID_REMOVED
EBAY_CLIENT_SECRET=EBAY_SECRET_REMOVED
EBAY_DEV_ID=EBAY_DEV_ID_REMOVED
ENVEOF
pip3 install httpx opencv-python-headless motor fastapi uvicorn python-dotenv openai pillow pydantic regex python-multipart 2>&1 | tail -2
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
cp -r /opt/gradeprophet/frontend/build/* /home/flipcardsuni2/public_html/
pkill -f "uvicorn.*8001" 2>/dev/null; sleep 3
cd /opt/gradeprophet/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
echo "Esperando 10 segundos..."
sleep 10
if curl -s http://localhost:8001/api/ | grep -q "GradeProphet"; then
    echo "LISTO! Todo funciona!"
else
    echo "ERROR:"
    tail -20 backend.log
fi
