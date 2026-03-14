from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import logging
import os

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
from routers.flipfinder import router as flipfinder_router
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


# Mount API router
app.include_router(api_router)


# Startup/Shutdown events
@app.on_event("startup")
async def startup_db_client():
    logger.info("FlipSlab Engine API starting up...")
    collections = await db.list_collection_names()
    logger.info(f"Connected to MongoDB. Collections: {collections}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
