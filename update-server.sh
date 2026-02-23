#!/bin/bash
# ===========================================
# GradeProphet - Script de Actualizacion
# Version: 2.0 - Fix selector imagenes eBay
# ===========================================

echo ""
echo "============================================"
echo "    ACTUALIZANDO GRADEPROPHET"
echo "============================================"
echo ""

# Paso 1: Ir al directorio del codigo
echo "[1/5] Descargando actualizaciones de GitHub..."
cd /home/gradeprophet || { echo "ERROR: No se encontro /home/gradeprophet"; exit 1; }
git pull origin main
echo "      Codigo descargado!"
echo ""

# Paso 2: Copiar archivos
echo "[2/5] Copiando archivos actualizados..."
cp -r backend/* /opt/gradeprophet/backend/
cp -r frontend/* /opt/gradeprophet/frontend/
echo "      Archivos copiados!"
echo ""

# Paso 3: Compilar frontend
echo "[3/5] Compilando frontend (esto tarda ~1 minuto)..."
cd /opt/gradeprophet/frontend
yarn build
echo "      Frontend compilado!"
echo ""

# Paso 4: Verificar API keys en .env
echo "[4/5] Verificando configuracion..."
if ! grep -q "SCRAPEDO_API_KEY" /opt/gradeprophet/backend/.env; then
    echo "SCRAPEDO_API_KEY=6e0abbb7f9dc4639860d4eac6eac4f28228774a75f0" >> /opt/gradeprophet/backend/.env
    echo "      Se agrego SCRAPEDO_API_KEY"
fi
# Limpiar caracteres de Windows si hay
sed -i 's/\r$//' /opt/gradeprophet/backend/.env
echo "      Configuracion OK!"
echo ""

# Paso 5: Reiniciar servicios
echo "[5/5] Reiniciando servicios..."
systemctl restart gradeprophet-backend
sleep 2
systemctl restart gradeprophet-frontend
sleep 2
echo "      Servicios reiniciados!"
echo ""

echo "============================================"
echo "    ACTUALIZACION COMPLETADA!"
echo "============================================"
echo ""
echo "  Tu app esta lista en:"
echo "  https://flipslabengine.com"
echo ""
echo "  Cambios aplicados:"
echo "  - Fix: Ahora puedes seleccionar imagenes"
echo "    importadas de eBay con un clic"
echo ""
echo "============================================"
