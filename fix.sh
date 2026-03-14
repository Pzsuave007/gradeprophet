#!/bin/bash
# ============================================
# FlipSlab Engine - fix.sh v10
# ============================================
# 1. Sube cambios a GitHub desde Emergent
# 2. En tu servidor: cd /home/gradeprophet && git pull
# 3. bash fix.sh
# ============================================

echo "============================================"
echo "  FlipSlab Engine - Aplicando cambios"
echo "============================================"
echo ""

REPO_DIR="/home/gradeprophet"
PROD_DIR="/opt/gradeprophet"
FRONTEND_PUBLIC="/home/flipcardsuni2/public_html"

# --- Paso 1: Copiar backend modular ---
echo "[1/4] Copiando backend..."
mkdir -p "$PROD_DIR/backend/routers" "$PROD_DIR/backend/utils" "$PROD_DIR/backend/models"

cp -f "$REPO_DIR/backend/server.py" "$PROD_DIR/backend/server.py"
cp -f "$REPO_DIR/backend/config.py" "$PROD_DIR/backend/config.py"
cp -f "$REPO_DIR/backend/database.py" "$PROD_DIR/backend/database.py"
cp -f "$REPO_DIR/backend/requirements.txt" "$PROD_DIR/backend/requirements.txt"
cp -f "$REPO_DIR/backend/routers/"*.py "$PROD_DIR/backend/routers/" 2>/dev/null
cp -f "$REPO_DIR/backend/utils/"*.py "$PROD_DIR/backend/utils/" 2>/dev/null
cp -f "$REPO_DIR/backend/models/"*.py "$PROD_DIR/backend/models/" 2>/dev/null

echo "  server.py: $(wc -l < "$PROD_DIR/backend/server.py") lineas"
echo "  routers: $(ls "$PROD_DIR/backend/routers/"*.py 2>/dev/null | wc -l) archivos"
echo "  utils: $(ls "$PROD_DIR/backend/utils/"*.py 2>/dev/null | wc -l) archivos"

# --- Paso 2: Copiar frontend (ya compilado en el repo) ---
echo ""
echo "[2/4] Copiando frontend..."
rm -rf "$FRONTEND_PUBLIC/static/js/" "$FRONTEND_PUBLIC/static/css/" "$FRONTEND_PUBLIC/static/media/"
cp -rf "$REPO_DIR/frontend/build/"* "$FRONTEND_PUBLIC/"

JS_FILE=$(ls "$FRONTEND_PUBLIC/static/js/main."*.js 2>/dev/null | head -1)
if [ -n "$JS_FILE" ]; then
    echo "  JS: $(basename $JS_FILE)"
    echo "  OK: Frontend copiado"
else
    echo "  ERROR: No se encontraron archivos JS"
    echo "  Verifica que frontend/build/ existe en el repo"
fi

# --- Paso 3: Reiniciar backend ---
echo ""
echo "[3/4] Reiniciando backend..."
pkill -f "uvicorn.*server:app.*8001" 2>/dev/null || true
PIDS=$(lsof -ti:8001 2>/dev/null || true)
[ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null
sleep 2

cd "$PROD_DIR/backend"
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$PROD_DIR/backend/backend.log" 2>&1 &
echo "  Backend arrancado (PID: $!)"
sleep 5

# --- Paso 4: Verificar ---
echo ""
echo "[4/4] Verificando..."
RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null)
if echo "$RESULT" | grep -qi "FlipSlab\|modules"; then
    echo "  API: OK"
    echo ""
    echo "============================================"
    echo "  LISTO! Abre flipslabengine.com"
    echo "  Haz Ctrl+Shift+R para borrar cache"
    echo "============================================"
else
    echo "  ERROR: Backend no responde"
    echo "  tail -30 $PROD_DIR/backend/backend.log"
fi
