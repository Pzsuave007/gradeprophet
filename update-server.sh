#!/bin/bash
echo "=== Actualizando GradeProphet ==="

cd /home/gradeprophet
git pull origin main

echo "Copiando archivos..."
cp -r backend/* /opt/gradeprophet/backend/
cp -r frontend/* /opt/gradeprophet/frontend/

echo "Compilando frontend..."
cd /opt/gradeprophet/frontend
yarn build

echo "Agregando Scrape.do API key..."
grep -q "SCRAPEDO_API_KEY" /opt/gradeprophet/backend/.env || echo "SCRAPEDO_API_KEY=6e0abbb7f9dc4639860d4eac6eac4f28228774a75f0" >> /opt/gradeprophet/backend/.env

echo "Arreglando formato de archivo..."
sed -i 's/\r$//' /opt/gradeprophet/backend/.env

echo "Reiniciando servicios..."
systemctl restart gradeprophet-backend
systemctl restart gradeprophet-frontend

echo ""
echo "=== LISTO! ==="
echo "Tu app esta actualizada en: https://flipslabengine.com"
