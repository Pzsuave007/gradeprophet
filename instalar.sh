#!/bin/bash
# ============================================
# GradeProphet - Instalador
# ============================================
# Sube este archivo a /home/flipcardsuni2/public_html/
# Luego corre: bash /home/flipcardsuni2/public_html/instalar.sh
# ============================================

echo "============================================"
echo "  GradeProphet - Instalador"
echo "============================================"
echo ""

# Configuracion
PUBLIC_HTML="/home/flipcardsuni2/public_html"
BACKEND_DIR="/opt/gradeprophet/backend"
DOWNLOAD_URL="https://cardpro-image.preview.emergentagent.com/api/download-code"

# Crear carpeta backend si no existe
mkdir -p "$BACKEND_DIR"

# Paso 1: Descargar el API actualizado
echo "[1/5] Descargando API actualizado..."
curl -s -o "$BACKEND_DIR/server.py" "$DOWNLOAD_URL"
if [ $? -eq 0 ] && [ -s "$BACKEND_DIR/server.py" ]; then
    LINES=$(wc -l < "$BACKEND_DIR/server.py")
    echo "  OK: server.py descargado ($LINES lineas)"
else
    echo "  ERROR: No se pudo descargar. Intentando desde ebay.txt..."
    if [ -f "$PUBLIC_HTML/ebay.txt" ]; then
        cp "$PUBLIC_HTML/ebay.txt" "$BACKEND_DIR/server.py"
        echo "  OK: Copiado desde ebay.txt"
    else
        echo "  ERROR: No se encontro ebay.txt tampoco."
        echo "  Copia el contenido de server.py manualmente a: $BACKEND_DIR/server.py"
        exit 1
    fi
fi

# Paso 2: Verificar/crear .env
echo ""
echo "[2/5] Verificando .env..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "  Creando .env..."
    cat > "$BACKEND_DIR/.env" << 'ENVEOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=gradeprophet
CORS_ORIGINS=*
OPENAI_API_KEY=PON_TU_CLAVE_OPENAI
SCRAPEDO_API_KEY=SCRAPEDO_KEY_REMOVED
ENVEOF
    echo "  IMPORTANTE: Edita .env con tu clave OPENAI:"
    echo "  nano $BACKEND_DIR/.env"
else
    echo "  .env ya existe"
    # Corregir clave SCRAPEDO si tiene el error
    if grep -q "6a0abbb7" "$BACKEND_DIR/.env"; then
        sed -i 's/SCRAPEDO_API_KEY=.*/SCRAPEDO_API_KEY=SCRAPEDO_KEY_REMOVED/' "$BACKEND_DIR/.env"
        echo "  Clave SCRAPEDO corregida"
    fi
fi

# Paso 3: Instalar dependencias
echo ""
echo "[3/5] Instalando dependencias..."
# Activar venv si existe
if [ -d "/opt/gradeprophet/venv" ]; then
    source /opt/gradeprophet/venv/bin/activate
    echo "  virtualenv activado"
fi
pip3 install fastapi uvicorn motor python-dotenv httpx openai pillow pydantic regex python-multipart 2>&1 | tail -3
echo "  OK"

# Paso 4: Reiniciar backend
echo ""
echo "[4/5] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null || true
sleep 3
cd "$BACKEND_DIR"
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$BACKEND_DIR/backend.log" 2>&1 &
echo "  Backend arrancado (PID: $!)"

# Paso 5: Verificar
echo ""
echo "[5/5] Verificando (esperando 8 segundos)..."
sleep 8
RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null)
if echo "$RESULT" | grep -q "GradeProphet"; then
    echo ""
    echo "============================================"
    echo "  EXITO! Backend funcionando!"
    echo "============================================"
    echo ""
    echo "  Abre en tu navegador:"
    echo "  http://flipslabengine.com/api/test-ebay"
    echo ""
else
    echo ""
    echo "  ERROR: Backend no responde"
    echo "  Ver log: tail -30 $BACKEND_DIR/backend.log"
    tail -15 "$BACKEND_DIR/backend.log" 2>/dev/null
fi
