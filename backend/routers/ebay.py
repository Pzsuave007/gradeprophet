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
import os
from database import db
from config import EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME, openai_client
from utils.auth import get_current_user
from utils.ebay import EBAY_OAUTH_SCOPES, get_ebay_user_token, get_ebay_app_token
from utils.market import get_card_market_value
from utils.plan_limits import check_listing_limit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ebay", tags=["ebay"])


def build_best_offer_xml(price: float, user_settings: dict, force_enabled: bool = True) -> str:
    """Build BestOfferDetails + ListingDetails XML with auto-accept/decline thresholds."""
    if not force_enabled:
        return ""
    bo_xml = "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>"
    decline_pct = user_settings.get("best_offer_auto_decline_pct")
    accept_pct = user_settings.get("best_offer_auto_accept_pct")
    ld_parts = []
    if decline_pct and price > 0:
        min_price = round(price * (decline_pct / 100), 2)
        ld_parts.append(f'<MinimumBestOfferPrice currencyID="USD">{min_price:.2f}</MinimumBestOfferPrice>')
    if accept_pct and price > 0:
        auto_accept_price = round(price * (1 - accept_pct / 100), 2)
        ld_parts.append(f'<BestOfferAutoAcceptPrice currencyID="USD">{auto_accept_price:.2f}</BestOfferAutoAcceptPrice>')
    if ld_parts:
        bo_xml += "<ListingDetails>" + "".join(ld_parts) + "</ListingDetails>"
    return bo_xml


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


async def _upload_image_to_ebay(token: str, img_base64: str, label: str = "card", title: str = "card") -> str:
    """Global helper to upload an image to eBay. Returns hosted URL or None."""
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
    upload_xml = f'<?xml version="1.0" encoding="utf-8"?><UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials><PictureName>{html.escape(title[:40])} {label}</PictureName></UploadSiteHostedPicturesRequest>'
    boundary = "MIME_boundary_EBAY"
    body_parts = [f"--{boundary}\r\n", 'Content-Disposition: form-data; name="XML Payload"\r\n', "Content-Type: text/xml\r\n\r\n", upload_xml, f"\r\n--{boundary}\r\n", f'Content-Disposition: form-data; name="image"; filename="{label}.jpg"\r\n', "Content-Type: image/jpeg\r\nContent-Transfer-Encoding: binary\r\n\r\n"]
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
    url_el = root.find(".//{urn:ebay:apis:eBLBaseComponents}FullURL")
    return url_el.text if url_el is not None else None




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
    player = item.get("player", "")
    # If card_name is long enough, put player first then card info
    if base and len(base) > 15:
        # If player name exists and is in card_name, reorder so player comes first
        if player and player.lower() in base.lower():
            # Remove player from base, put it first
            import re
            cleaned = re.sub(re.escape(player), '', base, count=1, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r'\s+', ' ', cleaned).strip(' -,')
            title = f"{player} {cleaned}".strip()
        elif player:
            title = f"{player} {base}"
        else:
            title = base
        if item.get("condition") == "Graded" and item.get("grade"):
            company = item.get("grading_company", "PSA")
            grade_str = f"{company} {item['grade']}"
            if grade_str.lower() not in title.lower():
                title = f"{title} {grade_str}"
        return title[:80]
    parts = []
    if player: parts.append(player)
    if item.get("year"): parts.append(str(item["year"]))
    if item.get("set_name"): parts.append(item["set_name"])
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


async def generate_hype_content(item: dict) -> dict:
    """Use AI to generate a hype title hook and bullet points for a card listing."""
    import openai
    player = item.get("player", "")
    year = item.get("year", "")
    set_name = item.get("set_name", "")
    variation = item.get("variation", "")
    card_number = item.get("card_number", "")
    grade = f"{item.get('grading_company', '')} {item.get('grade', '')}" if item.get("grade") else "Raw"
    sport = item.get("sport", "Baseball")

    prompt = f"""You are a sports card selling expert. Generate hype content for an eBay listing.

Card: {player} {year} {set_name} {variation} #{card_number} ({grade})
Sport: {sport}

Return JSON with:
1. "title_hook": A SHORT catchy phrase (max 35 chars) to append to the title. Focus on what makes this player/card/year special. Examples: "Historic MVP Season", "HOF Legend Rookie Year", "Generational Talent", "World Series Hero", "$700M Superstar". Do NOT repeat the player name or year.

2. "why_it_matters": 3-4 bullet points (each max 80 chars) about why this specific card matters. Include real stats, achievements, milestones, or investment potential. Be factual but exciting.

3. "hype_line": One powerful opening sentence (max 120 chars) for the description.

Return ONLY valid JSON, no markdown."""

    try:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            return {}
        client = openai.AsyncOpenAI(api_key=api_key)
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300,
        )
        import json
        text = response.choices[0].message.content.strip()
        if text.startswith("```"): text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except Exception as e:
        logger.warning(f"Hype generation failed: {e}")
        return {}


def build_hype_description(item: dict, hype: dict) -> str:
    """Build an HTML description with hype content."""
    player = item.get("player", "")
    year = item.get("year", "")
    set_name = item.get("set_name", "")
    variation = item.get("variation", "")
    card_number = item.get("card_number", "")
    condition = item.get("condition", "Raw")
    grade = f"{item.get('grading_company', '')} {item.get('grade', '')}" if item.get("grade") else "Ungraded"
    hype_line = hype.get("hype_line", "")
    bullets = hype.get("why_it_matters", [])

    html_parts = []
    html_parts.append('<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222;">')
    # Hype headline
    if hype_line:
        html_parts.append(f'<p style="font-size:18px;font-weight:bold;color:#333;margin-bottom:8px;">{html.escape(hype_line)}</p>')
    # Card title
    html_parts.append(f'<h2 style="font-size:20px;margin:12px 0 8px;">{html.escape(player)} &mdash; {html.escape(str(year))} {html.escape(set_name)}</h2>')
    # Why it matters
    if bullets:
        html_parts.append('<p style="font-size:14px;font-weight:bold;color:#555;margin:12px 0 6px;">Why this card matters:</p>')
        html_parts.append('<ul style="font-size:14px;line-height:1.8;padding-left:20px;color:#333;">')
        for b in bullets:
            html_parts.append(f'<li>{html.escape(b)}</li>')
        html_parts.append('</ul>')
    # Card details
    html_parts.append('<table style="font-size:13px;border-collapse:collapse;margin:16px 0;width:100%;">')
    details = [("Player", player), ("Year", str(year)), ("Set", set_name)]
    if variation: details.append(("Variation", variation))
    if card_number: details.append(("Card #", card_number))
    details.append(("Condition", f"{condition} — {grade}" if item.get("grade") else condition))
    if item.get("cert_number"): details.append(("Cert #", item["cert_number"]))
    for label, val in details:
        html_parts.append(f'<tr><td style="padding:4px 12px 4px 0;font-weight:bold;color:#555;">{html.escape(label)}</td><td style="padding:4px 0;color:#222;">{html.escape(str(val))}</td></tr>')
    html_parts.append('</table>')
    # Shipping
    html_parts.append('<p style="font-size:13px;color:#555;margin-top:16px;border-top:1px solid #ddd;padding-top:12px;">Ships same day in penny sleeve + top loader + bubble mailer for maximum protection.</p>')
    html_parts.append('</div>')
    return "".join(html_parts)


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

    # Generate AI hype content for title and description
    hype = await generate_hype_content(item)
    if hype:
        title_hook = hype.get("title_hook", "")
        if title_hook:
            # Append hook to title if it fits within 80 chars
            hype_title = f"{title} - {title_hook}"
            if len(hype_title) <= 80:
                title = hype_title
            else:
                title = hype_title[:80]
        # Build hype HTML description
        description = build_hype_description(item, hype)
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
        bo_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
        best_offer_xml = build_best_offer_xml(data.price, bo_settings)

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
    """Auto-generate title from cards: '5 Basketball Cards - Kobe, LeBron...'"""
    count = len(cards)
    sports = set(c.get("sport", "Sports") for c in cards if c.get("sport"))
    sport = sports.pop() if len(sports) == 1 else "Sports"
    players = [c.get("player", "") for c in cards if c.get("player")]
    unique_players = list(dict.fromkeys(players))  # dedup preserving order
    player_str = ", ".join(unique_players[:4])
    if len(unique_players) > 4:
        player_str += f" + {len(unique_players) - 4} More"
    title = f"{count} {sport} Cards - {player_str}"
    return title[:80]  # eBay 80 char limit


def generate_lot_description(cards: list) -> str:
    """Generate plain text description with bullet points for each card."""
    lines = [f"{len(cards)} Card Bundle", ""]
    lines.append("This listing includes the following cards:")
    lines.append("")
    for i, c in enumerate(cards, 1):
        name = c.get("card_name", "Unknown Card")
        player = c.get("player", "")
        year = c.get("year", "")
        set_name = c.get("set_name", "")
        variation = c.get("variation", "")
        condition = c.get("condition", "")
        grade = c.get("grade", "")
        grading = c.get("grading_company", "")

        detail = f"{i}. {name}"
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
        lines.append(detail)

    lines.append("")
    lines.append("All cards shown in photos. Ships fast with tracking.")
    return "\n".join(lines)


@router.post("/sell/create-lot")
async def create_lot_listing(data: LotListingRequest, request: Request):
    """Create a lot listing on eBay from multiple inventory cards."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay account not connected")

    if len(data.card_ids) < 2 or len(data.card_ids) > 15:
        raise HTTPException(status_code=400, detail="Must select 2-15 cards")

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

    # Generate collage + combined front/back images
    from utils.image import create_lot_collage, create_front_back_combined

    front_images = [c["image"] for c in cards if c.get("image")]
    collage_b64_list = []

    # Max 4 cards per collage, 2 per row
    for chunk_start in range(0, len(front_images), 4):
        chunk = front_images[chunk_start:chunk_start + 4]
        c = create_lot_collage(chunk, cards_per_row=2)
        if c:
            collage_b64_list.append(c)

    # Create combined front+back images for each card
    combined_images = []
    cards_front_only = []
    for card in cards:
        if card.get("image") and card.get("back_image"):
            combined = create_front_back_combined(card["image"], card["back_image"])
            if combined:
                combined_images.append(combined)
            else:
                cards_front_only.append(card.get("image"))
        elif card.get("image"):
            cards_front_only.append(card["image"])

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

    # 2. Upload combined front+back images (front on top, back on bottom)
    for i, combined_b64 in enumerate(combined_images):
        if len(picture_urls) < 24:
            try:
                url = await upload_image_to_ebay(combined_b64, f"card-{i+1}-both-sides")
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Combined image {i} upload failed: {e}")

    # 3. Upload front-only for cards without back images
    for i, front_b64 in enumerate(cards_front_only):
        if len(picture_urls) < 24:
            try:
                url = await upload_image_to_ebay(front_b64, f"card-front-{i+1}")
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Front-only {i} upload failed: {e}")

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
        if data.auto_accept or data.minimum_offer:
            # Use explicit dollar values from request
            best_offer_xml = "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>"
            bo_prefs = []
            if data.auto_accept:
                bo_prefs.append(f"<BestOfferAutoAcceptPrice>{data.auto_accept}</BestOfferAutoAcceptPrice>")
            if data.minimum_offer:
                bo_prefs.append(f"<MinimumBestOfferPrice>{data.minimum_offer}</MinimumBestOfferPrice>")
            if bo_prefs:
                best_offer_xml += "<ListingDetails>" + "".join(bo_prefs) + "</ListingDetails>"
        else:
            # Fall back to percentage-based settings
            lot_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            best_offer_xml = build_best_offer_xml(data.price, lot_settings)

    # Fetch user settings for postal code and location
    user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    postal_code = user_settings.get("postal_code", "")
    location = user_settings.get("location", "")

    # Create the listing XML - IDENTICAL to single listing format
    safe_title = html.escape(title[:80])
    safe_desc = html.escape(description)

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>{safe_title}</Title><Description>{safe_desc}</Description>
    <PrimaryCategory><CategoryID>261328</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">{data.price:.2f}</StartPrice>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    <ConditionID>{actual_condition_id}</ConditionID>{condition_descriptors_xml}
    <Country>US</Country><Currency>USD</Currency>
    <PostalCode>{html.escape(postal_code)}</PostalCode>
    <Location>{html.escape(location)}</Location>
    <DispatchTimeMax>1</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration><ListingType>FixedPriceItem</ListingType>
    {picture_xml}{shipping_xml}{item_specifics_xml}{best_offer_xml}
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><RefundOption>MoneyBack</RefundOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
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

        # Log full response for debugging
        logger.info(f"Lot listing eBay Ack: {ack.text if ack is not None else 'None'}")

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
            # Only show Error-severity messages, not Warning-severity
            real_errors = []
            all_msgs = []
            for err_el in root.findall(".//e:Errors", ns):
                severity = err_el.find("e:SeverityCode", ns)
                msg_el = err_el.find("e:LongMessage", ns)
                short_el = err_el.find("e:ShortMessage", ns)
                code_el = err_el.find("e:ErrorCode", ns)
                msg_text = msg_el.text if msg_el is not None else (short_el.text if short_el is not None else "Unknown error")
                sev = severity.text if severity is not None else "Error"
                code = code_el.text if code_el is not None else ""
                all_msgs.append(f"[{sev}:{code}] {msg_text}")
                if sev == "Error":
                    real_errors.append(msg_text)
            logger.error(f"Lot listing failed. Ack={ack.text if ack is not None else 'None'}. All messages: {all_msgs}")
            logger.error(f"Lot listing debug - Title: {title}")
            logger.error(f"Lot listing debug - Description: {description[:200]}")
            error_display = real_errors[0] if real_errors else (all_msgs[0] if all_msgs else "eBay listing failed - check logs")
            return {
                "success": False,
                "error": error_display,
                "debug": {
                    "all_errors": all_msgs,
                    "title_sent": title,
                    "description_sent": description[:300],
                }
            }

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

    # Generate collage preview from thumbnails (max 4 per collage, 2 per row)
    collage_previews = []
    try:
        from utils.image import create_lot_collage
        thumb_images = [c.get("store_thumbnail") or c.get("thumbnail") for c in cards if c.get("store_thumbnail") or c.get("thumbnail")]
        for chunk_start in range(0, len(thumb_images), 4):
            chunk = thumb_images[chunk_start:chunk_start + 4]
            if len(chunk) >= 1:
                c = create_lot_collage(chunk, cards_per_row=2, card_height=300)
                if c:
                    collage_previews.append(c)
    except Exception as e:
        logger.warning(f"Collage preview generation failed: {e}")

    return {
        "title": title,
        "description": description,
        "card_count": len(cards),
        "suggested_price": round(total_value, 2),
        "collage_preview": collage_previews[0] if collage_previews else None,
        "collage_previews": collage_previews,
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



@router.post("/sell/lot-regenerate-images")
async def lot_regenerate_images(request: Request):
    """Regenerate and re-upload images for an existing lot listing on eBay."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    body = await request.json()
    ebay_item_id = body.get("ebay_item_id")
    if not ebay_item_id:
        raise HTTPException(status_code=400, detail="ebay_item_id required")

    # Find the lot record
    lot = await db.lots.find_one({"ebay_item_id": ebay_item_id, "user_id": user_id}, {"_id": 0})
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")

    # Fetch all cards from inventory
    cards = []
    for cid in lot.get("card_ids", []):
        card = await db.inventory.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if not card:
            card = await db.inventory.find_one({"_id_str": cid, "user_id": user_id}, {"_id": 0})
        if card:
            cards.append(card)

    if not cards:
        raise HTTPException(status_code=400, detail="No cards found for this lot")

    # Generate new images
    from utils.image import create_lot_collage, create_front_back_combined

    front_images = [c["image"] for c in cards if c.get("image")]
    collage_b64_list = []
    for chunk_start in range(0, len(front_images), 4):
        chunk = front_images[chunk_start:chunk_start + 4]
        c = create_lot_collage(chunk, cards_per_row=2)
        if c:
            collage_b64_list.append(c)

    combined_images = []
    cards_front_only = []
    for card in cards:
        if card.get("image") and card.get("back_image"):
            combined = create_front_back_combined(card["image"], card["back_image"])
            if combined:
                combined_images.append(combined)
            else:
                cards_front_only.append(card.get("image"))
        elif card.get("image"):
            cards_front_only.append(card["image"])

    # Upload all images to eBay
    picture_urls = []

    async def upload_img(img_b64, label):
        image_bytes = base64.b64decode(img_b64)
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
        title_short = lot.get("title", "card")[:40]
        upload_xml = f'<?xml version="1.0" encoding="utf-8"?><UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents"><RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials><PictureName>{html.escape(title_short)} {label}</PictureName></UploadSiteHostedPicturesRequest>'
        boundary = "MIME_boundary_EBAY"
        body_parts = [f"--{boundary}\r\n", 'Content-Disposition: form-data; name="XML Payload"\r\n', "Content-Type: text/xml\r\n\r\n", upload_xml, f"\r\n--{boundary}\r\n", f'Content-Disposition: form-data; name="image"; filename="{label}.jpg"\r\n', "Content-Type: image/jpeg\r\nContent-Transfer-Encoding: binary\r\n\r\n"]
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
        url_el = root.find(".//{urn:ebay:apis:eBLBaseComponents}FullURL")
        return url_el.text if url_el is not None else None

    for i, cb in enumerate(collage_b64_list):
        try:
            url = await upload_img(cb, f"overview-{i+1}")
            if url: picture_urls.append(url)
        except Exception as e:
            logger.warning(f"Regen collage {i} failed: {e}")

    for i, cb in enumerate(combined_images):
        if len(picture_urls) < 24:
            try:
                url = await upload_img(cb, f"card-{i+1}-both")
                if url: picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Regen combined {i} failed: {e}")

    for i, fb in enumerate(cards_front_only):
        if len(picture_urls) < 24:
            try:
                url = await upload_img(fb, f"front-{i+1}")
                if url: picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Regen front {i} failed: {e}")

    if not picture_urls:
        raise HTTPException(status_code=400, detail="No images could be uploaded")

    # Revise the eBay listing with new pictures
    picture_xml = "<PictureDetails>" + "".join(f"<PictureURL>{u}</PictureURL>" for u in picture_urls) + "</PictureDetails>"
    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{ebay_item_id}</ItemID>{picture_xml}</Item>
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
            await db.lots.update_one({"ebay_item_id": ebay_item_id}, {"$set": {"image_count": len(picture_urls), "images_updated_at": datetime.now(timezone.utc).isoformat()}})
            return {"success": True, "message": f"Images updated! {len(picture_urls)} photos uploaded.", "images_uploaded": len(picture_urls)}
        errors = [e.find("e:LongMessage", ns).text for e in root.findall(".//e:Errors", ns) if e.find("e:SeverityCode", ns) is not None and e.find("e:SeverityCode", ns).text == "Error" and e.find("e:LongMessage", ns) is not None]
        return {"success": False, "error": errors[0] if errors else "Failed to update images"}
    except Exception as e:
        logger.error(f"Lot image regen failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sell/lot-check/{ebay_item_id}")
async def check_if_lot(ebay_item_id: str, request: Request):
    """Check if an eBay listing is a lot, pick-your-card, or chase pack listing."""
    user = await get_current_user(request)
    lot = await db.lots.find_one({"ebay_item_id": ebay_item_id, "user_id": user["user_id"]}, {"_id": 0})
    if lot:
        return {"is_lot": True, "listing_type": "lot", "lot_id": lot.get("lot_id"), "card_count": lot.get("card_count", 0), "card_ids": lot.get("card_ids", [])}
    pick = await db.pick_your_card.find_one({"ebay_item_id": ebay_item_id, "user_id": user["user_id"]}, {"_id": 0})
    if pick:
        return {"is_lot": False, "listing_type": "pick_your_card", "pick_id": pick.get("pick_id"), "card_count": pick.get("card_count", 0), "card_ids": pick.get("card_ids", [])}
    chase = await db.chase_packs.find_one({"ebay_item_id": ebay_item_id, "user_id": user["user_id"]}, {"_id": 0})
    if chase:
        return {"is_lot": False, "listing_type": "chase_pack", "pack_id": chase.get("pack_id"), "card_count": chase.get("total_spots", 0), "spots_claimed": chase.get("spots_claimed", 0)}
    return {"is_lot": False, "listing_type": "single"}



# ============ PICK YOUR CARD (Multi-Variation Listing) ============

@router.post("/sell/pick-preview")
async def pick_your_card_preview(request: Request):
    """Generate preview for a Pick Your Card multi-variation listing."""
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

    # Auto-generate title from set info
    sets = [c.get("set_name", "") for c in cards if c.get("set_name")]
    sports = [c.get("sport", "") for c in cards if c.get("sport")]
    years = [c.get("year", "") for c in cards if c.get("year")]

    common_set = max(set(sets), key=sets.count) if sets else "Trading Cards"
    common_sport = max(set(sports), key=sports.count) if sports else "Sports"
    common_year = max(set(years), key=years.count) if years else ""

    title = f"{common_year} {common_set} {common_sport} Cards - You Pick"[:80]

    # Build card list with variation labels (must be unique!)
    card_list = []
    seen_labels = {}
    for c in cards:
        card_number = c.get("card_number", "")
        player = c.get("player", "Unknown")
        team = c.get("team", "")
        variation = c.get("variation", "")
        label = f"#{card_number} {player}" if card_number else player
        if team:
            label += f", {team}"
        # Ensure uniqueness - append variation or counter if duplicate
        base_label = label[:60]
        if base_label in seen_labels:
            seen_labels[base_label] += 1
            if variation:
                label = f"{base_label} ({variation})"[:65]
            else:
                label = f"{base_label} ({seen_labels[base_label]})"[:65]
        else:
            seen_labels[base_label] = 1
            label = base_label
        card_list.append({
            "id": c.get("id"),
            "label": label,
            "player": player,
            "card_number": card_number,
            "team": team,
            "year": c.get("year"),
            "set_name": c.get("set_name"),
            "condition": c.get("condition"),
            "card_value": c.get("card_value") or c.get("purchase_price") or 0,
            "thumbnail": c.get("store_thumbnail") or c.get("thumbnail"),
        })

    return {
        "title": title,
        "card_count": len(cards),
        "cards": card_list,
    }


@router.post("/sell/create-pick-your-card")
async def create_pick_your_card(request: Request):
    """Create a multi-variation 'Pick Your Card' listing on eBay."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    body = await request.json()
    cards_data = body.get("cards", [])  # [{id, label, price, quantity}]
    title = body.get("title", "Trading Cards - You Pick")[:80]
    condition_id = body.get("condition_id", 400010)
    shipping_service = body.get("shipping_service", "USPSFirstClass")
    shipping_cost = body.get("shipping_cost", 4.50)
    best_offer = body.get("best_offer", False)

    if len(cards_data) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 cards")

    # Fetch full card data for images
    cards_full = []
    for cd in cards_data:
        card = await db.inventory.find_one({"id": cd["id"], "user_id": user_id}, {"_id": 0})
        if card:
            card["_price"] = cd.get("price", 0.99)
            card["_quantity"] = cd.get("quantity", 1)
            card["_label"] = cd.get("label", card.get("player", "Card"))[:65]
            cards_full.append(card)

    if len(cards_full) < 2:
        raise HTTPException(status_code=400, detail="Cards not found in inventory")

    # Upload images for each variation
    logger.info(f"Pick Your Card: uploading images for {len(cards_full)} variations...")
    variation_pictures = {}
    for i, card in enumerate(cards_full):
        if card.get("image"):
            try:
                url = await _upload_image_to_ebay(token, card["image"], f"pick-{i+1}", title)
                if url:
                    variation_pictures[card["_label"]] = url
            except Exception as e:
                logger.warning(f"Pick card image upload {i} failed: {e}")

    # User settings
    user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    postal_code = user_settings.get("postal_code", "")
    location = user_settings.get("location", "")

    # Build Variations XML
    variation_spec_name = "Pick your card(s)"

    # VariationSpecificsSet - all possible values
    all_values_xml = ""
    for card in cards_full:
        all_values_xml += f"<Value>{html.escape(card['_label'])}</Value>"

    # Individual Variation entries
    variations_xml = ""
    for card in cards_full:
        variations_xml += f"""<Variation>
            <SKU>{html.escape(card.get('id', ''))}</SKU>
            <StartPrice currencyID="USD">{card['_price']:.2f}</StartPrice>
            <Quantity>{card['_quantity']}</Quantity>
            <VariationSpecifics><NameValueList>
                <Name>{html.escape(variation_spec_name)}</Name>
                <Value>{html.escape(card['_label'])}</Value>
            </NameValueList></VariationSpecifics>
        </Variation>"""

    # Variation Pictures
    pictures_xml = ""
    for label, pic_url in variation_pictures.items():
        pictures_xml += f"""<VariationSpecificPictureSet>
            <VariationSpecificValue>{html.escape(label)}</VariationSpecificValue>
            <PictureURL>{pic_url}</PictureURL>
        </VariationSpecificPictureSet>"""

    # Main listing picture (first card's image or first uploaded)
    first_pic_url = list(variation_pictures.values())[0] if variation_pictures else ""
    main_picture_xml = f"<PictureDetails><PictureURL>{first_pic_url}</PictureURL></PictureDetails>" if first_pic_url else ""

    # Shipping
    ebay_shipping_service = shipping_service
    if shipping_service == "PWEEnvelope":
        ebay_shipping_service = "USPSFirstClass"

    if shipping_service == "FreeShipping":
        shipping_xml = """<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>USPSFirstClass</ShippingService><FreeShipping>true</FreeShipping><ShippingServiceCost currencyID="USD">0.00</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>"""
    else:
        s_cost = shipping_cost if shipping_cost > 0 else 4.50
        shipping_xml = f"""<ShippingDetails><ShippingType>Flat</ShippingType><ShippingServiceOptions><ShippingServicePriority>1</ShippingServicePriority><ShippingService>{ebay_shipping_service}</ShippingService><ShippingServiceCost currencyID="USD">{s_cost:.2f}</ShippingServiceCost></ShippingServiceOptions></ShippingDetails>"""

    # Condition
    actual_condition_id = 4000
    card_condition_value = str(condition_id) if condition_id in (400010, 400011, 400012, 400013) else "400010"
    condition_descriptors_xml = f"<ConditionDescriptors><ConditionDescriptor><Name>40001</Name><Value>{card_condition_value}</Value></ConditionDescriptor></ConditionDescriptors>"

    # Best offer
    best_offer_xml = "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>" if best_offer else ""

    # Build description
    desc_lines = [f"{title}", "", f"Choose from {len(cards_full)} cards available.", "Select your card from the dropdown menu.", "", "All cards shown in photos. Ships fast with tracking."]
    safe_desc = html.escape("\n".join(desc_lines))

    # Item Specifics - use most common values from all cards
    sports = [c.get("sport", "") for c in cards_full if c.get("sport")]
    sets = [c.get("set_name", "") for c in cards_full if c.get("set_name")]
    years = [str(c.get("year", "")) for c in cards_full if c.get("year")]
    teams = [c.get("team", "") for c in cards_full if c.get("team")]

    common_sport = max(set(sports), key=sports.count) if sports else "Baseball"
    common_set = max(set(sets), key=sets.count) if sets else ""
    common_year = max(set(years), key=years.count) if years else ""
    common_team = max(set(teams), key=teams.count) if teams else ""

    specifics = []
    specifics.append('<NameValueList><Name>Type</Name><Value>Sports Trading Card</Value></NameValueList>')
    if common_sport:
        specifics.append(f'<NameValueList><Name>Sport</Name><Value>{html.escape(common_sport)}</Value></NameValueList>')
    if common_year:
        specifics.append(f'<NameValueList><Name>Season</Name><Value>{html.escape(common_year)}</Value></NameValueList>')
        specifics.append(f'<NameValueList><Name>Year Manufactured</Name><Value>{html.escape(common_year.split("-")[0])}</Value></NameValueList>')
    if common_set:
        specifics.append(f'<NameValueList><Name>Set</Name><Value>{html.escape(common_set)}</Value></NameValueList>')
        manufacturer = extract_manufacturer(common_set)
        if manufacturer:
            specifics.append(f'<NameValueList><Name>Manufacturer</Name><Value>{html.escape(manufacturer)}</Value></NameValueList>')
    league = SPORT_LEAGUE_MAP.get(common_sport, "")
    if league:
        specifics.append(f'<NameValueList><Name>League</Name><Value>{html.escape(league)}</Value></NameValueList>')
    if common_team:
        specifics.append(f'<NameValueList><Name>Team</Name><Value>{html.escape(common_team)}</Value></NameValueList>')

    item_specifics_xml = "<ItemSpecifics>" + "".join(specifics) + "</ItemSpecifics>"

    # Full XML
    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>{html.escape(title)}</Title>
    <Description>{safe_desc}</Description>
    <PrimaryCategory><CategoryID>261328</CategoryID></PrimaryCategory>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    <ConditionID>{actual_condition_id}</ConditionID>{condition_descriptors_xml}
    <Country>US</Country><Currency>USD</Currency>
    <PostalCode>{html.escape(postal_code)}</PostalCode>
    <Location>{html.escape(location)}</Location>
    <DispatchTimeMax>1</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    {main_picture_xml}
    <Variations>
      <VariationSpecificsSet>
        <NameValueList>
          <Name>{html.escape(variation_spec_name)}</Name>
          {all_values_xml}
        </NameValueList>
      </VariationSpecificsSet>
      {variations_xml}
      <Pictures>
        <VariationSpecificName>{html.escape(variation_spec_name)}</VariationSpecificName>
        {pictures_xml}
      </Pictures>
    </Variations>
    {shipping_xml}{best_offer_xml}{item_specifics_xml}
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><RefundOption>MoneyBack</RefundOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
  </Item>
</AddFixedPriceItemRequest>'''

    try:
        import xml.etree.ElementTree as ET
        async with httpx.AsyncClient(timeout=60.0) as http_client:
            resp = await http_client.post("https://api.ebay.com/ws/api.dll", headers={
                "X-EBAY-API-SITEID": "0", "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                "X-EBAY-API-CALL-NAME": "AddFixedPriceItem",
                "X-EBAY-API-IAF-TOKEN": token, "Content-Type": "text/xml",
            }, content=xml_body)

        root = ET.fromstring(resp.text)
        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
        ack = root.find("e:Ack", ns)
        logger.info(f"Pick Your Card eBay Ack: {ack.text if ack is not None else 'None'}")

        if ack is not None and ack.text in ("Success", "Warning"):
            item_id_el = root.find("e:ItemID", ns)
            item_id = item_id_el.text if item_id_el is not None else ""

            # Save to pick_your_card collection
            pick_id = f"pick_{uuid.uuid4().hex[:12]}"
            await db.pick_your_card.insert_one({
                "pick_id": pick_id,
                "user_id": user_id,
                "ebay_item_id": item_id,
                "title": title,
                "card_ids": [c.get("id") for c in cards_full],
                "card_count": len(cards_full),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "status": "active",
            })

            # Mark all cards as listed with pick_your_card tag
            for card in cards_full:
                card_id = card.get("id")
                if card_id:
                    await db.inventory.update_one(
                        {"id": card_id, "user_id": user_id},
                        {"$set": {
                            "listed": True,
                            "ebay_item_id": item_id,
                            "listing_type": "pick_your_card",
                            "pick_id": pick_id,
                            "listed_price": card["_price"],
                            "listed_at": datetime.now(timezone.utc).isoformat(),
                        }}
                    )

            return {"success": True, "message": f"Pick Your Card listing created! {len(cards_full)} variations. eBay #{item_id}", "ebay_item_id": item_id}
        else:
            real_errors = []
            all_msgs = []
            for err_el in root.findall(".//e:Errors", ns):
                severity = err_el.find("e:SeverityCode", ns)
                msg_el = err_el.find("e:LongMessage", ns)
                code_el = err_el.find("e:ErrorCode", ns)
                sev = severity.text if severity is not None else "Error"
                code = code_el.text if code_el is not None else ""
                msg_text = msg_el.text if msg_el is not None else "Unknown"
                all_msgs.append(f"[{sev}:{code}] {msg_text}")
                if sev == "Error":
                    real_errors.append(f"[{code}] {msg_text}")
            logger.error(f"Pick Your Card failed: {all_msgs}")
            return {"success": False, "error": real_errors[0] if real_errors else (all_msgs[0] if all_msgs else "eBay listing failed"), "debug": {"all_errors": all_msgs}}
    except Exception as e:
        logger.error(f"Pick Your Card exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ CHASE CARD PACK ============

@router.post("/sell/chase-preview")
async def chase_pack_preview(request: Request):
    """Generate preview for a Chase Card Pack: suggested price, collage, title."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()
    card_ids = body.get("card_ids", [])
    chase_card_id = body.get("chase_card_id")

    if len(card_ids) < 10:
        raise HTTPException(status_code=400, detail="Minimum 10 cards for a Chase Pack")

    if not chase_card_id or chase_card_id not in card_ids:
        raise HTTPException(status_code=400, detail="Must select a chase card from the pack")

    # Fetch cards
    cards = []
    for cid in card_ids:
        card = await db.inventory.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if card:
            cards.append(card)

    if len(cards) < 10:
        raise HTTPException(status_code=400, detail=f"Only {len(cards)} valid cards found, need at least 10")

    # Calculate suggested price
    total_value = 0
    chase_card = None
    other_cards = []
    for c in cards:
        val = c.get("card_value") or c.get("listed_price") or c.get("purchase_price") or 0
        try:
            val = float(val)
        except:
            val = 0
        total_value += val
        if c["id"] == chase_card_id:
            chase_card = c
        else:
            other_cards.append(c)

    num_cards = len(cards)
    # Suggested price: total value / num_cards * 1.3 markup, rounded up
    suggested_price = round((total_value / num_cards * 1.3) + 0.49, 2) if total_value > 0 else 5.00
    suggested_price = max(suggested_price, 1.99)

    # Generate collage
    from utils.image import create_chase_collage
    chase_img = chase_card.get("image") or chase_card.get("thumbnail", "")
    other_imgs = [c.get("image") or c.get("thumbnail", "") for c in other_cards if c.get("image") or c.get("thumbnail")]
    collage_b64 = ""
    if chase_img and other_imgs:
        collage_b64 = create_chase_collage(chase_img, other_imgs)

    # Build title
    chase_player = chase_card.get("player", "Card")
    chase_set = chase_card.get("set_name", "")
    chase_year = chase_card.get("year", "")
    chase_variation = chase_card.get("variation", "")
    title = f"{chase_year} {chase_set} {chase_player}"
    if chase_variation:
        title += f" {chase_variation}"
    title += f" CHASE CARD PACK"
    title = title[:80]

    # Build description
    desc_lines = [
        f"{chase_year} {chase_set} {chase_player} {chase_variation} CHASE CARD PACK",
        "",
        f"This pack contains {num_cards} cards. You will receive 1 card from this pack.",
        f"All {num_cards} cards are shown in the photos.",
        "",
        "CHASE CARD:",
        f"  {chase_player} - {chase_year} {chase_set} {chase_variation}",
        "",
        "ALL CARDS IN THIS PACK:",
    ]
    for i, c in enumerate(cards, 1):
        p = c.get("player", "Unknown")
        y = c.get("year", "")
        s = c.get("set_name", "")
        v = c.get("variation", "")
        marker = " [CHASE]" if c["id"] == chase_card_id else ""
        desc_lines.append(f"  {i}. {y} {s} {p} {v}{marker}")

    desc_lines += [
        "",
        f"Total spots: {num_cards}. One card per purchase.",
        "All cards are shown - no hidden cards, no filler.",
        "READ BEFORE PURCHASE: You will receive ONE card from this pack.",
    ]
    description = "\n".join(desc_lines)

    return {
        "title": title,
        "description": description,
        "suggested_price": suggested_price,
        "total_value": round(total_value, 2),
        "num_cards": num_cards,
        "collage": collage_b64,
        "chase_card": {
            "id": chase_card["id"],
            "player": chase_player,
            "year": chase_year,
            "set_name": chase_set,
            "variation": chase_variation,
        },
        "cards": [{"id": c["id"], "player": c.get("player", ""), "year": c.get("year", ""), "set_name": c.get("set_name", ""), "variation": c.get("variation", ""), "value": c.get("card_value") or c.get("listed_price") or c.get("purchase_price") or 0} for c in cards],
    }



@router.post("/chase/preview-collage")
async def preview_chase_collage(request: Request):
    """Generate 3 tier-based collage previews for Chase Pack listing."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    body = await request.json()
    card_ids = body.get("card_ids", [])
    chase_card_id = body.get("chase_card_id", "")
    tiers_map = body.get("tiers", {})  # {card_id: 'chase'|'mid'|'low'}

    if len(card_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 cards")

    # Fetch card data
    cards = []
    for cid in card_ids:
        c = await db.inventory.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if c:
            c["_tier"] = tiers_map.get(cid, "low")
            cards.append(c)

    if len(cards) < 2:
        raise HTTPException(status_code=400, detail="Not enough valid cards found")

    from utils.image import create_chase_tier_image

    # Separate cards by tier
    chase_cards = [c for c in cards if c["_tier"] == "chase"]
    mid_cards = [c for c in cards if c["_tier"] == "mid"]
    base_cards = [c for c in cards if c["_tier"] == "low"]

    # Generate tier images
    chase_imgs = [c.get("image") or c.get("thumbnail", "") for c in chase_cards if c.get("image") or c.get("thumbnail")]
    mid_imgs = [c.get("image") or c.get("thumbnail", "") for c in mid_cards if c.get("image") or c.get("thumbnail")]
    base_imgs = [c.get("image") or c.get("thumbnail", "") for c in base_cards if c.get("image") or c.get("thumbnail")]

    result = {"success": True, "images": []}

    if chase_imgs:
        img = create_chase_tier_image(chase_imgs, tier="chase")
        if img:
            result["images"].append({"tier": "chase", "image": img, "count": len(chase_cards)})

    if mid_imgs:
        img = create_chase_tier_image(mid_imgs, tier="mid")
        if img:
            result["images"].append({"tier": "mid", "image": img, "count": len(mid_cards)})

    if base_imgs:
        img = create_chase_tier_image(base_imgs, tier="base")
        if img:
            result["images"].append({"tier": "base", "image": img, "count": len(base_cards)})

    return result


@router.post("/sell/create-chase-pack")
async def create_chase_pack(request: Request):
    """Create and list a Chase Card Pack on eBay."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    body = await request.json()
    card_ids = body.get("card_ids", [])
    chase_card_id = body.get("chase_card_id")
    title = body.get("title", "CHASE CARD PACK")[:80]
    description = body.get("description", "")
    price = float(body.get("price", 5.00))
    condition_id = body.get("condition_id", 4000)
    shipping_option = body.get("shipping_option", "USPSFirstClass")
    shipping_cost = float(body.get("shipping_cost", 4.50))
    best_offer = body.get("best_offer", False)

    if len(card_ids) < 10:
        raise HTTPException(status_code=400, detail="Minimum 10 cards")

    # Fetch all cards
    cards = []
    for cid in card_ids:
        card = await db.inventory.find_one({"id": cid, "user_id": user_id}, {"_id": 0})
        if card:
            cards.append(card)

    if len(cards) < 10:
        raise HTTPException(status_code=400, detail="Not enough valid cards")

    # Separate cards by tier for collage generation
    from utils.image import create_chase_tier_image
    chase_card = next((c for c in cards if c["id"] == chase_card_id), cards[0])

    # Build tier lists from body tiers or default (chase_card=chase, rest=base)
    tier_map = {}
    for t_entry in body.get("tiers", []):
        tier_map[t_entry.get("card_id")] = t_entry.get("tier", "low")
    if not tier_map:
        for c in cards:
            tier_map[c["id"]] = "chase" if c["id"] == chase_card_id else "low"

    chase_cards = [c for c in cards if tier_map.get(c["id"]) == "chase"]
    mid_cards = [c for c in cards if tier_map.get(c["id"]) == "mid"]
    base_cards = [c for c in cards if tier_map.get(c["id"]) in ("low", "base", None)]

    def get_imgs(card_list):
        return [c.get("image") or c.get("thumbnail", "") for c in card_list if c.get("image") or c.get("thumbnail")]

    # Generate 3 tier collages
    collages = []
    chase_imgs = get_imgs(chase_cards)
    if chase_imgs:
        collages.append(("chase-tier", create_chase_tier_image(chase_imgs, tier="chase")))
    mid_imgs = get_imgs(mid_cards)
    if mid_imgs:
        collages.append(("mid-tier", create_chase_tier_image(mid_imgs, tier="mid")))
    base_imgs = get_imgs(base_cards)
    if base_imgs:
        collages.append(("base-tier", create_chase_tier_image(base_imgs, tier="base")))

    # Upload tier collages first, then individual card photos (eBay max 12 photos)
    picture_urls = []
    for label, b64 in collages:
        if b64:
            try:
                url = await _upload_image_to_ebay(token, b64, label, title)
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Chase collage upload failed ({label}): {e}")

    # Upload individual card images (fill remaining slots up to 12)
    remaining_slots = 12 - len(picture_urls)
    if remaining_slots > 0:
        all_card_imgs = get_imgs(cards)
        for i, img_b64 in enumerate(all_card_imgs[:remaining_slots]):
            try:
                url = await _upload_image_to_ebay(token, img_b64, f"card-{i+1}", title)
                if url:
                    picture_urls.append(url)
            except Exception as e:
                logger.warning(f"Chase card image upload failed (card-{i+1}): {e}")

    if not picture_urls:
        raise HTTPException(status_code=500, detail="Failed to upload images to eBay")

    pics_xml = "\n".join([f"<PictureURL>{url}</PictureURL>" for url in picture_urls[:12]])

    # Detect sport from chase card
    sport = chase_card.get("sport", "Basketball")
    sport_lower = sport.lower() if sport else "basketball"
    cat_map = {"basketball": "261328", "baseball": "261328", "football": "261328", "soccer": "261328", "hockey": "261328"}
    category_id = cat_map.get(sport_lower, "261328")

    # Build rich HTML description explaining how the Chase Pack works
    chase_names = ", ".join([c.get("player", "Unknown") for c in chase_cards][:3])
    mid_count = len(mid_cards)
    base_count = len(base_cards)
    total = len(cards)

    safe_desc = f"""<div style="font-family:Arial,sans-serif;max-width:800px;margin:0 auto;color:#222;">
<h2 style="text-align:center;color:#b45309;font-size:22px;">CHASE CARD PACK - {total} Spots Available!</h2>
<hr style="border:1px solid #f59e0b;margin:12px 0;">

<h3 style="color:#333;">How It Works:</h3>
<ol style="font-size:14px;line-height:1.8;">
<li><strong>Purchase a spot</strong> - Each spot costs ${price:.2f}. You are purchasing ONE random card from this pack of {total} cards.</li>
<li><strong>Receive your claim code</strong> - After purchase, you will receive a unique claim code via eBay message within minutes.</li>
<li><strong>Pick your card</strong> - Visit our reveal page and enter your code. You will see all the cards face down — pick the one you want and reveal it!</li>
<li><strong>Card ships to you</strong> - Once all spots are sold and picked, cards are shipped to their owners.</li>
</ol>

<h3 style="color:#333;">What's In This Pack:</h3>
<table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0;">
<tr style="background:#fef3c7;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;color:#b45309;">CHASE ({len(chase_cards)} card{'' if len(chase_cards)==1 else 's'})</td><td style="padding:8px;border:1px solid #ddd;">{html.escape(chase_names)}</td></tr>
<tr style="background:#dbeafe;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;color:#1d4ed8;">MID TIER ({mid_count} card{'' if mid_count==1 else 's'})</td><td style="padding:8px;border:1px solid #ddd;">Great pulls with solid value!</td></tr>
<tr style="background:#f3f4f6;"><td style="padding:8px;border:1px solid #ddd;font-weight:bold;color:#555;">BASE ({base_count} card{'' if base_count==1 else 's'})</td><td style="padding:8px;border:1px solid #ddd;">Every spot is a winner!</td></tr>
</table>

<h3 style="color:#333;">Important Details:</h3>
<ul style="font-size:14px;line-height:1.8;">
<li>Each purchase = 1 randomly assigned card from the pack.</li>
<li>Cards are NOT pre-assigned. YOU pick which card you want — completely fair and transparent.</li>
<li>All cards shown in the listing photos are included in this pack.</li>
<li>Claim codes are sent automatically via eBay message after purchase.</li>
<li>Cards ship after all spots are claimed, or within 3 business days of last sale.</li>
<li>No returns - all sales are final as cards are randomly assigned.</li>
</ul>

<p style="text-align:center;font-size:13px;color:#666;margin-top:16px;">Powered by FlipSlab Engine</p>
</div>"""
    ship_map = {
        "FreeShipping": '<ShippingServiceOptions><ShippingService>USPSMedia</ShippingService><ShippingServiceCost>0.00</ShippingServiceCost><FreeShipping>true</FreeShipping></ShippingServiceOptions>',
        "PWEEnvelope": f'<ShippingServiceOptions><ShippingService>USPSFirstClass</ShippingService><ShippingServiceCost>{shipping_cost:.2f}</ShippingServiceCost></ShippingServiceOptions>',
        "USPSFirstClass": f'<ShippingServiceOptions><ShippingService>USPSFirstClass</ShippingService><ShippingServiceCost>{shipping_cost:.2f}</ShippingServiceCost></ShippingServiceOptions>',
        "USPSPriority": f'<ShippingServiceOptions><ShippingService>USPSPriority</ShippingService><ShippingServiceCost>{shipping_cost:.2f}</ShippingServiceCost></ShippingServiceOptions>',
    }
    ship_xml = ship_map.get(shipping_option, ship_map["USPSFirstClass"])

    # Best offer
    bo_xml = ""
    if best_offer:
        bo_xml = "<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>"

    # Get user location settings (required by eBay)
    user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    postal_code = user_settings.get("postal_code", "")
    location = user_settings.get("location", "")

    # Build Item Specifics
    specifics_xml = """<ItemSpecifics>
<NameValueList><Name>Sport</Name><Value>{sport}</Value></NameValueList>
<NameValueList><Name>Type</Name><Value>Sports Trading Card</Value></NameValueList>
<NameValueList><Name>Card Size</Name><Value>Standard</Value></NameValueList>
</ItemSpecifics>""".format(sport=html.escape(sport))

    quantity = len(cards)

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <Title>{html.escape(title)}</Title>
    <Description><![CDATA[{safe_desc}]]></Description>
    <PrimaryCategory><CategoryID>{category_id}</CategoryID></PrimaryCategory>
    <StartPrice currencyID="USD">{price:.2f}</StartPrice>
    <Quantity>{quantity}</Quantity>
    <CategoryMappingAllowed>true</CategoryMappingAllowed>
    <ConditionID>4000</ConditionID>
    <ConditionDescriptors><ConditionDescriptor><Name>40001</Name><Value>400010</Value></ConditionDescriptor></ConditionDescriptors>
    <Country>US</Country>
    <Currency>USD</Currency>
    <PostalCode>{html.escape(postal_code)}</PostalCode>
    <Location>{html.escape(location)}</Location>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PictureDetails>{pics_xml}</PictureDetails>
    <ShippingDetails>
      <ShippingType>Flat</ShippingType>
      {ship_xml}
    </ShippingDetails>
    <ReturnPolicy><ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption><RefundOption>MoneyBack</RefundOption><ReturnsWithinOption>Days_30</ReturnsWithinOption><ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption></ReturnPolicy>
    {specifics_xml}
    {bo_xml}
  </Item>
</AddFixedPriceItemRequest>'''

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

            # Create chase pack record
            pack_id = f"chase_{uuid.uuid4().hex[:12]}"
            pack_cards = []
            for c in cards:
                claim_code = uuid.uuid4().hex[:8].upper()
                pack_cards.append({
                    "card_id": c["id"],
                    "player": c.get("player", ""),
                    "year": c.get("year", ""),
                    "set_name": c.get("set_name", ""),
                    "variation": c.get("variation", ""),
                    "image": c.get("image") or c.get("thumbnail") or c.get("store_thumbnail") or "",
                    "is_chase": c["id"] == chase_card_id,
                    "assigned_to": None,
                    "claim_code": claim_code,
                    "claimed_at": None,
                    "revealed": False,
                })

            await db.chase_packs.insert_one({
                "pack_id": pack_id,
                "user_id": user_id,
                "ebay_item_id": ebay_item_id,
                "title": title,
                "price": price,
                "total_spots": len(cards),
                "spots_claimed": 0,
                "cards": pack_cards,
                "chase_card_id": chase_card_id,
                "status": "active",
                "all_revealed": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

            # Mark cards in inventory
            for c in cards:
                await db.inventory.update_one(
                    {"id": c["id"], "user_id": user_id},
                    {"$set": {
                        "category": "chase_pack",
                        "chase_pack_id": pack_id,
                        "ebay_item_id": ebay_item_id,
                        "listed": True,
                    }}
                )

            return {
                "success": True,
                "ebay_item_id": ebay_item_id,
                "pack_id": pack_id,
                "message": f"Chase Card Pack listed! {len(cards)} spots at ${price:.2f} each.",
                "ebay_url": f"https://www.ebay.com/itm/{ebay_item_id}",
            }
        else:
            real_errors = []
            all_msgs = []
            for err_el in root.findall(".//e:Errors", ns):
                severity = err_el.find("e:SeverityCode", ns)
                msg_el = err_el.find("e:LongMessage", ns)
                code_el = err_el.find("e:ErrorCode", ns)
                sev = severity.text if severity is not None else "Error"
                msg_text = msg_el.text if msg_el is not None else "Unknown"
                code = code_el.text if code_el is not None else ""
                all_msgs.append(f"[{sev}:{code}] {msg_text}")
                if sev == "Error":
                    real_errors.append(f"[{code}] {msg_text}")
            logger.error(f"Chase Pack listing failed: {all_msgs}")
            return {"success": False, "error": real_errors[0] if real_errors else (all_msgs[0] if all_msgs else "eBay listing failed")}
    except Exception as e:
        logger.error(f"Chase Pack exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chase/{pack_id}")
async def get_chase_pack(pack_id: str):
    """Public endpoint: get chase pack info for the reveal page."""
    pack = await db.chase_packs.find_one({"pack_id": pack_id}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    # Fetch seller info (logo, name)
    user_id = pack.get("user_id", "")
    seller_info = {}
    if user_id:
        settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0, "shop_logo": 1, "shop_name": 1, "display_name": 1})
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0, "picture": 1, "name": 1})
        seller_info = {
            "logo": (settings or {}).get("shop_logo") or (user_doc or {}).get("picture", ""),
            "name": (settings or {}).get("shop_name") or (settings or {}).get("display_name") or (user_doc or {}).get("name", ""),
        }

    cards_list = pack.get("cards", [])
    n = len(cards_list)

    # Use stored tiers if available, otherwise calculate from value
    has_stored_tiers = any(c.get("tier") for c in cards_list)

    if not has_stored_tiers:
        # Legacy packs: calculate tiers from inventory value
        card_values = {}
        for c in cards_list:
            inv = await db.inventory.find_one({"id": c["card_id"]}, {"_id": 0, "card_value": 1, "listed_price": 1, "purchase_price": 1})
            val = 0
            if inv:
                val = float(inv.get("card_value") or inv.get("listed_price") or inv.get("purchase_price") or 0)
            card_values[c["card_id"]] = val

        sorted_cards = sorted(cards_list, key=lambda x: card_values.get(x["card_id"], 0), reverse=True)
        chase_count = max(1, round(n * 0.10))
        mid_count = max(1, round(n * 0.30))

        tier_map = {}
        for i, c in enumerate(sorted_cards):
            if c["is_chase"]:
                tier_map[c["card_id"]] = "chase"
            elif i < chase_count:
                tier_map[c["card_id"]] = "chase"
            elif i < chase_count + mid_count:
                tier_map[c["card_id"]] = "mid"
            else:
                tier_map[c["card_id"]] = "low"

        # Persist calculated tiers to DB
        for i, c in enumerate(cards_list):
            t = tier_map.get(c["card_id"], "low")
            await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {f"cards.{i}.tier": t}})
    else:
        tier_map = {}
        for c in cards_list:
            tier_map[c["card_id"]] = c.get("tier", "low")

    # Build public cards — fetch card_value from inventory or use stored value
    public_cards = []
    for c in cards_list:
        # Prefer stored card_value on the pack card, fallback to inventory
        val = float(c.get("card_value") or 0)
        if val == 0:
            inv = await db.inventory.find_one({"id": c["card_id"]}, {"_id": 0, "card_value": 1, "listed_price": 1})
            val = float(inv.get("card_value") or inv.get("listed_price") or 0) if inv else 0

        card_info = {
            "player": c["player"],
            "year": c["year"],
            "set_name": c["set_name"],
            "variation": c["variation"],
            "is_chase": c["is_chase"],
            "image": c.get("image", ""),
            "tier": tier_map.get(c["card_id"], "low"),
            "card_value": val,
        }
        if pack.get("all_revealed"):
            card_info["assigned_to"] = c.get("assigned_to", "")
        public_cards.append(card_info)

    # Sort for display: chase first, then mid, then low
    tier_order = {"chase": 0, "mid": 1, "low": 2}
    public_cards.sort(key=lambda x: tier_order.get(x["tier"], 2))

    # Build spots tracker
    spots = []
    for i, c in enumerate(cards_list):
        spot = {"number": i + 1, "claimed": bool(c.get("assigned_to")), "revealed": bool(c.get("revealed"))}
        if c.get("assigned_to"):
            spot["buyer"] = c["assigned_to"]
        spots.append(spot)

    chase_n = sum(1 for c in public_cards if c["tier"] == "chase")
    mid_n = sum(1 for c in public_cards if c["tier"] == "mid")
    low_n = n - chase_n - mid_n

    # Calculate value ranges per tier
    def tier_value_range(tier_name):
        vals = [c["card_value"] for c in public_cards if c["tier"] == tier_name and c["card_value"] > 0]
        if not vals:
            return None
        return {"min": min(vals), "max": max(vals)}

    return {
        "pack_id": pack["pack_id"],
        "title": pack["title"],
        "price": pack["price"],
        "total_spots": pack["total_spots"],
        "spots_claimed": pack.get("spots_claimed", 0),
        "status": pack["status"],
        "all_revealed": pack.get("all_revealed", False),
        "cards": public_cards,
        "spots": spots,
        "ebay_url": f"https://www.ebay.com/itm/{pack.get('ebay_item_id', '')}",
        "tiers": {"chase": chase_n, "mid": mid_n, "low": low_n},
        "seller": seller_info,
        "tier_values": {
            "chase": tier_value_range("chase"),
            "mid": tier_value_range("mid"),
            "low": tier_value_range("low"),
        },
    }


@router.post("/chase/{pack_id}/assign")
async def assign_chase_spot(pack_id: str, request: Request):
    """Seller assigns a buyer to a spot (pending — buyer picks card later)."""
    user = await get_current_user(request)
    body = await request.json()
    buyer_username = body.get("buyer_username", "").strip()

    if not buyer_username:
        raise HTTPException(status_code=400, detail="Buyer username required")

    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    # Check available spots
    picked_count = sum(1 for c in pack["cards"] if c.get("assigned_to"))
    pending_count = len(pack.get("pending_claims", []))
    total_taken = picked_count + pending_count
    if total_taken >= pack["total_spots"]:
        return {"success": False, "error": "All spots are already assigned"}

    import secrets
    claim_code = secrets.token_hex(4).upper()

    await db.chase_packs.update_one(
        {"pack_id": pack_id},
        {
            "$push": {"pending_claims": {
                "claim_code": claim_code,
                "buyer_username": buyer_username,
                "claimed_at": datetime.now(timezone.utc).isoformat(),
            }},
            "$set": {"spots_claimed": total_taken + 1},
        }
    )

    new_claimed = total_taken + 1
    if new_claimed >= pack["total_spots"]:
        await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"status": "completed"}})

    return {
        "success": True,
        "claim_code": claim_code,
        "buyer": buyer_username,
        "spots_remaining": pack["total_spots"] - new_claimed,
        "message": f"Spot assigned to {buyer_username}. Send them this claim code: {claim_code}",
    }


@router.post("/chase/{pack_id}/reveal")
async def reveal_chase_card(pack_id: str, request: Request):
    """Public endpoint: buyer enters claim code. Returns needs_pick or the revealed card."""
    body = await request.json()
    claim_code = body.get("claim_code", "").strip().upper()

    if not claim_code:
        raise HTTPException(status_code=400, detail="Claim code required")

    pack = await db.chase_packs.find_one({"pack_id": pack_id}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    # Check if code is in pending_claims (buyer hasn't picked yet)
    pending = pack.get("pending_claims", [])
    for pc in pending:
        if pc["claim_code"] == claim_code:
            # Buyer needs to pick a card
            available = [i for i, c in enumerate(pack["cards"]) if not c.get("assigned_to")]
            taken = [i for i, c in enumerate(pack["cards"]) if c.get("assigned_to")]
            return {
                "success": True,
                "needs_pick": True,
                "buyer": pc["buyer_username"],
                "total_cards": len(pack["cards"]),
                "available_indices": available,
                "taken_indices": taken,
            }

    # Check if code is on a card that was already picked (already assigned)
    for i, c in enumerate(pack["cards"]):
        if c.get("claim_code") == claim_code and c.get("assigned_to"):
            # Already picked — reveal directly
            if not c.get("revealed"):
                await db.chase_packs.update_one(
                    {"pack_id": pack_id},
                    {"$set": {f"cards.{i}.revealed": True}}
                )
            return {
                "success": True,
                "needs_pick": False,
                "card": {
                    "player": c["player"],
                    "year": c["year"],
                    "set_name": c["set_name"],
                    "variation": c["variation"],
                    "image": c.get("image", ""),
                    "is_chase": c["is_chase"],
                    "tier": c.get("tier", "chase" if c["is_chase"] else "low"),
                },
                "buyer": c["assigned_to"],
                "is_chase": c["is_chase"],
                "message": f"{'CHASE CARD!' if c['is_chase'] else 'Card revealed!'} You got: {c['year']} {c['set_name']} {c['player']} {c['variation']}",
            }

    raise HTTPException(status_code=404, detail="Invalid claim code")


@router.post("/chase/{pack_id}/pick-card")
async def pick_chase_card(pack_id: str, request: Request):
    """Public endpoint: buyer picks a card by index. Assigns it to them and reveals it."""
    body = await request.json()
    claim_code = body.get("claim_code", "").strip().upper()
    card_index = body.get("card_index")

    if not claim_code or card_index is None:
        raise HTTPException(status_code=400, detail="claim_code and card_index required")

    card_index = int(card_index)

    pack = await db.chase_packs.find_one({"pack_id": pack_id}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    # Find the pending claim
    pending = pack.get("pending_claims", [])
    claim = None
    for pc in pending:
        if pc["claim_code"] == claim_code:
            claim = pc
            break

    if not claim:
        raise HTTPException(status_code=404, detail="Invalid or already used claim code")

    # Validate card index
    cards = pack.get("cards", [])
    if card_index < 0 or card_index >= len(cards):
        raise HTTPException(status_code=400, detail="Invalid card index")

    if cards[card_index].get("assigned_to"):
        raise HTTPException(status_code=400, detail="This card has already been taken")

    buyer = claim["buyer_username"]

    # Assign buyer to the chosen card
    await db.chase_packs.update_one(
        {"pack_id": pack_id},
        {
            "$set": {
                f"cards.{card_index}.assigned_to": buyer,
                f"cards.{card_index}.claimed_at": datetime.now(timezone.utc).isoformat(),
                f"cards.{card_index}.claim_code": claim_code,
                f"cards.{card_index}.revealed": True,
            },
            "$pull": {"pending_claims": {"claim_code": claim_code}},
        }
    )

    # Check if all cards are now assigned
    updated_pack = await db.chase_packs.find_one({"pack_id": pack_id}, {"_id": 0})
    all_assigned = all(c.get("assigned_to") for c in updated_pack["cards"])
    no_pending = len(updated_pack.get("pending_claims", [])) == 0
    if all_assigned and no_pending:
        await db.chase_packs.update_one(
            {"pack_id": pack_id},
            {"$set": {"all_revealed": True, "status": "completed"}}
        )

    c = cards[card_index]
    return {
        "success": True,
        "card": {
            "player": c["player"],
            "year": c["year"],
            "set_name": c["set_name"],
            "variation": c["variation"],
            "image": c.get("image", ""),
            "is_chase": c["is_chase"],
            "tier": c.get("tier", "chase" if c["is_chase"] else "low"),
        },
        "buyer": buyer,
        "is_chase": c["is_chase"],
        "message": f"{'CHASE CARD!' if c['is_chase'] else 'Card revealed!'} You got: {c['year']} {c['set_name']} {c['player']} {c['variation']}",
    }



@router.post("/chase/{pack_id}/update-card-value")
async def update_chase_card_value(pack_id: str, request: Request):
    """Update the card_value of a card in a chase pack (also updates inventory)."""
    user = await get_current_user(request)
    body = await request.json()
    card_id = body.get("card_id")
    card_value = body.get("card_value")

    if not card_id or card_value is None:
        raise HTTPException(status_code=400, detail="card_id and card_value required")

    card_value = float(card_value)

    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    # Update in chase_packs.cards array
    for i, c in enumerate(pack.get("cards", [])):
        if c["card_id"] == card_id:
            await db.chase_packs.update_one(
                {"pack_id": pack_id},
                {"$set": {f"cards.{i}.card_value": card_value, f"cards.{i}.value": card_value}}
            )
            break

    # Also update in inventory
    await db.inventory.update_one(
        {"id": card_id, "user_id": user["user_id"]},
        {"$set": {"card_value": card_value}}
    )

    return {"success": True, "message": f"Card value updated to ${card_value:.2f}"}



@router.get("/chase-packs")
async def get_my_chase_packs(request: Request):
    """Get all chase packs for the current user (seller dashboard)."""
    user = await get_current_user(request)
    packs = await db.chase_packs.find(
        {"user_id": user["user_id"]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)

    # Enrich cards with card_value from inventory if not already stored
    for pack in packs:
        for c in pack.get("cards", []):
            if not c.get("card_value") and not c.get("value"):
                inv = await db.inventory.find_one({"id": c["card_id"]}, {"_id": 0, "card_value": 1, "listed_price": 1})
                if inv:
                    c["card_value"] = float(inv.get("card_value") or inv.get("listed_price") or 0)

    return {"packs": packs}


# ============ CHASE PACK MANAGEMENT ============

@router.patch("/chase/{pack_id}")
async def edit_chase_pack(pack_id: str, request: Request):
    """Edit chase pack details (title, price)."""
    user = await get_current_user(request)
    body = await request.json()
    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    updates = {}
    if "title" in body and body["title"].strip():
        updates["title"] = body["title"].strip()[:80]
    if "price" in body and body["price"] is not None:
        updates["price"] = round(float(body["price"]), 2)

    if not updates:
        return {"success": False, "error": "No changes provided"}

    await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": updates})
    return {"success": True, "message": "Pack updated", "updates": updates}


@router.post("/chase/{pack_id}/change-chase")
async def change_chase_card(pack_id: str, request: Request):
    """Change which card is designated as the chase card."""
    user = await get_current_user(request)
    body = await request.json()
    new_chase_card_id = body.get("card_id")
    if not new_chase_card_id:
        raise HTTPException(status_code=400, detail="card_id required")

    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    found = False
    for i, c in enumerate(pack["cards"]):
        if c["card_id"] == new_chase_card_id:
            await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {f"cards.{i}.is_chase": True}})
            found = True
        elif c["is_chase"]:
            await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {f"cards.{i}.is_chase": False}})

    if not found:
        raise HTTPException(status_code=400, detail="Card not found in this pack")

    await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"chase_card_id": new_chase_card_id}})
    return {"success": True, "message": "Chase card updated"}


@router.post("/chase/{pack_id}/pause")
async def pause_chase_pack(pack_id: str, request: Request):
    """Pause a chase pack."""
    user = await get_current_user(request)
    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")
    if pack["status"] != "active":
        return {"success": False, "error": "Pack is not active"}
    await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"status": "paused"}})
    return {"success": True, "message": "Pack paused"}


@router.post("/chase/{pack_id}/resume")
async def resume_chase_pack(pack_id: str, request: Request):
    """Resume a paused chase pack."""
    user = await get_current_user(request)
    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")
    if pack["status"] != "paused":
        return {"success": False, "error": "Pack is not paused"}
    await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"status": "active"}})
    return {"success": True, "message": "Pack resumed"}


@router.post("/chase/{pack_id}/end")
async def end_chase_pack(pack_id: str, request: Request):
    """End a chase pack and return unassigned cards to inventory."""
    user = await get_current_user(request)
    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")
    if pack["status"] == "ended":
        return {"success": False, "error": "Pack already ended"}

    # End the eBay listing if it exists
    ebay_item_id = pack.get("ebay_item_id", "")
    ebay_ended = False
    if ebay_item_id:
        try:
            token = await get_ebay_user_token(user["user_id"])
            if token:
                xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ItemID>{ebay_item_id}</ItemID><EndingReason>NotAvailable</EndingReason>
</EndItemRequest>'''
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
                    ebay_ended = True
                    logger.info(f"eBay listing {ebay_item_id} ended for chase pack {pack_id}")
                else:
                    errors = [e.find("e:LongMessage", ns).text for e in root.findall(".//e:Errors", ns) if e.find("e:LongMessage", ns) is not None]
                    logger.warning(f"Failed to end eBay listing {ebay_item_id}: {errors}")
        except Exception as e:
            logger.warning(f"Error ending eBay listing for chase pack: {e}")

    # Return unassigned cards to inventory
    returned = 0
    for c in pack["cards"]:
        if not c["assigned_to"]:
            await db.inventory.update_one(
                {"id": c["card_id"], "user_id": user["user_id"]},
                {"$set": {"category": "for_sale", "listed": False}, "$unset": {"chase_pack_id": "", "ebay_item_id": ""}}
            )
            returned += 1

    await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"status": "ended"}})
    ebay_msg = " eBay listing ended." if ebay_ended else (" eBay listing could not be ended — please end it manually on eBay." if ebay_item_id else "")
    return {"success": True, "message": f"Pack ended. {returned} cards returned to inventory.{ebay_msg}"}


@router.delete("/chase/{pack_id}")
async def delete_chase_pack(pack_id: str, request: Request):
    """Delete a chase pack entirely and return all unassigned cards to inventory."""
    user = await get_current_user(request)
    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    # End the eBay listing if it exists
    ebay_item_id = pack.get("ebay_item_id", "")
    if ebay_item_id:
        try:
            token = await get_ebay_user_token(user["user_id"])
            if token:
                xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ItemID>{ebay_item_id}</ItemID><EndingReason>NotAvailable</EndingReason>
</EndItemRequest>'''
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
                    logger.info(f"eBay listing {ebay_item_id} ended for deleted chase pack {pack_id}")
        except Exception as e:
            logger.warning(f"Error ending eBay listing for deleted chase pack: {e}")

    # Return unassigned cards to inventory
    returned = 0
    for c in pack["cards"]:
        if not c["assigned_to"]:
            await db.inventory.update_one(
                {"id": c["card_id"], "user_id": user["user_id"]},
                {"$set": {"category": "for_sale", "listed": False}, "$unset": {"chase_pack_id": "", "ebay_item_id": ""}}
            )
            returned += 1

    await db.chase_packs.delete_one({"pack_id": pack_id})
    return {"success": True, "message": f"Pack deleted. {returned} cards returned to inventory."}


@router.post("/chase/{pack_id}/unassign")
async def unassign_chase_spot(pack_id: str, request: Request):
    """Unassign a buyer from a specific card in the pack."""
    user = await get_current_user(request)
    body = await request.json()
    card_id = body.get("card_id")
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id required")

    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    for i, c in enumerate(pack["cards"]):
        if c["card_id"] == card_id:
            if not c["assigned_to"]:
                return {"success": False, "error": "Card is not assigned"}
            new_code = uuid.uuid4().hex[:8].upper()
            await db.chase_packs.update_one(
                {"pack_id": pack_id},
                {"$set": {
                    f"cards.{i}.assigned_to": None,
                    f"cards.{i}.claimed_at": None,
                    f"cards.{i}.revealed": False,
                    f"cards.{i}.claim_code": new_code,
                    "spots_claimed": max(0, pack["spots_claimed"] - 1),
                }}
            )
            # If pack was completed, revert to active
            if pack["status"] == "completed":
                await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"status": "active", "all_revealed": False}})
            return {"success": True, "message": f"Buyer unassigned. New code: {new_code}", "new_code": new_code}

    raise HTTPException(status_code=400, detail="Card not found in pack")


@router.post("/chase/{pack_id}/regenerate-code")
async def regenerate_chase_code(pack_id: str, request: Request):
    """Regenerate claim code for a specific card."""
    user = await get_current_user(request)
    body = await request.json()
    card_id = body.get("card_id")
    if not card_id:
        raise HTTPException(status_code=400, detail="card_id required")

    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    for i, c in enumerate(pack["cards"]):
        if c["card_id"] == card_id:
            new_code = uuid.uuid4().hex[:8].upper()
            await db.chase_packs.update_one(
                {"pack_id": pack_id},
                {"$set": {f"cards.{i}.claim_code": new_code, f"cards.{i}.revealed": False}}
            )
            return {"success": True, "new_code": new_code, "message": f"New code: {new_code}"}

    raise HTTPException(status_code=400, detail="Card not found in pack")


@router.post("/chase/{pack_id}/update-tiers")
async def update_chase_tiers(pack_id: str, request: Request):
    """Update tier assignments for cards in a chase pack."""
    user = await get_current_user(request)
    body = await request.json()
    tiers = body.get("tiers", {})  # {card_id: "chase"|"mid"|"low"}

    if not tiers:
        return {"success": False, "error": "No tier changes provided"}

    valid_tiers = {"chase", "mid", "low"}
    for card_id, tier in tiers.items():
        if tier not in valid_tiers:
            raise HTTPException(status_code=400, detail=f"Invalid tier '{tier}'. Must be chase, mid, or low")

    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    updated = 0
    for i, c in enumerate(pack["cards"]):
        if c["card_id"] in tiers:
            new_tier = tiers[c["card_id"]]
            await db.chase_packs.update_one(
                {"pack_id": pack_id},
                {"$set": {f"cards.{i}.tier": new_tier}}
            )
            updated += 1

    return {"success": True, "message": f"{updated} card tiers updated"}



@router.post("/chase/{pack_id}/sync-ebay")
async def sync_chase_to_ebay(pack_id: str, request: Request):
    """Push title/price/quantity changes to eBay listing."""
    user = await get_current_user(request)
    pack = await db.chase_packs.find_one({"pack_id": pack_id, "user_id": user["user_id"]}, {"_id": 0})
    if not pack:
        raise HTTPException(status_code=404, detail="Chase Pack not found")

    ebay_item_id = pack.get("ebay_item_id")
    if not ebay_item_id or ebay_item_id == "DEMO_123456":
        return {"success": False, "error": "No eBay listing linked to this pack"}

    token = await get_ebay_user_token(user["user_id"])
    if not token:
        return {"success": False, "error": "eBay not connected"}

    title = html.escape(pack["title"][:80])
    price = pack["price"]
    quantity = pack["total_spots"]

    xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>{ebay_item_id}</ItemID>
    <Title>{title}</Title>
    <StartPrice currencyID="USD">{price:.2f}</StartPrice>
    <Quantity>{quantity}</Quantity>
  </Item>
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
            return {"success": True, "message": "eBay listing updated successfully"}

        errors = []
        for err_el in root.findall(".//e:Errors", ns):
            msg_el = err_el.find("e:LongMessage", ns)
            if msg_el is not None:
                errors.append(msg_el.text)
        return {"success": False, "error": errors[0] if errors else "eBay revision failed"}
    except Exception as e:
        logger.error(f"Chase sync-ebay error: {e}")
        return {"success": False, "error": str(e)}


# ============ BULK SAVINGS (Volume Discount) ============

@router.post("/sell/volume-discount")
async def create_volume_discount(request: Request):
    """Create a Volume Discount (Bulk Savings) promotion for an eBay listing."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    body = await request.json()
    listing_ids = body.get("listing_ids", [])
    ebay_item_id = body.get("ebay_item_id")
    name = body.get("name", "Bulk Savings")
    tiers = body.get("tiers", [])  # [{min_qty: 2, percent_off: 10}, {min_qty: 3, percent_off: 20}]
    end_days = body.get("end_days", 30)

    if not tiers or len(tiers) < 1:
        raise HTTPException(status_code=400, detail="At least 1 discount tier required")

    # Build listing IDs list
    ids = listing_ids if listing_ids else ([ebay_item_id] if ebay_item_id else [])

    # Build single discount rule for ORDER_DISCOUNT (eBay only allows 1 rule)
    first_tier = tiers[0]
    pct = max(5, min(80, first_tier["percent_off"]))
    discount_rules = [{
        "discountBenefit": {"percentageOffOrder": str(pct)},
        "discountSpecification": {"minQuantity": first_tier["min_qty"]},
        "ruleOrder": 1,
    }]

    from datetime import timedelta
    start_date = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    end_date = (datetime.now(timezone.utc) + timedelta(days=end_days)).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    promo_body = {
        "name": name[:90],
        "description": f"Buy more save {pct}% on orders!",
        "startDate": start_date,
        "endDate": end_date,
        "marketplaceId": "EBAY_US",
        "promotionStatus": "SCHEDULED",
        "promotionType": "ORDER_DISCOUNT",
        "discountRules": discount_rules,
    }

    # eBay requires promotionImageUrl for ORDER_DISCOUNT — fetch from user's active listings
    promo_image_url = ""
    try:
        cache = await db.listings_cache.find_one({"user_id": user_id}, {"_id": 0, "active": {"$slice": 1}})
        if cache and cache.get("active"):
            promo_image_url = cache["active"][0].get("image_url", "")
    except Exception:
        pass

    if not promo_image_url:
        # Fallback: quick eBay call to get one listing image
        try:
            ebay_creds = await db.ebay_tokens.find_one({"user_id": user_id}, {"_id": 0})
            if ebay_creds:
                import xml.etree.ElementTree as ET
                xml_body = f"""<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ActiveList><Sort>TimeLeft</Sort><Pagination><EntriesPerPage>1</EntriesPerPage><PageNumber>1</PageNumber></Pagination></ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>"""
                async with httpx.AsyncClient(timeout=15.0) as hc:
                    r = await hc.post(
                        "https://api.ebay.com/ws/api.dll",
                        content=xml_body,
                        headers={
                            "X-EBAY-API-SITEID": "0",
                            "X-EBAY-API-COMPATIBILITY-LEVEL": "1155",
                            "X-EBAY-API-CALL-NAME": "GetMyeBaySelling",
                            "Content-Type": "text/xml",
                        },
                    )
                if r.status_code == 200:
                    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
                    tree = ET.fromstring(r.text)
                    pic = tree.find(".//e:PictureDetails/e:PictureURL", ns)
                    if pic is not None and pic.text:
                        promo_image_url = pic.text
                    else:
                        gal = tree.find(".//e:PictureDetails/e:GalleryURL", ns)
                        if gal is not None and gal.text:
                            promo_image_url = gal.text
        except Exception as img_err:
            logger.warning(f"Could not fetch listing image for promotion: {img_err}")

    if promo_image_url:
        if "s-l140" in promo_image_url:
            promo_image_url = promo_image_url.replace("s-l140", "s-l500")
        elif "s-l225" in promo_image_url:
            promo_image_url = promo_image_url.replace("s-l225", "s-l500")
        promo_body["promotionImageUrl"] = promo_image_url

    # Apply to all store items or specific listings
    apply_all = body.get("apply_all", True)
    if apply_all or not ids:
        promo_body["inventoryCriterion"] = {
            "inventoryCriterionType": "INVENTORY_ANY",
        }
    else:
        promo_body["inventoryCriterion"] = {
            "inventoryCriterionType": "INVENTORY_BY_VALUE",
            "listingIds": [str(lid) for lid in ids],
        }

    try:
        import asyncio
        max_retries = 2
        last_error = ""
        for attempt in range(max_retries + 1):
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                resp = await http_client.post(
                    "https://api.ebay.com/sell/marketing/v1/item_promotion",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                    json=promo_body,
                )

            logger.info(f"Volume discount response (attempt {attempt+1}): {resp.status_code}")

            if resp.status_code in (200, 201):
                promo_id = ""
                location = resp.headers.get("location", "")
                if location:
                    promo_id = location.split("/")[-1]
                result = resp.json() if resp.text else {}
                return {
                    "success": True,
                    "message": f"Bulk Savings created! {len(tiers)} discount tier(s).",
                    "promotion_id": promo_id or result.get("promotionId", ""),
                }
            else:
                error_data = resp.json() if resp.text else {}
                errors = error_data.get("errors", [])
                last_error = errors[0].get("message", "Unknown error") if errors else f"HTTP {resp.status_code}"
                error_id = errors[0].get("errorId", 0) if errors else 0
                logger.warning(f"Order discount attempt {attempt+1} failed: {last_error}")
                if attempt < max_retries:
                    await asyncio.sleep(5)

        return {"success": False, "error": last_error}
    except Exception as e:
        logger.error(f"Volume discount exception: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============ STORE PROMOTIONS MANAGEMENT ============

@router.get("/sell/store-promotions")
async def get_store_promotions(request: Request):
    """Get all active/scheduled/paused store promotions from eBay."""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        promotions = []
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.get(
                "https://api.ebay.com/sell/marketing/v1/promotion",
                params={
                    "marketplace_id": "EBAY_US",
                    "limit": "200",
                    "promotion_type": "ORDER_DISCOUNT",
                },
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )

        if resp.status_code == 200:
            data = resp.json()
            for p in data.get("promotions", []):
                promo_id = p.get("promotionId", "")
                promotions.append({
                    "promotion_id": promo_id,
                    "name": p.get("name", ""),
                    "description": p.get("description", ""),
                    "status": p.get("promotionStatus", ""),
                    "type": p.get("promotionType", ""),
                    "start_date": p.get("startDate", ""),
                    "end_date": p.get("endDate", ""),
                    "priority": p.get("priority", ""),
                    "promotion_href": p.get("promotionHref", ""),
                })
            return {"success": True, "promotions": promotions, "total": data.get("total", len(promotions))}
        else:
            error_data = resp.json() if resp.text else {}
            errors = error_data.get("errors", [])
            msg = errors[0].get("message", f"HTTP {resp.status_code}") if errors else f"HTTP {resp.status_code}"
            return {"success": False, "error": msg, "promotions": []}
    except Exception as e:
        logger.error(f"Get store promotions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sell/store-promotions/{promotion_id}/pause")
async def pause_store_promotion(promotion_id: str, request: Request):
    """Pause a running store promotion."""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                f"https://api.ebay.com/sell/marketing/v1/promotion/{promotion_id}/pause",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )

        if resp.status_code == 204:
            return {"success": True, "message": "Promotion paused"}
        else:
            error_data = resp.json() if resp.text else {}
            errors = error_data.get("errors", [])
            msg = errors[0].get("message", f"HTTP {resp.status_code}") if errors else f"HTTP {resp.status_code}"
            return {"success": False, "error": msg}
    except Exception as e:
        logger.error(f"Pause promotion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sell/store-promotions/{promotion_id}/resume")
async def resume_store_promotion(promotion_id: str, request: Request):
    """Resume a paused store promotion."""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.post(
                f"https://api.ebay.com/sell/marketing/v1/promotion/{promotion_id}/resume",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )

        if resp.status_code == 204:
            return {"success": True, "message": "Promotion resumed"}
        else:
            error_data = resp.json() if resp.text else {}
            errors = error_data.get("errors", [])
            msg = errors[0].get("message", f"HTTP {resp.status_code}") if errors else f"HTTP {resp.status_code}"
            return {"success": False, "error": msg}
    except Exception as e:
        logger.error(f"Resume promotion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/sell/store-promotions/{promotion_id}")
async def delete_store_promotion(promotion_id: str, request: Request):
    """Delete a paused/ended store promotion. Must be paused first if running."""
    user = await get_current_user(request)
    token = await get_ebay_user_token(user["user_id"])
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    try:
        async with httpx.AsyncClient(timeout=30.0) as http_client:
            resp = await http_client.delete(
                f"https://api.ebay.com/sell/marketing/v1/item_promotion/{promotion_id}",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Accept": "application/json",
                },
            )

        if resp.status_code == 204:
            return {"success": True, "message": "Promotion deleted"}
        else:
            error_data = resp.json() if resp.text else {}
            errors = error_data.get("errors", [])
            msg = errors[0].get("message", f"HTTP {resp.status_code}") if errors else f"HTTP {resp.status_code}"
            return {"success": False, "error": msg}
    except Exception as e:
        logger.error(f"Delete promotion error: {e}")
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
            # Return single-card listings back to inventory
            await db.inventory.update_many(
                {"ebay_item_id": ebay_item_id},
                {"$set": {"listed": False, "ebay_item_id": None, "listed_price": None, "listed_at": None, "category": "for_sale"}}
            )

            # Handle lot/pick-your-card listings: return all cards to inventory
            lot = await db.lots.find_one({"ebay_item_id": ebay_item_id})
            if lot:
                card_ids = lot.get("card_ids", [])
                if card_ids:
                    await db.inventory.update_many(
                        {"id": {"$in": card_ids}},
                        {"$set": {"listed": False, "ebay_item_id": None, "listed_price": None, "listed_at": None, "category": "for_sale", "lot_id": None}}
                    )
                    logger.info(f"Returned {len(card_ids)} lot cards to inventory for {ebay_item_id}")
                await db.lots.update_one({"ebay_item_id": ebay_item_id}, {"$set": {"status": "ended"}})

            await db.created_listings.update_one({"ebay_item_id": ebay_item_id}, {"$set": {"status": "ended"}})
            cards_returned = lot.get("card_count", 1) if lot else 1
            return {"success": True, "message": f"Listing ended. {cards_returned} card(s) returned to inventory."}
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


@router.post("/sell/bulk-update-best-offer-rules")
async def bulk_update_best_offer_rules(request: Request):
    """Apply auto-accept/auto-decline Best Offer rules to all active eBay listings using user settings percentages."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    decline_pct = user_settings.get("best_offer_auto_decline_pct")
    accept_pct = user_settings.get("best_offer_auto_accept_pct")
    if not decline_pct and not accept_pct:
        raise HTTPException(status_code=400, detail="No Best Offer rules configured. Set percentages in Account settings first.")

    # Get prices from inventory items with eBay listings
    inv_items = await db.inventory.find(
        {"user_id": user_id, "ebay_item_id": {"$exists": True, "$ne": ""}, "category": "for_sale"},
        {"_id": 0, "ebay_item_id": 1, "price": 1, "ebay_price": 1}
    ).to_list(5000)

    # Build price map from inventory
    items = []
    seen_ids = set()
    for it in inv_items:
        eid = it.get("ebay_item_id")
        if eid:
            items.append({"item_id": eid, "price": it.get("ebay_price") or it.get("price") or 0})
            seen_ids.add(eid)

    # Also include active listings from cache that aren't in inventory
    cache_doc = await db.listings_cache.find_one({"user_id": user_id}, {"_id": 0, "active": 1})
    if cache_doc and cache_doc.get("active"):
        for cached_item in cache_doc["active"]:
            cid = cached_item.get("itemid") or cached_item.get("item_id", "")
            if cid and cid not in seen_ids:
                items.append({"item_id": cid, "price": cached_item.get("price", 0)})
                seen_ids.add(cid)

    if not items:
        raise HTTPException(status_code=404, detail="No active eBay listings found.")

    results = []
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for item in items:
            item_id = item.get("item_id")
            price = item.get("price") or 0
            if not item_id or price <= 0:
                results.append({"item_id": item_id or "unknown", "success": False, "error": "No price found"})
                continue

            bo_xml = build_best_offer_xml(price, user_settings)
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{item_id}</ItemID>{bo_xml}</Item>
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
                    results.append({"item_id": item_id, "success": True, "price": price})
                else:
                    err_el = root.find(".//e:Errors/e:LongMessage", ns)
                    results.append({"item_id": item_id, "success": False, "error": err_el.text if err_el is not None else "Failed"})
            except Exception as e:
                results.append({"item_id": item_id, "success": False, "error": str(e)})

    ok = sum(1 for r in results if r["success"])
    return {
        "success": ok > 0,
        "total": len(items),
        "updated": ok,
        "failed": len(items) - ok,
        "decline_pct": decline_pct,
        "accept_pct": accept_pct,
        "results": results,
        "note": f"Best Offer rules applied to {ok}/{len(items)} listings"
    }


class BulkApplyOfferRulesRequest(BaseModel):
    item_ids: List[str]
    prices: Optional[dict] = None
    decline_pct: Optional[float] = None
    accept_pct: Optional[float] = None


@router.post("/sell/bulk-apply-offer-rules")
async def bulk_apply_offer_rules(data: BulkApplyOfferRulesRequest, request: Request):
    """Apply auto-accept/auto-decline Best Offer rules to specific selected eBay listings."""
    user = await get_current_user(request)
    user_id = user["user_id"]
    token = await get_ebay_user_token(user_id)
    if not token:
        raise HTTPException(status_code=401, detail="eBay not connected")

    # Use request percentages if provided, otherwise fall back to saved settings
    user_settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    decline_pct = data.decline_pct if data.decline_pct is not None else user_settings.get("best_offer_auto_decline_pct")
    accept_pct = data.accept_pct if data.accept_pct is not None else user_settings.get("best_offer_auto_accept_pct")
    if not decline_pct and not accept_pct:
        raise HTTPException(status_code=400, detail="No Best Offer rules provided. Set percentages before applying.")

    # Build a temporary settings dict with the percentages to use
    rule_settings = {"best_offer_auto_decline_pct": decline_pct, "best_offer_auto_accept_pct": accept_pct}

    # Use prices from frontend if provided
    price_map = {}
    if data.prices:
        for iid, p in data.prices.items():
            if p and float(p) > 0:
                price_map[iid] = float(p)

    # Look up missing prices from inventory
    missing_ids = [iid for iid in data.item_ids if iid not in price_map]
    if missing_ids:
        inv_items = await db.inventory.find(
            {"user_id": user_id, "ebay_item_id": {"$in": missing_ids}},
            {"_id": 0, "ebay_item_id": 1, "price": 1, "ebay_price": 1}
        ).to_list(5000)
        for it in inv_items:
            eid = it.get("ebay_item_id")
            if eid and eid not in price_map:
                price_map[eid] = it.get("ebay_price") or it.get("price") or 0

    # Also check listings_cache for still-missing prices
    still_missing = [iid for iid in data.item_ids if iid not in price_map]
    if still_missing:
        cache_doc = await db.listings_cache.find_one({"user_id": user_id}, {"_id": 0, "active": 1})
        if cache_doc and cache_doc.get("active"):
            for cached_item in cache_doc["active"]:
                cid = cached_item.get("itemid") or cached_item.get("item_id", "")
                if cid in still_missing and cid not in price_map:
                    price_map[cid] = cached_item.get("price", 0)

    results = []
    import xml.etree.ElementTree as ET
    ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

    async with httpx.AsyncClient(timeout=30.0) as http_client:
        for item_id in data.item_ids:
            price = price_map.get(item_id, 0)
            if price <= 0:
                results.append({"item_id": item_id, "success": False, "error": "Price not found"})
                continue

            bo_xml = build_best_offer_xml(price, rule_settings)
            xml_body = f'''<?xml version="1.0" encoding="utf-8"?>
<ReviseFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <Item><ItemID>{item_id}</ItemID>{bo_xml}</Item>
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
                    results.append({"item_id": item_id, "success": True, "price": price})
                else:
                    err_el = root.find(".//e:Errors/e:LongMessage", ns)
                    results.append({"item_id": item_id, "success": False, "error": err_el.text if err_el is not None else "Failed"})
            except Exception as e:
                results.append({"item_id": item_id, "success": False, "error": str(e)})

    ok = sum(1 for r in results if r["success"])
    return {
        "success": ok > 0,
        "total": len(data.item_ids),
        "updated": ok,
        "failed": len(data.item_ids) - ok,
        "decline_pct": decline_pct,
        "accept_pct": accept_pct,
        "results": results,
        "note": f"Best Offer rules applied to {ok}/{len(data.item_ids)} listings"
    }


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
  "title": "<eBay title, MAX 80 chars. PLAYER NAME FIRST, then year, brand/set, card number, variation/parallel if any, grade if graded. Example: 'Kobe Bryant 1996 Topps Chrome #138 Refractor PSA 10'>",
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



# ===== CHASE PACK SALES MONITOR =====
from datetime import timedelta

PRODUCTION_URL = "https://flipslabengine.com"


async def _send_ebay_message(token: str, item_id: str, buyer_username: str, subject: str, body: str) -> bool:
    """Send a message to an eBay buyer using Trading API."""
    import xml.etree.ElementTree as ET
    xml_body = f"""<?xml version="1.0" encoding="utf-8"?>
<AddMemberMessageAAQToPartnerRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ItemID>{item_id}</ItemID>
  <MemberMessage>
    <Subject>{html.escape(subject[:200])}</Subject>
    <Body>{html.escape(body)}</Body>
    <QuestionType>CustomizedSubject</QuestionType>
    <RecipientID>{html.escape(buyer_username)}</RecipientID>
  </MemberMessage>
</AddMemberMessageAAQToPartnerRequest>"""

    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            r = await hc.post(
                "https://api.ebay.com/ws/api.dll",
                content=xml_body,
                headers={
                    "X-EBAY-API-SITEID": "0",
                    "X-EBAY-API-COMPATIBILITY-LEVEL": "1155",
                    "X-EBAY-API-CALL-NAME": "AddMemberMessageAAQToPartner",
                    "Content-Type": "text/xml",
                },
            )
        if r.status_code == 200:
            tree = ET.fromstring(r.text)
            ns = {"e": "urn:ebay:apis:eBLBaseComponents"}
            ack = tree.find("e:Ack", ns)
            if ack is not None and ack.text in ("Success", "Warning"):
                logger.info(f"eBay message sent to {buyer_username} for item {item_id}")
                return True
            errors = tree.findall(".//e:Errors/e:LongMessage", ns)
            err_msg = errors[0].text if errors else "Unknown"
            logger.warning(f"eBay message to {buyer_username} failed: {err_msg}")
        return False
    except Exception as e:
        logger.error(f"Failed to send eBay message: {e}")
        return False


async def _get_chase_pack_transactions(pack: dict, token: str) -> list:
    """Check eBay for transactions on a Chase Pack listing."""
    import xml.etree.ElementTree as ET

    ebay_item_id = pack.get("ebay_item_id")
    if not ebay_item_id:
        return []

    last_check = pack.get("last_sale_check")
    if not last_check:
        last_check = pack.get("created_at", (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat())

    xml_body = f"""<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>{token}</eBayAuthToken></RequesterCredentials>
  <ItemID>{ebay_item_id}</ItemID>
  <ModTimeFrom>{last_check}</ModTimeFrom>
  <ModTimeTo>{datetime.now(timezone.utc).isoformat()}</ModTimeTo>
  <Pagination><EntriesPerPage>50</EntriesPerPage></Pagination>
</GetItemTransactionsRequest>"""

    try:
        async with httpx.AsyncClient(timeout=15.0) as hc:
            r = await hc.post(
                "https://api.ebay.com/ws/api.dll",
                content=xml_body,
                headers={
                    "X-EBAY-API-SITEID": "0",
                    "X-EBAY-API-COMPATIBILITY-LEVEL": "1155",
                    "X-EBAY-API-CALL-NAME": "GetItemTransactions",
                    "Content-Type": "text/xml",
                },
            )
        if r.status_code != 200:
            return []

        tree = ET.fromstring(r.text)
        ns = {"e": "urn:ebay:apis:eBLBaseComponents"}

        txns = []
        for txn in tree.findall(".//e:Transaction", ns):
            txn_id_el = txn.find("e:TransactionID", ns)
            buyer_el = txn.find("e:Buyer/e:UserID", ns)
            qty_el = txn.find("e:QuantityPurchased", ns)

            txn_id = txn_id_el.text if txn_id_el is not None else ""
            buyer = buyer_el.text if buyer_el is not None else ""
            qty = int(qty_el.text) if qty_el is not None else 1

            if txn_id and buyer:
                txns.append({"transaction_id": txn_id, "buyer": buyer, "quantity": qty})
        return txns
    except Exception as e:
        logger.error(f"GetItemTransactions failed for {ebay_item_id}: {e}")
        return []


async def _assign_single_spot(pack_id: str, buyer_username: str) -> str | None:
    """Assign one spot to a buyer as pending claim (buyer picks card later). Returns claim_code or None."""
    import secrets

    pack = await db.chase_packs.find_one({"pack_id": pack_id}, {"_id": 0})
    if not pack or pack["status"] not in ("active", "paused"):
        return None

    # Check if there are available spots
    picked_count = sum(1 for c in pack["cards"] if c.get("assigned_to"))
    pending_count = len(pack.get("pending_claims", []))
    total_taken = picked_count + pending_count
    if total_taken >= pack["total_spots"]:
        return None

    # Generate claim code
    claim_code = secrets.token_hex(4).upper()

    # Add to pending_claims
    await db.chase_packs.update_one(
        {"pack_id": pack_id},
        {
            "$push": {"pending_claims": {
                "claim_code": claim_code,
                "buyer_username": buyer_username,
                "claimed_at": datetime.now(timezone.utc).isoformat(),
            }},
            "$set": {"spots_claimed": total_taken + 1},
        }
    )

    # Check if all spots taken
    if total_taken + 1 >= pack["total_spots"]:
        await db.chase_packs.update_one({"pack_id": pack_id}, {"$set": {"status": "completed"}})

    return claim_code


async def check_all_chase_pack_sales():
    """Check all active Chase Packs for new eBay sales. Auto-assign + notify buyers."""
    active_packs = await db.chase_packs.find(
        {"status": "active", "ebay_item_id": {"$exists": True, "$ne": ""}},
        {"_id": 0}
    ).to_list(100)

    if not active_packs:
        return {"checked": 0, "new_sales": 0}

    total_new = 0
    user_ids = list(set(p["user_id"] for p in active_packs))

    for user_id in user_ids:
        token = await get_ebay_user_token(user_id)
        if not token:
            continue

        user_packs = [p for p in active_packs if p["user_id"] == user_id]
        for pack in user_packs:
            processed = set(pack.get("processed_transactions", []))
            txns = await _get_chase_pack_transactions(pack, token)

            for txn in txns:
                if txn["transaction_id"] in processed:
                    continue

                # Assign spots (1 per quantity purchased)
                codes = []
                for _ in range(txn["quantity"]):
                    code = await _assign_single_spot(pack["pack_id"], txn["buyer"])
                    if code:
                        codes.append(code)

                if codes:
                    total_new += len(codes)
                    # Send ONE eBay message with all codes
                    reveal_url = f"{PRODUCTION_URL}/chase/{pack['pack_id']}"
                    reveal_url = f"https://flipslabengine.com/chase/{pack['pack_id']}"
                    if len(codes) == 1:
                        msg_body = (
                            f"Thanks for purchasing a spot in {pack['title']}!\n\n"
                            f"Your claim code is: {codes[0]}\n\n"
                            f"To pick your card, copy and paste this link in your browser:\n"
                            f"{reveal_url}\n\n"
                            f"Enter your code, pick a card from the pack, and reveal what you got. Good luck - can you pull the CHASE?"
                        )
                    else:
                        codes_str = "\n".join(f"  Spot {i+1}: {c}" for i, c in enumerate(codes))
                        msg_body = (
                            f"Thanks for purchasing {len(codes)} spots in {pack['title']}!\n\n"
                            f"Your claim codes:\n{codes_str}\n\n"
                            f"To pick your cards, copy and paste this link in your browser:\n"
                            f"{reveal_url}\n\n"
                            f"Enter each code, pick a card from the pack, and reveal what you got. Good luck - can you pull the CHASE?"
                        )

                    sent = await _send_ebay_message(
                        token=token,
                        item_id=pack.get("ebay_item_id", ""),
                        buyer_username=txn["buyer"],
                        subject=f"Your {pack['title']} Code!",
                        body=msg_body,
                    )
                    logger.info(f"Chase auto-assign: {txn['buyer']} -> {pack['pack_id']}, codes={codes}, msg_sent={sent}")

                processed.add(txn["transaction_id"])

            # Update last check time
            await db.chase_packs.update_one(
                {"pack_id": pack["pack_id"]},
                {"$set": {
                    "last_sale_check": datetime.now(timezone.utc).isoformat(),
                    "processed_transactions": list(processed),
                }}
            )

    return {"checked": len(active_packs), "new_sales": total_new}


# --- Manual trigger endpoint ---
@router.post("/chase/check-sales")
async def check_chase_sales(request: Request):
    """Manually trigger a check for new Chase Pack sales on eBay."""
    await get_current_user(request)
    result = await check_all_chase_pack_sales()
    return {"success": True, **result}


# --- Background loop (started from server.py) ---
async def chase_sales_monitor_loop():
    """Background loop — checks for Chase Pack sales every 60 seconds."""
    logger.info("Chase Sales Monitor started")
    await asyncio.sleep(10)  # Initial delay
    while True:
        try:
            result = await check_all_chase_pack_sales()
            if result["new_sales"] > 0:
                logger.info(f"Chase monitor: {result['new_sales']} new sales processed")
        except Exception as e:
            logger.error(f"Chase sales monitor error: {e}")
        await asyncio.sleep(60)
