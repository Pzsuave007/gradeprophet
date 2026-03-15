from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import logging
from database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/onboarding", tags=["onboarding"])


class OnboardingData(BaseModel):
    sports: List[str] = []
    card_type: str = "both"  # raw, graded, both
    search_interests: List[str] = []


@router.get("/status")
async def get_onboarding_status(request: Request):
    """Check if user has completed onboarding"""
    user = await get_current_user(request)
    user_doc = await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})
    return {"onboarding_completed": user_doc.get("onboarding_completed", False)}


@router.post("/complete")
async def complete_onboarding(data: OnboardingData, request: Request):
    """Complete onboarding: save preferences and create watchlist searches"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    # Save preferences
    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {
            "sports": data.sports,
            "card_type": data.card_type,
            "search_interests": data.search_interests,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True
    )

    # Create watchlist entries for each search interest
    created_searches = []
    for query in data.search_interests:
        if not query.strip():
            continue
        card_id = str(uuid.uuid4())
        doc = {
            "id": card_id,
            "user_id": user_id,
            "search_query": query.strip(),
            "notes": "Added during setup",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_searched": None,
            "listings_found": 0,
        }
        await db.watchlist_cards.insert_one(doc)
        created_searches.append(query.strip())

    # Mark onboarding as complete
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"onboarding_completed": True}}
    )

    logger.info(f"Onboarding complete for {user_id}: {len(created_searches)} searches created")
    return {
        "success": True,
        "searches_created": created_searches,
    }


@router.post("/skip")
async def skip_onboarding(request: Request):
    """Skip onboarding and mark as complete"""
    user = await get_current_user(request)
    await db.users.update_one(
        {"user_id": user["user_id"]},
        {"$set": {"onboarding_completed": True}}
    )
    return {"success": True}
