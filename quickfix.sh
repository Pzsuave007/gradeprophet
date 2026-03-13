#!/bin/bash
echo "=== Quick Update ==="
cd /home/gradeprophet && git pull
cp /home/gradeprophet/frontend/src/components/AuthPage.jsx /opt/gradeprophet/frontend/src/components/
cd /opt/gradeprophet/frontend && npm run build --legacy-peer-deps
cp -r build/* /home/flipcardsuni2/public_html/
echo "=== Listo! Prueba el Google Login ==="
