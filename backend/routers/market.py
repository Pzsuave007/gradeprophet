from fastapi import APIRouter, HTTPException, Request, Body
from typing import Optional
from urllib.parse import quote_plus, unquote
import logging
import httpx
from database import db
from utils.auth import get_current_user
from utils.ebay import get_ebay_app_token
from utils.market import get_card_market_value, detect_sport

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/market", tags=["market"])


@router.get("/search")
async def market_search(query: str, limit: int = 20):
    """Search eBay market data for a card"""
    try:
        token = await get_ebay_app_token()
        async with httpx.AsyncClient(timeout=20.0) as http_client:
            resp = await http_client.get(
                "https://api.ebay.com/buy/browse/v1/item_summary/search",
                headers={"Authorization": f"Bearer {token}", "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"},
                params={"q": query, "limit": limit, "sort": "price"}
            )
        if resp.status_code != 200:
            return {"items": [], "stats": {}, "total": 0}

        raw_items = resp.json().get("itemSummaries", [])
        items = []
        prices = []
        for item in raw_items:
            price_val = float(item.get("price", {}).get("value", 0))
            img = item.get("image", {}).get("imageUrl", "")
            parsed = {
                "title": item.get("title", ""),
                "price": price_val,
                "currency": item.get("price", {}).get("currency", "USD"),
                "condition": item.get("condition", ""),
                "image_url": img.replace("s-l225", "s-l500") if img else "",
                "item_url": item.get("itemWebUrl", ""),
                "buying_options": item.get("buyingOptions", []),
                "seller": item.get("seller", {}).get("username", ""),
                "item_id": item.get("itemId", ""),
            }
            items.append(parsed)
            if price_val > 0:
                prices.append(price_val)

        prices.sort()
        stats = {}
        if prices:
            mid = len(prices) // 2
            median = prices[mid] if len(prices) % 2 != 0 else (prices[mid - 1] + prices[mid]) / 2
            stats = {
                "count": len(prices), "avg_price": round(sum(prices) / len(prices), 2),
                "median_price": round(median, 2), "min_price": prices[0],
                "max_price": prices[-1], "market_value": round(median, 2),
            }

        return {"items": items, "stats": stats, "total": len(items)}
    except Exception as e:
        logger.error(f"Market search failed: {e}")
        return {"items": [], "stats": {}, "total": 0, "error": str(e)}


@router.get("/watchlist")
async def get_market_watchlist(request: Request):
    """Get user's market watchlist items"""
    user = await get_current_user(request)
    watchlist = await db.market_watchlist.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(50)
    return {"items": watchlist}


@router.post("/watchlist")
async def add_to_market_watchlist(request: Request, data: dict = Body(...)):
    """Add a player or card to the market watchlist"""
    from datetime import datetime, timezone
    user = await get_current_user(request)
    user_id = user["user_id"]
    name = data.get("name", "").strip()
    wtype = data.get("type", "player")
    if not name:
        raise HTTPException(400, "Name is required")
    existing = await db.market_watchlist.find_one({"name": name, "type": wtype, "user_id": user_id})
    if existing:
        return {"status": "already_exists"}
    doc = {"name": name, "type": wtype, "user_id": user_id, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.market_watchlist.insert_one(doc)
    return {"status": "added"}


@router.delete("/watchlist/{name}")
async def remove_from_market_watchlist(name: str, request: Request):
    """Remove from market watchlist"""
    user = await get_current_user(request)
    decoded = unquote(name)
    await db.market_watchlist.delete_many({"name": decoded, "user_id": user["user_id"]})
    return {"status": "removed"}


@router.get("/portfolio-health")
async def get_portfolio_health(request: Request):
    """Get portfolio health"""
    user = await get_current_user(request)
    inventory = await db.inventory.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(200)

    portfolio = []
    total_invested = 0
    for item in inventory:
        cost = float(item.get("purchase_price", 0) or 0)
        total_invested += cost
        sport = detect_sport(item.get("card_name", ""))
        portfolio.append({
            "card_name": item.get("card_name", ""), "player": item.get("player", "Unknown"),
            "sport": sport, "grade": item.get("grade", ""),
            "grading_company": item.get("grading_company", ""),
            "condition": item.get("condition", "Raw"),
            "purchase_price": cost, "category": item.get("category", "collection"),
            "image": bool(item.get("image")),
        })

    return {"items": portfolio, "total_invested": round(total_invested, 2), "total_items": len(portfolio)}


@router.get("/hot-cards")
async def get_hot_cards(request: Request):
    """Get trending/hot cards"""
    user = await get_current_user(request)
    inventory = await db.inventory.find({"user_id": user["user_id"]}, {"_id": 0, "card_name": 1, "player": 1}).to_list(100)
    sports = set()
    for item in inventory:
        sport = detect_sport(item.get("card_name", ""))
        if sport != "Other":
            sports.add(sport)
    if not sports:
        sports = {"Basketball", "Baseball"}

    hot_queries = {
        "Basketball": [
            {"name": "Victor Wembanyama", "query": "Victor Wembanyama Prizm PSA 10", "tag": "ROY Candidate"},
            {"name": "LeBron James", "query": "LeBron James Prizm Silver", "tag": "GOAT Debate"},
            {"name": "Luka Doncic", "query": "Luka Doncic Prizm Silver PSA 10", "tag": "Star Rising"},
            {"name": "Anthony Edwards", "query": "Anthony Edwards Prizm Silver", "tag": "Hot Market"},
        ],
        "Baseball": [
            {"name": "Shohei Ohtani", "query": "Shohei Ohtani Topps Chrome PSA 10", "tag": "MVP Race"},
            {"name": "Elly De La Cruz", "query": "Elly De La Cruz Topps Chrome", "tag": "Rookie Star"},
            {"name": "Mike Trout", "query": "Mike Trout Topps Chrome PSA 10", "tag": "Evergreen"},
            {"name": "Gunnar Henderson", "query": "Gunnar Henderson Topps Chrome", "tag": "Breakout"},
        ],
        "Football": [
            {"name": "Patrick Mahomes", "query": "Patrick Mahomes Prizm Silver PSA 10", "tag": "Dynasty"},
            {"name": "CJ Stroud", "query": "CJ Stroud Prizm Silver", "tag": "Rookie Star"},
            {"name": "Caleb Williams", "query": "Caleb Williams Prizm", "tag": "Highly Anticipated"},
        ],
        "Soccer": [
            {"name": "Lionel Messi", "query": "Lionel Messi Prizm PSA 10", "tag": "Legend"},
            {"name": "Kylian Mbappe", "query": "Kylian Mbappe Topps Chrome", "tag": "Transfer Buzz"},
            {"name": "Jude Bellingham", "query": "Jude Bellingham Topps Chrome", "tag": "Rising Star"},
        ],
        "Hockey": [
            {"name": "Connor McDavid", "query": "Connor McDavid Young Guns PSA 10", "tag": "Generational"},
            {"name": "Connor Bedard", "query": "Connor Bedard Upper Deck", "tag": "Rookie Hype"},
        ],
    }

    trending = []
    for sport in sports:
        if sport in hot_queries:
            for q in hot_queries[sport]:
                trending.append({**q, "sport": sport})

    return {"trending": trending[:8], "user_sports": list(sports)}


@router.get("/card-value")
async def market_card_value(query: str, ebay_item_id: Optional[str] = None):
    """Get market value for a card"""
    return await get_card_market_value(query, ebay_item_id)


@router.get("/flip-calc")
async def flip_calculator(query: str, grading_cost: float = 30.0):
    """Calculate flip opportunity"""
    try:
        value_data = await get_card_market_value(query)
        raw_stats = value_data.get("raw", {}).get("stats", {})
        psa10_stats = value_data.get("psa10", {}).get("stats", {})
        raw_price = raw_stats.get("median", 0)
        psa10_value = psa10_stats.get("median", 0)

        if raw_price > 0 and psa10_value > 0:
            potential_profit = psa10_value - raw_price - grading_cost
            roi = ((potential_profit) / (raw_price + grading_cost)) * 100 if (raw_price + grading_cost) > 0 else 0
        else:
            potential_profit = 0
            roi = 0

        return {
            "query": query, "clean_query": value_data.get("clean_query", query),
            "raw_price": raw_price, "psa10_value": psa10_value,
            "grading_cost": grading_cost, "potential_profit": round(potential_profit, 2),
            "roi_percent": round(roi, 1),
            "raw_listings": raw_stats.get("count", 0), "psa10_listings": psa10_stats.get("count", 0),
            "raw_items": value_data.get("raw", {}).get("items", [])[:5],
            "psa10_items": value_data.get("psa10", {}).get("items", [])[:5],
        }
    except Exception as e:
        logger.error(f"Flip calc failed: {e}")
        return {"query": query, "error": str(e)}
