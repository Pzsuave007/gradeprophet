from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from database import db
from utils.auth import get_current_user
from datetime import datetime, timezone
import uuid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_EMAILS = ["pzsuave007@gmail.com"]


async def require_admin(request: Request):
    user = await get_current_user(request)
    if user.get("email", "").lower() not in ADMIN_EMAILS and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/stats")
async def get_admin_stats(request: Request):
    await require_admin(request)
    total_users = await db.users.count_documents({})
    banned_users = await db.users.count_documents({"banned": True})

    # Users by plan
    pipeline = [
        {"$lookup": {"from": "subscriptions", "localField": "user_id", "foreignField": "user_id", "as": "sub"}},
        {"$unwind": {"path": "$sub", "preserveNullAndEmptyArrays": True}},
        {"$group": {"_id": {"$ifNull": ["$sub.plan_id", "rookie"]}, "count": {"$sum": 1}}},
    ]
    by_plan_raw = await db.users.aggregate(pipeline).to_list(10)
    # Normalize old plan IDs to new ones
    plan_aliases = {"all_star": "mvp", "hall_of_fame": "hall_of_famer", "legend": "hall_of_famer"}
    by_plan = {}
    for item in by_plan_raw:
        plan_id = item["_id"]
        normalized = plan_aliases.get(plan_id, plan_id)
        by_plan[normalized] = by_plan.get(normalized, 0) + item["count"]

    total_inventory = await db.inventory.count_documents({})
    total_scans = await db.card_analyses.count_documents({})
    total_transactions = await db.payment_transactions.count_documents({})
    paid_transactions = await db.payment_transactions.count_documents({"payment_status": "paid"})

    # Revenue
    rev_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    rev_result = await db.payment_transactions.aggregate(rev_pipeline).to_list(1)
    total_revenue = rev_result[0]["total"] if rev_result else 0

    # Recent signups (last 7 days)
    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_signups = await db.users.count_documents({"created_at": {"$gte": week_ago}})

    return {
        "total_users": total_users,
        "banned_users": banned_users,
        "by_plan": by_plan,
        "total_inventory": total_inventory,
        "total_scans": total_scans,
        "total_transactions": total_transactions,
        "paid_transactions": paid_transactions,
        "total_revenue": round(total_revenue, 2),
        "recent_signups": recent_signups,
    }


@router.get("/users")
async def get_admin_users(request: Request, skip: int = 0, limit: int = 50, search: str = ""):
    await require_admin(request)
    query = {}
    if search:
        query["$or"] = [
            {"email": {"$regex": search, "$options": "i"}},
            {"name": {"$regex": search, "$options": "i"}},
        ]

    total = await db.users.count_documents(query)
    users = await db.users.find(query, {"_id": 0, "password_hash": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Enrich with subscription + usage data
    enriched = []
    for u in users:
        uid = u.get("user_id", "")
        sub = await db.subscriptions.find_one({"user_id": uid}, {"_id": 0})
        inv_count = await db.inventory.count_documents({"user_id": uid})
        scan_count = await db.card_analyses.count_documents({"user_id": uid})
        listing_count = await db.inventory.count_documents({"user_id": uid, "ebay_item_id": {"$exists": True, "$ne": None, "$ne": ""}})

        plan_aliases = {"all_star": "mvp", "hall_of_fame": "hall_of_famer", "legend": "hall_of_famer"}
        raw_plan = sub.get("plan_id", "rookie") if sub else "rookie"
        normalized_plan = plan_aliases.get(raw_plan, raw_plan)

        enriched.append({
            **u,
            "plan_id": normalized_plan,
            "plan_status": sub.get("status", "active") if sub else "active",
            "usage": {
                "inventory": inv_count,
                "scans": scan_count,
                "listings": listing_count,
            },
        })

    return {"users": enriched, "total": total}


@router.get("/users/{user_id}/inventory")
async def get_user_inventory(user_id: str, request: Request, skip: int = 0, limit: int = 50):
    await require_admin(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    total = await db.inventory.count_documents({"user_id": user_id})
    items = await db.inventory.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    return {"items": items, "total": total, "user_email": user.get("email")}


@router.put("/users/{user_id}/plan")
async def change_user_plan(user_id: str, request: Request):
    admin = await require_admin(request)
    body = await request.json()
    new_plan = body.get("plan_id")
    valid_plans = ["rookie", "mvp", "hall_of_famer"]
    if new_plan not in valid_plans:
        raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {valid_plans}")

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.subscriptions.update_one(
        {"user_id": user_id},
        {"$set": {
            "plan_id": new_plan,
            "status": "active",
            "changed_by": admin.get("email"),
            "changed_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    logger.info(f"Admin {admin.get('email')} changed {user.get('email')} to plan {new_plan}")
    return {"success": True, "user_id": user_id, "new_plan": new_plan}


@router.put("/users/{user_id}/ban")
async def toggle_ban_user(user_id: str, request: Request):
    admin = await require_admin(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_banned = user.get("banned", False)
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"banned": not is_banned, "banned_at": datetime.now(timezone.utc).isoformat() if not is_banned else None}},
    )
    action = "unbanned" if is_banned else "banned"
    logger.info(f"Admin {admin.get('email')} {action} user {user.get('email')}")
    return {"success": True, "user_id": user_id, "banned": not is_banned}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    admin = await require_admin(request)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.get("email", "").lower() in ADMIN_EMAILS:
        raise HTTPException(status_code=400, detail="Cannot delete admin account")

    # Delete user data
    await db.inventory.delete_many({"user_id": user_id})
    await db.card_analyses.delete_many({"user_id": user_id})
    await db.subscriptions.delete_many({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.payment_transactions.delete_many({"user_id": user_id})
    await db.users.delete_one({"user_id": user_id})

    logger.info(f"Admin {admin.get('email')} deleted user {user.get('email')} and all their data")
    return {"success": True, "deleted_email": user.get("email")}


@router.get("/transactions")
async def get_transactions(request: Request, skip: int = 0, limit: int = 50):
    await require_admin(request)
    total = await db.payment_transactions.count_documents({})
    txns = await db.payment_transactions.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)

    # Enrich with user email
    enriched = []
    for txn in txns:
        user = await db.users.find_one({"user_id": txn.get("user_id")}, {"_id": 0, "email": 1, "name": 1})
        enriched.append({
            **txn,
            "user_email": user.get("email") if user else "Unknown",
            "user_name": user.get("name") if user else "Unknown",
        })

    return {"transactions": enriched, "total": total}


# ── Photo Presets Management ──

class PresetCreate(BaseModel):
    name: str
    brightness: int = 0
    contrast: int = 0
    shadows: int = 0
    highlights: int = 0
    saturation: int = 0
    temperature: int = 0
    sharpness: int = 0
    featured: bool = False

class PresetUpdate(BaseModel):
    name: Optional[str] = None
    brightness: Optional[int] = None
    contrast: Optional[int] = None
    shadows: Optional[int] = None
    highlights: Optional[int] = None
    saturation: Optional[int] = None
    temperature: Optional[int] = None
    sharpness: Optional[int] = None
    featured: Optional[bool] = None


@router.get("/photo-presets")
async def get_admin_presets(request: Request):
    await require_admin(request)
    presets = await db.photo_presets.find({}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return {"presets": presets}


@router.post("/photo-presets")
async def create_preset(data: PresetCreate, request: Request):
    admin = await require_admin(request)
    preset = {
        "id": f"custom_{uuid.uuid4().hex[:8]}",
        "name": data.name,
        "brightness": data.brightness,
        "contrast": data.contrast,
        "shadows": data.shadows,
        "highlights": data.highlights,
        "saturation": data.saturation,
        "temperature": data.temperature,
        "sharpness": data.sharpness,
        "featured": data.featured,
        "created_by": admin.get("email"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.photo_presets.insert_one(preset)
    preset.pop("_id", None)
    return preset


@router.put("/photo-presets/{preset_id}")
async def update_preset(preset_id: str, data: PresetUpdate, request: Request):
    await require_admin(request)
    existing = await db.photo_presets.find_one({"id": preset_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Preset not found")
    updates = {k: v for k, v in data.dict().items() if v is not None}
    if updates:
        await db.photo_presets.update_one({"id": preset_id}, {"$set": updates})
    updated = await db.photo_presets.find_one({"id": preset_id}, {"_id": 0})
    return updated


@router.delete("/photo-presets/{preset_id}")
async def delete_preset(preset_id: str, request: Request):
    await require_admin(request)
    result = await db.photo_presets.delete_one({"id": preset_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"success": True}
