from fastapi import APIRouter, HTTPException
from database import db
from datetime import datetime, timezone
import httpx
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/shop", tags=["shop"])

CACHE_TTL = 300  # 5 min


async def _fetch_ebay_shop_data(user_id: str):
    """Fetch ALL active eBay listings with details + sold count. Cached."""
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
            if age < CACHE_TTL and (cache.get("sales_count", 0) > 0 or cache.get("ebay_items")):
                return cache.get("ebay_items", []), cache.get("sales_count", 0)
        except Exception:
            pass

    try:
        token = await get_ebay_user_token(user_id)
        if not token:
            if cache:
                return cache.get("ebay_items", []), cache.get("sales_count", 0)
            return [], 0

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        all_ebay_items = []
        sales_count = 0
        page = 1

        async with httpx.AsyncClient(timeout=20.0) as client:
            while True:
                xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>{page}</PageNumber></Pagination>
  </ActiveList>
  {"<SoldList><DurationInDays>60</DurationInDays><Sort>EndTime</Sort><Pagination><EntriesPerPage>1</EntriesPerPage></Pagination></SoldList>" if page == 1 else ""}
</GetMyeBaySellingRequest>'''

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

                if resp.status_code != 200:
                    logger.warning(f"GetMyeBaySelling failed: {resp.status_code}")
                    break

                root = ET.fromstring(resp.text)

                # Sales count (only on first page)
                if page == 1:
                    sold_node = root.find(".//e:SoldList", ns)
                    if sold_node is not None:
                        count_el = sold_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
                        if count_el is not None:
                            sales_count = int(count_el.text)

                # Extract active listings with details
                active_node = root.find(".//e:ActiveList", ns)
                if active_node is None:
                    break

                items_on_page = active_node.findall(".//e:Item", ns)
                for item_el in items_on_page:
                    item_id = _xml_text(item_el, "e:ItemID", ns)
                    if not item_id:
                        continue

                    title = _xml_text(item_el, "e:Title", ns) or ""
                    # Price: try BuyItNowPrice, then CurrentPrice
                    price = _xml_text(item_el, ".//e:BuyItNowPrice", ns)
                    if not price or price == "0.0":
                        price = _xml_text(item_el, ".//e:CurrentPrice", ns)
                    # Picture
                    pic_url = _xml_text(item_el, ".//e:PictureDetails/e:GalleryURL", ns) or ""
                    if not pic_url:
                        pic_url = _xml_text(item_el, ".//e:GalleryURL", ns) or ""

                    all_ebay_items.append({
                        "ebay_item_id": item_id,
                        "card_name": title,
                        "listed_price": float(price) if price else 0,
                        "ebay_picture": pic_url,
                    })

                # Check pagination
                total_pages_el = active_node.find("e:PaginationResult/e:TotalNumberOfPages", ns)
                total_pages = int(total_pages_el.text) if total_pages_el is not None else 1
                if page >= total_pages:
                    break
                page += 1

        logger.info(f"Shop data for {user_id}: {len(all_ebay_items)} active listings, {sales_count} sales")

        # Update cache
        await db.user_settings.update_one(
            {"user_id": user_id},
            {"$set": {"shop_cache": {
                "ebay_items": all_ebay_items,
                "sales_count": sales_count,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}}
        )
        return all_ebay_items, sales_count

    except Exception as e:
        logger.warning(f"Failed to fetch eBay shop data: {e}")
        if cache:
            return cache.get("ebay_items", []), cache.get("sales_count", 0)
        return [], 0


def _xml_text(parent, path, ns):
    """Helper to safely extract text from XML element."""
    el = parent.find(path, ns)
    return el.text if el is not None else None


@router.get("/{slug}")
async def get_public_shop(slug: str):
    """Public endpoint - no auth required. Returns ALL active eBay listings."""
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

    # Fetch ALL active eBay listings + sales count
    ebay_items, sales_count = await _fetch_ebay_shop_data(user_id)

    # Get FlipSlab inventory items that have eBay IDs (for richer data: images, sport, condition)
    inventory_items = await db.inventory.find(
        {"user_id": user_id, "ebay_item_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 0}
    ).to_list(500)
    inv_by_ebay_id = {i["ebay_item_id"]: i for i in inventory_items}

    # Merge: FlipSlab data takes priority, eBay-only items fill the rest
    items = []
    for eb in ebay_items:
        ebay_id = eb["ebay_item_id"]
        inv_item = inv_by_ebay_id.get(ebay_id)
        if inv_item:
            # Use FlipSlab data (has sport, condition, better images, etc.)
            items.append(inv_item)
        else:
            # eBay-only listing — use eBay data
            items.append({
                "ebay_item_id": ebay_id,
                "card_name": eb["card_name"],
                "listed_price": eb["listed_price"],
                "ebay_picture": eb["ebay_picture"],
                "source": "ebay",
            })

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
