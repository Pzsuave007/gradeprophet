from database import db
from routers.subscription import PLANS, get_plan


async def get_user_plan(user_id: str) -> dict:
    """Get the user's current plan with limits and features."""
    sub = await db.subscriptions.find_one({"user_id": user_id}, {"_id": 0})
    plan_id = sub.get("plan_id", "rookie") if sub else "rookie"
    plan = get_plan(plan_id)
    scans_used = sub.get("scans_used", 0) if sub else 0
    return {
        "plan_id": plan_id,
        "plan": plan,
        "scans_used": scans_used,
    }


async def check_inventory_limit(user_id: str) -> dict:
    """Check if user can add more inventory items. Returns {allowed, current, limit}."""
    plan_data = await get_user_plan(user_id)
    limit = plan_data["plan"]["limits"]["inventory"]
    if limit == -1:
        return {"allowed": True, "current": 0, "limit": -1}
    current = await db.inventory.count_documents({"user_id": user_id})
    return {"allowed": current < limit, "current": current, "limit": limit}


async def check_scan_limit(user_id: str) -> dict:
    """Check if user can perform more AI scans this month."""
    plan_data = await get_user_plan(user_id)
    limit = plan_data["plan"]["limits"]["scans_per_month"]
    if limit == -1:
        return {"allowed": True, "current": 0, "limit": -1}
    scans_used = plan_data["scans_used"]
    return {"allowed": scans_used < limit, "current": scans_used, "limit": limit}


async def increment_scan_count(user_id: str):
    """Increment the user's scan count for the current month."""
    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$inc": {"scans_used": 1}},
        upsert=True,
    )


async def check_listing_limit(user_id: str) -> dict:
    """Check if user can create more listings."""
    plan_data = await get_user_plan(user_id)
    limit = plan_data["plan"]["limits"]["listings"]
    if limit == -1:
        return {"allowed": True, "current": 0, "limit": -1}
    current = await db.inventory.count_documents({"user_id": user_id, "ebay_listing_id": {"$exists": True, "$ne": None}})
    return {"allowed": current < limit, "current": current, "limit": limit}


async def check_feature_access(user_id: str, feature_key: str) -> bool:
    """Check if user has access to a specific feature."""
    plan_data = await get_user_plan(user_id)
    return plan_data["plan"]["features"].get(feature_key, False)
