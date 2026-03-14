#!/bin/bash
echo "Descargando frontend nuevo..."
cd /home/flipcardsuni2/public_html
rm -rf static/js/ static/css/ static/media/
curl -s https://trading-platform-212.preview.emergentagent.com/api/download-frontend | tar xzf - --strip-components=1 -C /home/flipcardsuni2/public_html/
echo "JS: $(grep -o 'main\.[a-f0-9]*\.js' index.html)"
echo "LISTO! Abre flipslabengine.com con Ctrl+Shift+R"
