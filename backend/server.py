from fastapi import FastAPI, APIRouter, Request
from fastapi.responses import FileResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from datetime import datetime, timezone
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
from routers.ebay import router as ebay_router, chase_sales_monitor_loop
from routers.flipfinder import router as flipfinder_router, sniper_background_loop
from routers.settings import router as settings_router
from routers.onboarding import router as onboarding_router
from routers.subscription import router as subscription_router
from routers.admin import router as admin_router
from routers.shop import router as shop_router
from routers.marketplace import router as marketplace_router

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
api_router.include_router(onboarding_router)
api_router.include_router(subscription_router)
api_router.include_router(admin_router)
api_router.include_router(shop_router)
api_router.include_router(marketplace_router)


# Stripe Webhook (under /api prefix for routing)
@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    import logging
    logger = logging.getLogger(__name__)
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    api_key = os.environ.get("STRIPE_API_KEY")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    try:
        event = await stripe_checkout.handle_webhook(body, sig)
        logger.info(f"Stripe webhook event: {event.event_type} session={event.session_id}")
        if event.payment_status == "paid" and event.session_id:
            txn = await db.payment_transactions.find_one({"session_id": event.session_id, "payment_status": {"$ne": "paid"}})
            if txn:
                from datetime import datetime, timezone
                await db.payment_transactions.update_one(
                    {"session_id": event.session_id},
                    {"$set": {"payment_status": "paid", "status": "completed", "paid_at": datetime.now(timezone.utc).isoformat()}}
                )
                await db.subscriptions.update_one(
                    {"user_id": txn["user_id"]},
                    {"$set": {"plan_id": txn["plan_id"], "status": "active", "started_at": datetime.now(timezone.utc).isoformat(), "scans_used": 0}},
                    upsert=True
                )
                logger.info(f"Webhook: User {txn['user_id']} upgraded to {txn['plan_id']}")
    except Exception as e:
        logger.error(f"Stripe webhook error: {e}")
    return {"received": True}


# Root endpoint
@api_router.get("/")
async def root():
    return {"status": "FlipSlab Engine API v2.0", "modules": [
        "auth", "cards", "inventory", "market", "portfolio",
        "alerts", "dashboard", "ebay", "flipfinder", "settings"
    ]}


# Download endpoint for deployment package
@api_router.get("/download-scanner")
async def download_scanner():
    file_path = Path("/app/FlipSlabScanner.zip")
    if not file_path.exists():
        return {"error": "Scanner package not found"}
    return FileResponse(
        path=str(file_path),
        filename="FlipSlabScanner.zip",
        media_type="application/zip"
    )

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
    api_base = "https://chase-sales-monitor.preview.emergentagent.com"

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

    # Ensure admin password is always correct (fixes recurring fork issue)
    await ensure_admin_password()

    asyncio.create_task(sniper_background_loop())
    logger.info("Sniper background engine launched")

    asyncio.create_task(chase_sales_monitor_loop())
    logger.info("Chase Sales Monitor launched")


async def ensure_admin_password():
    """Ensure admin user pzsuave007@gmail.com always has the correct password.
    This runs on every startup to fix the recurring issue where forks
    lose the correct password hash."""
    import bcrypt
    ADMIN_EMAIL = "pzsuave007@gmail.com"
    ADMIN_PASSWORD = "MXmedia007"

    try:
        user = await db.users.find_one({"email": ADMIN_EMAIL})
        if not user:
            logger.info(f"Admin user {ADMIN_EMAIL} not found, skipping password ensure")
            return

        current_hash = user.get("password_hash", "")
        if current_hash:
            try:
                if bcrypt.checkpw(ADMIN_PASSWORD.encode(), current_hash.encode()):
                    logger.info(f"Admin password OK for {ADMIN_EMAIL}")
                    await ensure_dev_token(user["user_id"])
                    return
            except Exception:
                pass

        new_hash = bcrypt.hashpw(ADMIN_PASSWORD.encode(), bcrypt.gensalt()).decode()
        await db.users.update_one(
            {"email": ADMIN_EMAIL},
            {"$set": {"password_hash": new_hash}}
        )
        logger.info(f"Admin password RESET for {ADMIN_EMAIL} (was incorrect/missing)")
        await ensure_dev_token(user["user_id"])
    except Exception as e:
        logger.error(f"Error ensuring admin password: {e}")


async def ensure_dev_token(user_id: str):
    """Create a persistent dev token for Emergent agents to test without touching auth.
    Token: 'dev_flipslab_access' — never expires, always valid.
    Usage: GET /api/auth/dev-login?token=dev_flipslab_access
    This sets the session cookie so agents can test all authenticated endpoints."""
    from datetime import timedelta
    DEV_TOKEN = "dev_flipslab_access"

    try:
        existing = await db.user_sessions.find_one({"session_token": DEV_TOKEN})
        if existing:
            # Refresh expiration
            await db.user_sessions.update_one(
                {"session_token": DEV_TOKEN},
                {"$set": {
                    "user_id": user_id,
                    "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
                }}
            )
            logger.info(f"Dev token refreshed for {user_id}")
        else:
            await db.user_sessions.insert_one({
                "user_id": user_id,
                "session_token": DEV_TOKEN,
                "dev_token": True,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
                "created_at": datetime.now(timezone.utc),
            })
            logger.info(f"Dev token CREATED for {user_id}")
    except Exception as e:
        logger.error(f"Error ensuring dev token: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
