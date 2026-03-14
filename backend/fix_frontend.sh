#!/bin/bash
# ============================================
#  FlipSlab - Actualizar FRONTEND solamente
#  Corre: bash fix_frontend.sh
# ============================================
echo "Actualizando frontend..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="/home/flipcardsuni2/public_html"

if [ ! -d "$SCRIPT_DIR/frontend_build" ]; then
    echo "ERROR: No se encontro frontend_build/"
    echo "Asegurate de extraer el tar.gz primero"
    exit 1
fi

# Borrar archivos JS/CSS viejos
echo "  Borrando archivos viejos..."
rm -rf "$TARGET/static/js/"
rm -rf "$TARGET/static/css/"
rm -rf "$TARGET/static/media/"

# Copiar nuevos
echo "  Copiando archivos nuevos..."
cp -rf "$SCRIPT_DIR/frontend_build/"* "$TARGET/"

# Verificar
NEW_JS=$(ls "$TARGET/static/js/main."*.js 2>/dev/null | head -1)
if [ -n "$NEW_JS" ]; then
    echo ""
    echo "EXITO! Frontend actualizado"
    echo "  JS: $(basename $NEW_JS)"
    echo "  index.html: $(grep -o 'main\.[a-f0-9]*\.js' $TARGET/index.html)"
    echo ""
    echo "  Abre flipslabengine.com y haz Ctrl+Shift+R"
else
    echo "ERROR: No se copiaron los archivos"
    echo "Intenta manualmente:"
    echo "  cp -rf $SCRIPT_DIR/frontend_build/* $TARGET/"
fi
