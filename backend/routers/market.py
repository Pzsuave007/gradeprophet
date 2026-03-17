from fastapi import APIRouter, HTTPException, Request, Body
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote_plus, unquote
import logging
import httpx
from database import db
from utils.auth import get_current_user
from utils.ebay import get_ebay_app_token, ebay_browse_search
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
    """Get trending/hot cards based on buying season"""
    await get_current_user(request)

    current_month = datetime.now(timezone.utc).month - 1  # 0-indexed

    # Determine buy-season sports first, then warming, then sell
    buy_sports = [s for s, c in SPORT_CYCLES.items() if c[current_month] == 1]
    warming_sports = [s for s, c in SPORT_CYCLES.items() if c[current_month] == 2]
    sell_sports = [s for s, c in SPORT_CYCLES.items() if c[current_month] == 3]

    # Prioritize: buy season first (best deals), then warming (about to rise)
    priority_sports = buy_sports + warming_sports + sell_sports

    hot_queries = {
        "Basketball": [
            {"name": "Victor Wembanyama", "query": "Victor Wembanyama Prizm rookie card", "tag": "Generational Rookie"},
            {"name": "Anthony Edwards", "query": "Anthony Edwards Prizm Silver", "tag": "MVP Candidate"},
            {"name": "Luka Doncic", "query": "Luka Doncic Prizm Silver PSA 10", "tag": "Elite Floor"},
            {"name": "LeBron James", "query": "LeBron James Prizm Silver", "tag": "GOAT Legacy"},
            {"name": "Tyrese Maxey", "query": "Tyrese Maxey Prizm Silver", "tag": "Breakout Star"},
            {"name": "Paolo Banchero", "query": "Paolo Banchero Prizm rookie", "tag": "Young Core"},
        ],
        "Football": [
            {"name": "Caleb Williams", "query": "Caleb Williams Prizm rookie card", "tag": "#1 Pick Rookie"},
            {"name": "Jayden Daniels", "query": "Jayden Daniels Prizm rookie card", "tag": "ROY Winner"},
            {"name": "Drake Maye", "query": "Drake Maye Prizm rookie card", "tag": "QB Prospect"},
            {"name": "Patrick Mahomes", "query": "Patrick Mahomes Prizm Silver PSA 10", "tag": "Dynasty QB"},
            {"name": "Saquon Barkley", "query": "Saquon Barkley Prizm card", "tag": "Comeback Season"},
            {"name": "CJ Stroud", "query": "CJ Stroud Prizm Silver", "tag": "Young Franchise QB"},
            {"name": "Brock Purdy", "query": "Brock Purdy Prizm Silver", "tag": "Mr. Irrelevant Star"},
            {"name": "Lamar Jackson", "query": "Lamar Jackson Prizm Silver PSA 10", "tag": "MVP Caliber"},
        ],
        "Baseball": [
            {"name": "Shohei Ohtani", "query": "Shohei Ohtani Topps Chrome PSA 10", "tag": "Unicorn Player"},
            {"name": "Elly De La Cruz", "query": "Elly De La Cruz Topps Chrome rookie", "tag": "Speed & Power"},
            {"name": "Gunnar Henderson", "query": "Gunnar Henderson Topps Chrome", "tag": "All-Star Breakout"},
            {"name": "Paul Skenes", "query": "Paul Skenes Topps Chrome rookie", "tag": "Pitching Phenom"},
            {"name": "Jackson Holliday", "query": "Jackson Holliday Bowman Chrome", "tag": "#1 Prospect"},
            {"name": "Corbin Carroll", "query": "Corbin Carroll Topps Chrome", "tag": "ROY Winner"},
        ],
        "Hockey": [
            {"name": "Connor Bedard", "query": "Connor Bedard Young Guns rookie", "tag": "Generational Talent"},
            {"name": "Macklin Celebrini", "query": "Macklin Celebrini Upper Deck rookie", "tag": "#1 Pick Rookie"},
            {"name": "Connor McDavid", "query": "Connor McDavid Young Guns PSA 10", "tag": "Best In The World"},
            {"name": "Matvei Michkov", "query": "Matvei Michkov Upper Deck rookie", "tag": "Russian Phenom"},
            {"name": "Adam Fantilli", "query": "Adam Fantilli Young Guns rookie", "tag": "High Ceiling"},
        ],
    }

    signal_label = {1: "Buy Now", 2: "Warming Up", 3: "At Peak"}

    trending = []
    for sport in priority_sports:
        if sport in hot_queries:
            cycle_signal = SPORT_CYCLES[sport][current_month]
            season_tag = signal_label.get(cycle_signal, "")
            for q in hot_queries[sport]:
                trending.append({**q, "sport": sport, "season_signal": season_tag})

    return {"trending": trending[:12], "buy_sports": buy_sports, "priority_sports": priority_sports}


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



# ===== SEASONAL DEALS =====
SEASONAL_QUERIES = {
    "Basketball": {
        "rookies": [
            "Victor Wembanyama Prizm rookie card",
            "Chet Holmgren Prizm rookie card",
            "Brandon Miller rookie card Panini",
        ],
        "proven_stars": [
            "LeBron James Prizm PSA 10",
            "Luka Doncic Prizm silver PSA",
            "Giannis Antetokounmpo Prizm card",
        ],
        "graded_steals": [
            "NBA Prizm PSA 10 rookie card",
            "NBA Optic rated rookie PSA 10",
        ],
        "hype_picks": [
            "Anthony Edwards Prizm card",
            "Tyrese Maxey Prizm card",
            "Paolo Banchero rookie Prizm",
        ],
    },
    "Football": {
        "rookies": [
            "Caleb Williams Prizm rookie card",
            "Drake Maye Prizm rookie card",
            "Jayden Daniels Prizm rookie card",
        ],
        "proven_stars": [
            "Patrick Mahomes Prizm PSA 10",
            "Josh Allen Prizm silver card",
            "Lamar Jackson Prizm card",
        ],
        "graded_steals": [
            "NFL Prizm PSA 10 rookie card",
            "NFL Optic rated rookie PSA 10",
        ],
        "hype_picks": [
            "Saquon Barkley Prizm card",
            "CJ Stroud Prizm rookie card",
            "Brock Purdy Prizm card",
        ],
    },
    "Baseball": {
        "rookies": [
            "Elly De La Cruz Topps Chrome rookie",
            "Gunnar Henderson Topps rookie card",
            "Corbin Carroll Topps Chrome rookie",
        ],
        "proven_stars": [
            "Shohei Ohtani Topps Chrome PSA 10",
            "Mike Trout Topps Chrome PSA",
            "Ronald Acuna Jr Topps Chrome card",
        ],
        "graded_steals": [
            "MLB Topps Chrome PSA 10 rookie",
            "Bowman Chrome 1st PSA 10",
        ],
        "hype_picks": [
            "Jackson Holliday Bowman Chrome card",
            "Junior Caminero Topps card",
            "Paul Skenes Topps Chrome rookie",
        ],
    },
    "Hockey": {
        "rookies": [
            "Connor Bedard Young Guns rookie card",
            "Macklin Celebrini Young Guns rookie",
            "Leo Carlsson Upper Deck rookie card",
        ],
        "proven_stars": [
            "Connor McDavid Young Guns PSA 10",
            "Auston Matthews Young Guns PSA",
            "Nathan MacKinnon Upper Deck card",
        ],
        "graded_steals": [
            "NHL Young Guns PSA 10 rookie",
            "Upper Deck Series 1 Young Guns PSA 10",
        ],
        "hype_picks": [
            "Matvei Michkov Upper Deck rookie",
            "Adam Fantilli Young Guns card",
            "Logan Cooley Upper Deck rookie",
        ],
    },
}

CATEGORY_LABELS = {
    "rookies": {"label": "Rookie Star", "color": "#f59e0b"},
    "proven_stars": {"label": "Proven Star", "color": "#3b82f6"},
    "graded_steals": {"label": "Graded Steal", "color": "#8b5cf6"},
    "hype_picks": {"label": "Hype Pick", "color": "#ef4444"},
}

SPORT_CYCLES = {
    "Basketball": [3, 3, 3, 3, 3, 2, 1, 1, 1, 2, 3, 3],
    "Football":   [3, 3, 1, 1, 1, 1, 2, 3, 3, 3, 3, 3],
    "Baseball":   [1, 1, 2, 3, 3, 3, 3, 3, 3, 3, 1, 1],
    "Hockey":     [3, 3, 3, 3, 3, 2, 1, 1, 2, 3, 3, 3],
}


@router.get("/seasonal-deals")
async def get_seasonal_deals(request: Request):
    """Get eBay listings for sports in BUY season"""
    await get_current_user(request)

    current_month = datetime.now(timezone.utc).month - 1  # 0-indexed

    buy_sports = [sport for sport, cycle in SPORT_CYCLES.items() if cycle[current_month] == 1]
    if not buy_sports:
        buy_sports = [sport for sport, cycle in SPORT_CYCLES.items() if cycle[current_month] == 2]

    results = []
    for sport in buy_sports[:2]:
        sport_queries = SEASONAL_QUERIES.get(sport, {})
        for category, queries in sport_queries.items():
            cat_info = CATEGORY_LABELS.get(category, {"label": category, "color": "#666"})
            for q in queries[:2]:
                try:
                    items = await ebay_browse_search(q, limit=3, sort="price")
                    for item in items:
                        image_url = ""
                        if item.get("image", {}).get("imageUrl"):
                            image_url = item["image"]["imageUrl"]
                        elif item.get("thumbnailImages"):
                            image_url = item["thumbnailImages"][0].get("imageUrl", "")

                        price_val = item.get("price", {}).get("value", "0")
                        price_currency = item.get("price", {}).get("currency", "USD")

                        results.append({
                            "title": item.get("title", ""),
                            "price": f"${price_val}",
                            "currency": price_currency,
                            "price_value": float(price_val),
                            "image_url": image_url,
                            "ebay_url": item.get("itemWebUrl", ""),
                            "item_id": item.get("itemId", ""),
                            "sport": sport,
                            "category": cat_info["label"],
                            "category_color": cat_info["color"],
                            "condition": item.get("condition", ""),
                            "buying_options": item.get("buyingOptions", []),
                        })
                except Exception as e:
                    logger.warning(f"Seasonal deals search error for '{q}': {e}")

    results.sort(key=lambda x: x["price_value"])
    return {"deals": results[:24], "buy_sports": buy_sports}
