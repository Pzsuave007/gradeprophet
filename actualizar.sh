#!/bin/bash
# ============================================
# GradeProphet - Actualizar desde GitHub
# ============================================
# Ejecutar en tu servidor:
# bash actualizar.sh
# ============================================

echo "============================================"
echo "  GradeProphet - Actualizando desde GitHub"
echo "============================================"
echo ""

# Paso 1: Pull desde GitHub
echo "[1/5] Descargando cambios de GitHub..."
cd /home/gradeprophet
git stash 2>/dev/null || true
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || git pull
echo "  OK: Codigo descargado"

# Paso 2: Copiar backend a /opt/gradeprophet
echo ""
echo "[2/5] Copiando backend..."
cp -f /home/gradeprophet/backend/server.py /opt/gradeprophet/backend/server.py
cp -f /home/gradeprophet/backend/requirements.txt /opt/gradeprophet/backend/requirements.txt
# NO copiar .env - mantener el del servidor
echo "  OK: Backend copiado (sin tocar .env)"

# Paso 3: Instalar dependencias Python
echo ""
echo "[3/5] Instalando dependencias..."
cd /opt/gradeprophet/backend
pip3 install --user fastapi uvicorn motor python-dotenv httpx openai pillow pydantic regex python-multipart 2>&1 | tail -3
echo "  OK: Dependencias instaladas"

# Paso 4: Reiniciar backend
echo ""
echo "[4/5] Reiniciando backend..."
# Matar backend anterior
pkill -f "uvicorn.*server:app.*8001" 2>/dev/null || true
PIDS=$(lsof -ti:8001 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    kill -9 $PIDS 2>/dev/null || true
fi
sleep 2

# Arrancar nuevo
cd /opt/gradeprophet/backend
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > /opt/gradeprophet/backend/backend.log 2>&1 &
echo "  OK: Backend arrancado (PID: $!)"
sleep 5

# Paso 5: Verificar
echo ""
echo "[5/5] Verificando..."
RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null || echo "NO_RESPONSE")
if echo "$RESULT" | grep -q "GradeProphet"; then
    echo "  OK: API respondiendo!"
    echo ""
    echo "  Ahora abre en tu navegador:"
    echo "  http://flipslabengine.com/api/test-ebay"
    echo ""
    echo "  Eso te dira si la busqueda de eBay funciona."
else
    echo "  ERROR: API no responde. Revisa el log:"
    echo "  tail -30 /opt/gradeprophet/backend/backend.log"
fi

echo ""
echo "============================================"
echo "  Para ver logs en tiempo real:"
echo "  tail -f /opt/gradeprophet/backend/backend.log"
echo "============================================"
