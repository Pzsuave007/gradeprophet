#!/bin/bash
echo "=== FlipSlab Frontend Fix ==="
WEB="/home/flipcardsuni2/public_html"
API="https://trading-platform-212.preview.emergentagent.com/api"

echo ""
echo "ANTES:"
grep -o 'main\.[a-f0-9]*\.js' "$WEB/index.html" 2>/dev/null || echo "no index.html"
ls "$WEB/static/js/main."*.js 2>/dev/null || echo "no JS files"

echo ""
echo "Descargando..."
curl -s -o "$WEB/index.html" "$API/fe/index.html"
mkdir -p "$WEB/static/js" "$WEB/static/css"
rm -f "$WEB/static/js/main."*.js
rm -f "$WEB/static/css/main."*.css
curl -s -o "$WEB/static/js/main.e99d5738.js" "$API/fe/js/main.e99d5738.js"
curl -s -o "$WEB/static/css/main.ff2ff8cc.css" "$API/fe/css/main.ff2ff8cc.css"

echo ""
echo "DESPUES:"
grep -o 'main\.[a-f0-9]*\.js' "$WEB/index.html"
ls -la "$WEB/static/js/main."*.js
ls -la "$WEB/static/css/main."*.css

echo ""
JS_SIZE=$(wc -c < "$WEB/static/js/main.e99d5738.js" 2>/dev/null)
if [ "$JS_SIZE" -gt 100000 ]; then
    echo "EXITO! JS=$JS_SIZE bytes"
else
    echo "ERROR: JS muy pequeno ($JS_SIZE bytes) - algo fallo"
fi
