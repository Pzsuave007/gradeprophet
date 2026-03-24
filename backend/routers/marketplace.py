from fastapi import APIRouter, Query
from database import db
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/marketplace", tags=["marketplace"])


@router.get("")
async def get_marketplace(
    sport: str = Query(None),
    condition: str = Query(None),
    min_price: float = Query(None),
    max_price: float = Query(None),
    seller: str = Query(None),
    search: str = Query(None),
    sort: str = Query("newest"),
    limit: int = Query(200),
):
    """Public marketplace — aggregates all listed cards from all users"""
    try:
        # Get all users who have eBay connected and a shop
        all_settings = await db.user_settings.find(
            {"ebay_user_token": {"$exists": True, "$ne": None}},
            {"_id": 0, "user_id": 1, "shop_name": 1, "display_name": 1, "shop_logo": 1, "shop_slug": 1, "location": 1}
        ).to_list(500)

        user_ids = [s["user_id"] for s in all_settings if s.get("user_id")]
        if not user_ids:
            return {"items": [], "sellers": [], "sports": [], "total": 0}

        settings_map = {}
        for s in all_settings:
            uid = s.get("user_id")
            if uid:
                settings_map[uid] = {
                    "name": s.get("shop_name") or s.get("display_name") or "Shop",
                    "logo": s.get("shop_logo") or "",
                    "slug": s.get("shop_slug") or "",
                    "location": s.get("location") or "",
                }

        # Get user names for fallback
        users = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1}
        ).to_list(500)
        users_map = {u["user_id"]: u for u in users}

        # Get subscription plans
        subs = await db.subscriptions.find(
            {"user_id": {"$in": user_ids}},
            {"_id": 0, "user_id": 1, "plan_id": 1}
        ).to_list(500)
        plan_map = {s["user_id"]: s.get("plan_id", "rookie") for s in subs}

        # Build query for inventory items that are listed on eBay
        inv_query = {
            "user_id": {"$in": user_ids},
            "$or": [
                {"ebay_item_id": {"$exists": True, "$ne": None}},
                {"category": "for_sale"},
            ]
        }

        if sport:
            inv_query["sport"] = sport
        if condition:
            inv_query["condition"] = condition
        if seller:
            inv_query["user_id"] = seller
        if search:
            inv_query["$and"] = inv_query.get("$and", [])
            inv_query["$and"].append({
                "$or": [
                    {"card_name": {"$regex": search, "$options": "i"}},
                    {"player": {"$regex": search, "$options": "i"}},
                    {"set_name": {"$regex": search, "$options": "i"}},
                ]
            })

        items_raw = await db.inventory.find(
            inv_query,
            {"_id": 0, "user_id": 1, "card_name": 1, "player": 1, "year": 1, "set_name": 1,
             "card_number": 1, "sport": 1, "condition": 1, "grading_company": 1, "grade": 1,
             "listed_price": 1, "purchase_price": 1, "ebay_item_id": 1, "ebay_picture": 1,
             "image": 1, "back_image": 1, "category": 1, "listed_at": 1, "created_at": 1}
        ).to_list(1000)

        # Filter by price range
        items = []
        for item in items_raw:
            price = item.get("listed_price") or item.get("purchase_price") or 0
            if isinstance(price, str):
                try:
                    price = float(price)
                except (ValueError, TypeError):
                    price = 0
            if min_price is not None and price < min_price:
                continue
            if max_price is not None and price > max_price:
                continue

            uid = item.get("user_id", "")
            seller_info = settings_map.get(uid, {})
            user_info = users_map.get(uid, {})

            item["seller_name"] = seller_info.get("name") or user_info.get("name", "Shop")
            item["seller_slug"] = seller_info.get("slug", "")
            item["seller_logo"] = seller_info.get("logo") or user_info.get("picture", "")
            item["seller_plan"] = plan_map.get(uid, "rookie")
            item["price_num"] = price
            # Remove user_id from public response
            item.pop("user_id", None)
            items.append(item)

        # Sort
        if sort == "price_high":
            items.sort(key=lambda x: x.get("price_num", 0), reverse=True)
        elif sort == "price_low":
            items.sort(key=lambda x: x.get("price_num", 0))
        elif sort == "newest":
            items.sort(key=lambda x: x.get("listed_at") or x.get("created_at") or "", reverse=True)

        items = items[:limit]

        # Collect available filters
        all_sports = sorted(set(i.get("sport") for i in items if i.get("sport")))
        all_sellers = []
        seen_sellers = set()
        for i in items:
            sn = i.get("seller_name", "")
            if sn and sn not in seen_sellers:
                seen_sellers.add(sn)
                all_sellers.append({"name": sn, "slug": i.get("seller_slug", ""), "logo": i.get("seller_logo", "")})

        return {
            "items": items,
            "total": len(items),
            "sports": all_sports,
            "sellers": all_sellers,
        }
    except Exception as e:
        logger.error(f"Marketplace error: {e}")
        return {"items": [], "total": 0, "sports": [], "sellers": []}
