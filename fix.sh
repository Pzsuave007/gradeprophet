#!/bin/bash
echo "========================================="
echo " FlipSlab Engine - Server Update Script"
echo "========================================="
echo ""

cd /home/gradeprophet && git pull
echo ""

echo "[1/5] Copying backend files..."
cp /home/gradeprophet/backend/server.py /opt/gradeprophet/backend/server.py
cp /home/gradeprophet/backend/requirements.txt /opt/gradeprophet/backend/requirements.txt
cp /home/gradeprophet/backend/.env /opt/gradeprophet/backend/.env
echo "  Backend files copied."

echo "[2/5] Copying frontend files..."
cp -r /home/gradeprophet/frontend/src/components/AccountModule.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/AnalysisResult.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/BatchUploadView.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/CardScanner.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/CreateListingView.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/DashboardHome.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/EbayMonitor.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/FlipFinder.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/HistoryPanel.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/InventoryModule.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/LearningPanel.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/ListingsModule.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/MarketModule.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/PortfolioTracker.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/PriceAlerts.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/PriceHistoryChart.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/components/ViewToggle.jsx /opt/gradeprophet/frontend/src/components/
cp -r /home/gradeprophet/frontend/src/pages/Dashboard.jsx /opt/gradeprophet/frontend/src/pages/
cp -r /home/gradeprophet/frontend/src/App.jsx /opt/gradeprophet/frontend/src/
echo "  Frontend files copied."

echo "[3/5] Installing backend dependencies..."
pip3 install -r /opt/gradeprophet/backend/requirements.txt 2>&1 | tail -3
echo "  Dependencies installed."

echo "[4/5] Building frontend..."
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
cp -r /opt/gradeprophet/frontend/build/* /home/flipcardsuni2/public_html/
echo "  Frontend built and deployed."

echo "[5/5] Restarting backend..."
pkill -f "uvicorn.*8001" 2>/dev/null; sleep 3
cd /opt/gradeprophet/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
echo "  Esperando 10 segundos..."
sleep 10

if curl -s http://localhost:8001/api/ | grep -q "GradeProphet"; then
    echo ""
    echo "========================================="
    echo " LISTO! FlipSlab Engine actualizado!"
    echo "========================================="
    echo ""
    echo " Nuevas features:"
    echo "  - Batch Upload (Inventory > Batch Upload)"
    echo "  - Portfolio Value Tracker (Dashboard > Portfolio Value)"
    echo "  - Price Alerts (Market > Price Alerts)"
    echo "  - Price History Charts (Inventory > hover > icono grafica)"
    echo "  - Auto-crop mejorado (no corta arriba)"
    echo ""
else
    echo ""
    echo "ERROR - Backend no inicio correctamente:"
    tail -20 backend.log
fi
