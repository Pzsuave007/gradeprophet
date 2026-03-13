#!/bin/bash
echo "========================================="
echo " FlipSlab Engine - Server Update Script"
echo "========================================="
echo ""

cd /home/gradeprophet && git pull
echo ""

# =============================================
# BACKEND
# =============================================
echo "[1/5] Copying backend files..."
cp /home/gradeprophet/backend/server.py /opt/gradeprophet/backend/server.py
cp /home/gradeprophet/backend/requirements.txt /opt/gradeprophet/backend/requirements.txt
cp /home/gradeprophet/backend/.env /opt/gradeprophet/backend/.env
echo "  Backend files copied."

# =============================================
# FRONTEND - All source files
# =============================================
echo "[2/5] Copying frontend files..."

# Core app files
cp /home/gradeprophet/frontend/src/App.js /opt/gradeprophet/frontend/src/App.js
cp /home/gradeprophet/frontend/src/App.css /opt/gradeprophet/frontend/src/App.css
cp /home/gradeprophet/frontend/src/index.js /opt/gradeprophet/frontend/src/index.js
cp /home/gradeprophet/frontend/src/index.css /opt/gradeprophet/frontend/src/index.css

# Pages
cp /home/gradeprophet/frontend/src/pages/Dashboard.jsx /opt/gradeprophet/frontend/src/pages/

# Components (all custom components)
cp /home/gradeprophet/frontend/src/components/AccountModule.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/AnalysisResult.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/AuthCallback.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/AuthPage.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/BatchUploadView.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/CardScanner.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/CreateListingView.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/DashboardHome.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/EbayMonitor.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/FlipFinder.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/HistoryPanel.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/InventoryModule.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/LandingPage.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/LearningPanel.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/ListingsModule.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/MarketModule.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/PortfolioTracker.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/PriceAlerts.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/PriceHistoryChart.jsx /opt/gradeprophet/frontend/src/components/
cp /home/gradeprophet/frontend/src/components/ViewToggle.jsx /opt/gradeprophet/frontend/src/components/

# UI components (shadcn)
cp -r /home/gradeprophet/frontend/src/components/ui/* /opt/gradeprophet/frontend/src/components/ui/

# Hooks and lib
cp /home/gradeprophet/frontend/src/hooks/use-toast.js /opt/gradeprophet/frontend/src/hooks/
cp /home/gradeprophet/frontend/src/lib/utils.js /opt/gradeprophet/frontend/src/lib/

# Config files
cp /home/gradeprophet/frontend/tailwind.config.js /opt/gradeprophet/frontend/
cp /home/gradeprophet/frontend/postcss.config.js /opt/gradeprophet/frontend/
cp /home/gradeprophet/frontend/craco.config.js /opt/gradeprophet/frontend/
cp /home/gradeprophet/frontend/package.json /opt/gradeprophet/frontend/
cp /home/gradeprophet/frontend/jsconfig.json /opt/gradeprophet/frontend/

# Public files
cp -r /home/gradeprophet/frontend/public/* /opt/gradeprophet/frontend/public/

echo "  Frontend files copied."

# =============================================
# INSTALL DEPENDENCIES
# =============================================
echo "[3/5] Installing dependencies..."
pip3 install -r /opt/gradeprophet/backend/requirements.txt 2>&1 | tail -3
cd /opt/gradeprophet/frontend && npm install --legacy-peer-deps 2>&1 | tail -3
echo "  Dependencies installed."

# =============================================
# BUILD FRONTEND
# =============================================
echo "[4/5] Building frontend..."
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
cp -r /opt/gradeprophet/frontend/build/* /home/flipcardsuni2/public_html/
echo "  Frontend built and deployed."

# =============================================
# RESTART BACKEND
# =============================================
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
    echo " Features de hoy:"
    echo "  1. Auto-crop mejorado (aspect ratio enforcement, no corta arriba)"
    echo "  2. Batch Upload - sube 20+ tarjetas escaneadas de un golpe"
    echo "  3. Portfolio Value Tracker - Dashboard > Portfolio Value"
    echo "  4. Price Alerts - Market > Price Alerts"
    echo "  5. Price History Charts - Inventory > hover tarjeta > icono grafica"
    echo "  6. Landing Page con SCAN.FLIP.PROFIT. y pricing"
    echo "  7. Autenticacion - Email/Password + Google Login"
    echo "  8. Rutas protegidas - usuarios deben registrarse para acceder"
    echo ""
else
    echo ""
    echo "ERROR - Backend no inicio correctamente:"
    tail -20 backend.log
fi
