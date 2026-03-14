#!/bin/bash
# ============================================
# FlipSlab Engine - fix.sh v9 (Modular)
# ============================================
# Flujo normal:
#   1. Sube cambios a GitHub desde Emergent
#   2. En tu servidor: cd /home/gradeprophet && git pull
#   3. bash fix.sh
# ============================================

echo "============================================"
echo "  FlipSlab Engine - Aplicando cambios v9"
echo "============================================"
echo ""

REPO_DIR="/home/gradeprophet"
PROD_DIR="/opt/gradeprophet"
FRONTEND_PUBLIC="/home/flipcardsuni2/public_html"

# --- Paso 1: Git Pull ---
echo "[1/6] Descargando cambios de GitHub..."
cd "$REPO_DIR"
git stash 2>/dev/null || true
git pull origin main 2>/dev/null || git pull origin master 2>/dev/null || git pull
echo "  OK"

# --- Paso 2: Copiar backend modular ---
echo ""
echo "[2/6] Copiando backend modular..."
mkdir -p "$PROD_DIR/backend/routers" "$PROD_DIR/backend/utils" "$PROD_DIR/backend/models"

# Copiar archivos principales
cp -f "$REPO_DIR/backend/server.py" "$PROD_DIR/backend/server.py"
cp -f "$REPO_DIR/backend/config.py" "$PROD_DIR/backend/config.py"
cp -f "$REPO_DIR/backend/database.py" "$PROD_DIR/backend/database.py"
cp -f "$REPO_DIR/backend/requirements.txt" "$PROD_DIR/backend/requirements.txt"

# Copiar routers, utils, models
cp -f "$REPO_DIR/backend/routers/"*.py "$PROD_DIR/backend/routers/" 2>/dev/null
cp -f "$REPO_DIR/backend/utils/"*.py "$PROD_DIR/backend/utils/" 2>/dev/null
cp -f "$REPO_DIR/backend/models/"*.py "$PROD_DIR/backend/models/" 2>/dev/null

echo "  server.py: $(wc -l < "$PROD_DIR/backend/server.py") lineas"
echo "  routers: $(ls "$PROD_DIR/backend/routers/"*.py 2>/dev/null | wc -l) archivos"
echo "  utils: $(ls "$PROD_DIR/backend/utils/"*.py 2>/dev/null | wc -l) archivos"
echo "  NO se toco .env"

# --- Paso 3: Instalar dependencias ---
echo ""
echo "[3/6] Instalando dependencias Python..."
cd "$PROD_DIR/backend"
pip3 install --user fastapi uvicorn motor python-dotenv httpx openai pillow pydantic regex \
    python-multipart bcrypt opencv-python-headless numpy beautifulsoup4 requests lxml 2>&1 | tail -3
echo "  OK"

# --- Paso 4: Build frontend ---
echo ""
echo "[4/6] Compilando frontend..."
cd "$REPO_DIR/frontend"

# Instalar dependencias si no existen
if [ ! -d "node_modules" ]; then
    echo "  Instalando node_modules..."
    npm install 2>&1 | tail -3
fi

# Configurar URL de produccion
echo "REACT_APP_BACKEND_URL=https://flipslabengine.com" > .env.production

# Build
REACT_APP_BACKEND_URL=https://flipslabengine.com npm run build 2>&1 | tail -3

if [ -d "build/static/js" ]; then
    echo "  Build OK: $(ls build/static/js/main.*.js 2>/dev/null | xargs basename 2>/dev/null)"
else
    echo "  ERROR: Build fallo. Revisa si tienes Node.js instalado"
    echo "  Intenta: curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - && yum install -y nodejs"
fi

# --- Paso 5: Copiar frontend a public_html ---
echo ""
echo "[5/6] Desplegando frontend..."
# Borrar JS/CSS viejos
rm -rf "$FRONTEND_PUBLIC/static/js/" "$FRONTEND_PUBLIC/static/css/" "$FRONTEND_PUBLIC/static/media/"

# Copiar nuevos
cp -rf "$REPO_DIR/frontend/build/"* "$FRONTEND_PUBLIC/"

JS_COUNT=$(ls "$FRONTEND_PUBLIC/static/js/"*.js 2>/dev/null | wc -l)
echo "  Archivos JS: $JS_COUNT"
echo "  index.html actualizado: $(grep -o 'main\.[a-f0-9]*\.js' "$FRONTEND_PUBLIC/index.html" 2>/dev/null)"

# --- Paso 6: Reiniciar backend ---
echo ""
echo "[6/6] Reiniciando backend..."
pkill -f "uvicorn.*server:app.*8001" 2>/dev/null || true
PIDS=$(lsof -ti:8001 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    kill -9 $PIDS 2>/dev/null || true
fi
sleep 2

cd "$PROD_DIR/backend"
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$PROD_DIR/backend/backend.log" 2>&1 &
echo "  Backend arrancado (PID: $!)"
sleep 5

# Verificar
RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null)
if echo "$RESULT" | grep -qi "FlipSlab\|modules"; then
    echo ""
    echo "============================================"
    echo "  LISTO! Todo actualizado"
    echo "============================================"
    echo ""
    echo "  Abre flipslabengine.com con Ctrl+Shift+R"
    echo "  (para borrar cache del navegador)"
    echo ""
else
    echo ""
    echo "  ERROR: Backend no responde"
    echo "  tail -30 $PROD_DIR/backend/backend.log"
fi
