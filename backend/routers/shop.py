from fastapi import APIRouter, HTTPException
from database import db
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/shop", tags=["shop"])


@router.get("/{slug}")
async def get_public_shop(slug: str):
    """Public endpoint - no auth required. Returns shop info + listed cards."""
    settings = await db.user_settings.find_one({"shop_slug": slug.lower()}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Shop not found")

    user_id = settings.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

    # Get listed inventory items with images
    items = await db.inventory.find(
        {"user_id": user_id, "ebay_item_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 0}
    ).sort("listed_at", -1).to_list(500)

    # Calculate stats
    total_value = sum(float(i.get("listed_price") or i.get("purchase_price") or 0) for i in items)
    sports = list(set(i.get("sport") for i in items if i.get("sport")))

    return {
        "shop": {
            "slug": slug,
            "name": settings.get("display_name") or (user.get("name") if user else slug),
            "location": settings.get("location", ""),
            "avatar": user.get("picture", "") if user else "",
            "total_items": len(items),
            "total_value": round(total_value, 2),
            "sports": sports,
        },
        "items": items,
    }
