#!/bin/bash
# ============================================
# PRODUCTION BUILD SCRIPT - FlipSlab Engine
# ============================================
# ALWAYS use this script to build the frontend.
# It forces the production URL regardless of what's in .env
# Usage: bash build_prod.sh
# ============================================

PROD_URL="https://flipslabengine.com"

echo "Building frontend with REACT_APP_BACKEND_URL=$PROD_URL"
cd /app/frontend && REACT_APP_BACKEND_URL=$PROD_URL yarn build

# Verify no preview URL leaked into the build
if grep -r "preview.emergentagent.com" /app/frontend/build/ 2>/dev/null; then
  echo "ERROR: Preview URL found in build! Something went wrong."
  exit 1
fi

echo "Build complete. Ready for deploy."
