#!/bin/bash
# ============================================
# GradeProphet - Script de Instalacion Completo
# ============================================
# Este script instala y arranca el backend API
# Ejecutar: bash install_server.sh
# ============================================

set -e

echo "============================================"
echo "  GradeProphet - Instalacion del Backend"
echo "============================================"
echo ""

# Detectar donde esta el codigo
APP_DIR=""
if [ -d "/opt/gradeprophet/backend" ]; then
    APP_DIR="/opt/gradeprophet"
elif [ -d "/home/gradeprophet/backend" ]; then
    APP_DIR="/home/gradeprophet"
elif [ -d "$(pwd)/backend" ]; then
    APP_DIR="$(pwd)"
else
    echo "ERROR: No se encontro la carpeta 'backend'."
    echo "Ejecuta este script desde la carpeta donde esta tu proyecto."
    echo "O pon el codigo en /opt/gradeprophet/"
    exit 1
fi

echo "Carpeta del proyecto: $APP_DIR"
BACKEND_DIR="$APP_DIR/backend"
echo "Carpeta backend: $BACKEND_DIR"
echo ""

# Paso 1: Verificar Python
echo "[1/6] Verificando Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "  OK: $PYTHON_VERSION"
else
    echo "  ERROR: Python3 no esta instalado."
    echo "  Instala con: sudo yum install python3 python3-pip (AlmaLinux)"
    echo "  O: sudo apt install python3 python3-pip (Ubuntu)"
    exit 1
fi

# Paso 2: Verificar pip
echo ""
echo "[2/6] Verificando pip..."
if command -v pip3 &> /dev/null; then
    echo "  OK: pip3 disponible"
else
    echo "  Instalando pip..."
    python3 -m ensurepip --upgrade 2>/dev/null || {
        echo "  ERROR: No se pudo instalar pip."
        echo "  Instala manualmente: sudo yum install python3-pip"
        exit 1
    }
fi

# Paso 3: Verificar .env
echo ""
echo "[3/6] Verificando archivo .env..."
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo "  CREANDO .env con valores por defecto..."
    cat > "$BACKEND_DIR/.env" << 'ENVEOF'
MONGO_URL=mongodb://localhost:27017
DB_NAME=gradeprophet
CORS_ORIGINS=*
OPENAI_API_KEY=TU_CLAVE_OPENAI_AQUI
SCRAPEDO_API_KEY=TU_CLAVE_SCRAPEDO_AQUI
ENVEOF
    echo "  IMPORTANTE: Edita $BACKEND_DIR/.env con tus claves reales!"
    echo "  nano $BACKEND_DIR/.env"
else
    echo "  OK: .env existe"
    # Verificar que las claves estan presentes
    if grep -q "SCRAPEDO_API_KEY" "$BACKEND_DIR/.env"; then
        SCRAPEDO_VAL=$(grep "SCRAPEDO_API_KEY" "$BACKEND_DIR/.env" | cut -d'=' -f2)
        if [ -z "$SCRAPEDO_VAL" ] || [ "$SCRAPEDO_VAL" = "TU_CLAVE_SCRAPEDO_AQUI" ]; then
            echo "  ADVERTENCIA: SCRAPEDO_API_KEY esta vacia o es el valor por defecto!"
        else
            echo "  OK: SCRAPEDO_API_KEY configurada (${#SCRAPEDO_VAL} caracteres)"
        fi
    else
        echo "  ADVERTENCIA: SCRAPEDO_API_KEY no esta en .env! Agregandola..."
        echo "SCRAPEDO_API_KEY=" >> "$BACKEND_DIR/.env"
        echo "  Edita .env y agrega tu clave: nano $BACKEND_DIR/.env"
    fi
    
    if grep -q "OPENAI_API_KEY" "$BACKEND_DIR/.env"; then
        OPENAI_VAL=$(grep "OPENAI_API_KEY" "$BACKEND_DIR/.env" | cut -d'=' -f2)
        if [ -z "$OPENAI_VAL" ] || [ "$OPENAI_VAL" = "TU_CLAVE_OPENAI_AQUI" ]; then
            echo "  ADVERTENCIA: OPENAI_API_KEY esta vacia o es el valor por defecto!"
        else
            echo "  OK: OPENAI_API_KEY configurada"
        fi
    fi
fi

# Paso 4: Instalar dependencias
echo ""
echo "[4/6] Instalando dependencias de Python..."
cd "$BACKEND_DIR"
pip3 install --user fastapi uvicorn motor python-dotenv httpx openai pillow pydantic regex python-multipart 2>&1 | tail -5
echo "  Dependencias instaladas"

# Paso 5: Detener backend anterior
echo ""
echo "[5/6] Deteniendo backend anterior (si existe)..."
# Matar cualquier proceso uvicorn en puerto 8001
PIDS=$(lsof -ti:8001 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo "  Matando procesos en puerto 8001: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
    sleep 2
else
    echo "  No habia backend corriendo"
fi

# Tambien buscar por nombre
pkill -f "uvicorn.*server:app.*8001" 2>/dev/null || true
sleep 1

# Paso 6: Arrancar backend
echo ""
echo "[6/6] Arrancando backend..."
cd "$BACKEND_DIR"

# Crear archivo de log
LOG_FILE="$BACKEND_DIR/backend.log"
touch "$LOG_FILE"

# Arrancar con nohup en background
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > "$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "  Backend arrancado con PID: $BACKEND_PID"
echo "  Log: $LOG_FILE"

# Esperar un momento para que arranque
echo ""
echo "Esperando 5 segundos para que arranque..."
sleep 5

# Verificar que esta corriendo
if kill -0 $BACKEND_PID 2>/dev/null; then
    echo ""
    echo "============================================"
    echo "  INSTALACION EXITOSA!"
    echo "============================================"
    echo ""
    echo "  Backend corriendo en: http://localhost:8001"
    echo "  PID: $BACKEND_PID"
    echo "  Log: $LOG_FILE"
    echo ""
    echo "  Para verificar, abre en tu navegador:"
    echo "  http://TU_DOMINIO/api/test-ebay"
    echo ""
    echo "  Para ver logs:"
    echo "  tail -f $LOG_FILE"
    echo ""
    echo "  Para detener:"
    echo "  kill $BACKEND_PID"
    echo ""
    
    # Quick test
    echo "Probando API..."
    sleep 2
    RESULT=$(curl -s http://localhost:8001/api/ 2>/dev/null || echo "NO_RESPONSE")
    if echo "$RESULT" | grep -q "GradeProphet"; then
        echo "  API respondiendo correctamente!"
    else
        echo "  API no responde aun. Revisa el log:"
        echo "  tail -20 $LOG_FILE"
    fi
else
    echo ""
    echo "============================================"
    echo "  ERROR: El backend no arranco"
    echo "============================================"
    echo ""
    echo "  Revisa el log para ver el error:"
    echo "  tail -50 $LOG_FILE"
    echo ""
    # Show last few lines of log
    echo "  Ultimas lineas del log:"
    tail -20 "$LOG_FILE" 2>/dev/null || echo "  (log vacio)"
fi
