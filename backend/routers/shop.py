from fastapi import APIRouter, HTTPException
from database import db
from datetime import datetime, timezone
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/shop", tags=["shop"])

CACHE_TTL = 1800  # 30 min


async def _fetch_ebay_shop_data(user_id: str):
    """Fetch active eBay listing IDs + sold count in one API call. Cached."""
    from utils.ebay import get_ebay_user_token
    import xml.etree.ElementTree as ET

    # Check cache
    settings = await db.user_settings.find_one(
        {"user_id": user_id},
        {"_id": 0, "shop_cache": 1}
    )
    cache = (settings or {}).get("shop_cache")
    if cache and cache.get("updated_at"):
        try:
            cached_at = datetime.fromisoformat(cache["updated_at"])
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            # Use cache if fresh, but always retry if sales=0 and active is empty
            if age < CACHE_TTL and (cache.get("sales_count", 0) > 0 or cache.get("active_ids")):
                return cache.get("active_ids", []), cache.get("sales_count", 0)
        except Exception:
            pass

    try:
        token = await get_ebay_user_token(user_id)
        if not token:
            if cache:
                return cache.get("active_ids", []), cache.get("sales_count", 0)
            return [], 0

        # One call: ActiveList (all IDs) + SoldList (count only)
        xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination><EntriesPerPage>200</EntriesPerPage></Pagination>
  </ActiveList>
  <SoldList>
    <DurationInDays>60</DurationInDays>
    <Sort>EndTime</Sort>
    <Pagination><EntriesPerPage>1</EntriesPerPage></Pagination>
  </SoldList>
</GetMyeBaySellingRequest>'''

        active_ids = []
        sales_count = 0

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://api.ebay.com/ws/api.dll",
                headers={
                    "X-EBAY-API-SITEID": "0",
                    "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
                    "X-EBAY-API-IAF-TOKEN": token,
                    "Content-Type": "text/xml"
                },
                content=xml_body
            )

        if resp.status_code == 200:
            ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
            root = ET.fromstring(resp.text)

            ack = root.find(".//e:Ack", ns)
            logger.info(f"GetMyeBaySelling Ack: {ack.text if ack is not None else 'N/A'}")

            # Extract active listing IDs
            active_node = root.find(".//e:ActiveList", ns)
            if active_node is not None:
                for item_el in active_node.findall(".//e:Item", ns):
                    item_id_el = item_el.find("e:ItemID", ns)
                    if item_id_el is not None and item_id_el.text:
                        active_ids.append(item_id_el.text)

            # Extract sold count
            sold_node = root.find(".//e:SoldList", ns)
            if sold_node is not None:
                count_el = sold_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
                if count_el is not None:
                    sales_count = int(count_el.text)

            logger.info(f"Shop data for {user_id}: {len(active_ids)} active listings, {sales_count} sales")
        else:
            logger.warning(f"GetMyeBaySelling failed: {resp.status_code}")

        # Update cache
        await db.user_settings.update_one(
            {"user_id": user_id},
            {"$set": {"shop_cache": {
                "active_ids": active_ids,
                "sales_count": sales_count,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}}
        )
        return active_ids, sales_count

    except Exception as e:
        logger.warning(f"Failed to fetch eBay shop data: {e}")
        if cache:
            return cache.get("active_ids", []), cache.get("sales_count", 0)
        return [], 0


@router.get("/{slug}")
async def get_public_shop(slug: str):
    """Public endpoint - no auth required. Returns shop info + listed cards."""
    settings = await db.user_settings.find_one({"shop_slug": slug.lower()}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Shop not found")

    user_id = settings.get("user_id")
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})

    # Get user's subscription plan
    sub = await db.subscriptions.find_one(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "plan_id": 1}
    )
    plan = (sub.get("plan_id") if sub else None) or "rookie"

    # Fetch active eBay listing IDs + sales count (one API call)
    active_ids, sales_count = await _fetch_ebay_shop_data(user_id)

    # Get inventory items that are currently active on eBay
    if active_ids:
        items = await db.inventory.find(
            {"user_id": user_id, "ebay_item_id": {"$in": active_ids}},
            {"_id": 0, "user_id": 0}
        ).sort("listed_at", -1).to_list(500)
    else:
        # Fallback: if no eBay token/data, show all listed items
        items = await db.inventory.find(
            {"user_id": user_id, "ebay_item_id": {"$exists": True, "$ne": None}},
            {"_id": 0, "user_id": 0}
        ).sort("listed_at", -1).to_list(500)

    # Calculate stats
    sports = list(set(i.get("sport") for i in items if i.get("sport")))

    return {
        "shop": {
            "slug": slug,
            "name": settings.get("shop_name") or settings.get("display_name") or (user.get("name") if user else slug),
            "logo": settings.get("shop_logo") or "",
            "location": settings.get("location", ""),
            "avatar": user.get("picture", "") if user else "",
            "total_items": len(items),
            "sales_count": sales_count,
            "sports": sports,
            "plan": plan,
        },
        "items": items,
    }
