#!/bin/bash
# ============================================
#  FlipSlab Engine - Update v8 (Modular)
# ============================================
# This script deploys the new modular backend
# and updated frontend to your production server.
#
# USAGE:
#   1. Upload flipslab_update.tar.gz to your server
#   2. Extract: tar xzf flipslab_update.tar.gz
#   3. Run: bash fix.sh
# ============================================

echo "============================================"
echo "  FlipSlab Engine - Update v8 (Modular)"
echo "============================================"
echo ""

# --- Detect project directory ---
PROJECT_DIR=""
if [ -d "/opt/gradeprophet" ]; then
    PROJECT_DIR="/opt/gradeprophet"
elif [ -d "/home/gradeprophet" ]; then
    PROJECT_DIR="/home/gradeprophet"
else
    echo "ERROR: No se encontro /opt/gradeprophet ni /home/gradeprophet"
    echo "Crea el directorio: mkdir -p /opt/gradeprophet/backend"
    exit 1
fi
echo "Directorio: $PROJECT_DIR"

BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Step 1: Read keys from llaves.txt ---
echo ""
echo "[1/6] Configurando llaves..."
LLAVES_FILE=""
if [ -f "/home/flipcardsuni2/public_html/llaves.txt" ]; then
    LLAVES_FILE="/home/flipcardsuni2/public_html/llaves.txt"
elif [ -f "$PROJECT_DIR/llaves.txt" ]; then
    LLAVES_FILE="$PROJECT_DIR/llaves.txt"
fi

EXISTING_OPENAI=$(grep "^OPENAI_API_KEY=" "$BACKEND_DIR/.env" 2>/dev/null | cut -d'=' -f2-)

if [ -n "$LLAVES_FILE" ]; then
    echo "  Leyendo llaves desde: $LLAVES_FILE"
    MONGO_URL=$(grep "^MONGO_URL=" "$LLAVES_FILE" | cut -d'=' -f2-)
    DB_NAME=$(grep "^DB_NAME=" "$LLAVES_FILE" | cut -d'=' -f2-)
    OPENAI_API_KEY=$(grep "^OPENAI_API_KEY=" "$LLAVES_FILE" | cut -d'=' -f2-)
    EBAY_CLIENT_ID=$(grep "^EBAY_CLIENT_ID=" "$LLAVES_FILE" | cut -d'=' -f2-)
    EBAY_CLIENT_SECRET=$(grep "^EBAY_CLIENT_SECRET=" "$LLAVES_FILE" | cut -d'=' -f2-)
    EBAY_DEV_ID=$(grep "^EBAY_DEV_ID=" "$LLAVES_FILE" | cut -d'=' -f2-)
    EBAY_RUNAME=$(grep "^EBAY_RUNAME=" "$LLAVES_FILE" | cut -d'=' -f2-)
    REACT_APP_BACKEND_URL=$(grep "^REACT_APP_BACKEND_URL=" "$LLAVES_FILE" | cut -d'=' -f2-)
    EMERGENT_LLM_KEY=$(grep "^EMERGENT_LLM_KEY=" "$LLAVES_FILE" | cut -d'=' -f2-)
    SCRAPEDO_API_KEY=$(grep "^SCRAPEDO_API_KEY=" "$LLAVES_FILE" | cut -d'=' -f2-)

    # Fallback: use existing OpenAI key if not in llaves.txt
    [ -z "$OPENAI_API_KEY" ] && [ -n "$EXISTING_OPENAI" ] && OPENAI_API_KEY="$EXISTING_OPENAI"

    # Write backend .env
    cat > "$BACKEND_DIR/.env" << ENVFILE
MONGO_URL=${MONGO_URL:-mongodb://localhost:27017}
DB_NAME=${DB_NAME:-gradeprophet}
OPENAI_API_KEY=${OPENAI_API_KEY}
EBAY_CLIENT_ID=${EBAY_CLIENT_ID}
EBAY_CLIENT_SECRET=${EBAY_CLIENT_SECRET}
EBAY_DEV_ID=${EBAY_DEV_ID}
EBAY_RUNAME=${EBAY_RUNAME}
EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}
SCRAPEDO_API_KEY=${SCRAPEDO_API_KEY}
CORS_ORIGINS=*
ENVFILE

    # Write frontend .env if URL is set
    if [ -n "$REACT_APP_BACKEND_URL" ]; then
        mkdir -p "$FRONTEND_DIR"
        echo "REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}" > "$FRONTEND_DIR/.env"
    fi
    echo "  .env configurado OK"
else
    echo "  AVISO: No se encontro llaves.txt"
    echo "  Asegurate de que $BACKEND_DIR/.env tenga las llaves correctas"
fi

# --- Step 2: Stop backend ---
echo ""
echo "[2/6] Deteniendo backend..."
pkill -f "uvicorn.*server:app.*8001" 2>/dev/null || true
pkill -f "uvicorn.*8001" 2>/dev/null || true
PIDS=$(lsof -ti:8001 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    kill -9 $PIDS 2>/dev/null || true
fi
sleep 2
echo "  Backend detenido"

# --- Step 3: Backup old server.py and deploy new modular backend ---
echo ""
echo "[3/6] Actualizando backend (modular v2.0)..."
mkdir -p "$BACKEND_DIR"

# Backup old monolithic server.py if it exists and is large (>100 lines = old monolith)
if [ -f "$BACKEND_DIR/server.py" ]; then
    OLD_LINES=$(wc -l < "$BACKEND_DIR/server.py")
    if [ "$OLD_LINES" -gt 100 ]; then
        cp "$BACKEND_DIR/server.py" "$BACKEND_DIR/server.py.bak.$(date +%Y%m%d)"
        echo "  Backup: server.py viejo ($OLD_LINES lineas) guardado como .bak"
    fi
fi

# Create new directory structure
mkdir -p "$BACKEND_DIR/routers"
mkdir -p "$BACKEND_DIR/utils"
mkdir -p "$BACKEND_DIR/models"

# Copy new backend files from the extracted package
if [ -d "$SCRIPT_DIR/backend" ]; then
    # Copy main entry files
    cp -f "$SCRIPT_DIR/backend/server.py" "$BACKEND_DIR/server.py"
    cp -f "$SCRIPT_DIR/backend/config.py" "$BACKEND_DIR/config.py"
    cp -f "$SCRIPT_DIR/backend/database.py" "$BACKEND_DIR/database.py"

    # Copy all routers
    cp -f "$SCRIPT_DIR/backend/routers/"*.py "$BACKEND_DIR/routers/"

    # Copy all utils
    cp -f "$SCRIPT_DIR/backend/utils/"*.py "$BACKEND_DIR/utils/"

    # Copy models
    cp -f "$SCRIPT_DIR/backend/models/"*.py "$BACKEND_DIR/models/"

    echo "  Archivos copiados:"
    echo "    server.py (entrada principal - $(wc -l < "$BACKEND_DIR/server.py") lineas)"
    echo "    config.py, database.py"
    echo "    routers/: $(ls "$BACKEND_DIR/routers/"*.py 2>/dev/null | wc -l) archivos"
    echo "    utils/: $(ls "$BACKEND_DIR/utils/"*.py 2>/dev/null | wc -l) archivos"
    echo "    models/: $(ls "$BACKEND_DIR/models/"*.py 2>/dev/null | wc -l) archivos"
else
    echo "  ERROR: No se encontro la carpeta backend/ en el paquete"
    echo "  Asegurate de extraer el archivo tar.gz primero"
    exit 1
fi

# --- Step 4: Update frontend ---
echo ""
echo "[4/6] Actualizando frontend..."
if [ -d "$SCRIPT_DIR/frontend_build" ]; then
    # Detect frontend static files location
    FRONTEND_STATIC=""
    if [ -d "/home/flipcardsuni2/public_html" ]; then
        FRONTEND_STATIC="/home/flipcardsuni2/public_html"
    elif [ -d "$FRONTEND_DIR/build" ]; then
        FRONTEND_STATIC="$FRONTEND_DIR/build"
    elif [ -d "$FRONTEND_DIR" ]; then
        FRONTEND_STATIC="$FRONTEND_DIR"
    fi

    if [ -n "$FRONTEND_STATIC" ]; then
        # Copy frontend build files
        cp -rf "$SCRIPT_DIR/frontend_build/"* "$FRONTEND_STATIC/"
        echo "  Frontend copiado a: $FRONTEND_STATIC"
    else
        echo "  AVISO: No se encontro directorio de frontend"
        echo "  Copia manualmente frontend_build/ a tu directorio de frontend"
    fi
else
    echo "  Sin cambios de frontend en este paquete"
fi

# --- Step 5: Install dependencies ---
echo ""
echo "[5/6] Instalando dependencias..."

# Activate virtualenv if it exists
if [ -d "$PROJECT_DIR/venv" ]; then
    source "$PROJECT_DIR/venv/bin/activate"
    echo "  virtualenv activado"
elif [ -d "/opt/gradeprophet/venv" ]; then
    source "/opt/gradeprophet/venv/bin/activate"
    echo "  virtualenv activado"
fi

cd "$BACKEND_DIR"
pip3 install fastapi uvicorn motor python-dotenv httpx openai pillow pydantic regex \
    python-multipart bcrypt opencv-python-headless numpy beautifulsoup4 requests lxml 2>&1 | tail -5
echo "  Dependencias instaladas OK"

# --- Step 6: Restart backend and verify ---
echo ""
echo "[6/6] Reiniciando backend..."
cd "$BACKEND_DIR"
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$BACKEND_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "  Backend arrancado (PID: $BACKEND_PID)"

echo ""
echo "  Esperando 10 segundos para verificar..."
sleep 10

RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null || echo "NO_RESPONSE")
if echo "$RESULT" | grep -qi "FlipSlab\|modules\|status"; then
    echo ""
    echo "============================================"
    echo "  EXITO! FlipSlab Engine v2.0 funcionando!"
    echo "============================================"
    echo ""
    echo "  API Response: $RESULT"
    echo ""
    echo "  La nueva arquitectura modular incluye:"
    echo "    - 10 modulos de routers separados"
    echo "    - Utilidades independientes (AI, eBay, imagen)"
    echo "    - Codigo mas limpio y facil de mantener"
    echo ""
else
    echo ""
    echo "  ERROR: Backend no responde. Revisando log..."
    echo ""
    tail -30 "$BACKEND_DIR/backend.log" 2>/dev/null
    echo ""
    echo "  Revisa el log completo: tail -50 $BACKEND_DIR/backend.log"
    echo "  Errores comunes:"
    echo "    - Falta alguna dependencia: pip3 install <paquete>"
    echo "    - .env incompleto: nano $BACKEND_DIR/.env"
fi

echo ""
echo "============================================"
echo "  Para ver logs en tiempo real:"
echo "  tail -f $BACKEND_DIR/backend.log"
echo "============================================"
