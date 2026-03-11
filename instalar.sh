#!/bin/bash
# ============================================
# GradeProphet - Instalador Automatico
# ============================================
# INSTRUCCIONES:
# 1. Sube este archivo (instalar.sh) y server.py a tu public_html
# 2. Conectate por SSH a tu servidor
# 3. Corre: bash /home/gradeprophet/public_html/instalar.sh
# ============================================

echo "============================================"
echo "  GradeProphet - Instalador Automatico"
echo "============================================"
echo ""

# Detectar donde estan los archivos subidos
PUBLIC_HTML=""
if [ -d "/home/gradeprophet/public_html" ]; then
    PUBLIC_HTML="/home/gradeprophet/public_html"
elif [ -d "/var/www/html" ]; then
    PUBLIC_HTML="/var/www/html"
else
    echo "ERROR: No encontre public_html"
    echo "Dime donde subiste los archivos:"
    read -p "Ruta completa: " PUBLIC_HTML
fi

echo "Archivos en: $PUBLIC_HTML"

# Verificar que server.py existe en public_html
if [ ! -f "$PUBLIC_HTML/server.py" ]; then
    echo "ERROR: No encontre server.py en $PUBLIC_HTML"
    echo "Sube el archivo server.py a tu public_html primero."
    exit 1
fi

echo "OK: server.py encontrado"
echo ""

# Crear carpeta del backend si no existe
BACKEND_DIR="/opt/gradeprophet/backend"
mkdir -p "$BACKEND_DIR"
echo "Carpeta backend: $BACKEND_DIR"

# Paso 1: Copiar server.py
echo ""
echo "[1/6] Copiando server.py..."
cp -f "$PUBLIC_HTML/server.py" "$BACKEND_DIR/server.py"
echo "  OK: server.py copiado a $BACKEND_DIR/"

# Paso 2: Crear/verificar .env
echo ""
echo "[2/6] Verificando .env..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "  Creando .env nuevo..."
    cat > "$BACKEND_DIR/.env" << 'ENVEOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=gradeprophet
CORS_ORIGINS=*
OPENAI_API_KEY=PONER_TU_CLAVE_AQUI
SCRAPEDO_API_KEY=SCRAPEDO_KEY_REMOVED
ENVEOF
    echo "  IMPORTANTE: Edita el .env con tu OPENAI_API_KEY:"
    echo "  nano $BACKEND_DIR/.env"
else
    echo "  .env ya existe - no lo toco"
    # Verificar la clave SCRAPEDO
    if grep -q "6a0abbb7" "$BACKEND_DIR/.env"; then
        echo "  CORRIGIENDO clave SCRAPEDO (tenia 6a en vez de 6e)..."
        sed -i 's/SCRAPEDO_API_KEY=.*/SCRAPEDO_API_KEY=SCRAPEDO_KEY_REMOVED/' "$BACKEND_DIR/.env"
        echo "  OK: Clave corregida"
    fi
fi

# Mostrar contenido de .env (sin mostrar claves completas)
echo "  Contenido de .env:"
while IFS='=' read -r key value; do
    if [ -n "$key" ] && [[ ! "$key" =~ ^# ]]; then
        echo "    $key = ${value:0:10}..."
    fi
done < "$BACKEND_DIR/.env"

# Paso 3: Activar virtualenv si existe
echo ""
echo "[3/6] Verificando virtualenv..."
if [ -d "/opt/gradeprophet/venv" ]; then
    source /opt/gradeprophet/venv/bin/activate
    echo "  OK: virtualenv activado"
elif [ -d "/home/gradeprophet/venv" ]; then
    source /home/gradeprophet/venv/bin/activate
    echo "  OK: virtualenv activado"
else
    echo "  No se encontro virtualenv, usando Python del sistema"
fi

# Paso 4: Instalar dependencias
echo ""
echo "[4/6] Instalando dependencias de Python..."
pip3 install fastapi uvicorn motor python-dotenv httpx openai pillow pydantic regex python-multipart 2>&1 | tail -5
echo "  OK: Dependencias instaladas"

# Paso 5: Matar backend viejo y arrancar nuevo
echo ""
echo "[5/6] Reiniciando backend..."
pkill -f "uvicorn.*8001" 2>/dev/null || true
sleep 3

cd "$BACKEND_DIR"
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$BACKEND_DIR/backend.log" 2>&1 &
NEW_PID=$!
echo "  OK: Backend arrancado (PID: $NEW_PID)"

# Paso 6: Esperar y verificar
echo ""
echo "[6/6] Verificando (esperando 8 segundos)..."
sleep 8

RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null || echo "FAIL")
if echo "$RESULT" | grep -q "GradeProphet"; then
    echo ""
    echo "============================================"
    echo "  EXITO! Backend funcionando!"
    echo "============================================"
    echo ""
    echo "  Ahora abre en tu navegador:"
    echo "  http://flipslabengine.com/api/test-ebay"
    echo ""
    echo "  Si dice SUCCESS, todo funciona!"
    echo ""
    echo "  Para ver logs: tail -f $BACKEND_DIR/backend.log"
    echo ""
    
    # Limpiar archivos de public_html (seguridad)
    echo "  Limpiando archivos de public_html (por seguridad)..."
    rm -f "$PUBLIC_HTML/server.py" 2>/dev/null
    rm -f "$PUBLIC_HTML/instalar.sh" 2>/dev/null
    echo "  OK: Archivos limpiados de public_html"
else
    echo ""
    echo "============================================"
    echo "  ERROR: Backend no responde"
    echo "============================================"
    echo ""
    echo "  Revisa el log:"
    echo "  tail -30 $BACKEND_DIR/backend.log"
    echo ""
    echo "  Ultimas lineas del log:"
    tail -15 "$BACKEND_DIR/backend.log" 2>/dev/null
fi
