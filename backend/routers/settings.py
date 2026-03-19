from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import re
import logging
from database import db
from utils.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/settings", tags=["settings"])


class UserSettings(BaseModel):
    display_name: Optional[str] = None
    postal_code: Optional[str] = None
    location: Optional[str] = None
    default_shipping: Optional[str] = "USPSFirstClass"
    default_sport: Optional[str] = "Basketball"


@router.get("")
async def get_user_settings(request: Request):
    """Get user settings/profile"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    if not settings:
        return {"user_id": user_id, "display_name": "", "postal_code": "", "location": "", "default_shipping": "USPSFirstClass", "default_sport": "Basketball", "shop_slug": ""}
    return settings


@router.put("")
async def update_user_settings(data: UserSettings, request: Request):
    """Update user settings/profile"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    update = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    update["user_id"] = user_id
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_settings.update_one({"user_id": user_id}, {"$set": update}, upsert=True)
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0})
    return settings


@router.put("/shop-slug")
async def set_shop_slug(request: Request):
    """Set user's shop URL slug"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()
    slug = body.get("slug", "").strip().lower()

    if not slug:
        raise HTTPException(status_code=400, detail="Shop URL is required")
    if len(slug) < 3 or len(slug) > 30:
        raise HTTPException(status_code=400, detail="Shop URL must be 3-30 characters")
    if not re.match(r'^[a-z0-9][a-z0-9_-]*[a-z0-9]$', slug):
        raise HTTPException(status_code=400, detail="Shop URL can only contain letters, numbers, hyphens, and underscores")

    reserved = ["admin", "shop", "api", "settings", "account", "login", "register", "auth"]
    if slug in reserved:
        raise HTTPException(status_code=400, detail="This URL is reserved")

    existing = await db.user_settings.find_one({"shop_slug": slug, "user_id": {"$ne": user_id}}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=409, detail="This shop URL is already taken")

    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {"shop_slug": slug, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"success": True, "slug": slug}


@router.put("/shop-profile")
async def set_shop_profile(request: Request):
    """Set shop name and logo"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()
    update = {}
    if "shop_name" in body:
        update["shop_name"] = body["shop_name"][:60]
    if "shop_logo" in body:
        update["shop_logo"] = body["shop_logo"]
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_settings.update_one({"user_id": user_id}, {"$set": update}, upsert=True)
    return {"success": True}


MAX_EDITOR_PRESETS = 5

@router.get("/editor-presets")
async def get_editor_presets(request: Request):
    """Get user's saved social post editor presets"""
    user = await get_current_user(request)
    settings = await db.user_settings.find_one({"user_id": user["user_id"]}, {"_id": 0, "editor_presets": 1})
    return {"presets": (settings or {}).get("editor_presets", [])}


@router.post("/editor-presets")
async def save_editor_preset(request: Request):
    """Save a social post editor preset (max 5)"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()

    name = body.get("name", "").strip()
    if not name or len(name) > 30:
        raise HTTPException(status_code=400, detail="Name is required (max 30 chars)")

    preset_data = body.get("data")
    if not preset_data:
        raise HTTPException(status_code=400, detail="Preset data is required")

    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "editor_presets": 1})
    presets = (settings or {}).get("editor_presets", [])

    if len(presets) >= MAX_EDITOR_PRESETS:
        raise HTTPException(status_code=400, detail=f"Maximum {MAX_EDITOR_PRESETS} presets allowed")

    import uuid
    new_preset = {
        "id": uuid.uuid4().hex[:12],
        "name": name,
        "data": preset_data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    presets.append(new_preset)

    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {"editor_presets": presets}},
        upsert=True,
    )
    return {"success": True, "preset": new_preset}


@router.delete("/editor-presets/{preset_id}")
async def delete_editor_preset(preset_id: str, request: Request):
    """Delete a saved editor preset"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "editor_presets": 1})
    presets = (settings or {}).get("editor_presets", [])
    filtered = [p for p in presets if p["id"] != preset_id]

    if len(filtered) == len(presets):
        raise HTTPException(status_code=404, detail="Preset not found")

    await db.user_settings.update_one(
        {"user_id": user_id},
        {"$set": {"editor_presets": filtered}},
    )
    return {"success": True}
