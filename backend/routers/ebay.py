from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone
from io import BytesIO
from PIL import Image
import asyncio
import base64
import uuid
import json
import html
import re
import logging
import httpx
from database import db
from config import EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME, openai_client
from utils.auth import get_current_user
from utils.ebay import EBAY_OAUTH_SCOPES, get_ebay_user_token, get_ebay_app_token
from utils.market import get_card_market_value
from utils.plan_limits import check_listing_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ebay", tags=["ebay"])


# ---- Models ----

class EbayListingPreviewRequest(BaseModel):
    inventory_item_id: str

class EbayListingCreateRequest(BaseModel):
    inventory_item_id: str
    title: str
    description: str
    price: float
    listing_format: str = "FixedPriceItem"
    duration: str = "GTC"
    condition_id: int = 3000
    condition_description: Optional[str] = None
    shipping_option: str = "USPSFirstClass"
    shipping_cost: float = 0.0
    category_id: str = "261328"
    postal_code: str = ""
    location: str = ""
    sport: Optional[str] = None
    player: Optional[str] = None
    season: Optional[str] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    grading_company: Optional[str] = None
    grade: Optional[str] = None
    cert_number: Optional[str] = None
    best_offer: bool = False

class ReviseListingRequest(BaseModel):
    item_id: str
    title: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None
    description: Optional[str] = None
    best_offer: Optional[bool] = None
    shipping_option: Optional[str] = None
    shipping_cost: Optional[float] = None

class BulkReviseShippingRequest(BaseModel):
    item_ids: list[str]
    shipping_option: str
    shipping_cost: float = 0.0

class ListingAIRequest(BaseModel):
    card_name: str
    player: Optional[str] = None
    year: Optional[int] = None
    set_name: Optional[str] = None
    card_number: Optional[str] = None
    variation: Optional[str] = None
    condition: Optional[str] = None
    grading_company: Optional[str] = None
    grade: Optional[float] = None
    sport: Optional[str] = None



# Known card manufacturers for extraction from set_name
KNOWN_MANUFACTURERS = [
    "Upper Deck", "Panini", "Topps", "Bowman", "Donruss", "Fleer",
    "Skybox", "Score", "Prizm", "Select", "Mosaic", "Hoops",
    "Leaf", "Sage", "Press Pass", "Playoff", "SP Authentic",
    "Stadium Club", "Pinnacle", "Pacific", "Classic", "Wild Card",
    "O-Pee-Chee", "Pro Set", "Action Packed", "Collector's Edge"
]

SPORT_LEAGUE_MAP = {
    "Basketball": "NBA", "Baseball": "MLB", "Football": "NFL",
    "Soccer": "MLS", "Hockey": "NHL", "Wrestling": "WWE",
    "Golf": "PGA", "Tennis": "ATP", "MMA": "UFC",
}


def extract_manufacturer(set_name: str) -> str:
    """Extract manufacturer/brand from set_name like '2023 Topps Chrome' -> 'Topps'"""
    if not set_name:
        return ""
    sn_lower = set_name.lower()
    for mfr in KNOWN_MANUFACTURERS:
        if mfr.lower() in sn_lower:
            return mfr
    # Fallback: use first word after year (if present)
    parts = set_name.strip().split()
    if len(parts) >= 2 and parts[0].isdigit():
        return parts[1]
    if parts:
        return parts[0]
    return ""


def build_item_specifics(item: dict, data=None) -> list:
    """Build expanded eBay Item Specifics list for Cassini SEO optimization.
    Returns list of NameValueList XML strings."""
    specifics = []

    def add(name, value):
        if value:
            specifics.append(f'<NameValueList><Name>{html.escape(name)}</Name><Value>{html.escape(str(value))}</Value></NameValueList>')

    # -- Required / Always present --
    add("Type", "Sports Trading Card")

    sport = (data.sport if data and hasattr(data, 'sport') and data.sport else None) or item.get("sport") or "Basketball"
    add("Sport", sport)

    player = (data.player if data and hasattr(data, 'player') and data.player else None) or item.get("player")
    add("Player/Athlete", player)

    year = (data.season if data and hasattr(data, 'season') and data.season else None) or (str(item.get("year")) if item.get("year") else None)
    add("Season", year)
    if year:
        add("Year Manufactured", str(year).split("-")[0])  # Handle "2021-22" -> "2021"

    set_n = (data.set_name if data and hasattr(data, 'set_name') and data.set_name else None) or item.get("set_name")
    add("Set", set_n)

    card_num = (data.card_number if data and hasattr(data, 'card_number') and data.card_number else None) or item.get("card_number")
    add("Card Number", card_num)

    # -- Expanded specifics for SEO --
    add("Card Name", player or item.get("card_name"))

    manufacturer = extract_manufacturer(set_n or "")
    add("Manufacturer", manufacturer)

    league = SPORT_LEAGUE_MAP.get(sport, "")
    add("League", league)

    # Team: from inventory field
    team = item.get("team") or ""
    add("Team", team)

    variation = item.get("variation") or ""
    if variation:
        add("Parallel/Variety", variation)

    # Print Run: extract /XX pattern from variation (e.g. "Gold Refractor /50" -> "/50")
    print_run_match = re.search(r'/(\d+)', variation) if variation else None
    if print_run_match:
        add("Print Run", f"/{print_run_match.group(1)}")

    # Features: build from card attributes
    features = []
    if item.get("condition") == "Graded" or item.get("grading_company"):
        features.append("Graded")
    if variation and any(kw in variation.lower() for kw in ["refractor", "holo", "chrome", "shimmer", "prizm"]):
        features.append("Refractor")
    if variation and "rc" in variation.lower():
        features.append("Rookie Card (RC)")
    if features:
        add("Features", ", ".join(features))

    # Vintage: Yes if year < 1980
    try:
        yr_int = int(str(year).split("-")[0]) if year else 0
        add("Vintage", "Yes" if yr_int > 0 and yr_int < 1980 else "No")
    except (ValueError, TypeError):
        add("Vintage", "No")

    # Autographed: check variation for "auto" keyword
    is_auto = variation and "auto" in variation.lower()
    add("Autographed", "Yes" if is_auto else "No")

    # Signed By: always populate with player name for eBay search visibility
    add("Signed By", player)

    # Static defaults
    add("Card Size", "Standard")
    add("Country/Region of Manufacture", "United States")
    add("Language", "English")
    add("Original/Reprint", "Original")
    add("Custom Bundle", "No")
    add("Material", "Card Stock")

    return specifics


# ---- Helpers ----

def generate_listing_title(item: dict) -> str:
    base = item.get("card_name", "")
    if base and len(base) > 15:
        title = base
        if item.get("condition") == "Graded" and item.get("grade"):
            company = item.get("grading_company", "PSA")
            grade_str = f"{company} {item['grade']}"
            if grade_str.lower() not in title.lower():
                title = f"{title} {grade_str}"
        return title[:80]
    parts = []
    if item.get("year"): parts.append(str(item["year"]))
    if item.get("set_name"): parts.append(item["set_name"])
    if item.get("player"): parts.append(item["player"])
    if item.get("variation"): parts.append(item["variation"])
    if item.get("card_number"): parts.append(f"#{item['card_number']}")
    if item.get("condition") == "Graded" and item.get("grade"):
        parts.append(f"{item.get('grading_company', 'PSA')} {item['grade']}")
    title = " ".join(parts)
    if not title.strip(): title = base or "Sports Card"
    return title[:80]


def generate_listing_description(item: dict) -> str:
    lines = []
    card_name = item.get("card_name", "")
    if card_name: lines.extend([card_name, ""])
    if item.get("player"): lines.append(f"Player: {item['player']}")
    if item.get("year"): lines.append(f"Year: {item['year']}")
    if item.get("set_name"): lines.append(f"Set: {item['set_name']}")
    if item.get("card_number"): lines.append(f"Card Number: {item['card_number']}")
    if item.get("variation"): lines.append(f"Variation: {item['variation']}")
    if item.get("condition") == "Graded" and item.get("grade"):
        lines.append(f"Grade: {item.get('grading_company', 'PSA')} {item['grade']}")
        if item.get("cert_number"):
            lines.append(f"Cert #: {item['cert_number']}")
    else:
        lines.append("Condition: Raw / Ungraded")
    lines.extend(["", "Ships securely in penny sleeve and top loader.", "Ships within 1 business day."])
    if item.get("notes"): lines.append(f"\nNotes: {item['notes']}")
    return "\n".join(lines)


# ---- OAuth Routes ----

@router.get("/oauth/authorize")
async def ebay_authorize(request: Request):
    """Start eBay OAuth flow"""
    from urllib.parse import quote_plus
    user = await get_current_user(request)
    user_id = user["user_id"]
    if not EBAY_CLIENT_ID or not EBAY_RUNAME:
        raise HTTPException(status_code=500, detail="eBay API not configured")
    state = base64.urlsafe_b64encode(user_id.encode()).decode()
    redirect_url = f"https://auth.ebay.com/oauth2/authorize?client_id={EBAY_CLIENT_ID}&redirect_uri={quote_plus(EBAY_RUNAME)}&response_type=code&scope={quote_plus(EBAY_OAUTH_SCOPES)}&state={state}"
    return {"authorization_url": redirect_url}


@router.get("/oauth/callback")
async def ebay_callback(code: str = None, error: str = None, state: str = None):
    """Handle eBay OAuth callback"""
    if error:
        return {"success": False, "error": error}
    if not code:
        return {"success": False, "error": "No authorization code received"}

    # Extract user_id from state parameter
    user_id = None
    if state:
        try:
            user_id = base64.urlsafe_b64decode(state.encode()).decode()
        except Exception:
            pass

    credentials = base64.b64encode(f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}".encode()).decode()

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                "https://api.ebay.com/identity/v1/oauth2/token",
                headers={"Content-Type": "application/x-www-form-urlencoded", "Authorization": f"Basic {credentials}"},
                data={"grant_type": "authorization_code", "code": code, "redirect_uri": EBAY_RUNAME}
            )

        if resp.status_code != 200:
            return {"success": False, "error": f"Token exchange failed: {resp.text[:200]}"}

        token_data = resp.json()

        token_filter = {"type": "user_token"}
        token_set = {
            "type": "user_token",
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "expires_in": token_data.get("expires_in", 7200),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if user_id:
            token_filter["user_id"] = user_id
            token_set["user_id"] = user_id

        await db.ebay_tokens.update_one(
            token_filter,
            {"$set": token_set},
            upsert=True
        )

        return RedirectResponse(url="/?ebay=connected")
    except Exception as e:
        logger.error(f"eBay callback failed: {e}")
        return {"success": False, "error": str(e)}


@router.get("/oauth/status")
async def ebay_oauth_status(request: Request):
    """Check eBay connection status for current user"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    return {"connected": bool(token)}


@router.get("/seller/listings")
async def get_seller_listings(request: Request, limit: int = 10, offset: int = 0):
    """Get seller's active eBay listings"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay account not connected")

    try:
        import xml.etree.ElementTree as ET
        xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination><EntriesPerPage>{limit}</EntriesPerPage><PageNumber>{(offset // limit) + 1}</PageNumber></Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>'''

        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                "https://api.ebay.com/ws/api.dll",
                headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml"
                },
                content=xml_body
            )

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        listings = []
        active_node = root.find(".//e:ActiveList", ns)
        total = 0
        if active_node:
            count_el = active_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
            total = int(count_el.text) if count_el is not None else 0
            for item_el in active_node.findall(".//e:Item", ns):
                item_id_el = item_el.find("e:ItemID", ns)
                title_el = item_el.find("e:Title", ns)
                price_el = item_el.find(".//e:CurrentPrice", ns)
                url_el = item_el.find("e:ListingDetails/e:ViewItemURL", ns)
                time_el = item_el.find("e:TimeLeft", ns)
                qty_el = item_el.find("e:QuantityAvailable", ns)
                watch_el = item_el.find("e:WatchCount", ns)
                pic_el = item_el.find(".//e:PictureDetails/e:GalleryURL", ns)
                full_pic_el = item_el.find(".//e:PictureDetails/e:PictureURL", ns)
                pic_url = ""
                if full_pic_el is not None and full_pic_el.text:
                    pic_url = full_pic_el.text
                elif pic_el is not None and pic_el.text:
                    pic_url = pic_el.text
                if pic_url and "s-l140" in pic_url:
                    pic_url = pic_url.replace("s-l140", "s-l400")
                elif pic_url and "s-l225" in pic_url:
                    pic_url = pic_url.replace("s-l225", "s-l400")

                listings.append({
                    "item_id": item_id_el.text if item_id_el is not None else "",
                    "title": title_el.text if title_el is not None else "",
                    "price": float(price_el.text) if price_el is not None else 0,
                    "url": url_el.text if url_el is not None else "",
                    "image_url": pic_url,
                    "time_left": time_el.text if time_el is not None else "",
                    "quantity": int(qty_el.text) if qty_el is not None else 1,
                    "watchers": int(watch_el.text) if watch_el is not None else 0,
                })

        return {"active": listings, "active_total": total}
    except Exception as e:
        logger.error(f"Get seller listings failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/seller/active-listings")
async def get_active_listings_browse(request: Request, limit: int = 20):
    """Get seller's active listings via Browse API (fallback)"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.get(
                "https://api.ebay.com/sell/inventory/v1/inventory_item",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                params={"limit": limit}
            )
        if resp.status_code == 200:
            return resp.json()
        return {"inventoryItems": [], "total": 0, "error": f"Status {resp.status_code}"}
    except Exception as e:
        logger.error(f"Active listings browse failed: {e}")
        return {"inventoryItems": [], "total": 0, "error": str(e)}


@router.get("/seller/orders")
async def get_seller_orders(request: Request, limit: int = 20):
    """Get seller's recent orders"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.get(
                "https://api.ebay.com/sell/fulfillment/v1/order",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
                params={"limit": limit}
            )
        if resp.status_code == 200:
            return resp.json()
        return {"orders": [], "total": 0, "error": f"Status {resp.status_code}"}
    except Exception as e:
        logger.error(f"Get orders failed: {e}")
        return {"orders": [], "total": 0, "error": str(e)}


@router.get("/seller/my-listings")
async def get_my_listings_trading(
    request: Request,
    sold_days: int = 60,
    force_refresh: bool = False,
):
    """Get seller's active and sold listings. Uses stale-while-revalidate cache for instant loads."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    sold_days = min(max(sold_days, 1), 60)

    def _cache_age_seconds(cached_at):
        if cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - cached_at).total_seconds()

    # Check cache first
    if not force_refresh:
        cache = await db.listings_cache.find_one({"user_id": user_id}, {"_id": 0})
        if cache and cache.get("active") is not None:
            cache_age = _cache_age_seconds(cache["cached_at"])
            # Stale after 5 minutes → return cache + refresh in background
            if cache_age > 300:
                asyncio.create_task(_refresh_listings_cache(user_id, token, sold_days))
            return {
                "active": cache["active"],
                "sold": cache["sold"],
                "active_total": cache.get("active_total", len(cache["active"])),
                "sold_total": cache.get("sold_total", len(cache["sold"])),
                "cached": True,
                "cache_age": int(cache_age),
            }

    # No cache or force refresh — fetch from eBay (slow first load)
    try:
        result = await _fetch_listings_from_ebay(user_id, token, sold_days)
        # Cache in background
        asyncio.create_task(_save_listings_cache(user_id, result))
        return result
    except Exception as e:
        # If eBay fails but we have stale cache, return it
        cache = await db.listings_cache.find_one({"user_id": user_id}, {"_id": 0})
        if cache and cache.get("active") is not None:
            cache_age = _cache_age_seconds(cache["cached_at"])
            return {
                "active": cache["active"],
                "sold": cache["sold"],
                "active_total": cache.get("active_total", len(cache["active"])),
                "sold_total": cache.get("sold_total", len(cache["sold"])),
                "cached": True,
                "cache_age": int(cache_age),
            }
        logger.error(f"My listings failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


async def _save_listings_cache(user_id: str, result: dict):
    """Save listings result to cache."""
    try:
        await db.listings_cache.update_one(
            {"user_id": user_id},
            {"$set": {
                "user_id": user_id,
                "active": result["active"],
                "sold": result["sold"],
                "active_total": result.get("active_total", 0),
                "sold_total": result.get("sold_total", 0),
                "cached_at": datetime.now(timezone.utc),
            }},
            upsert=True
        )
    except Exception as e:
        logger.warning(f"Failed to save listings cache: {e}")


async def _refresh_listings_cache(user_id: str, token: str, sold_days: int):
    """Background task: refresh listings cache from eBay."""
    try:
        result = await _fetch_listings_from_ebay(user_id, token, sold_days)
        await _save_listings_cache(user_id, result)
        logger.info(f"Listings cache refreshed for user {user_id}: {result['active_total']} active, {result['sold_total']} sold")
    except Exception as e:
        logger.warning(f"Background listings refresh failed for {user_id}: {e}")


async def _fetch_listings_from_ebay(user_id: str, token: str, sold_days: int) -> dict:
    """Heavy fetch from eBay Trading API — all active + sold listings."""
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    def get_listing_image(item_el):
        full_pic = item_el.find(".//e:PictureDetails/e:PictureURL", ns)
        if full_pic is not None and full_pic.text:
            url = full_pic.text
        else:
            gallery = item_el.find(".//e:PictureDetails/e:GalleryURL", ns)
            url = gallery.text if gallery is not None else ""
        if url and "s-l140" in url:
            url = url.replace("s-l140", "s-l400")
        elif url and "s-l225" in url:
            url = url.replace("s-l225", "s-l400")
        elif url and "s-l1600" in url:
            url = url.replace("s-l1600", "s-l400")
        elif url and "s-l800" in url:
            url = url.replace("s-l800", "s-l400")
        return url

    def parse_active_item(item_el):
        item_data = {}
        for field in ["ItemID", "Title"]:
            el = item_el.find(f"e:{field}", ns)
            item_data[field.lower()] = el.text if el is not None else ""
        price_el = item_el.find(".//e:CurrentPrice", ns)
        item_data["price"] = float(price_el.text) if price_el is not None else 0
        item_data["image_url"] = get_listing_image(item_el)
        tl_el = item_el.find("e:TimeLeft", ns)
        item_data["time_left"] = tl_el.text if tl_el is not None else ""
        qty_el = item_el.find("e:QuantityAvailable", ns)
        item_data["quantity"] = int(qty_el.text) if qty_el is not None else 1
        wc_el = item_el.find("e:WatchCount", ns)
        item_data["watchers"] = int(wc_el.text) if wc_el is not None else 0
        bid_el = item_el.find(".//e:BidCount", ns)
        item_data["bids"] = int(bid_el.text) if bid_el is not None else 0
        list_type_el = item_el.find("e:ListingType", ns)
        item_data["listing_type"] = list_type_el.text if list_type_el is not None else "FixedPriceItem"
        start_el = item_el.find(".//e:ListingDetails/e:StartTime", ns)
        item_data["start_time"] = start_el.text if start_el is not None else ""
        item_data["url"] = f"https://www.ebay.com/itm/{item_data['itemid']}"
        return item_data

    def parse_sold_item(item_el):
        trans_el = item_el.find("e:Transaction", ns)
        actual_item = item_el.find(".//e:Item", ns)
        if actual_item is None:
            return None
        item_data = {}
        item_id_el = actual_item.find("e:ItemID", ns)
        item_data["itemid"] = item_id_el.text if item_id_el is not None else ""
        title_el = actual_item.find("e:Title", ns)
        item_data["title"] = title_el.text if title_el is not None else ""
        sold_price = 0
        if trans_el is not None:
            tp_el = trans_el.find("e:TotalPrice", ns)
            if tp_el is None:
                tp_el = trans_el.find("e:TransactionPrice", ns)
            if tp_el is not None:
                sold_price = float(tp_el.text)
        if sold_price == 0:
            price_el = actual_item.find(".//e:CurrentPrice", ns)
            if price_el is not None:
                sold_price = float(price_el.text)
        item_data["price"] = sold_price
        item_data["image_url"] = get_listing_image(actual_item)
        buyer = ""
        if trans_el is not None:
            buyer_el = trans_el.find("e:Buyer/e:UserID", ns)
            if buyer_el is not None:
                buyer = buyer_el.text
        item_data["buyer"] = buyer
        if trans_el is not None:
            date_el = trans_el.find("e:CreatedDate", ns)
            if date_el is not None:
                item_data["sold_date"] = date_el.text
        qty_el = None
        if trans_el is not None:
            qty_el = trans_el.find("e:QuantityPurchased", ns)
        item_data["quantity_sold"] = int(qty_el.text) if qty_el is not None else 1
        item_data["url"] = f"https://www.ebay.com/itm/{item_data['itemid']}"
        return item_data

    # Fetch ALL active listings (paginate through all eBay pages)
    all_active = []
    active_total = 0
    active_page = 1
    async with httpx.AsyncClient(timeout=25.0) as http_client:
        while True:
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
<DetailLevel>ReturnAll</DetailLevel>
<ActiveList>
<Sort>TimeLeft</Sort>
<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>{active_page}</PageNumber></Pagination>
</ActiveList>
{f'<SoldList><DurationInDays>{sold_days}</DurationInDays><Sort>EndTime</Sort><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination></SoldList>' if active_page == 1 else ''}
</GetMyeBaySellingRequest>'''
            resp = await http_client.post(
                "https://api.ebay.com/ws/api.dll",
                headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml"
                },
                content=xml_body
            )
            root = ET.fromstring(resp.text)
            active_node = root.find(".//e:ActiveList", ns)
            if active_node:
                if active_page == 1:
                    count_el = active_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
                    active_total = int(count_el.text) if count_el is not None else 0
                for item_el in active_node.findall(".//e:Item", ns):
                    all_active.append(parse_active_item(item_el))
                total_pages_el = active_node.find("e:PaginationResult/e:TotalNumberOfPages", ns)
                total_pages = int(total_pages_el.text) if total_pages_el is not None else 1
                if active_page >= total_pages:
                    break
                active_page += 1
            else:
                break

    # Fetch sold listings separately
    sold = []
    sold_total = 0
    async with httpx.AsyncClient(timeout=25.0) as http_client:
        sold_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
<RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
<DetailLevel>ReturnAll</DetailLevel>
<SoldList>
<DurationInDays>{sold_days}</DurationInDays>
<Sort>EndTime</Sort>
<Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>1</PageNumber></Pagination>
</SoldList>
</GetMyeBaySellingRequest>'''
        sold_resp = await http_client.post(
            "https://api.ebay.com/ws/api.dll",
            headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
                "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml"
            },
            content=sold_xml
        )
    sold_root = ET.fromstring(sold_resp.text)
    sold_node = sold_root.find(".//e:SoldList", ns)
    if sold_node:
        count_el = sold_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
        sold_total = int(count_el.text) if count_el is not None else 0
        for item_el in sold_node.findall(".//e:OrderTransaction", ns):
            item_data = parse_sold_item(item_el)
            if item_data:
                sold.append(item_data)

    # Enrich images: use local inventory ebay_picture for items missing eBay images
    all_ebay_ids = [a.get("itemid") for a in all_active + sold if a.get("itemid")]
    if all_ebay_ids:
        inv_pics = await db.inventory.find(
            {"user_id": user_id, "ebay_item_id": {"$in": all_ebay_ids}, "ebay_picture": {"$exists": True, "$ne": ""}},
            {"_id": 0, "ebay_item_id": 1, "ebay_picture": 1}
        ).to_list(1000)
        pic_map = {it["ebay_item_id"]: it["ebay_picture"] for it in inv_pics}

        # Fill missing images from inventory
        for item in all_active + sold:
            if not item.get("image_url"):
                pic = pic_map.get(item.get("itemid"))
                if pic:
                    item["image_url"] = pic

    # Browse API fallback for sold items still missing images
    still_missing = [s for s in sold if not s.get("image_url")]
    if still_missing:
        try:
            app_token = await get_ebay_app_token()
            if app_token:
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    for s_item in still_missing:
                        item_id = s_item.get("itemid", "")
                        if not item_id:
                            continue
                        try:
                            browse_resp = await http_client.get(
                                f"https://api.ebay.com/buy/browse/v1/item/v1|{item_id}|0",
                                headers={
                                    "Authorization": f"Bearer {app_token}",
                                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
                                }
                            )
                            if browse_resp.status_code == 200:
                                browse_data = browse_resp.json()
                                img = browse_data.get("image", {}).get("imageUrl", "")
                                if img:
                                    for old, new in [("s-l140", "s-l400"), ("s-l225", "s-l400"), ("s-l500", "s-l400"), ("s-l800", "s-l400"), ("s-l1600", "s-l400")]:
                                        if old in img:
                                            img = img.replace(old, new)
                                            break
                                    s_item["image_url"] = img
                        except Exception:
                            pass
        except Exception as e:
            logger.warning(f"Failed to fetch sold item images via Browse API: {e}")

    # Auto-mark sold items and sync photos in background
    sold_ebay_id_set = set(s.get("itemid") for s in sold if s.get("itemid"))
    if sold_ebay_id_set:
        confirmed_sold = await db.inventory.update_many(
            {"user_id": user_id, "ebay_item_id": {"$in": list(sold_ebay_id_set)}, "category": {"$ne": "sold"}},
            {"$set": {"category": "sold", "listed": False}}
        )
        if confirmed_sold.modified_count > 0:
            logger.info(f"Auto-marked {confirmed_sold.modified_count} items as sold for user {user_id}")

    # Sync eBay photos to inventory in background
    async def _sync_photos():
        try:
            for listing in all_active:
                ebay_id = listing.get("itemid")
                img_url = listing.get("image_url")
                if ebay_id and img_url:
                    await db.inventory.update_one(
                        {"user_id": user_id, "ebay_item_id": ebay_id, "ebay_picture": {"$ne": img_url}},
                        {"$set": {"ebay_picture": img_url}}
                    )
        except Exception as ex:
            logger.warning(f"Background eBay photo sync error: {ex}")

    asyncio.create_task(_sync_photos())

    return {
        "active": all_active,
        "sold": sold,
        "active_total": active_total,
        "sold_total": sold_total,
    }



@router.post("/fix-false-sold")
async def fix_false_sold_items(request: Request):
    """Fix items incorrectly marked as sold - restores items that have an active eBay listing"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    # Find all inventory items marked as sold that have an ebay_item_id
    sold_items = await db.inventory.find(
        {"user_id": user_id, "category": "sold", "ebay_item_id": {"$ne": None}},
        {"_id": 0, "id": 1, "ebay_item_id": 1, "card_name": 1}
    ).to_list(500)

    if not sold_items:
        return {"fixed": 0, "message": "No sold items with eBay IDs found"}

    # Check which of these are actually still active on eBay
    import xml.etree.ElementTree as ET
    all_active_ids = set()
    page = 1
    while True:
        xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>{page}</PageNumber></Pagination>
  </ActiveList>
</GetMyeBaySellingRequest>'''
        async with httpx.AsyncClient(timeout=25.0) as http_client:
            resp = await http_client.post(
                "https://api.ebay.com/ws/api.dll",
                headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml"
                },
                content=xml_body
            )
        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        active_node = root.find(".//e:ActiveList", ns)
        if not active_node:
            break
        items_on_page = active_node.findall(".//e:Item", ns)
        for item_el in items_on_page:
            iid = item_el.find("e:ItemID", ns)
            if iid is not None and iid.text:
                all_active_ids.add(iid.text)
        total_pages_el = active_node.find("e:PaginationResult/e:TotalNumberOfPages", ns)
        total_pages = int(total_pages_el.text) if total_pages_el is not None else 1
        if page >= total_pages:
            break
        page += 1

    # Restore items that are still active on eBay but marked as sold in our system
    fixed_items = []
    for inv_item in sold_items:
        if inv_item.get("ebay_item_id") in all_active_ids:
            fixed_items.append(inv_item["ebay_item_id"])

    fixed_count = 0
    if fixed_items:
        result = await db.inventory.update_many(
            {"user_id": user_id, "ebay_item_id": {"$in": fixed_items}},
            {"$set": {"category": "for_sale", "listed": True}}
        )
        fixed_count = result.modified_count
        logger.info(f"Fixed {fixed_count} falsely sold items for user {user_id}")

    return {
        "fixed": fixed_count,
        "total_checked": len(sold_items),
        "active_on_ebay": len(all_active_ids),
        "message": f"Restored {fixed_count} items that were incorrectly marked as sold"
    }



# ---- Sell Routes ----

@router.post("/sell/preview")
async def preview_ebay_listing(data: EbayListingPreviewRequest, request: Request):
    """Generate a preview of the eBay listing"""
    user = await get_current_user(request)
    item = await db.inventory.find_one({"id": data.inventory_item_id, "user_id": user["user_id"]}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    title = generate_listing_title(item)
    description = generate_listing_description(item)
    # For ungraded cards: ConditionID is always 4000, condition shown via descriptor
    # Map card_condition from inventory to descriptor value for frontend
    card_cond_to_descriptor = {"Near Mint or Better": 400010, "Excellent": 400011, "Very Good": 400012, "Poor": 400013}
    condition_id = 2750 if item.get("condition") == "Graded" else card_cond_to_descriptor.get(item.get("card_condition", "Near Mint or Better"), 400010)

    purchase_price = item.get("purchase_price", 0) or 0
    suggested_price = round(purchase_price * 1.3, 2) if purchase_price > 0 else 9.99
    market_data = None

    try:
        parts = []
        if item.get("year"): parts.append(str(item["year"]))
        if item.get("set_name"): parts.append(item["set_name"])
        if item.get("player"): parts.append(item["player"])
        if item.get("grading_company") and item.get("grade"):
            parts.append(f"{item['grading_company']} {int(float(item['grade']))}")
        search_query = " ".join(parts) if parts else item.get("card_name", "")

        value_resp = await get_card_market_value(query=search_query)
        if isinstance(value_resp, dict):
            primary = value_resp.get("primary", {})
            stats = primary.get("stats", {})
            median = stats.get("median", 0)
            if median > 0:
                suggested_price = median
                market_data = {
                    "market_value": median, "sold_count": stats.get("count", 0),
                    "price_range": {"low": stats.get("min", 0), "high": stats.get("max", 0)},
                    "recent_sales": primary.get("items", [])[:3],
                    "data_source": value_resp.get("data_source", "unknown"),
                }
    except Exception as e:
        logger.warning(f"Market lookup failed for preview: {e}")

    return {
        "title": title, "description": description, "condition_id": condition_id,
        "suggested_price": round(suggested_price, 2), "purchase_price": purchase_price,
        "market_data": market_data,
        "item": {
            "card_name": item.get("card_name"), "player": item.get("player"),
            "year": item.get("year"), "condition": item.get("condition"),
            "grade": item.get("grade"), "grading_company": item.get("grading_company"),
            "image": item.get("image"),
            "back_image": item.get("back_image"),
            "has_back_image": bool(item.get("back_image")),
        }
    }


@router.post("/sell/create")
async def create_ebay_listing(data: EbayListingCreateRequest, request: Request):
    """Create and publish an eBay listing"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    # Check listing limit
    listing_check = await check_listing_limit(user_id)
    if not listing_check["allowed"]:
        raise HTTPException(
            status_code=403,
            detail=f"Listing limit reached ({listing_check['limit']} listings). Upgrade your plan to create more."
        )

    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay account not connected")

    item = await db.inventory.find_one({"id": data.inventory_item_id, "user_id": user_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    # Shipping XML
    ebay_shipping_service = data.shipping_option
    if data.shipping_option == "PWEEnvelope":
        ebay_shipping_service = "USPSFirstClass"
    
    if data.shipping_option == "FreeShipping":
        shipping_xml = """<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>USPSFirstClass</ShippingService><FreeShipping>true</FreeShipping><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>"""
    else:
        shipping_cost = data.shipping_cost if data.shipping_cost > 0 else (2.50 if data.shipping_option == "PWEEnvelope" else 4.50 if data.shipping_option == "USPSFirstClass" else 8.50)
        shipping_xml = f"""<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>{ebay_shipping_service}</ShippingService><ShippingServiceCost currencyID="USD">{shipping_cost:.2f}</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>"""

    # Best Offer XML
    best_offer_xml = ""
    if data.best_offer and data.listing_format == "FixedPriceItem":
        best_offer_xml = "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>"

    api_call = "AddFixedPriceItem" if data.listing_format == "FixedPriceItem" else "AddItem"
    duration = data.duration if data.listing_format == "FixedPriceItem" else (data.duration if data.duration in ["Days_3", "Days_5", "Days_7", "Days_10"] else "Days_7")

    # Upload images
    picture_urls = []

    async def upload_image_to_ebay(img_base64, label="card"):
        image_bytes = base64.b64decode(img_base64)
        try:
            img_pil = Image.open(BytesIO(image_bytes))
            w, h = img_pil.size
            if max(w, h) < 500:
                scale = 500 / max(w, h)
                img_pil = img_pil.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                buf = BytesIO()
                img_pil.save(buf, format='JPEG', quality=90)
                image_bytes = buf.getvalue()
        except Exception as e:
            logger.warning(f"Image resize failed for {label}: {e}")

        upload_xml = f'''<?xml version="1.0" encoding="utf-8"?><UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials><PictureName>{html.escape(data.title[:40])} {label}</PictureName></UploadSiteHostedPicturesRequest>'''

        boundary = "MIME_boundary_EBAY"
        body_parts = [f"--{boundary}\r\n", "Content-Disposition: form-data; name=\"XML Payload\"\r\n", "Content-Type: text/xml\r\n\r\n", upload_xml, f"\r\n--{boundary}\r\n", f"Content-Disposition: form-data; name=\"image\"; filename=\"{label}.jpg\"\r\n", "Content-Type: image/jpeg\r\nContent-Transfer-Encoding: binary\r\n\r\n"]
        text_part = "".join(body_parts).encode('utf-8')
        end_part = f"\r\n--{boundary}--\r\n".encode('utf-8')
        full_body = text_part + image_bytes + end_part

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "UploadSiteHostedPictures",
                "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            }, content=full_body)

        import xml.etree.ElementTree as ET
        root = ET.fromstring(resp.text)
        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        url_el = root.find(".//e:FullURL", ns)
        if url_el is not None and url_el.text:
            return url_el.text
        return None

    for img_key, label in [("image", "front"), ("back_image", "back")]:
        if item.get(img_key):
            try:
                logger.info(f"eBay upload: {label} image found ({len(item[img_key])} chars base64)")
                url = await upload_image_to_ebay(item[img_key], label)
                if url:
                    picture_urls.append(url)
                    logger.info(f"eBay upload: {label} SUCCESS -> {url[:80]}...")
                else:
                    logger.warning(f"eBay upload: {label} returned no URL")
            except Exception as e:
                logger.warning(f"Failed to upload {label} image: {e}")
        else:
            logger.info(f"eBay upload: {label} image NOT FOUND in inventory item")

    picture_xml = ""
    if picture_urls:
        urls_xml = "\n".join(f"<PictureURL>{u}</PictureURL>" for u in picture_urls)
        picture_xml = f"<PictureDetails>{urls_xml}</PictureDetails>"

    # Item specifics - expanded for better eBay Cassini SEO
    specifics = build_item_specifics(item, data)
    cert_num = data.cert_number or item.get("cert_number")
    if cert_num: specifics.append(f'<NameValueList><Name>Certification Number</Name><Value>{html.escape(str(cert_num))}</Value></NameValueList>')

    grading_co = data.grading_company or item.get("grading_company") or ""
    grade_val = data.grade or (str(item.get("grade")) if item.get("grade") else "")
    is_graded = bool(grading_co and grade_val)

    GRADER_IDS = {"PSA": "275010", "BCCG": "275011", "BVG": "275012", "BGS": "275013", "CSG": "275014", "CGC": "275015", "SGC": "275016", "KSA": "275017", "GMA": "275018", "HGA": "275019", "ISA": "2750110", "Other": "2750123"}
    GRADE_IDS = {"10": "275020", "9.5": "275021", "9": "275022", "8.5": "275023", "8": "275024", "7.5": "275025", "7": "275026", "6.5": "275027", "6": "275028", "5.5": "275029", "5": "2750210", "4.5": "2750211", "4": "2750212", "3.5": "2750213", "3": "2750214", "2.5": "2750215", "2": "2750216", "1.5": "2750217", "1": "2750218", "Authentic": "2750219"}

    if is_graded:
        actual_condition_id = 2750
        grader_id = GRADER_IDS.get(grading_co, "2750123")
        grade_normalized = str(grade_val).rstrip('0').rstrip('.') if '.' in str(grade_val) else str(grade_val)
        grade_id = GRADE_IDS.get(grade_normalized, GRADE_IDS.get(str(int(float(grade_val))), "275022"))
        condition_descriptors_xml = f"<ConditionDescriptors><ConditionDescriptor><Name>27501</Name><Value>{grader_id}</Value></ConditionDescriptor><ConditionDescriptor><Name>27502</Name><Value>{grade_id}</Value></ConditionDescriptor></ConditionDescriptors>"
    else:
        actual_condition_id = 4000  # Always 4000 for ungraded sports cards
        # Frontend now sends descriptor values directly (400010, 400011, 400012, 400013)
        card_condition_value = str(data.condition_id) if data.condition_id in (400010, 400011, 400012, 400013) else "400010"
        condition_descriptors_xml = f"<ConditionDescriptors><ConditionDescriptor><Name>40001</Name><Value>{card_condition_value}</Value></ConditionDescriptor></ConditionDescriptors>"

    item_specifics_xml = "<ItemSpecifics>" + "".join(specifics) + "</ItemSpecifics>"
    safe_title = html.escape(data.title[:80])
    safe_desc = html.escape(data.description)

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<{api_call}Request xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>{safe_title}</Title><Description>{safe_desc}</Description>
    <PrimaryCategory><CategoryID>{data.category_id}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">{data.price:.2f}</StartPrice>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    <ConditionID>{actual_condition_id}</ConditionID>{condition_descriptors_xml}
    <Country>US</Country><Currency>USD</Currency>
    <PostalCode>{html.escape(data.postal_code)}</PostalCode>
    <Location>{html.escape(data.location)}</Location>
    <DispatchTimeMax>1</DispatchTimeMax>
    <ListingDuration>{duration}</ListingDuration><ListingType>{data.listing_format}</ListingType>
    {picture_xml}{shipping_xml}{item_specifics_xml}{best_offer_xml}
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><RefundOption>MoneyBack</RefundOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
  </Item>
</{api_call}Request>'''

    try:
        import xml.etree.ElementTree as ET
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": api_call, "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": "text/xml",
            }, content=xml_body)

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        ack = root.find("e:Ack", ns)
        ack_text = ack.text if ack is not None else "Unknown"

        if ack_text in ("Success", "Warning"):
            item_id_el = root.find("e:ItemID", ns)
            ebay_item_id = item_id_el.text if item_id_el is not None else ""

            await db.inventory.update_one({"id": data.inventory_item_id}, {"$set": {
                "listed": True, "ebay_item_id": ebay_item_id,
                "listed_price": data.price, "listed_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }})

            await db.created_listings.insert_one({
                "id": str(uuid.uuid4()), "user_id": user_id,
                "inventory_item_id": data.inventory_item_id,
                "ebay_item_id": ebay_item_id, "title": data.title,
                "price": data.price, "listing_format": data.listing_format,
                "shipping_option": data.shipping_option, "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

            warnings = []
            for err in root.findall(".//e:Errors", ns):
                sev = err.find("e:SeverityCode", ns)
                if sev is not None and sev.text == "Warning":
                    msg_el = err.find("e:LongMessage", ns)
                    if msg_el is not None: warnings.append(msg_el.text)

            return {"success": True, "ebay_item_id": ebay_item_id,
                    "url": f"https://www.ebay.com/itm/{ebay_item_id}",
                    "fees": 0, "warnings": warnings,
                    "message": f"Listing created! Item ID: {ebay_item_id}"}
        else:
            errors = []
            for err in root.findall(".//e:Errors", ns):
                msg_el = err.find("e:LongMessage", ns)
                code_el = err.find("e:ErrorCode", ns)
                if msg_el is not None:
                    errors.append({"code": code_el.text if code_el is not None else "", "message": msg_el.text})
            return {"success": False, "errors": errors, "message": errors[0]["message"] if errors else "Unknown error"}
    except Exception as e:
        logger.error(f"Create eBay listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---- Lot Listing ----

class LotListingRequest(BaseModel):
    card_ids: List[str]  # inventory card IDs
    title: Optional[str] = None
    price: float
    condition_id: int = 4000  # 4000 = Very Good
    condition_description: Optional[str] = None
    listing_format: str = "FixedPriceItem"
    duration: str = "GTC"
    shipping_service: str = "USPSFirstClass"
    shipping_cost: float = 0.0
    best_offer: bool = True
    minimum_offer: Optional[float] = None
    auto_accept: Optional[float] = None


def generate_lot_title(cards: list) -> str:
    """Auto-generate lot title from cards: 'Lot of 5 Basketball Cards - Kobe, LeBron...'"""
    count = len(cards)
    sports = set(c.get("sport", "Sports") for c in cards if c.get("sport"))
    sport = sports.pop() if len(sports) == 1 else "Sports"
    players = [c.get("player", "") for c in cards if c.get("player")]
    unique_players = list(dict.fromkeys(players))  # dedup preserving order
    player_str = ", ".join(unique_players[:4])
    if len(unique_players) > 4:
        player_str += f" + {len(unique_players) - 4} More"
    title = f"Lot of {count} {sport} Cards - {player_str}"
    return title[:80]  # eBay 80 char limit


def generate_lot_description(cards: list) -> str:
    """Generate HTML description with bullet points for each card."""
    lines = ['<div style="font-family:Arial,sans-serif;color:#333;">']
    lines.append(f'<h2 style="color:#222;">Lot of {len(cards)} Cards</h2>')
    lines.append('<p>This lot includes the following cards:</p>')
    lines.append('<ul style="line-height:1.8;">')
    for c in cards:
        name = c.get("card_name", "Unknown Card")
        player = c.get("player", "")
        year = c.get("year", "")
        set_name = c.get("set_name", "")
        variation = c.get("variation", "")
        condition = c.get("condition", "")
        grade = c.get("grade", "")
        grading = c.get("grading_company", "")

        detail = f"<b>{name}</b>"
        extras = []
        if year and set_name:
            extras.append(f"{year} {set_name}")
        if variation:
            extras.append(variation)
        if condition == "Graded" and grading and grade:
            extras.append(f"{grading} {grade}")
        elif condition:
            extras.append(condition)
        if extras:
            detail += f" - {', '.join(extras)}"
        lines.append(f'  <li>{detail}</li>')

    lines.append('</ul>')
    lines.append('<p style="color:#666;font-size:12px;">Ships fast with tracking. All cards shown in photos.</p>')
    lines.append('</div>')
    return "\n".join(lines)


@router.post("/sell/create-lot")
async def create_lot_listing(data: LotListingRequest, request: Request):
    """Create a lot listing on eBay from multiple inventory cards."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay account not connected")

    if len(data.card_ids) < 2 or len(data.card_ids) > 10:
        raise HTTPException(status_code=400, detail="Lot must have 2-10 cards")

    # Fetch all cards from inventory
    cards = []
    for cid in data.card_ids:
        card = await db.inventory.find_one({"_id_str": cid, "user_id": user_id}, {"_id": 0})
        if not card:
            card = await db.inventory.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if card:
            cards.append(card)

    if len(cards) < 2:
        raise HTTPException(status_code=400, detail=f"Only found {len(cards)} valid cards")

    # Generate title and description
    title = data.title or generate_lot_title(cards)
    description = generate_lot_description(cards)

    # Generate collage images
    from utils.image import create_lot_collage

    front_images = [c["image"] for c in cards if c.get("image")]
    collage_b64_list = []

    if len(front_images) > 5:
        # Two collages: first half and second half
        mid = len(front_images) // 2
        c1 = create_lot_collage(front_images[:mid], cards_per_row=min(mid, 5))
        c2 = create_lot_collage(front_images[mid:], cards_per_row=min(len(front_images) - mid, 5))
        if c1: collage_b64_list.append(c1)
        if c2: collage_b64_list.append(c2)
    elif front_images:
        c1 = create_lot_collage(front_images, cards_per_row=min(len(front_images), 5))
        if c1: collage_b64_list.append(c1)

    # Upload all images to eBay: collages first, then individual fronts, then backs
    picture_urls = []

    async def upload_image_to_ebay(img_base64, label="card"):
        image_bytes = base64.b64decode(img_base64)
        try:
            img_pil = Image.open(BytesIO(image_bytes))
            w, h = img_pil.size
            if max(w, h) < 500:
                scale = 500 / max(w, h)
                img_pil = img_pil.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
                buf = BytesIO()
                img_pil.save(buf, format='JPEG', quality=90)
                image_bytes = buf.getvalue()
        except Exception:
            pass

        upload_xml = f'''<?xml version="1.0" encoding="utf-8"?><UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials><PictureName>{html.escape(title[:40])} {label}</PictureName></UploadSiteHostedPicturesRequest>'''
        boundary = "MIME_boundary_EBAY"
        body_parts = [f"--{boundary}\r\n", "Content-Disposition: form-data; name=\"XML Payload\"\r\n", "Content-Type: text/xml\r\n\r\n", upload_xml, f"\r\n--{boundary}\r\n", f"Content-Disposition: form-data; name=\"image\"; filename=\"{label}.jpg\"\r\n", "Content-Type: image/jpeg\r\nContent-Transfer-Encoding: binary\r\n\r\n"]
        text_part = "".join(body_parts).encode('utf-8')
        end_part = f"\r\n--{boundary}--\r\n".encode('utf-8')
        full_body = text_part + image_bytes + end_part

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "UploadSiteHostedPictures",
                "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            }, content=full_body)

        import xml.etree.ElementTree as ET
        root = ET.fromstring(resp.text)
        ns_ebay = {"e": "urn:ebay:apis:eBLBaseComponents"}
        url_el = root.find(".//e:FullURL", ns_ebay)
        if url_el is not None and url_el.text:
            return url_el.text
        return None

    # 1. Upload collage images
    for i, collage_b64 in enumerate(collage_b64_list):
        try:
            url = await upload_image_to_ebay(collage_b64, f"lot-overview-{i+1}")
            if url:
                picture_urls.append(url)
        except Exception as e:
            logger.warning(f"Collage upload {i} failed: {e}")

    # 2. Upload individual fronts
    for i, card in enumerate(cards):
        if card.get("image") and len(picture_urls) < 24:
            try:
                url = await upload_image_to_ebay(card["image"], f"card-{i+1}-front")
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Front {i} upload failed: {e}")

    # 3. Upload individual backs
    for i, card in enumerate(cards):
        if card.get("back_image") and len(picture_urls) < 24:
            try:
                url = await upload_image_to_ebay(card["back_image"], f"card-{i+1}-back")
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Back {i} upload failed: {e}")

    if not picture_urls:
        raise HTTPException(status_code=400, detail="No images could be uploaded")

    picture_xml = "<PictureDetails>" + "\n".join(f"<PictureURL>{u}</PictureURL>" for u in picture_urls) + "</PictureDetails>"

    # Build Item Specifics from the first card (primary)
    specifics = build_item_specifics(cards[0])
    # Override Type for lot
    specifics = [s for s in specifics if "<Name>Type</Name>" not in s]
    specifics.insert(0, '<NameValueList><Name>Type</Name><Value>Sports Trading Card</Value></NameValueList>')
    item_specifics_xml = "<ItemSpecifics>" + "".join(specifics) + "</ItemSpecifics>"

    # Shipping - match single-listing format
    ebay_shipping_service = data.shipping_service
    if data.shipping_service == "PWEEnvelope":
        ebay_shipping_service = "USPSFirstClass"

    if data.shipping_service == "FreeShipping":
        shipping_xml = """<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>USPSFirstClass</ShippingService><FreeShipping>true</FreeShipping><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>"""
    else:
        s_cost = data.shipping_cost if data.shipping_cost > 0 else (2.50 if data.shipping_service == "PWEEnvelope" else 4.50 if data.shipping_service == "USPSFirstClass" else 8.50)
        shipping_xml = f"""<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>{ebay_shipping_service}</ShippingService><ShippingServiceCost currencyID="USD">{s_cost:.2f}</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>"""

    # Condition - use ConditionID 4000 with ConditionDescriptors (same as single listings)
    actual_condition_id = 4000
    card_condition_value = str(data.condition_id) if data.condition_id in (400010, 400011, 400012, 400013) else "400010"
    condition_descriptors_xml = f"<ConditionDescriptors><ConditionDescriptor><Name>40001</Name><Value>{card_condition_value}</Value></ConditionDescriptor></ConditionDescriptors>"

    # Best offer
    best_offer_xml = ""
    if data.best_offer:
        best_offer_xml = "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>"
        bo_prefs = []
        if data.auto_accept:
            bo_prefs.append(f"<BestOfferAutoAcceptPrice>{data.auto_accept}</BestOfferAutoAcceptPrice>")
        if data.minimum_offer:
            bo_prefs.append(f"<MinimumBestOfferPrice>{data.minimum_offer}</MinimumBestOfferPrice>")
        if bo_prefs:
            best_offer_xml += "<ListingDetails>" + "".join(bo_prefs) + "</ListingDetails>"

    # Create the listing XML
    lot_quantity = 1
    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>{html.escape(title)}</Title>
    <Description><![CDATA[{description}]]></Description>
    <PrimaryCategory><CategoryID>261328</CategoryID></PrimaryCategory>
    <StartPrice>{data.price}</StartPrice>
    <Quantity>{lot_quantity}</Quantity>
    <LotSize>{len(cards)}</LotSize>
    <ListingDuration>{data.duration}</ListingDuration>
    <ConditionID>{actual_condition_id}</ConditionID>{condition_descriptors_xml}
    {f'<ConditionDescription>{html.escape(data.condition_description)}</ConditionDescription>' if data.condition_description else ''}
    <Country>US</Country><Currency>USD</Currency>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingType>FixedPriceItem</ListingType>
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
    {picture_xml}{shipping_xml}{item_specifics_xml}{best_offer_xml}
  </Item>
</AddFixedPriceItemRequest>'''

    # Submit to eBay
    try:
        import xml.etree.ElementTree as ET
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "AddFixedPriceItem",
                "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": "text/xml",
            }, content=xml_body)

        root = ET.fromstring(resp.text)
        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        ack = root.find("e:Ack", ns)

        if ack is not None and ack.text in ("Success", "Warning"):
            item_id_el = root.find("e:ItemID", ns)
            ebay_item_id = item_id_el.text if item_id_el is not None else ""

            # Generate a lot_id
            lot_id = f"lot_{uuid.uuid4().hex[:12]}"

            # Move all cards to "lots" category and link to lot
            for card in cards:
                card_id = card.get("id") or card.get("_id_str")
                if card_id:
                    await db.inventory.update_one(
                        {"id": card_id, "user_id": user_id},
                        {"$set": {
                            "category": "lots",
                            "lot_id": lot_id,
                            "ebay_item_id": ebay_item_id,
                            "listed": True,
                        }}
                    )

            # Save lot record
            await db.lots.insert_one({
                "lot_id": lot_id,
                "user_id": user_id,
                "ebay_item_id": ebay_item_id,
                "title": title,
                "price": data.price,
                "card_ids": [c.get("id") or c.get("_id_str") for c in cards],
                "card_count": len(cards),
                "image_count": len(picture_urls),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
            })

            return {
                "success": True,
                "ebay_item_id": ebay_item_id,
                "lot_id": lot_id,
                "title": title,
                "images_uploaded": len(picture_urls),
                "cards_in_lot": len(cards),
                "message": f"Lot of {len(cards)} cards listed on eBay!",
            }
        else:
            errors = root.findall(".//e:Errors/e:LongMessage", ns)
            error_msgs = [e.text for e in errors if e.text]
            logger.error(f"Lot listing failed: {error_msgs}")
            return {"success": False, "error": error_msgs[0] if error_msgs else "eBay listing failed"}

    except Exception as e:
        logger.error(f"Create lot listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sell/lot-preview")
async def lot_preview(request: Request):
    """Generate lot title, description, and collage preview without publishing."""
    user = await get_current_user(request)
    body = await request.json()
    card_ids = body.get("card_ids", [])

    cards = []
    for cid in card_ids:
        card = await db.inventory.find_one({"id": cid, "user_id": user["user_id"]}, {"_id": 0, "image": 0, "back_image": 0})
        if card:
            cards.append(card)

    if len(cards) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 cards")

    title = generate_lot_title(cards)
    description = generate_lot_description(cards)
    total_value = sum(c.get("purchase_price") or c.get("card_value") or 0 for c in cards)

    # Generate collage preview from thumbnails
    collage_preview = None
    try:
        from utils.image import create_lot_collage
        thumb_images = [c.get("store_thumbnail") or c.get("thumbnail") for c in cards if c.get("store_thumbnail") or c.get("thumbnail")]
        if len(thumb_images) >= 2:
            collage_preview = create_lot_collage(thumb_images, cards_per_row=min(len(thumb_images), 5), card_height=300)
    except Exception as e:
        logger.warning(f"Collage preview generation failed: {e}")

    return {
        "title": title,
        "description": description,
        "card_count": len(cards),
        "suggested_price": round(total_value, 2),
        "collage_preview": collage_preview,
        "cards": [{
            "id": c.get("id"),
            "card_name": c.get("card_name"),
            "player": c.get("player"),
            "year": c.get("year"),
            "set_name": c.get("set_name"),
            "condition": c.get("condition"),
            "grade": c.get("grade"),
            "grading_company": c.get("grading_company"),
            "thumbnail": c.get("store_thumbnail") or c.get("thumbnail"),
        } for c in cards],
    }



@router.delete("/sell/{ebay_item_id}")
async def end_ebay_listing(ebay_item_id: str, request: Request, reason: str = "NotAvailable"):
    """End an active eBay listing"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay account not connected")

    valid_reasons = ["NotAvailable", "Incorrect", "LostOrBroken", "OtherListingError"]
    if reason not in valid_reasons:
        reason = "NotAvailable"

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ItemID>{ebay_item_id}</ItemID><EndingReason>{reason}</EndingReason>
</EndItemRequest>'''

    try:
        import xml.etree.ElementTree as ET
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "EndItem", "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": "text/xml",
            }, content=xml_body)

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        ack = root.find("e:Ack", ns)
        if ack is not None and ack.text in ("Success", "Warning"):
            await db.inventory.update_one({"ebay_item_id": ebay_item_id}, {"$set": {"listed": False, "ebay_item_id": None, "listed_price": None, "listed_at": None}})
            await db.created_listings.update_one({"ebay_item_id": ebay_item_id}, {"$set": {"status": "ended"}})
            return {"success": True, "message": f"Listing {ebay_item_id} ended"}
        else:
            errors = []
            for err in root.findall(".//e:Errors", ns):
                msg_el = err.find("e:LongMessage", ns)
                if msg_el is not None: errors.append(msg_el.text)
            return {"success": False, "message": errors[0] if errors else "Failed to end listing"}
    except Exception as e:
        logger.error(f"End eBay listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sell/created-listings")
async def get_created_listings(request: Request):
    """Get listings created through the app"""
    user = await get_current_user(request)
    listings = await db.created_listings.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"listings": listings, "total": len(listings)}


@router.post("/sell/revise")
async def revise_ebay_listing(data: ReviseListingRequest, request: Request):
    """Revise an active eBay listing"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    fields_xml = ""
    if data.title: fields_xml += f"<Title>{html.escape(data.title[:80])}</Title>\n"
    if data.price is not None: fields_xml += f'<StartPrice currencyID="USD">{data.price:.2f}</StartPrice>\n'
    if data.quantity is not None: fields_xml += f"<Quantity>{data.quantity}</Quantity>\n"
    if data.description: fields_xml += f"<Description>{html.escape(data.description)}</Description>\n"
    if data.best_offer is not None:
        fields_xml += f"<BestOfferDetails><BestOfferEnabled>{'true' if data.best_offer else 'false'}</BestOfferEnabled></BestOfferDetails>\n"
    if data.shipping_option is not None:
        ebay_service = data.shipping_option
        if data.shipping_option == "PWEEnvelope":
            ebay_service = "USPSFirstClass"
        if data.shipping_option == "FreeShipping":
            fields_xml += '<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>USPSFirstClass</ShippingService><FreeShipping>true</FreeShipping><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>\n'
        else:
            s_cost = data.shipping_cost if data.shipping_cost and data.shipping_cost > 0 else (2.50 if data.shipping_option == "PWEEnvelope" else 4.50 if data.shipping_option == "USPSFirstClass" else 8.50)
            fields_xml += f'<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>{ebay_service}</ShippingService><ShippingServiceCost currencyID="USD">{s_cost:.2f}</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>\n'

    if not fields_xml.strip():
        return {"success": False, "message": "No changes provided"}

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{data.item_id}</ItemID>{fields_xml}</Item>
</ReviseFixedPriceItemRequest>'''

    try:
        import xml.etree.ElementTree as ET
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
                "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
            }, content=xml_body)

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        ack = root.find("e:Ack", ns)

        if ack is not None and ack.text in ("Success", "Warning"):
            return {"success": True, "message": "Listing updated", "warnings": []}

        # Try ReviseItem for auction items
        xml_body2 = xml_body.replace("ReviseFixedPriceItemRequest", "ReviseItemRequest")
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp2 = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "ReviseItem",
                "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
            }, content=xml_body2)
        root2 = ET.fromstring(resp2.text)
        ack2 = root2.find("e:Ack", ns)
        if ack2 is not None and ack2.text in ("Success", "Warning"):
            return {"success": True, "message": "Listing updated", "warnings": []}

        errors = []
        for err in root.findall(".//e:Errors", ns):
            msg_el = err.find("e:LongMessage", ns)
            code_el = err.find("e:ErrorCode", ns)
            if msg_el is not None:
                errors.append({"code": code_el.text if code_el is not None else "", "message": msg_el.text})
        return {"success": False, "errors": errors, "message": errors[0]["message"] if errors else "Failed to update"}
    except Exception as e:
        logger.error(f"Revise eBay listing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sell/bulk-revise-shipping")
async def bulk_revise_shipping(data: BulkReviseShippingRequest, request: Request):
    """Bulk update shipping on multiple active eBay listings"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    ebay_service = data.shipping_option
    if data.shipping_option == "PWEEnvelope":
        ebay_service = "USPSFirstClass"

    if data.shipping_option == "FreeShipping":
        shipping_xml = '<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>USPSFirstClass</ShippingService><FreeShipping>true</FreeShipping><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>'
    else:
        s_cost = data.shipping_cost if data.shipping_cost > 0 else (2.50 if data.shipping_option == "PWEEnvelope" else 4.50 if data.shipping_option == "USPSFirstClass" else 8.50)
        shipping_xml = f'<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>{ebay_service}</ShippingService><ShippingServiceCost currencyID="USD">{s_cost:.2f}</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>'

    results = []
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for item_id in data.item_ids:
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{item_id}</ItemID>{shipping_xml}</Item>
</ReviseFixedPriceItemRequest>'''
            try:
                resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
                }, content=xml_body)
                root = ET.fromstring(resp.text)
                ack = root.find("e:Ack", ns)
                if ack is not None and ack.text in ("Success", "Warning"):
                    results.append({"item_id": item_id, "success": True})
                else:
                    # Try ReviseItem for auction items
                    xml_body2 = xml_body.replace("ReviseFixedPriceItemRequest", "ReviseItemRequest")
                    resp2 = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                        "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                        "X-EBAY-API-CALL-NAME": "ReviseItem",
                        "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
                    }, content=xml_body2)
                    root2 = ET.fromstring(resp2.text)
                    ack2 = root2.find("e:Ack", ns)
                    if ack2 is not None and ack2.text in ("Success", "Warning"):
                        results.append({"item_id": item_id, "success": True})
                    else:
                        err_el = root.find(".//e:Errors/e:LongMessage", ns)
                        results.append({"item_id": item_id, "success": False, "error": err_el.text if err_el is not None else "Failed"})
            except Exception as e:
                results.append({"item_id": item_id, "success": False, "error": str(e)})

    success_count = sum(1 for r in results if r["success"])
    return {"success": success_count > 0, "total": len(data.item_ids), "updated": success_count, "results": results}



class BulkReviseConditionRequest(BaseModel):
    item_ids: List[str]  # eBay item IDs
    card_condition: str  # "Near Mint or Better", "Excellent", "Very Good", "Poor"


CONDITION_MAP = {
    "Near Mint or Better": 400010,
    "Excellent": 400011,
    "Very Good": 400012,
    "Poor": 400013,
}


@router.post("/sell/bulk-revise-condition")
async def bulk_revise_condition(data: BulkReviseConditionRequest, request: Request):
    """Bulk update condition on active eBay listings + update inventory"""
    user = await get_current_user(request)
    user_id = user["user_id"]

    if data.card_condition not in CONDITION_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid condition: {data.card_condition}")

    descriptor_value = CONDITION_MAP[data.card_condition]
    # For ungraded sports cards: ConditionID is ALWAYS 4000, sub-condition via descriptor 40001
    condition_xml = f'<ConditionID>4000</ConditionID><ConditionDescriptors><ConditionDescriptor><Name>40001</Name><Value>{descriptor_value}</Value></ConditionDescriptor></ConditionDescriptors>'

    # Update inventory records
    await db.inventory.update_many(
        {"ebay_item_id": {"$in": data.item_ids}, "user_id": user_id},
        {"$set": {
            "card_condition": data.card_condition,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )

    # Try to revise on eBay
    token = await get_ebay_user_token(user_id)
    if not token:
        return {"success": True, "total": len(data.item_ids), "updated": len(data.item_ids),
                "note": "Inventory updated. eBay not connected — listings not revised on eBay."}

    results = []
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for item_id in data.item_ids:
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{item_id}</ItemID>{condition_xml}</Item>
</ReviseFixedPriceItemRequest>'''
            try:
                resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
                }, content=xml_body)
                root = ET.fromstring(resp.text)
                ack = root.find("e:Ack", ns)
                if ack is not None and ack.text in ("Success", "Warning"):
                    results.append({"item_id": item_id, "success": True})
                else:
                    err_el = root.find(".//e:Errors/e:LongMessage", ns)
                    results.append({"item_id": item_id, "success": False, "error": err_el.text if err_el is not None else "eBay rejected condition change"})
            except Exception as e:
                results.append({"item_id": item_id, "success": False, "error": str(e)})

    ebay_ok = sum(1 for r in results if r["success"])
    ebay_fail = sum(1 for r in results if not r["success"])
    return {
        "success": True,
        "total": len(data.item_ids),
        "updated": len(data.item_ids),
        "ebay_revised": ebay_ok,
        "ebay_failed": ebay_fail,
        "note": f"Inventory updated. eBay: {ebay_ok} revised, {ebay_fail} failed (eBay may restrict condition changes on some listings).",
        "results": results,
    }




class BulkBestOfferRequest(BaseModel):
    item_ids: List[str]  # eBay item IDs
    enable: bool  # True to enable, False to disable


@router.post("/sell/bulk-revise-best-offer")
async def bulk_revise_best_offer(data: BulkBestOfferRequest, request: Request):
    """Bulk enable/disable Best Offer on multiple active eBay listings"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    best_offer_xml = f"<BestOfferDetails><BestOfferEnabled>{'true' if data.enable else 'false'}</BestOfferEnabled></BestOfferDetails>"

    results = []
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for item_id in data.item_ids:
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{item_id}</ItemID>{best_offer_xml}</Item>
</ReviseFixedPriceItemRequest>'''
            try:
                resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
                }, content=xml_body)
                root = ET.fromstring(resp.text)
                ack = root.find("e:Ack", ns)
                if ack is not None and ack.text in ("Success", "Warning"):
                    results.append({"item_id": item_id, "success": True})
                else:
                    err_el = root.find(".//e:Errors/e:LongMessage", ns)
                    results.append({"item_id": item_id, "success": False, "error": err_el.text if err_el is not None else "Failed"})
            except Exception as e:
                results.append({"item_id": item_id, "success": False, "error": str(e)})

    ok = sum(1 for r in results if r["success"])
    action = "enabled" if data.enable else "disabled"
    return {"success": ok > 0, "total": len(data.item_ids), "updated": ok, "results": results,
            "note": f"Best Offer {action} on {ok}/{len(data.item_ids)} listings"}



class BulkReviseSpecificsRequest(BaseModel):
    item_ids: List[str]  # eBay item IDs


@router.post("/sell/bulk-revise-specifics")
async def bulk_revise_specifics(data: BulkReviseSpecificsRequest, request: Request):
    """Bulk update Item Specifics on active eBay listings for better Cassini SEO"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    results = []
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for item_id in data.item_ids:
            # Find inventory item by ebay_item_id to get card data
            inv_item = await db.inventory.find_one(
                {"ebay_item_id": item_id, "user_id": user_id}, {"_id": 0}
            )

            specifics = build_item_specifics(inv_item or {})
            # Add cert number if available
            cert_num = (inv_item or {}).get("cert_number")
            if cert_num:
                specifics.append(f'<NameValueList><Name>Certification Number</Name><Value>{html.escape(str(cert_num))}</Value></NameValueList>')

            item_specifics_xml = "<ItemSpecifics>" + "".join(specifics) + "</ItemSpecifics>"

            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{item_id}</ItemID>{item_specifics_xml}</Item>
</ReviseFixedPriceItemRequest>'''
            try:
                resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                    "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
                    "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
                }, content=xml_body)
                root = ET.fromstring(resp.text)
                ack = root.find("e:Ack", ns)
                if ack is not None and ack.text in ("Success", "Warning"):
                    results.append({"item_id": item_id, "success": True})
                else:
                    # Fallback to ReviseItem for auction-type listings
                    xml_body2 = xml_body.replace("ReviseFixedPriceItemRequest", "ReviseItemRequest")
                    resp2 = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                        "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                        "X-EBAY-API-CALL-NAME": "ReviseItem",
                        "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
                    }, content=xml_body2)
                    root2 = ET.fromstring(resp2.text)
                    ack2 = root2.find("e:Ack", ns)
                    if ack2 is not None and ack2.text in ("Success", "Warning"):
                        results.append({"item_id": item_id, "success": True})
                    else:
                        err_el = root.find(".//e:Errors/e:LongMessage", ns)
                        results.append({"item_id": item_id, "success": False, "error": err_el.text if err_el is not None else "Failed"})
            except Exception as e:
                results.append({"item_id": item_id, "success": False, "error": str(e)})

    ok = sum(1 for r in results if r["success"])
    return {
        "success": ok > 0, "total": len(data.item_ids), "updated": ok,
        "results": results,
        "note": f"Item Specifics updated on {ok}/{len(data.item_ids)} listings"
    }



# ---- Promoted Listings Standard (PLS) ----

EBAY_MARKETING_API = "https://api.ebay.com/sell/marketing/v1"


@router.get("/promoted/campaigns")
async def get_promoted_campaigns(request: Request):
    """Get user's Promoted Listings Standard campaigns with ad counts"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        async with httpx.AsyncClient(timeout=20.0) as http_client:
            resp = await http_client.get(
                f"{EBAY_MARKETING_API}/ad_campaign?campaign_status=RUNNING,PAUSED,ENDED&limit=50",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                campaigns = []
                for c in data.get("campaigns", []):
                    fs = c.get("fundingStrategy", {})
                    if fs.get("fundingModel") == "COST_PER_SALE":
                        campaigns.append({
                            "campaign_id": c.get("campaignId"),
                            "name": c.get("campaignName"),
                            "status": c.get("campaignStatus"),
                            "bid_percentage": fs.get("bidPercentage"),
                            "start_date": c.get("startDate"),
                            "end_date": c.get("endDate"),
                        })
                return {"success": True, "campaigns": campaigns}
            else:
                logger.warning(f"Get campaigns failed: {resp.status_code} {resp.text[:300]}")
                return {"success": False, "campaigns": [], "error": resp.text[:200]}
    except Exception as e:
        logger.error(f"Get promoted campaigns error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class CreatePromotedCampaignRequest(BaseModel):
    campaign_name: str = "FlipSlab Promoted Listings"
    bid_percentage: float = 5.0  # 1-100


@router.post("/promoted/create-campaign")
async def create_promoted_campaign(data: CreatePromotedCampaignRequest, request: Request):
    """Create a new Promoted Listings Standard (CPS) campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    if data.bid_percentage < 1 or data.bid_percentage > 100:
        raise HTTPException(status_code=400, detail="Bid percentage must be between 1 and 100")

    payload = {
        "campaignName": data.campaign_name,
        "marketplaceId": "EBAY_US",
        "startDate": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z"),
        "fundingStrategy": {
            "fundingModel": "COST_PER_SALE",
            "bidPercentage": str(data.bid_percentage),
        },
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                },
                json=payload,
            )
            if resp.status_code in (200, 201):
                # Campaign ID is in the Location header
                location = resp.headers.get("location", "")
                campaign_id = location.split("/")[-1] if location else ""
                return {"success": True, "campaign_id": campaign_id, "message": f"Campaign '{data.campaign_name}' created"}
            else:
                logger.warning(f"Create campaign failed: {resp.status_code} {resp.text[:300]}")
                error_msg = "Failed to create campaign"
                try:
                    err_data = resp.json()
                    if "errors" in err_data:
                        error_msg = err_data["errors"][0].get("message", error_msg)
                except Exception:
                    pass
                return {"success": False, "error": error_msg}
    except Exception as e:
        logger.error(f"Create promoted campaign error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BulkPromoteListingsRequest(BaseModel):
    campaign_id: str
    item_ids: List[str]  # eBay listing IDs
    bid_percentage: float = 5.0


@router.post("/promoted/bulk-add")
async def bulk_add_promoted_listings(data: BulkPromoteListingsRequest, request: Request):
    """Add multiple listings to a Promoted Listings Standard campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    # Build bulk request (max 500 per call)
    ads = [{"listingId": lid, "bidPercentage": str(data.bid_percentage)} for lid in data.item_ids[:500]]

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign/{data.campaign_id}/bulk_create_ads_by_listing_id",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                },
                json={"requests": ads},
            )
            if resp.status_code in (200, 201):
                result = resp.json()
                responses = result.get("responses", [])
                ok = sum(1 for r in responses if r.get("statusCode") in (200, 201))
                errors = [r for r in responses if r.get("statusCode") not in (200, 201)]
                return {
                    "success": ok > 0,
                    "total": len(data.item_ids),
                    "promoted": ok,
                    "errors": len(errors),
                    "note": f"Promoted {ok}/{len(data.item_ids)} listings at {data.bid_percentage}% ad rate",
                    "error_details": [e.get("errors", [{}])[0].get("message", "") for e in errors[:5]] if errors else [],
                }
            else:
                logger.warning(f"Bulk promote failed: {resp.status_code} {resp.text[:300]}")
                error_msg = "Failed to promote listings"
                try:
                    err_data = resp.json()
                    if "errors" in err_data:
                        error_msg = err_data["errors"][0].get("message", error_msg)
                except Exception:
                    pass
                return {"success": False, "error": error_msg}
    except Exception as e:
        logger.error(f"Bulk promote error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class BulkRemovePromotedRequest(BaseModel):
    campaign_id: str
    item_ids: List[str]


@router.post("/promoted/bulk-remove")
async def bulk_remove_promoted_listings(data: BulkRemovePromotedRequest, request: Request):
    """Remove multiple listings from a Promoted Listings campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    ads = [{"listingId": lid} for lid in data.item_ids[:500]]

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign/{data.campaign_id}/bulk_delete_ads_by_listing_id",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                },
                json={"requests": ads},
            )
            if resp.status_code in (200, 204):
                result = resp.json() if resp.status_code == 200 else {}
                responses = result.get("responses", [])
                ok = sum(1 for r in responses if r.get("statusCode") in (200, 204))
                return {
                    "success": True,
                    "total": len(data.item_ids),
                    "removed": ok,
                    "note": f"Removed promotion from {ok}/{len(data.item_ids)} listings",
                }
            else:
                logger.warning(f"Bulk remove promoted failed: {resp.status_code} {resp.text[:300]}")
                return {"success": False, "error": "Failed to remove promotions"}
    except Exception as e:
        logger.error(f"Bulk remove promoted error: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/promoted/campaign/{campaign_id}/ads")
async def get_campaign_ads(campaign_id: str, request: Request):
    """Get all promoted listing IDs in a campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    all_ads = []
    offset = 0
    limit = 500

    try:
        async with httpx.AsyncClient(timeout=20.0) as http_client:
            while True:
                resp = await http_client.get(
                    f"{EBAY_MARKETING_API}/ad_campaign/{campaign_id}/ad?limit={limit}&offset={offset}",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
                    },
                )
                if resp.status_code != 200:
                    break
                data = resp.json()
                ads = data.get("ads", [])
                for ad in ads:
                    all_ads.append({
                        "listing_id": ad.get("listingId"),
                        "ad_id": ad.get("adId"),
                        "bid_percentage": ad.get("bidPercentage"),
                        "status": ad.get("adStatus"),
                    })
                total = data.get("total", 0)
                if offset + limit >= total:
                    break
                offset += limit

        return {
            "success": True,
            "campaign_id": campaign_id,
            "total_ads": len(all_ads),
            "ads": all_ads,
            "promoted_listing_ids": [a["listing_id"] for a in all_ads],
        }
    except Exception as e:
        logger.error(f"Get campaign ads error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/promoted/campaign/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, request: Request):
    """Pause a RUNNING campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign/{campaign_id}/pause",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
            )
            if resp.status_code == 204:
                return {"success": True, "message": "Campaign paused"}
            return {"success": False, "error": resp.text[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/promoted/campaign/{campaign_id}/resume")
async def resume_campaign(campaign_id: str, request: Request):
    """Resume a PAUSED campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign/{campaign_id}/resume",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
            )
            if resp.status_code == 204:
                return {"success": True, "message": "Campaign resumed"}
            return {"success": False, "error": resp.text[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/promoted/campaign/{campaign_id}/end")
async def end_campaign(campaign_id: str, request: Request):
    """End a RUNNING or PAUSED campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign/{campaign_id}/end",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
            )
            if resp.status_code == 204:
                return {"success": True, "message": "Campaign ended"}
            return {"success": False, "error": resp.text[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/promoted/campaign/{campaign_id}")
async def delete_campaign(campaign_id: str, request: Request):
    """Delete an ENDED campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")
    try:
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.delete(
                f"{EBAY_MARKETING_API}/ad_campaign/{campaign_id}",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
            )
            if resp.status_code == 204:
                return {"success": True, "message": "Campaign deleted"}
            return {"success": False, "error": resp.text[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class RemoveAdRequest(BaseModel):
    listing_ids: List[str]


@router.post("/promoted/campaign/{campaign_id}/remove-ads")
async def remove_ads_from_campaign(campaign_id: str, data: RemoveAdRequest, request: Request):
    """Remove specific listings from a campaign"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")
    ads = [{"listingId": lid} for lid in data.listing_ids[:500]]
    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                f"{EBAY_MARKETING_API}/ad_campaign/{campaign_id}/bulk_delete_ads_by_listing_id",
                headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
                json={"requests": ads},
            )
            if resp.status_code in (200, 204):
                result = resp.json() if resp.status_code == 200 else {}
                responses = result.get("responses", [])
                ok = sum(1 for r in responses if r.get("statusCode") in (200, 204))
                return {"success": True, "removed": ok, "total": len(data.listing_ids), "note": f"Removed {ok}/{len(data.listing_ids)} ads"}
            return {"success": False, "error": resp.text[:200]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/sell/update-photos")
async def update_listing_photos(request: Request):
    """Update photos on an existing eBay listing from inventory images"""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()
    inventory_item_id = body.get("inventory_item_id")
    if not inventory_item_id:
        raise HTTPException(status_code=400, detail="inventory_item_id required")

    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    item = await db.inventory.find_one({"id": inventory_item_id, "user_id": user_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    ebay_item_id = item.get("ebay_item_id")
    if not ebay_item_id:
        raise HTTPException(status_code=400, detail="This item has no active eBay listing")

    async def upload_img(img_base64, label="card"):
        image_bytes = base64.b64decode(img_base64)
        try:
            img_pil = Image.open(BytesIO(image_bytes))
            w, h = img_pil.size
            if max(w, h) < 500:
                scale_f = 500 / max(w, h)
                img_pil = img_pil.resize((int(w * scale_f), int(h * scale_f)), Image.LANCZOS)
                buf = BytesIO()
                img_pil.save(buf, format='JPEG', quality=90)
                image_bytes = buf.getvalue()
        except Exception as e:
            logger.warning(f"Image resize failed for {label}: {e}")

        upload_xml = f'''<?xml version="1.0" encoding="utf-8"?><UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials><PictureName>update {label}</PictureName></UploadSiteHostedPicturesRequest>'''
        boundary = "MIME_boundary_EBAY"
        body_parts = [f"--{boundary}\r\n", "Content-Disposition: form-data; name=\"XML Payload\"\r\n", "Content-Type: text/xml\r\n\r\n", upload_xml, f"\r\n--{boundary}\r\n", f"Content-Disposition: form-data; name=\"image\"; filename=\"{label}.jpg\"\r\n", "Content-Type: image/jpeg\r\nContent-Transfer-Encoding: binary\r\n\r\n"]
        text_part = "".join(body_parts).encode('utf-8')
        end_part = f"\r\n--{boundary}--\r\n".encode('utf-8')
        full_body = text_part + image_bytes + end_part

        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "UploadSiteHostedPictures",
                "X-EBAY-API-IAF-TOKEN": token,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            }, content=full_body)

        import xml.etree.ElementTree as ET
        root = ET.fromstring(resp.text)
        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        url_el = root.find(".//e:FullURL", ns)
        if url_el is not None and url_el.text:
            return url_el.text
        return None

    picture_urls = []
    for img_key, label in [("image", "front"), ("back_image", "back")]:
        if item.get(img_key):
            try:
                url = await upload_img(item[img_key], label)
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Failed to upload {label}: {e}")

    if not picture_urls:
        raise HTTPException(status_code=400, detail="No images to upload")

    urls_xml = "\n".join(f"<PictureURL>{u}</PictureURL>" for u in picture_urls)
    revise_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{ebay_item_id}</ItemID><PictureDetails>{urls_xml}</PictureDetails></Item>
</ReviseFixedPriceItemRequest>'''

    try:
        import xml.etree.ElementTree as ET
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "ReviseFixedPriceItem",
                "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
            }, content=revise_xml)

        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        root = ET.fromstring(resp.text)
        ack = root.find("e:Ack", ns)

        if ack is not None and ack.text in ("Success", "Warning"):
            return {"success": True, "message": f"Photos updated on eBay listing {ebay_item_id}", "photos_uploaded": len(picture_urls)}

        # Try ReviseItem for auction format
        revise_xml2 = revise_xml.replace("ReviseFixedPriceItemRequest", "ReviseItemRequest")
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp2 = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "ReviseItem",
                "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
            }, content=revise_xml2)
        root2 = ET.fromstring(resp2.text)
        ack2 = root2.find("e:Ack", ns)
        if ack2 is not None and ack2.text in ("Success", "Warning"):
            return {"success": True, "message": f"Photos updated on eBay listing {ebay_item_id}", "photos_uploaded": len(picture_urls)}

        errors = []
        for err in root.findall(".//e:Errors", ns):
            msg_el = err.find("e:LongMessage", ns)
            if msg_el is not None:
                errors.append(msg_el.text)
        return {"success": False, "message": errors[0] if errors else "Failed to update photos on eBay"}
    except Exception as e:
        logger.error(f"Update eBay photos failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sell/ai-listing")
async def generate_ai_listing(data: ListingAIRequest):
    """Generate AI-optimized eBay listing"""
    card_details = f"Card: {data.card_name}"
    if data.player: card_details += f"\nPlayer: {data.player}"
    if data.year: card_details += f"\nYear: {data.year}"
    if data.set_name: card_details += f"\nSet: {data.set_name}"
    if data.card_number: card_details += f"\nCard #: {data.card_number}"
    if data.variation: card_details += f"\nVariation: {data.variation}"
    if data.grading_company and data.grade:
        card_details += f"\nGraded: {data.grading_company} {data.grade}"
    elif data.condition:
        card_details += f"\nCondition: {data.condition}"
    if data.sport: card_details += f"\nSport: {data.sport}"

    prompt = f"""You are an expert eBay listing creator for sports trading cards. Generate an optimized listing for this card:

{card_details}

Return ONLY valid JSON with these fields:
{{
  "title": "<eBay title, MAX 80 chars. Include: year, brand/set, player name, card number, variation/parallel if any, grade if graded.>",
  "description": "<Compelling 3-5 sentence description. NO HTML tags.>"
}}

IMPORTANT: Title must be EXACTLY 80 characters or less."""

    try:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are an expert eBay listing optimizer. Respond only with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500
        )
        response_text = response.choices[0].message.content
        cleaned = response_text.strip()
        if cleaned.startswith("```json"): cleaned = cleaned[7:]
        if cleaned.startswith("```"): cleaned = cleaned[3:]
        if cleaned.endswith("```"): cleaned = cleaned[:-3]
        result = json.loads(cleaned.strip())
        if len(result.get("title", "")) > 80:
            result["title"] = result["title"][:80]
        return result
    except Exception as e:
        logger.error(f"AI listing generation failed: {e}")
        return {"title": data.card_name[:80], "description": f"{data.card_name}. Ships fast with tracking."}
