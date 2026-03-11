#!/bin/bash
# Correr: bash /home/flipcardsuni2/public_html/fix.sh

# 1. Corregir la clave SCRAPEDO (6a -> 6e)
sed -i 's/6a0abbb7/6e0abbb7/' /opt/gradeprophet/backend/.env
echo "Clave SCRAPEDO corregida"

# 2. Reiniciar backend
pkill -f "uvicorn.*8001" 2>/dev/null; sleep 3
cd /opt/gradeprophet/backend
source /opt/gradeprophet/venv/bin/activate 2>/dev/null
nohup python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload > backend.log 2>&1 &
echo "Backend reiniciado"

# 3. Verificar
sleep 5
curl -s http://localhost:8001/api/ && echo "" && echo "API OK!"
