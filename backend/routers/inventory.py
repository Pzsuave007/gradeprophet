from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid
import re
import logging
import asyncio
from database import db
from utils.auth import get_current_user
from utils.image import process_card_image, create_store_thumbnail, create_thumbnail
from utils.plan_limits import check_inventory_limit, check_scan_limit, increment_scan_count

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/inventory", tags=["inventory"])

# Track users with active backfill tasks to avoid duplicates
_backfill_active = set()


class InventoryItem(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    card_name: str
    player: Optional[str] = None
    year: Optional[int] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    variation: Optional[str] = None
    condition: Optional[str] = "Raw"
    card_condition: Optional[str] = "Near Mint or Better"
    grading_company: Optional[str] = None
    grade: Optional[float] = None
    cert_number: Optional[str] = None
    purchase_price: Optional[float] = None
    card_value: Optional[float] = None
    quantity: int = 1
    notes: Optional[str] = None
    image: Optional[str] = None
    back_image: Optional[str] = None
    listed: bool = False
    category: str = "for_sale"
    sport: Optional[str] = None
    team: Optional[str] = None
    source_analysis_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class InventoryItemCreate(BaseModel):
    card_name: str
    player: Optional[str] = None
    year: Optional[int] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    variation: Optional[str] = None
    condition: Optional[str] = "Raw"
    card_condition: Optional[str] = "Near Mint or Better"
    grading_company: Optional[str] = None
    grade: Optional[float] = None
    cert_number: Optional[str] = None
    purchase_price: Optional[float] = None
    card_value: Optional[float] = None
    quantity: int = 1
    notes: Optional[str] = None
    image_base64: Optional[str] = None
    back_image_base64: Optional[str] = None
    category: str = "for_sale"
    sport: Optional[str] = None
    team: Optional[str] = None


class InventoryItemUpdate(BaseModel):
    card_name: Optional[str] = None
    player: Optional[str] = None
    year: Optional[int] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    variation: Optional[str] = None
    condition: Optional[str] = None
    card_condition: Optional[str] = None
    grading_company: Optional[str] = None
    grade: Optional[float] = None
    cert_number: Optional[str] = None
    purchase_price: Optional[float] = None
    card_value: Optional[float] = None
    quantity: Optional[int] = None
    notes: Optional[str] = None
    image_base64: Optional[str] = None
    back_image_base64: Optional[str] = None
    listed: Optional[bool] = None
    category: Optional[str] = None
    sport: Optional[str] = None
    team: Optional[str] = None


class BatchCardItem(BaseModel):
    card_name: str
    player: Optional[str] = None
    year: Optional[int] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    variation: Optional[str] = None
    condition: Optional[str] = "Raw"
    card_condition: Optional[str] = "Near Mint or Better"
    grading_company: Optional[str] = None
    grade: Optional[float] = None
    purchase_price: Optional[float] = None
    quantity: int = 1
    notes: Optional[str] = None
    image_base64: Optional[str] = None
    back_image_base64: Optional[str] = None
    sport: Optional[str] = None


class BatchSaveRequest(BaseModel):
    cards: List[BatchCardItem]
    category: str = "for_sale"


class ImportFromScanRequest(BaseModel):
    category: str = "for_sale"
    purchase_price: Optional[float] = None
    notes: Optional[str] = None


@router.post("")
async def create_inventory_item(data: InventoryItemCreate, request: Request):
    """Add a card to inventory"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]

        # Check inventory limit
        inv_check = await check_inventory_limit(user_id)
        if not inv_check["allowed"]:
            raise HTTPException(
                status_code=403,
                detail=f"Inventory limit reached ({inv_check['limit']} cards). Upgrade your plan to add more."
            )

        image_thumb = None
        thumbnail = None
        store_thumb = None
        if data.image_base64:
            img = data.image_base64
            if ',' in img:
                img = img.split(',')[1]
            image_thumb = process_card_image(img, max_size=800)
            thumbnail = create_thumbnail(image_thumb, max_size=200)
            store_thumb = create_store_thumbnail(image_thumb, max_size=400)

        back_image_thumb = None
        back_thumbnail = None
        if data.back_image_base64:
            bimg = data.back_image_base64
            if ',' in bimg:
                bimg = bimg.split(',')[1]
            back_image_thumb = process_card_image(bimg, max_size=800)
            back_thumbnail = create_thumbnail(back_image_thumb, max_size=200)

        item = InventoryItem(
            card_name=data.card_name, player=data.player, year=data.year,
            set_name=data.set_name, card_number=data.card_number,
            variation=data.variation, condition=data.condition,
            grading_company=data.grading_company, grade=data.grade,
            cert_number=data.cert_number,
            purchase_price=data.purchase_price, quantity=data.quantity,
            notes=data.notes, image=image_thumb, back_image=back_image_thumb,
            category=data.category, sport=data.sport,
        )

        doc = item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        doc['user_id'] = user_id
        if thumbnail:
            doc['thumbnail'] = thumbnail
        if store_thumb:
            doc['store_thumbnail'] = store_thumb
        if back_thumbnail:
            doc['back_thumbnail'] = back_thumbnail
        await db.inventory.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except Exception as e:
        logger.error(f"Create inventory item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/batch-save")
async def batch_save_inventory(data: BatchSaveRequest, request: Request):
    """Save multiple cards to inventory at once"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]

        # Check inventory limit before batch save
        inv_check = await check_inventory_limit(user_id)
        if not inv_check["allowed"]:
            raise HTTPException(
                status_code=403,
                detail=f"Inventory limit reached ({inv_check['limit']} cards). Upgrade your plan to add more."
            )
        # Check if batch would exceed limit
        if inv_check["limit"] != -1:
            remaining = inv_check["limit"] - inv_check["current"]
            if len(data.cards) > remaining:
                raise HTTPException(
                    status_code=403,
                    detail=f"Batch would exceed inventory limit. You have {remaining} slots remaining out of {inv_check['limit']}. Upgrade your plan."
                )

        saved = 0
        errors = []
        for idx, card in enumerate(data.cards):
            try:
                image_thumb = None
                if card.image_base64:
                    img = card.image_base64
                    if ',' in img:
                        img = img.split(',')[1]
                    image_thumb = process_card_image(img, max_size=800)

                back_image_thumb = None
                back_thumbnail = None
                if card.back_image_base64:
                    bimg = card.back_image_base64
                    if ',' in bimg:
                        bimg = bimg.split(',')[1]
                    back_image_thumb = process_card_image(bimg, max_size=800)
                    back_thumbnail = create_thumbnail(back_image_thumb, max_size=200)

                image_thumb_for_thumbs = image_thumb
                thumbnail = create_thumbnail(image_thumb_for_thumbs, max_size=200) if image_thumb_for_thumbs else None
                store_thumb = create_store_thumbnail(image_thumb_for_thumbs) if image_thumb_for_thumbs else None

                item = InventoryItem(
                    card_name=card.card_name, player=card.player, year=card.year,
                    set_name=card.set_name, card_number=card.card_number,
                    variation=card.variation, condition=card.condition,
                    grading_company=card.grading_company, grade=card.grade,
                    purchase_price=card.purchase_price, quantity=card.quantity,
                    notes=card.notes, image=image_thumb, back_image=back_image_thumb,
                    category=data.category, sport=card.sport,
                )

                doc = item.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                doc['updated_at'] = doc['updated_at'].isoformat()
                doc['user_id'] = user_id
                if thumbnail:
                    doc['thumbnail'] = thumbnail
                if store_thumb:
                    doc['store_thumbnail'] = store_thumb
                if back_thumbnail:
                    doc['back_thumbnail'] = back_thumbnail
                await db.inventory.insert_one(doc)
                doc.pop('_id', None)
                saved += 1
            except Exception as e:
                logger.error(f"Batch save card {idx} failed: {e}")
                errors.append({"index": idx, "card_name": card.card_name, "error": str(e)})

        return {"saved": saved, "total": len(data.cards), "errors": errors}
    except Exception as e:
        logger.error(f"Batch save failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_inventory(
    request: Request,
    search: Optional[str] = None,
    player: Optional[str] = None,
    year: Optional[int] = None,
    set_name: Optional[str] = None,
    condition: Optional[str] = None,
    listed: Optional[str] = None,
    category: Optional[str] = None,
    scheduled: Optional[str] = None,
    ebay_item_id: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_dir: Optional[str] = "desc",
    skip: int = 0,
    limit: int = 500,
):
    """Get inventory with search and filters"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        query = {"user_id": user_id}

        if search:
            query["$or"] = [
                {"card_name": {"$regex": search, "$options": "i"}},
                {"player": {"$regex": search, "$options": "i"}},
                {"set_name": {"$regex": search, "$options": "i"}},
                {"card_number": {"$regex": search, "$options": "i"}},
                {"variation": {"$regex": search, "$options": "i"}},
            ]
        if player:
            query["player"] = {"$regex": player, "$options": "i"}
        if year:
            query["year"] = year
        if set_name:
            query["set_name"] = {"$regex": set_name, "$options": "i"}
        if condition and condition in ("Raw", "Graded"):
            query["condition"] = condition
        if listed is not None and listed != "":
            query["listed"] = listed.lower() == "true"
        if category and category in ("collection", "for_sale", "sold"):
            query["category"] = category
        if scheduled is not None and scheduled != "":
            if scheduled.lower() == "true":
                query["scheduled"] = True
            else:
                query["$and"] = query.get("$and", []) + [{"$or": [{"scheduled": False}, {"scheduled": {"$exists": False}}]}]
        if ebay_item_id:
            query["ebay_item_id"] = ebay_item_id

        sort_order = -1 if sort_dir == "desc" else 1
        valid_sorts = ["created_at", "card_name", "player", "year", "purchase_price", "grade"]
        if sort_by not in valid_sorts:
            sort_by = "created_at"

        total = await db.inventory.count_documents(query)
        # Exclude heavy base64 images from list view — use thumbnail/store_thumbnail instead
        projection = {"_id": 0, "image": 0, "back_image": 0}
        items = await db.inventory.find(query, projection).sort(sort_by, sort_order).skip(skip).limit(limit).to_list(limit)

        # Auto-backfill: if any items are missing thumbnails, generate them in background
        if user_id not in _backfill_active:
            missing = await db.inventory.count_documents({
                "user_id": user_id,
                "image": {"$exists": True, "$ne": None},
                "$or": [{"store_thumbnail": {"$exists": False}}, {"thumbnail": {"$exists": False}}]
            })
            if missing > 0:
                _backfill_active.add(user_id)
                asyncio.create_task(_auto_backfill_thumbnails(user_id))

        return {"items": items, "total": total}
    except Exception as e:
        logger.error(f"Get inventory failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _auto_backfill_thumbnails(user_id: str):
    """Background task: generate missing thumbnails for a user's inventory items."""
    import gc
    try:
        items = await db.inventory.find(
            {"user_id": user_id, "image": {"$exists": True, "$ne": None}, "$or": [
                {"store_thumbnail": {"$exists": False}},
                {"thumbnail": {"$exists": False}},
            ]},
            {"_id": 0, "id": 1, "image": 1, "back_image": 1, "store_thumbnail": 1, "thumbnail": 1, "back_thumbnail": 1}
        ).to_list(1000)

        updated = 0
        for item in items:
            try:
                updates = {}
                if not item.get("store_thumbnail"):
                    updates["store_thumbnail"] = create_store_thumbnail(item["image"])
                if not item.get("thumbnail"):
                    updates["thumbnail"] = create_thumbnail(item["image"], max_size=200)
                if item.get("back_image") and not item.get("back_thumbnail"):
                    updates["back_thumbnail"] = create_thumbnail(item["back_image"], max_size=200)
                if updates:
                    await db.inventory.update_one({"id": item["id"]}, {"$set": updates})
                    updated += 1
            except Exception as e:
                logger.warning(f"Auto-backfill thumbnail failed for {item['id']}: {e}")
            if updated % 20 == 0:
                gc.collect()
                await asyncio.sleep(0.1)  # Yield to event loop

        gc.collect()
        logger.info(f"Auto-backfill complete for user {user_id}: {updated}/{len(items)} thumbnails generated")
    except Exception as e:
        logger.error(f"Auto-backfill failed for user {user_id}: {e}")
    finally:
        _backfill_active.discard(user_id)



@router.get("/stats")
async def get_inventory_stats(request: Request):
    """Get inventory summary statistics"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        uq = {"user_id": user_id}
        total = await db.inventory.count_documents(uq)
        graded = await db.inventory.count_documents({**uq, "condition": "Graded"})
        raw = await db.inventory.count_documents({**uq, "condition": "Raw"})
        listed = await db.inventory.count_documents({**uq, "listed": True})
        not_listed = await db.inventory.count_documents({**uq, "listed": {"$ne": True}})
        collection_count = await db.inventory.count_documents({**uq, "category": "collection", "listed": {"$ne": True}})
        for_sale_count = await db.inventory.count_documents({**uq, "category": "for_sale", "listed": {"$ne": True}, "$or": [{"scheduled": False}, {"scheduled": {"$exists": False}}]})
        sold_count = await db.inventory.count_documents({**uq, "category": "sold"})
        scheduled_count = await db.inventory.count_documents({**uq, "scheduled": True, "listed": {"$ne": True}})

        pipeline = [
            {"$match": {**uq, "purchase_price": {"$gt": 0}}},
            {"$group": {
                "_id": None,
                "total_invested": {"$sum": {"$multiply": ["$purchase_price", "$quantity"]}},
                "avg_price": {"$avg": "$purchase_price"},
                "total_quantity": {"$sum": "$quantity"},
            }}
        ]
        agg = await db.inventory.aggregate(pipeline).to_list(1)
        inv_agg = agg[0] if agg else {}

        return {
            "total_cards": total, "total_quantity": inv_agg.get("total_quantity", total),
            "graded": graded, "raw": raw, "listed": listed, "not_listed": not_listed,
            "collection_count": collection_count, "for_sale_count": for_sale_count,
            "sold_count": sold_count, "scheduled_count": scheduled_count,
            "total_invested": round(inv_agg.get("total_invested", 0), 2),
            "avg_price": round(inv_agg.get("avg_price", 0), 2),
        }
    except Exception as e:
        logger.error(f"Inventory stats failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BulkConditionUpdate(BaseModel):
    item_ids: List[str]
    card_condition: str


class BulkPresetApply(BaseModel):
    item_ids: List[str]
    brightness: float = 100
    contrast: float = 100
    saturate: float = 100
    shadows: float = 0
    sharpness: float = 0
    highlights: float = 0
    temperature: float = 0


def _apply_preset_to_image(image_base64: str, preset: BulkPresetApply) -> str:
    """Apply preset filters to a base64 image using PIL (mirrors frontend canvas logic)."""
    import base64 as b64
    from PIL import Image, ImageEnhance, ImageFilter
    from io import BytesIO
    import numpy as np

    data = b64.b64decode(image_base64)
    img = Image.open(BytesIO(data))
    if img.mode != 'RGB':
        img = img.convert('RGB')

    # Brightness, Contrast, Saturation (values are percentages, 100 = no change)
    if preset.brightness != 100:
        img = ImageEnhance.Brightness(img).enhance(preset.brightness / 100)
    if preset.contrast != 100:
        img = ImageEnhance.Contrast(img).enhance(preset.contrast / 100)
    if preset.saturate != 100:
        img = ImageEnhance.Color(img).enhance(preset.saturate / 100)

    # Shadows, Highlights, Temperature via pixel manipulation (mirrors frontend LUT logic)
    if preset.shadows > 0 or preset.highlights != 0 or preset.temperature != 0:
        arr = np.array(img, dtype=np.float64) / 255.0

        # Shadows: gamma curve
        if preset.shadows > 0:
            s_gamma = max(0.4, 1 - (preset.shadows / 100) * 0.55)
            arr = np.power(arr, s_gamma)

        # Highlights: adjust upper range
        if preset.highlights != 0:
            h_gamma = max(0.5, min(1.5, 1 - (preset.highlights / 100) * 0.4))
            t = np.maximum(0, (arr - 0.5) * 2)
            adj = t * (1 - np.power(arr, h_gamma))
            arr = np.minimum(1, arr + adj * 0.3)

        # Temperature: warm adds R/Y, cool adds B
        if preset.temperature != 0:
            t_shift = preset.temperature / 100
            r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
            r = r * (1 + t_shift * 0.15) + t_shift * 8/255
            g = g * (1 + t_shift * 0.05)
            b = b * (1 - t_shift * 0.15) - t_shift * 8/255
            arr = np.stack([r, g, b], axis=2)

        arr = np.clip(arr * 255, 0, 255).astype(np.uint8)
        img = Image.fromarray(arr)

    # Sharpness via unsharp mask
    if preset.sharpness > 0:
        factor = 1 + (preset.sharpness / 100) * 4
        img = ImageEnhance.Sharpness(img).enhance(factor)

    buf = BytesIO()
    img.save(buf, format='JPEG', quality=92)
    return b64.b64encode(buf.getvalue()).decode('utf-8')


@router.put("/bulk-apply-preset")
async def bulk_apply_preset(data: BulkPresetApply, request: Request):
    """Apply a photo preset to front+back images of multiple inventory items."""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]

        processed = 0
        errors = 0

        for item_id in data.item_ids:
            try:
                item = await db.inventory.find_one(
                    {"id": item_id, "user_id": user_id},
                    {"_id": 0, "image": 1, "back_image": 1}
                )
                if not item:
                    continue

                update_fields = {"updated_at": datetime.now(timezone.utc).isoformat()}

                # Apply to front image
                if item.get("image"):
                    enhanced_front = _apply_preset_to_image(item["image"], data)
                    update_fields["image"] = enhanced_front
                    update_fields["thumbnail"] = create_thumbnail(enhanced_front)
                    update_fields["store_thumbnail"] = create_store_thumbnail(enhanced_front)

                # Apply to back image
                if item.get("back_image"):
                    enhanced_back = _apply_preset_to_image(item["back_image"], data)
                    update_fields["back_image"] = enhanced_back
                    update_fields["back_thumbnail"] = create_thumbnail(enhanced_back)

                await db.inventory.update_one({"id": item_id}, {"$set": update_fields})
                processed += 1
            except Exception as e:
                logger.warning(f"Bulk preset failed for {item_id}: {e}")
                errors += 1

        return {"processed": processed, "errors": errors, "total": len(data.item_ids)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk preset apply failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/bulk-update-condition")
async def bulk_update_condition(data: BulkConditionUpdate, request: Request):
    """Bulk update card_condition for multiple inventory items"""
    try:
        user = await get_current_user(request)
        valid = ["Near Mint or Better", "Excellent", "Very Good", "Poor"]
        if data.card_condition not in valid:
            raise HTTPException(status_code=400, detail=f"Invalid condition. Must be one of: {valid}")

        result = await db.inventory.update_many(
            {"id": {"$in": data.item_ids}, "user_id": user["user_id"]},
            {"$set": {
                "card_condition": data.card_condition,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )
        return {"updated": result.modified_count, "total": len(data.item_ids)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk condition update failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{item_id}")
async def get_inventory_item(item_id: str, request: Request):
    """Get a single inventory item"""
    try:
        user = await get_current_user(request)
        item = await db.inventory.find_one({"id": item_id, "user_id": user["user_id"]}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        return item
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get inventory item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{item_id}")
async def update_inventory_item(item_id: str, data: InventoryItemUpdate, request: Request):
    """Update an inventory item"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]
        update_fields = {}
        for field, value in data.model_dump(exclude_unset=True).items():
            if field == "image_base64" and value is not None:
                img = value
                if ',' in img:
                    img = img.split(',')[1]
                processed = process_card_image(img, max_size=1200, skip_crop=True)
                update_fields["image"] = processed
                update_fields["thumbnail"] = create_thumbnail(processed, max_size=300)
                update_fields["store_thumbnail"] = create_store_thumbnail(processed)
            elif field == "back_image_base64" and value is not None:
                bimg = value
                if ',' in bimg:
                    bimg = bimg.split(',')[1]
                back_processed = process_card_image(bimg, max_size=1200, skip_crop=True)
                update_fields["back_image"] = back_processed
                update_fields["back_thumbnail"] = create_thumbnail(back_processed, max_size=300)
            elif field not in ("image_base64", "back_image_base64"):
                update_fields[field] = value

        if not update_fields:
            raise HTTPException(status_code=400, detail="No fields to update")

        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

        result = await db.inventory.update_one(
            {"id": item_id, "user_id": user_id},
            {"$set": update_fields}
        )
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")

        updated = await db.inventory.find_one({"id": item_id, "user_id": user_id}, {"_id": 0})
        return updated
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update inventory item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{item_id}")
async def delete_inventory_item(item_id: str, request: Request):
    """Delete an inventory item"""
    try:
        user = await get_current_user(request)
        result = await db.inventory.delete_one({"id": item_id, "user_id": user["user_id"]})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Item not found")
        return {"success": True, "message": "Item deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete inventory item failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/from-scan/{analysis_id}")
async def import_from_scan(analysis_id: str, data: ImportFromScanRequest, request: Request):
    """Import a scanned card into inventory"""
    try:
        user = await get_current_user(request)
        user_id = user["user_id"]

        # Check inventory limit
        inv_check = await check_inventory_limit(user_id)
        if not inv_check["allowed"]:
            raise HTTPException(
                status_code=403,
                detail=f"Inventory limit reached ({inv_check['limit']} cards). Upgrade your plan to add more."
            )

        existing = await db.inventory.find_one({"source_analysis_id": analysis_id, "user_id": user_id})
        if existing:
            raise HTTPException(status_code=400, detail="This card is already in your inventory")

        card = await db.card_analyses.find_one({"id": analysis_id}, {"_id": 0})
        if not card:
            raise HTTPException(status_code=404, detail="Card analysis not found")

        grading_result = card.get("grading_result", {})
        card_info = grading_result.get("card_info", "") or card.get("card_name", "")

        player = None
        year = None
        set_name = None
        if card_info:
            year_match = re.search(r'(19|20)\d{2}', card_info)
            if year_match:
                year = int(year_match.group())

        item = InventoryItem(
            card_name=card_info or "Unknown Card",
            player=player, year=year, set_name=set_name,
            condition="Raw", grade=None,
            purchase_price=data.purchase_price, quantity=1,
            notes=data.notes, image=card.get("front_image_preview"),
            category=data.category, source_analysis_id=analysis_id,
        )

        doc = item.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        doc['updated_at'] = doc['updated_at'].isoformat()
        doc['user_id'] = user_id
        await db.inventory.insert_one(doc)
        doc.pop('_id', None)
        return doc
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Import from scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.post("/generate-store-thumbnails")
async def generate_store_thumbnails(request: Request):
    """Generate all missing thumbnails (thumbnail, store_thumbnail, back_thumbnail) for existing inventory items."""
    import gc
    user = await get_current_user(request)
    user_id = user["user_id"]

    # Find items with images but missing any thumbnail type
    items = await db.inventory.find(
        {"user_id": user_id, "image": {"$exists": True, "$ne": None}, "$or": [
            {"store_thumbnail": {"$exists": False}},
            {"thumbnail": {"$exists": False}},
        ]},
        {"_id": 0, "id": 1, "image": 1, "back_image": 1, "store_thumbnail": 1, "thumbnail": 1, "back_thumbnail": 1}
    ).to_list(500)

    updated = 0
    for item in items:
        try:
            updates = {}
            if not item.get("store_thumbnail"):
                updates["store_thumbnail"] = create_store_thumbnail(item["image"])
            if not item.get("thumbnail"):
                updates["thumbnail"] = create_thumbnail(item["image"], max_size=200)
            if item.get("back_image") and not item.get("back_thumbnail"):
                updates["back_thumbnail"] = create_thumbnail(item["back_image"], max_size=200)
            if updates:
                await db.inventory.update_one({"id": item["id"]}, {"$set": updates})
                updated += 1
        except Exception as e:
            logger.warning(f"Failed to generate thumbnails for {item['id']}: {e}")
        if updated % 20 == 0:
            gc.collect()

    gc.collect()
    return {"total_processed": len(items), "updated": updated}
