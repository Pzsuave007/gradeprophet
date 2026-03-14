#!/bin/bash
echo "=== Buscando donde sirve Apache ==="
echo ""
echo "1. Todos los index.html:"
find /home/flipcardsuni2 -name "index.html" -not -path "*/node_modules/*" 2>/dev/null
echo ""
echo "2. Apache document roots:"
grep -r "DocumentRoot\|ServerName\|ServerAlias" /etc/apache2/ /etc/httpd/ /usr/local/apache/ 2>/dev/null | grep -i "flipslab\|flipcard" | head -10
echo ""
echo "3. Virtual hosts:"
httpd -S 2>/dev/null | grep -i "flipslab\|flipcard\|public_html" | head -10
echo ""
echo "4. Addon domains:"
cat /home/flipcardsuni2/etc/*/main 2>/dev/null | head -5
ls /home/flipcardsuni2/public_html/*/index.html 2>/dev/null
echo ""
echo "5. El viejo JS existe en:"
find /home/flipcardsuni2 -name "main.295247f4.js" 2>/dev/null
