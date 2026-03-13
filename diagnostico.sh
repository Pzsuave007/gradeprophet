#!/bin/bash
echo "========================================="
echo " FlipSlab Engine - Diagnostico"
echo "========================================="
echo ""

echo "=== 1. Web Server Status ==="
systemctl status httpd 2>/dev/null | head -5
systemctl status nginx 2>/dev/null | head -5
systemctl status apache2 2>/dev/null | head -5
echo ""

echo "=== 2. Backend Status ==="
curl -s http://localhost:8001/api/ 2>/dev/null || echo "Backend NOT responding on port 8001"
echo ""

echo "=== 3. Frontend Build ==="
ls -la /home/flipcardsuni2/public_html/index.html 2>/dev/null || echo "index.html NOT found"
echo ""

echo "=== 4. Puertos Abiertos ==="
ss -tlnp | grep -E "80|443|8001"
echo ""

echo "=== 5. Backend Process ==="
ps aux | grep uvicorn | grep -v grep
echo ""

echo "=== 6. Backend Log (last 20 lines) ==="
tail -20 /opt/gradeprophet/backend/backend.log 2>/dev/null || echo "No backend log found"
echo ""

echo "=== 7. Firewall ==="
firewall-cmd --list-ports 2>/dev/null || iptables -L -n 2>/dev/null | head -15 || echo "No firewall info"
echo ""

echo "=== 8. .env exists? ==="
ls -la /opt/gradeprophet/backend/.env 2>/dev/null || echo ".env NOT found at /opt/gradeprophet/backend/"
echo ""

echo "=== 9. SSL Cert ==="
ls -la /etc/letsencrypt/live/flipslabengine.com/ 2>/dev/null || echo "No SSL cert found for flipslabengine.com"
ls -la /etc/httpd/conf.d/ssl* 2>/dev/null || echo "No SSL config in httpd"
ls -la /etc/nginx/conf.d/ 2>/dev/null || echo "No nginx conf.d"
echo ""

echo "=== 10. DNS Check ==="
dig +short flipslabengine.com 2>/dev/null || nslookup flipslabengine.com 2>/dev/null | tail -3
echo ""

echo "========================================="
echo " Diagnostico completo"
echo "========================================="
