#!/bin/bash
echo "============================================"
echo "  Instalando OpenCV + Reiniciando Backend"
echo "============================================"

PROD="/opt/gradeprophet/backend"
cd "$PROD"
source "$PROD/venv/bin/activate"

echo ""
echo "[1] Instalando opencv-python-headless..."
pip install opencv-python-headless
echo ""

echo "[2] Verificando instalación..."
python3 -c "import cv2; print('  OK: cv2 version', cv2.__version__)" 2>&1 || echo "  ERROR: Falló la instalación"

echo ""
echo "[3] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null
sleep 2
cd "$PROD" && nohup "$PROD/venv/bin/uvicorn" server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
sleep 5
curl -s http://localhost:8001/api/ | grep -q "FlipSlab" && echo "  API: OK" || echo "  ERROR: ver backend.log"

echo ""
echo "============================================"
echo "  LISTO! Prueba el scanner"
echo "============================================"
