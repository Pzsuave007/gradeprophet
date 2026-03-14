import base64
import logging
import time as _time
import re
import httpx
from PIL import Image
from io import BytesIO
from fastapi import HTTPException
from database import db
from config import EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_RUNAME, SCRAPEDO_API_KEY

logger = logging.getLogger(__name__)

EBAY_OAUTH_SCOPES = " ".join([
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
    "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
    "https://api.ebay.com/oauth/api_scope/sell.analytics.readonly",
])

_ebay_app_token = None
_ebay_app_token_expiry = 0


async def get_ebay_app_token() -> str:
    """Get eBay application access token (client credentials grant)"""
    global _ebay_app_token, _ebay_app_token_expiry

    if _ebay_app_token and _time.time() < _ebay_app_token_expiry - 300:
        return _ebay_app_token

    if not EBAY_CLIENT_ID or not EBAY_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="eBay API credentials not configured")

    credentials = base64.b64encode(f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}".encode()).decode()

    async with httpx.AsyncClient(timeout=15.0) as http_client:
        resp = await http_client.post(
            "https://api.ebay.com/identity/v1/oauth2/token",
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": f"Basic {credentials}"
            },
            data={
                "grant_type": "client_credentials",
                "scope": "https://api.ebay.com/oauth/api_scope"
            }
        )
        resp.raise_for_status()
        data = resp.json()

    _ebay_app_token = data["access_token"]
    _ebay_app_token_expiry = _time.time() + data.get("expires_in", 7200)
    logger.info("eBay application token acquired")
    return _ebay_app_token


async def ebay_browse_search(query: str, limit: int = 10, sort: str = "newlyListed") -> list:
    """Search eBay Browse API for items"""
    try:
        token = await get_ebay_app_token()
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.get(
                "https://api.ebay.com/buy/browse/v1/item_summary/search",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
                },
                params={
                    "q": query,
                    "limit": limit,
                    "sort": sort,
                    "filter": "buyingOptions:{FIXED_PRICE|AUCTION}"
                }
            )
            if resp.status_code != 200:
                logger.warning(f"eBay Browse API error: {resp.status_code} - {resp.text[:200]}")
                return []
            data = resp.json()
            return data.get("itemSummaries", [])
    except Exception as e:
        logger.warning(f"eBay Browse search failed: {e}")
        return []


async def ebay_browse_sold(query: str, limit: int = 10) -> list:
    """Search eBay for recently sold/completed items to get market values"""
    try:
        token = await get_ebay_app_token()
        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.get(
                "https://api.ebay.com/buy/browse/v1/item_summary/search",
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
                },
                params={
                    "q": query,
                    "limit": limit,
                    "filter": "conditionIds:{3000},buyingOptions:{FIXED_PRICE|AUCTION}"
                }
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            return data.get("itemSummaries", [])
    except Exception as e:
        logger.warning(f"eBay Browse sold search failed: {e}")
        return []


async def get_ebay_user_token() -> str:
    """Get stored eBay user access token, refresh if needed"""
    token_doc = await db.ebay_tokens.find_one({"type": "user_token"}, {"_id": 0})
    if not token_doc:
        return None

    updated_at = token_doc.get("updated_at", "")
    expires_in = token_doc.get("expires_in", 7200)
    if updated_at:
        from dateutil.parser import parse as parse_date
        try:
            token_time = parse_date(updated_at)
            elapsed = (datetime.now(timezone.utc) - token_time).total_seconds()
            if elapsed > (expires_in - 300) and token_doc.get("refresh_token"):
                refreshed = await refresh_ebay_user_token(token_doc["refresh_token"])
                if refreshed:
                    return refreshed
        except Exception:
            pass

    return token_doc.get("access_token")


async def refresh_ebay_user_token(refresh_token: str) -> str:
    """Refresh the eBay user access token"""
    try:
        credentials = base64.b64encode(f"{EBAY_CLIENT_ID}:{EBAY_CLIENT_SECRET}".encode()).decode()

        async with httpx.AsyncClient(timeout=15.0) as http_client:
            resp = await http_client.post(
                "https://api.ebay.com/identity/v1/oauth2/token",
                headers={
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Authorization": f"Basic {credentials}"
                },
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "scope": EBAY_OAUTH_SCOPES,
                }
            )

        if resp.status_code != 200:
            logger.error(f"eBay token refresh failed: {resp.status_code}")
            return None

        token_data = resp.json()

        await db.ebay_tokens.update_one(
            {"type": "user_token"},
            {"$set": {
                "access_token": token_data["access_token"],
                "expires_in": token_data.get("expires_in", 7200),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }}
        )

        logger.info("eBay user token refreshed")
        return token_data["access_token"]
    except Exception as e:
        logger.error(f"eBay token refresh error: {e}")
        return None


async def scrape_ebay_listing(url: str) -> dict:
    """Extract eBay listing images - tries eBay API first, then scraping"""
    try:
        item_id = None

        if 'ebay.us' in url or '/m/' in url:
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            }
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, max_redirects=10) as client:
                response = await client.get(url, headers=headers)
                for resp in response.history:
                    m = re.search(r'/itm/(\d+)', str(resp.url))
                    if m:
                        item_id = m.group(1)
                        break
                if not item_id:
                    m = re.search(r'/itm/(\d+)', str(response.url))
                    if m:
                        item_id = m.group(1)
                if not item_id:
                    ru_match = re.search(r'ru=([^&]+)', str(response.url))
                    if ru_match:
                        from urllib.parse import unquote
                        real_url = unquote(ru_match.group(1))
                        m = re.search(r'/itm/(\d+)', real_url)
                        if m:
                            item_id = m.group(1)
        else:
            m = re.search(r'/itm/(\d+)', url)
            if m:
                item_id = m.group(1)

        if not item_id:
            return {"success": False, "error": "Could not extract eBay listing ID", "image_urls": []}

        logger.info(f"Extracted eBay item ID: {item_id}")

        # METHOD 1: Use eBay Trading API
        try:
            token = await get_ebay_user_token()
            if token and EBAY_CLIENT_ID:
                api_url = "https://api.ebay.com/ws/api.dll"
                xml_body = f"""<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>{token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>{item_id}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  <OutputSelector>Title</OutputSelector>
  <OutputSelector>PictureDetails</OutputSelector>
</GetItemRequest>"""

                api_headers = {
                    "X-EBAY-API-SITEID": "0",
                    "X-EBAY-API-COMPATIBILITY-LEVEL": "967",
                    "X-EBAY-API-CALL-NAME": "GetItem",
                    "X-EBAY-API-APP-NAME": EBAY_CLIENT_ID,
                    "Content-Type": "text/xml",
                }

                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(api_url, content=xml_body, headers=api_headers)
                    xml_text = resp.text

                title_match = re.search(r'<Title>([^<]+)</Title>', xml_text)
                title = title_match.group(1) if title_match else "eBay Listing"

                image_urls = re.findall(r'<PictureURL>([^<]+)</PictureURL>', xml_text)

                if image_urls:
                    high_res = []
                    for img in image_urls[:6]:
                        high_res.append(re.sub(r'/s-l\d+\.', '/s-l1600.', img))
                    logger.info(f"Got {len(high_res)} images from eBay API for item {item_id}")
                    return {"success": True, "title": title, "image_urls": high_res}
                else:
                    logger.info("eBay API returned no images, trying Browse API...")
        except Exception as e:
            logger.warning(f"eBay Trading API failed: {e}, falling back to Browse API")

        # METHOD 2: Use eBay Browse API
        try:
            app_token = await get_ebay_app_token()
            if app_token:
                browse_url = f"https://api.ebay.com/buy/browse/v1/item/v1|{item_id}|0"
                browse_headers = {"Authorization": f"Bearer {app_token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"}
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.get(browse_url, headers=browse_headers)
                    if resp.status_code == 200:
                        data = resp.json()
                        title = data.get("title", "eBay Listing")
                        image_urls = []
                        if data.get("image", {}).get("imageUrl"):
                            image_urls.append(data["image"]["imageUrl"])
                        for ai in data.get("additionalImages", []):
                            if ai.get("imageUrl"):
                                image_urls.append(ai["imageUrl"])
                        if image_urls:
                            logger.info(f"Got {len(image_urls)} images from Browse API")
                            return {"success": True, "title": title, "image_urls": image_urls[:6]}
        except Exception as e:
            logger.warning(f"Browse API failed: {e}, falling back to scraping")

        # METHOD 3: Direct scraping (fallback)
        final_url = f"https://www.ebay.com/itm/{item_id}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        }

        if SCRAPEDO_API_KEY:
            async with httpx.AsyncClient(timeout=60.0) as client:
                scrape_url = f"https://api.scrape.do/?token={SCRAPEDO_API_KEY}&url={final_url}&render=true"
                response = await client.get(scrape_url)
                html = response.text
        else:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                response = await client.get(final_url, headers=headers)
                html = response.text

        title_match = re.search(r'<title>([^<]+)</title>', html)
        title = title_match.group(1).replace(" | eBay", "").replace(" - eBay", "").strip() if title_match else "eBay Listing"

        image_urls = []
        seen_urls = set()

        for pattern in [r'"mediaList"\s*:\s*\[(.*?)\]', r'"images"\s*:\s*\[(.*?)\]', r'"picturePanel"\s*:\s*\{[^}]*"images"\s*:\s*\[(.*?)\]']:
            match = re.search(pattern, html, re.DOTALL)
            if match:
                img_matches = re.findall(r'"(https://i\.ebayimg\.com/images/g/[^"]+)"', match.group(1))
                for img_url in img_matches:
                    clean_url = img_url.split('?')[0]
                    if clean_url not in seen_urls and '/s-l64' not in clean_url and '/s-l96' not in clean_url:
                        seen_urls.add(clean_url)
                        image_urls.append(clean_url)
                if image_urls:
                    break

        if len(image_urls) < 2:
            for img_url in re.findall(r'data-zoom-src="(https://i\.ebayimg\.com/images/g/[^"]+)"', html):
                clean_url = img_url.split('?')[0]
                if clean_url not in seen_urls:
                    seen_urls.add(clean_url)
                    image_urls.append(clean_url)

        if len(image_urls) < 2:
            for img_url in re.findall(r'"enlargedImageUrl"\s*:\s*"(https://i\.ebayimg\.com/images/g/[^"]+)"', html):
                clean_url = img_url.split('?')[0]
                if clean_url not in seen_urls:
                    seen_urls.add(clean_url)
                    image_urls.append(clean_url)

        final_urls = [re.sub(r'/s-l\d+\.', '/s-l1600.', u) for u in image_urls[:6]]

        if not final_urls:
            return {"success": False, "error": "No images found in the listing.", "image_urls": []}

        return {"success": True, "title": title, "image_urls": final_urls}

    except httpx.TimeoutException:
        logger.error("eBay scraping timed out")
        return {"success": False, "error": "Request timed out.", "image_urls": []}
    except Exception as e:
        logger.error(f"Failed to scrape eBay listing: {e}")
        return {"success": False, "error": str(e), "image_urls": []}


async def download_and_encode_image(url: str) -> tuple:
    """Download image and return base64 encoded data"""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, follow_redirects=True)
            if response.status_code == 200:
                image_data = response.content
                base64_data = base64.b64encode(image_data).decode('utf-8')

                img = Image.open(BytesIO(image_data))
                if img.mode in ('RGBA', 'LA', 'P'):
                    img = img.convert('RGB')
                img.thumbnail((200, 200))
                thumb_buffer = BytesIO()
                img.save(thumb_buffer, format='JPEG', quality=70)
                thumbnail = base64.b64encode(thumb_buffer.getvalue()).decode('utf-8')

                full_img = Image.open(BytesIO(image_data))
                if full_img.mode in ('RGBA', 'LA', 'P'):
                    full_buffer = BytesIO()
                    full_img.convert('RGB').save(full_buffer, format='JPEG', quality=90)
                    base64_data = base64.b64encode(full_buffer.getvalue()).decode('utf-8')

                return base64_data, thumbnail
    except Exception as e:
        logger.error(f"Failed to download image {url}: {e}")
    return None, None


def suggest_image_type(index: int, total: int) -> str:
    """Suggest image type based on position in listing"""
    if index == 0:
        return "front"
    elif index == 1 and total > 2:
        return "back"
    else:
        return "unknown"


# Import datetime for token functions
from datetime import datetime, timezone
