from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from io import BytesIO
from PIL import Image
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
                    pic_url = pic_url.replace("s-l140", "s-l800")
                elif pic_url and "s-l225" in pic_url:
                    pic_url = pic_url.replace("s-l225", "s-l800")

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
    page: int = 1,
    limit: int = 20,
    sold_days: int = 30,
    sold_page: int = 1,
    sold_limit: int = 20
):
    """Get seller's active and sold listings via Trading API"""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    # Clamp sold_days to eBay's max of 60
    sold_days = min(max(sold_days, 1), 60)

    try:
        import xml.etree.ElementTree as ET
        xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <DetailLevel>ReturnAll</DetailLevel>
  <ActiveList>
    <Sort>TimeLeft</Sort>
    <Pagination><EntriesPerPage>{limit}</EntriesPerPage><PageNumber>{page}</PageNumber></Pagination>
  </ActiveList>
  <SoldList>
    <DurationInDays>{sold_days}</DurationInDays>
    <Sort>EndTime</Sort>
    <Pagination><EntriesPerPage>{sold_limit}</EntriesPerPage><PageNumber>{sold_page}</PageNumber></Pagination>
  </SoldList>
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

        # Helper to upgrade eBay image URLs to high-res
        def get_hires_image(item_el):
            full_pic = item_el.find(".//e:PictureDetails/e:PictureURL", ns)
            if full_pic is not None and full_pic.text:
                url = full_pic.text
            else:
                gallery = item_el.find(".//e:PictureDetails/e:GalleryURL", ns)
                url = gallery.text if gallery is not None else ""
            if url and "s-l140" in url:
                url = url.replace("s-l140", "s-l800")
            elif url and "s-l225" in url:
                url = url.replace("s-l225", "s-l800")
            return url

        # Parse active listings
        listings = []
        active_node = root.find(".//e:ActiveList", ns)
        active_total = 0
        if active_node:
            count_el = active_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
            active_total = int(count_el.text) if count_el is not None else 0
            for item_el in active_node.findall(".//e:Item", ns):
                item_data = {}
                for field in ["ItemID", "Title"]:
                    el = item_el.find(f"e:{field}", ns)
                    item_data[field.lower()] = el.text if el is not None else ""

                price_el = item_el.find(".//e:CurrentPrice", ns)
                item_data["price"] = float(price_el.text) if price_el is not None else 0
                item_data["image_url"] = get_hires_image(item_el)

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
                listings.append(item_data)

        # Parse sold listings
        sold = []
        sold_node = root.find(".//e:SoldList", ns)
        sold_total = 0
        if sold_node:
            count_el = sold_node.find("e:PaginationResult/e:TotalNumberOfEntries", ns)
            sold_total = int(count_el.text) if count_el is not None else 0
            for item_el in sold_node.findall(".//e:OrderTransaction", ns):
                # SoldList wraps items in OrderTransaction/Transaction/Item
                trans_el = item_el.find("e:Transaction", ns)
                actual_item = item_el.find(".//e:Item", ns)
                if actual_item is None:
                    continue

                item_data = {}
                item_id_el = actual_item.find("e:ItemID", ns)
                item_data["itemid"] = item_id_el.text if item_id_el is not None else ""

                title_el = actual_item.find("e:Title", ns)
                item_data["title"] = title_el.text if title_el is not None else ""

                # Sold price from Transaction/TotalPrice or Transaction/TransactionPrice
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

                item_data["image_url"] = get_hires_image(actual_item)

                # Buyer info
                buyer = ""
                if trans_el is not None:
                    buyer_el = trans_el.find("e:Buyer/e:UserID", ns)
                    if buyer_el is not None:
                        buyer = buyer_el.text
                item_data["buyer"] = buyer

                # Sold date
                if trans_el is not None:
                    date_el = trans_el.find("e:CreatedDate", ns)
                    if date_el is not None:
                        item_data["sold_date"] = date_el.text

                qty_el = None
                if trans_el is not None:
                    qty_el = trans_el.find("e:QuantityPurchased", ns)
                item_data["quantity_sold"] = int(qty_el.text) if qty_el is not None else 1

                item_data["url"] = f"https://www.ebay.com/itm/{item_data['itemid']}"
                sold.append(item_data)

        # Fetch images for sold items that are missing them via Browse API
        sold_without_images = [s for s in sold if not s.get("image_url")]
        if sold_without_images:
            try:
                app_token = await get_ebay_app_token()
                if app_token:
                    async with httpx.AsyncClient(timeout=15.0) as http_client:
                        for s_item in sold_without_images[:20]:
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
                                        if "s-l140" in img:
                                            img = img.replace("s-l140", "s-l800")
                                        elif "s-l225" in img:
                                            img = img.replace("s-l225", "s-l800")
                                        elif "s-l500" in img:
                                            img = img.replace("s-l500", "s-l800")
                                        s_item["image_url"] = img
                            except Exception:
                                pass
            except Exception as e:
                logger.warning(f"Failed to fetch sold item images via Browse API: {e}")

        return {
            "active": listings,
            "sold": sold,
            "active_total": active_total,
            "sold_total": sold_total,
            "page": page
        }
    except Exception as e:
        logger.error(f"My listings failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
    condition_id = 2750 if item.get("condition") == "Graded" else 4000

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

    # Item specifics
    specifics = []
    sport = data.sport or item.get("sport") or "Basketball"
    specifics.append(f'<NameValueList><Name>Sport</Name><Value>{html.escape(sport)}</Value></NameValueList>')
    player = data.player or item.get("player")
    if player: specifics.append(f'<NameValueList><Name>Player/Athlete</Name><Value>{html.escape(player)}</Value></NameValueList>')
    season = data.season or (str(item.get("year")) if item.get("year") else None)
    if season: specifics.append(f'<NameValueList><Name>Season</Name><Value>{html.escape(str(season))}</Value></NameValueList>')
    set_n = data.set_name or item.get("set_name")
    if set_n: specifics.append(f'<NameValueList><Name>Set</Name><Value>{html.escape(set_n)}</Value></NameValueList>')
    card_num = data.card_number or item.get("card_number")
    if card_num: specifics.append(f'<NameValueList><Name>Card Number</Name><Value>{html.escape(str(card_num))}</Value></NameValueList>')

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
        actual_condition_id = data.condition_id
        condition_descriptor_map = {1000: "400010", 2750: "400010", 3000: "400012", 4000: "400012", 5000: "400013", 6000: "400013"}
        card_condition_value = condition_descriptor_map.get(data.condition_id, "400012")
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
