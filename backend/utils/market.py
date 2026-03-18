import logging
import re
import asyncio
import math
import httpx
from datetime import datetime, timezone
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


def _parse_sold_date(date_str: str):
    """Parse eBay sold date string like 'Jan 15, 2025' to datetime"""
    if not date_str:
        return None
    for fmt in ("%b %d, %Y", "%b %d %Y", "%B %d, %Y", "%B %d %Y"):
        try:
            return datetime.strptime(date_str.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _filter_outliers_iqr(prices: list) -> list:
    """Remove extreme outlier prices using IQR method"""
    if len(prices) < 4:
        return prices
    sorted_p = sorted(prices)
    n = len(sorted_p)
    q1 = sorted_p[n // 4]
    q3 = sorted_p[3 * n // 4]
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    filtered = [p for p in prices if lower <= p <= upper]
    return filtered if len(filtered) >= 2 else prices


def _recency_weighted_avg(items: list) -> float:
    """Calculate average weighted by recency — recent sales count more"""
    now = datetime.now(timezone.utc)
    weighted_sum = 0.0
    weight_total = 0.0
    for item in items:
        price = item.get("price", 0)
        if price <= 0:
            continue
        parsed = _parse_sold_date(item.get("date_sold", ""))
        if parsed:
            days_ago = max(0, (now - parsed).days)
            weight = math.exp(-days_ago / 45)  # 45-day decay
        else:
            weight = 0.3  # low weight for items without date
        weighted_sum += price * weight
        weight_total += weight
    return round(weighted_sum / weight_total, 2) if weight_total > 0 else 0


def _calc_confidence(items: list, stats: dict) -> int:
    """Calculate confidence score 1-5 inspired by Card Ladder"""
    if not items or stats.get("count", 0) == 0:
        return 0
    score = 0.0
    count = stats["count"]

    # Factor 1: Number of comps (0-2 points)
    if count >= 8:
        score += 2.0
    elif count >= 5:
        score += 1.5
    elif count >= 3:
        score += 1.0
    elif count >= 1:
        score += 0.5

    # Factor 2: Price consistency (0-2 points) — lower spread = higher confidence
    avg = stats.get("avg", 0)
    if avg > 0 and count >= 2:
        spread = (stats["max"] - stats["min"]) / avg
        if spread < 0.3:
            score += 2.0
        elif spread < 0.6:
            score += 1.5
        elif spread < 1.0:
            score += 1.0
        else:
            score += 0.5

    # Factor 3: Recency (0-1 point)
    now = datetime.now(timezone.utc)
    most_recent = None
    for item in items:
        d = _parse_sold_date(item.get("date_sold", ""))
        if d and (most_recent is None or d > most_recent):
            most_recent = d
    if most_recent:
        days_since = (now - most_recent).days
        if days_since <= 14:
            score += 1.0
        elif days_since <= 30:
            score += 0.7
        elif days_since <= 60:
            score += 0.3

    return min(5, max(1, round(score)))


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
            # Priority 1: Scrapedo for REAL SOLD listings
            try:
                from config import SCRAPEDO_API_KEY
                if SCRAPEDO_API_KEY:
                    def _scrapedo_scrape():
                        encoded = quote_plus(search_q)
                        ebay_url = f"https://www.ebay.com/sch/i.html?_nkw={encoded}&LH_Sold=1&LH_Complete=1&_sop=13"
                        scrape_url = f"https://api.scrape.do/?token={SCRAPEDO_API_KEY}&url={quote_plus(ebay_url)}&render=true"

                        try:
                            resp = httpx.get(scrape_url, timeout=30.0)
                            if resp.status_code != 200:
                                return []
                        except Exception:
                            return []

                        html = resp.text
                        blocks = re.split(r'data-viewport', html)
                        results = []
                        seen_ids = set()
                        for block in blocks:
                            url_m = re.search(r'https://www\.ebay\.com/itm/(\d+)', block)
                            price_m = re.search(r'\$([\d,]+\.\d+)', block)
                            date_m = re.search(r'Sold\s+(\w+\s+\d+,?\s*\d*)', block)
                            title_m = re.search(r'role="heading"[^>]*>([^<]+)', block)

                            if url_m and price_m:
                                item_id = url_m.group(1)
                                if item_id in seen_ids:
                                    continue
                                seen_ids.add(item_id)
                                price = float(price_m.group(1).replace(',', ''))
                                if price <= 0 or price > 100000:
                                    continue
                                results.append({
                                    "title": title_m.group(1).strip() if title_m else search_q,
                                    "price": price,
                                    "date_sold": date_m.group(1).strip() if date_m else "",
                                    "url": f"https://www.ebay.com/itm/{item_id}",
                                    "source": "sold",
                                })
                                if len(results) >= limit:
                                    break
                        return results

                    items = await asyncio.to_thread(_scrapedo_scrape)
                    if items:
                        logger.info(f"Scrapedo found {len(items)} SOLD items for '{search_q}'")
                        return items
                    logger.info(f"Scrapedo found 0 sold items for '{search_q}'")
            except Exception as e:
                logger.warning(f"Scrapedo scrape failed for '{search_q}': {e}")

            # Priority 2: Fallback to eBay Browse API (active listings)
            items = await _browse_api_search(search_q, limit)
            if items:
                logger.info(f"Browse API returned {len(items)} active items for '{search_q}'")
            else:
                logger.warning(f"All scrapers returned 0 results for '{search_q}'")
            return items

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
                return {"count": 0, "avg": 0, "median": 0, "min": 0, "max": 0, "weighted_avg": 0, "confidence": 0, "last_sold": 0, "outliers_removed": 0}
            
            # Filter outliers
            filtered = _filter_outliers_iqr(prices)
            outliers_removed = len(prices) - len(filtered)
            prices = filtered if filtered else prices
            
            mid = len(prices) // 2
            median = prices[mid] if len(prices) % 2 != 0 else (prices[mid - 1] + prices[mid]) / 2
            avg = sum(prices) / len(prices)
            
            # Recency-weighted average
            weighted_avg = _recency_weighted_avg(items)
            
            # Last sold (most recent sale)
            last_sold = 0
            most_recent_date = None
            for item in items:
                d = _parse_sold_date(item.get("date_sold", ""))
                if d and (most_recent_date is None or d > most_recent_date):
                    most_recent_date = d
                    last_sold = item.get("price", 0)
            
            stats = {
                "count": len(prices),
                "avg": round(avg, 2),
                "median": round(median, 2),
                "min": prices[0],
                "max": prices[-1],
                "weighted_avg": round(weighted_avg, 2),
                "last_sold": round(last_sold, 2),
                "outliers_removed": outliers_removed,
            }
            stats["confidence"] = _calc_confidence(items, stats)
            
            # Market value = weighted average (Card Ladder-inspired)
            # Falls back to median if weighted avg is 0
            stats["market_value"] = stats["weighted_avg"] if stats["weighted_avg"] > 0 else stats["median"]
            
            return stats

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
