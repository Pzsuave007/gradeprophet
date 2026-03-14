#!/bin/bash
echo "=== DIAGNOSTICO COMPLETO ==="
echo ""
echo "1. Contenido REAL del index.html en disco:"
head -1 /home/flipcardsuni2/public_html/index.html
echo ""
echo ""
echo "2. Existe .htaccess?"
cat /home/flipcardsuni2/public_html/.htaccess 2>/dev/null || echo "NO EXISTE"
echo ""
echo "3. Creando test.txt..."
echo "FLIPSLAB_TEST_OK" > /home/flipcardsuni2/public_html/test.txt
echo "4. Modulos de cache en Apache:"
httpd -M 2>/dev/null | grep -i "cache\|pagespeed\|proxy" || echo "ninguno"
echo ""
echo "5. TODOS los JS en public_html:"
find /home/flipcardsuni2/public_html/static/js/ -name "*.js" 2>/dev/null
echo ""
echo "6. md5 del index.html:"
md5sum /home/flipcardsuni2/public_html/index.html
echo ""
echo "AHORA ABRE: https://flipslabengine.com/test.txt"
echo "Debe decir FLIPSLAB_TEST_OK"
