#!/bin/bash
# Script para actualizar GradeProphet en el servidor

echo "Actualizando GradeProphet..."

# Copiar backend
cp -r /var/www/gradeprophet/backend/* /opt/gradeprophet/backend/

# Copiar frontend
cp -r /var/www/gradeprophet/frontend/* /opt/gradeprophet/frontend/

# Matar el backend viejo
pkill -f "uvicorn server:app.*8001"

# Instalar dependencias y reiniciar
cd /opt/gradeprophet/backend
source venv/bin/activate
pip install -r requirements.txt
nohup uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2 > /dev/null 2>&1 &

echo "GradeProphet actualizado!"
