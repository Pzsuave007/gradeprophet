#!/bin/bash
echo "=== FlipSlab Engine - Update Landing Page ==="
echo "Actualizando LandingPage.jsx con nuevas imagenes y layout..."

cd /opt/gradeprophet || cd /home/gradeprophet || { echo "ERROR: No se encontro el directorio del proyecto"; exit 1; }

git pull

echo "Reiniciando frontend..."
cd frontend
npm run build 2>/dev/null || yarn build 2>/dev/null

echo ""
echo "=== Update completo! ==="
echo "Cambios aplicados:"
echo "  - Tarjeta de Brady mas grande y al mismo nivel que Kobe"
echo "  - Seccion Features con imagenes generadas por AI"
echo "  - Menos espacio entre Hero y Features"
echo ""
echo "Refresca tu navegador para ver los cambios."
