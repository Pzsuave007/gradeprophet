import logging
import re
import asyncio
import httpx
from urllib.parse import quote_plus
from utils.ebay import get_ebay_app_token

logger = logging.getLogger(__name__)


def detect_sport(card_name: str) -> str:
    """Auto-detect sport from card name"""
    name_lower = (card_name or "").lower()
    basketball_kw = ["nba", "basketball", "prizm", "hoops", "optic", "mosaic", "select", "lebron", "jordan", "kobe", "curry", "luka", "wembanyama", "panini"]
    baseball_kw = ["mlb", "baseball", "topps", "bowman", "chrome", "trout", "ohtani", "jeter", "ruth"]
    football_kw = ["nfl", "football", "mahomes", "brady", "touchdown", "score"]
    soccer_kw = ["fifa", "soccer", "futbol", "world cup", "messi", "ronaldo", "premier league", "mbappe"]
    hockey_kw = ["nhl", "hockey", "gretzky", "upper deck"]
    for kw in basketball_kw:
        if kw in name_lower:
            return "Basketball"
    for kw in baseball_kw:
        if kw in name_lower:
            return "Baseball"
    for kw in football_kw:
        if kw in name_lower:
            return "Football"
    for kw in soccer_kw:
        if kw in name_lower:
            return "Soccer"
    for kw in hockey_kw:
        if kw in name_lower:
            return "Hockey"
    return "Other"


async def get_card_market_value(query: str, ebay_item_id: str = None):
    """Get market value for a card based on REAL SOLD prices from eBay completed listings"""
    from database import db
    try:
        if ebay_item_id:
            inv_item = await db.inventory.find_one({"ebay_item_id": ebay_item_id}, {"_id": 0})
            if inv_item:
                parts = []
                if inv_item.get("year"):
                    parts.append(str(inv_item["year"]))
                if inv_item.get("set_name"):
                    parts.append(inv_item["set_name"])
                if inv_item.get("player"):
                    parts.append(inv_item["player"])
                if inv_item.get("card_number"):
                    cn = inv_item["card_number"]
                    parts.append(f"#{cn}" if not cn.startswith("#") else cn)
                if inv_item.get("sport"):
                    parts.append(inv_item["sport"])
                    parts.append("Card")
                query = " ".join(parts) if parts else query
                if inv_item.get("condition") == "Graded" and inv_item.get("grading_company") and inv_item.get("grade"):
                    query += f" {inv_item['grading_company']} {inv_item['grade']}"
                logger.info(f"Market card-value: built structured query from inventory: '{query}'")

        grade_match = re.search(
            r'\b(PSA|BGS|SGC|CGC|HGA|GMA|CSG)\s*(\d+\.?\d*)\b',
            query, flags=re.IGNORECASE
        )
        detected_company = grade_match.group(1).upper() if grade_match else None
        detected_grade = grade_match.group(2) if grade_match else None
        is_graded = grade_match is not None

        clean_q = query
        clean_q = re.sub(r'\b(PSA|BGS|SGC|CGC|HGA|GMA|CSG)\s*\d+\.?\d*\b', '', clean_q, flags=re.IGNORECASE)
        clean_q = re.sub(r'\b(GEM\s*MINT|MINT|PRISTINE|NEAR\s*MINT|NM-MT|NM|LOW\s*POP|POP\s*\d+)\b', '', clean_q, flags=re.IGNORECASE)
        clean_q = re.sub(r'\s+', ' ', clean_q).strip().strip(' ,-')

        logger.info(f"Market card-value: original='{query}' cleaned='{clean_q}' graded={is_graded} grade={detected_company} {detected_grade}")

        async def scrape_ebay_sold(search_q: str, limit: int = 12) -> list:
            items = await _browse_api_search(search_q, limit)
            if items:
                logger.info(f"Browse API returned {len(items)} items for '{search_q}'")
                return items

            try:
                def _sync_scrape():
                    encoded = quote_plus(search_q)
                    ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={encoded}&LH_Sold=1&LH_Complete=1&_sop=13"
                    jina_url = f"https://r.jina.ai/{ebay_url}"

                    try:
                        resp = httpx.get(jina_url, headers={
                            "Accept": "text/plain",
                            "X-Return-Format": "text",
                            "X-With-Links": "true",
                        }, timeout=30.0, follow_redirects=True)
                        if resp.status_code != 200:
                            return []
                    except Exception:
                        return []

                    text = resp.text
                    lines = text.split('\n')
                    all_item_urls = re.findall(r'https://www\.ebay\.com/itm/\d+', text)

                    results = []
                    url_idx = 0
                    i = 0
                    while i < len(lines):
                        line = lines[i].strip()
                        sold_m = re.match(r'Sold\s+(\w+\s+\d+,?\s*\d*)', line)
                        if sold_m:
                            date_sold = sold_m.group(1).strip()
                            title = lines[i + 1].strip() if i + 1 < len(lines) else ''
                            price = 0
                            image_url = ''
                            item_url = ''
                            for j in range(i + 1, min(i + 18, len(lines))):
                                l = lines[j].strip()
                                if not price:
                                    pm = re.match(r'\$?([\d,]+\.\d+)', l)
                                    if pm:
                                        price = float(pm.group(1).replace(',', ''))
                                if not image_url and 'ebayimg.com' in l:
                                    img_m = re.search(r'(https://i\.ebayimg\.com/[^\s\)]+)', l)
                                    image_url = img_m.group(1).split('?')[0] if img_m else ''
                                if not item_url and 'ebay.com/itm/' in l:
                                    url_m = re.search(r'(https://www\.ebay\.com/itm/\d+)', l)
                                    item_url = url_m.group(1) if url_m else ''
                            if not item_url and url_idx < len(all_item_urls):
                                item_url = all_item_urls[url_idx]
                                url_idx += 1
                            if not item_url:
                                item_url = ebay_url
                            if title and len(title) > 10 and 0 < price < 100000:
                                results.append({
                                    "title": title, "price": price,
                                    "image_url": image_url, "date_sold": date_sold,
                                    "url": item_url, "source": "sold"
                                })
                            if len(results) >= limit:
                                break
                        i += 1
                    return results

                items = await asyncio.to_thread(_sync_scrape)
                logger.info(f"Jina scraped {len(items)} sold items for '{search_q}'")
                return items
            except Exception as e:
                logger.warning(f"Jina scrape also failed for '{search_q}': {e}")
                return []

        async def _browse_api_search(q, lim=10):
            try:
                token = await get_ebay_app_token()
                async with httpx.AsyncClient(timeout=15.0) as http_client:
                    resp = await http_client.get(
                        "https://api.ebay.com/buy/browse/v1/item_summary/search",
                        headers={"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
                        params={"q": q, "limit": lim, "sort": "price"}
                    )
                if resp.status_code != 200:
                    return []
                return [{
                    "title": i.get("title", ""),
                    "price": float(i.get("price", {}).get("value", 0)),
                    "image_url": i.get("image", {}).get("imageUrl", ""),
                    "url": i.get("itemWebUrl", ""),
                    "date_sold": "",
                    "source": "active"
                } for i in resp.json().get("itemSummaries", [])]
            except Exception:
                return []

        def calc_stats(items):
            prices = sorted([i["price"] for i in items if i.get("price", 0) > 0])
            if not prices:
                return {"count": 0, "avg": 0, "median": 0, "min": 0, "max": 0}
            mid = len(prices) // 2
            median = prices[mid] if len(prices) % 2 != 0 else (prices[mid - 1] + prices[mid]) / 2
            return {
                "count": len(prices),
                "avg": round(sum(prices) / len(prices), 2),
                "median": round(median, 2),
                "min": prices[0],
                "max": prices[-1],
            }

        if is_graded:
            grade_str = f"{detected_company} {detected_grade}"
            same_grade_items, raw_items = await asyncio.gather(
                scrape_ebay_sold(f'{clean_q} {grade_str}', 12),
                scrape_ebay_sold(f'{clean_q} -PSA -BGS -SGC -CGC -graded -slab', 8),
            )
            return {
                "query": query, "clean_query": clean_q,
                "is_graded": True, "detected_grade": grade_str,
                "data_source": "sold" if any(i.get("source") == "sold" for i in same_grade_items) else "active",
                "sold_search_url": f"https://www.ebay.com/sch/i.html?_nkw={quote_plus(f'{clean_q} {grade_str}')}&LH_Sold=1&LH_Complete=1",
                "primary": {"label": grade_str, "items": same_grade_items, "stats": calc_stats(same_grade_items)},
                "secondary": {"label": "Raw / Ungraded", "items": raw_items, "stats": calc_stats(raw_items)},
            }
        else:
            raw_items, psa10_items = await asyncio.gather(
                scrape_ebay_sold(f'{clean_q} -PSA -BGS -SGC -CGC -graded -slab', 12),
                scrape_ebay_sold(f'{clean_q} PSA 10', 8),
            )
            return {
                "query": query, "clean_query": clean_q,
                "is_graded": False, "detected_grade": None,
                "data_source": "sold" if any(i.get("source") == "sold" for i in raw_items) else "active",
                "sold_search_url": f"https://www.ebay.com/sch/i.html?_nkw={quote_plus(clean_q)}&LH_Sold=1&LH_Complete=1",
                "primary": {"label": "Raw / Ungraded", "items": raw_items, "stats": calc_stats(raw_items)},
                "secondary": {"label": "PSA 10 (potential value)", "items": psa10_items, "stats": calc_stats(psa10_items)},
            }
    except Exception as e:
        logger.error(f"Card value failed: {e}")
        return {
            "query": query, "is_graded": False, "detected_grade": None,
            "data_source": "error",
            "primary": {"label": "Raw", "items": [], "stats": {"count": 0}},
            "secondary": {"label": "PSA 10", "items": [], "stats": {"count": 0}},
            "error": str(e),
        }
