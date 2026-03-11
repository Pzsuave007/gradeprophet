#!/bin/bash
# Script para diagnosticar y reiniciar GradeProphet

echo "=== Verificando configuración ==="

# Verificar API key de Scrape.do
echo "SCRAPEDO_API_KEY:"
grep SCRAPEDO /opt/gradeprophet/backend/.env

echo ""
echo "=== Reiniciando backend ==="

# Matar proceso viejo
pkill -f "uvicorn.*8001"
sleep 2

# Ir al directorio del backend
cd /opt/gradeprophet/backend
source venv/bin/activate

# Iniciar backend en primer plano para ver errores
echo "Iniciando backend... (Ctrl+C para salir después de probar)"
echo ""
uvicorn server:app --host 127.0.0.1 --port 8001 --workers 1
