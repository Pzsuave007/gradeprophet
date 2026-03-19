from fastapi import APIRouter, HTTPException
from database import db
from datetime import datetime, timezone
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/shop", tags=["shop"])

SALES_CACHE_TTL = 3600  # 1 hour


async def _fetch_ebay_sales_alltime(user_id: str) -> int:
    """Fetch all-time eBay sales count using Trading API, cached in user_settings."""
    from utils.ebay import get_ebay_user_token
    import xml.etree.ElementTree as ET

    # Check cache first (skip cache if value is 0 — always retry)
    settings = await db.user_settings.find_one(
        {"user_id": user_id},
        {"_id": 0, "sales_alltime_count": 1, "sales_alltime_updated": 1}
    )
    cached_count = settings.get("sales_alltime_count", 0) if settings else 0
    if cached_count > 0 and settings.get("sales_alltime_updated"):
        try:
            cached_at = datetime.fromisoformat(settings["sales_alltime_updated"])
            if (datetime.now(timezone.utc) - cached_at).total_seconds() < SALES_CACHE_TTL:
                return cached_count
        except Exception:
            pass

    try:
        token = await get_ebay_user_token(user_id)
        if not token:
            return settings.get("sales_alltime_count", 0) if settings else 0

        # Use Trading API GetMyeBaySelling to get SoldList total
        # DurationInDays=60 is the max for SoldList
        xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <SoldList>
    <DurationInDays>60</DurationInDays>
    <Sort>EndTime</Sort>
    <Pagination><EntriesPerPage>1</EntriesPerPage></Pagination>
  </SoldList>
</GetMyeBaySellingRequest>'''

        total_orders = 0
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
            
            # Log ack status for debugging
            ack = root.find(".//e:Ack", ns)
            logger.info(f"GetMyeBaySelling Ack: {ack.text if ack is not None else 'N/A'}")
            
            sold_node = root.find(".//e:SoldList", ns)
            if sold_node is not None:
                count_el = sold_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
                if count_el is not None:
                    total_orders = int(count_el.text)
                    logger.info(f"Shop sales count for {user_id}: {total_orders}")
            else:
                logger.warning(f"No SoldList node in response for {user_id}")
        else:
            logger.warning(f"GetMyeBaySelling failed with status {resp.status_code} for {user_id}")

        # Update cache
        await db.user_settings.update_one(
            {"user_id": user_id},
            {"$set": {"sales_alltime_count": total_orders, "sales_alltime_updated": datetime.now(timezone.utc).isoformat()}}
        )
        return total_orders

    except Exception as e:
        logger.warning(f"Failed to fetch eBay sales for shop: {e}")
        return settings.get("sales_alltime_count", 0) if settings else 0


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

    # Get listed inventory items with images
    items = await db.inventory.find(
        {"user_id": user_id, "ebay_item_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 0}
    ).sort("listed_at", -1).to_list(500)

    # Calculate stats
    sports = list(set(i.get("sport") for i in items if i.get("sport")))
    sales_count = await _fetch_ebay_sales_alltime(user_id)

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
