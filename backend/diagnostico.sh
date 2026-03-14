#!/bin/bash
echo "============================================"
echo "  FlipSlab Engine - Diagnostico del Servidor"
echo "============================================"
echo ""

echo "=== 1. SISTEMA ==="
echo "Hostname: $(hostname)"
echo "OS: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2)"
echo ""

echo "=== 2. DIRECTORIOS DEL PROYECTO ==="
echo "--- /opt/gradeprophet ---"
ls -la /opt/gradeprophet/ 2>/dev/null || echo "NO EXISTE"
echo ""
echo "--- /opt/gradeprophet/backend ---"
ls -la /opt/gradeprophet/backend/ 2>/dev/null || echo "NO EXISTE"
echo ""
echo "--- /opt/gradeprophet/backend/routers ---"
ls -la /opt/gradeprophet/backend/routers/ 2>/dev/null || echo "NO EXISTE (backend viejo)"
echo ""
echo "--- /opt/gradeprophet/frontend ---"
ls -la /opt/gradeprophet/frontend/ 2>/dev/null || echo "NO EXISTE"
echo ""

echo "=== 3. BUSCANDO index.html (frontend) ==="
find /opt/gradeprophet -name "index.html" 2>/dev/null
find /home -name "index.html" -path "*/public_html/*" 2>/dev/null
find /var/www -name "index.html" 2>/dev/null
echo ""

echo "=== 4. BUSCANDO DONDE SIRVE NGINX/APACHE ==="
grep -r "root\|DocumentRoot\|proxy_pass" /etc/nginx/sites-enabled/ 2>/dev/null | head -10
grep -r "root\|DocumentRoot\|proxy_pass" /etc/nginx/conf.d/ 2>/dev/null | head -10
grep -r "DocumentRoot" /etc/apache2/sites-enabled/ 2>/dev/null | head -10
grep -r "DocumentRoot" /etc/httpd/conf.d/ 2>/dev/null | head -10
echo ""

echo "=== 5. BACKEND STATUS ==="
echo "Puerto 8001:"
lsof -ti:8001 2>/dev/null && echo "ACTIVO" || echo "NO ACTIVO"
echo ""
echo "Proceso uvicorn:"
ps aux | grep uvicorn | grep -v grep
echo ""

echo "=== 6. ARCHIVOS .ENV ==="
echo "--- Backend .env ---"
cat /opt/gradeprophet/backend/.env 2>/dev/null | grep -v "KEY\|SECRET\|PASSWORD\|TOKEN" | head -5
echo "(llaves ocultas por seguridad)"
echo ""
echo "--- Frontend .env ---"
cat /opt/gradeprophet/frontend/.env 2>/dev/null || echo "NO EXISTE"
echo ""

echo "=== 7. ULTIMOS LOGS DEL BACKEND ==="
tail -30 /opt/gradeprophet/backend/backend.log 2>/dev/null || echo "NO HAY LOG"
echo ""

echo "=== 8. FRONTEND BUILD INFO ==="
echo "--- public_html ---"
ls /home/flipcardsuni2/public_html/static/js/ 2>/dev/null | tail -5 || echo "NO EXISTE en public_html"
echo ""
echo "--- frontend/build ---"
ls /opt/gradeprophet/frontend/build/static/js/ 2>/dev/null | tail -5 || echo "NO EXISTE en frontend/build"
echo ""

echo "=== 9. RESULTADO DEL fix.sh ==="
echo "Verificando si fix.sh copio los archivos:"
echo "server.py lines: $(wc -l < /opt/gradeprophet/backend/server.py 2>/dev/null || echo 'NO EXISTE')"
echo "routers dir: $(ls /opt/gradeprophet/backend/routers/*.py 2>/dev/null | wc -l) archivos"
echo "utils dir: $(ls /opt/gradeprophet/backend/utils/*.py 2>/dev/null | wc -l) archivos"
echo ""

echo "=== 10. TEST API ==="
curl -s http://localhost:8001/api/ 2>/dev/null || echo "API NO RESPONDE en localhost:8001"
echo ""

echo "============================================"
echo "  Copia todo este resultado y pegamelo"
echo "============================================"
