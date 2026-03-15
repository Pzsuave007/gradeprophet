from fastapi import FastAPI, APIRouter
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import logging
import os
import glob

from database import db, client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="FlipSlab Engine", version="2.0")

# CORS
cors_origins = os.environ.get("CORS_ORIGINS", "*")
if cors_origins == "*":
    origins = ["*"]
else:
    origins = [o.strip() for o in cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import routers
from routers.auth import router as auth_router
from routers.cards import router as cards_router
from routers.inventory import router as inventory_router
from routers.market import router as market_router
from routers.portfolio import router as portfolio_router
from routers.alerts import router as alerts_router
from routers.dashboard import router as dashboard_router
from routers.ebay import router as ebay_router
from routers.flipfinder import router as flipfinder_router, sniper_background_loop
from routers.settings import router as settings_router

# Create parent API router
api_router = APIRouter(prefix="/api")

# Include all sub-routers
api_router.include_router(auth_router)
api_router.include_router(cards_router)
api_router.include_router(inventory_router)
api_router.include_router(market_router)
api_router.include_router(portfolio_router)
api_router.include_router(alerts_router)
api_router.include_router(dashboard_router)
api_router.include_router(ebay_router)
api_router.include_router(flipfinder_router)
api_router.include_router(settings_router)


# Root endpoint
@api_router.get("/")
async def root():
    return {"status": "FlipSlab Engine API v2.0", "modules": [
        "auth", "cards", "inventory", "market", "portfolio",
        "alerts", "dashboard", "ebay", "flipfinder", "settings"
    ]}


# Download endpoint for deployment package
@api_router.get("/download-update")
async def download_update():
    file_path = Path(__file__).parent / "flipslab_update.tar.gz"
    if not file_path.exists():
        return {"error": "Update package not found"}
    return FileResponse(
        path=str(file_path),
        filename="flipslab_update.tar.gz",
        media_type="application/gzip"
    )

# Download diagnostic script
@api_router.get("/download-diagnostico")
async def download_diagnostico():
    file_path = Path(__file__).parent / "diagnostico.sh"
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(
        path=str(file_path),
        filename="diagnostico.sh",
        media_type="text/plain"
    )

# Download frontend fix script
@api_router.get("/download-fix-frontend")
async def download_fix_frontend():
    file_path = Path(__file__).parent / "fix_frontend.sh"
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(
        path=str(file_path),
        filename="fix_frontend.sh",
        media_type="text/plain"
    )

# Download fix2.sh - generated dynamically with correct file names
@api_router.get("/download-fix2")
async def download_fix2():
    base = Path(__file__).parent / ".." / "frontend" / "build"
    # Find the actual JS and CSS filenames
    js_files = glob.glob(str(base / "static" / "js" / "main.*.js"))
    css_files = glob.glob(str(base / "static" / "css" / "main.*.css"))
    js_name = Path(js_files[0]).name if js_files else "main.js"
    css_name = Path(css_files[0]).name if css_files else "main.css"
    api_base = "https://trader-dashboard-82.preview.emergentagent.com"

    script = f"""#!/bin/bash
echo "=== FlipSlab Frontend Update ==="
TARGET="/home/flipcardsuni2/public_html"
API="{api_base}"

echo "[1/3] Descargando index.html..."
curl -s -o "$TARGET/index.html" "$API/api/fe/index.html"

echo "[2/3] Descargando JS ({js_name})..."
mkdir -p "$TARGET/static/js"
rm -f "$TARGET/static/js/main."*.js
curl -s -o "$TARGET/static/js/{js_name}" "$API/api/fe/js/{js_name}"

echo "[3/3] Descargando CSS ({css_name})..."
mkdir -p "$TARGET/static/css"
rm -f "$TARGET/static/css/main."*.css
curl -s -o "$TARGET/static/css/{css_name}" "$API/api/fe/css/{css_name}"

echo ""
echo "Verificando..."
if [ -f "$TARGET/static/js/{js_name}" ] && [ -s "$TARGET/static/js/{js_name}" ]; then
    SIZE=$(wc -c < "$TARGET/static/js/{js_name}")
    echo "JS: {js_name} ($SIZE bytes) OK"
    echo "LISTO! Abre flipslabengine.com con Ctrl+Shift+R"
else
    echo "ERROR: JS no se descargo"
fi
"""
    return PlainTextResponse(content=script, media_type="text/plain")

# Serve individual frontend files
@api_router.get("/fe/index.html")
async def serve_index():
    p = Path(__file__).parent / ".." / "frontend" / "build" / "index.html"
    return FileResponse(path=str(p.resolve()), media_type="text/html")

@api_router.get("/fe/js/{filename}")
async def serve_js(filename: str):
    p = Path(__file__).parent / ".." / "frontend" / "build" / "static" / "js" / filename
    if not p.resolve().exists():
        return PlainTextResponse("Not found", status_code=404)
    return FileResponse(path=str(p.resolve()), media_type="application/javascript")

@api_router.get("/fe/css/{filename}")
async def serve_css(filename: str):
    p = Path(__file__).parent / ".." / "frontend" / "build" / "static" / "css" / filename
    if not p.resolve().exists():
        return PlainTextResponse("Not found", status_code=404)
    return FileResponse(path=str(p.resolve()), media_type="text/css")

# Download frontend build directly
@api_router.get("/download-frontend")
async def download_frontend():
    file_path = Path(__file__).parent / "frontend_build.tar.gz"
    if not file_path.exists():
        return {"error": "File not found"}
    return FileResponse(
        path=str(file_path),
        filename="frontend_build.tar.gz",
        media_type="application/gzip"
    )

# Mount API router
app.include_router(api_router)


import asyncio

# Startup/Shutdown events
@app.on_event("startup")
async def startup_db_client():
    logger.info("FlipSlab Engine API starting up...")
    collections = await db.list_collection_names()
    logger.info(f"Connected to MongoDB. Collections: {collections}")
    asyncio.create_task(sniper_background_loop())
    logger.info("Sniper background engine launched")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
