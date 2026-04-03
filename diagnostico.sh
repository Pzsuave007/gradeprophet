#!/bin/bash
echo "============================================"
echo "  FlipSlab - Diagnóstico de Auto-Crop"
echo "============================================"

PROD="/opt/gradeprophet/backend"
cd "$PROD"
source "$PROD/venv/bin/activate"

echo ""
echo "[1] Verificando OpenCV..."
python3 -c "import cv2; print('  OK: cv2 version', cv2.__version__)" 2>&1 || echo "  ERROR: OpenCV NO instalado"

echo ""
echo "[2] Verificando numpy..."
python3 -c "import numpy; print('  OK: numpy version', numpy.__version__)" 2>&1 || echo "  ERROR: numpy NO instalado"

echo ""
echo "[3] Verificando que scanner_auto_process existe en el código..."
grep -n "scanner_auto_process" "$PROD/routers/cards.py" 2>/dev/null || echo "  ERROR: scanner_auto_process NO encontrado en cards.py"

echo ""
echo "[4] Verificando scan-upload endpoint..."
grep -A2 "scan-upload" "$PROD/routers/cards.py" | head -5

echo ""
echo "[5] Últimos logs del backend relacionados al scanner..."
tail -100 "$PROD/backend.log" 2>/dev/null | grep -i "scanner\|crop\|cv2\|auto-process" | tail -10
if [ $? -ne 0 ]; then
    echo "  No hay logs de scanner recientes"
fi

echo ""
echo "[6] Últimos errores del backend..."
tail -100 "$PROD/backend.log" 2>/dev/null | grep -i "error\|exception\|failed" | tail -5
if [ $? -ne 0 ]; then
    echo "  No hay errores recientes"
fi

echo ""
echo "============================================"
echo "  Copia TODO lo de arriba y pégamelo"
echo "============================================"
