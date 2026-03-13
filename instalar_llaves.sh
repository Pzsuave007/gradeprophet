#!/bin/bash
echo "=== FlipSlab Engine - Instalador de Llaves ==="

# Detectar directorio
PROJECT_DIR=""
if [ -d "/opt/gradeprophet" ]; then
    PROJECT_DIR="/opt/gradeprophet"
elif [ -d "/home/gradeprophet" ]; then
    PROJECT_DIR="/home/gradeprophet"
else
    echo "ERROR: No se encontro el directorio del proyecto"
    exit 1
fi

# Buscar llaves.txt
LLAVES_FILE=""
if [ -f "/home/gradeprophet/public_html/llaves.txt" ]; then
    LLAVES_FILE="/home/gradeprophet/public_html/llaves.txt"
elif [ -f "/home/gradeprophet/llaves.txt" ]; then
    LLAVES_FILE="/home/gradeprophet/llaves.txt"
elif [ -f "$PROJECT_DIR/llaves.txt" ]; then
    LLAVES_FILE="$PROJECT_DIR/llaves.txt"
else
    echo "ERROR: No se encontro llaves.txt"
    echo "Ponlo en: /home/gradeprophet/public_html/llaves.txt"
    exit 1
fi

echo "Leyendo llaves de: $LLAVES_FILE"

# Leer las llaves del archivo
MONGO_URL=$(grep "^MONGO_URL=" "$LLAVES_FILE" | cut -d'=' -f2-)
DB_NAME=$(grep "^DB_NAME=" "$LLAVES_FILE" | cut -d'=' -f2-)
EBAY_CLIENT_ID=$(grep "^EBAY_CLIENT_ID=" "$LLAVES_FILE" | cut -d'=' -f2-)
EBAY_CLIENT_SECRET=$(grep "^EBAY_CLIENT_SECRET=" "$LLAVES_FILE" | cut -d'=' -f2-)
EBAY_DEV_ID=$(grep "^EBAY_DEV_ID=" "$LLAVES_FILE" | cut -d'=' -f2-)
EBAY_RUNAME=$(grep "^EBAY_RUNAME=" "$LLAVES_FILE" | cut -d'=' -f2-)
EMERGENT_LLM_KEY=$(grep "^EMERGENT_LLM_KEY=" "$LLAVES_FILE" | cut -d'=' -f2-)
SCRAPEDO_API_KEY=$(grep "^SCRAPEDO_API_KEY=" "$LLAVES_FILE" | cut -d'=' -f2-)
REACT_APP_BACKEND_URL=$(grep "^REACT_APP_BACKEND_URL=" "$LLAVES_FILE" | cut -d'=' -f2-)

# Crear backend/.env
echo "Creando backend/.env..."
cat > "$PROJECT_DIR/backend/.env" << ENVFILE
MONGO_URL=${MONGO_URL}
DB_NAME=${DB_NAME}
EBAY_CLIENT_ID=${EBAY_CLIENT_ID}
EBAY_CLIENT_SECRET=${EBAY_CLIENT_SECRET}
EBAY_DEV_ID=${EBAY_DEV_ID}
EBAY_RUNAME=${EBAY_RUNAME}
EMERGENT_LLM_KEY=${EMERGENT_LLM_KEY}
SCRAPEDO_API_KEY=${SCRAPEDO_API_KEY}
CORS_ORIGINS=*
ENVFILE

echo "  backend/.env creado OK"

# Crear frontend/.env
echo "Creando frontend/.env..."
cat > "$PROJECT_DIR/frontend/.env" << ENVFILE
REACT_APP_BACKEND_URL=${REACT_APP_BACKEND_URL}
ENVFILE

echo "  frontend/.env creado OK"

# Verificar
echo ""
echo "=== Verificacion ==="
echo "Backend .env:"
cat "$PROJECT_DIR/backend/.env" | sed 's/=.*$/=***/' 
echo ""
echo "Frontend .env:"
cat "$PROJECT_DIR/frontend/.env"

echo ""
echo "=== Llaves instaladas! ==="
echo "Ahora reinicia los servicios:"
echo "  cd $PROJECT_DIR && bash restartback.sh"
echo "  cd $PROJECT_DIR/frontend && npm run build"
