from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
from database import db
import httpx
import logging

router = APIRouter(prefix="/shop", tags=["shop"])
logger = logging.getLogger(__name__)

CACHE_TTL = 300  # 5 min — after this, stale cache is served + background refresh


async def _fetch_ebay_shop_data(user_id: str):
    """Always return cached data instantly. If stale, kick off background refresh."""
    settings = await db.user_settings.find_one(
        {"user_id": user_id},
        {"_id": 0, "shop_cache": 1}
    )
    cache = (settings or {}).get("shop_cache")
    has_cache = cache and cache.get("ebay_items") is not None

    if has_cache and cache.get("updated_at"):
        try:
            cached_at = datetime.fromisoformat(cache["updated_at"])
            age = (datetime.now(timezone.utc) - cached_at).total_seconds()
            if age < CACHE_TTL:
                # Fresh cache
                return cache.get("ebay_items", []), cache.get("sales_count", 0)
            else:
                # Stale cache — serve it now, refresh in background
                import asyncio
                asyncio.create_task(_refresh_shop_cache_bg(user_id))
                return cache.get("ebay_items", []), cache.get("sales_count", 0)
        except Exception:
            pass

    # No cache — must fetch synchronously (first visit only)
    items, sales = await _do_ebay_fetch(user_id)
    return items, sales


async def _refresh_shop_cache_bg(user_id: str):
    """Background task to refresh shop cache without blocking."""
    try:
        await _do_ebay_fetch(user_id)
    except Exception as e:
        logger.warning(f"Background shop cache refresh failed: {e}")


async def _do_ebay_fetch(user_id: str):
    """Actually fetch from eBay API and update cache."""
    from utils.ebay import get_ebay_user_token
    import xml.etree.ElementTree as ET

    try:
        token = await get_ebay_user_token(user_id)
        if not token:
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
    <Sort>StartTime</Sort>
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
                    price = _xml_text(item_el, ".//e:BuyItNowPrice", ns)
                    if not price or price == "0.0":
                        price = _xml_text(item_el, ".//e:CurrentPrice", ns)
                    pic_url = _xml_text(item_el, ".//e:PictureDetails/e:GalleryURL", ns) or ""
                    if not pic_url:
                        pic_url = _xml_text(item_el, ".//e:GalleryURL", ns) or ""
                    pic_url = _to_hires_ebay_img(pic_url)

                    start_time = _xml_text(item_el, ".//e:ListingDetails/e:StartTime", ns) or ""

                    all_ebay_items.append({
                        "ebay_item_id": item_id,
                        "card_name": title,
                        "listed_price": float(price) if price else 0,
                        "ebay_picture": pic_url,
                        "listed_at": start_time,
                    })

                # Check pagination
                total_pages_el = active_node.find("e:PaginationResult/e:TotalNumberOfPages", ns)
                total_pages = int(total_pages_el.text) if total_pages_el is not None else 1
                if page >= total_pages:
                    break
                page += 1

        logger.info(f"Shop data for {user_id}: {len(all_ebay_items)} active listings, {sales_count} sales")

        all_ebay_items.sort(key=lambda x: x.get("listed_at", ""), reverse=True)

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
        # Try to return stale cache
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "shop_cache": 1})
        cache = (settings or {}).get("shop_cache")
        if cache:
            return cache.get("ebay_items", []), cache.get("sales_count", 0)
        return [], 0


def _xml_text(parent, path, ns):
    """Helper to safely extract text from XML element."""
    el = parent.find(path, ns)
    return el.text if el is not None else None


def _to_hires_ebay_img(url: str) -> str:
    """Transform eBay thumbnail URL to high-resolution version."""
    if not url:
        return ""
    import re
    url = url.replace("/thumbs/images/", "/images/")
    url = re.sub(r's-l\d+', 's-l1600', url)
    return url


@router.get("/{slug}/item/{ebay_item_id}")
async def get_item_images(slug: str, ebay_item_id: str):
    """Fetch all images for a specific eBay listing (for flip effect)."""
    from utils.ebay import get_ebay_user_token
    import xml.etree.ElementTree as ET

    settings = await db.user_settings.find_one({"shop_slug": slug.lower()}, {"_id": 0, "user_id": 1})
    if not settings:
        raise HTTPException(status_code=404, detail="Shop not found")

    user_id = settings.get("user_id")

    try:
        token = await get_ebay_user_token(user_id)
        if not token:
            return {"images": []}

        xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ItemID>{ebay_item_id}</ItemID>
  <OutputSelector>PictureDetails</OutputSelector>
</GetItemRequest>'''

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://api.ebay.com/ws/api.dll",
                headers={
                    "X-EBAY-API-SITEID": "0",
                    "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "GetItem",
                    "X-EBAY-API-IAF-TOKEN": token,
                    "Content-Type": "text/xml"
                },
                content=xml_body
            )

        if resp.status_code != 200:
            return {"images": []}

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        images = []
        for pic_el in root.findall(".//e:PictureDetails/e:PictureURL", ns):
            if pic_el.text:
                images.append(_to_hires_ebay_img(pic_el.text))

        return {"images": images}

    except Exception as e:
        logger.warning(f"Failed to fetch item images: {e}")
        return {"images": []}


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

    # Fetch eBay listings (instant from cache, refreshes in background if stale)
    ebay_items, sales_count = await _fetch_ebay_shop_data(user_id)

    # Get inventory items — only fields needed for display (exclude heavy base64 images)
    inventory_items = await db.inventory.find(
        {"user_id": user_id, "ebay_item_id": {"$exists": True, "$ne": None}},
        {"_id": 0, "user_id": 0, "image": 0, "back_image": 0}
    ).to_list(500)
    inv_by_ebay_id = {i["ebay_item_id"]: i for i in inventory_items}

    # Merge: eBay title + price ALWAYS take priority, inventory fills sport/condition
    items = []
    for eb in ebay_items:
        ebay_id = eb["ebay_item_id"]
        inv_item = inv_by_ebay_id.get(ebay_id)
        if inv_item:
            merged = {**inv_item}
            # eBay data overrides inventory for title and price
            merged["card_name"] = eb["card_name"]
            merged["listed_price"] = eb["listed_price"]
            merged["ebay_picture"] = eb.get("ebay_picture") or inv_item.get("ebay_picture", "")
            if not merged.get("listed_at"):
                merged["listed_at"] = eb.get("listed_at", "")
            items.append(merged)
        else:
            # eBay-only listing
            items.append({
                "ebay_item_id": ebay_id,
                "card_name": eb["card_name"],
                "listed_price": eb["listed_price"],
                "ebay_picture": eb["ebay_picture"],
                "listed_at": eb.get("listed_at", ""),
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



@router.get("/{slug}/chase-packs")
async def get_shop_chase_packs(slug: str):
    """Public endpoint — returns active chase packs for a store."""
    settings = await db.user_settings.find_one({"shop_slug": slug.lower()}, {"_id": 0})
    if not settings:
        raise HTTPException(status_code=404, detail="Shop not found")

    user_id = settings.get("user_id")
    packs = await db.chase_packs.find(
        {"user_id": user_id, "status": "active"},
        {"_id": 0, "user_id": 0}
    ).to_list(20)

    result = []
    for p in packs:
        chase_card = next((c for c in p.get("cards", []) if c.get("is_chase") or c.get("tier") == "chase"), None)
        claimed = sum(1 for c in p.get("cards", []) if c.get("assigned_to"))
        total = p.get("total_spots", len(p.get("cards", [])))
        result.append({
            "pack_id": p["pack_id"],
            "title": p.get("title", "Chase Pack"),
            "price": p.get("price", 0),
            "total_spots": total,
            "spots_claimed": claimed,
            "spots_remaining": total - claimed,
            "chase_card_image": chase_card.get("image", "") if chase_card else "",
            "chase_card_player": chase_card.get("player", "") if chase_card else "",
            "ebay_item_id": p.get("ebay_item_id", ""),
            "created_at": p.get("created_at", ""),
        })

    return {"chase_packs": result}
